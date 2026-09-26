const { stripComments } = require('./helpers/sourceScan');

describe('stripComments — ตัดเฉพาะคอมเมนต์จริง', () => {
  test('"/*" ในสตริง (accept="image/*") ไม่ถูกนับเป็นคอมเมนต์ — โค้ดหลังจากนั้นต้องยังอยู่', () => {
    const src = '<input accept="image/*" />\n<span>สาขา</span>\n<p>alert("x")</p> */';
    const out = stripComments(src);
    expect(out).toContain('สาขา');
    expect(out).toContain('alert(');
  });

  test('ตัดคอมเมนต์ทุกแบบ: // บรรทัด, /* บล็อก */, {/* JSX */}', () => {
    const out = stripComments('a // สาขา\n/* สาขา\nสาขา */ b\n{/* สาขา */} c');
    expect(out).not.toContain('สาขา');
    expect(out).toContain('a');
    expect(out).toContain('b');
    expect(out).toContain('c');
  });

  test('คงจำนวนบรรทัดเดิม (เลขบรรทัดที่เทสต์รายงานต้องตรงไฟล์จริง)', () => {
    const src = 'x\n/* 1\n2\n3 */\ny';
    expect(stripComments(src).split('\n')).toHaveLength(5);
    expect(stripComments(src).split('\n')[4]).toBe('y');
  });

  test('URL ในสตริง และ // ในสตริง ไม่ถูกตัด', () => {
    const out = stripComments('const u = "https://coop.kku.ac.th/x"; const t = \'a // สาขา\';');
    expect(out).toContain('https://coop.kku.ac.th/x');
    expect(out).toContain('a // สาขา');
  });

  test('template literal หลายบรรทัดที่มี /* อยู่ข้างใน ไม่ถูกตัด', () => {
    const out = stripComments('const s = `ไฟล์ *.pdf /* \nสาขา`;\nconst z = 1;');
    expect(out).toContain('สาขา');
    expect(out).toContain('const z = 1;');
  });
});
