/**
 * ชื่อเรียกมาตรฐาน: major = "หลักสูตร" · studyProgram = "รูปแบบการศึกษา"
 * กันคำเก่า (สาขา / ระบบการศึกษา / แผนการศึกษา / หลักสูตรการศึกษา) กลับมาในข้อความหน้าจอ
 * และกันหนังสือราชการ (utils/pdf*.ts) ถูกแก้ตาม — หนังสือใช้ถ้อยคำทางการของมหาวิทยาลัย
 */
const fs = require('fs');
const path = require('path');
const { stripComments } = require('./helpers/sourceScan'); // ตัดคอมเมนต์โดยรู้ว่าอยู่ในสตริงหรือไม่

const SRC = path.join(__dirname, '..', '..', 'Frontend', 'src');
const COMPONENTS = path.join(SRC, 'components');
const hasFrontend = fs.existsSync(COMPONENTS);

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
    // คำว่า "สาขาวิชา" (ถ้อยคำทางการ) ต้องคงอยู่ — แต่ชื่อหลักสูตรที่ตามหลังต้องเป็นค่าจริงของนักศึกษา (ตัวแปร)
    // ไม่ใช่ฮาร์ดโค้ด "วิทยาการคอมพิวเตอร์" ตรงๆ (บั๊กเดิม: นักศึกษาสาขาอื่น เช่น AI ก็ขึ้นว่า "วิทยาการคอมพิวเตอร์" ในหนังสือทุกฉบับ)
    const supervisionSrc = read('pdfSupervisionLetterGenerator.ts');
    expect(supervisionSrc).toMatch(/สาขาวิชา\$\{majorName\}/);
    expect(supervisionSrc).not.toMatch(/สาขาวิชาวิทยาการคอมพิวเตอร์/);
    expect(read('pdfGeneratorT000.ts')).toMatch(/drawText\("สาขาวิชา"/);
  });

  test('หนังสือส่งตัว/หนังสือขอนิเทศ (.docx) ไม่ฮาร์ดโค้ดชื่อหลักสูตร — ต้องดึงจากข้อมูลนักศึกษาจริง', () => {
    const read = (f) => fs.readFileSync(path.join(SRC, 'utils', f), 'utf8');
    const docGen = read('docGeneratorUtils.ts');
    expect(docGen).not.toMatch(/สาขาวิชาวิทยาการคอมพิวเตอร์/);
    expect(docGen).not.toMatch(/รับนักศึกษาหลักสูตรวิทยาการคอมพิวเตอร์/);
  });
});

test('ไฟล์ Excel ใช้หัวคอลัมน์ หลักสูตร / รูปแบบการศึกษา', () => {
  const { EXPORT_HEADERS } = require('../utils/studentExport');
  expect(EXPORT_HEADERS).toEqual(expect.arrayContaining(['หลักสูตร', 'รูปแบบการศึกษา']));
  expect(EXPORT_HEADERS.some((h) => OLD_TERMS.test(h))).toBe(false);
});
