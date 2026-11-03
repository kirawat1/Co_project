/**
 * tests/access.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * เข้าสู่ระบบ · session · สิทธิ์เปิดไฟล์ใน /uploads — กับ backend + DB จริง (มีแค่ unit test มาก่อน)
 * ข้อมูล ZX<stamp> + ไฟล์จริงใน backend/uploads สร้างเองแล้วลบทิ้งตอนจบ · ต้องรัน backend ที่ :5000
 *
 * ล็อกพฤติกรรมด้านความปลอดภัยที่เคยแก้:
 *   - /uploads เดิมเปิดสาธารณะ → ต้อง login + มีสิทธิ์ในไฟล์ (เจ้าของ · อาจารย์ที่เห็นนักศึกษาคนนั้น · เจ้าหน้าที่)
 *   - ลิงก์ดาวน์โหลด zip (token เฉพาะงาน) ใช้แทนการ login ไม่ได้ · path หลุดโฟลเดอร์ไม่ได้
 *   - เปลี่ยนรหัสผ่าน/รีเซ็ต = เพิกถอน session เดิม · logout ล้าง cookie เปิดไฟล์
 */
import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend");
require(path.join(BACKEND_DIR, "node_modules/dotenv")).config({ path: path.join(BACKEND_DIR, ".env") });
const prisma = require(path.join(BACKEND_DIR, "config/prismaClient.js"));
const jwt = require(path.join(BACKEND_DIR, "node_modules/jsonwebtoken"));
const bcrypt = require(path.join(BACKEND_DIR, "node_modules/bcryptjs"));
const API = "http://localhost:5000";

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const tail = String(stamp).slice(-5);
const tag = `zx${stamp}`;
const sign = (id: number, role: string, extra: object = {}) => jwt.sign({ id, role, tv: 0, ...extra }, process.env.JWT_SECRET, { expiresIn: "30m" });
const users: number[] = [];
const files: string[] = [];
let periodId = 0;
const W: Record<string, any> = {};

async function get(url: string, headers: Record<string, string> = {}) {
  const r = await fetch(API + url, { headers });
  return { status: r.status, cookie: r.headers.get("set-cookie") || "", body: await r.text() };
}
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

async function mkUser(key: string, role: "student" | "teacher" | "staff", password = "x") {
  const u = await prisma.user.create({ data: { username: `${tag}-${key}`, email: `${tag}-${key}@kkumail.com`, password, role } });
  users.push(u.id);
  return u;
}

test.beforeAll(async () => {
  const up = await fetch(`${API}/api/auth/me`).catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน (cd backend && npm run dev)");
  const hash = await bcrypt.hash("Zx-Pass1!", 10);

  for (const k of ["advisor", "coopCS", "coopAI", "other"] as const) {
    const u = await mkUser(k, "teacher");
    const t = await prisma.teacher.create({ data: { userId: u.id, firstName: k, lastName: `ZX${tail}`, email: u.email } });
    W[k] = { userId: u.id, pk: t.id, token: sign(u.id, "teacher") };
  }
  await prisma.coopTeacherMajor.create({ data: { teacherId: W.coopCS.pk, major: "CS" } });
  await prisma.coopTeacherMajor.create({ data: { teacherId: W.coopAI.pk, major: "AI" } });
  const su = await mkUser("staff", "staff");
  W.staff = { userId: su.id, token: sign(su.id, "staff") };

  for (const k of ["a", "b"] as const) {
    const u = await mkUser(k, "student", hash);
    const s = await prisma.student.create({ data: { userId: u.id, studentId: `ZX${tail}${k}`, firstName: k, lastName: "ทดสอบสิทธิ์", email: u.email, major: "CS", coopAdvisorId: k === "a" ? W.advisor.pk : null } });
    W[k] = { userId: u.id, pk: s.id, email: u.email, token: sign(u.id, "student") };
  }
  // ไฟล์จริงของนักศึกษา a: เอกสาร · หนังสือขอนิเทศ
  W.docName = `zx-${tail}-cv.pdf`;
  W.letterName = `zx-${tail}-sup.pdf`;
  for (const rel of [W.docName, `supervision/${W.letterName}`]) {
    const full = path.join(BACKEND_DIR, "uploads", rel);
    fs.writeFileSync(full, "%PDF-1.4\nzx\n%%EOF");
    files.push(full);
  }
  await prisma.document.create({ data: { studentId: W.a.pk, type: "CP-CV", path: W.docName, name: "cv.pdf", status: "WAITING" } });
  const win = { startDate: new Date(Date.now() - 86_400_000), endDate: new Date(Date.now() + 86_400_000 * 30) };
  periodId = (await prisma.coopPeriod.create({ data: { academicYear: `ZX${tail}`, semester: 8, ...win } })).id;
  await prisma.studentCoop.create({ data: { studentId: W.a.pk, status: "INTERNSHIP_STARTED", coopPeriodId: periodId } });
  // นัดนิเทศของ a (อาจารย์ "other" ยังไม่เกี่ยว — ข้อ A2 เพิ่มเป็นผู้นิเทศร่วมทีหลัง)
  const appt = await prisma.supervisionAppointment.create({ data: { studentId: W.a.pk, teacherId: W.advisor.pk, proposedDates: "[]", supervisionType: "ONSITE", status: "LETTER_UPLOADED", officialLetterPath: W.letterName } });
  W.apptId = appt.id;
});

