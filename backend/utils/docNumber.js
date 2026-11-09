// เลขที่/วันที่หนังสือราชการ — ใช้ร่วมกันระหว่างหนังสือขอความอนุเคราะห์ ส่งตัว และขอนิเทศ

// เลขที่หนังสือเก็บเป็นตัวเลขล้วน เช่น "660301.26.6.2/1234"
// คำนำหน้า "ที่ อว" อยู่ในเทมเพลตหนังสือ — ตัดออกเพื่อไม่ให้เลขเดียวกันถูกเก็บสองรูปแบบจนเลี่ยง unique index ได้
// เลขที่จริงยาวไม่ถึง 30 ตัว (เช่น 660301.26.6.2/1234) — เกินคอลัมน์ (191) เดิม MySQL ตัดทิ้งเงียบ ๆ หรือโยน 500 แล้วแต่ sql_mode
const DOC_NUMBER_MAX = 100;
function normalizeDocNumber(value) {
  if (!value) return '';
  const v = String(value).trim().replace(/^(?:ที่\s*)?(?:อว\.?\s*)/, '').trim();
  if (v.length > DOC_NUMBER_MAX) throw Object.assign(new Error(`เลขที่หนังสือยาวเกินไป (ไม่เกิน ${DOC_NUMBER_MAX} ตัวอักษร)`), { is400: true, status: 400 });
  return v;
}

// เทมเพลตที่ยังไม่แก้ (จุดไข่ปลา/xxxx) หรือไม่มีเลขต่อท้าย "/" ถือว่ายังไม่ได้กรอกเลขที่จริง
const isPlaceholderDocNo = (v) => /[.]{3,}|x{3,}/i.test(v) || !/\/\s*\S/.test(v);

// แปลงวันที่จาก request — วันที่ผิดรูปแบบต้องเป็น 400 พร้อมบอกช่อง ไม่ใช่ Invalid Date ที่ทำให้ Prisma โยน 500
// วันที่จากผู้ใช้ — ต้องเป็นข้อความวันที่ที่มีอยู่จริงในปฏิทิน
// JavaScript เลื่อนวันที่เกินเดือนให้เงียบ ๆ ("2027-02-30" → 2 มี.ค.) · new Date(null) = ปี 1970 — เดิมบันทึกวันพวกนี้ได้
function strictDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (m) {
    const [y, mo, da] = m.slice(1).map(Number);
    const c = new Date(Date.UTC(y, mo - 1, da));
    if (c.getUTCFullYear() !== y || c.getUTCMonth() !== mo - 1 || c.getUTCDate() !== da) return null;
  }
  return d;
}

function parseDateOr400(value, label) {
  const d = strictDate(value);
  if (!d) throw Object.assign(new Error(`${label}ไม่ถูกต้อง`), { is400: true });
  return d;
}

module.exports = { normalizeDocNumber, isPlaceholderDocNo, parseDateOr400, strictDate };
