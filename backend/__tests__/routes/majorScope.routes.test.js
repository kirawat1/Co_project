// __tests__/routes/majorScope.routes.test.js — อาจารย์ประจำวิชาทำงานเจ้าหน้าที่ได้ เฉพาะหลักสูตรที่ดูแล (Phase 2b)
jest.mock('@prisma/client', () => {
  const mocks = require('../__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});
jest.mock('../../config/prismaClient', () => require('../__mocks__/prismaClient'));

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../__mocks__/prismaClient');

const app = express();
app.use(express.json());
app.use('/api/admin', require('../../routes/adminRoutes'));
app.use((err, _req, res, _next) => res.status(500).json({ ok: false, message: String(err) }));

const COOP_CS = `Bearer ${jwt.sign({ id: 2, role: 'teacher' }, process.env.JWT_SECRET)}`;
const STAFF = `Bearer ${jwt.sign({ id: 1, role: 'staff' }, process.env.JWT_SECRET)}`;
const STUDENTS = { 10: { id: 10, major: 'CS' }, 11: { id: 11, major: 'AI' } };

beforeEach(() => {
  jest.clearAllMocks();
  // อาจารย์ user 2 = อาจารย์ประจำวิชา CS (teacher 20) · teacher 30 = อาจารย์หลักสูตร AI · teacher 40 = CS
  prisma.teacher.findUnique.mockImplementation(async ({ where }) => {
    if (where.userId === 2) return { id: 20, isCoopTeacher: true, coopMajors: [{ major: 'CS' }] };
    if (where.id === 30) return { id: 30, userId: 300, major: 'AI' };
    if (where.id === 40) return { id: 40, userId: 400, major: 'CS' };
    return null;
  });
  prisma.student.findUnique.mockImplementation(async ({ where }) => STUDENTS[where.id] ?? null);
});

const put = (path, body, auth = COOP_CS) => request(app).put(`/api/admin${path}`).set('Authorization', auth).send(body);
const post = (path, body, auth = COOP_CS) => request(app).post(`/api/admin${path}`).set('Authorization', auth).send(body);

describe('ตรวจ T000 — ออกหนังสือเป็นของเจ้าหน้าที่', () => {
  test.each([
    [{ studentId: 10, status: 'REQ_LETTER_ISSUED' }],
    [{ studentId: 10, status: 'PLACEMENT_LETTER_ISSUED' }],
    [{ studentId: 10, status: 'DOCS_APPROVED', reqDocNumber: '660301.26.6.2/1' }],
    [{ studentId: 10, status: 'ACCEPTANCE_CHECKED', placeDocDate: '2026-10-01' }],
  ])('อาจารย์ประจำวิชา %j → 403', async (body) => {
    const res = await put('/t000/review', body);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/ออกหนังสือ/);
  });

  test('ตรวจเอกสาร (ไม่ใช่ออกหนังสือ) นักศึกษาในหลักสูตร → ผ่านตัวกัน · นอกหลักสูตร → 403', async () => {
    expect((await put('/t000/review', { studentId: 10, status: 'EDITS_REQUIRED', comment: 'แก้' })).status).not.toBe(403);
    const out = await put('/t000/review', { studentId: 11, status: 'EDITS_REQUIRED', comment: 'แก้' });
    expect(out.status).toBe(403);
    expect(out.body.message).toMatch(/หลักสูตร/);
  });

  test('เจ้าหน้าที่ออกหนังสือได้ตามเดิม', async () => {
    expect((await put('/t000/review', { studentId: 11, status: 'REQ_LETTER_ISSUED' }, STAFF)).status).not.toBe(403);
  });
});

test.each([
  ['post', '/t000/approve-all', { studentId: 11 }],
  ['post', '/t000/acceptance-received', { studentId: 11 }],
  ['put', '/documents/review-t002', { studentId: 11, status: 'T002_APPROVED' }],
  ['put', '/documents/review-t003', { studentId: 11, status: 'T003_APPROVED' }],
  ['put', '/students/11', { firstName: 'x' }],
])('%s %s กับนักศึกษา AI → 403', async (method, path, body) => {
  expect((await (method === 'put' ? put : post)(path, body)).status).toBe(403);
});

describe('เพิ่ม/แก้นักศึกษา', () => {
  test('เพิ่มนักศึกษาหลักสูตร AI / ไม่ระบุหลักสูตร → 403 · CS → ผ่านตัวกัน', async () => {
    expect((await post('/students/create', { studentId: '1', major: 'AI' })).status).toBe(403);
    expect((await post('/students/create', { studentId: '1' })).status).toBe(403);
    expect((await post('/students/create', { studentId: '1', major: 'CS' })).status).not.toBe(403);
  });

  test('ย้ายนักศึกษา CS ไปหลักสูตร AI → 403', async () => {
    expect((await put('/students/10', { major: 'AI' })).status).toBe(403);
  });
});

describe('แก้ข้อมูลอาจารย์', () => {
  test('อาจารย์หลักสูตรอื่น → 403', async () => {
    expect((await put('/teachers/30', { firstName: 'x', major: 'AI' })).status).toBe(403);
  });

  test('อาจารย์ในหลักสูตร: แก้ชื่อได้ แต่อีเมลและการกำหนดอาจารย์ประจำวิชาไม่มีผล', async () => {
    prisma.teacher.update.mockResolvedValue({});
    const res = await put('/teachers/40', { firstName: 'ใหม่', lastName: 'ข', major: 'CS', email: 'hijack@kku.ac.th', coopMajors: ['CS'] });
    expect(res.status).toBe(200);
    expect(prisma.user.findFirst).not.toHaveBeenCalled(); // ไม่ได้ตรวจชนอีเมล = ไม่ได้เปลี่ยนอีเมล
    expect(prisma.coopTeacherMajor.deleteMany).not.toHaveBeenCalled();
    expect(prisma.teacher.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ firstName: 'ใหม่' }) }));
  });

  test('ย้ายอาจารย์ในหลักสูตรไปหลักสูตรอื่น → 403', async () => {
    expect((await put('/teachers/40', { firstName: 'x', major: 'AI' })).status).toBe(403);
  });
});
