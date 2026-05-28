// __tests__/routes/auth.routes.test.js
// Integration tests for POST /api/auth/signin and GET /api/auth/me
// Uses supertest to exercise the full HTTP → middleware → controller chain

// ── 1. Mock Prisma (must be before any require that pulls in prismaClient) ──
jest.mock('@prisma/client', () => {
  const mocks = require('../__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});
jest.mock('../../config/prismaClient', () => require('../__mocks__/prismaClient'));

// ── 2. Mock external services that cause import errors ──
jest.mock('../../services/kkuRegService', () => ({
  isConfigured: jest.fn().mockReturnValue(false),
  authenticate: jest.fn(),
  getStudentToken: jest.fn(),
  getStudentInfo: jest.fn(),
  getAdvisor: jest.fn(),
  syncStudentAll: jest.fn(),
  getCurrentSemester: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../__mocks__/prismaClient');

const TEST_SECRET = process.env.JWT_SECRET || 'test_secret_key_for_jest_testing_only_32chars';

// ── 3. Build mini express app ──
const app = express();
app.use(express.json());
app.use('/api/auth', require('../../routes/authRoutes'));

beforeEach(() => {
  jest.clearAllMocks();
});

// ════════════════════════════════════════════════════════════
// POST /api/auth/signin
// ════════════════════════════════════════════════════════════
describe('POST /api/auth/signin', () => {

  test('400 — empty body {}', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test('400 — missing password (email + role only)', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'test@example.com', role: 'student' });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test('400 — missing role', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'test@example.com', password: 'secret' });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test('401 — user not found (prisma returns null)', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'nobody@example.com', password: 'pass', role: 'student' });

    expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  test('401 — wrong password (bcrypt mismatch)', async () => {
    const hashedPassword = await bcrypt.hash('correctpassword', 4);

    prisma.user.findFirst.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      role: 'student',
      password: hashedPassword,
      student: null,
    });

    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'user@example.com', password: 'wrongpassword', role: 'student' });

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  test('200 — valid credentials → returns token and ok: true', async () => {
    const plainPassword = 'mypassword';
    const hashedPassword = await bcrypt.hash(plainPassword, 4);

    prisma.user.findFirst.mockResolvedValue({
      id: 42,
      email: 'student@kkumail.com',
      role: 'student',
      password: hashedPassword,
      student: {
        studentId: '640001',
        firstName: 'สมชาย',
        lastName: 'ใจดี',
      },
    });

    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'student@kkumail.com', password: plainPassword, role: 'student' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body).toHaveProperty('token');

    // Verify the returned token is a valid JWT
    const decoded = jwt.verify(res.body.token, TEST_SECRET);
    expect(decoded.id).toBe(42);
    expect(decoded.role).toBe('student');
  });

});

// ════════════════════════════════════════════════════════════
// GET /api/auth/me
// ════════════════════════════════════════════════════════════
describe('GET /api/auth/me', () => {

  test('401 — no Authorization header', async () => {
    const res = await request(app)
      .get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  test('401 — invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken123');

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  test('200 — valid token and user found', async () => {
    const token = jwt.sign({ id: 7, role: 'teacher' }, TEST_SECRET);

    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      email: 'teacher@kku.ac.th',
      role: 'teacher',
      username: 'teacher01',
      student: null,
      teacher: {
        firstName: 'อาจารย์',
        lastName: 'ทดสอบ',
      },
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.user).toMatchObject({
      id: 7,
      role: 'teacher',
      email: 'teacher@kku.ac.th',
    });
  });

});
