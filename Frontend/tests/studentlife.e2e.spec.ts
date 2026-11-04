/**
 * tests/studentlife.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * ชีวิตประจำวันของนักศึกษา — โปรไฟล์ · รูปถ่ายใบสมัคร · ประกาศแบบห้อง (รอบ × หลักสูตร) · แจ้งเตือน · ตัวเลขแดชบอร์ดอาจารย์
 * — backend + DB จริง ใช้หลักสูตรทดสอบ 2 หลักสูตร (X, Y) แยกจากข้อมูลจริง (ข้อมูล ZL ลบทิ้งตอนจบ)
 *
 * บั๊กที่แก้รอบนี้: เลือกบริษัทในหน้าข้อมูลนักศึกษา (บันทึกอัตโนมัติ ส่งแค่ companyId/contactIds) = หลักสูตรของนักศึกษาหายเป็นว่าง
 *   · ตั้งหลักสูตรเป็นรหัสที่ไม่มีในระบบได้ (นักศึกษาเอง/เจ้าหน้าที่) · นักศึกษาเปลี่ยนหลักสูตรเองหลังเข้ารอบสหกิจแล้วได้
 */
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { api, type Res } from "./helpers/letterWorld";
import { WorldKit, prisma, UPLOADS, type KStudent, type KTeacher, type KUser } from "./helpers/worldKit";

const k = new WorldKit("ZL");
test.describe.configure({ mode: "serial" });
const msg = (r: Res) => JSON.stringify(r.body);
const C = () => `${k.prefix}${k.tail}`;
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

let staff: KUser;
let X = "", Y = "", L1 = "", L2 = "";
const t = {} as Record<"coopX" | "coopY" | "plainX" | "advisor", KTeacher>;
const s = {} as Record<"x" | "y" | "x2" | "free" | "trash", KStudent>;

/** ประกาศผ่าน API (multipart เหมือนหน้าเว็บ) */
async function post(token: string, f: Record<string, unknown>) {
  const fd = new FormData();
  for (const [key, v] of Object.entries(f)) if (v !== undefined) fd.append(key, typeof v === "string" ? v : JSON.stringify(v));
  return api(token, "POST", "/api/announcements", fd);
}
const titles = (r: Res) => (r.body.list as { title: string }[]).map((a) => a.title);
const annId = async (title: string) => (await prisma.announcement.findFirst({ where: { title } })).id as string;

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน");
  staff = await k.staff();
  X = await k.major("X", "หลักสูตรเอ็กซ์");
  Y = await k.major("Y", "หลักสูตรวาย");
  const p1 = await k.period(1, { [X]: {}, [Y]: {} });
  const p2 = await k.period(2, { [X]: { isActive: false } });
  L1 = `1/${C()}`; L2 = `2/${C()}`;
  t.coopX = await k.teacher("ประจำวิชาX", { major: X, coop: [X] });
  t.coopY = await k.teacher("ประจำวิชาY", { major: Y, coop: [Y] });
  t.plainX = await k.teacher("ทั่วไปX", { major: X });
  t.advisor = await k.teacher("ที่ปรึกษา", { major: X });
  s.x = await k.student("x", 1, { major: X, status: "APPLYING", periodId: p1 });
  s.y = await k.student("y", 2, { major: Y, status: "APPLYING", periodId: p1, advisor: t.advisor.pk });
  s.x2 = await k.student("x2", 3, { major: X, periodId: p2 });
  s.free = await k.student("free", 4, { major: X, status: null });
  s.trash = await k.student("trash", 5, { major: X, periodId: p1 });
  await prisma.student.update({ where: { id: s.trash.pk }, data: { deletedAt: new Date() } });
});
test.afterAll(async () => { await k.cleanup(); await k.disconnect(); });

