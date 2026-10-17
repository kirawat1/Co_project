// __tests__/timezone.test.js — เวลาไทยทั้งระบบ ไม่ขึ้นกับ timezone ของเครื่อง (VM ที่ตั้ง UTC เคยทำให้คลาด 7 ชั่วโมง)
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKEND = path.join(__dirname, '..');
// รันใน process ใหม่ที่ตั้ง TZ=UTC (เหมือน VM/cloud ทั่วไป) แล้วโหลด config/timezone
const inUtcProcess = (code) => execFileSync(process.execPath, ['-e', `require('./config/timezone'); ${code}`], {
  cwd: BACKEND, env: { ...process.env, TZ: 'UTC' }, encoding: 'utf8',
}).trim();

test('เครื่องตั้ง UTC → นัด 13:30 เวลาไทยยังเป็นบ่าย · วันปิดรับสมัครปิด 23:59 เวลาไทย', () => {
  const out = inUtcProcess(`
    const appt = new Date('2026-10-17T06:30:00Z');
    const close = new Date('2026-10-20T00:00:00Z'); close.setHours(23, 59, 59, 999);
    console.log(JSON.stringify({ hour: appt.getHours(), close: close.toISOString() }));
  `);
  expect(JSON.parse(out)).toEqual({ hour: 13, close: '2026-10-20T16:59:59.999Z' });
});

test('server.js โหลด config/timezone เป็นอย่างแรก (ก่อนโมดูลไหนสร้าง Date)', () => {
  const firstRequire = fs.readFileSync(path.join(BACKEND, 'server.js'), 'utf8').match(/require\(["'][^"']+["']\)/)[0];
  expect(firstRequire).toBe('require("./config/timezone")');
});
