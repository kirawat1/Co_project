/**
 * tests/security.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * ช่องโหว่ด้านสิทธิ์ที่ IDOR (idor.e2e) ไม่ครอบ — ลองโจมตีจริงแล้วดูว่าข้อมูลไม่เปลี่ยน
 *   1. ส่งช่องแอบแฝง (mass assignment): userId/deletedAt/role/isCoopTeacher/coopMajors/status ฯลฯ ไปกับฟอร์มของตัวเอง
 *   2. ปลอม token: alg none · secret ผิด · หมดอายุ · role ใน token ไม่ตรง · บัญชีไม่มีแล้ว · token เฉพาะงาน · เปลี่ยนรหัสแล้ว token เดิมตาย
 *   3. ไฟล์อัปโหลด: นามสกุล/ชนิดปลอม · ชื่อไฟล์ย้อนโฟลเดอร์ · เปิด /uploads ด้วย path ย้อนโฟลเดอร์
 *   4. ข้อมูลรั่ว: GET ทุกเส้น (อ่านจาก routes/*.js เอง) ทุกบทบาท ต้องไม่มี hash/สำเนารหัสผ่าน/token · ไม่ login = 401 ยกเว้นที่ตั้งใจเปิด
 *   5. XSS: ข้อความที่ผู้ใช้กรอก (ชื่อ · บริษัท · ผู้ติดต่อ · พี่เลี้ยง · ประกาศ · แจ้งปัญหา · ลิงก์) เปิดทุกหน้าแล้วไม่มีสคริปต์ทำงาน
 */
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { api, API, type Res } from "./helpers/letterWorld";
import { WorldKit, prisma, UPLOADS, BACKEND_DIR, day, type KStudent, type KTeacher, type KUser } from "./helpers/worldKit";
import { csvCell } from "../src/utils/csvCell";

const require = createRequire(import.meta.url);
const jwt = require(path.join(BACKEND_DIR, "node_modules/jsonwebtoken"));
const bcrypt = require(path.join(BACKEND_DIR, "node_modules/bcryptjs"));
const SECRET = process.env.JWT_SECRET as string;

const k = new WorldKit("ZV");
test.describe.configure({ mode: "serial" });
const msg = (r: Res) => JSON.stringify(r.body);

const XSS = `<img src=zvx onerror="window.__xss=1">`;
const XSS2 = `"><svg onload="window.__xss=2">`;
const JS_URL = "javascript:window.__xss=3";
const ENC_MARK = `ZVENC${Date.now()}`;               // สำเนารหัสผ่านปลอมที่ seed — โผล่ในคำตอบไหนก็คือรั่ว
const OLD_PW = "Zv-Old-pass1!";

let X = "", Y = "", P = 0;
let staff: KUser, coopY: KTeacher, advA: KTeacher, sA: KStudent, sB: KStudent;

const feedbackIds: number[] = [];

