// ดาวน์โหลดหนังสือที่ออกแล้ว (ฉบับลงนามที่อัปโหลดไว้) หลายฉบับพร้อมกันเป็น zip
// ตามรอบสหกิจ + ขอบเขตหลักสูตร (อาจารย์ประจำวิชา = หลักสูตรที่ดูแล · ตัวกรองหลักสูตรมีผล แต่ไม่ขยายสิทธิ์)
//
// หน้าเว็บ: summary (หน้าต่างยืนยัน: กี่ฉบับ ขนาดเท่าไร ใครบ้าง) → download-link → เบราว์เซอร์เปิด /letters/zip?t=… เอง
// (เดิม fetch แล้ว res.blob() — ไฟล์สแกนฉบับละ 10–30 MB รวมเป็นหลายร้อย MB ค้างที่ "กำลังเตรียมไฟล์" ไม่มีความคืบหน้า)
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const archiver = require('archiver');
const prisma = require('../config/prismaClient');
const { getMajorScope, studentWhere } = require('../utils/majorScope');

const UPLOADS = path.join(__dirname, '../uploads');
const LINK_PURPOSE = 'letters-zip';
const LINK_TTL = '5m';

const LETTER_TYPES = {
  REQ: {
    label: 'หนังสือขอความอนุเคราะห์',
    where: { coop: { reqLetterUrl: { not: null } } },
    file: (s) => s.coop?.reqLetterUrl && path.join(UPLOADS, s.coop.reqLetterUrl),
  },
  PLACE: {
    label: 'หนังสือส่งตัว',
    where: { coop: { placeLetterUrl: { not: null } } },
    file: (s) => s.coop?.placeLetterUrl && path.join(UPLOADS, s.coop.placeLetterUrl),
  },
  SUPERVISION: {
    label: 'หนังสือขอนิเทศ',
    where: { supervisionAppointment: { officialLetterPath: { not: null } } },
    file: (s) => s.supervisionAppointment?.officialLetterPath && path.join(UPLOADS, 'supervision', s.supervisionAppointment.officialLetterPath),
  },
};

// ชื่อไฟล์ใน zip: รหัส_ชื่อ_นามสกุล_ประเภท.pdf — ตัดอักขระที่ใช้ในชื่อไฟล์ไม่ได้
const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|\r\n\t]+/g, '-').replace(/\s+/g, ' ').trim();

// ชื่อซ้ำ (เช่น นักศึกษาคนเดียวกันสองแถว) → เติม (2), (3)
function uniqueName(name, used) {
  if (!used.has(name)) { used.add(name); return name; }
  const ext = path.extname(name), base = name.slice(0, name.length - ext.length);
  for (let i = 2; ; i++) { const n = `${base} (${i})${ext}`; if (!used.has(n)) { used.add(n); return n; } }
}

const bad = (message) => Object.assign(new Error(message), { status: 400 });

/** ตรวจพารามิเตอร์ (query หรือ body) — major: undefined = ใช้ตัวกรองบนแถบบน (header) */
function parseParams(src) {
  const type = String(src?.type || '').toUpperCase();
  if (!LETTER_TYPES[type]) throw bad('type ต้องเป็น REQ, PLACE หรือ SUPERVISION');
  const raw = src?.coopPeriodId;
  const periodId = raw && raw !== 'all' ? parseInt(raw, 10) : null;
  if (raw && raw !== 'all' && (!Number.isInteger(periodId) || periodId <= 0)) throw bad('coopPeriodId ไม่ถูกต้อง');
  const major = src?.major === undefined ? undefined : String(src.major || '');
  return { type, periodId, major };
}

