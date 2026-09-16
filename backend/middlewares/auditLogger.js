/**
 * auditLogger.js — บันทึกการใช้งาน: ใครทำอะไรกับระบบ
 *
 * ครอบทั้ง /api ตัวเดียว ไม่ต้องไล่แก้ทีละ controller
 *  - บันทึกทุก request ที่เปลี่ยนข้อมูล (POST/PUT/PATCH/DELETE) ทั้งที่สำเร็จและล้มเหลว
 *  - บันทึกการเข้าสู่ระบบ (สำเร็จ/ไม่สำเร็จ) แม้ยังไม่มี token
 *  - เขียนแบบไม่รอ (หลัง response ปิดแล้ว) และห้ามทำให้ API พังถ้าเขียน log ไม่ได้
 */

const prisma = require('../config/prismaClient');
const { describeRequest, sanitizeBody } = require('../utils/auditActions');

const LOGGED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const LOGIN_PATHS = ['/api/auth/signin', '/api/auth/login/sso', '/api/auth/login/google'];

// เก็บเวลาที่ไม่ต้อง log (โพลถี่ ๆ ที่ไม่ใช่การเปลี่ยนข้อมูลจริง)
const SKIP_PATHS = new Set(['/api/notifications/mark-read', '/api/notifications/mark-all-read']);

// ชื่อผู้ใช้เปลี่ยนไม่บ่อย — cache กัน query ซ้ำทุก request
const nameCache = new Map(); // userId -> { name, at }
const NAME_TTL_MS = 5 * 60 * 1000;

async function actorNameOf(userId) {
  if (!userId) return null;
  const hit = nameCache.get(userId);
  if (hit && Date.now() - hit.at < NAME_TTL_MS) return hit.name;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true, email: true,
        student: { select: { prefix: true, firstName: true, lastName: true, studentId: true } },
        teacher: { select: { prefix: true, firstName: true, lastName: true } },
        staffProfile: { select: { firstName: true, lastName: true } },
      },
    });
    if (!user) return null;
    const s = user.student;
    const t = user.teacher;
    const st = user.staffProfile;
    const name = s
      ? `${s.prefix === 'MR' ? 'นาย' : s.prefix === 'MS' ? 'นางสาว' : ''}${s.firstName || ''} ${s.lastName || ''} (${s.studentId || ''})`.trim()
      : t
        ? `${t.prefix || ''}${t.firstName || ''} ${t.lastName || ''}`.trim()
        : st
          ? `${st.firstName || ''} ${st.lastName || ''}`.trim()
          : (user.username || user.email || null);
    nameCache.set(userId, { name, at: Date.now() });
    return name;
  } catch (_) {
    return null;
  }
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  const raw = (Array.isArray(fwd) ? fwd[0] : fwd || '').split(',')[0].trim() || req.ip || req.socket?.remoteAddress || '';
  return raw ? String(raw).slice(0, 64) : null;
}

async function writeLog(req, res) {
  const path = (req.originalUrl || req.url || '').split('?')[0];
  const isLogin = LOGIN_PATHS.includes(path);
  const { action, targetType, targetId } = describeRequest({ method: req.method, path, body: req.body });

  // ผู้ทำ: จาก token · ถ้าเป็นการเข้าสู่ระบบให้ใช้ id จาก response (สำเร็จ) หรือชื่อผู้ใช้ที่กรอกมา (ไม่สำเร็จ)
  const userId = req.user?.id ?? res.locals?.auditUserId ?? null;
  const role = req.user?.role ?? res.locals?.auditRole ?? null;
  let actorName = await actorNameOf(userId);
  if (!actorName && isLogin) {
    actorName = String(req.body?.email || req.body?.username || '').slice(0, 200) || null;
  }

  const failed = res.statusCode >= 400;
  await prisma.auditLog.create({
    data: {
      userId: userId || null,
      role: role ? String(role).slice(0, 20) : null,
      actorName,
      action: `${action}${failed ? ' (ไม่สำเร็จ)' : ''}`.slice(0, 200),
      method: req.method.slice(0, 10),
      path: path.slice(0, 300),
      targetType,
      targetId,
      statusCode: res.statusCode,
      ip: clientIp(req),
      detail: sanitizeBody(req.body),
    },
  });
}

function auditLogger(req, res, next) {
  const path = (req.originalUrl || req.url || '').split('?')[0];
  const isLogin = LOGIN_PATHS.includes(path);
  if ((!LOGGED_METHODS.has(req.method) && !isLogin) || SKIP_PATHS.has(path)) return next();

  // การเข้าสู่ระบบยังไม่มี token — ดึง id ผู้ใช้จาก response แทน (ไม่เก็บ token)
  if (isLogin) {
    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      try {
        if (payload?.user?.id) {
          res.locals.auditUserId = payload.user.id;
          res.locals.auditRole = payload.user.role || null;
        }
      } catch (_) { /* ไม่ให้กระทบ response */ }
      return originalJson(payload);
    };
  }

  res.on('finish', () => {
    writeLog(req, res).catch((err) => console.error('[auditLog] เขียน log ไม่สำเร็จ:', err.message));
  });
  next();
}

// เก็บย้อนหลัง 1 ปี — ลบของเก่าทิ้งตอน start และวันละครั้ง
const RETENTION_DAYS = 365;
async function purgeOldLogs() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    if (count > 0) console.log(`[auditLog] ลบบันทึกเก่ากว่า ${RETENTION_DAYS} วัน จำนวน ${count} รายการ`);
    return count;
  } catch (err) {
    console.error('[auditLog] ลบบันทึกเก่าไม่สำเร็จ:', err.message);
    return 0;
  }
}

function startLogRetentionJob() {
  purgeOldLogs();
  const timer = setInterval(purgeOldLogs, 24 * 60 * 60 * 1000);
  timer.unref?.();
  return timer;
}

module.exports = { auditLogger, purgeOldLogs, startLogRetentionJob, RETENTION_DAYS, actorNameOf };
