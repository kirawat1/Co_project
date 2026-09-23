/**
 * feedbackController.js — เรื่องที่ผู้ใช้แจ้งเข้ามาจากปุ่ม "แจ้งปัญหา"
 *
 * เก็บบริบทตอนแจ้งไว้ด้วย (หน้าที่เปิดอยู่ สถานะสหกิจ เบราว์เซอร์) เพราะผู้แจ้งมักเขียนสั้น
 * เช่น "กดไม่ได้" — ถ้าไม่มีบริบท เจ้าหน้าที่จะตามเรื่องต่อไม่ได้
 */
const prisma = require('../config/prismaClient');
const { createNotifications, getStaffIds } = require('../utils/notificationHelper');

const KINDS = new Set(['BUG', 'SUGGEST']);
const STATUSES = new Set(['NEW', 'IN_PROGRESS', 'RESOLVED']);
const KIND_TH = { BUG: 'ปัญหาการใช้งาน', SUGGEST: 'ข้อเสนอแนะ' };
const MESSAGE_MIN = 5;
const MESSAGE_MAX = 2000;
const MAX_LIMIT = 100;

const trim = (v, max) => (v == null ? null : String(v).trim().slice(0, max) || null);

// ชื่อผู้แจ้งแบบอ่านออก — ใช้ทั้งในรายการของเจ้าหน้าที่และในแจ้งเตือน
const PREFIX_TH = { MR: 'นาย', MS: 'นางสาว' };
function reporterName(user) {
  const s = user?.student;
  const t = user?.teacher;
  const st = user?.staffProfile;
  if (s) return `${s.studentId || ''} ${PREFIX_TH[s.prefix] || ''}${s.firstName || ''} ${s.lastName || ''}`.replace(/\s+/g, ' ').trim();
  if (t) return `${t.prefix || ''}${t.firstName || ''} ${t.lastName || ''}`.trim();
  if (st) return `${st.firstName || ''} ${st.lastName || ''}`.trim();
  return user?.username || user?.email || 'ผู้ใช้';
}
const REPORTER_INCLUDE = {
  select: {
    id: true, username: true, email: true, role: true,
    student: { select: { studentId: true, prefix: true, firstName: true, lastName: true, coop: { select: { status: true } } } },
    teacher: { select: { prefix: true, firstName: true, lastName: true } },
    staffProfile: { select: { firstName: true, lastName: true } },
  },
};

// POST /api/feedback — ผู้ใช้ที่ล็อกอินแล้วแจ้งเรื่องเข้ามา (แนบภาพหน้าจอได้ 1 ไฟล์)
exports.submitFeedback = async (req, res) => {
  try {
    const kind = String(req.body?.kind || 'BUG').toUpperCase();
    if (!KINDS.has(kind)) return res.status(400).json({ ok: false, message: 'ประเภทเรื่องไม่ถูกต้อง' });

    const message = String(req.body?.message || '').trim();
    if (message.length < MESSAGE_MIN) {
      return res.status(400).json({ ok: false, message: `กรุณาเล่ารายละเอียดอย่างน้อย ${MESSAGE_MIN} ตัวอักษร` });
    }
    if (message.length > MESSAGE_MAX) {
      return res.status(400).json({ ok: false, message: `รายละเอียดยาวเกินไป (ไม่เกิน ${MESSAGE_MAX} ตัวอักษร)` });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, ...REPORTER_INCLUDE });
    if (!user) return res.status(404).json({ ok: false, message: 'ไม่พบบัญชีผู้ใช้' });

    const feedback = await prisma.feedback.create({
      data: {
        userId: user.id,
        role: String(user.role || '').slice(0, 20),
        kind,
        message: message.slice(0, MESSAGE_MAX),
        pagePath: trim(req.body?.pagePath, 300),
        // สถานะสหกิจ ณ เวลาที่แจ้ง — ช่วยให้เจ้าหน้าที่เห็นว่าติดอยู่ขั้นไหน
        contextNote: trim(req.body?.contextNote || user.student?.coop?.status, 300),
        userAgent: trim(req.headers['user-agent'], 300),
        imagePath: req.file ? req.file.filename : null,
      },
    });

    // แจ้งเจ้าหน้าที่ทุกคน — เก็บ feedback id ไว้เปิดเรื่องตรงได้
    try {
      const staffIds = await getStaffIds();
      await createNotifications(staffIds, {
        type: 'FEEDBACK_NEW',
        title: `แจ้ง${KIND_TH[kind]}ใหม่`,
        message: `${reporterName(user)}: ${message.slice(0, 80)}${message.length > 80 ? '…' : ''}`,
        link: '/admin/feedback',
        relatedId: String(feedback.id),
      });
    } catch (e) {
      console.error('[feedback] แจ้งเตือนเจ้าหน้าที่ไม่สำเร็จ:', e.message);
    }

    res.status(201).json({ ok: true, message: 'ส่งเรื่องเรียบร้อย ขอบคุณที่ช่วยแจ้ง', data: { id: feedback.id } });
  } catch (err) {
    console.error('submitFeedback error:', err);
    res.status(500).json({ ok: false, message: 'ส่งเรื่องไม่สำเร็จ' });
  }
};

