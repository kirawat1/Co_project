// __tests__/configController.test.js — หน้าตั้งค่าแบบประเมิน/T007/T008/ฟอร์มคำร้อง (ค่ากลาง)
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('fs', () => ({ ...jest.requireActual('fs'), existsSync: jest.fn().mockReturnValue(true), unlinkSync: jest.fn() }));

const fs = require('fs');
const path = require('path');
const prisma = require('./__mocks__/prismaClient');
const ctl = require('../controllers/configController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const SYSTEM_DIR = path.join(__dirname, '../uploads/system');
const saved = () => JSON.parse(prisma.systemConfig.upsert.mock.calls[0][0].update.value);

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$transaction.mockImplementation((arg) => Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
  prisma.systemConfig.upsert.mockResolvedValue({});
});

describe('updateT008Config — รูปประกอบ', () => {
  const current = (imagePath) => prisma.systemConfig.findUnique.mockResolvedValue({ key: 'CONFIG_T008', value: JSON.stringify({ imagePath }) });

  test('ชื่อรูปเดิมที่ส่งมาไม่ตรงกับที่ตั้งไว้ → ไม่เก็บ (เดิมเก็บ path จาก body แล้วรอบหน้าลบไฟล์ตามนั้น)', async () => {
    current('T008_1.png');
    const res = makeRes();
    await ctl.updateT008Config({ body: { instructionText: 'x', existingImage: '../../server.js' } }, res);
    expect(saved().imagePath).toBeNull();
    // รูปเดิมถูกเอาออก → ลบเฉพาะไฟล์ในโฟลเดอร์ system
    expect(fs.unlinkSync).toHaveBeenCalledWith(path.join(SYSTEM_DIR, 'T008_1.png'));
    expect(fs.unlinkSync.mock.calls.every(([p]) => p.startsWith(SYSTEM_DIR))).toBe(true);
  });

  test('ค่าเก่าที่เคยถูกตั้งเป็น path นอกโฟลเดอร์ → เปลี่ยนรูปแล้วลบได้แค่ในโฟลเดอร์ system', async () => {
    current('../../server.js');
    const res = makeRes();
    await ctl.updateT008Config({ body: {}, file: { filename: 'T008_new.png' } }, res);
    expect(saved().imagePath).toBe('T008_new.png');
    expect(fs.unlinkSync).toHaveBeenCalledWith(path.join(SYSTEM_DIR, 'server.js'));
    expect(fs.unlinkSync.mock.calls.every(([p]) => p.startsWith(SYSTEM_DIR))).toBe(true);
  });

  test('ไม่เปลี่ยนรูป (ส่งชื่อเดิมกลับมา) → คงไว้ ไม่ลบอะไร', async () => {
    current('T008_1.png');
    const res = makeRes();
    await ctl.updateT008Config({ body: { existingImage: 'T008_1.png' } }, res);
    expect(saved().imagePath).toBe('T008_1.png');
    expect(fs.unlinkSync).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, imagePath: 'T008_1.png' }));
  });

  test('อัปโหลดรูปใหม่ → ใช้รูปใหม่ ลบรูปเดิม', async () => {
    current('T008_1.png');
    const res = makeRes();
    await ctl.updateT008Config({ body: { existingImage: 'T008_1.png' }, file: { filename: 'T008_2.png' } }, res);
    expect(saved().imagePath).toBe('T008_2.png');
    expect(fs.unlinkSync).toHaveBeenCalledWith(path.join(SYSTEM_DIR, 'T008_1.png'));
  });

  test('400 — ลิงก์ไม่ใช่ http/https · กำหนดส่งผิดรูปแบบ (ลบไฟล์ที่เพิ่งอัปโหลด)', async () => {
    for (const body of [{ driveLink: 'javascript:alert(1)' }, { deadline: '1/12/2026' }]) {
      const res = makeRes();
      await ctl.updateT008Config({ body, file: { filename: 'T008_x.png' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(prisma.systemConfig.upsert).not.toHaveBeenCalled();
    expect(fs.unlinkSync).toHaveBeenCalledWith(path.join(SYSTEM_DIR, 'T008_x.png'));
  });
});

describe('ค่ากลางแบบประเมิน / T007 / ฟอร์มคำร้อง', () => {
  test('ลิงก์ต้องเป็น http/https · กำหนดส่ง YYYY-MM-DD', async () => {
    const cases = [
      [ctl.updateEvaluationConfig, { t005Link: 'javascript:x' }],
      [ctl.updateEvaluationConfig, { deadline: 'พรุ่งนี้' }],
      [ctl.updateT007Config, { t007Link: 'ftp://x' }],
      [ctl.updateGatewaySettings, { gradeSheetUrl: 'data:text/html,x' }],
      [ctl.updateGatewaySettings, { gradeSheetLinkText: '   ' }],
    ];
    for (const [fn, body] of cases) {
      const res = makeRes();
      await fn({ body }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(prisma.systemConfig.upsert).not.toHaveBeenCalled();
  });

  test('บันทึก: กำหนดส่งว่าง = ไม่มีกำหนด · ข้อความยาวเกินถูกตัด (ฟอร์มคำร้อง)', async () => {
    let res = makeRes();
    await ctl.updateT007Config({ body: { instructionText: 'อ่าน', t007Link: 'https://forms.gle/x', deadline: '' } }, res);
    expect(saved()).toEqual({ instructionText: 'อ่าน', t007Link: 'https://forms.gle/x', deadline: null });

    prisma.systemConfig.upsert.mockClear();
    res = makeRes();
    await ctl.updateGatewaySettings({ body: { gradeSheetDescription: 'ก'.repeat(600), gradeSheetLinkText: 'เปิด' } }, res);
    expect(saved().gradeSheetDescription).toHaveLength(500);
    expect(saved().gradeSheetUrl).toMatch(/^https:\/\//); // ไม่ส่งมา = ค่าเริ่มต้น
  });
});
