// ตัวจัดการ error กลาง — ไฟล์อัปโหลดผิดชนิด/ใหญ่เกิน = 400 (เดิมตกไปที่ตัวจัดการของ Express เป็น 500 แบบ HTML)
const multer = require('multer');
const errorHandler = require('../middlewares/errorHandler');
const { pdfOrImageFileFilter } = require('../utils/fileFilters');

function makeRes(headersSent = false) {
  return { headersSent, status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('errorHandler', () => {
  test('ไฟล์ผิดชนิดจาก fileFilter → 400 พร้อมข้อความเดิม', () => {
    let err;
    pdfOrImageFileFilter({}, { originalname: 'virus.exe', mimetype: 'application/x-msdownload' }, (e) => { err = e; });
    const res = makeRes();
    errorHandler(err, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: expect.stringMatching(/รองรับเฉพาะไฟล์ PDF และรูปภาพ/) });
  });

  test('ไฟล์ใหญ่เกิน (MulterError LIMIT_FILE_SIZE) → 400 บอกว่าไฟล์ใหญ่เกิน', () => {
    const res = makeRes();
    errorHandler(new multer.MulterError('LIMIT_FILE_SIZE', 'file'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: expect.stringMatching(/ไฟล์ใหญ่เกิน/) });
  });

  test('MulterError อื่น (ชื่อช่องไฟล์ผิด) → 400', () => {
    const res = makeRes();
    errorHandler(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'other'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('error อื่น → 500 แบบ JSON ไม่เปิดเผยรายละเอียด', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = makeRes();
    errorHandler(new Error('db exploded'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'เกิดข้อผิดพลาดภายในระบบ' });
    spy.mockRestore();
  });

  test('ส่งคำตอบไปแล้ว → ส่งต่อให้ Express ปิดการเชื่อมต่อ', () => {
    const next = jest.fn();
    const err = new Error('late');
    errorHandler(err, {}, makeRes(true), next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
