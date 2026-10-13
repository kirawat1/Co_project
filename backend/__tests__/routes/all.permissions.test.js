// __tests__/routes/all.permissions.test.js — สิทธิ์ของทุก route นอก /api/admin (admin อยู่ใน admin.permissions.test.js)
// ไล่ route จริงจากทุกไฟล์ใน routes/ แล้วตรวจ 3 ชั้น:
//   1) verifyToken ต้องเป็น middleware ตัวแรก (กันอัปโหลดไฟล์/ทำงานก่อนตรวจ token) — ยกเว้น PUBLIC
//   2) ไม่มี token → 401
//   3) ตารางสิทธิ์ต่อ role — เปลี่ยนสิทธิ์ route ไหนต้องแก้ตารางนี้ด้วย (จงใจ) · route ใหม่ที่ไม่อยู่ในตาราง = เทสต์ล้ม
// ✓ = ผ่านด่านสิทธิ์ (ไม่ได้ 401/403) · · = 403
// ด่านในระดับข้อมูล (เช่น อาจารย์ต้องเป็นที่ปรึกษาของนักศึกษาคนนั้น) อยู่ในเทสต์ของ controller แต่ละตัว
jest.mock('@prisma/client', () => {
  const mocks = require('../__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});
jest.mock('../../config/prismaClient', () => require('../__mocks__/prismaClient'));
jest.mock('../../controllers/statusController', () => ({ getStatus: (_req, res) => res.json({ ok: true }) }));

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../__mocks__/prismaClient');
const { verifyToken } = require('../../middlewares/authMiddleware');

const SECRET = process.env.JWT_SECRET;
const tok = (id, role) => `Bearer ${jwt.sign({ id, role }, SECRET)}`;
// ลำดับคอลัมน์ในตาราง
const ROLES = [
  ['นักศึกษา', tok(4, 'student')],
  ['อาจารย์ทั่วไป', tok(3, 'teacher')],
  ['อาจารย์ประจำวิชา', tok(2, 'teacher')],
  ['เจ้าหน้าที่', tok(1, 'staff')],
];

// ไฟล์ route → path ที่ mount ใน server.js
const MOUNTS = {
  auth: '/api/auth', company: '/api/companies', announcement: '/api/announcements', student: '/api/students',
  coop: '/api/coop', visit: '/api/visits', teacher: '/api/teacher', doc: '/api/docs', notification: '/api/notifications',
  feedback: '/api/feedback', status: '/api/status', internalStatus: '/api/internal-status', supervision: '/api',
};

// ไม่ต้อง login — ตั้งใจ
const PUBLIC = {
  auth: ['POST /signin', 'POST /login/google'],
  internalStatus: ['GET /'],            // หน้าสถานะเครื่อง — กันด้วย nginx + header (ดูเทสต์ท้ายไฟล์)
};

// prettier-ignore
const EXPECTED = {
  auth: {
    'POST /register':   '· · · ✓',
    'GET /me':          '✓ ✓ ✓ ✓',
    'PUT /me/password': '✓ · · ·',
  },
  company: {
    'GET /search':               '✓ ✓ ✓ ✓',
    'POST /bulk':                '· · · ✓',
    'GET /':                     '✓ ✓ ✓ ✓',
    'POST /':                    '✓ ✓ ✓ ✓',
    'GET /contacts':             '· · · ✓',
    'POST /:companyId/contacts': '✓ ✓ ✓ ✓',
    'PUT /contacts/:id':         '✓ ✓ ✓ ✓',
    'DELETE /contacts/:id':      '✓ ✓ ✓ ✓',
    'PUT /:id':                  '✓ ✓ ✓ ✓',
    'DELETE /:id':               '✓ ✓ ✓ ✓',
    'POST /:companyId/mentors':  '✓ ✓ ✓ ✓',
    'PUT /mentors/:id':          '✓ ✓ ✓ ✓',
    'DELETE /mentors/:id':       '✓ ✓ ✓ ✓',
  },
  announcement: {
    'GET /':       '✓ ✓ ✓ ✓',
    'POST /':      '· · ✓ ✓',
    'DELETE /:id': '· · ✓ ✓',
  },
  student: {
    'GET /me':                         '✓ · · ·',
    'PUT /me':                         '✓ · · ·',
    'GET /':                           '· ✓ ✓ ✓',
    'POST /acknowledge-dispatch':      '✓ · · ·',
    'POST /download-placement-letter': '✓ · · ·',
    'GET /coop-periods/active':        '✓ ✓ ✓ ✓',
    'GET /coop-periods':               '✓ ✓ ✓ ✓',
    'GET /doc-requirements':           '✓ ✓ ✓ ✓',
  },
  coop: {
    'GET /departments':               '✓ ✓ ✓ ✓',
    'POST /apply':                    '✓ · · ·',
    'DELETE /documents/:id':          '✓ · · ·',
    'PUT /status':                    '· ✓ ✓ ✓',
    'GET /supervision/me':            '✓ · · ·',
    'POST /supervision/propose':      '✓ · · ·',
    'GET /supervision/calendar':      '✓ ✓ ✓ ✓',
    'GET /supervision/company-queue': '✓ · · ·',
    'GET /config/gateway':            '✓ ✓ ✓ ✓',
    'GET /config/t000':               '✓ ✓ ✓ ✓',
    'GET /config/t002':               '✓ ✓ ✓ ✓',
    'GET /config/apply':              '✓ ✓ ✓ ✓',
    'GET /config/t003':               '✓ ✓ ✓ ✓',
    'GET /config/evaluation':         '✓ ✓ ✓ ✓',
    'GET /config/t007':               '✓ ✓ ✓ ✓',
    'GET /config/t008':               '✓ ✓ ✓ ✓',
    'GET /doc-requirements':          '✓ ✓ ✓ ✓',
  },
  visit: {
    'GET /student/:studentId': '· ✓ ✓ ✓',
    'POST /':                  '· ✓ ✓ ·',
    'PUT /:id/toggle':         '· ✓ ✓ ·',
    'DELETE /:id':             '· ✓ ✓ ·',
  },
  teacher: {
    'GET /me':                            '· ✓ ✓ ✓',
    'PUT /me':                            '· ✓ ✓ ✓',
    'GET /prefixes':                      '· ✓ ✓ ✓',
    'GET /my-students':                   '· ✓ ✓ ·',
    'GET /students/export':               '· ✓ ✓ ·',
    'GET /':                              '✓ ✓ ✓ ✓',
    'PUT /:id':                           '· · · ✓',
    'PUT /documents/review-t002':         '· ✓ ✓ ✓',
    'PUT /documents/review-t003':         '· ✓ ✓ ✓',
    'GET /supervisions/by-company':       '· ✓ ✓ ✓',
    'POST /supervisions/confirm-group':   '· ✓ ✓ ✓',
    'GET /supervisions':                  '· ✓ ✓ ✓',
    'PUT /supervisions/:id/review':       '· ✓ ✓ ✓',
    'PUT /supervisions/:id/availability': '· ✓ ✓ ·',
    'PUT /supervisions/:id/complete':     '· ✓ ✓ ✓',
    'GET /supervision-eval':              '· ✓ ✓ ·',
    'GET /stats':                         '· ✓ ✓ ✓',
    'GET /latest-requests':               '· ✓ ✓ ✓',
  },
  doc: {
    'POST /save-form':                '✓ · · ·',
    'GET /my-application':            '✓ · · ·',
    'POST /upload':                   '✓ · · ·',
    'DELETE /delete/:id':             '✓ · · ·',
    'DELETE /document/type/:docType': '✓ · · ·',
    'POST /form-photo':               '✓ · · ·',
    'DELETE /form-photo':             '✓ · · ·',
    'POST /t002-form':                '✓ · · ·',
    'POST /t003-form':                '✓ · · ·',
  },
  notification: {
    'GET /unread-count':   '✓ ✓ ✓ ✓',
    'GET /counts':         '✓ ✓ ✓ ✓',
    'POST /mark-all-read': '✓ ✓ ✓ ✓',
    'POST /mark-read':     '✓ ✓ ✓ ✓',
  },
  feedback: {
    'POST /':  '✓ ✓ ✓ ✓',
    'GET /me': '✓ ✓ ✓ ✓',
  },
  status: {
    'GET /': '· · · ✓',
  },
  supervision: {
    'GET /admin/supervision-periods':             '· · ✓ ✓',
    'POST /admin/supervision-periods':            '· · ✓ ✓',
    'GET /admin/supervisions':                    '· · ✓ ✓',
    'GET /admin/supervisions/export':             '· · ✓ ✓',
    'PUT /admin/supervisions/:id/confirmed-date': '· · ✓ ✓',
    'POST /admin/supervisions/:id/upload-letter': '· · · ✓',
    'PUT /admin/supervisions/:id/letter-pending': '· · · ✓',
    'PUT /admin/supervisions/:id/complete':       '· · ✓ ✓',
    'GET /admin/supervision-eval/config':         '· · ✓ ✓',
    'PUT /admin/supervision-eval/config':         '· · · ✓',
    'GET /admin/supervision-eval':                '· · ✓ ✓',
    'POST /admin/supervision-eval/send':          '· · ✓ ✓',
  },
};

const routes = Object.entries(MOUNTS).flatMap(([file, prefix]) => {
  const router = require(`../../routes/${file}Routes`);
  return router.stack.filter((l) => l.route).flatMap((l) => Object.keys(l.route.methods).map((m) => ({
    file, prefix, router, method: m, path: l.route.path, key: `${m.toUpperCase()} ${l.route.path}`, handles: l.route.stack.map((s) => s.handle),
  })));
});
const isPublic = (r) => (PUBLIC[r.file] || []).includes(r.key);
const appFor = (r) => {
  const app = express();
  app.use(express.json());
  app.use(r.prefix, r.router);
  app.use((err, _req, res, _next) => res.status(500).json({ ok: false, message: String(err) }));
  return app;
};
const call = (r, auth, headers = {}) => {
  const req = request(appFor(r))[r.method](`${r.prefix}${r.path.replace(/:[a-zA-Z]+/g, '1')}`);
  if (auth) req.set('Authorization', auth);
  for (const [k, v] of Object.entries(headers)) req.set(k, v);
  return req.send({});
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.teacher.findUnique.mockImplementation(async ({ where }) =>
    where.userId === 2 ? { id: 20, isCoopTeacher: true, coopMajors: [{ major: 'CS' }] }
      : where.userId === 3 ? { id: 30, isCoopTeacher: false, coopMajors: [] } : null);
});

test('ตารางสิทธิ์ครบทุก route (route ใหม่ต้องเพิ่มในตาราง · route ที่ลบแล้วต้องเอาออก)', () => {
  const actual = routes.filter((r) => !isPublic(r)).map((r) => `${r.file} ${r.key}`).sort();
  const listed = Object.entries(EXPECTED).flatMap(([f, rs]) => Object.keys(rs).map((k) => `${f} ${k}`)).sort();
  expect(actual).toEqual(listed);
  for (const [f, keys] of Object.entries(PUBLIC)) for (const k of keys) expect(routes.map((r) => `${r.file} ${r.key}`)).toContain(`${f} ${k}`);
});

describe('verifyToken เป็น middleware ตัวแรก', () => {
  test.each(routes.filter((r) => !isPublic(r)).map((r) => [`${r.file} ${r.key}`, r]))('%s', (_k, r) => {
    expect(r.handles.indexOf(verifyToken)).toBe(0);
  });
});

describe('ไม่มี token → 401', () => {
  test.each(routes.filter((r) => !isPublic(r)).map((r) => [`${r.file} ${r.key}`, r]))('%s', async (_k, r) => {
    expect((await call(r)).status).toBe(401);
  });
});

describe('สิทธิ์ต่อ role', () => {
  test.each(routes.filter((r) => !isPublic(r)).map((r) => [`${r.file} ${r.key}`, r]))('%s', async (_k, r) => {
    const expected = EXPECTED[r.file][r.key].split(' ');
    const got = [];
    for (const [, auth] of ROLES) {
      const st = (await call(r, auth)).status;
      got.push(st === 403 || st === 401 ? '·' : '✓');
    }
    // แสดงชื่อ role ที่ไม่ตรงให้อ่านง่าย
    const diff = ROLES.map(([name], i) => (got[i] !== expected[i] ? `${name}: คาด ${expected[i]} ได้ ${got[i]}` : null)).filter(Boolean);
    expect(diff).toEqual([]);
  });
});

describe('หน้าสถานะเครื่อง (/api/internal-status) ไม่ต้อง login แต่เปิดเฉพาะในเครื่อง', () => {
  const r = routes.find((x) => x.file === 'internalStatus' && x.key === 'GET /');
  test('เรียกตรงในเครื่อง (ไม่ผ่าน proxy) → 200', async () => {
    expect((await call(r)).status).toBe(200);
  });
  test.each([['X-Real-IP', '1.2.3.4'], ['X-Forwarded-For', '1.2.3.4']])('ผ่าน proxy สาธารณะ (%s) → 404', async (h, v) => {
    expect((await call(r, null, { [h]: v })).status).toBe(404);
  });
  test('เติม / ท้าย path ก็ยังโดนกัน', async () => {
    const res = await request(appFor(r)).get('/api/internal-status/').set('X-Real-IP', '1.2.3.4');
    expect(res.status).toBe(404);
  });
});
