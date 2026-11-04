const prisma = require('../config/prismaClient');

// ==================================================
// 1. ดึงข้อมูล "ทุกสาขา" สำหรับหน้า Admin (A_CriteriaPage)
// ==================================================
exports.getAllCriteria = async (req, res) => {
  try {
    const criteria = await prisma.coopCriteria.findMany({
      orderBy: { major: 'asc' }
    });
    res.json({ ok: true, criteria });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// ==================================================
// 2a. สร้างสาขาใหม่ (POST)
// ==================================================
exports.createCriteria = async (req, res) => {
  try {
    const { major, nameTh } = req.body;
    if (!major || !major.trim()) return res.status(400).json({ ok: false, message: "กรุณาระบุชื่อหลักสูตร" });

    // สร้างเท่านั้น — เดิม upsert: กรอกรหัสที่มีอยู่แล้ว = ทับชื่อไทยของหลักสูตรนั้นเงียบ ๆ (แก้ชื่อใช้ PUT)
    const criteria = await prisma.coopCriteria.create({
      data: { major: major.trim(), nameTh: nameTh?.trim() || null },
    });

    res.json({ ok: true, criteria });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ ok: false, message: "รหัสหลักสูตรนี้มีอยู่แล้ว — ถ้าจะแก้ชื่อ ให้กดแก้ไขที่หลักสูตรนั้น" });
    console.error(err);
    res.status(500).json({ ok: false, message: "Save failed" });
  }
};

// รหัสหลักสูตรที่เก็บเป็นข้อความ (ไม่มี FK ตามให้) — เปลี่ยนรหัสต้องตามแก้เอง
const ALIASES_KEY = 'MAJOR_IMPORT_ALIASES';
async function renameMajorReferences(tx, from, to) {
  await tx.student.updateMany({ where: { major: from }, data: { major: to } });
  await tx.teacher.updateMany({ where: { major: from }, data: { major: to } });
  const anns = await tx.announcement.findMany({ select: { id: true, targetMajors: true } });
  for (const a of anns) {
    const list = Array.isArray(a.targetMajors) ? a.targetMajors : [];
    if (list.includes(from)) await tx.announcement.update({ where: { id: a.id }, data: { targetMajors: [...new Set(list.map((m) => (m === from ? to : m)))] } });
  }
  // ค่าตั้งค่าเฉพาะหลักสูตร (<key>@<major>)
  for (const row of await tx.systemConfig.findMany({ where: { key: { endsWith: `@${from}` } } })) {
    const key = `${row.key.slice(0, -from.length)}${to}`;
    await tx.systemConfig.upsert({ where: { key }, update: { value: row.value }, create: { key, value: row.value } });
    await tx.systemConfig.delete({ where: { key: row.key } });
  }
  // ชื่อในไฟล์นำเข้าที่เคยจับคู่ไว้กับรหัสเดิม
  const aliasRow = await tx.systemConfig.findUnique({ where: { key: ALIASES_KEY } });
  if (aliasRow) {
    let aliases = {};
    try { aliases = JSON.parse(aliasRow.value) || {}; } catch { /* ค่าเสีย — ไม่แตะ */ }
    if (Object.values(aliases).includes(from)) {
      const value = JSON.stringify(Object.fromEntries(Object.entries(aliases).map(([k, v]) => [k, v === from ? to : v])));
      await tx.systemConfig.update({ where: { key: ALIASES_KEY }, data: { value } });
    }
  }
}

// ข้อมูลที่ยังใช้หลักสูตรนี้อยู่ — ลบหลักสูตร = ตารางที่ผูก FK (รอบ/หัวข้อ T000/อาจารย์ประจำวิชา) หายตาม (cascade) ส่วนนักศึกษา/อาจารย์ค้างรหัสที่ไม่มีแล้ว
async function majorUsage(major) {
  const [students, teachers, coopTeachers, rounds, docRules, anns] = await Promise.all([
    prisma.student.count({ where: { major } }),
    prisma.teacher.count({ where: { major } }),
    prisma.coopTeacherMajor.count({ where: { major } }),
    prisma.coopPeriodMajor.count({ where: { major } }),
    prisma.documentRequirementMajor.count({ where: { major } }),
    prisma.announcement.findMany({ select: { targetMajors: true } }),
  ]);
  const announcements = anns.filter((a) => Array.isArray(a.targetMajors) && a.targetMajors.includes(major)).length;
  return { students, teachers, coopTeachers, rounds, docRules, announcements };
}
const USAGE_LABEL = { students: 'นักศึกษา', teachers: 'อาจารย์', coopTeachers: 'อาจารย์ประจำวิชา', rounds: 'รอบสหกิจที่ตั้งค่าไว้', docRules: 'หัวข้อเอกสาร T000', announcements: 'ประกาศ' };