// ══════════════════════════════════════════════════════
// A. โปรไฟล์นักศึกษา
// ══════════════════════════════════════════════════════
test.describe("A. โปรไฟล์", () => {
  const stu = (pk: number) => prisma.student.findUnique({ where: { id: pk }, include: { emails: true } });

  test("ดูของตัวเอง (ชื่อหลักสูตรภาษาไทย) · อาจารย์/เจ้าหน้าที่ใช้ /me ของนักศึกษาไม่ได้ · ถังขยะ 401", async () => {
    const r = await api(s.x.token, "GET", "/api/students/me");
    expect(r.status, msg(r)).toBe(200);
    expect(r.body.studentId).toBe(s.x.studentId);
    expect(r.body.majorNameTh).toBe("หลักสูตรเอ็กซ์");
    expect((await api(t.coopX.token, "GET", "/api/students/me")).status).toBe(403);
    expect((await api(staff.token, "PUT", "/api/students/me", { firstName: "x" })).status).toBe(403);
    expect((await api(s.trash.token, "GET", "/api/students/me")).status).toBe(401);   // อยู่ถังขยะ = token ใช้ไม่ได้ทั้งระบบ
    expect((await api(s.trash.token, "PUT", "/api/students/me", { firstName: "ใหม่" })).status).toBe(401);
  });

  test("รหัสนักศึกษา: ตัวอักษรถูกตัดทิ้ง · ไม่มีตัวเลข/ยาวเกิน 10 หลัก 400 · ซ้ำกับคนอื่น 409", async () => {
    expect((await api(s.free.token, "PUT", "/api/students/me", { studentId: "abc" })).status).toBe(400);
    expect((await api(s.free.token, "PUT", "/api/students/me", { studentId: "12345678901" })).status).toBe(400);
    const taken = `9${k.tail}02`;                     // รหัสทดสอบมีตัวอักษร ZL… — ให้ s.y ใช้รหัสตัวเลขล้วนชั่วคราว
    await prisma.student.update({ where: { id: s.y.pk }, data: { studentId: taken } });
    let r = await api(s.free.token, "PUT", "/api/students/me", { studentId: taken });
    expect(r.status, msg(r)).toBe(409);
    await prisma.student.update({ where: { id: s.y.pk }, data: { studentId: s.y.studentId } });
    const digits = s.free.studentId.replace(/\D/g, "");
    r = await api(s.free.token, "PUT", "/api/students/me", { studentId: `u${digits}` });    // ตัวเลขเท่าเดิม = รหัสเดิม ไม่เขียนทับ
    expect(r.status, msg(r)).toBe(200);
    expect((await stu(s.free.pk)).studentId).toBe(s.free.studentId);
    r = await api(s.free.token, "PUT", "/api/students/me", { studentId: `u7${digits}` });   // รหัสใหม่: ตัดตัวอักษรทิ้ง
    expect(r.status, msg(r)).toBe(200);
    expect((await stu(s.free.pk)).studentId).toBe(`7${digits}`);
    await prisma.student.update({ where: { id: s.free.pk }, data: { studentId: s.free.studentId } }); // คืนรหัสเดิม (cleanup หา ZL…)
  });

  test("ที่ปรึกษา: id ไม่ใช่ตัวเลข/ไม่มีอยู่ 400 · ตั้ง/ล้างได้ · ที่ปรึกษาทั่วไป → ชื่อมาจากข้อมูลอาจารย์ ไม่ใช่ข้อความที่ส่งมา", async () => {
    expect((await api(s.free.token, "PUT", "/api/students/me", { coopAdvisorId: "abc" })).status).toBe(400);
    expect((await api(s.free.token, "PUT", "/api/students/me", { coopAdvisorId: 999999999 })).status).toBe(400);
    expect((await api(s.free.token, "PUT", "/api/students/me", { generalAdvisorId: 999999999 })).status).toBe(400);
    let r = await api(s.free.token, "PUT", "/api/students/me", { coopAdvisorId: t.advisor.pk, generalAdvisorId: t.plainX.pk, advisorName: "ชื่อปลอม" });
    expect(r.status, msg(r)).toBe(200);
    let row = await stu(s.free.pk);
    expect(row.coopAdvisorId).toBe(t.advisor.pk);
    expect(row.advisorName).toBe(t.plainX.name);
    r = await api(s.free.token, "PUT", "/api/students/me", { coopAdvisorId: null, generalAdvisorId: "" });
    expect(r.status, msg(r)).toBe(200);
    row = await stu(s.free.pk);
    expect([row.coopAdvisorId, row.generalAdvisorId, row.advisorName]).toEqual([null, null, null]);
  });

  test("อีเมลหลายอัน: เก็บเฉพาะที่ถูกรูปแบบ · หน่วยกิจกรรมไม่ใช่ตัวเลข 400 · เว้นว่าง = คงค่าเดิม", async () => {
    let r = await api(s.free.token, "PUT", "/api/students/me", { emails: [{ email: "ok@kkumail.com", primary: true }, { email: "not-an-email" }, { email: "" }], activityUnit: 7 });
    expect(r.status, msg(r)).toBe(200);
    let row = await stu(s.free.pk);
    expect(row.emails.map((e: { email: string }) => e.email)).toEqual(["ok@kkumail.com"]);
    expect(row.activityUnit).toBe(7);
    expect((await api(s.free.token, "PUT", "/api/students/me", { activityUnit: "เจ็ด" })).status).toBe(400);
    r = await api(s.free.token, "PUT", "/api/students/me", { activityUnit: "" });
    expect(r.status, msg(r)).toBe(200);
    row = await stu(s.free.pk);
    expect(row.activityUnit).toBe(7);
  });

  test("(ใหม่) บันทึกบริษัทจากหน้าข้อมูลนักศึกษา (ส่งแค่ companyId/contactIds) — หลักสูตร/ชั้นปี/ชื่อไม่หาย · อาจารย์ประจำวิชายังเห็นนักศึกษา", async () => {
    const c = await k.company(`${C()} บริษัทโปรไฟล์`, ["โปรไฟล์"]);
    const r = await api(s.x.token, "PUT", "/api/students/me", { companyId: c.id, contactIds: c.contactIds });
    expect(r.status, msg(r)).toBe(200);
    const row = await stu(s.x.pk);
    expect([row.major, row.year, row.firstName]).toEqual([X, "4", "นศx"]);
    expect((await k.coop(s.x.pk)).companyId).toBe(c.id);
    const list = (await api(t.coopX.token, "GET", "/api/students?limit=200")).body;
    expect((Array.isArray(list) ? list : list.data).map((x: { id: number }) => x.id)).toContain(s.x.pk);
  });

  test("(ใหม่) หลักสูตร: รหัสที่ไม่มีในระบบ 400 · ยังไม่เข้ารอบเปลี่ยนเองได้ · เข้ารอบแล้วเปลี่ยนเองไม่ได้ (409) แต่ส่งค่าเดิมซ้ำได้", async () => {
    let r = await api(s.free.token, "PUT", "/api/students/me", { major: "ไม่มีหลักสูตรนี้" });
    expect(r.status, msg(r)).toBe(400);
    expect((await stu(s.free.pk)).major).toBe(X);
    r = await api(s.free.token, "PUT", "/api/students/me", { major: Y });
    expect(r.status, msg(r)).toBe(200);
    expect((await stu(s.free.pk)).major).toBe(Y);
    await prisma.student.update({ where: { id: s.free.pk }, data: { major: X } });

    r = await api(s.x.token, "PUT", "/api/students/me", { major: Y, firstName: "นศx" });
    expect(r.status, msg(r)).toBe(409);
    expect(r.body.message).toMatch(/ติดต่อเจ้าหน้าที่/);
    expect((await stu(s.x.pk)).major).toBe(X);
    r = await api(s.x.token, "PUT", "/api/students/me", { major: X, phone: "0812345678" });
    expect(r.status, msg(r)).toBe(200);
    expect((await stu(s.x.pk)).phone).toBe("0812345678");
    expect((await api(s.x.token, "PUT", "/api/students/me", { major: "" })).status).toBe(409);   // ล้างหลักสูตรก็นับว่าเปลี่ยน

    // หลักสูตรว่าง (โดนบั๊กล้างไปแล้ว) แม้เข้ารอบแล้วตั้งเองได้ · ส่งค่าว่างซ้ำไม่นับว่าเปลี่ยน
    for (const empty of [null, ""]) {
      await prisma.student.update({ where: { id: s.x2.pk }, data: { major: empty } });
      r = await api(s.x2.token, "PUT", "/api/students/me", { major: "", phone: "0899999999" });
      expect(r.status, `${empty} ${msg(r)}`).toBe(200);
      r = await api(s.x2.token, "PUT", "/api/students/me", { major: X });
      expect(r.status, msg(r)).toBe(200);
      expect((await stu(s.x2.pk)).major).toBe(X);
    }
  });

  test("(ใหม่) เจ้าหน้าที่แก้หลักสูตรนักศึกษาเป็นรหัสที่ไม่มี 400 · อาจารย์ประจำวิชา X ย้ายนักศึกษาไปหลักสูตร Y ไม่ได้ · เจ้าหน้าที่ย้ายได้", async () => {
    let r = await api(staff.token, "PUT", `/api/admin/students/${s.free.pk}`, { major: "ไม่มีหลักสูตรนี้" });
    expect(r.status, msg(r)).toBe(400);
    expect((await api(t.coopX.token, "PUT", `/api/admin/students/${s.free.pk}`, { major: Y })).status).toBe(403);
    r = await api(staff.token, "PUT", `/api/admin/students/${s.free.pk}`, { major: Y });
    expect(r.status, msg(r)).toBe(200);
    expect((await stu(s.free.pk)).major).toBe(Y);
    await prisma.student.update({ where: { id: s.free.pk }, data: { major: X } });
  });
});

