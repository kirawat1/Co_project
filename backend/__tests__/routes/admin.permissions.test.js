// __tests__/routes/admin.permissions.test.js — สิทธิ์ 3 ระดับของ /api/admin/*
// เดิม 47 route เปิดให้ "อาจารย์ทุกคน" (verifyRole('teacher','staff')) รวมถึงสร้าง/รีเซ็ตรหัส/ลบบัญชีเจ้าหน้าที่
// เทสต์นี้ไล่ทุก route จริงใน adminRoutes — route ใหม่ที่เพิ่มแล้วลืมใส่สิทธิ์จะถูกจับได้
jest.mock('@prisma/client', () => {
  const mocks = require('../__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});
jest.mock('../../config/prismaClient', () => require('../__mocks__/prismaClient'));

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../__mocks__/prismaClient');
const adminRouter = require('../../routes/adminRoutes');

const SECRET = process.env.JWT_SECRET;
const token = (id, role) => `Bearer ${jwt.sign({ id, role }, SECRET)}`;
const STAFF = token(1, 'staff');
const COOP_TEACHER = token(2, 'teacher');
const PLAIN_TEACHER = token(3, 'teacher');
const STUDENT = token(4, 'student');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
app.use((err, _req, res, _next) => res.status(500).json({ ok: false, message: String(err) }));

// หน้าอาจารย์ทั่วไปต้องใช้ (อ่านอย่างเดียว)
const ANY_TEACHER = ['GET /coop-periods', 'GET /coop-periods/active', 'GET /coop-periods/all', 'GET /majors', 'GET /students'];
// อาจารย์ประจำวิชาห้าม — เจ้าหน้าที่เท่านั้น
const STAFF_ONLY_SENSITIVE = [
  'GET /staff', 'POST /staff', 'PATCH /staff/:id/password', 'DELETE /staff/:id',
  'POST /criteria', 'PUT /criteria/:id', 'DELETE /criteria/:id',
  'POST /config/dean-info', 'POST /assets', 'DELETE /assets/:key',
  'GET /logs', 'GET /logs/export', 'GET /logs/actors',
  'PATCH /students/:id/reset-password', 'POST /students/:id/password/reveal',
  'PUT /teachers/:id/password', 'POST /teachers/:id/password/reveal',
  'PUT /t000/letter-pending',
];
// ไม่ต้อง login (ข้อมูลสาธารณะ เช่น โลโก้/ชื่อผู้ลงนามบนหนังสือ)
const PUBLIC = ['GET /assets', 'GET /config/dean-info'];

const routes = adminRouter.stack
  .filter((l) => l.route)
  .flatMap((l) => Object.keys(l.route.methods).map((m) => ({ method: m, path: l.route.path, key: `${m.toUpperCase()} ${l.route.path}` })));

const call = (r, auth) => request(app)[r.method](`/api/admin${r.path.replace(/:[a-zA-Z]+/g, '1')}`).set('Authorization', auth).send({});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.teacher.findUnique.mockImplementation(async ({ where }) =>
    where.userId === 2 ? { id: 20, isCoopTeacher: true } : where.userId === 3 ? { id: 30, isCoopTeacher: false } : null);
});

test('รายการที่ระบุในเทสต์มีอยู่จริงใน adminRoutes', () => {
  const keys = routes.map((r) => r.key);
  for (const k of [...ANY_TEACHER, ...STAFF_ONLY_SENSITIVE, ...PUBLIC]) expect(keys).toContain(k);
});

describe.each(routes.filter((r) => !PUBLIC.includes(r.key)).map((r) => [r.key, r]))('%s', (_key, r) => {
  test('อาจารย์ทั่วไป: เข้าได้เฉพาะหน้าอ่านที่จำเป็น', async () => {
    const res = await call(r, PLAIN_TEACHER);
    if (ANY_TEACHER.includes(r.key)) expect(res.status).not.toBe(403);
    else expect(res.status).toBe(403);
  });

  test('อาจารย์ประจำวิชา: ทำงานจัดการได้ ยกเว้นส่วนของเจ้าหน้าที่', async () => {
    const res = await call(r, COOP_TEACHER);
    if (STAFF_ONLY_SENSITIVE.includes(r.key)) expect(res.status).toBe(403);
  });

  test('นักศึกษา: เข้าไม่ได้', async () => {
    expect((await call(r, STUDENT)).status).toBe(403);
  });
});

test('เจ้าหน้าที่เข้าได้ทุก route ที่ห้ามอาจารย์ประจำวิชา', async () => {
  for (const key of STAFF_ONLY_SENSITIVE) {
    const r = routes.find((x) => x.key === key);
    expect([key, (await call(r, STAFF)).status]).not.toEqual([key, 403]);
  }
});
