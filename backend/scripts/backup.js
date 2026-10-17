#!/usr/bin/env node
// สำรองข้อมูลระบบ — ฐานข้อมูล (mysqldump → .sql.gz) + ไฟล์อัปโหลด (คัดลอกเพิ่ม ไม่ลบของเดิมในที่สำรอง)
// รันทุกคืนผ่าน Task Scheduler (ดู docs/backup.md · docs/register-backup-task.ps1)
//
//   node scripts/backup.js            สำรอง + ลบ dump เก่ากว่า BACKUP_KEEP_DAYS
//   node scripts/backup.js --verify   กู้ dump ล่าสุดลงฐานชั่วคราว เทียบจำนวนแถวทุกตารางกับฐานจริง แล้วลบฐานชั่วคราว
//   node scripts/backup.js --restore=<ไฟล์.sql.gz> --database=<ชื่อฐาน>   กู้ลงฐานที่ระบุ (ต้องไม่ใช่ฐานที่ใช้งานอยู่ เว้นแต่ใส่ --force)
//
// ตั้งค่าใน backend/.env (ไม่ใส่ก็ได้):
//   BACKUP_DIR=C:\coop-backups          ที่เก็บ (ต้องอยู่นอกโฟลเดอร์โปรเจกต์)
//   BACKUP_KEEP_DAYS=14                 เก็บ dump ย้อนหลังกี่วัน (เก็บอย่างน้อย 3 ไฟล์ล่าสุดเสมอ)
//   BACKUP_MIRROR_DIR=\\server\share    สำเนาที่สอง (ไดรฟ์อื่น/แชร์เครือข่าย) — กันเครื่อง VM เสียทั้งเครื่อง
//   MYSQLDUMP_PATH=...\mysqldump.exe    ถ้าหาเองไม่เจอ (โฟลเดอร์ mysql.exe ต้องอยู่ที่เดียวกัน)
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const { pipeline } = require('stream');

const BACKEND_DIR = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(BACKEND_DIR, 'uploads');
const DUMP_RE = /^(.+)-(\d{8})-(\d{4})\.sql\.gz$/;

/** mysql://user:pass@host:port/db?... → { user, password, host, port, database } */
function parseDatabaseUrl(url) {
  const u = new URL(url);
  if (!/^mysql/.test(u.protocol)) throw new Error('DATABASE_URL ไม่ใช่ mysql');
  const database = decodeURIComponent(u.pathname.replace(/^\//, ''));
  if (!database) throw new Error('DATABASE_URL ไม่มีชื่อฐานข้อมูล');
  return {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    host: u.hostname || 'localhost',
    port: u.port || '3306',
    database,
  };
}

/** ไฟล์ dump ที่ควรลบ: เก่ากว่า keepDays วัน แต่เก็บอย่างน้อย minKeep ไฟล์ล่าสุดเสมอ (กันกรณีสำรองล้มหลายวันแล้วลบหมด) */
function selectExpired(files, now, keepDays, minKeep = 3) {
  const dumps = files
    .map((name) => {
      const m = DUMP_RE.exec(name);
      if (!m) return null;
      const [, , d, t] = m;
      const at = new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), +t.slice(0, 2), +t.slice(2, 4));
      return { name, at };
    })
    .filter(Boolean)
    .sort((a, b) => b.at - a.at);
  const cutoff = now.getTime() - keepDays * 86400000;
  return dumps.slice(minKeep).filter((f) => f.at.getTime() < cutoff).map((f) => f.name);
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** หา mysqldump/mysql: MYSQLDUMP_PATH → MySQL Server ใน Program Files → PATH → XAMPP */
function findMysqlBin(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  if (process.env.MYSQLDUMP_PATH) {
    const p = path.join(path.dirname(process.env.MYSQLDUMP_PATH), exe);
    if (fs.existsSync(p)) return p;
  }
  // MySQL Server มาก่อน PATH: เครื่องที่มี XAMPP ด้วย PATH มักชี้ไป client ของ MariaDB ซึ่งต่อ MySQL 8 ไม่ได้
  // ("Plugin caching_sha2_password could not be loaded")
  const candidates = [];
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const mysqlRoot = path.join(pf, 'MySQL');
  if (fs.existsSync(mysqlRoot)) {
    for (const d of fs.readdirSync(mysqlRoot).filter((n) => /^MySQL Server/i.test(n)).sort().reverse()) {
      candidates.push(path.join(mysqlRoot, d, 'bin', exe));
    }
  }
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) candidates.push(which.stdout.split(/\r?\n/)[0].trim());
  candidates.push(path.join('C:\\xampp\\mysql\\bin', exe));
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error(`หา ${name} ไม่เจอ — ตั้ง MYSQLDUMP_PATH ใน .env`);
  return found;
}