test.beforeAll(async () => {
  const up = await fetch(`${API}/api/auth/me`).catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน");
  X = await k.major("X"); Y = await k.major("Y");
  P = await k.period(1, { [X]: {}, [Y]: {} });
  staff = await k.staff();
  advA = await k.teacher(`ที่ปรึกษา${XSS}`, { major: X });
  coopY = await k.teacher("ประจำวิชาY", { major: Y, coop: [Y] });
  const c = await k.company(`${k.prefix}${k.tail} บริษัท${XSS}`, [`ผู้ติดต่อ${XSS2}`], staff.userId);

  await prisma.company.update({ where: { id: c.id }, data: { website: JS_URL, address: XSS2 } });
  await prisma.mentor.create({ data: { companyId: c.id, firstName: `พี่เลี้ยง${XSS}`, lastName: XSS2, email: "m@example.com" } });
  sA = await k.student("a", 1, { major: X, status: "INTERNSHIP_STARTED", periodId: P, companyId: c.id, contactIds: c.contactIds, advisor: advA.pk, phone: XSS2 });
  sB = await k.student("b", 2, { major: Y, status: "APPLYING", periodId: P });
  await prisma.student.update({ where: { id: sA.pk }, data: { lastName: `ทดสอบZV${XSS}`, jobPosition: XSS2 } });
  // รหัสผ่านจริง (bcrypt) + สำเนาที่ถอดได้ — ใช้จับคำตอบที่หลุดค่าพวกนี้
  const hash = bcrypt.hashSync(OLD_PW, 4);
  await prisma.user.updateMany({ where: { id: { in: k.users } }, data: { password: hash, passwordEnc: ENC_MARK, kkuAccessToken: `${ENC_MARK}kku` } });
  await prisma.supervisionAppointment.create({ data: { studentId: sA.pk, teacherId: advA.pk, proposedDates: JSON.stringify([`${day(9)}T09:00:00+07:00`]), supervisionType: "ONLINE", onlineLink: JS_URL, status: "DATE_CONFIRMED", confirmedDate: new Date(`${day(9)}T09:00:00+07:00`) } });
  await prisma.announcement.create({ data: { title: `${k.prefix}${k.tail} ประกาศ${XSS}`, body: `เนื้อหา${XSS2}`, date: new Date(), year: "2569", linkUrl: JS_URL, authorId: staff.userId } });
  // แจ้งปัญหาที่ path เป็นลิงก์อันตราย (ข้อมูลเก่าก่อนแก้ — หน้าเจ้าหน้าที่ต้องไม่ทำเป็นปุ่มเปิด)
  for (const pagePath of [JS_URL, "https://evil.example/login", "//evil.example/x", "/student/profile?zv=1"]) {
    feedbackIds.push((await prisma.feedback.create({ data: { userId: sA.userId, role: "student", kind: "BUG", message: `ข้อความ${XSS}`, pagePath, contextNote: XSS2 } })).id);
  }
});
test.afterAll(async () => {
  await prisma.notification.deleteMany({ where: { type: "FEEDBACK_NEW", relatedId: { in: feedbackIds.map(String) } } });
  await prisma.feedback.deleteMany({ where: { id: { in: feedbackIds } } });
  await k.cleanup(); await k.disconnect();
});

// ───────────────────────── 1. mass assignment ─────────────────────────
test("ส่งช่องแอบแฝง: นักศึกษาแก้โปรไฟล์ตัวเอง — userId/deletedAt/role/สถานะสหกิจ/tokenVersion ไม่เปลี่ยน", async () => {
  const before = await k.coop(sA.pk);
  const r = await api(sA.token, "PUT", "/api/students/me", {
    firstName: "นศใหม่", id: sB.pk, userId: sB.userId, deletedAt: new Date().toISOString(), role: "staff", tokenVersion: 9,
    isCoopTeacher: true, coop: { status: "COMPLETED" }, user: { role: "staff" }, createdAt: "2000-01-01T00:00:00Z",
  });
  expect(r.status, msg(r)).toBe(200);
  const st = await prisma.student.findUnique({ where: { id: sA.pk } });
  expect([st.firstName, st.userId, st.deletedAt]).toEqual(["นศใหม่", sA.userId, null]);
  const u = await prisma.user.findUnique({ where: { id: sA.userId } });
  expect([u.role, u.tokenVersion]).toEqual(["student", 0]);
  expect((await k.coop(sA.pk)).status).toBe(before.status);
  expect((await prisma.student.findUnique({ where: { id: sB.pk } })).userId).toBe(sB.userId);
  expect((await api(sA.token, "GET", "/api/students/me")).status).toBe(200);           // token เดิมยังใช้ได้ (ไม่ได้ถูกเพิกถอน/ย้ายบัญชี)
  // ใช้รหัสนักศึกษาของคนอื่น = ชน (ไม่เอาบัญชีเขามา) — รหัสจริงเป็นตัวเลข (รหัสของ kit มีตัวอักษร ระบบตัดทิ้ง)
  const codeB = `9${k.tail}0002`;
  await prisma.student.update({ where: { id: sB.pk }, data: { studentId: codeB } });
  const dup = await api(sA.token, "PUT", "/api/students/me", { studentId: codeB });
  expect(dup.status, msg(dup)).toBe(409);
  expect((await prisma.student.findUnique({ where: { id: sA.pk } })).studentId).toBe(sA.studentId);
});

