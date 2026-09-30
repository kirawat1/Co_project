const prisma = require('../config/prismaClient');
const { RULES_INCLUDE, withRules, isShared, appliesTo } = require('../utils/docRequirementScope');
const { getMajorScope } = require('../utils/majorScope');

const httpError = (status, message) => Object.assign(new Error(message), { status });
const send = (res, err, fallback) => {
  if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
  if (err.code === 'P2025') return res.status(404).json({ ok: false, message: 'ไม่พบข้อมูล' });
  if (err.code === 'P2002') return res.status(400).json({ ok: false, message: 'รหัสเอกสาร (Key) ซ้ำกัน กรุณาใช้รหัสอื่น' });
  console.error(err);
  return res.status(500).json({ ok: false, message: fallback });
};

// รายการหลักสูตรจาก body — ตรวจว่ามีจริง · อาจารย์ประจำวิชาต้องเลือกอย่างน้อย 1 หลักสูตรและเฉพาะที่ดูแล
async function parseMajors(raw, scope) {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.some((m) => typeof m !== 'string' || !m.trim())) {
    throw httpError(400, 'majors ต้องเป็นรายการรหัสหลักสูตร');
  }
  const majors = [...new Set(raw.map((m) => m.trim()))];
  if (!scope.all && (majors.length === 0 || majors.some((m) => !scope.majors.includes(m)))) {
    throw httpError(403, `อาจารย์ประจำวิชากำหนดหัวข้อได้เฉพาะหลักสูตรที่ดูแล (${scope.majors.join(', ') || '-'}) — หัวข้อทุกหลักสูตรเป็นของเจ้าหน้าที่`);
  }
  if (majors.length) {
    const found = await prisma.coopCriteria.findMany({ where: { major: { in: majors } }, select: { major: true } });
    const missing = majors.filter((m) => !found.some((f) => f.major === m));
    if (missing.length) throw httpError(400, `ไม่พบหลักสูตร: ${missing.join(', ')}`);
  }
  return majors;
}

// อาจารย์ประจำวิชาแก้/ลบได้เฉพาะหัวข้อที่ใช้เฉพาะหลักสูตรของตัวเองทั้งหมด
const canManage = (scope, r) => scope.all || (!isShared(r) && r.majors.every((m) => scope.majors.includes(m)));

async function loadRequirement(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) throw httpError(400, 'ID ไม่ถูกต้อง');
  const r = await prisma.documentRequirement.findUnique({ where: { id: numId }, include: RULES_INCLUDE });
  if (!r) throw httpError(404, 'ไม่พบข้อมูล');
  return withRules(r);
}

// 1a. หัวข้อที่เปิดใช้ — นักศึกษาได้เฉพาะหัวข้อของหลักสูตรตัวเอง
exports.getRequirements = async (req, res) => {
  try {
    const rows = (await prisma.documentRequirement.findMany({
      where: { isActive: true }, include: RULES_INCLUDE, orderBy: { id: 'asc' },
    })).map(withRules);
    if (String(req.user?.role || '').toLowerCase() !== 'student') return res.json({ ok: true, requirements: rows });
    const student = await prisma.student.findUnique({ where: { userId: req.user.id }, select: { major: true } });
    res.json({ ok: true, requirements: rows.filter((r) => appliesTo(r, student?.major)) });
  } catch (error) {
    send(res, error, 'Server error');
  }
};

// 1b. ทั้งหมด (รวมที่ปิด) สำหรับหน้าจัดการ — อาจารย์ประจำวิชา/ตัวกรองหลักสูตร เห็นหัวข้อกลาง + หัวข้อของหลักสูตรตัวเอง
exports.getAllRequirements = async (req, res) => {
  try {
    const scope = await getMajorScope(req);
    const rows = (await prisma.documentRequirement.findMany({ include: RULES_INCLUDE, orderBy: { id: 'asc' } })).map(withRules);
    const visible = scope.all ? rows : rows.filter((r) => isShared(r) || r.majors.some((m) => scope.majors.includes(m)));
    const manageScope = await getMajorScope(req, { ignoreFilter: true });
    res.json({ ok: true, requirements: visible.map((r) => ({ ...r, canManage: canManage(manageScope, r) })) });
  } catch (error) {
    send(res, error, 'Server error');
  }
};

