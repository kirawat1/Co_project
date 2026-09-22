const prisma = require('../config/prismaClient');
const XLSX = require('xlsx');
const { RETENTION_DAYS } = require('../middlewares/auditLogger');

const MAX_LIMIT = 200;
const EXPORT_LIMIT = 20000;

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const pad2 = (n) => String(n).padStart(2, '0');

// ยึดเวลาไทยเสมอ ไม่อิงเขตเวลาของเครื่อง — ถ้าเครื่องถูกตั้งเป็น UTC เวลาในไฟล์จะเพี้ยน 7 ชั่วโมง
// และตัวกรองวันที่จะตกช่วงเที่ยงคืน–ตี 7 ของวันนั้นไป
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
function thaiDateTime(d) {
  const t = new Date(new Date(d).getTime() + BKK_OFFSET_MS);
  return `${t.getUTCDate()} ${THAI_MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear() + 543} ${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}`;
}
// "2026-09-22" → ต้นวัน/ปลายวันตามเวลาไทย
function bangkokBound(value, endOfDay) {
  const raw = String(value).trim();
  const d = DATE_ONLY_RE.test(raw)
    ? new Date(`${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`)
    : new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
const ROLE_LABEL_TH = { staff: 'เจ้าหน้าที่', teacher: 'อาจารย์', student: 'นักศึกษา' };
// ตัวกรองเรื่องเอกสาร — รายการอยู่ที่ utils/auditActions.js ที่เดียวกับชื่อการกระทำ
const { DOC_ACTION_PREFIXES } = require('../utils/auditActions');

// เงื่อนไขค้นหาร่วมของทั้งหน้ารายการและไฟล์ export
function buildWhere(query) {
  const where = {};
  const { role, userId, q, from, to, onlyFailed } = query;

  // แท็บแยกตามสิทธิ์ · anonymous = ยังไม่ได้ล็อกอิน (เช่น พยายามเข้าสู่ระบบแล้วไม่ผ่าน)
  if (role === 'anonymous') where.role = null;
  else if (role && ROLE_LABEL_TH[role]) where.role = role;
  if (userId) {
    const id = parseInt(userId, 10);
    if (isNaN(id)) throw Object.assign(new Error('userId ไม่ถูกต้อง'), { is400: true });
    where.userId = id;
  }
  if (from || to) {
    where.createdAt = {};
    if (from) {
      const d = bangkokBound(from, false);
      if (!d) throw Object.assign(new Error('วันที่เริ่มไม่ถูกต้อง'), { is400: true });
      where.createdAt.gte = d;
    }
    if (to) {
      const d = bangkokBound(to, true);
      if (!d) throw Object.assign(new Error('วันที่สิ้นสุดไม่ถูกต้อง'), { is400: true });
      where.createdAt.lte = d;
    }
  }
  if (onlyFailed === 'true' || onlyFailed === true) where.statusCode = { gte: 400 };
  // เฉพาะเรื่องเอกสาร — ใครออกเอกสารอะไร ให้ใคร (ชื่อการกระทำขึ้นต้นตามตารางใน utils/auditActions.js)
  if (query.docsOnly === 'true' || query.docsOnly === true) {
    where.AND = [...(where.AND || []), { OR: DOC_ACTION_PREFIXES.map((p) => ({ action: { startsWith: p } })) }];
  }
  const keyword = String(q || '').trim();
  if (keyword) {
    where.OR = [
      { actorName: { contains: keyword } },
      { action: { contains: keyword } },
      { path: { contains: keyword } },
      { targetId: { contains: keyword } },
      { targetName: { contains: keyword } },
    ];
  }
  return where;
}

// GET /api/admin/logs — เจ้าหน้าที่เท่านั้น
exports.getAuditLogs = async (req, res) => {
  try {
    const where = buildWhere(req.query);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || 50));

    // จำนวนของแต่ละแท็บ (เจ้าหน้าที่/อาจารย์/นักศึกษา/ไม่ได้ล็อกอิน) ใช้ตัวกรองเดียวกันยกเว้นสิทธิ์
    const { role: _selectedRole, ...queryWithoutRole } = req.query;
    const countWhere = buildWhere(queryWithoutRole);

    const [total, logs, grouped] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.groupBy({ by: ['role'], where: countWhere, _count: { _all: true } }),
    ]);

    const roleCounts = { all: 0, staff: 0, teacher: 0, student: 0, anonymous: 0 };
    for (const g of grouped) {
      const key = g.role && ROLE_LABEL_TH[g.role] ? g.role : 'anonymous';
      roleCounts[key] += g._count._all;
      roleCounts.all += g._count._all;
    }

    res.json({
      ok: true,
      data: logs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1, retentionDays: RETENTION_DAYS, roleCounts },
    });
  } catch (err) {
    if (err.is400) return res.status(400).json({ ok: false, message: err.message });
    console.error('getAuditLogs error:', err);
    res.status(500).json({ ok: false, message: 'ไม่สามารถดึงบันทึกการใช้งานได้' });
  }
};