// ══════════════════════════════════════════════════════
// B. รูปถ่ายในใบสมัคร
// ══════════════════════════════════════════════════════
test.describe("B. รูปถ่ายใบสมัคร", () => {
  const photo = async (token: string, buf: Buffer, name: string, type: string) => {
    const fd = new FormData();
    fd.append("photo", new Blob([buf], { type }), name);
    return api(token, "POST", "/api/docs/form-photo", fd);
  };
  const photoPath = async (pk: number) => (await prisma.coopApplicationForm.findUnique({ where: { studentId: pk } }))?.photoPath ?? null;

  test("ไม่มีไฟล์ / ไม่ใช่ JPG-PNG / เกิน 5 MB 400 · อาจารย์ 403 · ถังขยะ 401", async () => {
    expect((await api(s.x.token, "POST", "/api/docs/form-photo", new FormData())).status).toBe(400);
    let r = await photo(s.x.token, Buffer.from("GIF89a"), "a.gif", "image/gif");
    expect(r.status, msg(r)).toBe(400);
    r = await photo(s.x.token, JPG, "fake.jpg", "application/pdf");
    expect(r.status, msg(r)).toBe(400);
    r = await photo(s.x.token, Buffer.alloc(5 * 1024 * 1024 + 10, 1), "big.jpg", "image/jpeg");
    expect(r.status, msg(r)).toBe(400);
    expect(r.body.message).toMatch(/5 MB/);
    expect((await photo(t.coopX.token, JPG, "a.jpg", "image/jpeg")).status).toBe(403);
    expect((await photo(s.trash.token, JPG, "a.jpg", "image/jpeg")).status).toBe(401);
    expect(await photoPath(s.x.pk)).toBeNull();
  });

  test("อัปโหลด → เปลี่ยนรูป (ไฟล์เก่าถูกลบ) → ลบ (ไฟล์หาย) → ลบซ้ำได้", async () => {
    let r = await photo(s.x.token, JPG, "me.JPG", "image/jpeg");
    expect(r.status, msg(r)).toBe(200);
    const first = await photoPath(s.x.pk);
    k.files.push(path.join(UPLOADS, first));
    expect(fs.existsSync(path.join(UPLOADS, first))).toBe(true);
    r = await photo(s.x.token, JPG, "me2.png", "image/png");
    expect(r.status, msg(r)).toBe(200);
    const second = await photoPath(s.x.pk);
    k.files.push(path.join(UPLOADS, second));
    expect(second).not.toBe(first);
    expect(fs.existsSync(path.join(UPLOADS, first))).toBe(false);
    r = await api(s.x.token, "DELETE", "/api/docs/form-photo");
    expect(r.status, msg(r)).toBe(200);
    expect(await photoPath(s.x.pk)).toBeNull();
    expect(fs.existsSync(path.join(UPLOADS, second))).toBe(false);
    r = await api(s.x.token, "DELETE", "/api/docs/form-photo");
    expect(r.status, msg(r)).toBe(200);
  });
});

