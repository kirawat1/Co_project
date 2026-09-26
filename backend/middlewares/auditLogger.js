/**
 * auditLogger.js — บันทึกการใช้งาน: ใครทำอะไรกับระบบ
 *
 * ครอบทั้ง /api ตัวเดียว ไม่ต้องไล่แก้ทีละ controller
 *  - บันทึกทุก request ที่เปลี่ยนข้อมูล (POST/PUT/PATCH/DELETE) ทั้งที่สำเร็จและล้มเหลว
 *  - บันทึกการเข้าสู่ระบบ (สำเร็จ/ไม่สำเร็จ) แม้ยังไม่มี token
 *  - เขียนแบบไม่รอ (หลัง response ปิดแล้ว) และห้ามทำให้ API พังถ้าเขียน log ไม่ได้
 */

const prisma = require('../config/prismaClient');
const { describeRequest, sanitizeBody, looksLikeEmail } = require('../utils/auditActions');

const LOGGED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const LOGIN_PATHS = ['/api/auth/signin', '/api/auth/login/sso', '/api/auth/login/google'];

// GET ที่ต้องบันทึกด้วย — การดึงข้อมูลส่วนบุคคลออกเป็นไฟล์ (ใครดูดอะไรออกไปเมื่อไหร่)
const LOGGED_GET_PATHS = new Set([
  '/api/admin/students/export',
  '/api/admin/logs/export',
  '/api/admin/supervisions/export',
  '/api/teacher/students/export',
  '/api/teachers/students/export',
]);

// เก็บเวลาที่ไม่ต้อง log (โพลถี่ ๆ ที่ไม่ใช่การเปลี่ยนข้อมูลจริง)
const SKIP_PATHS = new Set(['/api/notifications/mark-read', '/api/notifications/mark-all-read']);

// ชื่อผู้ใช้เปลี่ยนไม่บ่อย — cache กัน query ซ้ำทุก request
const nameCache = new Map(); // "userId:role" -> { name, at }
const NAME_TTL_MS = 5 * 60 * 1000;

// เลือกชื่อจากโปรไฟล์ที่ตรงกับ role ที่ใช้ทำรายการก่อน — บัญชีเดียวอาจมีหลายโปรไฟล์
// (เช่น บัญชีที่มีทั้งข้อมูลนักศึกษาและอาจารย์) ถ้าไม่ตรงค่อยไล่ นักศึกษา → อาจารย์ → เจ้าหน้าที่
async function actorNameOf(userId, role = null) {
  if (!userId) return null;
  const cacheKey = `${userId}:${role || ''}`;
  const hit = nameCache.get(cacheKey);
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
    const names = {
      student: s ? `${s.prefix === 'MR' ? 'นาย' : s.prefix === 'MS' ? 'นางสาว' : ''}${s.firstName || ''} ${s.lastName || ''} (${s.studentId || ''})`.trim() : null,
      teacher: t ? `${t.prefix || ''}${t.firstName || ''} ${t.lastName || ''}`.trim() : null,
      staff: st ? `${st.firstName || ''} ${st.lastName || ''}`.trim() : null,
    };
    const roleKey = String(role || '').toLowerCase();
    const name = names[roleKey] || names.student || names.teacher || names.staff || user.username || user.email || null;
    nameCache.set(cacheKey, { name, at: Date.now() });
    return name;
  } catch (_) {
    return null;
  }
}

// ใช้ req.ip ซึ่ง Express ตัดชั้น proxy ให้ตามค่า trust proxy ใน server.js
// เดิมอ่าน X-Forwarded-For ตัวแรกเอง — ผู้ใช้แนบ header มาเองแล้วปลอม IP ใน log ได้
function clientIp(req) {
  const raw = req.ip || req.socket?.remoteAddress || '';
  const clean = String(raw).replace(/^::ffff:/, '').trim();
  return clean ? clean.slice(0, 64) : null;
}

// ── "ให้ใคร" — แปลงเป้าหมาย (ประเภท + id) เป็นชื่อที่คนอ่านออก ─────────────────────
const PREFIX_TH = { MR: 'นาย', MS: 'นางสาว' };
const studentLabel = (s) => (s
  ? `${s.studentId || ''} ${PREFIX_TH[s.prefix] || ''}${s.firstName || ''} ${s.lastName || ''}`.replace(/\s+/g, ' ').trim()
  : null);