/** หนังสือที่จะอยู่ใน zip ตามสิทธิ์ของผู้เรียก + ตัวกรอง */
async function collect(req, { type, periodId, major }) {
  const spec = LETTER_TYPES[type];
  const scope = await getMajorScope(req, major === undefined ? {} : { filter: major });
  const students = await prisma.student.findMany({
    where: {
      AND: [
        { deletedAt: null },
        studentWhere(scope),
        spec.where,
        ...(periodId ? [{ coop: { coopPeriodId: periodId } }] : []),
      ],
    },
    orderBy: { studentId: 'asc' },
    select: {
      studentId: true, firstName: true, lastName: true, major: true,
      coop: { select: { reqLetterUrl: true, placeLetterUrl: true } },
      supervisionAppointment: { select: { officialLetterPath: true } },
    },
  });

  const entries = [];
  const missing = [];
  const used = new Set();
  for (const s of students) {
    const fp = spec.file(s);
    const name = [s.firstName, s.lastName].filter(Boolean).join(' ');
    const who = `${s.studentId} ${name}`.trim();
    // กันหลุดออกนอกโฟลเดอร์ uploads (ชื่อไฟล์ใน DB มาจากระบบเอง แต่ตรวจไว้ก่อน) — ต่อ path.sep กันโฟลเดอร์ข้างๆ ชื่อขึ้นต้นเหมือนกัน เช่น uploads-old/
    if (!fp || !path.resolve(fp).startsWith(UPLOADS + path.sep) || !fs.existsSync(fp)) {
      missing.push({ studentId: s.studentId, name, who });
      continue;
    }
    let size = 0;
    try { size = fs.statSync(fp).size; } catch (_) { /* ขนาดไม่สำคัญพอจะล้ม */ }
    const zipName = uniqueName(`${safeName(`${s.studentId}_${s.firstName || ''}_${s.lastName || ''}`)}_${spec.label}${path.extname(fp) || '.pdf'}`, used);
    entries.push({ fp, name: zipName, size, studentId: s.studentId, studentName: name, major: s.major });
  }
  return { spec, entries, missing };
}

const emptyMessage = ({ spec, missing }) => (missing.length
  ? `ไม่พบไฟล์${spec.label}ในเครื่อง (${missing.length} คน)`
  : `ยังไม่มี${spec.label}ที่ออกแล้วในรายการนี้`);

// ชื่อ zip: ASCII สำรอง + ชื่อไทย (RFC 5987) เช่น หนังสือส่งตัว_เทอม2-2569_CS.zip
async function zipFileNames({ type, periodId, major }, spec) {
  const p = periodId ? await prisma.coopPeriod.findUnique({ where: { id: periodId }, select: { semester: true, academicYear: true } }) : null;
  const round = p ? `เทอม${p.semester}-${p.academicYear}` : periodId ? `รอบ${periodId}` : 'ทุกรอบ';
  const tag = [periodId ? `round${periodId}` : 'all', major && major !== '__none__' ? major : null].filter(Boolean).join('_');
  const th = [spec.label, round, major === '__none__' ? 'ยังไม่ระบุหลักสูตร' : major || null].filter(Boolean).join('_');
  return { ascii: `letters_${type}_${tag}.zip`.replace(/[^\w.-]/g, '-'), utf8: `${safeName(th)}.zip` };
}

async function streamZip(res, params, { spec, entries, missing }) {
  const names = await zipFileNames(params, spec);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${names.ascii}"; filename*=UTF-8''${encodeURIComponent(names.utf8)}`);
  res.setHeader('X-Letter-Count', String(entries.length));
  res.setHeader('X-Letter-Missing', String(missing.length));
  res.setHeader('Access-Control-Expose-Headers', 'X-Letter-Count, X-Letter-Missing, Content-Disposition');

  // PDF สแกนบีบอัดแทบไม่ลด — store เฉยๆ เร็วกว่าและไม่กิน CPU
  const archive = archiver('zip', { store: true });
  archive.on('error', (err) => { console.error('[letters zip]', err); res.destroy(err); });
  archive.pipe(res);
  for (const e of entries) archive.file(e.fp, { name: e.name });
  if (missing.length) {
    archive.append(`ไม่พบไฟล์${spec.label}ของนักศึกษาต่อไปนี้ (มีข้อมูลว่าออกแล้วแต่ไม่พบไฟล์ในเครื่อง):\r\n${missing.map((m) => m.who).join('\r\n')}\r\n`, { name: '_ไม่พบไฟล์.txt' });
  }
  return archive.finalize();
}

function fail(res, err, tag) {
  if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
  console.error(tag, err);
  if (!res.headersSent) return res.status(500).json({ ok: false, message: 'ดาวน์โหลดหนังสือไม่สำเร็จ' });
  return res.destroy(err);
}

