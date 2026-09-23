/**
 * addressFormat.js — ประกอบที่อยู่จากช่องย่อยเป็นข้อความบรรทัดเดียว
 *
 * ฟอร์มให้กรอกแยกช่อง (เลขที่ หมู่ ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์)
 * แต่เอกสาร PDF และหน้าจอเดิมอ่านจากช่องข้อความรวม — ฝั่ง server จึงประกอบให้เสมอ
 * จะได้มีแหล่งความจริงเดียว ไม่ต้องหวังว่าหน้าเว็บส่งมาถูก
 *
 * รูปแบบเดียวกับที่อยู่บริษัทที่ระบบใช้อยู่ (กรุงเทพฯ ใช้ แขวง/เขต · จังหวัดอื่นใช้ ต./อ./จ.)
 */
const ADDRESS_KEYS = ['addrNo', 'moo', 'soi', 'road', 'subDistrict', 'district', 'province', 'zipcode'];
const BANGKOK = new Set(['กรุงเทพมหานคร', 'กรุงเทพฯ', 'กทม.', 'กรุงเทพ']);

const clean = (v) => String(v ?? '').trim();

function composeAddress(parts = {}) {
  const isBangkok = BANGKOK.has(clean(parts.province));
  const pieces = [
    clean(parts.addrNo),
    clean(parts.moo) && `หมู่ ${clean(parts.moo)}`,
    clean(parts.soi) && `ซอย${clean(parts.soi)}`,
    clean(parts.road) && `ถนน${clean(parts.road)}`,
    clean(parts.subDistrict) && (isBangkok ? `แขวง${clean(parts.subDistrict)}` : `ต.${clean(parts.subDistrict)}`),
    clean(parts.district) && (isBangkok ? `เขต${clean(parts.district)}` : `อ.${clean(parts.district)}`),
    clean(parts.province) && (isBangkok ? clean(parts.province) : `จ.${clean(parts.province)}`),
    clean(parts.zipcode),
  ];
  return pieces.filter(Boolean).join(' ');
}

const hasAddressParts = (parts = {}) => ADDRESS_KEYS.some((k) => clean(parts[k]));

// ดึงช่องย่อยที่ขึ้นต้นด้วย prefix ออกจาก body เช่น prefix "contact" → contactAddrNo, contactMoo, ...
function pickAddressParts(body = {}, prefix) {
  const out = {};
  for (const key of ADDRESS_KEYS) {
    const field = `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    out[key] = body[field] === undefined ? undefined : clean(body[field]) || null;
  }
  return out;
}

/**
 * เตรียมข้อมูลที่อยู่สำหรับบันทึก: คืนทั้งช่องย่อยและข้อความรวม
 * - กรอกช่องย่อยมา → ประกอบข้อความรวมให้ใหม่
 * - ไม่ได้ส่งช่องย่อยมาเลย → ใช้ข้อความรวมที่ส่งมา (ข้อมูลเก่า/ผู้ที่ยังไม่ได้แยกช่อง)
 * @param {string} prefix ชื่อนำหน้าช่องย่อย เช่น "contact"
 * @param {string} combinedField ชื่อคอลัมน์ข้อความรวม เช่น "contactAddress"
 */
function buildAddressData(body, prefix, combinedField) {
  const parts = pickAddressParts(body, prefix);
  const sent = Object.fromEntries(Object.entries(parts).filter(([, v]) => v !== undefined));
  const data = {};
  for (const [key, value] of Object.entries(sent)) {
    data[`${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`] = value;
  }
  if (hasAddressParts(sent)) {
    data[combinedField] = composeAddress(sent);
  } else if (Object.keys(sent).length > 0 && body[combinedField] === undefined) {
    // ส่งช่องย่อยมาแต่ว่างทั้งหมด = ผู้ใช้ล้างที่อยู่
    data[combinedField] = '';
  } else if (body[combinedField] !== undefined) {
    data[combinedField] = body[combinedField];
  }
  return data;
}

module.exports = { ADDRESS_KEYS, composeAddress, hasAddressParts, pickAddressParts, buildAddressData };
