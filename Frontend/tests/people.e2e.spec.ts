/**
 * tests/people.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * จัดการหลักสูตร · อาจารย์ (รวมอาจารย์ประจำวิชา) · เจ้าหน้าที่ · ข้อมูลคณบดี/ไฟล์ระบบ · บันทึกการใช้งาน · ข้อเสนอแนะ
 * · ตัวเลขแดชบอร์ดตามหลักสูตร — backend + DB จริง (ข้อมูล ZP ลบทิ้งตอนจบ · DEAN_INFO คืนค่าเดิม)
 *
 * กติกาที่ผู้ใช้ตัดสิน 2026-11-04: ลบหลักสูตรที่ยังมีคนใช้ไม่ได้ (409 + จำนวน) · เปลี่ยนรหัสหลักสูตร = ตามแก้ทุกที่
 * บั๊กที่แก้รอบนี้: สร้างหลักสูตรด้วยรหัสที่มีอยู่ = ทับชื่อไทยเงียบ ๆ · ตั้งหลักสูตรของอาจารย์เป็นรหัสที่ไม่มีได้
 *   · แก้ข้อมูลอาจารย์โดยไม่ส่งคำนำหน้า = คำนำหน้าหาย · ลบอาจารย์ที่เป็นที่ปรึกษาแล้วนักศึกษาหลุดจากที่ปรึกษาเงียบ ๆ (ตอนนี้ยืนยันพร้อมรายชื่อ)
 */
import { test, expect, type Page } from "@playwright/test";
import { api, type Res } from "./helpers/letterWorld";
import { WorldKit, prisma, type KStudent, type KTeacher, type KUser } from "./helpers/worldKit";

const k = new WorldKit("ZP");
test.describe.configure({ mode: "serial" });
const msg = (r: Res) => JSON.stringify(r.body);
const C = () => `${k.prefix}${k.tail}`;
const PW = "Zp!secure123";
async function apiH(token: string, method: string, url: string, headers: Record<string, string>): Promise<Res> {
  const r = await fetch(`http://localhost:5000${url}`, { method, headers: { Authorization: `Bearer ${token}`, ...headers } });
  return { status: r.status, body: await r.json().catch(() => null) };
}

let staff: KUser, staff2: KUser;
const t = {} as Record<"coopCS" | "plain" | "advisor", KTeacher>;
const s = {} as Record<string, KStudent>;

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน");
  staff = await k.staff();
  staff2 = await k.staff("staff2");
  t.coopCS = await k.teacher("ประจำวิชาCS", { coop: ["CS"] });
  t.plain = await k.teacher("ทั่วไป", { major: "AI" });
  t.advisor = await k.teacher("ที่ปรึกษา");
  s.a = await k.student("a", 1, { advisor: t.advisor.pk });
  await k.snapshot("DEAN_INFO", "MAJOR_IMPORT_ALIASES");
});
test.afterAll(async () => { await k.cleanup(); await k.disconnect(); });

