/**
 * กันไม่ให้หน้าเว็บกลับไปใช้กล่องของเบราว์เซอร์ (alert / confirm / prompt)
 * มาตรฐานของระบบ: notify.* (ผลของการกดปุ่ม) และ askConfirm() (ถามก่อนทำสิ่งที่ย้อนไม่ได้)
 * จาก Frontend/src/utils/notify.ts — ดูเหตุผลในหัวไฟล์นั้น
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'Frontend', 'src');
const hasFrontend = fs.existsSync(SRC);

function listSources(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listSources(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

// ตัดคอมเมนต์ออกก่อนค้น — คำอธิบายในคอมเมนต์ที่พูดถึง alert() ไม่นับ
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, '$1');
}

(hasFrontend ? describe : describe.skip)('Frontend ไม่ใช้กล่องของเบราว์เซอร์', () => {
  const files = hasFrontend ? listSources(SRC) : [];

  test('ไม่มี alert( / confirm( / prompt( — ใช้ notify / askConfirm แทน', () => {
    const hits = [];
    for (const f of files) {
      const code = stripComments(fs.readFileSync(f, 'utf8'));
      code.split('\n').forEach((line, i) => {
        if (/(?<![\w.$])(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(line)) {
          hits.push(`${path.relative(SRC, f)}:${i + 1}  ${line.trim().slice(0, 100)}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  test('ToastProvider ถูกครอบทั้งแอป (ไม่งั้น notify/askConfirm ไม่แสดงผล)', () => {
    const main = fs.readFileSync(path.join(SRC, 'main.tsx'), 'utf8');
    expect(main).toMatch(/<ToastProvider>/);
  });
});
