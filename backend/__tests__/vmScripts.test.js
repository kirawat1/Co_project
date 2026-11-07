// __tests__/vmScripts.test.js — สคริปต์ PowerShell บน VM (docs/*.ps1)
// Windows PowerShell 5.1 อ่านไฟล์ที่ไม่มี BOM เป็น ANSI → ภาษาไทย/ขีดยาว (—) ทำให้สตริงขาดแล้วทั้งไฟล์ parse ไม่ผ่าน
// (เจอจริง 2026-11-07: setup-vm.ps1 พัง 11 จุด, install-vm.ps1 1 จุด — ติดตั้ง VM ใหม่จะรันไม่ได้)
const fs = require('fs');
const path = require('path');

const DOCS = path.join(__dirname, '../../docs');
const scripts = fs.readdirSync(DOCS).filter((f) => f.endsWith('.ps1'));

test('มีสคริปต์ให้ตรวจ', () => {
  expect(scripts).toEqual(expect.arrayContaining(['deploy.ps1', 'register-backup-task.ps1', 'network-keepalive.ps1']));
});

test.each(scripts)('%s เป็นตัวอักษร ASCII ล้วน', (name) => {
  const lines = fs.readFileSync(path.join(DOCS, name), 'utf8').split(/\r?\n/);
  const bad = lines.map((l, i) => [i + 1, l]).filter(([, l]) => /[^\x00-\x7F]/.test(l)).map(([n, l]) => `${n}: ${l.slice(0, 80)}`);
  expect(bad).toEqual([]);
});

// เหตุการณ์จริง: deploy ไม่ได้สั่ง prisma generate → Prisma Client เก่า → เข้าสู่ระบบ 500 หลังเปลี่ยน schema
test('deploy.ps1 ครบขั้นสำคัญ ตามลำดับ: git pull → prisma generate → migrate deploy → restart backend', () => {
  const src = fs.readFileSync(path.join(DOCS, 'deploy.ps1'), 'utf8');
  const at = (s) => src.indexOf(s);
  const steps = ['git pull origin main', 'npx prisma generate', 'npx prisma migrate deploy', 'pm2 restart coop-backend'];
  for (const s of steps) expect(at(s)).toBeGreaterThan(-1);
  const order = steps.map(at);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
});
