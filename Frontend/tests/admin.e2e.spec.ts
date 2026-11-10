/**
 * tests/admin.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * งานจัดการของเจ้าหน้าที่ — กรณีข้างทางที่ต้องใช้ DB จริงถึงจะเห็น (FK / ไฟล์บนดิสก์ / session)
 * backend + DB จริง (สร้างข้อมูล ZM<stamp> เอง ลบทิ้งตอนจบ · ตั้งค่า T008 คืนค่าเดิม) · ต้องรัน backend ที่ :5000
 *
 * บั๊กที่เจอรอบนี้ (ล็อกไว้ไม่ให้กลับมา):
 *   - ลบรอบสหกิจที่มีนักศึกษาได้ — FK เป็น ON DELETE SET NULL นักศึกษาทั้งรอบหลุดเป็น "ยังไม่เลือกรอบ" (unit test จำลอง P2003 ที่ไม่เคยเกิด)
 *   - ตั้งค่า T008: ชื่อรูปเดิมจาก body ถูกเก็บตรงๆ แล้วตอนเปลี่ยนรูปลบไฟล์ตามชื่อนั้น (ออกนอกโฟลเดอร์ได้)
 *   - ลบนักศึกษาถาวรแล้วไฟล์หนังสือขอนิเทศค้าง (ลบผิดโฟลเดอร์)
 *   - เพิ่มนักศึกษาด้วยรหัสที่อยู่ในถังขยะได้ข้อความกลางๆ · สร้างบัญชีเจ้าหน้าที่รหัสผ่าน 1 ตัวได้
 */
import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { api } from "./helpers/letterWorld";

const require = createRequire(import.meta.url);
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend");
require(path.join(BACKEND_DIR, "node_modules/dotenv")).config({ path: path.join(BACKEND_DIR, ".env") });
const prisma = require(path.join(BACKEND_DIR, "config/prismaClient.js"));
const jwt = require(path.join(BACKEND_DIR, "node_modules/jsonwebtoken"));
const UPLOADS = path.join(BACKEND_DIR, "uploads");

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const tail = String(stamp).slice(-5);
const tag = `zm${stamp}`;
const sign = (id: number, role: string, tv = 0) => jwt.sign({ id, role, tv }, process.env.JWT_SECRET, { expiresIn: "30m" });
const msg = (r: { body: any }) => JSON.stringify(r.body);
const created = { users: [] as number[], students: [] as number[], periods: [] as number[], teachers: [] as number[], files: [] as string[] };
let staff: { id: number; token: string };
let teacherPk = 0;
let t008Backup: { exists: boolean; value?: string } = { exists: false };

async function mkStudent(key: string, extra: { deletedAt?: Date; periodId?: number } = {}) {
  const u = await prisma.user.create({ data: { username: `${tag}-${key}`, email: `${tag}-${key}@kkumail.com`, password: "x", role: "student" } });
  const s = await prisma.student.create({
    data: { userId: u.id, studentId: `ZM${tail}${key}`, firstName: key, lastName: "ทดสอบจัดการ", email: u.email, major: "CS", deletedAt: extra.deletedAt ?? null },
  });
  if (extra.periodId !== undefined) await prisma.studentCoop.create({ data: { studentId: s.id, status: "QUALIFIED", coopPeriodId: extra.periodId } });
  created.users.push(u.id); created.students.push(s.id);
  return { userId: u.id, pk: s.id, studentId: s.studentId, token: sign(u.id, "student") };
}
async function mkPeriod(semester: number) {
  const win = { startDate: new Date(Date.now() - 86_400_000), endDate: new Date(Date.now() + 86_400_000 * 30) };
  const p = await prisma.coopPeriod.create({ data: { academicYear: `ZM${tail}`, semester, ...win, majors: { create: [{ major: "CS", ...win, isActive: false }] } } });
  created.periods.push(p.id);
  return p.id as number;
}
function touch(rel: string) {
  const full = path.join(UPLOADS, rel);
  fs.writeFileSync(full, "%PDF-1.4\nzm\n%%EOF");
  created.files.push(full);
  return full;
}
// PNG 1×1 จริง (ผ่านตัวตรวจชนิดไฟล์)
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน (cd backend && npm run dev)");
  const su = await prisma.user.create({ data: { username: `${tag}-staff`, email: `${tag}-staff@kkumail.com`, password: "x", role: "staff" } });
  await prisma.staffProfile.create({ data: { userId: su.id, firstName: "ทดสอบ", lastName: "จัดการ" } });
  created.users.push(su.id);
  staff = { id: su.id, token: sign(su.id, "staff") };
  const tu = await prisma.user.create({ data: { username: `${tag}-teacher`, email: `${tag}-teacher@kkumail.com`, password: "x", role: "teacher" } });
  const t = await prisma.teacher.create({ data: { userId: tu.id, firstName: "ทดสอบ", lastName: `ZM${tail}`, email: tu.email } });
  created.users.push(tu.id); created.teachers.push(t.id);
  teacherPk = t.id;
  const row = await prisma.systemConfig.findUnique({ where: { key: "CONFIG_T008" } });
  t008Backup = row ? { exists: true, value: row.value } : { exists: false };
});

