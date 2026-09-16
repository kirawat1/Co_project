const prisma = require('../config/prismaClient');
const XLSX = require('xlsx');
const { RETENTION_DAYS } = require('../middlewares/auditLogger');

const MAX_LIMIT = 200;
const EXPORT_LIMIT = 20000;

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const pad2 = (n) => String(n).padStart(2, '0');
function thaiDateTime(d) {
  const date = new Date(d);
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
const ROLE_LABEL_TH = { staff: 'เจ้าหน้าที่', teacher: 'อาจารย์', student: 'นักศึกษา' };

// เงื่อนไขค้นหาร่วมของทั้งหน้ารายการและไฟล์ export
function buildWhere(query) {
  const where = {};
  const { role, userId, q, from, to, onlyFailed } = query;

  if (role && ROLE_LABEL_TH[role]) where.role = role;
  if (userId) {
    const id = parseInt(userId, 10);
    if (isNaN(id)) throw Object.assign(new Error('userId ไม่ถูกต้อง'), { is400: true });
    where.userId = id;
  }
  if (from || to) {
    where.createdAt = {};
    if (from) {
      const d = new Date(from);
      if (isNaN(d.getTime())) throw Object.assign(new Error('วันที่เริ่มไม่ถูกต้อง'), { is400: true });
      d.setHours(0, 0, 0, 0);
      where.createdAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (isNaN(d.getTime())) throw Object.assign(new Error('วันที่สิ้นสุดไม่ถูกต้อง'), { is400: true });
      d.setHours(23, 59, 59, 999);
      where.createdAt.lte = d;
    }
  }
  if (onlyFailed === 'true' || onlyFailed === true) where.statusCode = { gte: 400 };
  const keyword = String(q || '').trim();
  if (keyword) {
    where.OR = [
      { actorName: { contains: keyword } },
      { action: { contains: keyword } },
      { path: { contains: keyword } },
      { targetId: { contains: keyword } },
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

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({
      ok: true,
      data: logs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1, retentionDays: RETENTION_DAYS },
    });
  } catch (err) {
    if (err.is400) return res.status(400).json({ ok: false, message: err.message });
    console.error('getAuditLogs error:', err);
    res.status(500).json({ ok: false, message: 'ไม่สามารถดึงบันทึกการใช้งานได้' });
  }
};

// GET /api/admin/logs/export — ไฟล์ Excel ตามตัวกรองเดียวกัน
exports.exportAuditLogs = async (req, res) => {
  try {
    const where = buildWhere(req.query);
    const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: EXPORT_LIMIT });

    const rows = logs.map((l) => ({
      'เวลา': thaiDateTime(l.createdAt),
      'ผู้ทำ': l.actorName || '-',
      'สิทธิ์': ROLE_LABEL_TH[l.role] || l.role || '-',
      'การกระทำ': l.action,
      'เป้าหมาย': [l.targetType, l.targetId].filter(Boolean).join(' ') || '-',
      'ผลลัพธ์': l.statusCode < 400 ? 'สำเร็จ' : `ไม่สำเร็จ (${l.statusCode})`,
      'เส้นทาง': `${l.method} ${l.path}`,
      'IP': l.ip || '-',
      'ข้อมูลที่ส่ง': l.detail || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ['เวลา', 'ผู้ทำ', 'สิทธิ์', 'การกระทำ', 'เป้าหมาย', 'ผลลัพธ์', 'เส้นทาง', 'IP', 'ข้อมูลที่ส่ง'],
    });
    worksheet['!cols'] = [22, 30, 12, 34, 20, 16, 40, 16, 50].map((wch) => ({ wch }));
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

// GET /api/admin/logs/actors — รายชื่อผู้ใช้ที่มีบันทึก (ไว้ทำตัวกรอง)
exports.getAuditActors = async (_req, res) => {
  try {
    const grouped = await prisma.auditLog.groupBy({
      by: ['userId', 'actorName', 'role'],
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 300,
    });
    const actors = grouped
      .filter((g) => g.userId != null)
      .map((g) => ({ userId: g.userId, name: g.actorName, role: g.role, count: g._count._all }));
    res.json({ ok: true, actors });
  } catch (err) {
    console.error('getAuditActors error:', err);
    res.status(500).json({ ok: false, message: 'ไม่สามารถดึงรายชื่อผู้ใช้ได้' });
  }
};

module.exports.buildWhere = buildWhere;
module.exports.thaiDateTime = thaiDateTime;