// 2. สร้างหัวข้อเอกสารใหม่
exports.createRequirement = async (req, res) => {
  try {
    const { docKey, title, description, isRequired, isActive } = req.body;
    if (!docKey || typeof docKey !== 'string' || !title || typeof title !== 'string') {
      throw httpError(400, 'docKey และ title เป็นข้อมูลที่จำเป็น');
    }
    const scope = await getMajorScope(req);
    const majors = (await parseMajors(req.body.majors ?? [], scope));
    const created = await prisma.documentRequirement.create({
      data: {
        docKey, title, description, isRequired, isActive,
        majorRules: { create: majors.map((major) => ({ major, excluded: false })) },
      },
      include: RULES_INCLUDE,
    });
    res.json({ ok: true, requirement: withRules(created) });
  } catch (error) {
    send(res, error, 'Server error');
  }
};

// 3. แก้ไขหัวข้อเอกสาร (majors = [] → เปลี่ยนเป็นหัวข้อกลาง ทุกหลักสูตร)
exports.updateRequirement = async (req, res) => {
  try {
    const current = await loadRequirement(req.params.id);
    const scope = await getMajorScope(req);
    if (!canManage(scope, current)) throw httpError(403, 'แก้ได้เฉพาะหัวข้อของหลักสูตรที่คุณดูแล — หัวข้อทุกหลักสูตรเป็นของเจ้าหน้าที่ (ปิดใช้สำหรับหลักสูตรตัวเองได้)');

    const { docKey, title, description, isRequired, isActive } = req.body;
    if (docKey !== undefined && (docKey === null || typeof docKey !== 'string')) throw httpError(400, 'docKey ต้องเป็น string');
    if (title !== undefined && (title === null || typeof title !== 'string')) throw httpError(400, 'title ต้องเป็น string');
    const majors = await parseMajors(req.body.majors, scope);

    const data = {};
    if (docKey !== undefined) data.docKey = docKey;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (isRequired !== undefined) data.isRequired = isRequired;
    if (isActive !== undefined) data.isActive = isActive;

    await prisma.$transaction(async (tx) => {
      await tx.documentRequirement.update({ where: { id: current.id }, data });
      if (majors !== undefined) {
        // เปลี่ยนหลักสูตรที่ใช้ → รายการ "ปิดหัวข้อกลาง" เดิมไม่มีความหมายแล้ว ล้างทิ้งพร้อมกัน
        await tx.documentRequirementMajor.deleteMany({ where: { requirementId: current.id } });
        if (majors.length) await tx.documentRequirementMajor.createMany({ data: majors.map((major) => ({ requirementId: current.id, major, excluded: false })) });
      }
    });
    res.json({ ok: true, requirement: await loadRequirement(current.id) });
  } catch (error) {
    send(res, error, 'Server error');
  }
};

// 4. ลบหัวข้อเอกสาร
exports.deleteRequirement = async (req, res) => {
  try {
    const current = await loadRequirement(req.params.id);
    if (!canManage(await getMajorScope(req), current)) throw httpError(403, 'ลบได้เฉพาะหัวข้อของหลักสูตรที่คุณดูแล');
    await prisma.documentRequirement.delete({ where: { id: current.id } });
    res.json({ ok: true, message: 'ลบสำเร็จ' });
  } catch (error) {
    send(res, error, 'Server error');
  }
};

// 5. เปิด/ปิดหัวข้อกลาง (ทุกหลักสูตร) สำหรับหลักสูตรหนึ่ง — PUT /doc-requirements/:id/exclusions { major, excluded }
exports.setExclusion = async (req, res) => {
  try {
    const current = await loadRequirement(req.params.id);
    if (!isShared(current)) throw httpError(400, 'ปิดใช้รายหลักสูตรได้เฉพาะหัวข้อทุกหลักสูตร — หัวข้อเฉพาะหลักสูตรให้แก้ไขรายชื่อหลักสูตรแทน');
    const { major, excluded } = req.body || {};
    if (typeof major !== 'string' || !major || typeof excluded !== 'boolean') throw httpError(400, 'ต้องระบุ major และ excluded (true/false)');
    const scope = await getMajorScope(req);
    if (!scope.all && !scope.majors.includes(major)) throw httpError(403, 'ตั้งค่าได้เฉพาะหลักสูตรที่คุณดูแล');
    if (!(await prisma.coopCriteria.findUnique({ where: { major }, select: { major: true } }))) throw httpError(400, `ไม่พบหลักสูตร: ${major}`);

    const key = { requirementId_major: { requirementId: current.id, major } };
    if (excluded) {
      await prisma.documentRequirementMajor.upsert({ where: key, update: { excluded: true }, create: { requirementId: current.id, major, excluded: true } });
    } else {
      await prisma.documentRequirementMajor.deleteMany({ where: { requirementId: current.id, major, excluded: true } });
    }
    res.json({ ok: true, requirement: await loadRequirement(current.id) });
  } catch (error) {
    send(res, error, 'Server error');
  }
};