/** รหัสผ่านไปทาง option file (ไม่โผล่ใน command line / process list) */
function withOptionFile(db, fn) {
  const file = path.join(os.tmpdir(), `coop-backup-${process.pid}-${Date.now()}.cnf`);
  const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  fs.writeFileSync(file, `[client]\nuser=${q(db.user)}\npassword=${q(db.password)}\nhost=${q(db.host)}\nport=${db.port}\n`, { mode: 0o600 });
  return Promise.resolve()
    .then(() => fn(file))
    .finally(() => fs.rmSync(file, { force: true }));
}

function run(bin, args, { input, output } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: [input ? 'pipe' : 'ignore', output ? 'pipe' : 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', reject);
    // input = สตรีมต่อกันเป็นทอด (อ่านไฟล์ → gunzip → …) — ทอดไหนพัง (ไฟล์เสีย) ต้อง reject ไม่ค้าง
    if (input) pipeline(...input, child.stdin, (err) => { if (err) { child.kill(); reject(err); } });
    let tail = '';
    if (output) {
      child.stdout.on('data', (c) => { tail = (tail + c.toString('utf8')).slice(-200); });
      child.stdout.pipe(output);
    }
    const done = new Promise((r) => (output ? output.on('finish', r) : r()));
    child.on('close', (code) => {
      done.then(() => (code === 0 ? resolve({ tail }) : reject(new Error(`${path.basename(bin)} exit ${code}: ${stderr.trim().slice(0, 500)}`))));
    });
  });
}

async function dumpDatabase(db, outFile) {
  const bin = findMysqlBin('mysqldump');
  const tmp = `${outFile}.part`;
  await withOptionFile(db, async (cnf) => {
    const gz = zlib.createGzip();
    const out = fs.createWriteStream(tmp);
    gz.pipe(out);
    const outClosed = new Promise((r) => out.on('close', r));
    const { tail } = await run(bin, [
      `--defaults-extra-file=${cnf}`,
      '--single-transaction', '--quick', '--routines', '--triggers', '--events',
      '--default-character-set=utf8mb4', '--no-tablespaces',
      '--databases', db.database,
    ], { output: gz });
    await outClosed;
    // mysqldump เขียนบรรทัดนี้เป็นบรรทัดสุดท้ายเมื่อ dump ครบ — ไม่มี = ไฟล์ถูกตัดกลางทาง
    if (!/-- Dump completed/.test(tail)) throw new Error('dump ไม่ครบ (ไม่มี "-- Dump completed")');
  });
  fs.renameSync(tmp, outFile);
  return fs.statSync(outFile).size;
}

/** คัดลอกไฟล์ที่ยังไม่มี/เปลี่ยนไป — ไม่ลบไฟล์ในที่สำรอง (ไฟล์ที่ถูกลบในระบบยังกู้ได้) */
function syncDir(src, dest) {
  let copied = 0, bytes = 0, total = 0;
  if (!fs.existsSync(src)) return { copied, bytes, total };
  const walk = (rel) => {
    for (const ent of fs.readdirSync(path.join(src, rel), { withFileTypes: true })) {
      const r = path.join(rel, ent.name);
      if (ent.isDirectory()) { walk(r); continue; }
      if (!ent.isFile()) continue;
      total++;
      const s = fs.statSync(path.join(src, r));
      const d = path.join(dest, r);
      let same = false;
      // utimes ปัดเศษเวลา → เผื่อ 2 วินาที (ไม่งั้นคัดลอกซ้ำทุกคืน)
      try { const t = fs.statSync(d); same = t.size === s.size && t.mtimeMs >= s.mtimeMs - 2000; } catch { /* ยังไม่มี */ }
      if (same) continue;
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(path.join(src, r), d);
      fs.utimesSync(d, s.atime, s.mtime);
      copied++; bytes += s.size;
    }
  };
  walk('');
  return { copied, bytes, total };
}

function prune(dir, keepDays) {
  if (!fs.existsSync(dir)) return [];
  const expired = selectExpired(fs.readdirSync(dir), new Date(), keepDays);
  for (const f of expired) fs.rmSync(path.join(dir, f), { force: true });
  return expired;
}

