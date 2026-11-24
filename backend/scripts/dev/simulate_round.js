#!/usr/bin/env node
/**
 * scripts/dev/simulate_round.js — จำลองการใช้งานจริงหนึ่งรอบสหกิจ ผ่าน API จริงทุกขั้น (ห้ามรันบนระบบจริง)
 *
 *   node scripts/dev/simulate_round.js             ล้างข้อมูลจำลองเดิม แล้วจำลองใหม่ทั้งรอบ (เก็บข้อมูลไว้ให้เปิดดูในหน้าเว็บ)
 *   node scripts/dev/simulate_round.js --cleanup   ลบข้อมูลจำลองทั้งหมด
 *
 * ข้อมูลจำลองทุกชิ้นมีป้าย: บัญชีอีเมล sim.*@kkumail.com · หลักสูตร SIM* · บริษัทชื่อ "บริษัท จำลอง…" · รอบที่จดใน .sim-state
 * นักศึกษา 100 คน (4 หลักสูตร × 25) · อาจารย์ประจำวิชาหลักสูตรละ 1 + ที่ปรึกษาหลักสูตรละ 3 · เจ้าหน้าที่ 2
 * ทุกคนล็อกอินจริง (นักศึกษาใช้รหัสเริ่มต้นจากการนำเข้า Excel) · ไฟล์อัปโหลดจริง (ชื่อไทย)
 * ผลลัพธ์: ตารางผ่าน/ไม่ผ่านต่อขั้น + รายการที่ผิดคาด (BUG = 5xx หรือผลไม่ตรงกติกา) → sim-report.txt (JSON)
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

if ((process.env.NODE_ENV || '').toLowerCase() === 'production') { console.error('NODE_ENV=production — ไม่รัน'); process.exit(1); }
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL || '')) { console.error('DATABASE_URL ไม่ใช่เครื่องนี้ — ไม่รัน'); process.exit(1); }

const prisma = require('../../config/prismaClient');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');

const API = process.env.SIM_API || 'http://localhost:5000';
const UPLOADS = path.join(__dirname, '../../uploads');
const STATE = path.join(__dirname, '.sim-state');
const REPORT = path.join(__dirname, 'sim-report.txt');
const PW = 'Sim12345!';
const DAY = 86_400_000;
const day = (n) => new Date(Date.now() + n * DAY).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });

const MAJORS = [
  { code: 'SIMCS', nameTh: 'จำลอง วิทยาการคอมพิวเตอร์' },
  { code: 'SIMIT', nameTh: 'จำลอง เทคโนโลยีสารสนเทศ' },
  { code: 'SIMGIS', nameTh: 'จำลอง ภูมิสารสนเทศศาสตร์' },
  { code: 'SIMAI', nameTh: 'จำลอง ปัญญาประดิษฐ์' },
];
const PER_MAJOR = 25;
const FIRST = ['สมชาย', 'สมหญิง', 'ปิติ', 'มานี', 'ชูใจ', 'วีระ', 'ดวงใจ', 'อนันต์', 'กมล', 'ศิริ', 'ธนพล', 'พิมพ์ชนก', 'ณัฐวุฒิ', 'กานต์', 'ภูมิ', 'ปวีณา', 'อรุณ', 'จันทร์เพ็ญ', 'เกียรติ', 'นภา', 'ศักดิ์ชัย', 'วรรณา', 'ธีรวัฒน์', 'สุนิสา', 'ประยุทธ'];
const COMPANIES = ['บริษัท จำลองซอฟต์แวร์ จำกัด', 'บริษัท จำลองดาต้า จำกัด', 'บริษัท จำลองคลาวด์ จำกัด (มหาชน)', 'บริษัท จำลองแผนที่ จำกัด', 'บริษัท จำลองเอไอ จำกัด', 'ธนาคาร จำลองไทย จำกัด (มหาชน)'];

// ═════════════ บันทึกผล ═════════════
const results = []; // { phase, label, ok, detail }
const bugs = [];
let phase = '';
const counts = {};
function record(ok, label, detail) {
  results.push({ phase, label, ok, detail });
  counts[phase] = counts[phase] || { pass: 0, fail: 0 };
  counts[phase][ok ? 'pass' : 'fail']++;
  if (!ok) { bugs.push({ phase, label, detail }); console.log(`   ✗ ${label}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300)}` : ''}`); }
}
const check = (cond, label, detail) => { record(!!cond, label, cond ? undefined : detail); return !!cond; };
function startPhase(name) { phase = name; console.log(`\n▶ ${name}`); }

// ═════════════ HTTP ═════════════
let requestCount = 0;
const serverErrors = [];
async function call(token, method, url, body, { expect = [200], label } = {}) {
  requestCount++;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res, json = null, text = '';
  for (let attempt = 0; ; attempt++) {
    try { res = await fetch(API + url, { method, headers, body: payload }); break; } catch (e) {
      if (attempt >= 2) { record(false, `${label || `${method} ${url}`} (เชื่อมต่อไม่ได้)`, e.message); return { status: 0, json: null }; }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  const type = res.headers.get('content-type') || '';
  if (type.includes('json')) { try { json = await res.json(); } catch { json = null; } }
  else { const buf = Buffer.from(await res.arrayBuffer()); text = buf.length; json = { _bytes: buf.length, _type: type }; }
  if (res.status >= 500) serverErrors.push({ phase, method, url, status: res.status, message: json?.message || json?.error || text });
  const expects = Array.isArray(expect) ? expect : [expect];
  if (label !== null) record(expects.includes(res.status), label || `${method} ${url} → ${expects.join('/')}`, expects.includes(res.status) ? undefined : { status: res.status, message: json?.message || json?.error });
  return { status: res.status, json };
}
const get = (t, url, o) => call(t, 'GET', url, undefined, o);

// ไฟล์ PDF จริง (มี magic bytes) — ชื่อไทยทดสอบการถอดชื่อไฟล์
const pdf = (title) => Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n% ${Buffer.from(title).toString('hex')}\ntrailer<</Root 1 0 R>>\n%%EOF\n`);
function form(fields, files = []) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, String(x)));
    else fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  for (const f of files) fd.append(f.field, new Blob([f.buffer || pdf(f.name)], { type: f.type || 'application/pdf' }), f.name);
  return fd;
}

async function signin(email, password, role) {
  const r = await call(null, 'POST', '/api/auth/signin', { email, password, role }, { label: null });
  if (r.status !== 200 || !r.json?.token) { record(false, `ล็อกอิน ${email}`, { status: r.status, message: r.json?.message }); return null; }
  return r.json.token;
}

/** ทำงานพร้อมกันทีละ n (เหมือนหลายคนกดพร้อมกัน) */
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

