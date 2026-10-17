// __tests__/session.test.js — token ใช้ได้เมื่อบัญชียังอยู่ · role ตรง · เวอร์ชันตรง · นักศึกษาไม่อยู่ในถังขยะ
// บั๊กที่ปิด: ลบบัญชีเจ้าหน้าที่แล้ว token เดิมยังเรียก /api/admin/* ได้ (200) จนหมดอายุ (สูงสุด 30 วัน)
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const jwt = require('jsonwebtoken');
const prisma = require('./__mocks__/prismaClient');
const { checkSession, signSession } = require('../utils/session');

beforeEach(() => jest.clearAllMocks());
const user = (over = {}) => ({ role: 'staff', tokenVersion: 0, student: null, ...over });

describe('checkSession', () => {
  test('บัญชียังอยู่ role ตรง เวอร์ชันตรง → ใช้ได้', async () => {
    prisma.user.findUnique.mockResolvedValue(user());
    await expect(checkSession({ id: 1, role: 'staff', tv: 0 })).resolves.toBe(true);
  });

  test('token เก่าที่ไม่มี tv = เวอร์ชัน 0 → ใช้ได้ (deploy แล้วไม่ต้องเข้าสู่ระบบใหม่ทั้งคณะ)', async () => {
    prisma.user.findUnique.mockResolvedValue(user());
    await expect(checkSession({ id: 1, role: 'staff' })).resolves.toBe(true);
  });

  test.each([
    ['บัญชีถูกลบ', null, { id: 1, role: 'staff' }],
    ['role ในบัญชีเปลี่ยน (เจ้าหน้าที่ → นักศึกษา)', user({ role: 'student' }), { id: 1, role: 'staff' }],
    ['เปลี่ยน/รีเซ็ตรหัสผ่านแล้ว (เวอร์ชันใหม่กว่า token)', user({ tokenVersion: 2 }), { id: 1, role: 'staff', tv: 1 }],
    ['token เก่าไม่มี tv แต่บัญชีเคยถูกเพิกถอนแล้ว', user({ tokenVersion: 1 }), { id: 1, role: 'staff' }],
    ['นักศึกษาอยู่ในถังขยะ', user({ role: 'student', student: { deletedAt: new Date() } }), { id: 1, role: 'student' }],
    ['id ไม่ถูกต้อง', user(), { id: 'abc', role: 'staff' }],
  ])('%s → ใช้ไม่ได้', async (_n, row, decoded) => {
    prisma.user.findUnique.mockResolvedValue(row);
    await expect(checkSession(decoded)).resolves.toBe(false);
  });

  test('role เทียบแบบไม่สนตัวพิมพ์ (token เก่าบางชุดเป็น STAFF)', async () => {
    prisma.user.findUnique.mockResolvedValue(user());
    await expect(checkSession({ id: 1, role: 'STAFF', tv: 0 })).resolves.toBe(true);
  });

  test('DB มีปัญหา → โยน error (ให้ middleware ตอบ 503 ไม่ใช่ 401)', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('db down'));
    await expect(checkSession({ id: 1, role: 'staff' })).rejects.toThrow('db down');
  });
});

test('signSession ใส่เวอร์ชันของบัญชีลงใน token', () => {
  const t = signSession({ id: 7, role: 'teacher', tokenVersion: 3 }, '1h');
  expect(jwt.decode(t)).toMatchObject({ id: 7, role: 'teacher', tv: 3 });
});