// ══════════════════════════════════════════════════════
// C. ประกาศ — ห้อง = รอบ × หลักสูตร
// ══════════════════════════════════════════════════════
test.describe("C. ประกาศหลายหลักสูตร", () => {
  const T = (name: string) => `${C()} ${name}`;
  const future = () => new Date(Date.now() + 3 * 86_400_000).toISOString();

  test("เจ้าหน้าที่ประกาศได้ทุกห้อง (ส่วนกลาง/X/Y/ตั้งเวลา/อีกรอบ) · ข้อมูลไม่ครบ/ลิงก์ไม่ปลอดภัย/เวลาผิด 400", async () => {
    const base = { date: "2026-11-04", year: L1, body: "รายละเอียด" };
    expect((await post(staff.token, { ...base, title: "" })).status).toBe(400);
    expect((await post(staff.token, { ...base, title: T("ลิงก์"), linkUrls: ["javascript:alert(1)"] })).status).toBe(400);
    expect((await post(staff.token, { ...base, title: T("เวลา"), publishAt: "ไม่ใช่วันที่" })).status).toBe(400);
    for (const [title, extra] of [
      [T("ส่วนกลาง"), {}], [T("ของX"), { targetMajors: [X] }], [T("ของY"), { targetMajors: [Y] }],
      [T("ตั้งเวลาX"), { targetMajors: [X], publishAt: future() }], [T("รอบสองX"), { targetMajors: [X], year: L2 }],
      [T("เวลาผ่านแล้ว"), { targetMajors: [X], publishAt: "2020-01-01T00:00:00Z" }],
    ] as [string, object][]) {
      const r = await post(staff.token, { ...base, title, ...extra });
      expect(r.status, `${title} ${msg(r)}`).toBe(200);
    }
    expect((await prisma.announcement.findFirst({ where: { title: T("เวลาผ่านแล้ว") } })).publishAt).toBeNull();
  });

  test("อาจารย์ประจำวิชา X: ต้องเลือกหลักสูตร · เลือกได้เฉพาะ X · อาจารย์ทั่วไป/นักศึกษาประกาศไม่ได้", async () => {
    const base = { date: "2026-11-04", year: L1 };
    expect((await post(t.coopX.token, { ...base, title: T("coop ส่วนกลาง") })).status).toBe(403);
    expect((await post(t.coopX.token, { ...base, title: T("coop Y"), targetMajors: [Y] })).status).toBe(403);
    expect((await post(t.coopX.token, { ...base, title: T("coop XY"), targetMajors: [X, Y] })).status).toBe(403);
    expect((await post(t.plainX.token, { ...base, title: T("plain"), targetMajors: [X] })).status).toBe(403);
    expect((await post(s.x.token, { ...base, title: T("student"), targetMajors: [X] })).status).toBe(403);
    const r = await post(t.coopX.token, { ...base, title: T("จากอาจารย์X"), targetMajors: [X] });
    expect(r.status, msg(r)).toBe(200);
  });

  test("นักศึกษาเห็นเฉพาะห้องรอบ+หลักสูตรตัวเอง (ส่วนกลางของรอบนั้นด้วย) · ไม่เห็นที่ตั้งเวลา · แก้ ?year/?room ไม่ช่วย · ยังไม่ผูกรอบ = รอบที่เปิดของหลักสูตร · ถังขยะไม่เห็นอะไร", async () => {
    const mine = (r: Res) => titles(r).filter((x) => x.startsWith(C())).sort();
    const xs = await api(s.x.token, "GET", `/api/announcements?year=${encodeURIComponent(L2)}&room=${encodeURIComponent(Y)}`);
    expect(mine(xs)).toEqual([T("จากอาจารย์X"), T("ของX"), T("ส่วนกลาง"), T("เวลาผ่านแล้ว")].sort());
    expect(mine(await api(s.y.token, "GET", "/api/announcements"))).toEqual([T("ของY"), T("ส่วนกลาง")].sort());
    expect(mine(await api(s.x2.token, "GET", "/api/announcements"))).toEqual([T("รอบสองX")]);
    expect(mine(await api(s.free.token, "GET", "/api/announcements"))).toEqual([T("จากอาจารย์X"), T("ของX"), T("ส่วนกลาง"), T("เวลาผ่านแล้ว")].sort());
    expect((await api(s.trash.token, "GET", "/api/announcements")).status).toBe(401);
    expect(xs.body.list.every((a: { canEdit: boolean }) => a.canEdit === false)).toBe(true);
  });

  test("อาจารย์: ประจำวิชา X เห็น X+ส่วนกลาง+ที่ตั้งเวลาของ X แก้ได้เฉพาะของ X · อาจารย์ทั่วไป X ไม่เห็นที่ตั้งเวลา · ห้องที่โพสต์ได้", async () => {
    const q = `/api/announcements?year=${encodeURIComponent(L1)}`;
    const coop = await api(t.coopX.token, "GET", q);
    const mine = coop.body.list.filter((a: { title: string }) => a.title.startsWith(C()));
    expect(mine.map((a: { title: string }) => a.title).sort()).toEqual([T("จากอาจารย์X"), T("ของX"), T("ตั้งเวลาX"), T("ส่วนกลาง"), T("เวลาผ่านแล้ว")].sort());
    const edit = Object.fromEntries(mine.map((a: { title: string; canEdit: boolean }) => [a.title, a.canEdit]));
    expect(edit[T("ส่วนกลาง")]).toBe(false);
    expect(edit[T("ของX")]).toBe(true);
    const plain = titles(await api(t.plainX.token, "GET", q)).filter((x) => x.startsWith(C())).sort();
    expect(plain).toEqual([T("จากอาจารย์X"), T("ของX"), T("ส่วนกลาง"), T("เวลาผ่านแล้ว")].sort());

    const rooms = (await api(t.coopX.token, "GET", `/api/announcements/rooms?year=${encodeURIComponent(L1)}`)).body.rooms;
    const byRoom = Object.fromEntries(rooms.map((r: { room: string; canPost: boolean }) => [r.room, r.canPost]));
    expect(byRoom).toMatchObject({ GLOBAL: false, [X]: true });
    expect(byRoom[Y]).toBeUndefined();
    const stRooms = (await api(s.y.token, "GET", "/api/announcements/rooms")).body;
    expect(stRooms.rooms.map((r: { room: string }) => r.room)).toEqual(["GLOBAL", Y]);
    expect(stRooms.years).toEqual([L1]);
    const staffRooms = (await api(staff.token, "GET", "/api/announcements/rooms")).body.rooms.map((r: { room: string }) => r.room);
    expect(staffRooms).toEqual(expect.arrayContaining(["GLOBAL", X, Y]));
  });

  test("ปักหมุด / แก้ / ลบ: อาจารย์ประจำวิชา X ทำกับประกาศ Y หรือส่วนกลางไม่ได้ · ย้ายประกาศตัวเองไป Y ไม่ได้ · อาจารย์ทั่วไปไม่ได้ · ไม่มีประกาศ 404", async () => {
    const [own, other, global] = [await annId(T("จากอาจารย์X")), await annId(T("ของY")), await annId(T("ส่วนกลาง"))];
    expect((await api(t.coopX.token, "PATCH", `/api/announcements/${other}/pin`, { pinned: true })).status).toBe(403);
    expect((await api(t.coopX.token, "PATCH", `/api/announcements/${global}/pin`, { pinned: true })).status).toBe(403);
    expect((await api(t.plainX.token, "PATCH", `/api/announcements/${own}/pin`, { pinned: true })).status).toBe(403);
    expect((await api(t.coopX.token, "PATCH", "/api/announcements/no-such-id/pin", { pinned: true })).status).toBe(404);
    let r = await api(t.coopX.token, "PATCH", `/api/announcements/${own}/pin`, { pinned: true });
    expect(r.status, msg(r)).toBe(200);
    expect((await prisma.announcement.findUnique({ where: { id: own } })).pinned).toBe(true);

    const base = { date: "2026-11-04", year: L1 };
    expect((await post(t.coopX.token, { ...base, id: other, title: T("แก้ของY"), targetMajors: [X] })).status).toBe(403);
    expect((await post(t.coopX.token, { ...base, id: global, title: T("แก้ส่วนกลาง"), targetMajors: [X] })).status).toBe(403);
    expect((await post(t.coopX.token, { ...base, id: own, title: T("ย้ายไปY"), targetMajors: [Y] })).status).toBe(403);
    expect((await post(staff.token, { ...base, id: "no-such-id", title: T("ไม่มี") })).status).toBe(404);
    r = await post(t.coopX.token, { ...base, id: own, title: T("จากอาจารย์X"), body: "แก้แล้ว", targetMajors: [X] });
    expect(r.status, msg(r)).toBe(200);

    expect((await api(t.coopX.token, "DELETE", `/api/announcements/${other}`)).status).toBe(403);
    expect((await api(t.coopX.token, "DELETE", `/api/announcements/${global}`)).status).toBe(403);
    expect((await api(t.plainX.token, "DELETE", `/api/announcements/${own}`)).status).toBe(403);
    expect((await api(staff.token, "DELETE", "/api/announcements/no-such-id")).status).toBe(404);
    expect(await prisma.announcement.findUnique({ where: { id: other } })).not.toBeNull();
  });

  test("แจ้งเตือนประกาศ: ส่งถึงนักศึกษาในรอบ+หลักสูตรเป้าหมายเท่านั้น · ตั้งเวลา = ยังไม่แจ้ง → ถึงเวลา (แก้เป็นเผยแพร่ทันที) แจ้งครั้งเดียว", async () => {
    const annNotes = async (userId: number, title: string) =>
      (await k.notes(userId, "ANNOUNCEMENT")).filter((n: { message: string }) => n.message === title).length;
    await expect.poll(() => annNotes(s.x.userId, T("ของX"))).toBe(1);
    expect(await annNotes(s.y.userId, T("ของX"))).toBe(0);
    expect(await annNotes(s.x2.userId, T("ของX"))).toBe(0);
    expect(await annNotes(s.free.userId, T("ของX"))).toBe(0);      // ยังไม่ผูกรอบ = ไม่ได้รับแจ้ง (เห็นในหน้าประกาศได้)
    expect(await annNotes(s.trash.userId, T("ส่วนกลาง"))).toBe(0);
    await expect.poll(() => annNotes(s.y.userId, T("ส่วนกลาง"))).toBe(1);
    expect(await annNotes(s.x.userId, T("ตั้งเวลาX"))).toBe(0);

    const id = await annId(T("ตั้งเวลาX"));
    const r = await post(staff.token, { id, title: T("ตั้งเวลาX"), date: "2026-11-04", year: L1, targetMajors: [X] });
    expect(r.status, msg(r)).toBe(200);
    await expect.poll(() => annNotes(s.x.userId, T("ตั้งเวลาX"))).toBe(1);
    expect(titles(await api(s.x.token, "GET", "/api/announcements"))).toContain(T("ตั้งเวลาX"));
    await post(staff.token, { id, title: T("ตั้งเวลาX"), date: "2026-11-04", year: L1, targetMajors: [X], body: "แก้ซ้ำ" });
    await new Promise((res) => setTimeout(res, 500));
    expect(await annNotes(s.x.userId, T("ตั้งเวลาX"))).toBe(1);
  });
});