test.afterAll(async () => {
  // ตั้งค่า T008 คืนค่าเดิม + ลบรูปที่เทสต์อัปโหลด
  const now = await prisma.systemConfig.findUnique({ where: { key: "CONFIG_T008" } });
  try { const img = JSON.parse(now?.value || "{}").imagePath; if (img && String(img).startsWith("ASSET_")) created.files.push(path.join(UPLOADS, "system", path.basename(img))); } catch { /* */ }
  if (t008Backup.exists) await prisma.systemConfig.update({ where: { key: "CONFIG_T008" }, data: { value: t008Backup.value } });
  else await prisma.systemConfig.deleteMany({ where: { key: "CONFIG_T008" } });

  const extraUsers = (await prisma.user.findMany({ where: { username: { startsWith: tag } }, select: { id: true } })).map((u: any) => u.id);
  const userIds = [...new Set([...created.users, ...extraUsers])];
  const studentIds = (await prisma.student.findMany({ where: { OR: [{ id: { in: created.students } }, { studentId: { startsWith: `ZM${tail}` } }] }, select: { id: true } })).map((s: any) => s.id);
  await prisma.supervisionAppointment.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.document.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.studentCoop.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.company.deleteMany({ where: { name: { startsWith: `บริษัท ZM${tail}` } } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.teacher.deleteMany({ where: { id: { in: created.teachers } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds }, createdAt: { gte: new Date(stamp) } } });
  await prisma.staffProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.coopPeriod.deleteMany({ where: { id: { in: created.periods } } });
  for (const f of created.files) { try { fs.unlinkSync(f); } catch { /* ลบไปแล้ว */ } }
  await prisma.$disconnect();
});

// ══════════════════════════════════════════════════════
// A. ลบรอบสหกิจ
// ══════════════════════════════════════════════════════
test.describe("A. ลบรอบสหกิจ", () => {
  test("มีนักศึกษาอยู่ → 409 นักศึกษายังอยู่รอบเดิม · มีแค่คนในถังขยะ → 409 · ไม่มีใคร → ลบได้", async () => {
    const withStudent = await mkPeriod(7);
    const onlyTrashed = await mkPeriod(8);
    const empty = await mkPeriod(9);
    const s = await mkStudent("A1", { periodId: withStudent });
    await mkStudent("A2", { periodId: onlyTrashed, deletedAt: new Date() });

    let r = await api(staff.token, "DELETE", `/api/admin/coop-periods/${withStudent}`);
    expect(r.status, msg(r)).toBe(409);
    expect(r.body.message).toMatch(/1 คน/);
    expect((await prisma.studentCoop.findUnique({ where: { studentId: s.pk } })).coopPeriodId).toBe(withStudent);
    expect(await prisma.coopPeriod.findUnique({ where: { id: withStudent } })).not.toBeNull();

    r = await api(staff.token, "DELETE", `/api/admin/coop-periods/${onlyTrashed}`);
    expect(r.status, msg(r)).toBe(409);

    r = await api(staff.token, "DELETE", `/api/admin/coop-periods/${empty}`);
    expect(r.status, msg(r)).toBe(200);
    expect(await prisma.coopPeriod.findUnique({ where: { id: empty } })).toBeNull();
  });
});

// ══════════════════════════════════════════════════════
// B. นักศึกษา: เพิ่ม · ถังขยะ · ลบถาวร · รีเซ็ตรหัสผ่าน
// ══════════════════════════════════════════════════════
test.describe("B. นักศึกษา", () => {
  test("เพิ่มด้วยรหัสที่อยู่ในถังขยะ → 409 บอกให้กู้คืน · กู้คืน → ซ้ำ 409 · ย้ายไปถังขยะซ้ำ 409", async () => {
    const t = await mkStudent("B1", { deletedAt: new Date() });
    let r = await api(staff.token, "POST", "/api/admin/students/create", { studentId: t.studentId, firstName: "ก", lastName: "ข", email: `${tag}-b1new@kkumail.com`, major: "CS" });
    expect(r.status, msg(r)).toBe(409);
    expect(r.body.message).toMatch(/ถังขยะ/);
    expect((await api(staff.token, "POST", `/api/admin/students/${t.pk}/restore`)).status).toBe(200);
    expect((await api(staff.token, "POST", `/api/admin/students/${t.pk}/restore`)).status).toBe(409);
    r = await api(staff.token, "POST", "/api/admin/students/create", { studentId: t.studentId, firstName: "ก", lastName: "ข", email: `${tag}-b1new@kkumail.com`, major: "CS" });
    expect(r.body.message).toMatch(/มีในระบบแล้ว/);
    expect((await api(staff.token, "DELETE", `/api/admin/students/${t.pk}`)).status).toBe(200);
    expect((await api(staff.token, "DELETE", `/api/admin/students/${t.pk}`)).status).toBe(409);
  });

  test("ลบถาวร: ยังไม่อยู่ถังขยะ 400 · ลบไฟล์เอกสาร + หนังสือขอนิเทศ (uploads/supervision) · หนังสือรวมที่เพื่อนใช้ไม่ลบ", async () => {
    const u = await mkStudent("B2");
    const v = await mkStudent("B3");
    const docFile = touch(`zm-${tail}-doc.pdf`);
    const ownLetter = touch(`supervision/zm-${tail}-own.pdf`);
    const shared = touch(`supervision/zm-${tail}-group.pdf`);
    await prisma.document.create({ data: { studentId: u.pk, type: "CP-CV", path: path.basename(docFile), name: "cv.pdf", status: "APPROVED" } });
    await prisma.supervisionAppointment.create({ data: { studentId: u.pk, teacherId: teacherPk, proposedDates: "[]", supervisionType: "ONSITE", status: "COMPLETED", officialLetterPath: path.basename(ownLetter) } });
    await prisma.supervisionAppointment.create({ data: { studentId: v.pk, teacherId: teacherPk, proposedDates: "[]", supervisionType: "ONSITE", status: "COMPLETED", officialLetterPath: path.basename(shared) } });

    expect((await api(staff.token, "DELETE", `/api/admin/students/${u.pk}/permanent`)).status).toBe(400);
    expect((await api(staff.token, "DELETE", `/api/admin/students/${u.pk}`)).status).toBe(200);
    const r = await api(staff.token, "DELETE", `/api/admin/students/${u.pk}/permanent`);
    expect(r.status, msg(r)).toBe(200);
    expect(await prisma.student.findUnique({ where: { id: u.pk } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: u.userId } })).toBeNull();
    expect([fs.existsSync(docFile), fs.existsSync(ownLetter)]).toEqual([false, false]);
    expect(fs.existsSync(shared)).toBe(true); // ของ v — คนละนัด ยังอ้างถึงอยู่
  });

  test("รีเซ็ตรหัสผ่าน → session เดิมของนักศึกษาใช้ไม่ได้ (401) · ดูรหัสผ่าน = รหัสนักศึกษา · อาจารย์ดูไม่ได้", async () => {
    const s = await mkStudent("B4");
    expect((await api(s.token, "GET", "/api/students/me")).status).toBe(200);
    let r = await api(staff.token, "PATCH", `/api/admin/students/${s.pk}/reset-password`);
    expect(r.status, msg(r)).toBe(200);
    expect((await api(s.token, "GET", "/api/students/me")).status).toBe(401);
    r = await api(staff.token, "POST", `/api/admin/students/${s.pk}/password/reveal`);
    expect(r.status, msg(r)).toBe(200);
    expect(r.body.data.password).toBe(s.studentId);
    const teacherUser = created.users[1];
    expect((await api(sign(teacherUser, "teacher"), "POST", `/api/admin/students/${s.pk}/password/reveal`)).status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════
// C. ตั้งค่า T008 — รูปประกอบ
// ══════════════════════════════════════════════════════
test.describe("C. ตั้งค่า T008", () => {
  const put = (fields: Record<string, string>, image = false) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    if (image) fd.append("image", new Blob([PNG], { type: "image/png" }), "cover.png");
    return api(staff.token, "PUT", "/api/admin/config/t008", fd);
  };
  const stored = async () => JSON.parse((await prisma.systemConfig.findUnique({ where: { key: "CONFIG_T008" } })).value);

  test("ชื่อรูปเดิมที่ไม่ใช่รูปที่ตั้งไว้ → ไม่เก็บ · เปลี่ยนรูปไม่ลบไฟล์นอกโฟลเดอร์ system", async () => {
    // ตั้งค่าของเทสต์เองก่อน (ไม่ผ่าน server) — ไม่งั้นรูปจริงของเครื่องนี้จะถูกนับเป็น "รูปเดิม" แล้วถูกลบตอนเปลี่ยน (คืนค่าเดิมใน afterAll)
    await prisma.systemConfig.upsert({
      where: { key: "CONFIG_T008" },
      update: { value: JSON.stringify({ instructionText: "ทดสอบ", imagePath: null }) },
      create: { key: "CONFIG_T008", value: JSON.stringify({ instructionText: "ทดสอบ", imagePath: null }) },
    });
    let r = await put({ instructionText: "ทดสอบ", existingImage: "../../server.js" });
    expect(r.status, msg(r)).toBe(200);
    expect((await stored()).imagePath).toBeNull();

    // ค่าเก่าที่เคยถูกตั้งเป็น path นอกโฟลเดอร์ (ก่อนแก้) → อัปโหลดรูปใหม่ต้องไม่ลบไฟล์นั้น
    const marker = touch(`zm-${tail}-marker.pdf`);
    await prisma.systemConfig.update({ where: { key: "CONFIG_T008" }, data: { value: JSON.stringify({ instructionText: "ทดสอบ", imagePath: `../${path.basename(marker)}` }) } });
    r = await put({ instructionText: "ทดสอบ" }, true);
    expect(r.status, msg(r)).toBe(200);
    expect(fs.existsSync(marker)).toBe(true);
    const img = (await stored()).imagePath;
    expect(fs.existsSync(path.join(UPLOADS, "system", img))).toBe(true);

    // ไม่เปลี่ยนรูป → คงไว้ · เอารูปออก → ลบไฟล์รูป
    r = await put({ instructionText: "ทดสอบ", existingImage: img });
    expect((await stored()).imagePath).toBe(img);
    r = await put({ instructionText: "ทดสอบ", existingImage: "" });
    expect((await stored()).imagePath).toBeNull();
    expect(fs.existsSync(path.join(UPLOADS, "system", img))).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
// C2. ลบบริษัทที่มีนักศึกษาเลือกอยู่ — เจ้าหน้าที่ต้องยืนยันพร้อมรายชื่อ (เดิมลบเงียบๆ บริษัทของนักศึกษาว่าง)
// ══════════════════════════════════════════════════════
test.describe("C2. ลบบริษัทที่มีนักศึกษาเลือกอยู่", () => {
  async function mkCompany(name: string, studentKey?: string) {
    const c = await prisma.company.create({ data: { name: `บริษัท ZM${tail} ${name}`, address: "ขอนแก่น", province: "ขอนแก่น" } });
    let s: Awaited<ReturnType<typeof mkStudent>> | null = null;
    if (studentKey) {
      s = await mkStudent(studentKey);
      await prisma.studentCoop.create({ data: { studentId: s.pk, status: "INTERNSHIP_STARTED", companyId: c.id } });
    }
    return { id: c.id as string, name: c.name as string, s };
  }

  test("API: นักศึกษาลบไม่ได้ (409) · เจ้าหน้าที่ได้ 409 พร้อมรายชื่อ ยังไม่ลบ · ยืนยัน ?confirm=1 → ลบ บริษัทของนักศึกษาว่าง · ไม่มีใครเลือก → ลบเลย", async () => {
    const used = await mkCompany("ใช้อยู่", "C2a");
    const other = await mkStudent("C2b");
    expect((await api(other.token, "DELETE", `/api/companies/${used.id}`)).status).toBe(409);

    let r = await api(staff.token, "DELETE", `/api/companies/${used.id}`);
    expect(r.status, msg(r)).toBe(409);
    expect(r.body).toMatchObject({ code: "COMPANY_IN_USE", students: [{ studentId: used.s!.studentId, name: "C2a ทดสอบจัดการ", trashed: false }] });
    expect(await prisma.company.findUnique({ where: { id: used.id } })).not.toBeNull();

    r = await api(staff.token, "DELETE", `/api/companies/${used.id}?confirm=1`);
    expect(r.status, msg(r)).toBe(200);
    expect(await prisma.company.findUnique({ where: { id: used.id } })).toBeNull();
    expect((await prisma.studentCoop.findUnique({ where: { studentId: used.s!.pk } })).companyId).toBeNull();

    const free = await mkCompany("ว่าง");
    expect((await api(staff.token, "DELETE", `/api/companies/${free.id}`)).status).toBe(200);
  });

  test("หน้าเว็บ: กดลบ → ยืนยันครั้งแรก → ขึ้นกล่องเตือนพร้อมรายชื่อ → ยกเลิกไม่ลบ · ยืนยัน → ลบ", async ({ page }) => {
    const c = await mkCompany("หน้าเว็บ", "C2c");
    await page.goto("/");
    await page.evaluate(([t, uid]) => { localStorage.clear(); localStorage.setItem("coop.token", t); localStorage.setItem("coop.userId", uid); }, [staff.token, String(staff.id)]);
    await page.goto("/admin/company", { waitUntil: "networkidle" });
    await page.getByPlaceholder(/ค้นหา/).first().fill(c.name);
    const row = page.locator("tbody tr", { hasText: c.name });
    const dialog = page.locator('[role="dialog"][aria-modal="true"]');

    await row.getByRole("button", { name: "🗑️ ลบ" }).click();
    await dialog.getByRole("button", { name: "ลบบริษัท" }).click();
    await expect(dialog.getByText("บริษัทนี้มีนักศึกษาเลือกอยู่")).toBeVisible();
    await expect(dialog.getByText(new RegExp(`${c.s!.studentId} C2c`))).toBeVisible();
    await dialog.getByRole("button", { name: "ยกเลิก" }).click();
    expect(await prisma.company.findUnique({ where: { id: c.id } })).not.toBeNull();

    await row.getByRole("button", { name: "🗑️ ลบ" }).click();
    await dialog.getByRole("button", { name: "ลบบริษัท" }).click();
    await dialog.getByRole("button", { name: "ยืนยันลบ" }).click();
    await expect(row).toHaveCount(0);
    expect(await prisma.company.findUnique({ where: { id: c.id } })).toBeNull();
  });
});

// ══════════════════════════════════════════════════════
// D. เจ้าหน้าที่ · แจ้งเตือน
// ══════════════════════════════════════════════════════
test.describe("D. เจ้าหน้าที่ / แจ้งเตือน", () => {
  test("สร้างบัญชีรหัสผ่านสั้น 400 · สร้างได้ · รีเซ็ตสั้น 400 · ลบตัวเอง 400 · ลบคนอื่นได้", async () => {
    const body = { username: `${tag}-staff2`, email: `${tag}-staff2@kkumail.com`, firstName: "ใหม่", lastName: "เจ้าหน้าที่" };
    expect((await api(staff.token, "POST", "/api/admin/staff", { ...body, password: "1" })).status).toBe(400);
    const r = await api(staff.token, "POST", "/api/admin/staff", { ...body, password: "Abc12345!" });
    expect(r.status, msg(r)).toBe(201);
    const id = r.body.staff.id;
    expect((await api(staff.token, "PATCH", `/api/admin/staff/${id}/password`, { password: "12" })).status).toBe(400);
    expect((await api(staff.token, "DELETE", `/api/admin/staff/${staff.id}`)).status).toBe(400);
    expect((await api(staff.token, "DELETE", `/api/admin/staff/${id}`)).status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id } })).toBeNull();
  });

  test("อ่านแจ้งเตือนได้เฉพาะของตัวเอง", async () => {
    const a = await mkStudent("D1");
    const b = await mkStudent("D2");
    for (const s of [a, b]) await prisma.notification.create({ data: { userId: s.userId, type: "DOCS_UPDATED", title: "t", message: "m", link: "/" } });
    expect((await api(a.token, "POST", "/api/notifications/mark-read", { types: ["DOCS_UPDATED"] })).status).toBe(200);
    expect((await api(a.token, "POST", "/api/notifications/mark-all-read")).status).toBe(200);
    const unread = await prisma.notification.count({ where: { userId: { in: [a.userId, b.userId] }, isRead: false } });
    expect(unread).toBe(1); // ของ b ยังไม่อ่าน
    expect((await api(a.token, "POST", "/api/notifications/mark-read", { types: ["bad type"] })).status).toBe(400);
  });
});
