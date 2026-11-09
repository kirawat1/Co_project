// scripts/er_diagram.js
// สร้างแผนภาพฐานข้อมูล (ER diagram) แบบ Mermaid จาก prisma/schema.prisma → docs/design/er-diagram.md
// GitHub / VS Code (ส่วนขยาย Mermaid) แสดงเป็นรูปให้เอง · แก้ schema แล้วรันใหม่ได้ทุกครั้ง
//
// Usage (ในโฟลเดอร์ backend):
//   node scripts/er_diagram.js            เขียนไฟล์
//   node scripts/er_diagram.js --stdout   พิมพ์ออกหน้าจอ (ไม่เขียนไฟล์)

const fs = require('fs');
const path = require('path');

const SCHEMA = path.join(__dirname, '../prisma/schema.prisma');
const OUT = path.join(__dirname, '../../docs/design/er-diagram.md');

function parseSchema(src) {
  const enums = new Set([...src.matchAll(/^enum (\w+) \{/gm)].map((m) => m[1]));
  const models = [];
  for (const m of src.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const name = m[1];
    const fields = [];
    const fkNames = new Set();
    let compositeId = [];
    for (const raw of m[2].split(/\r?\n/)) {
      const line = raw.replace(/\/\/.*$/, '').trim();
      if (!line) continue;
      if (line.startsWith('@@id')) {
        compositeId = (line.match(/\[([^\]]+)\]/) || [, ''])[1].split(',').map((s) => s.trim());
        continue;
      }
      if (line.startsWith('@@')) continue;
      const [fname, ftype, ...rest] = line.split(/\s+/);
      if (!ftype) continue;
      const attrs = rest.join(' ');
      const base = ftype.replace(/[?\[\]]/g, '');
      const relFields = (attrs.match(/@relation\([^)]*fields:\s*\[([^\]]+)\]/) || [, ''])[1]
        .split(',').map((s) => s.trim()).filter(Boolean);
      relFields.forEach((f) => fkNames.add(f));
      fields.push({
        name: fname,
        type: base,
        list: ftype.endsWith('[]'),
        optional: ftype.endsWith('?'),
        id: /@id\b/.test(attrs),
        unique: /@unique\b/.test(attrs),
        relFields,
      });
    }
    models.push({ name, fields, fkNames, compositeId });
  }
  return { enums, models };
}

function buildMermaid({ enums, models }, { withAttributes }) {
  const modelNames = new Set(models.map((m) => m.name));
  const byName = Object.fromEntries(models.map((m) => [m.name, m]));
  const lines = ['erDiagram'];

  if (withAttributes) {
    for (const m of models) {
      lines.push(`  ${m.name} {`);
      for (const f of m.fields) {
        if (modelNames.has(f.type)) continue; // ฟิลด์ความสัมพันธ์ แสดงเป็นเส้นแทน
        const keys = [];
        if (f.id || m.compositeId.includes(f.name)) keys.push('PK');
        if (m.fkNames.has(f.name)) keys.push('FK');
        if (f.unique && !keys.includes('PK')) keys.push('UK');
        const type = enums.has(f.type) ? `enum_${f.type}` : f.type;
        lines.push(`    ${type} ${f.name}${keys.length ? ' ' + keys.join(',') : ''}`);
      }
      lines.push('  }');
    }
  }

  const seenM2M = new Set();
  for (const m of models) {
    for (const f of m.fields) {
      if (!modelNames.has(f.type)) continue;
      if (f.relFields.length) {
        // m ถือ foreign key → หลายแถวของ m ชี้ไปหนึ่งแถวของ f.type (หรือหนึ่งต่อหนึ่ง ถ้า FK เป็น unique)
        const fkUnique = f.relFields.length === 1 && m.fields.some((x) => x.name === f.relFields[0] && (x.unique || x.id));
        const parentSide = f.optional ? '|o' : '||';
        const childSide = fkUnique ? 'o|' : 'o{';
        lines.push(`  ${f.type} ${parentSide}--${childSide} ${m.name} : "${f.name}"`);
      } else if (f.list) {
        // many-to-many แบบไม่มีตารางกลางใน schema (Prisma สร้างตาราง _A_To_B ให้เอง)
        const other = byName[f.type];
        const back = other && other.fields.find((x) => x.type === m.name && x.list && !x.relFields.length);
        if (back) {
          const key = [m.name, f.type].sort().join('|');
          if (!seenM2M.has(key)) {
            seenM2M.add(key);
            lines.push(`  ${m.name} }o--o{ ${f.type} : "${f.name}"`);
          }
        }
      }
    }
  }
  return lines.join('\n');
}

function render() {
  const parsed = parseSchema(fs.readFileSync(SCHEMA, 'utf8'));
  const overview = buildMermaid(parsed, { withAttributes: false });
  const full = buildMermaid(parsed, { withAttributes: true });
  return `# แผนภาพฐานข้อมูล (ER Diagram)

> สร้างอัตโนมัติจาก \`backend/prisma/schema.prisma\` ด้วย \`node backend/scripts/er_diagram.js\` — อย่าแก้ไฟล์นี้ด้วยมือ
> ${parsed.models.length} ตาราง · ${parsed.enums.size} enum

สัญลักษณ์เส้น (crow's foot): \`||\` = หนึ่งเสมอ · \`|o\` = ศูนย์หรือหนึ่ง · \`o{\` = ศูนย์หรือหลาย · \`}o--o{\` = หลายต่อหลาย
ป้ายบนเส้น = ชื่อฟิลด์ความสัมพันธ์ฝั่งตารางที่ถือ foreign key · PK = primary key · FK = foreign key · UK = unique

## ภาพรวมความสัมพันธ์

\`\`\`mermaid
${overview}
\`\`\`

## รายละเอียดคอลัมน์

\`\`\`mermaid
${full}
\`\`\`
`;
}

if (require.main === module) {
  const md = render();
  if (process.argv.includes('--stdout')) process.stdout.write(md);
  else {
    fs.writeFileSync(OUT, md);
    console.log(`เขียน ${path.relative(process.cwd(), OUT)} แล้ว`);
  }
}

module.exports = { parseSchema, buildMermaid, render };