// ══════════════════════════════════════════════════════
// A. หลักสูตร
// ══════════════════════════════════════════════════════
test.describe("A. หลักสูตร", () => {
  const criteria = (code: string) => prisma.coopCriteria.findUnique({ where: { major: code } });

  test("สร้าง: เจ้าหน้าที่เท่านั้น · รหัสว่าง 400 · (ใหม่) รหัสที่มีอยู่แล้ว 409 ไม่ทับชื่อไทยเดิม", async () => {
    expect((await api(t.coopCS.token, "POST", "/api/admin/criteria", { major: `${C()}A` })).status).toBe(403);
    expect((await api(staff.token, "POST", "/api/admin/criteria", { major: "  " })).status).toBe(400);
    let r = await api(staff.token, "POST", "/api/admin/criteria", { major: `${C()}A`, nameTh: "หลักสูตรเอ" });
    expect(r.status, msg(r)).toBe(200);
    r = await api(staff.token, "POST", "/api/admin/criteria", { major: `${C()}A`, nameTh: "ชื่อทับ" });
    expect(r.status, msg(r)).toBe(409);
    expect((await criteria(`${C()}A`))?.nameTh).toBe("หลักสูตรเอ");
  });

  test("(ใหม่) เปลี่ยนรหัส: นักศึกษา · อาจารย์ · อาจารย์ประจำวิชา · รอบ · ประกาศ · ค่าตั้งค่าเฉพาะหลักสูตร · ชื่อจับคู่ตอนนำเข้า ตามไปหมด — อาจารย์ประจำวิชายังเห็นนักศึกษา", async () => {
    const A = `${C()}A`, B = `${C()}B`;
    const coopA = await k.teacher("ประจำวิชาA", { major: A, coop: [A] });
    const stu = await k.student("inA", 2, { major: A });
    const p = await k.period(5, { [A]: {} });
    const ann = await prisma.announcement.create({ data: { title: `${C()} ประกาศ`, date: new Date(), year: "2569", targetMajors: [A, "CS"] } });
    await k.overwrite("MAJOR_IMPORT_ALIASES", { ...(await k.config("MAJOR_IMPORT_ALIASES") || {}), [`${C()} ชื่อในไฟล์`]: A });
    await prisma.systemConfig.create({ data: { key: `CONFIG_T007@${A}`, value: JSON.stringify({ t007Link: "https://zp.example.com" }) } });
    const before = (await api(coopA.token, "GET", "/api/students?limit=200")).body;
    expect((Array.isArray(before) ? before : before.data).map((x: { id: number }) => x.id)).toContain(stu.pk);

    const id = (await criteria(A))!.id;
    expect((await api(staff.token, "PUT", `/api/admin/criteria/${id}`, { major: "CS" })).status).toBe(409);   // รหัสซ้ำหลักสูตรอื่น
    const r = await api(staff.token, "PUT", `/api/admin/criteria/${id}`, { major: B, nameTh: "หลักสูตรบี" });
    expect(r.status, msg(r)).toBe(200);
    expect((await prisma.student.findUnique({ where: { id: stu.pk } })).major).toBe(B);
    expect((await prisma.teacher.findUnique({ where: { id: coopA.pk } })).major).toBe(B);
    expect((await prisma.coopTeacherMajor.findMany({ where: { teacherId: coopA.pk } })).map((x: { major: string }) => x.major)).toEqual([B]);
    expect(await prisma.coopPeriodMajor.findUnique({ where: { periodId_major: { periodId: p, major: B } } })).not.toBeNull();
    expect((await prisma.announcement.findUnique({ where: { id: ann.id } })).targetMajors).toEqual([B, "CS"]);
    expect(await prisma.systemConfig.findUnique({ where: { key: `CONFIG_T007@${A}` } })).toBeNull();
    expect(JSON.parse((await prisma.systemConfig.findUnique({ where: { key: `CONFIG_T007@${B}` } })).value).t007Link).toBe("https://zp.example.com");
    expect((await k.config("MAJOR_IMPORT_ALIASES"))[`${C()} ชื่อในไฟล์`]).toBe(B);
    const after = (await api(coopA.token, "GET", "/api/students?limit=200")).body;
    expect((Array.isArray(after) ? after : after.data).map((x: { id: number }) => x.id)).toContain(stu.pk);
    await prisma.announcement.delete({ where: { id: ann.id } });
  });

  test("(ใหม่) ลบ: ยังมีนักศึกษา/อาจารย์/อาจารย์ประจำวิชา/รอบใช้อยู่ 409 บอกจำนวน (ข้อมูลไม่หาย) · หลักสูตรที่ไม่มีใครใช้ ลบได้ (ค่าตั้งค่าเฉพาะหลักสูตรลบตาม) · ไม่มี 404", async () => {
    const B = `${C()}B`;
    const id = (await criteria(B))!.id;
    let r = await api(staff.token, "DELETE", `/api/admin/criteria/${id}`);
    expect([r.status, r.body.code]).toEqual([409, "MAJOR_IN_USE"]);
    expect(r.body.usage).toMatchObject({ students: 1, teachers: 1, coopTeachers: 1, rounds: 1 });
    expect(await criteria(B)).not.toBeNull();
    expect(await prisma.coopTeacherMajor.count({ where: { major: B } })).toBe(1);

    const T = await k.major("T");
    await prisma.systemConfig.create({ data: { key: `CONFIG_T007@${T}`, value: "{}" } });
    await k.overwrite("MAJOR_IMPORT_ALIASES", { ...(await k.config("MAJOR_IMPORT_ALIASES") || {}), [`${C()} ชื่อของT`]: T });
    r = await api(staff.token, "DELETE", `/api/admin/criteria/${(await criteria(T))!.id}`);
    expect(r.status, msg(r)).toBe(200);
    expect([await criteria(T), await prisma.systemConfig.findUnique({ where: { key: `CONFIG_T007@${T}` } })]).toEqual([null, null]);
    const aliases = await k.config("MAJOR_IMPORT_ALIASES");
    expect(aliases[`${C()} ชื่อของT`]).toBeUndefined();                  // (ใหม่) ชื่อจับคู่ตอนนำเข้าที่ชี้ไปหลักสูตรที่ลบ ถูกเอาออก
    expect(aliases[`${C()} ชื่อในไฟล์`]).toBe(`${C()}B`);                 // ของหลักสูตรอื่นยังอยู่
    expect((await api(staff.token, "DELETE", "/api/admin/criteria/nope")).status).toBe(404);
    expect((await api(t.coopCS.token, "DELETE", `/api/admin/criteria/${id}`)).status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════
// B. อาจารย์
// ══════════════════════════════════════════════════════
test.describe("B. อาจารย์", () => {
  const create = (token: string, body: object) => api(token, "POST", "/api/admin/teachers", { firstName: "ใหม่", lastName: C(), password: PW, ...body });

  test("เพิ่ม: เจ้าหน้าที่เท่านั้น · ช่องบังคับ · รหัสผ่านต้องแข็งแรง · อีเมลซ้ำ 409 · (ใหม่) หลักสูตรที่ไม่มี 400 · กำหนดหลักสูตรที่ดูแล = อาจารย์ประจำวิชา", async () => {
    const email = `${k.tag}-new@kkumail.com`;
    expect((await create(t.coopCS.token, { email })).status).toBe(403);
    expect((await create(staff.token, { email, firstName: "" })).status).toBe(400);
    expect((await create(staff.token, { email, password: "weak" })).status).toBe(400);
    let r = await create(staff.token, { email, major: "NOPE" });
    expect(r.status, msg(r)).toBe(400);
    expect((await create(staff.token, { email, coopMajors: ["NOPE"] })).status).toBe(400);
    r = await create(staff.token, { email, major: "CS", prefix: "ผศ.", coopMajors: ["CS"] });
    expect(r.status, msg(r)).toBe(200);
    const tr = await prisma.teacher.findUnique({ where: { id: r.body.teacher.id }, include: { coopMajors: true } });
    expect([tr.isCoopTeacher, tr.coopMajors.map((x: { major: string }) => x.major)]).toEqual([true, ["CS"]]);
    expect((await create(staff.token, { email })).status).toBe(409);
  });

  test("แก้: ประจำวิชาแก้ได้เฉพาะอาจารย์ในหลักสูตรตัวเอง (อีเมล/การเป็นประจำวิชาไม่มีผล) · (ใหม่) ไม่ส่งคำนำหน้า = คงเดิม · (ใหม่) หลักสูตรที่ไม่มี 400 · ไม่มีอาจารย์ 404", async () => {
    const tr = await prisma.teacher.findFirst({ where: { email: `${k.tag}-new@kkumail.com` } });
    let r = await api(t.coopCS.token, "PUT", `/api/admin/teachers/${tr.id}`, { firstName: "แก้ชื่อ", email: `${k.tag}-hack@kkumail.com`, coopMajors: [] });
    expect(r.status, msg(r)).toBe(200);
    let now = await prisma.teacher.findUnique({ where: { id: tr.id }, include: { coopMajors: true, user: true } });
    expect([now.firstName, now.prefix, now.user.email, now.coopMajors.length]).toEqual(["แก้ชื่อ", "ผศ.", `${k.tag}-new@kkumail.com`, 1]);
    expect((await api(t.coopCS.token, "PUT", `/api/admin/teachers/${t.plain.pk}`, { firstName: "x" })).status).toBe(403);
    expect((await api(t.coopCS.token, "PUT", `/api/admin/teachers/${tr.id}`, { major: "AI" })).status).toBe(403);
    expect((await api(staff.token, "PUT", `/api/admin/teachers/${tr.id}`, { major: "NOPE" })).status).toBe(400);
    expect((await api(staff.token, "PUT", `/api/teachers/${tr.id}`, { major: "NOPE" })).status).toBe(400);
    r = await api(staff.token, "PUT", `/api/teachers/${tr.id}`, { phone: "0800000000" });
    expect(r.status, msg(r)).toBe(200);
    now = await prisma.teacher.findUnique({ where: { id: tr.id } });
    expect([now.phone, now.prefix]).toEqual(["0800000000", "ผศ."]);
    expect((await api(staff.token, "PUT", "/api/admin/teachers/999999999", { firstName: "x" })).status).toBe(404);
  });

  test("รหัสผ่าน: รีเซ็ต (ต้องแข็งแรง) → session เดิมของอาจารย์ใช้ไม่ได้ · ดูรหัสผ่านได้เฉพาะเจ้าหน้าที่", async () => {
    expect((await api(staff.token, "PUT", `/api/admin/teachers/${t.plain.pk}/password`, { newPassword: "weak" })).status).toBe(400);
    expect((await api(t.coopCS.token, "PUT", `/api/admin/teachers/${t.plain.pk}/password`, { newPassword: PW })).status).toBe(403);
    const r = await api(staff.token, "PUT", `/api/admin/teachers/${t.plain.pk}/password`, { newPassword: PW });
    expect(r.status, msg(r)).toBe(200);
    expect((await api(t.plain.token, "GET", "/api/teacher/me")).status).toBe(401);
    expect((await api(t.coopCS.token, "POST", `/api/admin/teachers/${t.plain.pk}/password/reveal`)).status).toBe(403);
    const rev = await api(staff.token, "POST", `/api/admin/teachers/${t.plain.pk}/password/reveal`);
    expect([rev.status, rev.body.data.password]).toEqual([200, PW]);
  });

  test("(ใหม่) ลบอาจารย์ที่เป็นที่ปรึกษา: 409 พร้อมรายชื่อนักศึกษา (ยังไม่ลบ) → ยืนยัน ?confirm=1 → ลบ นักศึกษาไม่มีที่ปรึกษา · ไม่มีใครใช้ → ลบเลย", async () => {
    let r = await api(staff.token, "DELETE", `/api/admin/teachers/${t.advisor.pk}`);
    expect([r.status, r.body.code, r.body.students.map((x: { studentId: string }) => x.studentId)]).toEqual([409, "TEACHER_HAS_ADVISEES", [s.a.studentId]]);
    expect(await prisma.teacher.findUnique({ where: { id: t.advisor.pk } })).not.toBeNull();
    r = await api(staff.token, "DELETE", `/api/admin/teachers/${t.advisor.pk}?confirm=1`);
    expect(r.status, msg(r)).toBe(200);
    expect((await prisma.student.findUnique({ where: { id: s.a.pk } })).coopAdvisorId).toBeNull();
    const tr = await prisma.teacher.findFirst({ where: { email: `${k.tag}-new@kkumail.com` } });
    expect((await api(staff.token, "DELETE", `/api/admin/teachers/${tr.id}`)).status).toBe(200);
    expect((await api(t.coopCS.token, "DELETE", `/api/admin/teachers/${t.plain.pk}`)).status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════
// C. เจ้าหน้าที่ · ข้อมูลคณบดี · ไฟล์ระบบ
// ══════════════════════════════════════════════════════
test.describe("C. เจ้าหน้าที่และค่าระบบ", () => {
  test("บัญชีเจ้าหน้าที่: เจ้าหน้าที่เท่านั้น · ช่องบังคับ/รหัสผ่าน ≥6 · ซ้ำ 409 · รีเซ็ตรหัสผ่าน · ลบบัญชีตัวเองไม่ได้ · ลบคนอื่นได้", async () => {
    const body = { username: `${k.tag}-st3`, email: `${k.tag}-st3@kkumail.com`, password: "abcdef", firstName: "เจ้าหน้าที่", lastName: C() };
    expect((await api(t.coopCS.token, "POST", "/api/admin/staff", body)).status).toBe(403);
    expect((await api(staff.token, "POST", "/api/admin/staff", { ...body, lastName: "" })).status).toBe(400);
    expect((await api(staff.token, "POST", "/api/admin/staff", { ...body, password: "12345" })).status).toBe(400);
    let r = await api(staff.token, "POST", "/api/admin/staff", body);
    expect(r.status, msg(r)).toBe(201);
    const row = r.body.staff;
    expect((await api(staff.token, "POST", "/api/admin/staff", body)).status).toBe(409);
    expect(JSON.stringify((await api(staff.token, "GET", "/api/admin/staff")).body)).toContain(body.email);
    expect((await api(staff.token, "PATCH", `/api/admin/staff/${row.id}/password`, { password: "123" })).status).toBe(400);
    expect((await api(staff.token, "PATCH", `/api/admin/staff/${row.id}/password`, { password: "abcdefg" })).status).toBe(200);
    expect((await api(staff.token, "DELETE", `/api/admin/staff/${staff.userId}`)).status).toBe(400);
    r = await api(staff.token, "DELETE", `/api/admin/staff/${row.id}`);
    expect(r.status, msg(r)).toBe(200);
  });

  test("ข้อมูลคณบดี: ใครก็อ่านได้ · แก้ได้เฉพาะเจ้าหน้าที่ · ไฟล์ระบบ: เจ้าหน้าที่เท่านั้น · ไม่มีไฟล์/ชนิดผิด 400 (ไม่แตะไฟล์จริง)", async () => {
    expect((await api(t.coopCS.token, "POST", "/api/admin/config/dean-info", { deanName: "x", deanPosition: "y" })).status).toBe(403);
    let r = await api(staff.token, "POST", "/api/admin/config/dean-info", { deanName: `${C()} คณบดี`, deanPosition: "คณบดีทดสอบ" });
    expect(r.status, msg(r)).toBe(200);
    r = await api(s.a.token, "GET", "/api/admin/config/dean-info");
    expect([r.status, r.body.deanName]).toEqual([200, `${C()} คณบดี`]);
    expect((await api(t.coopCS.token, "GET", "/api/admin/assets")).status).toBe(403);
    expect((await api(staff.token, "GET", "/api/admin/assets")).status).toBe(200);
    expect((await api(staff.token, "POST", "/api/admin/assets", new FormData())).status).toBe(400);
    const fd = new FormData();
    fd.append("key", "NOT_A_KEY");
    fd.append("file", new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: "image/png" }), "x.png");
    expect((await api(staff.token, "POST", "/api/admin/assets", fd)).status).toBe(400);
  });
});

// ══════════════════════════════════════════════════════
// D. บันทึกการใช้งาน · ข้อเสนอแนะ · แดชบอร์ดตามหลักสูตร
// ══════════════════════════════════════════════════════
test.describe("D. บันทึก ข้อเสนอแนะ แดชบอร์ด", () => {
  test("บันทึกการใช้งาน: เจ้าหน้าที่เท่านั้น · กรองตามผู้ใช้ เห็นการกระทำที่เพิ่งทำ · userId ผิด 400 · ส่งออกได้", async () => {
    expect((await api(t.coopCS.token, "GET", "/api/admin/logs")).status).toBe(403);
    await expect.poll(async () => (await api(staff.token, "GET", `/api/admin/logs?userId=${staff.userId}`)).body.data.length).toBeGreaterThan(0);
    const r = await api(staff.token, "GET", `/api/admin/logs?userId=${staff.userId}&limit=5`);
    expect(r.body.data.every((x: { userId: number }) => x.userId === staff.userId)).toBe(true);
    expect(r.body.meta.limit).toBe(5);
    expect((await api(staff.token, "GET", "/api/admin/logs?userId=abc")).status).toBe(400);
    const ex = await fetch(`http://localhost:5000/api/admin/logs/export?userId=${staff.userId}`, { headers: { Authorization: `Bearer ${staff.token}` } });
    expect(ex.status).toBe(200);
  });

  test("ข้อเสนอแนะ: ประเภทผิด/สั้นเกิน/ยาวเกิน 400 · ส่งได้ทุกบทบาท · ดูของตัวเอง · เจ้าหน้าที่ดูทั้งหมด/ตอบ/เปลี่ยนสถานะ (สถานะผิด 400 · ไม่มี 404) · อาจารย์ดูทั้งหมดไม่ได้", async () => {
    expect((await api(s.a.token, "POST", "/api/feedback", { kind: "X", message: "ข้อความยาวพอ" })).status).toBe(400);
    expect((await api(s.a.token, "POST", "/api/feedback", { kind: "BUG", message: "สั้น" })).status).toBe(400);
    expect((await api(s.a.token, "POST", "/api/feedback", { kind: "BUG", message: "ก".repeat(2001) })).status).toBe(400);
    let r = await api(s.a.token, "POST", "/api/feedback", { kind: "BUG", message: `${C()} ปุ่มกดไม่ได้`, pagePath: "/student/docs" });
    expect(r.status, msg(r)).toBe(201);
    const mine = (await api(s.a.token, "GET", "/api/feedback/me")).body;
    const fb = (mine.feedback || mine.data || mine.items).find((x: { message: string }) => x.message.includes(C()));
    expect(fb).toBeTruthy();
    expect((await api(t.coopCS.token, "GET", "/api/admin/feedback")).status).toBe(403);
    expect((await api(staff.token, "GET", "/api/admin/feedback")).status).toBe(200);
    expect((await api(staff.token, "PATCH", `/api/admin/feedback/${fb.id}`, { status: "WHAT" })).status).toBe(400);
    expect((await api(staff.token, "PATCH", `/api/admin/feedback/${fb.id}`, {})).status).toBe(400);
    expect((await api(staff.token, "PATCH", "/api/admin/feedback/999999999", { status: "RESOLVED" })).status).toBe(404);
    r = await api(staff.token, "PATCH", `/api/admin/feedback/${fb.id}`, { status: "RESOLVED", staffReply: "แก้แล้ว" });
    expect(r.status, msg(r)).toBe(200);
    expect((await prisma.feedback.findUnique({ where: { id: fb.id } })).status).toBe("RESOLVED");
  });

  test("แดชบอร์ด (หลายหลักสูตร): เจ้าหน้าที่ = ทุกหลักสูตร · กรองหลักสูตรบนแถบบน = เฉพาะหลักสูตรนั้น · ประจำวิชา = เฉพาะหลักสูตรที่ดูแล (กรองเกินขอบเขตไม่ขยาย) · อาจารย์ทั่วไป 403", async () => {
    const count = (where: object) => prisma.student.count({ where: { deletedAt: null, ...where } });
    const total = (r: Res) => r.body.data.totalStudents;
    expect(total(await api(staff.token, "GET", "/api/admin/dashboard-stats"))).toBe(await count({}));
    expect(total(await apiH(staff.token, "GET", "/api/admin/dashboard-stats", { "x-major-filter": "AI" }))).toBe(await count({ major: "AI" }));
    expect(total(await api(t.coopCS.token, "GET", "/api/admin/dashboard-stats"))).toBe(await count({ major: "CS" }));
    expect(total(await apiH(t.coopCS.token, "GET", "/api/admin/dashboard-stats", { "x-major-filter": "AI" }))).toBe(await count({ major: "CS" }));
    expect((await api(staff2.token, "GET", "/api/admin/dashboard-stats")).status).toBe(200);
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

test.describe("E. หน้าจัดการหลักสูตร / อาจารย์", () => {
  test("หลักสูตร: (ใหม่) เพิ่มรหัสซ้ำขึ้นข้อความ ไม่ทับ · ลบหลักสูตรที่มีคนใช้ขึ้นจำนวนที่ใช้อยู่ ไม่ลบ", async ({ page }) => {
    await asUser(page, staff.token, staff.userId, "/admin/criteria");
    await page.getByRole("button", { name: /เพิ่ม/ }).first().click();
    await page.getByPlaceholder("เช่น CS, IT, AI").fill("CS");
    await page.getByPlaceholder("เช่น วิทยาการคอมพิวเตอร์").fill("ชื่อที่ไม่ควรทับ");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText(/รหัสหลักสูตรนี้มีอยู่แล้ว/)).toBeVisible();
    expect((await prisma.coopCriteria.findUnique({ where: { major: "CS" } }))?.nameTh).not.toBe("ชื่อที่ไม่ควรทับ");
    await page.getByRole("button", { name: "ยกเลิก" }).first().click();
    const card = page.locator("div", { hasText: `${C()}B`, has: page.getByRole("button", { name: "🗑️ ลบ" }) }).last();
    await card.getByRole("button", { name: "🗑️ ลบ" }).click();
    await page.getByRole("button", { name: "ยืนยันลบ" }).click();
    await expect(page.getByText(/ลบหลักสูตร .* ไม่ได้ — ยังมีข้อมูลใช้อยู่/)).toBeVisible();
    expect(await prisma.coopCriteria.findUnique({ where: { major: `${C()}B` } })).not.toBeNull();
  });

  test("อาจารย์: (ใหม่) ลบอาจารย์ที่เป็นที่ปรึกษา → ขึ้นรายชื่อให้ยืนยัน → ยกเลิกแล้วยังอยู่ → ลบอีกครั้งแล้วยืนยัน → ลบ", async ({ page }) => {
    const adv = await k.teacher("ที่ปรึกษาหน้าเว็บ");
    const stu = await k.student("uiAdvisee", 9, { advisor: adv.pk });
    await asUser(page, staff.token, staff.userId, "/admin/teachers");
    await page.locator('input[name="teacher-search"]').fill(`ทดสอบที่ปรึกษาหน้าเว็บ`);
    const row = page.locator("tr", { hasText: "ทดสอบที่ปรึกษาหน้าเว็บ" });
    await row.getByRole("button", { name: "🗑️ ลบ" }).click();
    await page.getByRole("button", { name: "ลบ", exact: true }).click();
    await expect(page.getByText(/อาจารย์เป็นที่ปรึกษาของนักศึกษา 1 คน/)).toBeVisible();
    await expect(page.getByText(stu.studentId)).toBeVisible();
    await page.getByRole("button", { name: "ยกเลิก" }).last().click();
    expect(await prisma.teacher.findUnique({ where: { id: adv.pk } })).not.toBeNull();
    await row.getByRole("button", { name: "🗑️ ลบ" }).click();
    await page.getByRole("button", { name: "ลบ", exact: true }).click();
    await page.getByRole("button", { name: "ลบอาจารย์" }).click();
    await expect.poll(async () => prisma.teacher.findUnique({ where: { id: adv.pk } })).toBeNull();
    expect((await prisma.student.findUnique({ where: { id: stu.pk } })).coopAdvisorId).toBeNull();
  });
});
