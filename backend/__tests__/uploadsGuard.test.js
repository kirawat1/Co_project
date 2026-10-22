// /uploads ต้อง login และมีสิทธิ์ในไฟล์นั้น — token มาจาก cookie (ลิงก์/รูป/เปิดแท็บใหม่ส่ง header เองไม่ได้) หรือ Bearer
// verifyToken ตั้ง cookie ให้อัตโนมัติ (ผู้ใช้ที่ login ค้างไว้ก่อน deploy ได้ cookie ตั้งแต่คำขอ API แรก) · ออกจากระบบล้าง cookie
jest.mock('../utils/session', () => ({ ...jest.requireActual('../utils/session'), checkSession: jest.fn(async () => true) }));
jest.mock('../utils/uploadAccess', () => ({ canAccessUpload: jest.fn(async () => true) }));
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { checkSession } = require('../utils/session');
const { canAccessUpload } = require('../utils/uploadAccess');
const uploadsGuard = require('../middlewares/uploadsGuard');
const { verifyToken } = require('../middlewares/authMiddleware');
const { FILE_COOKIE } = require('../utils/fileCookie');
const authRoutes = require('../routes/authRoutes');

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
fs.writeFileSync(path.join(DIR, 'mine.pdf'), 'PDF-CONTENT');
const sign = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
const STUDENT = sign({ id: 100, role: 'student', tv: 0 });

const app = express();
app.use('/uploads', uploadsGuard, express.static(DIR, { cacheControl: false }));
app.get('/api/ping', verifyToken, (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);

beforeEach(() => {
  jest.clearAllMocks();
  checkSession.mockResolvedValue(true);
  canAccessUpload.mockResolvedValue(true);
});

describe('uploadsGuard', () => {
  test('ไม่ login → 401 (เดิมเปิดได้)', async () => {
    const res = await request(app).get('/uploads/mine.pdf');
    expect(res.status).toBe(401);
    expect(canAccessUpload).not.toHaveBeenCalled();
  });

  test('cookie ถูกต้อง + มีสิทธิ์ → ได้ไฟล์ และห้ามเก็บไว้ใน cache ที่ใช้ร่วมกัน', async () => {
    const res = await request(app).get('/uploads/mine.pdf').set('Cookie', `${FILE_COOKIE}=${STUDENT}`)
      .buffer(true).parse((r, cb) => { let d = ''; r.on('data', (c) => { d += c; }); r.on('end', () => cb(null, d)); });
    expect(res.status).toBe(200);
    expect(res.body).toBe('PDF-CONTENT');
    expect(res.headers['cache-control']).toBe('private, max-age=0');
    expect(canAccessUpload).toHaveBeenCalledWith(expect.objectContaining({ id: 100, role: 'student' }), 'mine.pdf');
  });

  test('Bearer ใช้ได้เหมือนกัน', async () => {
    const res = await request(app).get('/uploads/mine.pdf').set('Authorization', `Bearer ${STUDENT}`);
    expect(res.status).toBe(200);
  });

  test('ไม่มีสิทธิ์ในไฟล์ → 403', async () => {
    canAccessUpload.mockResolvedValue(false);
    const res = await request(app).get('/uploads/mine.pdf').set('Cookie', `${FILE_COOKIE}=${STUDENT}`);
    expect(res.status).toBe(403);
    expect(res.text).not.toContain('PDF-CONTENT');
  });

  test('session ถูกเพิกถอน (เปลี่ยนรหัส/ลบบัญชี) → 401', async () => {
    checkSession.mockResolvedValue(false);
    expect((await request(app).get('/uploads/mine.pdf').set('Cookie', `${FILE_COOKIE}=${STUDENT}`)).status).toBe(401);
  });

  test('token เฉพาะงาน (ลิงก์ zip) ใช้เปิดไฟล์ไม่ได้ · token ปลอม → 401', async () => {
    const purpose = sign({ id: 1, role: 'staff', purpose: 'letters-zip' });
    expect((await request(app).get('/uploads/mine.pdf').set('Cookie', `${FILE_COOKIE}=${purpose}`)).status).toBe(401);
    expect((await request(app).get('/uploads/mine.pdf').set('Cookie', `${FILE_COOKIE}=garbage`)).status).toBe(401);
  });

  test('path แปลก (..) → ไม่ส่งไฟล์ ไม่ถามสิทธิ์', async () => {
    const res = await request(app).get('/uploads/..%2F..%2Fetc%2Fpasswd').set('Cookie', `${FILE_COOKIE}=${STUDENT}`);
    expect(res.status).toBe(404);
    expect(canAccessUpload).not.toHaveBeenCalled();
  });
});

describe('cookie สำหรับเปิดไฟล์', () => {
  test('verifyToken ตั้ง cookie (httpOnly, SameSite=Lax, path=/) จาก token ที่ใช้', async () => {
    const res = await request(app).get('/api/ping').set('Authorization', `Bearer ${STUDENT}`);
    expect(res.status).toBe(200);
    const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith(`${FILE_COOKIE}=`));
    expect(cookie).toContain(`${FILE_COOKIE}=${STUDENT}`);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
  });

  test('มี cookie ตรงกันอยู่แล้ว → ไม่ตั้งซ้ำ', async () => {
    const res = await request(app).get('/api/ping').set('Authorization', `Bearer ${STUDENT}`).set('Cookie', `${FILE_COOKIE}=${STUDENT}`);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('ออกจากระบบ → ล้าง cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith(`${FILE_COOKIE}=`));
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
