// ดาวน์โหลดหนังสือที่ออกแล้ว (ฉบับลงนามที่อัปโหลดไว้) หลายฉบับพร้อมกันเป็น zip
// ตามรอบสหกิจ + ขอบเขตหลักสูตร (อาจารย์ประจำวิชา = หลักสูตรที่ดูแล · ตัวกรองหลักสูตรบนหน้าจอมีผล)
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const prisma = require('../config/prismaClient');
const { getMajorScope, studentWhere } = require('../utils/majorScope');

const UPLOADS = path.join(__dirname, '../uploads');

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

// GET /api/admin/letters/download?type=REQ|PLACE|SUPERVISION&coopPeriodId=
exports.downloadLetters = async (req, res) => {
  try {
    const type = String(req.query.type || '').toUpperCase();
    const spec = LETTER_TYPES[type];
    if (!spec) return res.status(400).json({ ok: false, message: 'type ต้องเป็น REQ, PLACE หรือ SUPERVISION' });
    const periodId = req.query.coopPeriodId && req.query.coopPeriodId !== 'all' ? parseInt(req.query.coopPeriodId, 10) : null;
    if (req.query.coopPeriodId && req.query.coopPeriodId !== 'all' && (!Number.isInteger(periodId) || periodId <= 0)) {
      return res.status(400).json({ ok: false, message: 'coopPeriodId ไม่ถูกต้อง' });
    }

    const scope = await getMajorScope(req);
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
        studentId: true, firstName: true, lastName: true,
        coop: { select: { reqLetterUrl: true, placeLetterUrl: true } },
        supervisionAppointment: { select: { officialLetterPath: true } },
      },
    });

    const entries = [];
    const missing = [];
    const used = new Set();
    for (const s of students) {
      const fp = spec.file(s);
      const who = `${s.studentId} ${[s.firstName, s.lastName].filter(Boolean).join(' ')}`.trim();
      // กันหลุดออกนอกโฟลเดอร์ uploads (ชื่อไฟล์ใน DB มาจากระบบเอง แต่ตรวจไว้ก่อน) — ต่อ path.sep กันโฟลเดอร์ข้างๆ ชื่อขึ้นต้นเหมือนกัน เช่น uploads-old/
      if (!fp || !path.resolve(fp).startsWith(UPLOADS + path.sep) || !fs.existsSync(fp)) { missing.push(who); continue; }
      const name = uniqueName(`${safeName(`${s.studentId}_${s.firstName || ''}_${s.lastName || ''}`)}_${spec.label}${path.extname(fp) || '.pdf'}`, used);
      entries.push({ fp, name });
    }
    if (!entries.length) {
      return res.status(404).json({ ok: false, message: missing.length ? `ไม่พบไฟล์${spec.label}ในเครื่อง (${missing.length} คน)` : `ยังไม่มี${spec.label}ที่ออกแล้วในรายการนี้` });
    }

    const zipName = `letters_${type}_${periodId || 'all'}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
    res.setHeader('X-Letter-Count', String(entries.length));
    res.setHeader('X-Letter-Missing', String(missing.length));
    res.setHeader('Access-Control-Expose-Headers', 'X-Letter-Count, X-Letter-Missing, Content-Disposition');

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => { console.error('[downloadLetters] zip', err); res.destroy(err); });
    archive.pipe(res);
    for (const e of entries) archive.file(e.fp, { name: e.name });
    if (missing.length) {
      archive.append(`ไม่พบไฟล์${spec.label}ของนักศึกษาต่อไปนี้ (มีข้อมูลว่าออกแล้วแต่ไม่พบไฟล์ในเครื่อง):\r\n${missing.join('\r\n')}\r\n`, { name: '_ไม่พบไฟล์.txt' });
    }
    await archive.finalize();
  } catch (err) {
    console.error('[downloadLetters]', err);
    if (!res.headersSent) res.status(500).json({ ok: false, message: 'ดาวน์โหลดหนังสือไม่สำเร็จ' });
    else res.destroy(err);
  }
};

exports.LETTER_TYPES = LETTER_TYPES;
