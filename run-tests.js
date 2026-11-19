#!/usr/bin/env node
// รันทดสอบทั้งระบบ — เลือกได้ว่าจะรันชุดไหน
//
//   node run-tests.js            เมนูให้เลือก (พิมพ์เลข เช่น 1 3 5 หรือ a = ทั้งหมด)
//   node run-tests.js 1 3        รันชุดที่ 1 และ 3 เลย ไม่ถามเมนู
//   node run-tests.js quick      ชุดเร็ว ไม่ต้องใช้ฐานข้อมูล (1–4)
//   node run-tests.js e2e        ชุดที่ใช้ backend + ฐานข้อมูลจริงทั้งหมด (5–10)
//   node run-tests.js all        ทุกชุด
//   node run-tests.js --list     แสดงรายการชุดทดสอบแล้วจบ
//
// ชุด E2E (5–10) สร้างข้อมูลทดสอบในฐานข้อมูลตาม backend/.env แล้วลบทิ้งเอง
//   → ใช้กับเครื่องพัฒนาเท่านั้น สคริปต์จะไม่ยอมรันถ้า backend/.env ตั้ง NODE_ENV=production
//   → ถ้า backend (port 5000) ยังไม่เปิด สคริปต์จะเปิดให้ชั่วคราวแล้วปิดเมื่อจบ
//   → frontend (port 5173) Playwright เปิดให้เอง
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const readline = require('readline');

const ROOT = __dirname;
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'Frontend');
const TESTS = path.join(FRONTEND, 'tests');

const UNIT_SPECS = ['announcementYears', 'bangkokDate', 'bulkLetters', 'buttonStyles', 'deadlines', 'internshipForms', 'letterLayout',
  'letterRecipient', 'letterUtils', 'reviewStudents', 'studentSteps'];
const MOCK_UI_SPECS = ['admin', 'admin.interaction', 'student', 'student.interaction', 'teacher', 'ux-fixes'];
const spec = (names) => names.map((n) => `tests/${n}.spec.ts`);
const pw = (names, extra = '') => `npx playwright test ${spec(names).join(' ')}${extra}`;

// e2e: true = ต้องมี backend + ฐานข้อมูล · specs = ไฟล์ใน Frontend/tests (ใช้ตรวจว่าไม่มีไฟล์ตกหล่น)
const SUITES = [
  { name: 'Backend (Jest) — API, สิทธิ์, กติกาทุก controller', time: '~2 นาที', cwd: BACKEND, cmd: 'npm test' },
  { name: 'Frontend — ตรวจชนิดข้อมูล (TypeScript) + lint', time: '~1 นาที', cwd: FRONTEND, cmd: 'npx tsc -b && npm run lint' },
  { name: 'Frontend — ฟังก์ชันล้วน (ไม่เปิดเบราว์เซอร์)', time: '<1 นาที', cwd: FRONTEND,
    cmd: pw(UNIT_SPECS, ' --config=playwright.unit.config.ts'), specs: UNIT_SPECS },
  { name: 'หน้าเว็บ + API จำลอง (เปิดเบราว์เซอร์ ไม่ใช้ฐานข้อมูล)', time: '~2 นาที', cwd: FRONTEND,
    cmd: pw(MOCK_UI_SPECS), specs: MOCK_UI_SPECS },
  { name: 'E2E นักศึกษา — สมัคร, T000, แบบฟอร์ม, ขั้นตอนตลอดเส้นทาง', time: '~4 นาที', cwd: FRONTEND, e2e: true,
    specs: ['fixture-smoke', 'coop-lifecycle.e2e', 'workflow.e2e', 'application.e2e', 't000.e2e', 'forms.e2e', 'studentlife.e2e'] },
  { name: 'E2E หนังสือ — ขอความอนุเคราะห์, ส่งตัว, ขอนิเทศ, ไฟล์ PDF/Word', time: '~2 นาที', cwd: FRONTEND, e2e: true,
    specs: ['letters.e2e', 'docsamples.e2e'] },
  { name: 'E2E ฝึกงาน/นิเทศ — T002/T003, นัดนิเทศ, หลายคนพร้อมกัน', time: '~6 นาที', cwd: FRONTEND, e2e: true,
    specs: ['intern.e2e', 'supervision.e2e', 'supervisionMulti.e2e'] },
  { name: 'E2E เจ้าหน้าที่ — นักศึกษา, อาจารย์, รอบ, บริษัท, ตั้งค่า', time: '~5 นาที', cwd: FRONTEND, e2e: true,
    specs: ['admin.e2e', 'studentadmin.e2e', 'people.e2e', 'rounds.e2e', 'company.e2e', 'system.e2e',
      'backlog-features.api', 'hr-contacts-race.e2e'] },
  { name: 'E2E ความปลอดภัย — สิทธิ์เข้าถึง, ข้อมูลคนอื่น, กดซ้ำพร้อมกัน', time: '~2 นาที', cwd: FRONTEND, e2e: true,
    specs: ['access.e2e', 'idor.e2e', 'security.e2e', 'race.e2e'] },
  { name: 'E2E ช้า — งานตั้งเวลา + ไล่กดทุกปุ่มทุกหน้า', time: '~5 นาที', cwd: FRONTEND, e2e: true,
    specs: ['scheduler.e2e', 'buttons.e2e'] },
];
for (const s of SUITES) if (s.e2e) s.cmd = pw(s.specs);

