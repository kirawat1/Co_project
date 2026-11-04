// __tests__/studentId.test.js — รหัสนักศึกษาแบบระบบทะเบียน (643040001-1)
const { normalizeStudentId, studentIdVariants, studentIdSearchOr } = require('../utils/studentId');
const { defaultStudentPassword } = require('../utils/studentPassword');

describe('normalizeStudentId', () => {
  test.each([
    ['6430400011', '643040001-1'],
    [' 6430400011 ', '643040001-1'],
    ['643040001-1', '643040001-1'],
    ['640001', '640001'],          // รหัสสั้น/ข้อมูลทดสอบ เก็บตามที่กรอก
    ['ZL1234501', 'ZL1234501'],
    ['', ''],
    [null, ''],
  ])('%p → %p', (raw, expected) => expect(normalizeStudentId(raw)).toBe(expected));

  test('รหัสผ่านเริ่มต้นตรงกับรหัสที่เก็บ (ทั้งสองรูปแบบได้รหัสผ่านเดียวกัน)', () => {
    expect(defaultStudentPassword('6430400011')).toBe(normalizeStudentId('6430400011'));
    expect(defaultStudentPassword('643040001-1')).toBe('643040001-1');
  });
});

describe('studentIdVariants — ตรวจซ้ำข้ามรูปแบบ', () => {
  test('มีขีด/ไม่มีขีด = รหัสเดียวกัน', () => {
    expect(studentIdVariants('6430400011')).toEqual(['643040001-1', '6430400011']);
    expect(studentIdVariants('643040001-1')).toEqual(['643040001-1', '6430400011']);
  });
  test('รูปแบบอื่นมีรูปเดียว · ว่าง = ไม่มี', () => {
    expect(studentIdVariants('640001')).toEqual(['640001']);
    expect(studentIdVariants('')).toEqual([]);
  });
});

describe('studentIdSearchOr — ค้นได้ทั้งสองแบบ', () => {
  const forms = (s) => studentIdSearchOr(s).map((c) => c.studentId.contains).sort();
  test('พิมพ์เลข 10 หลัก → ค้นแบบมีขีดด้วย', () => expect(forms('6430400011')).toEqual(['643040001-1', '6430400011']));
  test('พิมพ์แบบมีขีด → ค้นแบบไม่มีขีดด้วย (ข้อมูลเก่าที่ถูกตัดขีด)', () => expect(forms('643040001-1')).toEqual(['643040001-1', '6430400011']));
  test('พิมพ์บางส่วน/ชื่อ → ค้นตามที่พิมพ์', () => {
    expect(forms('64304')).toEqual(['64304']);
    expect(forms('สมชาย')).toEqual(['สมชาย']);
    expect(studentIdSearchOr('  ')).toEqual([]);
  });
});
