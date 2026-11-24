// utils/fileFilters.js — rejectFakeFiles (ไฟล์ปลอมที่แค่เปลี่ยนนามสกุล)
const { rejectFakeFiles } = require('../utils/fileFilters');

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};
// multer ส่ง originalname มาเป็น latin1 (ไบต์ UTF-8 อ่านทีละไบต์)
const asMulter = (name) => Buffer.from(name, 'utf8').toString('latin1');

describe('rejectFakeFiles', () => {
  test('ไฟล์ข้อความตั้งชื่อ .pdf → 400 และข้อความแสดงชื่อไฟล์ภาษาไทยถูกต้อง (เดิมขึ้น à¹à¸...)', () => {
    const res = makeRes();
    const next = jest.fn();
    rejectFakeFiles({ file: { originalname: asMulter('ใบแสดงผลการเรียน.pdf'), buffer: Buffer.from('ไม่ใช่ PDF') } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('"ใบแสดงผลการเรียน.pdf"');
  });

  test('ชื่อไฟล์อังกฤษ → ชื่อเดิม', () => {
    const res = makeRes();
    rejectFakeFiles({ file: { originalname: 'transcript.pdf', buffer: Buffer.from('hello') } }, res, jest.fn());
    expect(res.json.mock.calls[0][0].message).toContain('"transcript.pdf"');
  });

  test('PDF จริง → ผ่าน', () => {
    const next = jest.fn();
    rejectFakeFiles({ file: { originalname: asMulter('ใบสมัคร.pdf'), buffer: Buffer.from('%PDF-1.4\n...') } }, makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