test("ส่งช่องแอบแฝง: อาจารย์ยกตัวเองเป็นอาจารย์ประจำวิชาไม่ได้ · หลักสูตรต้องมีจริง · เจ้าหน้าที่สร้างแถวอาจารย์ให้ตัวเองไม่ได้", async () => {
  const r = await api(advA.token, "PUT", "/api/teacher/me", {
    firstName: "ทดสอบ", lastName: "ZV", isCoopTeacher: true, coopMajors: [X], userId: sA.userId, email: "hijack@example.com", role: "staff", user: { role: "staff" },
  });
  expect(r.status, msg(r)).toBe(200);
  const t = await prisma.teacher.findUnique({ where: { id: advA.pk }, include: { coopMajors: true } });
  expect([t.isCoopTeacher, t.coopMajors.length, t.userId, t.email]).toEqual([false, 0, advA.userId, (await prisma.user.findUnique({ where: { id: advA.userId } })).email]);
  expect((await prisma.user.findUnique({ where: { id: advA.userId } })).role).toBe("teacher");
  expect((await api(advA.token, "GET", "/api/admin/coop-applications")).status).toBe(403);   // ยังไม่ได้สิทธิ์อาจารย์ประจำวิชา
  // หลักสูตรที่ไม่มีในระบบ (เดิมบันทึกได้ อาจารย์หลุดจากปฏิทิน/รายการตามหลักสูตร)
  const bad = await api(advA.token, "PUT", "/api/teacher/me", { major: "ไม่มีหลักสูตรนี้" });
  expect(bad.status, msg(bad)).toBe(400);
  expect((await prisma.teacher.findUnique({ where: { id: advA.pk } })).major).toBe(X);
  expect((await api(advA.token, "PUT", "/api/teacher/me", { major: Y })).status).toBe(200);    // หลักสูตรจริง = ย้ายได้ (หน้าโปรไฟล์ให้เลือกเอง)
  await api(advA.token, "PUT", "/api/teacher/me", { major: X });
  // เจ้าหน้าที่: เดิม PUT /api/teacher/me ได้แถวอาจารย์ผูกบัญชีเจ้าหน้าที่
  const s = await api(staff.token, "PUT", "/api/teacher/me", { firstName: "เจ้าหน้าที่", lastName: "ZV" });
  expect(s.status, msg(s)).toBe(403);
  expect(await prisma.teacher.findUnique({ where: { userId: staff.userId } })).toBeNull();
});

test("ส่งช่องแอบแฝง: แจ้งปัญหา (สถานะ/ผู้แจ้ง/คำตอบเจ้าหน้าที่) · บริษัท (ผู้สร้าง) · path หน้าที่แจ้งรับเฉพาะในระบบ", async () => {
  const r = await api(sA.token, "POST", "/api/feedback", {
    kind: "BUG", message: "ทดสอบช่องแอบแฝง ZV", status: "RESOLVED", userId: sB.userId, staffReply: "ปิดเรื่องเอง", handledById: staff.userId, handledName: "ปลอม", pagePath: "/student/docs?x=1",
  });
  expect(r.status, msg(r)).toBe(201);
  feedbackIds.push(r.body.data.id);
  const f = await prisma.feedback.findUnique({ where: { id: r.body.data.id } });
  expect([f.userId, f.status, f.staffReply, f.handledById, f.handledName, f.pagePath]).toEqual([sA.userId, "NEW", null, null, null, "/student/docs?x=1"]);
  for (const pagePath of [JS_URL, "https://evil.example/login", "//evil.example/x", "/\\evil.example", " javascript:alert(1)"]) {
    const x = await api(sA.token, "POST", "/api/feedback", { kind: "BUG", message: "ทดสอบลิงก์ ZV", pagePath });
    feedbackIds.push(x.body.data.id);
    expect((await prisma.feedback.findUnique({ where: { id: x.body.data.id } })).pagePath, pagePath).toBeNull();
  }
  const c = await api(sA.token, "POST", "/api/companies", { name: `${k.prefix}${k.tail} บริษัทนักศึกษา`, createdById: staff.userId, id: "zv-fixed-id" });
  expect(c.status, msg(c)).toBe(200);
  expect([c.body.company.createdById, c.body.company.id === "zv-fixed-id"]).toEqual([sA.userId, false]);
});

