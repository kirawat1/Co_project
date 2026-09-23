// __tests__/applyWindow.test.js — ช่วงเวลายื่นคำร้องสหกิจ (ตั้งแยกจากรอบรับสมัคร แบบ T000–T003)
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('./__mocks__/prismaClient');

const { evaluateApplyWindow, applyWindowMessage, getApplyWindowState } = require('../utils/applyWindow');
const { getApplyConfig, saveApplyConfig } = require('../controllers/configController');
const { describeRequest } = require('../utils/auditActions');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
// เวลาไทย = UTC+7
const bkk = (iso) => new Date(`${iso}+07:00`);

beforeEach(() => jest.clearAllMocks());

describe('ตัดสินว่าเปิดรับคำร้องหรือไม่ (เวลาไทย)', () => {
  const cfg = { startDate: '2026-10-01', endDate: '2026-10-15', isOpen: true };

  test('ยังไม่เคยตั้งค่า = เปิด (ระบบทำงานเหมือนเดิมหลัง deploy)', () => {
    expect(evaluateApplyWindow(null)).toMatchObject({ configured: false, open: true });
  });

  test('ปิดสวิตช์ = ปิด แม้อยู่ในช่วงวัน', () => {
    expect(evaluateApplyWindow({ ...cfg, isOpen: false }, bkk('2026-10-05T10:00:00'))).toMatchObject({ open: false, reason: 'CLOSED' });
  });

  test('เปิดตั้งแต่ 00:00 ของวันเปิด ถึง 23:59 ของวันปิด ตามเวลาไทย', () => {
    expect(evaluateApplyWindow(cfg, bkk('2026-09-30T23:59:00'))).toMatchObject({ open: false, reason: 'NOT_YET' });
    expect(evaluateApplyWindow(cfg, bkk('2026-10-01T00:00:00')).open).toBe(true);
    expect(evaluateApplyWindow(cfg, bkk('2026-10-15T23:59:00')).open).toBe(true);
    expect(evaluateApplyWindow(cfg, bkk('2026-10-16T00:00:01'))).toMatchObject({ open: false, reason: 'ENDED' });
  });

  test('ไม่กรอกวันใดวันหนึ่ง = ไม่จำกัดฝั่งนั้น', () => {
    expect(evaluateApplyWindow({ startDate: null, endDate: '2026-10-15', isOpen: true }, bkk('2020-01-01T00:00:00')).open).toBe(true);
    expect(evaluateApplyWindow({ startDate: '2026-10-01', endDate: null, isOpen: true }, bkk('2030-01-01T00:00:00')).open).toBe(true);
  });

  test('ข้อความบอกเหตุผลเป็นภาษาไทย พร้อมช่วงวัน', () => {
    expect(applyWindowMessage(evaluateApplyWindow(cfg, bkk('2026-09-01T09:00:00')))).toBe('ยังไม่ถึงช่วงเวลายื่นคำร้อง (ช่วงยื่นคำร้อง 1 ต.ค. 2569 ถึง 15 ต.ค. 2569)');
    expect(applyWindowMessage(evaluateApplyWindow(cfg, bkk('2026-11-01T09:00:00')))).toBe('ปิดรับคำร้องแล้ว (ช่วงยื่นคำร้อง 1 ต.ค. 2569 ถึง 15 ต.ค. 2569)');
    expect(applyWindowMessage(evaluateApplyWindow({ ...cfg, isOpen: false }))).toBe('ขณะนี้ปิดรับคำร้องขอเข้าร่วมสหกิจศึกษา');
    expect(applyWindowMessage(evaluateApplyWindow(null))).toBeNull();
  });

  test('ค่าที่เก็บไว้เสีย (JSON พัง) = ถือว่ายังไม่ตั้งค่า ไม่ทำให้ยื่นพัง', async () => {
    prisma.systemConfig.findUnique.mockResolvedValue({ key: 'APPLY_CONFIG', value: '{not json' });
    expect(await getApplyWindowState(prisma)).toMatchObject({ configured: false, open: true });
  });
});

describe('API ตั้งค่า', () => {
  test('อ่านค่า: ส่งสถานะที่ server ตัดสินพร้อมข้อความกลับไปด้วย', async () => {
    prisma.systemConfig.findUnique.mockResolvedValue({ value: JSON.stringify({ startDate: '2020-01-01', endDate: '2020-01-31', isOpen: true }) });
    const res = makeRes();
    await getApplyConfig({}, res);
    const body = res.json.mock.calls[0][0];
    expect(body).toMatchObject({ startDate: '2020-01-01', endDate: '2020-01-31', isOpen: true });
    expect(body.state).toMatchObject({ configured: true, open: false, reason: 'ENDED' });
    expect(body.state.message).toContain('ปิดรับคำร้องแล้ว');
  });

  test('บันทึกค่าได้ และเก็บเฉพาะวันที่ (ตัดเวลาทิ้ง)', async () => {
    prisma.systemConfig.upsert.mockResolvedValue({});
    const res = makeRes();
    await saveApplyConfig({ body: { startDate: '2026-10-01', endDate: '2026-10-15', isOpen: true } }, res);
    const saved = JSON.parse(prisma.systemConfig.upsert.mock.calls[0][0].update.value);
    expect(saved).toEqual({ startDate: '2026-10-01', endDate: '2026-10-15', isOpen: true });
    expect(prisma.systemConfig.upsert.mock.calls[0][0].where).toEqual({ key: 'APPLY_CONFIG' });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  test('วันเปิดอยู่หลังวันปิด / วันที่ผิดรูปแบบ → 400 และไม่บันทึก', async () => {
    let res = makeRes();
    await saveApplyConfig({ body: { startDate: '2026-10-20', endDate: '2026-10-01', isOpen: true } }, res);
    expect(res.status).toHaveBeenCalledWith(400);

    res = makeRes();
    await saveApplyConfig({ body: { startDate: 'ไม่ใช่วันที่', isOpen: true } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.systemConfig.upsert).not.toHaveBeenCalled();
  });

  test('บันทึกการตั้งค่าลง log เป็นชื่อไทย', () => {
    expect(describeRequest({ method: 'POST', path: '/api/admin/config/apply', body: {} }).action).toBe('ตั้งค่าช่วงเวลายื่นคำร้องสหกิจ');
  });
});
