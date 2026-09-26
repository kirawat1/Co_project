/**
 * ตัวช่วยของเทสต์ที่สแกนซอร์สหน้าเว็บ (noNativeDialogs, terminology)
 * ตัดคอมเมนต์ออกก่อนค้น — คอมเมนต์ในโค้ดพูดถึงคำต้องห้ามได้
 *
 * อ่านทีละตัวอักษรและจำว่าอยู่ในสตริงหรือไม่ — เดิมใช้ regex แล้ว "/*" ในสตริง (accept="image/*")
 * ถูกนับเป็นคอมเมนต์ ทำให้โค้ดต่อจากนั้นหลายสิบบรรทัดหายไปจากการตรวจแบบเงียบๆ
 * คอมเมนต์ถูกแทนด้วยช่องว่าง (คงขึ้นบรรทัดใหม่) เลขบรรทัดที่เทสต์รายงานจึงตรงไฟล์จริง
 * ถ้าเดาผิด (เช่น ' ในข้อความ JSX) ผลคือเก็บข้อความไว้มากเกิน = เทสต์ฟ้องเกิน ไม่ใช่เงียบ
 */
function stripComments(code) {
  let out = '';
  let quote = null; // ' " ` ขณะอยู่ในสตริง
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];
    if (quote) {
      if (ch === '\\') { out += ch + (next ?? ''); i += 2; continue; }
      // สตริง ' " จบที่ขึ้นบรรทัดใหม่เสมอ — กัน ' ในข้อความ JSX (don't) กลืนทั้งไฟล์
      if (ch === quote || (ch === '\n' && quote !== '`')) quote = null;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2);
      const stop = end === -1 ? code.length : end + 2;
      out += code.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
      continue;
    }
    if (ch === '/' && next === '/') {
      const end = code.indexOf('\n', i);
      const stop = end === -1 ? code.length : end;
      out += ' '.repeat(stop - i);
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    out += ch;
    i += 1;
  }
  return out;
}

module.exports = { stripComments };