function latestDump(dir) {
  if (!fs.existsSync(dir)) return null;
  const all = fs.readdirSync(dir).filter((f) => DUMP_RE.test(f)).sort();
  return all.length ? path.join(dir, all[all.length - 1]) : null;
}

/** กู้ไฟล์ .sql.gz ลงฐาน target — dump ใช้ --databases จึงเขียนชื่อฐานเดิมไว้ ต้องแทนเป็น target ก่อน */
async function restoreDump(db, file, target) {
  const bin = findMysqlBin('mysql');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const src = new RegExp(`^(CREATE DATABASE .*?|USE )\`${esc(db.database)}\``, 'gm');
  const { Transform } = require('stream');
  let carry = '';
  const rename = new Transform({
    transform(chunk, _e, cb) {
      const s = carry + chunk.toString('utf8');
      const cut = s.lastIndexOf('\n') + 1; // แทนเฉพาะบรรทัดที่ครบแล้ว
      carry = s.slice(cut);
      cb(null, s.slice(0, cut).replace(src, `$1\`${target}\``));
    },
    flush(cb) { cb(null, carry.replace(src, `$1\`${target}\``)); },
  });
  await withOptionFile(db, (cnf) => run(bin, [`--defaults-extra-file=${cnf}`, '--default-character-set=utf8mb4', '-e',
    `DROP DATABASE IF EXISTS \`${target}\`; CREATE DATABASE \`${target}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`]));
  const input = [fs.createReadStream(file), zlib.createGunzip(), rename];
  await withOptionFile(db, (cnf) => run(bin, [`--defaults-extra-file=${cnf}`, '--default-character-set=utf8mb4', target], { input }));
}

async function tableCounts(db, database) {
  const bin = findMysqlBin('mysql');
  const chunks = [];
  const { PassThrough } = require('stream');
  const out = new PassThrough();
  out.on('data', (c) => chunks.push(c));
  const sql = `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='${database}' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME`;
  await withOptionFile(db, (cnf) => run(bin, [`--defaults-extra-file=${cnf}`, '-N', '-B', '-e', sql], { output: out }));
  const tables = Buffer.concat(chunks).toString('utf8').split(/\r?\n/).filter(Boolean);
  if (!tables.length) return {};
  chunks.length = 0;
  const out2 = new PassThrough();
  out2.on('data', (c) => chunks.push(c));
  const q = tables.map((t) => `SELECT '${t}', COUNT(*) FROM \`${database}\`.\`${t}\``).join(' UNION ALL ');
  await withOptionFile(db, (cnf) => run(bin, [`--defaults-extra-file=${cnf}`, '-N', '-B', '-e', q], { output: out2 }));
  return Object.fromEntries(Buffer.concat(chunks).toString('utf8').split(/\r?\n/).filter(Boolean).map((l) => {
    const [t, n] = l.split('\t');
    return [t, Number(n)];
  }));
}

function config() {
  require('dotenv').config({ path: path.join(BACKEND_DIR, '.env') });
  if (!process.env.DATABASE_URL) throw new Error('ไม่มี DATABASE_URL ใน backend/.env');
  const dir = path.resolve(process.env.BACKUP_DIR || (process.platform === 'win32' ? 'C:\\coop-backups' : path.join(os.homedir(), 'coop-backups')));
  const projectRoot = path.resolve(BACKEND_DIR, '..');
  if ((dir + path.sep).toLowerCase().startsWith(projectRoot.toLowerCase() + path.sep)) {
    throw new Error(`BACKUP_DIR (${dir}) ต้องอยู่นอกโฟลเดอร์โปรเจกต์ — ไม่งั้น deploy/git จะยุ่งกับไฟล์สำรอง และ nodemon จะ restart`);
  }
  return {
    db: parseDatabaseUrl(process.env.DATABASE_URL),
    dir,
    mirror: process.env.BACKUP_MIRROR_DIR ? path.resolve(process.env.BACKUP_MIRROR_DIR) : null,
    keepDays: Math.max(1, Number(process.env.BACKUP_KEEP_DAYS) || 14),
  };
}

function logger(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'backup.log');
  return (msg) => {
    const line = `${new Date().toISOString()}  ${msg}`;
    console.log(line);
    fs.appendFileSync(file, line + '\n');
  };
}

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