// GET /api/admin/letters/summary?type=&coopPeriodId=&major= — หน้าต่างยืนยันก่อนดาวน์โหลด
exports.letterSummary = async (req, res) => {
  try {
    const params = parseParams(req.query);
    const { spec, entries, missing } = await collect(req, params);
    res.json({
      ok: true,
      type: params.type,
      label: spec.label,
      fileName: (await zipFileNames(params, spec)).utf8,
      count: entries.length,
      totalBytes: entries.reduce((sum, e) => sum + e.size, 0),
      students: entries.map((e) => ({ studentId: e.studentId, name: e.studentName, major: e.major, size: e.size })),
      missing: missing.map((m) => ({ studentId: m.studentId, name: m.name })),
    });
  } catch (err) {
    fail(res, err, '[letterSummary]');
  }
};

// POST /api/admin/letters/download-link { type, coopPeriodId, major } → ลิงก์ให้เบราว์เซอร์ดาวน์โหลดเอง (อายุ 5 นาที)
exports.createDownloadLink = async (req, res) => {
  try {
    const params = parseParams(req.body || {});
    const collected = await collect(req, params);
    if (!collected.entries.length) return res.status(404).json({ ok: false, message: emptyMessage(collected) });
    const t = jwt.sign(
      { purpose: LINK_PURPOSE, uid: req.user.id, role: req.user.role, type: params.type, periodId: params.periodId, major: params.major ?? null },
      process.env.JWT_SECRET,
      { expiresIn: LINK_TTL },
    );
    res.json({ ok: true, url: `/api/admin/letters/zip?t=${encodeURIComponent(t)}`, count: collected.entries.length });
  } catch (err) {
    fail(res, err, '[createDownloadLink]');
  }
};

// GET /api/admin/letters/zip?t=… — ไม่ใช้ header Authorization (เบราว์เซอร์เปิดลิงก์เอง) · สิทธิ์มาจากลิงก์ที่ออกให้
// ตรวจขอบเขตหลักสูตรใหม่ตอนดาวน์โหลด (สิทธิ์ที่ถูกถอนระหว่างนั้นมีผลทันที)
exports.downloadByLink = async (req, res) => {
  let claims;
  try {
    claims = jwt.verify(String(req.query.t || ''), process.env.JWT_SECRET);
    if (claims.purpose !== LINK_PURPOSE) throw new Error('wrong purpose');
  } catch (_) {
    res.status(401).type('text/plain; charset=utf-8').send('ลิงก์ดาวน์โหลดหมดอายุหรือไม่ถูกต้อง — กลับไปกดดาวน์โหลดใหม่');
    return;
  }
  try {
    // บัญชีถูกลบ/เปลี่ยน role หลังออกลิงก์ → ใช้ไม่ได้
    const user = await prisma.user.findUnique({ where: { id: claims.uid }, select: { role: true } });
    if (!user || String(user.role).toLowerCase() !== String(claims.role).toLowerCase()) {
      res.status(401).type('text/plain; charset=utf-8').send('ลิงก์ดาวน์โหลดหมดอายุหรือไม่ถูกต้อง — กลับไปกดดาวน์โหลดใหม่');
      return;
    }
    req.user = { id: claims.uid, role: claims.role };
    const params = { type: claims.type, periodId: claims.periodId, major: claims.major ?? undefined };
    const collected = await collect(req, params);
    if (!collected.entries.length) {
      res.status(404).type('text/plain; charset=utf-8').send(emptyMessage(collected));
      return;
    }
    await streamZip(res, params, collected);
  } catch (err) {
    console.error('[downloadByLink]', err);
    if (!res.headersSent) res.status(500).type('text/plain; charset=utf-8').send('ดาวน์โหลดหนังสือไม่สำเร็จ');
    else res.destroy(err);
  }
};

// GET /api/admin/letters/download?type=&coopPeriodId= — แบบเดิม (Authorization header) ยังใช้ได้สำหรับ API/สคริปต์
exports.downloadLetters = async (req, res) => {
  try {
    const params = parseParams(req.query);
    const collected = await collect(req, params);
    if (!collected.entries.length) return res.status(404).json({ ok: false, message: emptyMessage(collected) });
    await streamZip(res, params, collected);
  } catch (err) {
    fail(res, err, '[downloadLetters]');
  }
};

exports.LETTER_TYPES = LETTER_TYPES;
exports.LINK_PURPOSE = LINK_PURPOSE;