// แถวในไฟล์ Excel — แยกออกมาให้เทสต์ได้ว่าไฟล์ที่ถูกตัดมีคำเตือนจริง
function buildExportRows(logs) {
  const rows = logs.map((l) => ({
      'เวลา': thaiDateTime(l.createdAt),
      'ผู้ทำ': l.actorName || '-',
      'สิทธิ์': ROLE_LABEL_TH[l.role] || l.role || 'ไม่ได้ล็อกอิน',
      'การกระทำ': l.action,
      'ให้ใคร / เป้าหมาย': l.targetName || [l.targetType, l.targetId].filter(Boolean).join(' ') || '-',
      'ผลลัพธ์': l.statusCode < 400 ? 'สำเร็จ' : `ไม่สำเร็จ (${l.statusCode})`,
      'เส้นทาง': `${l.method} ${l.path}`,
      'IP': l.ip || '-',
      'ข้อมูลที่ส่ง': l.detail || '-',
  }));

  // ไฟล์ถูกตัดที่ EXPORT_LIMIT — บอกไว้ในไฟล์ ไม่ให้เข้าใจผิดว่าข้อมูลครบ
  if (logs.length === EXPORT_LIMIT) {
    rows.push({
      'เวลา': `— แสดงเฉพาะ ${EXPORT_LIMIT.toLocaleString('th-TH')} รายการล่าสุดตามตัวกรองนี้ กรุณาแคบช่วงวันที่เพื่อดูส่วนที่เหลือ —`,
    });
  }
  return rows;
}

// GET /api/admin/logs/export — ไฟล์ Excel ตามตัวกรองเดียวกัน
exports.exportAuditLogs = async (req, res) => {
  try {
    const where = buildWhere(req.query);
    const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: EXPORT_LIMIT });
    const rows = buildExportRows(logs);

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ['เวลา', 'ผู้ทำ', 'สิทธิ์', 'การกระทำ', 'ให้ใคร / เป้าหมาย', 'ผลลัพธ์', 'เส้นทาง', 'IP', 'ข้อมูลที่ส่ง'],
    });
    worksheet['!cols'] = [22, 30, 12, 44, 34, 16, 40, 16, 50].map((wch) => ({ wch }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'บันทึกการใช้งาน');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.xlsx"');
    res.send(buffer);
  } catch (err) {
    if (err.is400) return res.status(400).json({ ok: false, message: err.message });
    console.error('exportAuditLogs error:', err);
    res.status(500).json({ ok: false, message: 'ไม่สามารถสร้างไฟล์บันทึกการใช้งานได้' });
  }
};

// GET /api/admin/logs/actors?role= — รายชื่อผู้ใช้ที่มีบันทึก (ไว้ทำตัวกรอง) · ส่ง role มาเพื่อเหลือเฉพาะคนในแท็บนั้น
exports.getAuditActors = async (req, res) => {
  try {
    const role = req.query?.role;
    const grouped = await prisma.auditLog.groupBy({
      by: ['userId', 'actorName', 'role'],
      ...(role && ROLE_LABEL_TH[role] ? { where: { role } } : {}),
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 300,
    });
    // คนเดียวกันอาจมีหลายแถว (ชื่อถูกแก้ภายหลัง / บันทึกตอนยังไม่มีชื่อ) — รวมตาม userId ใช้ชื่อที่พบบ่อยสุด
    const byUser = new Map();
    for (const g of grouped) {
      if (g.userId == null) continue;
      const cur = byUser.get(g.userId);
      if (!cur) {
        byUser.set(g.userId, { userId: g.userId, name: g.actorName, role: g.role, count: g._count._all, top: g._count._all });
        continue;
      }
      cur.count += g._count._all;
      if (g.actorName && (!cur.name || g._count._all > cur.top)) { cur.name = g.actorName; cur.top = g._count._all; }
    }
    const actors = [...byUser.values()]
      .sort((a, b) => b.count - a.count)
      .map(({ top: _top, ...a }) => a);
    res.json({ ok: true, actors });
  } catch (err) {
    console.error('getAuditActors error:', err);
    res.status(500).json({ ok: false, message: 'ไม่สามารถดึงรายชื่อผู้ใช้ได้' });
  }
};

module.exports.buildWhere = buildWhere;
module.exports.thaiDateTime = thaiDateTime;
module.exports.EXPORT_LIMIT = EXPORT_LIMIT;
module.exports.buildExportRows = buildExportRows;
