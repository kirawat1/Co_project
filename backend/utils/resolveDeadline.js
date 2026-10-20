// กำหนดส่งของนักศึกษาคนหนึ่ง ณ ตอนนี้ — ทุกจุดที่ตัดสินเปิด/ปิดรับ (อัปโหลด, API ของนักศึกษา) ใช้ตัวนี้
//   รอบของนักศึกษา (StudentCoop.coopPeriodId) + หลักสูตร → CoopPeriodMajor.deadlines[step]  (source = ROUND)
//   รอบนั้นยังไม่ตั้งขั้นนี้ → ค่าเดิมใน SystemConfig ตามตรรกะเดิม                             (source = LEGACY)
//   ยังไม่มีรอบ (ข้อมูลเก่า "ยังไม่เลือกรอบ") → ไม่มีกำหนด ส่งได้                              (source = NO_ROUND)
const prisma = require('../config/prismaClient');
const { readEffective } = require('./majorConfig');
const { evaluateDeadline, evaluateLegacyWindow } = require('./deadlines');
const { periodCloseAt } = require('./coopPeriodHelper');

// ค่าเดิม: ช่วงรับเอกสาร (T000–T003) · กำหนดส่งที่ติดมากับลิงก์แบบฟอร์ม (T005–T008)
const LEGACY_WINDOW_KEY = { T000: 'T000_CONFIG', T002: 'T002_CONFIG', T003: 'T003_CONFIG' };
const LEGACY_DEADLINE_KEY = { T005_T006: 'EVALUATION_FORMS', T007: 'CONFIG_T007', T008: 'CONFIG_T008' };

// สถานะ "ถูกสั่งแก้" ของแต่ละขั้น — ส่งแก้ไม่ติดกำหนด (กลุ่ม T000 ชุดเดียวกับที่ docController ถือว่าเป็นการส่งแก้)
// T000 ถูกสั่งแก้หลายไฟล์: ไฟล์แรกที่ส่งแก้เปลี่ยนสถานะเป็น WAITING_FOR_STAFF_CHECK (ตั้งที่ docController ทางส่งแก้ทางเดียว)
//   → ไฟล์ถัดไปยังเป็นการส่งแก้ (ถ้าวันหลังให้ส่ง T000 ครั้งแรกตั้งสถานะนี้ด้วย ต้องทบทวนชุดนี้ — ดู backlog)
const RESUBMIT_STATUSES = {
  T000: ['EDITS_REQUIRED', 'APPLICATION_EDITS_REQUIRED', 'WAITING_FOR_STAFF_CHECK'],
  T002: ['T002_EDITS_REQUIRED'],
  T003: ['T003_EDITS_REQUIRED'],
};

const bangkokDay = (d) => (d ? new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }) : null);

async function resolveDeadline(stepKey, ctx, db = prisma, now = new Date()) {
  const { studentId } = ctx;
  const coop = await db.studentCoop.findUnique({
    where: { studentId },
    select: { coopPeriodId: true, status: true, deadlineExtensions: true },
  });
  const periodId = coop?.coopPeriodId ?? null;
  const extensionUntil = (coop?.deadlineExtensions && coop.deadlineExtensions[stepKey]) || null;
  if (!periodId) {
    return { ...evaluateDeadline(null, now), source: 'NO_ROUND', periodId: null, startDate: null, extensionUntil };
  }

  const major = ctx.major !== undefined
    ? ctx.major
    : (await db.student.findUnique({ where: { id: studentId }, select: { major: true } }))?.major || null;
  const resubmission = (RESUBMIT_STATUSES[stepKey] || []).includes(coop.status);

  const row = major
    ? await db.coopPeriodMajor.findUnique({
      where: { periodId_major: { periodId, major } },
      select: { startDate: true, deadlines: true },
    })
    : null;
  const entry = row?.deadlines && row.deadlines[stepKey];
  if (entry) {
    return {
      ...evaluateDeadline(entry, now, { resubmission, extensionUntil }),
      source: 'ROUND', periodId, startDate: bangkokDay(row.startDate), extensionUntil,
    };
  }

  if (LEGACY_WINDOW_KEY[stepKey]) {
    const config = await readEffective(LEGACY_WINDOW_KEY[stepKey], major, db);
    const r = evaluateLegacyWindow(config, now, { resubmission });
    // ขยายเวลารายคนใช้กับค่าเดิมที่หมดเขตได้ด้วย — แต่ไม่ชนะการปิดระบบ (isOpen = false)
    if (!r.canSubmit && !r.closed && extensionUntil && now <= periodCloseAt(extensionUntil)) r.canSubmit = true;
    const startDate = typeof config?.startDate === 'string' && config.startDate.trim() ? config.startDate.trim() : null;
    return { ...r, source: 'LEGACY', periodId, startDate, extensionUntil };
  }

  const config = await readEffective(LEGACY_DEADLINE_KEY[stepKey], major, db);
  return {
    ...evaluateDeadline(config?.deadline ? { due: config.deadline } : null, now),
    source: 'LEGACY', periodId, startDate: null, extensionUntil,
  };
}

module.exports = { resolveDeadline, RESUBMIT_STATUSES, bangkokDay };