test("ส่งชนิดข้อมูลแปลก: เข้าสู่ระบบด้วย object/array = 400 ไม่ใช่ 500 · ตัวกรองแบบ object ใน URL ไม่ขยายขอบเขตหลักสูตร", async () => {
  for (const body of [
    { email: { $ne: "" }, password: { $ne: "" }, role: "student" },
    { email: sA.email, password: [OLD_PW], role: "student" },
    { email: sA.email, password: OLD_PW, role: { in: ["student", "staff"] } },
  ]) {
    const r = await fetch(`${API}/api/auth/signin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    expect(r.status, JSON.stringify(body)).toBe(400);
  }
  // ?a[b]=c → Express แปลงเป็น object — อาจารย์ประจำวิชา Y ต้องไม่เห็นนักศึกษาหลักสูตร X
  for (const q of ["coopPeriodId[not]=0", "statuses[]=INTERNSHIP_STARTED", "year[not]=zz", "major=" + X, "major[in][]=" + X]) {
    for (const url of [`/api/students?limit=100&${q}`, `/api/admin/dashboard-stats?${q}`, `/api/admin/coop-applications?${q}`]) {
      const r = await api(coopY.token, "GET", url);                                    // ตอบ error ได้ แต่ห้ามรั่ว
      expect(JSON.stringify(r.body), url).not.toContain(sA.studentId);
    }
  }
});

// ───────────────────────── 2. ปลอม token ─────────────────────────
test("ปลอม token: alg none · secret ผิด · หมดอายุ · role ไม่ตรงบัญชี · บัญชีไม่มี · เวอร์ชันเก่า · token เฉพาะงาน — 401 ทั้ง API และ /uploads", async () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const forged: Record<string, string> = {
    "alg none": `${b64({ alg: "none", typ: "JWT" })}.${b64({ id: staff.userId, role: "staff", tv: 0 })}.`,
    "secret ผิด": jwt.sign({ id: staff.userId, role: "staff", tv: 0 }, "not-the-secret"),
    "หมดอายุ": jwt.sign({ id: sA.userId, role: "student", tv: 0, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET),
    "role ใน token = staff แต่บัญชีเป็นนักศึกษา": jwt.sign({ id: sA.userId, role: "staff", tv: 0 }, SECRET),
    "บัญชีไม่มีแล้ว": jwt.sign({ id: 2_000_000_000, role: "staff", tv: 0 }, SECRET),
    "id ไม่ใช่ตัวเลข": jwt.sign({ id: { gt: 0 }, role: "staff", tv: 0 }, SECRET),
    "เวอร์ชัน token ไม่ตรง": jwt.sign({ id: sA.userId, role: "student", tv: 7 }, SECRET),
    "token เฉพาะงาน (ลิงก์ zip)": jwt.sign({ id: staff.userId, uid: staff.userId, role: "staff", tv: 0, purpose: "letters-zip" }, SECRET),
    "ลายเซ็นถูกตัดออก": staff.token.split(".").slice(0, 2).join(".") + ".",
    "payload ถูกแก้ (ลายเซ็นเดิม)": (() => { const [h, , s] = sA.token.split("."); return `${h}.${b64({ id: staff.userId, role: "staff", tv: 0 })}.${s}`; })(),
  };
  const docs = await k.docs(sA.pk);
  for (const [name, tk] of Object.entries(forged)) {
    for (const url of ["/api/students/me", "/api/admin/staff", "/api/auth/me"]) {
      const r = await fetch(API + url, { headers: { Authorization: `Bearer ${tk}` } });
      expect(r.status, `${name} ${url}`).toBe(401);
    }
    const f = await fetch(`${API}/uploads/${docs[0]?.path || "x.pdf"}`, { headers: { cookie: `coop_file=${tk}` } });
    expect(f.status, `${name} /uploads`).toBe(401);
  }
  for (const h of ["", "Bearer", "Bearer ", "Basic abc", `Bearer ${"a".repeat(5000)}`]) {
    expect((await fetch(`${API}/api/students/me`, { headers: h ? { Authorization: h } : {} })).status, `header "${h.slice(0, 20)}"`).toBe(401);
  }
  // token เข้าสู่ระบบใช้เป็นลิงก์ดาวน์โหลด zip ไม่ได้
  expect((await fetch(`${API}/api/admin/letters/zip?t=${staff.token}`)).status).toBe(401);
});

test("ปลอม token: นักศึกษาเปลี่ยนรหัสผ่าน → token เดิมทุกเครื่องใช้ไม่ได้ (ทั้ง API และไฟล์) · token ใหม่ใช้ได้", async () => {
  const old = sA.token;
  const r = await api(old, "PUT", "/api/auth/me/password", { currentPassword: OLD_PW, newPassword: "Zv-New-pass2!" });
  expect(r.status, msg(r)).toBe(200);
  expect((await api(old, "GET", "/api/students/me")).status).toBe(401);
  const docs = await k.docs(sA.pk);
  if (docs[0]) expect((await fetch(`${API}/uploads/${docs[0].path}`, { headers: { cookie: `coop_file=${old}` } })).status).toBe(401);
  sA.token = r.body.token;
  expect((await api(sA.token, "GET", "/api/students/me")).status).toBe(200);
});

// ───────────────────────── 3. ไฟล์อัปโหลด ─────────────────────────
test("ไฟล์อัปโหลด: นามสกุล/ชนิดปลอมถูกปฏิเสธ · ชื่อไฟล์ย้อนโฟลเดอร์ไม่หลุดออกนอก uploads · เปิด /uploads ย้อนโฟลเดอร์ไม่ได้", async () => {
  const send = (name: string, type: string, body = "%PDF-1.4\nzv\n%%EOF") => {
    const fd = new FormData();
    fd.append("docType", "CP-ACCEPTANCE");
    fd.append("files", new Blob([body], { type }), name);
    return api(sA.token, "POST", "/api/docs/upload", fd);
  };
  for (const [name, type] of [
    ["zv-evil.html", "text/html"], ["zv-evil.pdf", "text/html"], ["zv-evil.svg", "image/svg+xml"], ["zv-evil.pdf.html", "application/pdf"],
    ["zv-evil.js", "application/pdf"], ["zv-evil.exe", "application/octet-stream"], ["zv-evil", "application/pdf"],
  ] as const) {
    const r = await send(name, type, "<script>window.__xss=1</script>");
    expect(r.status, `${name} (${type}) ${msg(r)}`).toBe(400);
    expect(r.body?.message, name).toMatch(/รองรับเฉพาะไฟล์/);                        // โดนเพราะชนิดไฟล์ ไม่ใช่เหตุอื่น
  }
  const before = new Set(fs.readdirSync(UPLOADS));
  const r = await send("../../../zv-traversal.pdf", "application/pdf");
  expect(r.status, msg(r)).toBeLessThan(500);
  for (const dir of [BACKEND_DIR, path.dirname(BACKEND_DIR), path.dirname(UPLOADS)]) expect(fs.existsSync(path.join(dir, "zv-traversal.pdf")), dir).toBe(false);
  const added = fs.readdirSync(UPLOADS).filter((f) => !before.has(f));
  for (const d of await k.docs(sA.pk)) expect(d.path).not.toMatch(/[\\/]|\.\./);
  for (const f of added) k.files.push(path.join(UPLOADS, f));

  const me = await fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${sA.token}` } });
  const cookie = (me.headers.get("set-cookie") || "").split(";")[0];
  for (const p of ["..%2fserver.js", "..%2f..%2fbackend%2f.env", "%2e%2e%2f.env", "..%5cserver.js", "x%2f..%2f..%2fserver.js", "%2e%2e%5c%2e%2e%5c.env", "....%2f%2fserver.js"]) {
    const f = await fetch(`${API}/uploads/${p}`, { headers: { cookie } });
    const text = await f.text();
    expect(f.status, p).not.toBe(200);
    expect(text, p).not.toMatch(/JWT_SECRET|DATABASE_URL|require\(/);
  }
  // ไฟล์ของตัวเองเปิดได้ · ชนิดตามนามสกุล + nosniff (เบราว์เซอร์ไม่เดาเป็น HTML)
  const own = (await k.docs(sA.pk))[0];
  if (own) {
    const f = await fetch(`${API}/uploads/${own.path}`, { headers: { cookie } });
    if (f.status === 200) {
      expect(f.headers.get("content-type") || "").toMatch(/^(application\/pdf|image\/)/);
      expect(f.headers.get("x-content-type-options")).toBe("nosniff");
    }
  }
});

