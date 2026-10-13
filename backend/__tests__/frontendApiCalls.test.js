// __tests__/frontendApiCalls.test.js — หน้าเว็บเรียกเฉพาะ API ที่มีอยู่จริง
// บั๊กที่จับ: ลบ /api/students/reg-status ฝั่ง backend แต่หน้าโปรไฟล์ยังเรียก → 404 + ปุ่ม "KKU Sync" ที่เคยซ่อนโผล่ขึ้นมา
// สแกนสตริง "/api/..." ในซอร์สหน้าเว็บ (ตัดคอมเมนต์) แล้วเทียบกับ route จริงของทุก router ตามที่ mount ใน server.js
jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const fs = require('fs');
const path = require('path');
const { stripComments } = require('./helpers/sourceScan');

const FRONTEND_SRC = path.join(__dirname, '../../Frontend/src');

// ตาม server.js
const MOUNTS = [
  ['/api/auth', 'authRoutes'], ['/api/companies', 'companyRoutes'], ['/api/announcements', 'announcementRoutes'],
  ['/api/students', 'studentRoutes'], ['/api/coop', 'coopRoutes'], ['/api/visits', 'visitRoutes'],
  ['/api/teacher', 'teacherRoutes'], ['/api/docs', 'docRoutes'], ['/api/admin', 'adminRoutes'],
  ['/api/teachers', 'teacherRoutes'], ['/api/notifications', 'notificationRoutes'], ['/api/feedback', 'feedbackRoutes'],
  ['/api/status', 'statusRoutes'], ['/api/internal-status', 'internalStatusRoutes'], ['/api', 'supervisionRoutes'],
];

const toRegex = (p) => new RegExp(`^${p.replace(/\/$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z_]\w*/g, '[^/]+')}/?$`);

const ROUTES = MOUNTS.flatMap(([prefix, file]) => {
  const router = require(`../routes/${file}`);
  return router.stack.filter((l) => l.route).map((l) => `${prefix}${l.route.path === '/' ? '' : l.route.path}`);
});
const PATTERNS = ROUTES.map(toRegex);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(tsx?|jsx?)$/.test(e.name) ? [p] : [];
  });
}

/** สตริง/template ที่ขึ้นต้น /api/ → path แบบ /api/x/:x/y (ตัด query และส่วน ${} ที่ไม่ใช่ทั้งช่วงของ path) */
function apiCalls(code) {
  const out = [];
  const re = /["'`](\/api\/[^"'`\s]*)/g;
  let m;
  while ((m = re.exec(code))) {
    let p = m[1].replace(/\/\$\{[^}]*\}/g, '/:x');    // /${id} → /:x
    const tpl = p.indexOf('${');                        // ${qs ? ...} ต่อท้าย = query
    if (tpl >= 0) p = p.slice(0, tpl);
    p = p.split('?')[0].replace(/\/+$/, '');
    if (p.length > '/api'.length) out.push({ path: p, index: m.index });
  }
  return out;
}

const calls = walk(FRONTEND_SRC).flatMap((file) => {
  const code = stripComments(fs.readFileSync(file, 'utf8'));
  return apiCalls(code).map((c) => ({ ...c, file: path.relative(FRONTEND_SRC, file).split(path.sep).join('/'), line: code.slice(0, c.index).split('\n').length }));
});

test('สแกนเจอการเรียก API จากหน้าเว็บจริง (กันเทสต์ผ่านเพราะสแกนไม่เจออะไร)', () => {
  expect(calls.length).toBeGreaterThan(150);
  expect(ROUTES.length).toBeGreaterThan(180);
});

test('ทุก /api/... ที่หน้าเว็บเรียก มี route ใน backend รองรับ', () => {
  const missing = calls
    // ส่วน ${…} ของหน้าเว็บ (:x) อาจเป็นชื่อ endpoint เอง เช่น /api/auth/${'signin'} → จับคู่กับ route ไหนก็ได้ในตำแหน่งนั้น
    .filter((c) => !PATTERNS.some((re) => re.test(c.path)) && !ROUTES.some((r) => toRegex(c.path).test(r)))
    .map((c) => `${c.file}:${c.line}  ${c.path}`);
  expect([...new Set(missing)]).toEqual([]);
});