const PRESETS = { quick: [1, 2, 3, 4], e2e: [5, 6, 7, 8, 9, 10], all: SUITES.map((_, i) => i + 1), a: SUITES.map((_, i) => i + 1) };

function printList() {
  console.log('\nชุดทดสอบ:');
  SUITES.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s.name}  (${s.time})${s.e2e ? '  [ใช้ฐานข้อมูล]' : ''}`));
  console.log('\n  quick = 1–4 (ไม่ใช้ฐานข้อมูล) · e2e = 5–10 · a/all = ทั้งหมด');
  // ไฟล์ทดสอบใหม่ที่ยังไม่ได้ใส่ในชุดไหน — จะได้ไม่ถูกลืม
  const known = new Set(SUITES.flatMap((s) => s.specs || []).map((n) => `${n}.spec.ts`));
  const missing = fs.readdirSync(TESTS).filter((f) => f.endsWith('.spec.ts') && !known.has(f));
  if (missing.length) console.log(`\n  ⚠ ไฟล์ทดสอบที่ยังไม่อยู่ในชุดไหน (เพิ่มใน run-tests.js): ${missing.join(', ')}`);
}

function parseChoice(words) {
  const out = new Set();
  for (const w of words.flatMap((x) => String(x).split(/[\s,]+/)).filter(Boolean)) {
    const k = w.toLowerCase();
    if (PRESETS[k]) { PRESETS[k].forEach((n) => out.add(n)); continue; }
    const m = k.match(/^(\d+)-(\d+)$/);
    if (m) { for (let n = +m[1]; n <= +m[2]; n++) out.add(n); continue; }
    if (/^\d+$/.test(k)) { out.add(+k); continue; }
    throw new Error(`ไม่รู้จัก "${w}" — ใช้เลขชุด (1–${SUITES.length}), ช่วง เช่น 5-7, quick, e2e หรือ a`);
  }
  for (const n of out) if (n < 1 || n > SUITES.length) throw new Error(`ไม่มีชุดที่ ${n}`);
  return [...out].sort((a, b) => a - b);
}

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a); }));
}

function run(cmd, cwd) {
  return new Promise((res) => {
    const p = spawn(cmd, { cwd, shell: true, stdio: 'inherit' });
    p.on('exit', (code) => res(code ?? 1));
    p.on('error', () => res(1));
  });
}

const backendUp = () => new Promise((res) => {
  const req = http.get('http://localhost:5000/api/auth/me', (r) => { r.resume(); res(true); });
  req.on('error', () => res(false));
  req.setTimeout(3000, () => { req.destroy(); res(false); });
});

function backendEnv() {
  try {
    const dotenv = require(path.join(BACKEND, 'node_modules', 'dotenv'));
    return dotenv.parse(fs.readFileSync(path.join(BACKEND, '.env')));
  } catch { return null; }
}

async function startBackend() {
  console.log('\n==> backend ยังไม่เปิด — เปิดชั่วคราวที่ port 5000 ...');
  const p = spawn('node server.js', { cwd: BACKEND, shell: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  for (let i = 0; i < 60; i++) {
    if (await backendUp()) { console.log('    backend พร้อมแล้ว'); return p; }
    if (p.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  stopBackend(p);
  throw new Error(`เปิด backend ไม่สำเร็จ${err ? ':\n' + err.slice(-800) : ''}`);
}

function stopBackend(p) {
  if (!p || p.exitCode !== null) return;
  if (process.platform === 'win32') spawn('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
  else p.kill();
}

const fmt = (ms) => { const s = Math.round(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)} นาที ${s % 60} วิ` : `${s} วิ`; };

