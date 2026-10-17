// __tests__/backup.test.js — ส่วนที่ไม่ต้องใช้ MySQL ของ scripts/backup.js (dump/กู้จริงทดสอบด้วย --verify)
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { parseDatabaseUrl, selectExpired, stamp, syncDir, scanDump, DUMP_RE } = require('../scripts/backup');

describe('parseDatabaseUrl', () => {
  test('แยก user/รหัส/host/port/ฐาน — รหัสที่มีอักขระพิเศษถูก decode', () => {
    expect(parseDatabaseUrl('mysql://coop:p%40ss%3Aw0rd@127.0.0.1:3307/coop_db?connection_limit=5')).toEqual({
      user: 'coop', password: 'p@ss:w0rd', host: '127.0.0.1', port: '3307', database: 'coop_db',
    });
  });
  test('ไม่มี port → 3306 · ไม่มีรหัส → ว่าง', () => {
    expect(parseDatabaseUrl('mysql://root@localhost/coop_db')).toMatchObject({ port: '3306', password: '' });
  });
  test('ไม่ใช่ mysql / ไม่มีชื่อฐาน → error', () => {
    expect(() => parseDatabaseUrl('postgres://u@h/db')).toThrow();
    expect(() => parseDatabaseUrl('mysql://u@h/')).toThrow();
  });
});

describe('selectExpired — ลบ dump เก่า', () => {
  const now = new Date(2026, 9, 17, 2, 0);
  const day = (d) => `coop_db-202610${String(d).padStart(2, '0')}-0200.sql.gz`;

  test('เก่ากว่า 14 วันถูกลบ · ใหม่กว่าเก็บไว้ · ไฟล์อื่นไม่ยุ่ง', () => {
    const files = [day(1), day(2), day(3), day(4), day(10), day(16), day(17), 'backup.log', 'note.sql.gz'];
    expect(selectExpired(files, now, 14).sort()).toEqual([day(1), day(2)]);
  });

  test('สำรองล้มมาหลายวัน (เหลือแต่ไฟล์เก่า) → เก็บ 3 ไฟล์ล่าสุดไว้เสมอ ไม่ลบหมด', () => {
    const files = [day(1), day(2), day(3), day(4)].map((f) => f.replace('202610', '202609'));
    expect(selectExpired(files, now, 14)).toEqual([files[0]]);
  });

  test('ชื่อไฟล์ตรงกับที่ stamp() สร้าง', () => {
    expect(DUMP_RE.test(`coop_db-${stamp(now)}.sql.gz`)).toBe(true);
    expect(stamp(now)).toBe('20261017-0200');
  });
});

describe('syncDir — สำรองไฟล์อัปโหลด', () => {
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'coop-sync-')); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('คัดลอกครั้งแรกทั้งหมด · ครั้งต่อไปเฉพาะไฟล์ใหม่/เปลี่ยน · ไฟล์ที่ถูกลบจากระบบยังอยู่ในที่สำรอง', () => {
    const src = path.join(root, 'src'), dest = path.join(root, 'dest');
    fs.mkdirSync(path.join(src, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(src, 'a.pdf'), 'A');
    fs.writeFileSync(path.join(src, 'docs', 'b.pdf'), 'BB');
    expect(syncDir(src, dest)).toMatchObject({ copied: 2, total: 2 });
    expect(syncDir(src, dest)).toMatchObject({ copied: 0, total: 2 });

    fs.writeFileSync(path.join(src, 'docs', 'b.pdf'), 'BBB'); // แก้ไฟล์ (ขนาดเปลี่ยน)
    fs.writeFileSync(path.join(src, 'c.pdf'), 'C');
    fs.rmSync(path.join(src, 'a.pdf'));
    expect(syncDir(src, dest)).toMatchObject({ copied: 2, total: 2 });
    expect(fs.readFileSync(path.join(dest, 'docs', 'b.pdf'), 'utf8')).toBe('BBB');
    expect(fs.existsSync(path.join(dest, 'a.pdf'))).toBe(true);
  });

  test('ไม่มีโฟลเดอร์ต้นทาง → ไม่ error', () => {
    expect(syncDir(path.join(root, 'none'), path.join(root, 'dest'))).toEqual({ copied: 0, bytes: 0, total: 0 });
  });
});

describe('scanDump — ตรวจไฟล์สำรองโดยไม่ต้องสร้างฐานชั่วคราว (บัญชีสิทธิ์ฐานเดียว)', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coop-scan-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  const write = (name, sql) => { const f = path.join(dir, name); fs.writeFileSync(f, zlib.gzipSync(sql)); return f; };

  test('นับแถวถูกแม้ข้อความมีวงเล็บ/คอมมา/เครื่องหมายคำพูด · ตารางว่างก็นับ · รู้ว่าไฟล์จบครบ', async () => {
    const f = write('ok.sql.gz', [
      'CREATE TABLE `student` (id int);',
      // mysqldump escape ' ในข้อความเป็น \' — ),( ในข้อความต้องไม่ถูกนับเป็นแถวใหม่
      "INSERT INTO `student` VALUES (1,'สมชาย (ชาย)'),(2,'it\\'s ),( ok'),(3,NULL);",
      "INSERT INTO `student` VALUES (4,'x');",
      'CREATE TABLE `visit` (id int);',
      '-- Dump completed on 2026-10-17 22:03:54',
    ].join('\n'));
    expect(await scanDump(f)).toEqual({ tables: { student: 4, visit: 0 }, completed: true });
  });

  test('ไม่มีบรรทัด Dump completed → completed=false · ไฟล์ถูกตัดกลางทาง → error', async () => {
    const f = write('nocomplete.sql.gz', 'CREATE TABLE `a` (id int);\n');
    expect((await scanDump(f)).completed).toBe(false);
    const cut = path.join(dir, 'cut.sql.gz');
    const full = zlib.gzipSync(require('crypto').randomBytes(50000).toString('hex')); // สุ่ม = บีบอัดไม่ลง ไฟล์ใหญ่พอให้ตัด
    fs.writeFileSync(cut, full.subarray(0, full.length / 2));
    await expect(scanDump(cut)).rejects.toThrow();
  });
});