const STUDENT_NAME_SELECT = { studentId: true, prefix: true, firstName: true, lastName: true };

// targetKey: 'id' = id ในฐานข้อมูล · 'code' = รหัสนักศึกษา — กำหนดในตารางกฎ (idSpec "code:...")
// เดิมเดาจากความยาวตัวเลข (≤ 7 หลัก = id) ซึ่งผิดได้ถ้ารหัสนักศึกษาสั้นหรือ id ยาวขึ้น
async function resolveTargetName(targetType, targetId, targetKey = 'id') {
  if (!targetType || targetId == null || targetId === '') return null;
  const raw = String(targetId);
  const id = /^\d{1,9}$/.test(raw) ? parseInt(raw, 10) : null;
  try {
    switch (targetType) {
      case 'นักศึกษา': {
        if (targetKey === 'code') {
          return studentLabel(await prisma.student.findFirst({ where: { studentId: raw }, select: STUDENT_NAME_SELECT }));
        }
        if (id == null) return null;
        return studentLabel(await prisma.student.findUnique({ where: { id }, select: STUDENT_NAME_SELECT }));
      }
      case 'นัดนิเทศ': {
        if (id == null) return null;
        const a = await prisma.supervisionAppointment.findUnique({ where: { id }, select: { student: { select: STUDENT_NAME_SELECT } } });
        return studentLabel(a?.student);
      }
      case 'เอกสาร': {
        if (id == null) return null;
        const d = await prisma.document.findUnique({ where: { id }, select: { type: true, name: true, student: { select: STUDENT_NAME_SELECT } } });
        if (!d) return null;
        const who = studentLabel(d.student);
        return [`${d.type}${d.name ? ` (${d.name})` : ''}`, who].filter(Boolean).join(' · ');
      }
      // บริษัท/พี่เลี้ยงใช้ id เป็น UUID (string) ไม่ใช่ตัวเลข
      case 'บริษัท': {
        const c = await prisma.company.findUnique({ where: { id: raw }, select: { name: true } });
        return c?.name || null;
      }
      case 'พี่เลี้ยง': {
        const m = await prisma.mentor.findUnique({ where: { id: raw }, select: { firstName: true, lastName: true, company: { select: { name: true } } } });
        if (!m) return null;
        const name = `${m.firstName || ''} ${m.lastName || ''}`.trim();
        return m.company?.name ? `${name} (${m.company.name})` : name || null;
      }
      case 'ผู้ติดต่อ': {
        const c = await prisma.companyContact.findUnique({ where: { id: raw }, select: { firstName: true, lastName: true, company: { select: { name: true } } } });
        if (!c) return null;
        const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
        return c.company?.name ? `${name} (${c.company.name})` : name || null;
      }
      case 'อาจารย์': {
        if (id == null) return null;
        const t = await prisma.teacher.findUnique({ where: { id }, select: { prefix: true, firstName: true, lastName: true } });
        return t ? `${t.prefix || ''}${t.firstName || ''} ${t.lastName || ''}`.trim() : null;
      }
      case 'เรื่องที่แจ้ง': {
        if (id == null) return null;
        const fb = await prisma.feedback.findUnique({
          where: { id },
          select: { kind: true, user: { select: { student: { select: STUDENT_NAME_SELECT } } } },
        });
        if (!fb) return null;
        const who = studentLabel(fb.user?.student);
        return [fb.kind === 'SUGGEST' ? 'ข้อเสนอแนะ' : 'ปัญหาการใช้งาน', who].filter(Boolean).join(' · ');
      }
      case 'คำร้องสหกิจ': {
        if (id == null) return null;
        const c = await prisma.studentCoop.findUnique({ where: { id }, select: { student: { select: STUDENT_NAME_SELECT } } });
        return studentLabel(c?.student);
      }
      case 'ประกาศ': {
        const a = await prisma.announcement.findUnique({ where: { id: raw }, select: { title: true } });
        return a?.title || null;
      }
      case 'ผู้ใช้': {
        if (id == null) return null;
        const u = await prisma.user.findUnique({ where: { id }, select: { username: true } });
        return u?.username || null;
      }
      default:
        return null;
    }
  } catch (_) {
    return null; // หาชื่อไม่ได้ก็ยังบันทึก log ได้ (มี targetId อยู่แล้ว)
  }
}

