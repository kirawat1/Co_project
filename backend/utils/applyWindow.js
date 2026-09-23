/**
 * applyWindow.js — ช่วงเวลายื่นคำร้องขอเข้าร่วมสหกิจ
 *
 * ตั้งค่าแยกจากวันของรอบรับสมัคร (CoopPeriod) แบบเดียวกับ T000–T003 (SystemConfig key "APPLY_CONFIG")
 * ยื่นได้ต้องผ่านทั้งสองอย่าง: รอบรับสมัครเปิดอยู่ (ไว้ผูกคำร้องกับรอบ) + อยู่ในช่วงเวลายื่นคำร้องนี้
 *
 * ยังไม่เคยตั้งค่า = ถือว่าเปิด — deploy แล้วระบบทำงานเหมือนเดิมจนกว่าเจ้าหน้าที่จะตั้งช่วงเวลา
 * วันที่ตีความเป็นเวลาไทยเสมอ (เปิดตั้งแต่ 00:00 ของวันเปิด ถึง 23:59 ของวันปิด)
 */
const prisma = require('../config/prismaClient');

const APPLY_CONFIG_KEY = 'APPLY_CONFIG';
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

// "2026-10-01" → ต้นวัน/ปลายวันตามเวลาไทย · ค่าอื่นที่ Date อ่านได้ใช้ตามนั้น · ว่าง/ผิดรูปแบบ → null
function bangkokBound(value, endOfDay) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const d = DATE_ONLY_RE.test(raw)
    ? new Date(`${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`)
    : new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * สถานะของช่วงเวลายื่นคำร้อง ณ เวลาที่ให้มา
 * @returns {{ configured: boolean, open: boolean, reason: null|'CLOSED'|'NOT_YET'|'ENDED', startDate: string|null, endDate: string|null }}
 */
function evaluateApplyWindow(config, now = new Date()) {
  if (!config) return { configured: false, open: true, reason: null, startDate: null, endDate: null };
  const startDate = config.startDate || null;
  const endDate = config.endDate || null;
  const base = { configured: true, startDate, endDate };
  if (!config.isOpen) return { ...base, open: false, reason: 'CLOSED' };
  const start = bangkokBound(startDate, false);
  const end = bangkokBound(endDate, true);
  if (start && now < start) return { ...base, open: false, reason: 'NOT_YET' };
  if (end && now > end) return { ...base, open: false, reason: 'ENDED' };
  return { ...base, open: true, reason: null };
}

async function readApplyConfig(db = prisma) {
  const row = await db.systemConfig.findUnique({ where: { key: APPLY_CONFIG_KEY } });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function getApplyWindowState(db = prisma, now = new Date()) {
  return evaluateApplyWindow(await readApplyConfig(db), now);
}

// ข้อความบอกนักศึกษาว่าทำไมยื่นไม่ได้ — ใช้ทั้ง API และหน้าเว็บ
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function thaiDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return raw;
  return `${Number(m[3])} ${THAI_MONTHS[Number(m[2]) - 1]} ${Number(m[1]) + 543}`;
}
function applyWindowMessage(state) {
  if (!state || state.open) return null;
  const range = state.startDate || state.endDate
    ? ` (ช่วงยื่นคำร้อง ${thaiDate(state.startDate) || '-'} ถึง ${thaiDate(state.endDate) || '-'})`
    : '';
  if (state.reason === 'NOT_YET') return `ยังไม่ถึงช่วงเวลายื่นคำร้อง${range}`;
  if (state.reason === 'ENDED') return `ปิดรับคำร้องแล้ว${range}`;
  return 'ขณะนี้ปิดรับคำร้องขอเข้าร่วมสหกิจศึกษา';
}

module.exports = {
  APPLY_CONFIG_KEY,
  bangkokBound,
  evaluateApplyWindow,
  readApplyConfig,
  getApplyWindowState,
  applyWindowMessage,
};
