// เลขที่/วันที่หนังสือราชการ — ใช้ร่วมกันระหว่างหนังสือขอความอนุเคราะห์ ส่งตัว และขอนิเทศ

// เลขที่หนังสือเก็บเป็นตัวเลขล้วน เช่น "660301.26.6.2/1234"
// คำนำหน้า "ที่ อว" อยู่ในเทมเพลตหนังสือ — ตัดออกเพื่อไม่ให้เลขเดียวกันถูกเก็บสองรูปแบบจนเลี่ยง unique index ได้
function normalizeDocNumber(value) {
  if (!value) return '';
  return String(value).trim().replace(/^(?:ที่\s*)?(?:อว\.?\s*)/, '').trim();
}

// เทมเพลตที่ยังไม่แก้ (จุดไข่ปลา/xxxx) หรือไม่มีเลขต่อท้าย "/" ถือว่ายังไม่ได้กรอกเลขที่จริง
const isPlaceholderDocNo = (v) => /[.]{3,}|x{3,}/i.test(v) || !/\/\s*\S/.test(v);

// แปลงวันที่จาก request — วันที่ผิดรูปแบบต้องเป็น 400 พร้อมบอกช่อง ไม่ใช่ Invalid Date ที่ทำให้ Prisma โยน 500
function parseDateOr400(value, label) {
  const d = new Date(value);
  if (isNaN(d.getTime())) throw Object.assign(new Error(`${label}ไม่ถูกต้อง`), { is400: true });
  return d;
}

module.exports = { normalizeDocNumber, isPlaceholderDocNo, parseDateOr400 };