// ───────────────────────── 4. ข้อมูลรั่ว ─────────────────────────
const ROUTES_DIR = path.join(BACKEND_DIR, "routes");
const MOUNT: Record<string, string> = {
  authRoutes: "/api/auth", companyRoutes: "/api/companies", announcementRoutes: "/api/announcements", studentRoutes: "/api/students",
  coopRoutes: "/api/coop", visitRoutes: "/api/visits", teacherRoutes: "/api/teacher", docRoutes: "/api/docs", adminRoutes: "/api/admin",
  notificationRoutes: "/api/notifications", feedbackRoutes: "/api/feedback", statusRoutes: "/api/status", internalStatusRoutes: "/api/internal-status",
  supervisionRoutes: "/api",
};
const HEAVY = /export|zip|download|backup|pdf|docx|letters\/|preview/i;     // ไฟล์/งานหนัก — ไม่ใช่ JSON
const PUBLIC = new Set(["/api/admin/config/dean-info", "/api/internal-status"]);  // ตั้งใจเปิด: ชื่อคณบดีบนหนังสือ · สถานะเครื่อง (ตอบเฉพาะคำขอจากเครื่องเอง)
function getRoutes() {
  const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".js")).map((f) => f.replace(/\.js$/, ""));
  const unmounted = files.filter((f) => !(f in MOUNT));
  expect(unmounted, "ไฟล์ route ใหม่ — เพิ่มใน MOUNT").toEqual([]);
  const out: string[] = [];
  for (const [f, base] of Object.entries(MOUNT)) {
    const src = fs.readFileSync(path.join(ROUTES_DIR, `${f}.js`), "utf8");
    for (const m of src.matchAll(/router\.get\(\s*["'`]([^"'`]+)["'`]/g)) out.push((base + m[1]).replace(/\/$/, "") || "/");
  }
  return [...new Set(out)];
}
const fill = (route: string) => route
  .replace(/:(studentId|code|studentCode)\b/g, sA.studentId)
  .replace(/:[A-Za-z]+/g, String(sA.pk));
const LEAK = [/\$2[aby]\$\d\d\$/, /"password"\s*:/, /"passwordEnc"\s*:/, /"kkuAccessToken"\s*:/, /"tokenVersion"\s*:/];

test("ข้อมูลรั่ว: ไม่ login → 401 ทุกเส้น ยกเว้นที่ตั้งใจเปิด", async () => {
  const open: string[] = [];
  for (const r of getRoutes()) {
    const res = await fetch(API + fill(r));
    if (res.status !== 401) open.push(`${res.status} ${r}`);
  }
  expect(open.filter((l) => !PUBLIC.has(l.split(" ")[1]))).toEqual([]);
});

test("ข้อมูลรั่ว: GET ทุกเส้น ทุกบทบาท — ไม่มี hash/สำเนารหัสผ่าน/token ของใคร · 500 ไม่บอกรายละเอียดภายใน", async () => {
  test.setTimeout(300_000);
  const who: Record<string, string> = { staff: staff.token, coopY: coopY.token, teacher: advA.token, student: sA.token };
  const problems: string[] = [];
  let checked = 0;
  for (const r of getRoutes().filter((x) => !HEAVY.test(x))) {
    for (const [role, tk] of Object.entries(who)) {
      const res = await fetch(API + fill(r), { headers: { Authorization: `Bearer ${tk}` } });
      if (!(res.headers.get("content-type") || "").includes("json")) continue;
      const text = await res.text();
      checked++;
      for (const re of LEAK) if (re.test(text)) problems.push(`${role} ${r} → ${re}`);
      if (text.includes(ENC_MARK)) problems.push(`${role} ${r} → สำเนารหัสผ่าน/โทเคน KKU`);
      if (res.status >= 500 && /prisma|at \w+ \(|node_modules|ECONN|SELECT /i.test(text)) problems.push(`${role} ${r} → 500 บอกรายละเอียดภายใน: ${text.slice(0, 120)}`);
    }
  }
  expect(checked).toBeGreaterThan(150);
  expect(problems).toEqual([]);
});

// ───────────────────────── 5. XSS ─────────────────────────
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/components");
const routesOf = (file: string) => [...fs.readFileSync(path.join(SRC, file), "utf8").matchAll(/path="([^"*:]+)"/g)].map((m) => m[1]);

async function sweep(page: Page, u: KUser, base: string, routes: string[]) {
  const problems: string[] = [];
  const shown: string[] = [];                                                       // หน้าที่ข้อความที่ฝังไว้โผล่ (เทสต์ต้องเห็นจริง ไม่ใช่ผ่านเพราะหน้าว่าง)
  page.on("dialog", (d) => { problems.push(`dialog: ${d.message()}`); d.dismiss().catch(() => {}); });
  page.context().on("page", (p) => { p.close().catch(() => {}); });
  await page.route("**/api/**", (route) => (route.request().method() === "GET"
    ? route.continue()
    : route.fulfill({ status: 418, contentType: "application/json", body: '{"ok":false}' })));
  await page.goto("/");
  await page.evaluate(([tk, uid]) => { localStorage.clear(); localStorage.setItem("coop.token", tk); localStorage.setItem("coop.userId", uid); }, [u.token, String(u.userId)]);
  for (const r of routes) {
    const url = `${base}/${r}`;
    await page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
    if (await page.evaluate(() => /onerror="window\.__xss=1"|onload="window\.__xss=2"/.test(document.body.innerText))) shown.push(r);
    const found = await page.evaluate(() => {
      const w = window as unknown as { __xss?: number };
      const bad: string[] = [];
      if (w.__xss) bad.push(`สคริปต์ทำงาน (${w.__xss})`);
      if (document.querySelector('img[src="zvx"], svg[onload]')) bad.push("แท็กที่ฝังมากลายเป็น HTML จริง");
      for (const a of Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[]) {
        const h = a.getAttribute("href") || "";
        if (/^\s*javascript:/i.test(h) && !/React has blocked/.test(h)) bad.push(`ลิงก์ javascript: "${a.textContent?.trim()}"`);
        if (/evil\.example/.test(h)) bad.push(`ลิงก์ออกนอกระบบ "${a.textContent?.trim()}" → ${h}`);
      }
      return bad;
    });
    for (const b of found) problems.push(`${url} · ${b}`);
  }
  console.log(`${base}: ข้อความที่ฝังไว้แสดงใน ${shown.length}/${routes.length} หน้า — ${shown.join(", ")}`);
  return { problems, shown };
}

test("XSS: เจ้าหน้าที่เปิดทุกหน้า /admin — ชื่อ/บริษัท/ผู้ติดต่อ/พี่เลี้ยง/ประกาศ/แจ้งปัญหา/ลิงก์ที่ฝังสคริปต์ไม่ทำงาน", async ({ page }) => {
  test.setTimeout(300_000);
  const { problems, shown } = await sweep(page, staff, "/admin", routesOf("A_App.tsx"));
  expect(problems).toEqual([]);
  // แจ้งปัญหา: ปุ่ม "เปิดหน้าที่แจ้ง" อยู่ในรายละเอียด — กางทุกเรื่องแล้วดูลิงก์ (ข้อมูลเก่าที่ path เป็นเว็บหลอก/javascript:)
  await page.goto("/admin/feedback", { waitUntil: "networkidle" });
  // เปิดได้ทีละเรื่อง — กางทีละเรื่องแล้วเก็บลิงก์ทุกรอบ
  const toggles = page.getByRole("button", { name: /^(ดูรายละเอียด|ย่อ)$/ });
  const n = await toggles.count();
  expect(n).toBeGreaterThanOrEqual(4);
  const hrefs: string[] = [];
  for (let i = 0; i < n; i++) {
    if ((await toggles.nth(i).textContent())?.trim() === "ดูรายละเอียด") await toggles.nth(i).click();
    await expect(page.getByRole("button", { name: "ย่อ" })).toHaveCount(1);
    hrefs.push(...await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") || "")));
  }
  expect(hrefs.filter((h) => /evil\.example|^\s*javascript:/i.test(h) && !/React has blocked/.test(h))).toEqual([]);
  expect(hrefs).toContain("/student/profile?zv=1");                               // path ในระบบยังเป็นปุ่มเปิดได้
  // หน้ารายชื่อนักศึกษา/ประกาศเปิดที่รอบ/ปีปัจจุบัน (ไม่ใช่รอบทดสอบ) — หน้าที่แสดงข้อมูลที่ฝังไว้แน่ ๆ:
  expect(shown).toEqual(expect.arrayContaining(["mentors", "contacts", "company", "coop-applications", "supervision-manager", "feedback"]));
});

test("XSS: อาจารย์ที่ปรึกษา (/teacher) และนักศึกษา (/student) เปิดทุกหน้า — สคริปต์ไม่ทำงาน", async ({ page }) => {
  test.setTimeout(300_000);
  const t = await sweep(page, advA, "/teacher", routesOf("T_App.tsx"));
  await page.unrouteAll({ behavior: "ignoreErrors" });
  const s = await sweep(page, sA, "/student", routesOf("S_App.tsx"));
  expect([...t.problems, ...s.problems]).toEqual([]);
  expect(t.shown.length, "หน้าอาจารย์ต้องแสดงข้อมูลที่ฝังไว้").toBeGreaterThan(0);
  expect(s.shown.length, "หน้านักศึกษาต้องแสดงข้อมูลที่ฝังไว้").toBeGreaterThan(0);
});

test("CSV ที่เปิดด้วย Excel: ข้อความขึ้นต้นด้วย = + - @ ไม่กลายเป็นสูตร · \" ถูก escape · \"- รายการ\" คงเดิม", () => {
  expect(csvCell('=HYPERLINK("https://evil.example","คลิก")')).toBe(`"'=HYPERLINK(""https://evil.example"",""คลิก"")"`);
  expect(csvCell("+1+cmd|' /C calc'!A0")).toBe(`"'+1+cmd|' /C calc'!A0"`);
  expect(csvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
  expect(csvCell("-2+3")).toBe(`"'-2+3"`);
  expect(csvCell("\t=1")).toBe(`"'\t=1"`);
  expect(csvCell("- เขียนรายงาน")).toBe(`"- เขียนรายงาน"`);
  expect(csvCell("ทำงาน, ประชุม")).toBe(`"ทำงาน, ประชุม"`);
  expect(csvCell(null)).toBe(`""`);
});
