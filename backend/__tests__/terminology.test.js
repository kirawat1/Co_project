/**
 * ชื่อเรียกมาตรฐาน: major = "หลักสูตร" · studyProgram = "รูปแบบการศึกษา"
 * กันคำเก่า (สาขา / ระบบการศึกษา / แผนการศึกษา / หลักสูตรการศึกษา) กลับมาในข้อความหน้าจอ
 * และกันหนังสือราชการ (utils/pdf*.ts) ถูกแก้ตาม — หนังสือใช้ถ้อยคำทางการของมหาวิทยาลัย
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'Frontend', 'src');
const COMPONENTS = path.join(SRC, 'components');
const hasFrontend = fs.existsSync(COMPONENTS);

// ตัดคอมเมนต์ (// … และ /* … */ รวม {/* … */} ใน JSX) — คอมเมนต์ในโค้ดพูดถึง "สาขา" ได้
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, '$1');
}

const OLD_TERMS = /สาขา|ระบบการศึกษา|แผนการศึกษา|หลักสูตรการศึกษา/;

(hasFrontend ? describe : describe.skip)('ชื่อเรียก หลักสูตร / รูปแบบการศึกษา', () => {
  test('หน้าเว็บ (components) ไม่ใช้คำเก่าในข้อความ', () => {
    const hits = [];
    for (const name of fs.readdirSync(COMPONENTS).filter((n) => n.endsWith('.tsx'))) {
      stripComments(fs.readFileSync(path.join(COMPONENTS, name), 'utf8')).split('\n').forEach((line, i) => {
        if (OLD_TERMS.test(line)) hits.push(`${name}:${i + 1}  ${line.trim().slice(0, 100)}`);
      });
    }
    expect(hits).toEqual([]);
  });

  test('หนังสือราชการยังใช้ถ้อยคำทางการเดิม (ไม่ถูกเปลี่ยนตาม)', () => {
    const read = (f) => fs.readFileSync(path.join(SRC, 'utils', f), 'utf8');
    expect(read('pdfGeneratorParentalConsent.ts')).toMatch(/หลักสูตร \$\{curriculum\} สาขาวิชา \$\{major\}/);
    expect(read('pdfSupervisionLetterGenerator.ts')).toMatch(/สาขาวิชาวิทยาการคอมพิวเตอร์/);
    expect(read('pdfGeneratorT000.ts')).toMatch(/drawText\("สาขาวิชา"/);
  });
});

test('ไฟล์ Excel ใช้หัวคอลัมน์ หลักสูตร / รูปแบบการศึกษา', () => {
  const { EXPORT_HEADERS } = require('../utils/studentExport');
  expect(EXPORT_HEADERS).toEqual(expect.arrayContaining(['หลักสูตร', 'รูปแบบการศึกษา']));
  expect(EXPORT_HEADERS.some((h) => OLD_TERMS.test(h))).toBe(false);
});
