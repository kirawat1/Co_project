// __tests__/backup.test.js — ส่วนที่ไม่ต้องใช้ MySQL ของ scripts/backup.js (dump/กู้จริงทดสอบด้วย --verify)
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { parseDatabaseUrl, selectExpired, stamp, syncDir, scanDump, DUMP_RE, uploadRel, checkUploads, checkMirror, UPLOAD_REFS } = require('../scripts/backup');

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

describe('uploadRel — ค่าในฐาน → path ใต้ uploads/', () => {
  test('รูปแบบที่พบจริง: ชื่อไฟล์ · /uploads/... · โฟลเดอร์ย่อย · ไฟล์ระบบ/หนังสือนิเทศเก็บแค่ชื่อ', () => {
    expect(uploadRel('1778700898067-236109591.pdf')).toBe('1778700898067-236109591.pdf');
    expect(uploadRel('/uploads/manual-test2/acceptance.pdf')).toBe('manual-test2/acceptance.pdf');
    expect(uploadRel('mock/CV.pdf')).toBe('mock/CV.pdf');
    expect(uploadRel('KRUT_1768771183663.png', 'system')).toBe('system/KRUT_1768771183663.png');
    expect(uploadRel('SUPERVISION_LETTER_1.pdf', 'supervision')).toBe('supervision/SUPERVISION_LETTER_1.pdf');
  });
  test('ลิงก์ภายนอก (ใบเกรด Google Sheets) · ค่าว่าง · ย้อนโฟลเดอร์ = ไม่นับ', () => {
    for (const v of ['https://docs.google.com/spreadsheets/d/x', 'data:image/png;base64,AA', '', '   ', null, '../../.env', 'a/../../b']) {
      expect(uploadRel(v)).toBeNull();
    }
  });
  test('ครอบทุกตารางที่ uploadsGuard รู้จัก (ไฟล์ใหม่ต้องเพิ่มที่นี่ด้วย)', () => {
    const cols = UPLOAD_REFS.map(([m, f]) => `${m}.${f}`);
    expect(cols).toEqual(expect.arrayContaining(['document.path', 'studentCoop.reqLetterUrl', 'studentCoop.placeLetterUrl', 'studentCoop.acceptanceFileUrl',
      'coopApplicationForm.photoPath', 'annFile.path', 'feedback.imagePath', 'systemAsset.path', 'supervisionAppointment.officialLetterPath']));
  });
});

describe('checkUploads / checkMirror — ที่สำรองมีไฟล์ที่ฐานอ้างถึงครบไหม', () => {
  let root, live, cfg, lines, log;
  const put = (dir, rel) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), 'x'); };
  const db = (rows) => new Proxy({}, { get: (_, model) => ({ findMany: async ({ select }) => (rows[model] || []).map((v) => ({ [Object.keys(select)[0]]: v })) }) });
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'chkup-'));
    live = path.join(root, 'live');
    cfg = { dir: path.join(root, 'bak'), mirror: null };
    lines = []; log = (m) => lines.push(m);
    process.exitCode = 0;
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); process.exitCode = 0; });

  test('ครบ → OK · ไฟล์ที่หายจากระบบอยู่แล้วแค่เตือน (ไม่ทำให้ล้ม) · ลิงก์ภายนอกไม่นับ', async () => {
    for (const r of ['a.pdf', 'system/KRUT_1.png', 'supervision/S_1.pdf']) { put(live, r); put(path.join(cfg.dir, 'uploads'), r); }
    const res = await checkUploads(cfg, log, db({ document: ['a.pdf', 'gone.pdf'], systemAsset: ['KRUT_1.png'], supervisionAppointment: ['S_1.pdf'], coopApplicationForm: ['https://docs.google.com/x'] }), live);
    expect(res).toEqual({ refs: 4, live: 3, goneLive: 1, ok: true });
    expect(lines.join('\n')).toMatch(/\[OK\] ไฟล์อัปโหลดในที่สำรองครบ 3/);
    expect(lines.join('\n')).toMatch(/\[WARN\].*1 ไฟล์.*gone\.pdf/);
    expect(process.exitCode).toBe(0);
  });

  test('ไฟล์อยู่ในระบบแต่ไม่อยู่ในที่สำรอง/สำเนาที่สอง → ERR + exit 1', async () => {
    cfg.mirror = path.join(root, 'mirror');
    put(live, 'a.pdf'); put(live, 'b.pdf');
    put(path.join(cfg.dir, 'uploads'), 'a.pdf'); put(path.join(cfg.dir, 'uploads'), 'b.pdf');
    put(path.join(cfg.mirror, 'uploads'), 'a.pdf');
    const res = await checkUploads(cfg, log, db({ document: ['a.pdf', 'b.pdf'] }), live);
    expect(res.ok).toBe(false);
    expect(lines.join('\n')).toMatch(/\[OK\] ไฟล์อัปโหลดในที่สำรองครบ 2/);
    expect(lines.join('\n')).toMatch(/\[ERR\] ไฟล์อัปโหลดในสำเนาที่สองไม่ครบ: ขาด 1 จาก 2.*b\.pdf/);
    expect(process.exitCode).toBe(1);
  });

  test('checkMirror: ไม่ได้ตั้ง = เตือน · ตั้งแล้วไม่มี dump ล่าสุด = ERR · มี = OK', () => {
    checkMirror(cfg, log, '/x/coop_db-20261108-0200.sql.gz');
    expect(lines.pop()).toMatch(/\[WARN\] ยังไม่ได้ตั้ง BACKUP_MIRROR_DIR/);
    expect(process.exitCode).toBe(0);
    cfg.mirror = path.join(root, 'mirror');
    checkMirror(cfg, log, '/x/coop_db-20261108-0200.sql.gz');
    expect(lines.pop()).toMatch(/\[ERR\]/);
    expect(process.exitCode).toBe(1);
    put(path.join(cfg.mirror, 'db'), 'coop_db-20261108-0200.sql.gz');
    process.exitCode = 0;
    checkMirror(cfg, log, '/x/coop_db-20261108-0200.sql.gz');
    expect(lines.pop()).toMatch(/\[OK\]/);
  });
});