module.exports = { SUITES, parseChoice, backendUp, backendEnv, startBackend, stopBackend };
if (require.main === module) (async () => {
  const args = process.argv.slice(2);
  if (args.includes('--list') || args.includes('-l')) { printList(); return; }

  let picks;
  try {
    if (args.length) picks = parseChoice(args);
    else {
      printList();
      const a = await ask('\nเลือกชุดที่จะรัน (เช่น 1 3 5, 5-7, quick, a) แล้วกด Enter: ');
      picks = parseChoice([a]);
      if (!picks.length) { console.log('ไม่ได้เลือกอะไร — จบ'); return; }
    }
  } catch (e) { console.error(`\n${e.message}`); process.exitCode = 2; return; }

  let started = null;
  const results = [];
  try {
    if (picks.some((n) => SUITES[n - 1].e2e)) {
      const env = backendEnv();
      if (!env) throw new Error('อ่าน backend/.env ไม่ได้ — ชุด E2E ต้องใช้ค่าใน .env (JWT_SECRET, DATABASE_URL)');
      if ((env.NODE_ENV || '').toLowerCase() === 'production') {
        throw new Error('backend/.env ตั้ง NODE_ENV=production — ไม่รันชุด E2E เพราะจะสร้าง/ลบข้อมูลทดสอบในฐานข้อมูลจริง');
      }
      if (!(await backendUp())) started = await startBackend();
    }

    for (const n of picks) {
      const s = SUITES[n - 1];
      console.log(`\n${'='.repeat(70)}\n==> [${n}] ${s.name}\n    ${s.cmd}\n${'='.repeat(70)}`);
      const t0 = Date.now();
      const code = await run(s.cmd, s.cwd);
      results.push({ n, name: s.name, ok: code === 0, ms: Date.now() - t0 });
    }
  } catch (e) {
    console.error(`\n✗ ${e.message}`);
    process.exitCode = 1;
  } finally {
    stopBackend(started);
  }

  if (results.length) {
    console.log(`\n${'='.repeat(70)}\nสรุปผล`);
    for (const r of results) console.log(`  ${r.ok ? '✓ ผ่าน ' : '✗ ไม่ผ่าน'}  [${r.n}] ${r.name}  (${fmt(r.ms)})`);
    const failed = results.filter((r) => !r.ok);
    if (results.some((r) => SUITES[r.n - 1].specs && !SUITES[r.n - 1].cmd.includes('unit.config'))) {
      console.log('\n  รายงาน Playwright แบบละเอียด: cd Frontend && npx playwright show-report');
    }
    console.log(failed.length ? `\n✗ ไม่ผ่าน ${failed.length} จาก ${results.length} ชุด` : `\n✓ ผ่านทั้งหมด ${results.length} ชุด`);
    if (failed.length) process.exitCode = 1;
  }
})();