// ==================================================
// 2b. แก้ไขชื่อสาขา (PUT by id)
// ==================================================
exports.updateCriteria = async (req, res) => {
  try {
    const { id } = req.params;
    const { major, nameTh } = req.body;
    if (!major || !major.trim()) return res.status(400).json({ ok: false, message: "กรุณาระบุชื่อหลักสูตร" });

    // ผู้ใช้ตัดสิน 2026-11-04: เปลี่ยนรหัส = ตามแก้ทุกที่ในทรานแซกชันเดียว (ตาราง FK ตามเองด้วย onUpdate Cascade)
    // เดิมนักศึกษา/อาจารย์/ประกาศ/ค่าตั้งค่าเฉพาะหลักสูตรค้างรหัสเก่า — อาจารย์มองไม่เห็นนักศึกษา นักศึกษาหลุดรอบ
    const criteria = await prisma.$transaction(async (tx) => {
      const current = await tx.coopCriteria.findUnique({ where: { id } });
      if (!current) throw Object.assign(new Error('not found'), { code: 'P2025' });
      const to = major.trim();
      const updated = await tx.coopCriteria.update({ where: { id }, data: { major: to, nameTh: nameTh?.trim() || null } });
      if (current.major !== to) await renameMajorReferences(tx, current.major, to);
      return updated;
    }, { timeout: 30000 }); // ประกาศ/ค่าตั้งค่าเยอะ — ค่าเริ่มต้น 5 วินาทีไม่พอ (ไม่ทันก็ย้อนทั้งหมด)

    res.json({ ok: true, criteria });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') return res.status(404).json({ ok: false, message: "ไม่พบหลักสูตรที่ต้องการแก้ไข" });
    if (err.code === 'P2002') return res.status(409).json({ ok: false, message: "ชื่อหลักสูตรนี้มีอยู่แล้ว" });
    res.status(500).json({ ok: false, message: "Save failed" });
  }
};

// ==================================================
// 3. ลบสาขา (สำหรับหน้า Admin)
// ==================================================
exports.deleteCriteria = async (req, res) => {
  try {
    const { id } = req.params;
    const current = await prisma.coopCriteria.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลที่ต้องการลบ" });
    // ผู้ใช้ตัดสิน 2026-11-04: ยังมีคนใช้ = ห้ามลบ (เดิมลบได้ทันที — วันรับสมัคร/กำหนดส่ง/ช่วงนิเทศทุกรอบ หัวข้อ T000
    // และอาจารย์ประจำวิชาของหลักสูตรหายตาม กู้คืนไม่ได้) · ลบได้เฉพาะหลักสูตรที่ไม่มีใครใช้ (เช่น สร้างผิด)
    const usage = await majorUsage(current.major);
    const used = Object.entries(usage).filter(([, n]) => n > 0);
    if (used.length) {
      return res.status(409).json({
        ok: false, code: 'MAJOR_IN_USE', usage,
        message: `ลบหลักสูตร ${current.major} ไม่ได้ — ยังมีข้อมูลใช้อยู่: ${used.map(([k, n]) => `${USAGE_LABEL[k]} ${n}`).join(' · ')}`,
      });
    }
    await prisma.$transaction(async (tx) => {
      await tx.coopCriteria.delete({ where: { id } });
      // ค่าตั้งค่าเฉพาะหลักสูตรของหลักสูตรที่ลบ (ไม่มีที่ใช้แล้ว)
      await tx.systemConfig.deleteMany({ where: { key: { endsWith: `@${current.major}` } } });
      // ชื่อในไฟล์นำเข้าที่จับคู่ไว้กับหลักสูตรนี้ — ไม่งั้นนำเข้าครั้งหน้าจับคู่ไปรหัสที่ไม่มีแล้ว
      const aliasRow = await tx.systemConfig.findUnique({ where: { key: ALIASES_KEY } });
      let aliases = null;
      try { aliases = aliasRow ? JSON.parse(aliasRow.value) : null; } catch { /* ค่าเสีย — ไม่แตะ */ }
      if (aliases && typeof aliases === 'object' && Object.values(aliases).includes(current.major)) {
        const value = JSON.stringify(Object.fromEntries(Object.entries(aliases).filter(([, v]) => v !== current.major)));
        await tx.systemConfig.update({ where: { key: ALIASES_KEY }, data: { value } });
      }
    });
    res.json({ ok: true, message: "Deleted successfully" });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลที่ต้องการลบ" });
    }
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

exports.getMajorList = async (req, res) => {
  try {
    const criteria = await prisma.coopCriteria.findMany({
      select: { major: true },
      orderBy: { major: 'asc' }
    });

    const majorList = criteria.map(c => c.major);

    res.json({ ok: true, majors: majorList });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};

// ==================================================
// 5. ดึงสาขาพร้อมชื่อไทย (สำหรับ student/teacher — any role)
// ==================================================
exports.getDepartmentsWithNames = async (req, res) => {
  try {
    const criteria = await prisma.coopCriteria.findMany({
      select: { major: true, nameTh: true },
      orderBy: { major: 'asc' }
    });
    res.json({ ok: true, departments: criteria });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่ Server" });
  }
};