async function backup(cfg, log) {
  const dbDir = path.join(cfg.dir, 'db');
  fs.mkdirSync(dbDir, { recursive: true });
  const file = path.join(dbDir, `${cfg.db.database}-${stamp()}.sql.gz`);
  const size = await dumpDatabase(cfg.db, file);
  log(`[OK] ฐานข้อมูล → ${file} (${mb(size)})`);
  const up = syncDir(UPLOADS_DIR, path.join(cfg.dir, 'uploads'));
  log(`[OK] ไฟล์อัปโหลด: คัดลอกใหม่ ${up.copied} ไฟล์ (${mb(up.bytes)}) จากทั้งหมด ${up.total}`);
  const removed = prune(dbDir, cfg.keepDays);
  if (removed.length) log(`[OK] ลบ dump เก่ากว่า ${cfg.keepDays} วัน: ${removed.join(', ')}`);
  if (cfg.mirror) {
    try {
      const mDb = path.join(cfg.mirror, 'db');
      fs.mkdirSync(mDb, { recursive: true });
      fs.copyFileSync(file, path.join(mDb, path.basename(file)));
      const mUp = syncDir(UPLOADS_DIR, path.join(cfg.mirror, 'uploads'));
      prune(mDb, cfg.keepDays);
      log(`[OK] สำเนาที่สอง → ${cfg.mirror} (ไฟล์อัปโหลดใหม่ ${mUp.copied})`);
    } catch (e) {
      log(`[ERR] สำเนาที่สองไม่สำเร็จ (${cfg.mirror}): ${e.message}`);
      process.exitCode = 1;
    }
  }
  fs.writeFileSync(path.join(cfg.dir, 'last-backup.json'), JSON.stringify({ at: new Date().toISOString(), file, size, uploads: up }, null, 2));
  return file;
}

/**
 * อ่านไฟล์ dump ทั้งไฟล์โดยไม่โหลดเข้า MySQL: ตารางที่มี · จำนวนแถวต่อตาราง (นับ tuple ใน INSERT) · จบครบไหม
 * ใช้ตรวจเมื่อบัญชีฐานข้อมูลไม่มีสิทธิ์สร้างฐานชั่วคราว — แตกไฟล์ไม่ได้/ถูกตัดกลางทาง = โยน error
 */
async function scanDump(file) {
  const tables = {};
  let completed = false;
  let current = null; // ตารางของ INSERT ที่กำลังอ่าน (บรรทัดยาวมากถูกตัดเป็นหลาย chunk)
  let depth = 0, inStr = false, esc = false;
  const countTuples = (s) => {
    for (const ch of s) {
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === "'") inStr = false;
      } else if (ch === "'") inStr = true;
      else if (ch === '(') { if (depth++ === 0) tables[current]++; }
      else if (ch === ')') depth--;
      else if (ch === ';' && depth === 0) current = null;
    }
  };
  let carry = '';
  const onLine = (line) => {
    if (current) return countTuples(line + '\n');
    const create = /^CREATE TABLE `([^`]+)`/.exec(line);
    if (create) { tables[create[1]] ??= 0; return; }
    const insert = /^INSERT INTO `([^`]+)` VALUES /.exec(line);
    if (insert) {
      current = insert[1];
      tables[current] ??= 0;
      depth = 0; inStr = false; esc = false;
      return countTuples(line.slice(insert[0].length) + '\n');
    }
    if (/^-- Dump completed/.test(line)) completed = true;
  };
  await new Promise((resolve, reject) => {
    const gunzip = zlib.createGunzip();
    pipeline(fs.createReadStream(file), gunzip, (err) => (err ? reject(err) : resolve()));
    gunzip.on('data', (chunk) => {
      const s = carry + chunk.toString('utf8');
      const lines = s.split('\n');
      carry = lines.pop();
      for (const l of lines) onLine(l);
    });
  });
  if (carry) onLine(carry);
  return { tables, completed };
}

async function compareWithLive(cfg, log, counts, label) {
  const live = await tableCounts(cfg.db, cfg.db.database);
  const tables = Object.keys(live);
  const missing = tables.filter((t) => !(t in counts));
  const fewer = tables.filter((t) => t in counts && counts[t] < live[t]);
  for (const t of tables) log(`    ${t.padEnd(32)} จริง ${String(live[t]).padStart(7)}  ${label} ${String(counts[t] ?? '-').padStart(7)}`);
  // น้อยกว่าฐานจริงเล็กน้อยเป็นปกติ (ข้อมูลเพิ่มหลังเวลาสำรอง) — ตารางหาย = ไฟล์สำรองเสีย
  if (missing.length) throw new Error(`ตารางหายจากไฟล์สำรอง: ${missing.join(', ')}`);
  return { tables, fewer };
}