test.afterAll(async () => {
  const studentPks = [W.a?.pk, W.b?.pk].filter(Boolean);
  await prisma.supervisionCoTeacher.deleteMany({ where: { appointmentId: W.apptId } });
  await prisma.supervisionAppointment.deleteMany({ where: { studentId: { in: studentPks } } });
  await prisma.document.deleteMany({ where: { studentId: { in: studentPks } } });
  await prisma.studentCoop.deleteMany({ where: { studentId: { in: studentPks } } });
  await prisma.student.deleteMany({ where: { id: { in: studentPks } } });
  const tpks = ["advisor", "coopCS", "coopAI", "other"].map((k) => W[k]?.pk).filter(Boolean);
  await prisma.coopTeacherMajor.deleteMany({ where: { teacherId: { in: tpks } } });
  await prisma.teacher.deleteMany({ where: { id: { in: tpks } } });
  await prisma.notification.deleteMany({ where: { userId: { in: users } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: users }, createdAt: { gte: new Date(stamp) } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  if (periodId) await prisma.coopPeriod.deleteMany({ where: { id: periodId } });
  for (const f of files) { try { fs.unlinkSync(f); } catch { /* */ } }
  await prisma.$disconnect();
});

test.describe("A. สิทธิ์เปิดไฟล์", () => {
  test("ไม่ login 401 · เจ้าของ/ที่ปรึกษา/อาจารย์ประจำวิชาของหลักสูตร/เจ้าหน้าที่ 200 · นักศึกษาอื่น/อาจารย์อื่น/อาจารย์หลักสูตรอื่น 403", async () => {
    const url = `/uploads/${W.docName}`;
    expect((await get(url)).status).toBe(401);
    const who: [string, number][] = [["a", 200], ["advisor", 200], ["coopCS", 200], ["staff", 200], ["b", 403], ["other", 403], ["coopAI", 403]];
    const got = [];
    for (const [k] of who) got.push([k, (await get(url, bearer(W[k].token))).status]);
    expect(got).toEqual(who);
  });

  test("หนังสือขอนิเทศ: นักศึกษาเจ้าของ · ผู้นิเทศร่วมที่เพิ่มทีหลังเปิดได้ · นักศึกษาอื่นไม่ได้", async () => {
    const url = `/uploads/supervision/${W.letterName}`;
    expect((await get(url, bearer(W.a.token))).status).toBe(200);
    expect((await get(url, bearer(W.b.token))).status).toBe(403);
    expect((await get(url, bearer(W.other.token))).status).toBe(403);
    await prisma.supervisionCoTeacher.create({ data: { appointmentId: W.apptId, teacherId: W.other.pk } });
    expect((await get(url, bearer(W.other.token))).status).toBe(200);
  });

  test("path หลุดโฟลเดอร์ 404 · ไฟล์ที่ไม่มีเจ้าของในระบบ 403 · token ลิงก์ zip ใช้แทน login ไม่ได้", async () => {
    expect((await get(`/uploads/%2e%2e/server.js`, bearer(W.a.token))).status).toBe(404);
    expect((await get(`/uploads/supervision/..%2F..%2Fserver.js`, bearer(W.a.token))).status).toBe(404);
    expect((await get(`/uploads/zx-${tail}-nobody.pdf`, bearer(W.a.token))).status).toBe(403);
    const zipToken = sign(W.staff.userId, "staff", { purpose: "letters-zip" });
    expect((await get(`/uploads/${W.docName}`, bearer(zipToken))).status).toBe(401);
  });

  test("cookie เปิดไฟล์: เรียก API ด้วย Bearer ได้ cookie → เปิดไฟล์ด้วย cookie ได้ · logout ล้าง cookie", async () => {
    const me = await get("/api/students/me", bearer(W.a.token));
    expect(me.status).toBe(200);
    const cookie = me.cookie.split(";")[0];
    expect(cookie).toMatch(/^coop_file=/);
    expect(me.cookie).toMatch(/HttpOnly/i);
    expect((await get(`/uploads/${W.docName}`, { Cookie: cookie })).status).toBe(200);
    const out = await fetch(`${API}/api/auth/logout`, { method: "POST", headers: { Cookie: cookie } });
    expect(out.headers.get("set-cookie") || "").toMatch(/coop_file=;/);
  });
});

test.describe("B. เข้าสู่ระบบและ session", () => {
  test("เข้าสู่ระบบ: บทบาทผิด/รหัสผิด 401 · ถูก → token ใช้ได้ · นักศึกษาในถังขยะเข้าไม่ได้", async () => {
    const signin = (body: object) => fetch(`${API}/api/auth/signin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    expect((await signin({ email: W.b.email, password: "Zx-Pass1!", role: "teacher" })).status).toBe(401);
    expect((await signin({ email: W.b.email, password: "wrong", role: "student" })).status).toBe(401);
    let r = await signin({ email: W.b.email.toUpperCase(), password: "Zx-Pass1!", role: "student", remember: false });
    expect(r.status).toBe(200);
    W.b.real = (await r.json()).token;
    expect((await get("/api/students/me", bearer(W.b.real))).status).toBe(200);
    await prisma.student.update({ where: { id: W.b.pk }, data: { deletedAt: new Date() } });
    r = await signin({ email: W.b.email, password: "Zx-Pass1!", role: "student" });
    expect(r.status).toBe(401);
    await prisma.student.update({ where: { id: W.b.pk }, data: { deletedAt: null } });
  });

  test("เปลี่ยนรหัสผ่าน: รหัสเดิมผิด 400 (ไม่ใช่ 401 — หน้าเว็บจะ logout) · ไม่ผ่านกติกา 400 · สำเร็จ → token เดิม 401 · token ใหม่ใช้ได้", async () => {
    const change = (token: string, body: object) => fetch(`${API}/api/auth/me/password`, { method: "PUT", headers: { ...bearer(token), "Content-Type": "application/json" }, body: JSON.stringify(body) });
    expect((await change(W.b.real, { currentPassword: "nope", newPassword: "Zx-Pass2!" })).status).toBe(400);
    expect((await change(W.b.real, { currentPassword: "Zx-Pass1!", newPassword: "short" })).status).toBe(400);
    const r = await change(W.b.real, { currentPassword: "Zx-Pass1!", newPassword: "Zx-Pass2!" });
    expect(r.status).toBe(200);
    const fresh = (await r.json()).token;
    expect((await get("/api/students/me", bearer(W.b.real))).status).toBe(401);
    expect((await get("/api/students/me", bearer(fresh))).status).toBe(200);
    // อาจารย์/เจ้าหน้าที่เปลี่ยนผ่านทางนี้ไม่ได้ (มีหน้าของตัวเอง)
    expect((await change(W.staff.token, { currentPassword: "x", newPassword: "Zx-Pass2!" })).status).toBe(403);
  });

  test("token ปลอม/หมดอายุ 401 · token ของบัญชีที่ถูกลบ 401", async () => {
    expect((await get("/api/auth/me", bearer("abc.def.ghi"))).status).toBe(401);
    const expired = jwt.sign({ id: W.a.userId, role: "student", tv: 0 }, process.env.JWT_SECRET, { expiresIn: -10 });
    expect((await get("/api/auth/me", bearer(expired))).status).toBe(401);
    const forged = jwt.sign({ id: W.a.userId, role: "student", tv: 0 }, "not-the-secret");
    expect((await get("/api/auth/me", bearer(forged))).status).toBe(401);
    const ghost = sign(999_999_999, "staff");
    expect((await get("/api/admin/staff", bearer(ghost))).status).toBe(401);
  });
});