// GET /api/feedback/me — เรื่องที่ตัวเองเคยแจ้ง พร้อมคำตอบจากเจ้าหน้าที่
exports.getMyFeedback = async (req, res) => {
  try {
    const items = await prisma.feedback.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, kind: true, message: true, status: true, staffReply: true,
        pagePath: true, imagePath: true, createdAt: true, handledAt: true,
      },
    });
    res.json({ ok: true, data: items });
  } catch (err) {
    console.error('getMyFeedback error:', err);
    res.status(500).json({ ok: false, message: 'ดึงเรื่องที่แจ้งไม่สำเร็จ' });
  }
};

// GET /api/admin/feedback — รายการทั้งหมด (เจ้าหน้าที่)
exports.listFeedback = async (req, res) => {
  try {
    const { status, kind, q } = req.query;
    const where = {};
    if (status && STATUSES.has(String(status))) where.status = String(status);
    if (kind && KINDS.has(String(kind).toUpperCase())) where.kind = String(kind).toUpperCase();
    const keyword = String(q || '').trim();
    if (keyword) {
      where.OR = [
        { message: { contains: keyword } },
        { pagePath: { contains: keyword } },
        { staffReply: { contains: keyword } },
      ];
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || 30));

    const [total, rows, grouped] = await Promise.all([
      prisma.feedback.count({ where }),
      prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: REPORTER_INCLUDE },
      }),
      prisma.feedback.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    const counts = { all: 0, NEW: 0, IN_PROGRESS: 0, RESOLVED: 0 };
    for (const g of grouped) {
      if (counts[g.status] !== undefined) counts[g.status] += g._count._all;
      counts.all += g._count._all;
    }

    const data = rows.map(({ user, ...f }) => ({
      ...f,
      reporterName: reporterName(user),
      reporterRole: user?.role || f.role,
      reporterUserId: user?.id ?? f.userId,
      coopStatus: user?.student?.coop?.status || null,
    }));

    res.json({ ok: true, data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1, counts } });
  } catch (err) {
    console.error('listFeedback error:', err);
    res.status(500).json({ ok: false, message: 'ดึงรายการเรื่องที่แจ้งไม่สำเร็จ' });
  }
};

// PATCH /api/admin/feedback/:id — เปลี่ยนสถานะ และ/หรือ ตอบกลับผู้แจ้ง
exports.updateFeedback = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });

    const { status, staffReply } = req.body || {};
    if (status !== undefined && !STATUSES.has(String(status))) {
      return res.status(400).json({ ok: false, message: 'สถานะไม่ถูกต้อง' });
    }
    if (status === undefined && staffReply === undefined) {
      return res.status(400).json({ ok: false, message: 'ไม่มีข้อมูลที่จะบันทึก' });
    }

    const current = await prisma.feedback.findUnique({ where: { id }, select: { id: true, userId: true, kind: true } });
    if (!current) return res.status(404).json({ ok: false, message: 'ไม่พบเรื่องที่แจ้ง' });

    const staff = await prisma.user.findUnique({ where: { id: req.user.id }, ...REPORTER_INCLUDE });
    const reply = staffReply === undefined ? undefined : (String(staffReply).trim().slice(0, MESSAGE_MAX) || null);

    const updated = await prisma.feedback.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status: String(status) } : {}),
        ...(reply !== undefined ? { staffReply: reply } : {}),
        handledById: req.user.id,
        handledName: reporterName(staff).slice(0, 200),
        handledAt: new Date(),
      },
    });

    // แจ้งผู้แจ้งเมื่อมีคำตอบ หรือเมื่อปิดเรื่องแล้ว
    if (reply || updated.status === 'RESOLVED') {
      try {
        await createNotifications([current.userId], {
          type: 'FEEDBACK_REPLIED',
          title: updated.status === 'RESOLVED' ? 'เรื่องที่แจ้งได้รับการแก้ไขแล้ว' : 'เจ้าหน้าที่ตอบกลับเรื่องที่คุณแจ้ง',
          message: reply ? reply.slice(0, 120) : 'เจ้าหน้าที่ดำเนินการเรียบร้อยแล้ว',
          link: '/student/dashboard',
          relatedId: String(updated.id),
        });
      } catch (e) {
        console.error('[feedback] แจ้งเตือนผู้แจ้งไม่สำเร็จ:', e.message);
      }
    }

    res.json({ ok: true, message: 'บันทึกเรียบร้อย', data: updated });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ ok: false, message: 'ไม่พบเรื่องที่แจ้ง' });
    console.error('updateFeedback error:', err);
    res.status(500).json({ ok: false, message: 'บันทึกไม่สำเร็จ' });
  }
};

module.exports.KIND_TH = KIND_TH;
module.exports.reporterName = reporterName;
