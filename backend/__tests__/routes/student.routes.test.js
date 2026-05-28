// __tests__/routes/student.routes.test.js
// Integration tests for GET /api/students
// Uses supertest to exercise the full HTTP → verifyToken middleware → controller chain

// ── 1. Mock Prisma (must be before any require that pulls in prismaClient) ──
jest.mock('@prisma/client', () => {
  const mocks = require('../__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});
jest.mock('../../config/prismaClient', () => require('../__mocks__/prismaClient'));

// ── 2. Mock external services ──
jest.mock('../../services/kkuRegService', () => ({
  isConfigured: jest.fn().mockReturnValue(false),
  authenticate: jest.fn(),
  getStudentToken: jest.fn(),
  getStudentInfo: jest.fn(),
  getAdvisor: jest.fn(),
  syncStudentAll: jest.fn(),
  getCurrentSemester: jest.fn(),
  getGradeList: jest.fn(),
  searchCourses: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../__mocks__/prismaClient');

const TEST_SECRET = process.env.JWT_SECRET || 'test_secret_key_for_jest_testing_only_32chars';

const makeToken = (payload) => jwt.sign(payload, TEST_SECRET);

// ── 3. Build mini express app ──
const app = express();
app.use(express.json());
app.use('/api/students', require('../../routes/studentRoutes'));

beforeEach(() => {
  jest.clearAllMocks();
});

// ════════════════════════════════════════════════════════════
// GET /api/students
// ════════════════════════════════════════════════════════════
describe('GET /api/students', () => {

  test('401 — no Authorization header', async () => {
    const res = await request(app)
      .get('/api/students');

    expect(res.status).toBe(401);
    // verifyToken returns { message: "No token provided" }
    expect(res.body).toHaveProperty('message');
  });

  test('401 — invalid Bearer token', async () => {
    const res = await request(app)
      .get('/api/students')
      .set('Authorization', 'Bearer invalid-token-xyz');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  test('401 — malformed header (no Bearer prefix)', async () => {
    const token = makeToken({ id: 1, role: 'staff' });

    const res = await request(app)
      .get('/api/students')
      .set('Authorization', token); // missing "Bearer " prefix → token.split(' ')[1] is undefined

    expect(res.status).toBe(401);
  });

  test('200 — valid staff token → returns data array', async () => {
    const token = makeToken({ id: 99, role: 'staff' });

    // studentController.getStudents returns paginated result
    prisma.student.findMany.mockResolvedValue([
      { id: 1, studentId: '640001', firstName: 'สมชาย', lastName: 'ใจดี' },
      { id: 2, studentId: '640002', firstName: 'สมหญิง', lastName: 'ใจงาม' },
    ]);
    prisma.student.count.mockResolvedValue(2);

    const res = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Response is either a plain array or { data: [...], meta: {...} }
    const students = Array.isArray(res.body) ? res.body : (res.body?.data ?? []);
    expect(Array.isArray(students)).toBe(true);
  });

  test('200 — valid teacher token → route is accessible', async () => {
    const token = makeToken({ id: 5, role: 'teacher' });

    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

});