async function verify(cfg, log, file) {
  file = file || latestDump(path.join(cfg.dir, 'db'));
  if (!file) throw new Error(`ไม่มีไฟล์ dump ใน ${path.join(cfg.dir, 'db')}`);
  const target = `${cfg.db.database}_restore_check`;
  log(`==> ทดสอบกู้ ${path.basename(file)} → ฐานชั่วคราว ${target}`);
  try {
    await restoreDump(cfg.db, file, target);
  } catch (e) {
    // บัญชีของระบบมีสิทธิ์แค่ฐานเดียว (สร้างฐานชั่วคราวไม่ได้) → ตรวจตัวไฟล์แทน ไม่ต้องให้สิทธิ์เพิ่ม
    if (!/ERROR 1044/.test(e.message)) {
      await dropScratch(cfg, target).catch(() => {});
      throw e;
    }
    log('    บัญชีฐานข้อมูลสร้างฐานชั่วคราวไม่ได้ → ตรวจตัวไฟล์สำรองแทน (แตกทั้งไฟล์ · ตาราง · จำนวนแถว)');
    const { tables: counts, completed } = await scanDump(file);
    if (!completed) throw new Error('ไฟล์สำรองไม่ครบ (ไม่มี "-- Dump completed")');
    const { tables, fewer } = await compareWithLive(cfg, log, counts, 'ในไฟล์');
    log(`[OK] ไฟล์สำรองครบ ${tables.length} ตาราง${fewer.length ? ` (${fewer.length} ตารางมีแถวน้อยกว่าฐานจริง = ข้อมูลที่เพิ่มหลังเวลาสำรอง)` : ''} · ไม่ได้ลองโหลดเข้า MySQL จริง`);
    return;
  }
  try {
    const restored = await tableCounts(cfg.db, target);
    const { tables, fewer } = await compareWithLive(cfg, log, restored, 'กู้ได้');
    log(`[OK] กู้ได้ครบ ${tables.length} ตาราง${fewer.length ? ` (${fewer.length} ตารางมีแถวน้อยกว่าฐานจริง = ข้อมูลที่เพิ่มหลังเวลาสำรอง)` : ''}`);
  } finally {
    await dropScratch(cfg, target);
    log(`    ลบฐานชั่วคราว ${target} แล้ว`);
  }
}

function dropScratch(cfg, target) {
  return withOptionFile(cfg.db, (cnf) => run(findMysqlBin('mysql'), [`--defaults-extra-file=${cnf}`, '-e', `DROP DATABASE IF EXISTS \`${target}\``]));
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  }));
  let cfg;
  try { cfg = config(); } catch (e) { console.error(`[ERR] ${e.message}`); process.exitCode = 1; return; }
  const log = logger(cfg.dir);
  try {
    if (args.restore) {
      const target = args.database;
      if (!target || typeof target !== 'string' || !/^[\w-]+$/.test(target)) throw new Error('ระบุ --database=<ชื่อฐาน> (ตัวอักษร/ตัวเลข/_/-)');
      if (target === cfg.db.database && !args.force) throw new Error(`${target} คือฐานที่ระบบใช้อยู่ — หยุด backend ก่อน แล้วใส่ --force ถ้าตั้งใจกู้ทับจริง`);
      log(`==> กู้ ${args.restore} → ${target}`);
      await restoreDump(cfg.db, path.resolve(args.restore), target);
      log(`[OK] กู้ลง ${target} เสร็จ`);
    } else if (args.verify) {
      await verify(cfg, log, typeof args.verify === 'string' ? path.resolve(args.verify) : null);
    } else {
      log('===== เริ่มสำรองข้อมูล =====');
      await backup(cfg, log);
      log('===== สำรองข้อมูลเสร็จ =====');
    }
  } catch (e) {
    log(`[ERR] ${e.message}`);
    // บัญชีของระบบมักมีสิทธิ์แค่ฐานเดียว — บอกวิธีให้สิทธิ์ฐานสำหรับกู้ (docs/backup.md ข้อ 4)
    if (/ERROR 1044/.test(e.message) && cfg?.db) {
      const pattern = `${cfg.db.database.replace(/_/g, '\\_')}\\_%`; // \_ = ขีดล่างจริง (_ เฉยๆ เป็น wildcard)
      log(`      ให้สิทธิ์ด้วย root: GRANT ALL PRIVILEGES ON \`${pattern}\`.* TO '${cfg.db.user}'@'localhost';`);
    }
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { parseDatabaseUrl, selectExpired, stamp, syncDir, scanDump, DUMP_RE };