// ═════════════ สถานะ/ลบข้อมูลจำลอง ═════════════
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { periodIds: [] }; } };
const writeState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2));

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: 'sim.' } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const students = await prisma.student.findMany({ where: { OR: [{ userId: { in: userIds } }, { major: { startsWith: 'SIM' } }] }, select: { id: true } });
  const pks = students.map((s) => s.id);
  const teachers = (await prisma.teacher.findMany({ where: { OR: [{ userId: { in: userIds } }, { email: { startsWith: 'sim.' } }] }, select: { id: true } })).map((t) => t.id);
  const files = new Set();
  const numbers = new Set();
  for (const d of await prisma.document.findMany({ where: { studentId: { in: pks } }, select: { path: true } })) files.add(d.path);
  const collect = (row) => {
    for (const [k, v] of Object.entries(row)) {
      if (typeof v !== 'string') continue;
      if (/\.(pdf|png|jpe?g|docx?)$/i.test(v)) files.add(v);
      if (/DocNumber$|DraftNumber$/i.test(k)) numbers.add(v);
    }
  };
  for (const c of await prisma.studentCoop.findMany({ where: { studentId: { in: pks } } })) collect(c);
  const appts = await prisma.supervisionAppointment.findMany({ where: { OR: [{ studentId: { in: pks } }, { teacherId: { in: teachers } }] } });
  for (const a of appts) { collect(a); if (a.officialLetterPath) files.add(path.join('supervision', a.officialLetterPath)); }
  const apptIds = appts.map((a) => a.id);
  await prisma.supervisionCoTeacher.deleteMany({ where: { OR: [{ appointmentId: { in: apptIds } }, { teacherId: { in: teachers } }] } });
  await prisma.supervisionAppointment.deleteMany({ where: { id: { in: apptIds } } });
  await prisma.visit.deleteMany({ where: { studentId: { in: pks } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.document.deleteMany({ where: { studentId: { in: pks } } });
  await prisma.coopT002Form.deleteMany({ where: { studentId: { in: pks } } });
  await prisma.coopT003Form.deleteMany({ where: { studentId: { in: pks } } });
  await prisma.coopApplicationForm.deleteMany({ where: { studentId: { in: pks } } });
  await prisma.studentEmail.deleteMany({ where: { studentId: { in: pks } } });
  await prisma.studentCoop.deleteMany({ where: { studentId: { in: pks } } });
  await prisma.student.deleteMany({ where: { id: { in: pks } } });
  const companyIds = (await prisma.company.findMany({ where: { OR: [{ createdById: { in: userIds } }, { name: { contains: 'จำลอง' } }] }, select: { id: true } })).map((c) => c.id);
  await prisma.mentor.deleteMany({ where: { OR: [{ companyId: { in: companyIds } }, { createdById: { in: userIds } }] } });
  await prisma.companyContact.deleteMany({ where: { OR: [{ companyId: { in: companyIds } }, { createdById: { in: userIds } }] } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  await prisma.announcement.deleteMany({ where: { authorId: { in: userIds } } });
  await prisma.feedback.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.coopTeacherMajor.deleteMany({ where: { OR: [{ teacherId: { in: teachers } }, { major: { startsWith: 'SIM' } }] } });
  await prisma.teacher.deleteMany({ where: { id: { in: teachers } } });
  await prisma.staffProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  const st = readState();
  await prisma.coopPeriodMajor.deleteMany({ where: { major: { startsWith: 'SIM' } } });
  await prisma.coopPeriod.deleteMany({ where: { id: { in: st.periodIds } } });
  writeState({ periodIds: [] });
  await prisma.documentRequirementMajor.deleteMany({ where: { major: { startsWith: 'SIM' } } });
  await prisma.systemConfig.deleteMany({ where: { key: { contains: '@SIM' } } });
  await prisma.coopCriteria.deleteMany({ where: { major: { startsWith: 'SIM' } } });
  await prisma.docNumberLock.deleteMany({ where: { number: { in: [...numbers] } } });
  let removed = 0;
  for (const f of files) {
    const full = path.resolve(UPLOADS, String(f).replace(/^\/?uploads\//, ''));
    if (full.startsWith(UPLOADS + path.sep)) { try { fs.unlinkSync(full); removed++; } catch { /* ไม่มีไฟล์ */ } }
  }
  return { users: userIds.length, students: pks.length, files: removed };
}

async function freeAcademicYear() {
  const thisYear = new Date().getFullYear() + 543;
  for (let y = thisYear + 40; y < thisYear + 80; y++) {
    if (!(await prisma.coopPeriod.findFirst({ where: { academicYear: String(y) } }))) return String(y);
  }
  throw new Error('หาปีการศึกษาว่างไม่ได้');
}

// เลขที่หนังสือจำลอง 8xxxx — ข้ามเลขที่มีในระบบแล้ว
let docSeq = 80000;
const usedNumbers = new Set();
async function loadUsedNumbers() {
  for (const r of await prisma.docNumberLock.findMany({ select: { number: true } })) usedNumbers.add(r.number);
}
function nextDocNo() {
  for (;;) { const n = `660301.26.6.2/${++docSeq}`; if (!usedNumbers.has(n)) { usedNumbers.add(n); return n; } }
}

module.exports = { call, get, form, pdf, signin, pool, record, check, startPhase, day, cleanup };

// ═════════════ ตัวละคร ═════════════
const W = {
  staff: [], // { email, token, userId }
  majors: {}, // code → { coop: {email, token, pk}, advisors: [{email, token, pk, name}], students: [] }
  companies: [], // { id, name, contactIds }
  periodId: null,
  students: [], // { mi, j, code, email, studentId, token, pk, coopId, plan }
};

async function main() {
  const t0 = Date.now();
  if (process.argv.includes('--cleanup')) {
    const r = await cleanup();
    console.log(`ลบข้อมูลจำลองแล้ว: ผู้ใช้ ${r.users} · นักศึกษา ${r.students} · ไฟล์ ${r.files}`);
    return;
  }
  const up = await fetch(API + '/api/auth/me').then((r) => r.status).catch(() => 0);
  if (!up) { console.error(`backend ไม่ตอบที่ ${API} — เปิด backend ก่อน (cd backend && npm run dev)`); process.exit(1); }

  const old = await cleanup();
  console.log(`ล้างข้อมูลจำลองเดิม: ผู้ใช้ ${old.users} · นักศึกษา ${old.students}`);
  await loadUsedNumbers();

  await require('./simulate_phases').run(W, { prisma, bcrypt, XLSX, PW, MAJORS, PER_MAJOR, FIRST, COMPANIES, nextDocNo, readState, writeState, freeAcademicYear, state: () => phase });

  // ═════════════ สรุป ═════════════
  const secs = Math.round((Date.now() - t0) / 1000);
  const total = results.length;
  const failed = results.filter((r) => !r.ok).length;
  console.log('\n══════════ สรุป ══════════');
  for (const [p, c] of Object.entries(counts)) console.log(`${c.fail ? '✗' : '✓'} ${p.padEnd(42)} ผ่าน ${c.pass}${c.fail ? ` · ไม่ผ่าน ${c.fail}` : ''}`);
  console.log(`\nตรวจ ${total} จุด · ไม่ผ่าน ${failed} · เรียก API ${requestCount} ครั้ง · 5xx ${serverErrors.length} ครั้ง · ${secs} วินาที`);
  fs.writeFileSync(REPORT, JSON.stringify({ at: new Date().toISOString(), seconds: secs, requests: requestCount, counts, bugs, serverErrors }, null, 2));
  console.log(`รายละเอียด: ${REPORT}`);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
