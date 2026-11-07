/**
 * tests/system.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * ส่วนที่เหลือของระบบ — กำหนดส่งฝั่งนักศึกษา (ไทม์ไลน์ของรอบ · ช่วงยื่นคำร้อง · /config/* · การเตือนใกล้ปิดรับ)
 * · หน้าระบบของเจ้าหน้าที่ (ความพร้อมของหลักสูตร · ขอบเขต · สถานะระบบ · ตัวกรองบันทึกการใช้งาน · ตั้งค่าแบบประเมิน)
 * · บัญชี (เข้าสู่ระบบ · เปลี่ยนรหัสผ่าน · ออกจากระบบ · Google)
 * — backend + DB จริง หลักสูตรทดสอบ X/Y (prefix ZZ: รอบทดสอบเรียงเป็น "รอบล่าสุด" ที่หน้าความพร้อมใช้) — ข้อมูล ZZ ลบทิ้งตอนจบ
 */
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { createRequire } from "node:module";
import { api, type Res } from "./helpers/letterWorld";
import { WorldKit, prisma, day, BACKEND_DIR, type KStudent, type KTeacher, type KUser } from "./helpers/worldKit";

const req = createRequire(import.meta.url);
const bcrypt = req(path.join(BACKEND_DIR, "node_modules/bcryptjs"));
const reminders = req(path.join(BACKEND_DIR, "utils/deadlineReminders.js"));
const k = new WorldKit("ZZ");
test.describe.configure({ mode: "serial" });
const msg = (r: Res) => JSON.stringify(r.body);
const C = () => `${k.prefix}${k.tail}`;
const PW = "Zz!secure123";
async function post(url: string, body: object) {
  const r = await fetch(`http://localhost:5000${url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
}
const jwtPayload = (token: string) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

let staff: KUser;
let X = "", Y = "", P = 0;
const t = {} as Record<"coopX" | "plainX" | "legacy", KTeacher>;
const s = {} as Record<"x" | "y" | "none" | "noMajor" | "intern" | "internDone" | "trash" | "login", KStudent>;
const DEADLINES = {
  T000: { due: day(-2), mode: "HARD" }, T002: { due: day(-1), mode: "SOFT" }, T003: { due: day(2), mode: "HARD" },
  T005_T006: { due: day(30) }, T007: { due: day(40) }, T008: { due: day(50) },
};

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน");
  staff = await k.staff();
  X = await k.major("X", "หลักสูตรเอ็กซ์");
  Y = await k.major("Y", "หลักสูตรวาย");
  P = await k.period(1, { [X]: { deadlines: DEADLINES }, [Y]: { isActive: false } });
  await prisma.coopPeriodMajor.update({ where: { periodId_major: { periodId: P, major: X } }, data: { supervisionStartDate: new Date(`${day(10)}T00:00:00+07:00`), supervisionEndDate: new Date(`${day(20)}T00:00:00+07:00`) } });
  t.coopX = await k.teacher("ประจำวิชาX", { major: X, coop: [X] });
  t.plainX = await k.teacher("ทั่วไปX", { major: X });
  t.legacy = await k.teacher("หลักสูตรเก่า", { major: `${C()}OLD` });
  s.x = await k.student("x", 1, { major: X, status: "QUALIFIED", periodId: P });
  s.y = await k.student("y", 2, { major: Y, status: "QUALIFIED", periodId: P });
  s.none = await k.student("none", 3, { major: X, status: null });
  s.noMajor = await k.student("nomajor", 4, { major: null });
  s.intern = await k.student("intern", 5, { major: X, status: "INTERNSHIP_STARTED", periodId: P });
  s.internDone = await k.student("internDone", 6, { major: X, status: "INTERNSHIP_STARTED", periodId: P, docs: [{ type: "T003_FORM" }] });
  s.trash = await k.student("trash", 7, { major: X, status: "INTERNSHIP_STARTED", periodId: P });
  s.login = await k.student("login", 8, { major: X });
  await prisma.student.update({ where: { id: s.trash.pk }, data: { deletedAt: new Date() } });
  await prisma.studentCoop.update({ where: { studentId: s.x.pk }, data: { deadlineExtensions: { T000: day(3) }, submittedSteps: { T003: { at: new Date(Date.now() - 86_400_000).toISOString() } } } });
  await prisma.user.update({ where: { id: s.login.userId }, data: { password: bcrypt.hashSync(PW, 8) } });
  await k.snapshot("EVALUATION_FORMS");
});
test.afterAll(async () => { await k.cleanup(); await k.disconnect(); });

// ══════════════════════════════════════════════════════
// A. กำหนดส่งฝั่งนักศึกษา
// ══════════════════════════════════════════════════════
test.describe("A. กำหนดส่งของนักศึกษา", () => {
  test("ไทม์ไลน์ของรอบ: ทุกขั้นเรียงตามปฏิทิน · วันขยายรายคน · ส่งแล้ว (ไม่ช้า) · ช่วงนิเทศ · ไม่มีรอบ = ว่าง · อาจารย์ 403 · ถังขยะ 401", async () => {
    const r = await api(s.x.token, "GET", "/api/coop/round-deadlines");
    expect(r.status, msg(r)).toBe(200);
    expect(r.body.period).toEqual({ id: P, academicYear: C(), semester: 1 });
    const steps = Object.fromEntries(r.body.steps.map((x: { stepKey: string }) => [x.stepKey, x]));
    expect(r.body.steps.map((x: { stepKey: string }) => x.stepKey)).toEqual(["APPLY", "T000", "T002", "T003", "SUPERVISION", "T005_T006", "T007", "T008"]);
    expect(steps.APPLY).toMatchObject({ isOpen: true, due: day(120) });
    expect(steps.T000).toMatchObject({ due: day(-2), mode: "HARD", canSubmit: true, late: true, extensionUntil: day(3), source: "ROUND" });
    expect(steps.T002).toMatchObject({ due: day(-1), mode: "SOFT", canSubmit: true, late: true });
    expect(steps.T003).toMatchObject({ due: day(2), canSubmit: true, late: false, submittedLate: false });
    expect(steps.T003.submittedAt).toBeTruthy();
    expect(steps.SUPERVISION).toMatchObject({ startDate: day(10), due: day(20) });
    expect([steps.T005_T006.due, steps.T007.due, steps.T008.due]).toEqual([day(30), day(40), day(50)]);
    const yr = await api(s.y.token, "GET", "/api/coop/round-deadlines");     // หลักสูตร Y ยังไม่ตั้งขั้น → ค่าเดิม
    expect(yr.body.steps.find((x: { stepKey: string }) => x.stepKey === "T000").source).toBe("LEGACY");
    expect((await api(s.none.token, "GET", "/api/coop/round-deadlines")).body).toEqual({ ok: true, period: null, steps: [] });
    expect((await api(t.coopX.token, "GET", "/api/coop/round-deadlines")).status).toBe(403);
    expect((await api(s.trash.token, "GET", "/api/coop/round-deadlines")).status).toBe(401);
  });

  test("/config/t000·t002·t003·evaluation·t007·t008 ตรงกับไทม์ไลน์ · ยังไม่มีรอบ = ส่งได้ไม่มีกำหนด · เจ้าหน้าที่ได้ค่ากลาง", async () => {
    const get = async (tk: string, key: string) => (await api(tk, "GET", `/api/coop/config/${key}`)).body;
    expect(await get(s.x.token, "t000")).toMatchObject({ endDate: day(-2), isOpen: true, late: true, closed: false });
    expect(await get(s.x.token, "t002")).toMatchObject({ endDate: day(-1), isOpen: true, late: true });
    expect(await get(s.x.token, "t003")).toMatchObject({ endDate: day(2), isOpen: true, late: false });
    expect((await get(s.x.token, "evaluation")).config.deadline).toBe(day(30));
    expect((await get(s.x.token, "t007")).config.deadline).toBe(day(40));
    expect((await get(s.x.token, "t008")).config.deadline).toBe(day(50));
    expect(await get(s.none.token, "t000")).toMatchObject({ endDate: null, isOpen: true });
    const staffView = await get(staff.token, "t000");
    expect(staffView).toHaveProperty("isOpen");
    expect(staffView).not.toHaveProperty("late");
  });

  test("ช่วงยื่นคำร้อง: รอบของหลักสูตรเปิด = ยื่นได้ · ปิด/ยังไม่ระบุหลักสูตร = ปิดพร้อมข้อความ · เลยวันปิดแต่ลืมกดปิด → ปิดให้เอง (บันทึกลงระบบ)", async () => {
    const apply = async (tk: string) => (await api(tk, "GET", "/api/coop/config/apply")).body;
    expect(await apply(s.x.token)).toMatchObject({ isOpen: true, endDate: day(120), state: { open: true, message: null } });
    for (const who of [s.y, s.noMajor]) {
      const r = await apply(who.token);
      expect([r.isOpen, r.state.message]).toEqual([false, "ขณะนี้ปิดรับคำร้องขอเข้าร่วมสหกิจศึกษา"]);
    }
    const where = { periodId_major: { periodId: P, major: X } };
    const before = await prisma.coopPeriodMajor.findUnique({ where });
    await prisma.coopPeriodMajor.update({ where, data: { endDate: new Date(Date.now() - 3 * 86_400_000) } });
    try {
      expect((await apply(s.x.token)).isOpen).toBe(false);
      expect((await prisma.coopPeriodMajor.findUnique({ where })).isActive).toBe(false);
    } finally {
      await prisma.coopPeriodMajor.update({ where, data: { endDate: before.endDate, isActive: true } });
    }
  });

  test("(ใหม่) ยังไม่ถึงวันเปิดรับสมัคร: เปิดสวิตช์ไว้ก็ยื่นไม่ได้ (หน้าเว็บ/ไทม์ไลน์/ยื่นจริง) · เปิดหลายรอบ = รอบที่ถึงวันเปิดแล้วมาก่อน", async () => {
    const where = { periodId_major: { periodId: P, major: X } };
    const before = await prisma.coopPeriodMajor.findUnique({ where });
    const applyForm = (periodId: number) => { const fd = new FormData(); fd.append("coopPeriodId", String(periodId)); fd.append("jobPosition", "dev"); return fd; };
    await prisma.coopPeriodMajor.update({ where, data: { startDate: new Date(`${day(5)}T00:00:00+07:00`) } });
    let next = 0;
    try {
      const w = (await api(s.none.token, "GET", "/api/coop/config/apply")).body;
      expect([w.isOpen, w.state.reason, w.startDate]).toEqual([false, "NOT_YET", day(5)]);
      expect(w.state.message).toMatch(/^ยังไม่ถึงช่วงเวลายื่นคำร้อง \(ช่วงยื่นคำร้อง /);
      const tl = (await api(s.x.token, "GET", "/api/coop/round-deadlines")).body.steps[0];
      expect([tl.stepKey, tl.isOpen, tl.startDate]).toEqual(["APPLY", false, day(5)]);
      const r = await api(s.none.token, "POST", "/api/coop/apply", applyForm(P));
      expect(r.status, msg(r)).toBe(400);
      expect(r.body.message).toMatch(/ยังไม่ถึงช่วงเวลายื่นคำร้อง/);
      expect(await k.coop(s.none.pk)).toBeNull();

      // รอบหน้าเปิดไว้ล่วงหน้า (ยังไม่ถึงวันเปิด) + รอบปัจจุบันเปิดอยู่ → นักศึกษาเห็น/ยื่นรอบปัจจุบัน
      await prisma.coopPeriodMajor.update({ where, data: { startDate: before.startDate } });
      next = await k.period(2, { [X]: {} });
      await prisma.coopPeriodMajor.update({ where: { periodId_major: { periodId: next, major: X } }, data: { startDate: new Date(`${day(30)}T00:00:00+07:00`), endDate: new Date(`${day(200)}T00:00:00+07:00`) } });
      const w2 = (await api(s.none.token, "GET", "/api/coop/config/apply")).body;
      expect([w2.isOpen, w2.endDate]).toEqual([true, day(120)]);
      expect((await api(s.none.token, "GET", "/api/students/coop-periods/active")).body.period.id).toBe(P);
    } finally {
      await prisma.coopPeriodMajor.update({ where, data: { startDate: before.startDate } });
      if (next) await prisma.coopPeriod.delete({ where: { id: next } });   // ไม่ให้เป็น "รอบล่าสุด" ของเทสต์ความพร้อม
    }
  });

  test("เตือนใกล้ปิดรับ (เหลือ 0–3 วัน · โหมดปิดรับเท่านั้น): นับวันขยาย · ส่งแล้ว/มีไฟล์แล้ว/ถังขยะ/คนละขั้นไม่เตือน · ปิดรับชั่วคราวไม่เตือน", async () => {
    const ours = new Set(Object.values(s).map((x) => x.userId));
    const who = async (step: string) => (await reminders.findStudentsToRemind(step)).filter((x: { userId: number }) => ours.has(x.userId));
    expect(await who("T000")).toEqual([{ userId: s.x.userId, due: day(3) }]);           // เลยกำหนดแล้วแต่ขยายถึงอีก 3 วัน
    expect(await who("T003")).toEqual([{ userId: s.intern.userId, due: day(2) }]);      // internDone มีไฟล์ · trash อยู่ถังขยะ · x ส่งแล้ว/คนละขั้น
    expect(await who("T002")).toEqual([]);                                              // SOFT ไม่เตือน
    const where = { periodId_major: { periodId: P, major: X } };
    await prisma.coopPeriodMajor.update({ where, data: { deadlines: { ...DEADLINES, T003: { ...DEADLINES.T003, closed: true } } } });
    try {
      expect(await who("T003")).toEqual([]);
    } finally {
      await prisma.coopPeriodMajor.update({ where, data: { deadlines: DEADLINES } });
    }
  });
});

// ══════════════════════════════════════════════════════
// B. หน้าระบบของเจ้าหน้าที่
// ══════════════════════════════════════════════════════
test.describe("B. หน้าระบบ", () => {
  test("ความพร้อมของหลักสูตร: X พร้อม (ตั้งรอบล่าสุด + อาจารย์ประจำวิชา) · Y ยังไม่พร้อม (ไม่มีอาจารย์ประจำวิชา) · หลักสูตรที่ไม่อยู่ในระบบ = เจ้าหน้าที่เห็นคนเดียว · ประจำวิชาเห็นเฉพาะของตัวเอง", async () => {
    const r = await api(staff.token, "GET", "/api/admin/major-readiness");
    expect(r.status, msg(r)).toBe(200);
    expect(r.body.period).toEqual({ academicYear: C(), semester: 1 });
    const item = (m: string) => r.body.items.find((i: { major: string }) => i.major === m);
    const check = (m: string, key: string) => item(m).checks.find((c: { key: string }) => c.key === key);
    expect([item(X).ready, check(X, "period").ok, check(X, "coopTeacher").ok, check(X, "teachers").ok]).toEqual([true, true, true, true]);
    expect(item(X).students).toBe(5);                                                     // x/none/intern/internDone/login — ไม่นับถังขยะ
    expect([item(Y).ready, check(Y, "period").ok, check(Y, "coopTeacher").ok]).toEqual([false, true, false]);
    expect(r.body.unregistered).toEqual(expect.arrayContaining([{ major: `${C()}OLD`, teachers: 1, students: 0 }]));
    const coop = await api(t.coopX.token, "GET", "/api/admin/major-readiness");
    expect([coop.body.items.map((i: { major: string }) => i.major), coop.body.unregistered]).toEqual([[X], []]);
    expect((await api(t.plainX.token, "GET", "/api/admin/major-readiness")).status).toBe(403);
    expect((await api(s.x.token, "GET", "/api/admin/major-readiness")).status).toBe(403);
  });

  test("ขอบเขต (my-scope) · หลักสูตรทั้งหมด · คำนำหน้าอาจารย์ · สถานะระบบ = เจ้าหน้าที่เท่านั้น", async () => {
    expect((await api(staff.token, "GET", "/api/admin/my-scope")).body).toMatchObject({ all: true });
    expect((await api(t.coopX.token, "GET", "/api/admin/my-scope")).body).toMatchObject({ all: false, majors: [X] });
    expect((await api(t.plainX.token, "GET", "/api/admin/my-scope")).body).toMatchObject({ all: false, majors: [] });
    expect((await api(s.x.token, "GET", "/api/admin/my-scope")).status).toBe(403);
    const deps = (await api(s.x.token, "GET", "/api/coop/departments")).body.departments;
    expect(deps).toEqual(expect.arrayContaining([{ major: X, nameTh: "หลักสูตรเอ็กซ์" }]));
    expect((await api(staff.token, "GET", "/api/teacher/prefixes")).body.prefixes).toContain("อ.");
    expect((await api(s.x.token, "GET", "/api/teacher/prefixes")).status).toBe(403);
    const st = await api(staff.token, "GET", "/api/status");
    expect([st.status, st.body.database.status, st.body.backend.status]).toEqual([200, "ok", "ok"]);
    expect((await api(t.coopX.token, "GET", "/api/status")).status).toBe(403);
  });

  test("ตั้งค่าแบบประเมิน T005/T006: ประจำวิชาดูได้ แก้ไม่ได้ · วันที่ไม่มีจริง/ลิงก์ไม่ปลอดภัย 400 · นักศึกษาได้ลิงก์ใหม่ + กำหนดส่งจากรอบ (ไม่มีรอบ = กำหนดส่งในค่าตั้ง) · บันทึกการใช้งานกรองตามผู้ทำได้", async () => {
    expect((await api(t.coopX.token, "GET", "/api/admin/config/evaluation")).status).toBe(200);
    const body = { instructionText: `${C()} คำชี้แจง`, ccEmails: "a@kku.ac.th", t005Link: "https://zz.example.com/t005", t006Link: "https://zz.example.com/t006", templateLink: "", deadline: day(60) };
    expect((await api(t.coopX.token, "PUT", "/api/admin/config/evaluation", body)).status).toBe(403);
    expect((await api(staff.token, "PUT", "/api/admin/config/evaluation", { ...body, deadline: "2026-02-31" })).status).toBe(400);
    expect((await api(staff.token, "PUT", "/api/admin/config/evaluation", { ...body, t005Link: "javascript:alert(1)" })).status).toBe(400);
    const r = await api(staff.token, "PUT", "/api/admin/config/evaluation", body);
    expect(r.status, msg(r)).toBe(200);
    const mine = (await api(s.x.token, "GET", "/api/coop/config/evaluation")).body.config;
    expect([mine.t005Link, mine.deadline]).toEqual(["https://zz.example.com/t005", day(30)]);
    expect((await api(s.none.token, "GET", "/api/coop/config/evaluation")).body.config.deadline).toBe(day(60));

    await expect.poll(async () => {
      const a = (await api(staff.token, "GET", "/api/admin/logs/actors")).body.actors;
      return a.some((x: { userId: number; role: string }) => x.userId === staff.userId && x.role === "staff");
    }).toBe(true);
    const teachers = (await api(staff.token, "GET", "/api/admin/logs/actors?role=teacher")).body.actors;
    expect(teachers.every((x: { role: string }) => x.role === "teacher")).toBe(true);
    expect((await api(t.coopX.token, "GET", "/api/admin/logs/actors")).status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════
// C. บัญชีและการเข้าสู่ระบบ
// ══════════════════════════════════════════════════════
test.describe("C. บัญชี", () => {
  test("เข้าสู่ระบบ: ช่องไม่ครบ/บทบาทผิด 400 · ไม่มีบัญชี/รหัสผิด/เลือกบทบาทไม่ตรงบัญชี 401 · อีเมลพิมพ์ใหญ่ได้ · จำการเข้าสู่ระบบ 30 วัน / ไม่จำ 8 ชม.", async () => {
    expect((await post("/api/auth/signin", { email: s.login.email })).status).toBe(400);
    expect((await post("/api/auth/signin", { email: s.login.email, password: PW, role: "admin" })).status).toBe(400);
    expect((await post("/api/auth/signin", { email: `nobody-${k.tag}@kkumail.com`, password: PW, role: "student" })).status).toBe(401);
    expect((await post("/api/auth/signin", { email: s.login.email, password: "wrong", role: "student" })).status).toBe(401);
    expect((await post("/api/auth/signin", { email: s.login.email, password: PW, role: "teacher" })).status).toBe(401);
    const long = await post("/api/auth/signin", { email: s.login.email.toUpperCase(), password: PW, role: "student", remember: true });
    expect(long.status, msg(long)).toBe(200);
    const me = await api(long.body.token, "GET", "/api/auth/me");
    expect(me.body.user).toMatchObject({ role: "student", studentId: s.login.studentId });
    const short = await post("/api/auth/signin", { email: s.login.email, password: PW, role: "student", remember: false });
    const ttl = (tk: string) => { const p = jwtPayload(tk); return p.exp - p.iat; };
    expect([ttl(long.body.token), ttl(short.body.token)]).toEqual([30 * 86_400, 8 * 3_600]);
  });

  test("เปลี่ยนรหัสผ่าน (นักศึกษา): ไม่ครบ 400 · รหัสเดิมผิด = 400 ไม่ใช่ 401 (ไม่เด้งออก) · รหัสใหม่อ่อน 400 · สำเร็จ = token เดิมใช้ไม่ได้ ได้ token ใหม่ · อาจารย์ 403", async () => {
    const old = (await post("/api/auth/signin", { email: s.login.email, password: PW, role: "student" })).body.token;
    expect((await api(t.plainX.token, "PUT", "/api/auth/me/password", { currentPassword: "x", newPassword: "Zz!another123" })).status).toBe(403);
    expect((await api(old, "PUT", "/api/auth/me/password", { currentPassword: PW })).status).toBe(400);
    expect((await api(old, "PUT", "/api/auth/me/password", { currentPassword: "wrong", newPassword: "Zz!another123" })).status).toBe(400);
    expect((await api(old, "PUT", "/api/auth/me/password", { currentPassword: PW, newPassword: "abc" })).status).toBe(400);
    const r = await api(old, "PUT", "/api/auth/me/password", { currentPassword: PW, newPassword: "Zz!another123" });
    expect(r.status, msg(r)).toBe(200);
    expect((await api(old, "GET", "/api/auth/me")).status).toBe(401);
    expect((await api(r.body.token, "GET", "/api/auth/me")).status).toBe(200);
    expect((await post("/api/auth/signin", { email: s.login.email, password: PW, role: "student" })).status).toBe(401);
    expect((await post("/api/auth/signin", { email: s.login.email, password: "Zz!another123", role: "student" })).status).toBe(200);
  });

  // ทดสอบโหลด 2026-11-07: ทั้งคณะใช้ IP เดียว — เดิมตัวกันเดารหัสนับรวมทั้ง IP (30): เข้าพร้อมกันเกิน 30 คนโดน 429 ทั้งที่รหัสถูก
  //   และคนละครั้งที่พิมพ์ผิดรวม 30 คน = ทั้ง IP เข้าไม่ได้ 15 นาที
  test("(ใหม่) ตัวกันเดารหัส: 60 คนเข้าพร้อมกัน (รหัสถูก) เข้าได้ทุกคน · บัญชีหนึ่งพิมพ์ผิดครบ 30 ครั้ง = ล็อกเฉพาะบัญชีนั้น คนอื่นยังเข้าได้", async () => {
    test.setTimeout(120_000);
    const crowd = await Promise.all(Array.from({ length: 60 }, (_, i) => k.student(`crowd${i}`, 30 + i, { major: X, status: null })));
    const hash = bcrypt.hashSync(PW, 8);
    await prisma.user.updateMany({ where: { id: { in: crowd.map((c) => c.userId) } }, data: { password: hash } });
    const all = await Promise.all(crowd.map((c) => post("/api/auth/signin", { email: c.email, password: PW, role: "student" })));
    expect(all.map((r) => r.status).filter((x) => x !== 200)).toEqual([]);

    const [victim, other] = crowd;
    for (let i = 0; i < 30; i++) expect((await post("/api/auth/signin", { email: victim.email, password: "wrong", role: "student" })).status).toBe(401);
    expect((await post("/api/auth/signin", { email: victim.email, password: PW, role: "student" })).status).toBe(429);
    expect((await post("/api/auth/signin", { email: other.email, password: PW, role: "student" })).status).toBe(200);
  });

  test("ออกจากระบบล้าง cookie เปิดไฟล์ (ไม่ต้องมี token) · Google: ไม่มี token/token ปลอม ไม่ผ่าน (ไม่ใช่ 500)", async () => {
    const out = await post("/api/auth/logout", {});
    expect(out.status).toBe(200);
    expect(out.headers.get("set-cookie") || "").toMatch(/coop_file=;.*(Expires=Thu, 01 Jan 1970|Max-Age=0)/i);
    const none = await post("/api/auth/login/google", {});
    expect([400, 503]).toContain(none.status);
    const fake = await post("/api/auth/login/google", { id_token: "not-a-real-token" });
    expect([401, 503]).toContain(fake.status);
  });
});

// ══════════════════════════════════════════════════════
// หน้าเว็บ
// ══════════════════════════════════════════════════════
test.use({ timezoneId: "Asia/Bangkok" });
async function asUser(page: Page, token: string, userId: number, to: string) {
  await page.goto("/");
  await page.evaluate(([tk, uid]) => {
    localStorage.clear();
    localStorage.setItem("coop.token", tk); localStorage.setItem("coop.userId", uid); localStorage.setItem("coop.theme", "light");
  }, [token, String(userId)]);
  await page.goto(to, { waitUntil: "networkidle" });
}

test.describe("D. หน้าเว็บ", () => {
  test("แดชบอร์ดนักศึกษา: ไทม์ไลน์กำหนดส่งของรอบ (เทอม/ปี · วันขยาย)", async ({ page }) => {
    await asUser(page, s.x.token, s.x.userId, "/student");
    await expect(page.getByText(`📆 กำหนดส่งของรอบคุณ · เทอม 1/${C()}`)).toBeVisible();
    await expect(page.getByText(/ขยายให้ถึง/)).toBeVisible();
  });

  // เดิมไม่มีตัวรับข้อผิดพลาด: โหลดโค้ดของหน้าไม่ได้ (เช่น หลัง deploy แท็บเดิมอ้างไฟล์ที่ถูกลบ) = จอขาวทั้งจอ
  test("(ใหม่) โหลดโค้ดของหน้าไม่ได้: โหลดใหม่ให้เองครั้งเดียว · ยังไม่ได้ = ข้อความ + ปุ่มโหลดใหม่ (ไม่ใช่จอขาว) · กดแล้วกลับมาใช้ได้", async ({ page }) => {
    let block = true;
    await page.route(/\/src\/components\/S_Dashboard\.tsx/, (r) => (block ? r.abort() : r.continue()));
    await asUser(page, s.x.token, s.x.userId, "/student");
    await expect(page.getByRole("alert")).toContainText("มีการอัปเดตระบบ");
    expect(await page.evaluate(() => sessionStorage.getItem("coop.chunkReloadAt"))).toBeTruthy();   // พยายามโหลดใหม่ให้แล้ว 1 ครั้ง
    block = false;
    await page.getByRole("button", { name: "โหลดหน้าใหม่" }).click();
    await expect(page.getByText(`📆 กำหนดส่งของรอบคุณ · เทอม 1/${C()}`)).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  // เดิม: คัดลอกไม่ได้ (ไม่มีสิทธิ์/หน้า http) → หน้าเว็บมี error ค้าง และขึ้น "Copied!" ทั้งที่ไม่ได้คัดลอก
  test("(ใหม่) ปุ่มคัดลอกลิงก์แบบประเมิน: คัดลอกไม่ได้ = บอกผู้ใช้ ไม่ขึ้น Copied! หลอก ไม่มี error ค้าง", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true });
      document.execCommand = () => false;
    });
    await asUser(page, s.x.token, s.x.userId, "/student/doc-t005-006");
    await page.getByRole("button", { name: /Copy/ }).first().click();
    await expect(page.getByText(/คัดลอกไม่สำเร็จ/)).toBeVisible();
    await expect(page.getByText("Copied!")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("หน้าตั้งค่าตามหลักสูตร: การ์ดความพร้อม X พร้อม · Y ยังไม่พร้อม", async ({ page }) => {
    await asUser(page, staff.token, staff.userId, "/admin/major-config");
    await expect(page.getByTestId(`readiness-${X}`)).toContainText("พร้อม");
    await expect(page.getByTestId(`readiness-${X}`)).not.toContainText("ยังไม่พร้อม");
    await expect(page.getByTestId(`readiness-${Y}`)).toContainText("ยังไม่พร้อม");
  });
});