// ══════════════════════════════════════════════════════
// D. แจ้งเตือน · ตัวเลขงานรอ · แดชบอร์ดอาจารย์
// ══════════════════════════════════════════════════════
test.describe("D. แจ้งเตือนและตัวเลข", () => {
  test("ยังไม่อ่าน/แยกประเภท · อ่านตามเมนู (ประเภทผิดรูปแบบ 400) · อ่านทั้งหมด · ไม่กระทบของคนอื่น", async () => {
    await prisma.notification.create({ data: { userId: s.x.userId, type: "DOC_STATUS", title: "t", message: `${C()} เอกสาร`, link: "/student/docs" } });
    const unread = async (tk: string) => (await api(tk, "GET", "/api/notifications/unread-count")).body.count as number;
    const before = await unread(s.x.token);
    expect(before).toBeGreaterThanOrEqual(2);
    const counts = (await api(s.x.token, "GET", "/api/notifications/counts")).body.counts;
    expect(counts.DOC_STATUS).toBe(1);
    expect(counts.ANNOUNCEMENT).toBeGreaterThanOrEqual(1);
    for (const bad of [undefined, [], "ANNOUNCEMENT", ["announcement"], Array.from({ length: 21 }, () => "A"), ["A B"]]) {
      expect((await api(s.x.token, "POST", "/api/notifications/mark-read", bad === undefined ? {} : { types: bad })).status, JSON.stringify(bad)).toBe(400);
    }
    const r = await api(s.x.token, "POST", "/api/notifications/mark-read", { types: ["DOC_STATUS"] });
    expect(r.body.count).toBe(1);
    expect(await unread(s.x.token)).toBe(before - 1);
    const yBefore = await unread(s.y.token);
    expect(yBefore).toBeGreaterThan(0);
    await api(s.x.token, "POST", "/api/notifications/mark-all-read");
    expect(await unread(s.x.token)).toBe(0);
    expect(await unread(s.y.token)).toBe(yBefore);
  });

  test("ตัวเลขงานรอบนเมนู + แดชบอร์ดอาจารย์ตามหลักสูตร: ประจำวิชา X นับเฉพาะ X · อาจารย์ทั่วไปนับเฉพาะนักศึกษาในที่ปรึกษา · นักศึกษาไม่มีตัวเลข", async () => {
    expect((await api(s.x.token, "GET", "/api/notifications/pending")).body.pending).toEqual({});
    const pend = async (tk: string) => (await api(tk, "GET", "/api/notifications/pending")).body.pending;
    expect((await pend(t.coopX.token)).coopApplications).toBe(1);     // s.x (APPLYING ใน X) — ไม่นับ s.y ของ Y
    expect((await pend(t.coopY.token)).coopApplications).toBe(1);
    expect((await pend(t.plainX.token)).coopApplications).toBeUndefined();

    const stats = async (tk: string, q = "") => (await api(tk, "GET", `/api/teacher/stats${q}`)).body.data;
    const sem1 = `?semester=1&year=${encodeURIComponent(C())}`;
    expect(await stats(t.coopX.token, sem1)).toMatchObject({ myStudentsCount: 1, pendingRequests: 1 });   // s.x (s.trash อยู่ถังขยะ ไม่นับ · s.y เป็นหลักสูตร Y)
    expect(await stats(t.advisor.token, sem1)).toMatchObject({ myStudentsCount: 1, pendingRequests: 1 }); // s.y ในที่ปรึกษา (หลักสูตร Y)
    expect((await api(t.coopX.token, "GET", "/api/teacher/stats?semester=abc&year=1")).status).toBe(400);
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

test.describe("E. หน้าเว็บนักศึกษา", () => {
  test("หน้าประกาศ: นักศึกษา Y เห็นประกาศ Y + ส่วนกลาง ไม่เห็นของ X", async ({ page }) => {
    await asUser(page, s.y.token, s.y.userId, "/student/announcements");
    await expect(page.getByText(`${C()} ของY`).first()).toBeVisible();
    await expect(page.getByText(`${C()} ส่วนกลาง`).first()).toBeVisible();
    await expect(page.getByText(`${C()} ของX`)).toHaveCount(0);
  });

  test("(ใหม่) หน้าข้อมูลนักศึกษา: เข้ารอบสหกิจแล้ว ช่องหลักสูตรล็อก พร้อมบอกให้ติดต่อเจ้าหน้าที่ · ยังไม่เข้ารอบเลือกได้", async ({ page }) => {
    await asUser(page, s.x.token, s.x.userId, "/student/profile");
    await page.getByRole("button", { name: /แก้ไข/ }).first().click();
    const select = page.locator("label", { hasText: /^หลักสูตร$/ }).locator("..").locator("select");
    await expect(select).toBeDisabled();
    await expect(page.getByText(/เปลี่ยนหลักสูตรหลังเข้ารอบสหกิจ/)).toBeVisible();

    await asUser(page, s.free.token, s.free.userId, "/student/profile");
    await page.getByRole("button", { name: /แก้ไข/ }).first().click();
    await expect(page.locator("label", { hasText: /^หลักสูตร$/ }).locator("..").locator("select")).toBeEnabled();

    // เข้ารอบแล้วแต่หลักสูตรว่าง (โดนบั๊กล้าง) → เลือกเองได้
    await prisma.student.update({ where: { id: s.x2.pk }, data: { major: null } });
    await asUser(page, s.x2.token, s.x2.userId, "/student/profile");
    await page.getByRole("button", { name: /แก้ไข/ }).first().click();
    await expect(page.locator("label", { hasText: /^หลักสูตร$/ }).locator("..").locator("select")).toBeEnabled();
    await prisma.student.update({ where: { id: s.x2.pk }, data: { major: X } });
  });
});