async function writeLog(req, res) {
  const path = (req.originalUrl || req.url || '').split('?')[0];
  const isLogin = LOGIN_PATHS.includes(path);
  const described = describeRequest({ method: req.method, path, body: req.body });
  // controller แนบรายละเอียดจากผลที่ทำจริงได้ (setAuditDetail) — ใช้ก่อนค่าที่เดาจาก request
  const audit = res.locals?.audit || {};
  const action = audit.action || described.action;
  const targetType = audit.targetType || described.targetType;
  const targetId = audit.targetId != null ? String(audit.targetId) : described.targetId;
  const targetKey = audit.targetKey || described.targetKey;
  // ลบข้อมูลแล้ว (DELETE) หาชื่อไม่เจอเป็นปกติ — ใช้ค่าที่ถูกเก็บไว้ก่อนลบถ้ามี
  const targetName = audit.targetName || res.locals?.auditTargetName || await resolveTargetName(targetType, targetId, targetKey);

  // ผู้ทำ: จาก token · ถ้าเป็นการเข้าสู่ระบบให้ใช้ id จาก response (สำเร็จ) หรือชื่อผู้ใช้ที่กรอกมา (ไม่สำเร็จ)
  const userId = req.user?.id ?? res.locals?.auditUserId ?? null;
  const role = req.user?.role ?? res.locals?.auditRole ?? null;
  let actorName = await actorNameOf(userId, role);
  if (!actorName && isLogin) {
    // เก็บเฉพาะค่าที่เป็นอีเมลจริง — บางคนพิมพ์รหัสผ่านลงช่องอีเมล ไม่ควรไปโผล่ในบันทึก
    const typed = String(req.body?.email || req.body?.username || '').trim();
    actorName = looksLikeEmail(typed) ? typed.slice(0, 200) : null;
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
      targetName: targetName ? String(targetName).slice(0, 200) : null,
      statusCode: res.statusCode,
      ip: clientIp(req),
      detail: sanitizeBody(req.body, { loginPath: isLogin }),
    },
  });
}

function auditLogger(req, res, next) {
  const path = (req.originalUrl || req.url || '').split('?')[0];
  const isLogin = LOGIN_PATHS.includes(path);
  const shouldLog = LOGGED_METHODS.has(req.method) || isLogin
    || (req.method === 'GET' && LOGGED_GET_PATHS.has(path));
  if (!shouldLog || SKIP_PATHS.has(path)) return next();

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

  // บันทึกตอน handler จบงาน (เรียก res.end) ไม่ใช่ตอนส่งถึงผู้ใช้ (finish)
  // — เดิมผูกกับ finish: ผู้ใช้ปิดแท็บ/เน็ตหลุดก่อนได้คำตอบ ข้อมูลถูกแก้แล้วแต่ไม่มี log
  //   (ทดลองตัดการเชื่อมต่อ 10 ครั้ง สร้างบริษัทจริง 10 แต่ log แค่ 8)
  let logged = false;
  const logOnce = () => {
    if (logged) return;
    logged = true;
    writeLog(req, res).catch((err) => console.error('[auditLog] เขียน log ไม่สำเร็จ:', err.message));
  };
  const originalEnd = res.end;
  res.end = function auditedEnd(...args) {
    const result = originalEnd.apply(this, args);
    logOnce();
    return result;
  };
  res.on('finish', logOnce); // กันไว้เผื่อมีทางส่งคำตอบที่ไม่ผ่าน res.end ตัวนี้

  // ลบข้อมูล: หลังลบเสร็จจะหาชื่อเป้าหมายไม่เจอแล้ว — หาชื่อไว้ก่อนส่งต่อ (DELETE ใช้ id จาก path ไม่ต้องรอ body)
  if (req.method === 'DELETE') {
    const { targetType, targetId, targetKey } = describeRequest({ method: req.method, path, body: {} });
    resolveTargetName(targetType, targetId, targetKey)
      .then((name) => { if (name) res.locals.auditTargetName = name; })
      .catch(() => {})
      .finally(() => next());
    return;
  }
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

module.exports = {
  auditLogger, purgeOldLogs, startLogRetentionJob, RETENTION_DAYS,
  actorNameOf, resolveTargetName, clientIp, LOGGED_GET_PATHS,
};
