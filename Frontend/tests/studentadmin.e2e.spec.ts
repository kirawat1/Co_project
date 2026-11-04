/**
 * tests/studentadmin.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * จัดการนักศึกษา (เจ้าหน้าที่ / อาจารย์ประจำวิชา / อาจารย์ที่ปรึกษา) — รายชื่อ + ตัวกรอง/ค้นหา/แบ่งหน้า · เพิ่มทีละคน · แก้ไข
 * · รหัสผ่าน (รีเซ็ต/ดู) · ถังขยะ (ย้าย/กู้คืน/ลบถาวร + ไม่โผล่ในรายการอื่น) · ส่งออก Excel · แถบสถานะ
 * — backend + DB จริง หลักสูตรทดสอบ X/Y แยกจากข้อมูลจริง (ข้อมูล ZN ลบทิ้งตอนจบ)
 *
 * บั๊กที่แก้รอบนี้: บันทึกหน้าข้อมูลนักศึกษา = รหัสนักศึกษาแบบมีขีด (643040001-1 ตามระบบทะเบียน) ถูกตัดเหลือ 6430400011
 *   — นำเข้า Excel ครั้งต่อไปชนกับบัญชีเดิม · ค้นด้วยรหัสแบบมีขีดไม่เจอ (ตอนนี้เก็บแบบมีขีดเสมอ ค้นได้ทั้งสองแบบ)
 */
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { api, type Res } from "./helpers/letterWorld";
import { WorldKit, prisma, UPLOADS, BACKEND_DIR, type KStudent, type KTeacher, type KUser } from "./helpers/worldKit";

const XLSX = createRequire(import.meta.url)(path.join(BACKEND_DIR, "node_modules/xlsx"));
const k = new WorldKit("ZN");
test.describe.configure({ mode: "serial" });
const msg = (r: Res) => JSON.stringify(r.body);
const C = () => `${k.prefix}${k.tail}`;
const digits = (n: number) => `9${k.tail}${String(n).padStart(4, "0")}`;           // รหัสตัวเลข 10 หลักของ world นี้
const dashed = (n: number) => { const d = digits(n); return `${d.slice(0, 9)}-${d.slice(9)}`; };
async function apiH(token: string, method: string, url: string, headers: Record<string, string>): Promise<Res> {
  const r = await fetch(`http://localhost:5000${url}`, { method, headers: { Authorization: `Bearer ${token}`, ...headers } });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function signin(email: string, password: string) {
  const r = await fetch("http://localhost:5000/api/auth/signin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, role: "student" }) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function xlsxRows(token: string, url: string) {
  const r = await fetch(`http://localhost:5000${url}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status !== 200) return { status: r.status, ids: [] as string[] };
  const wb = XLSX.read(Buffer.from(await r.arrayBuffer()), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as Record<string, string>[];
  return { status: 200, ids: rows.map((row) => String(row["รหัสนักศึกษา"])) };
}

let staff: KUser;
let X = "", Y = "", P = 0, P2 = 0;
const t = {} as Record<"coopX" | "coopY" | "advisor", KTeacher>;
const s = {} as Record<"a" | "b" | "c" | "d" | "e" | "f" | "legacy" | "trA" | "trB", KStudent>;
const list = async (token: string, q: string) => {
  const r = await api(token, "GET", `/api/students?${q}`);
  return { r, ids: (r.body?.data || []).map((x: { id: number }) => x.id) as number[] };
};
const mine = (ids: number[]) => ids.filter((id) => Object.values(s).some((x) => x.pk === id));

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน");
  staff = await k.staff();
  X = await k.major("X", "หลักสูตรเอ็กซ์");
  Y = await k.major("Y", "หลักสูตรวาย");
  P = await k.period(1, { [X]: {}, [Y]: {} });
  P2 = await k.period(2, { [X]: {} });
  t.coopX = await k.teacher("ประจำวิชาX", { major: X, coop: [X] });
  t.coopY = await k.teacher("ประจำวิชาY", { major: Y, coop: [Y] });
  t.advisor = await k.teacher("ที่ปรึกษา", { major: Y });
  s.a = await k.student("a", 1, { major: X, status: "APPLYING", periodId: P, advisor: t.advisor.pk });
  s.b = await k.student("b", 2, { major: X, status: "QUALIFIED", periodId: P });
  s.c = await k.student("c", 3, { major: Y, status: "WAITING_FOR_STAFF_CHECK", periodId: P });
  s.d = await k.student("d", 4, { major: X, periodId: P2 });
  s.e = await k.student("e", 5, { major: null, status: null });
  s.f = await k.student("f", 6, { major: X });
  s.legacy = await k.student("legacy", 7, { major: "หลักสูตรเอ็กซ์", periodId: P });   // ข้อมูลเก่าเก็บชื่อไทยแทนรหัส
  s.trA = await k.student("trA", 8, { major: X, status: "APPLYING", periodId: P, docs: [{ type: "APPLICATION_DOC", file: true }] });
  s.trB = await k.student("trB", 9, { major: X, status: "WAITING_FOR_STAFF_CHECK", periodId: P });
  await prisma.student.update({ where: { id: s.b.pk }, data: { studyProgram: "special" } });
  await prisma.supervisionAppointment.create({ data: { studentId: s.trB.pk, teacherId: t.coopX.pk, proposedDates: "[]", supervisionType: "ONLINE" } });
  for (const x of [s.trA, s.trB]) await prisma.student.update({ where: { id: x.pk }, data: { deletedAt: new Date() } });
});
test.afterAll(async () => { await k.cleanup(); await k.disconnect(); });

// ══════════════════════════════════════════════════════
// A. รายชื่อ
// ══════════════════════════════════════════════════════
test.describe("A. รายชื่อนักศึกษา", () => {
  test("ตัวกรองรอบ (รอบ/ยังไม่เลือกรอบ/ค่าผิด 400) · สถานะ · ภาค · หลักสูตร (รวมข้อมูลเก่าที่เก็บชื่อไทย · ไม่มีหลักสูตร) · ถังขยะไม่ขึ้น", async () => {
    const first = await list(staff.token, `coopPeriodId=${P}`);
    let ids = first.ids;
    expect(first.r.status, msg(first.r)).toBe(200);
    expect(ids.sort()).toEqual([s.a.pk, s.b.pk, s.c.pk, s.legacy.pk].sort());
    ({ ids } = await list(staff.token, "coopPeriodId=none&limit=100&search=" + encodeURIComponent(C())));
    expect(mine(ids).sort()).toEqual([s.e.pk, s.f.pk].sort());
    expect((await api(staff.token, "GET", "/api/students?coopPeriodId=abc")).status).toBe(400);
    ({ ids } = await list(staff.token, `coopPeriodId=${P}&statuses=APPLYING`));
    expect(ids).toEqual([s.a.pk]);
    ({ ids } = await list(staff.token, `coopPeriodId=${P}&studyProgram=special`));
    expect(ids).toEqual([s.b.pk]);
    ({ ids } = await list(staff.token, `coopPeriodId=${P}&majors=${X}`));
    expect(ids.sort()).toEqual([s.a.pk, s.b.pk, s.legacy.pk].sort());
    ({ ids } = await list(staff.token, `majors=__NONE__&limit=100&search=${encodeURIComponent(C())}`));
    expect(mine(ids)).toEqual([s.e.pk]);
    expect((await api(s.a.token, "GET", "/api/students")).status).toBe(403);
  });

  test("ค้นหา (รหัส/ชื่อ/อีเมล) · แบ่งหน้า (สูงสุด 100 ต่อหน้า) · เรียงลำดับ (ช่องที่ไม่อนุญาต = รหัส) · ตัวกรองหลักสูตรบนแถบบนของเจ้าหน้าที่", async () => {
    expect((await list(staff.token, `search=${s.a.studentId}`)).ids).toEqual([s.a.pk]);
    expect((await list(staff.token, `search=${encodeURIComponent(s.b.email)}`)).ids).toEqual([s.b.pk]);
    expect((await list(staff.token, `search=${encodeURIComponent("นศc")}&coopPeriodId=${P}`)).ids).toEqual([s.c.pk]);
    let { r, ids } = await list(staff.token, `coopPeriodId=${P}&limit=2&page=2`);
    expect(r.body.meta).toEqual({ total: 4, page: 2, limit: 2, totalPages: 2 });
    expect(ids).toHaveLength(2);
    ({ r } = await list(staff.token, `coopPeriodId=${P}&limit=1000&page=-3`));
    expect([r.body.meta.limit, r.body.meta.page]).toEqual([100, 1]);
    ({ ids } = await list(staff.token, `coopPeriodId=${P}&sortBy=studentId&sortDir=desc`));
    expect(ids).toEqual([s.legacy.pk, s.c.pk, s.b.pk, s.a.pk]);
    ({ r, ids } = await list(staff.token, `coopPeriodId=${P}&sortBy=password`));
    expect([r.status, ids]).toEqual([200, [s.a.pk, s.b.pk, s.c.pk, s.legacy.pk]]);
    const y = await apiH(staff.token, "GET", `/api/students?coopPeriodId=${P}`, { "x-major-filter": Y });
    expect(y.body.data.map((x: { id: number }) => x.id)).toEqual([s.c.pk]);
  });

  test("อาจารย์: ประจำวิชาเห็นหลักสูตรตัวเอง (ตัวกรองบนแถบบนแคบลงได้ ขยายไม่ได้) · ที่ปรึกษาเห็นเฉพาะนักศึกษาที่ตัวเองเป็นที่ปรึกษาโครงงาน · นับต่อรอบ", async () => {
    expect(mine((await list(t.coopX.token, `coopPeriodId=${P}`)).ids).sort()).toEqual([s.a.pk, s.b.pk].sort());
    expect(mine((await list(t.coopY.token, `coopPeriodId=${P}`)).ids)).toEqual([s.c.pk]);
    const widen = await apiH(t.coopX.token, "GET", `/api/students?coopPeriodId=${P}`, { "x-major-filter": Y });
    expect(mine(widen.body.data.map((x: { id: number }) => x.id))).not.toContain(s.c.pk);
    expect((await list(t.advisor.token, "limit=100")).ids).toEqual([s.a.pk]);      // หลักสูตร X แต่อาจารย์เป็นที่ปรึกษา
    const counts = await api(t.coopX.token, "GET", `/api/students?countsOnly=1&pending=APPLYING`);
    expect(counts.body.periods).toEqual(expect.arrayContaining([{ coopPeriodId: P, count: 2, pending: 1 }]));
  });
});

// ══════════════════════════════════════════════════════
// B. เพิ่ม / แก้ไข / รหัสผ่าน
// ══════════════════════════════════════════════════════
test.describe("B. เพิ่ม · แก้ไข · รหัสผ่าน", () => {
  const body = (n: number, extra: object = {}) => ({ studentId: digits(n), firstName: `เพิ่ม${n}`, lastName: C(), email: `${k.tag}-new${n}@kkumail.com`, major: X, ...extra });

  test("เพิ่มทีละคน: ช่องบังคับ/อีเมลนอก KKU 400 · ชื่อไทยของหลักสูตร → รหัส · หลักสูตรไม่มีจริง 400 · ประจำวิชาเพิ่มได้เฉพาะหลักสูตรตัวเอง · ซ้ำ 409 (ในถังขยะบอกให้กู้คืน)", async () => {
    expect((await api(staff.token, "POST", "/api/admin/students/create", { firstName: "ก" })).status).toBe(400);
    expect((await api(staff.token, "POST", "/api/admin/students/create", body(10, { email: "x@gmail.com" }))).status).toBe(400);
    expect((await api(staff.token, "POST", "/api/admin/students/create", body(10, { major: "ไม่มีหลักสูตรนี้" }))).status).toBe(400);
    expect((await api(t.coopX.token, "POST", "/api/admin/students/create", body(10, { major: Y }))).status).toBe(403);
    expect((await api(t.coopX.token, "POST", "/api/admin/students/create", body(10, { major: undefined }))).status).toBe(403);
    expect((await api(t.advisor.token, "POST", "/api/admin/students/create", body(10))).status).toBe(403);
    let r = await api(staff.token, "POST", "/api/admin/students/create", body(10, { major: "หลักสูตรเอ็กซ์" }));
    expect(r.status, msg(r)).toBe(201);
    expect((await prisma.student.findFirst({ where: { user: { email: `${k.tag}-new10@kkumail.com` } } })).major).toBe(X);
    r = await api(t.coopX.token, "POST", "/api/admin/students/create", body(11));
    expect(r.status, msg(r)).toBe(201);
    expect((await api(staff.token, "POST", "/api/admin/students/create", body(12, { email: `${k.tag}-new10@kkumail.com` }))).status).toBe(409);
    r = await api(staff.token, "POST", "/api/admin/students/create", body(12, { studentId: s.trA.studentId }));
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/ถังขยะ/);
  });

  test("(ใหม่) รหัสนักศึกษาแบบระบบทะเบียน: เพิ่มด้วยเลข 10 หลักเก็บแบบมีขีด · ซ้ำกันข้ามรูปแบบ 409 · รหัสผ่านเริ่มต้นเข้าระบบได้", async () => {
    const r = await api(staff.token, "POST", "/api/admin/students/create", body(13));
    expect(r.status, msg(r)).toBe(201);
    expect(r.body.data.studentId).toBe(dashed(13));
    expect((await api(staff.token, "POST", "/api/admin/students/create", body(14, { studentId: dashed(13) }))).status).toBe(409);
    // ข้อมูลเดิมที่ถูกตัดขีดไปแล้ว (6430400011) = คนเดียวกับ 643040001-1 → เพิ่มซ้ำไม่ได้ · แก้คนอื่นให้ใช้รหัสนี้ก็ไม่ได้
    await prisma.student.update({ where: { id: s.e.pk }, data: { studentId: digits(16) } });
    expect((await api(staff.token, "POST", "/api/admin/students/create", body(14, { studentId: dashed(16) }))).status).toBe(409);
    expect((await api(staff.token, "PUT", `/api/admin/students/${s.f.pk}`, { studentId: dashed(16) })).status).toBe(409);
    await prisma.student.update({ where: { id: s.e.pk }, data: { studentId: s.e.studentId } });
    expect((await signin(`${k.tag}-new13@kkumail.com`, dashed(13))).status).toBe(200);
  });

  test("(ใหม่) นักศึกษาบันทึกหน้าข้อมูลของตัวเอง: รหัสแบบมีขีดไม่ถูกตัด (หน้าเว็บส่งเลขล้วนมา = รหัสเดิม) · พิมพ์รหัสใหม่ 10 หลักเก็บแบบมีขีด · ค้นได้ทั้งสองแบบ", async () => {
    const row = await prisma.student.findFirst({ where: { studentId: dashed(13) }, select: { id: true, userId: true } });
    const tk = k.token(row.userId, "student");
    let r = await api(tk, "PUT", "/api/students/me", { studentId: digits(13), phone: "0811111111" });
    expect(r.status, msg(r)).toBe(200);
    expect((await prisma.student.findUnique({ where: { id: row.id } })).studentId).toBe(dashed(13));
    r = await api(tk, "PUT", "/api/students/me", { studentId: dashed(13) });
    expect(r.status, msg(r)).toBe(200);
    expect((await prisma.student.findUnique({ where: { id: row.id } })).studentId).toBe(dashed(13));
    for (const empty of ["", null]) {                                   // (ใหม่) ส่งค่าว่าง = คงเดิม (เดิมรหัสกลายเป็นค่าว่าง)
      r = await api(tk, "PUT", "/api/students/me", { studentId: empty, phone: "0811111112" });
      expect(r.status, msg(r)).toBe(200);
      expect((await prisma.student.findUnique({ where: { id: row.id } })).studentId).toBe(dashed(13));
    }
    expect((await api(tk, "PUT", "/api/students/me", { studentId: `${digits(13)}9` })).status).toBe(400);   // 11 หลัก
    r = await api(tk, "PUT", "/api/students/me", { studentId: digits(15) });
    expect(r.status, msg(r)).toBe(200);
    expect((await prisma.student.findUnique({ where: { id: row.id } })).studentId).toBe(dashed(15));
    expect((await list(staff.token, `search=${digits(15)}`)).ids).toEqual([row.id]);
    expect((await list(staff.token, `search=${dashed(15)}`)).ids).toEqual([row.id]);
    r = await api(staff.token, "PUT", `/api/admin/students/${row.id}`, { studentId: digits(13) });
    expect(r.status, msg(r)).toBe(200);
    expect((await prisma.student.findUnique({ where: { id: row.id } })).studentId).toBe(dashed(13));
  });

  test("แก้ไข: ประจำวิชาแก้ได้เฉพาะหลักสูตรตัวเอง · ถังขยะ 400 · ที่ปรึกษาไม่มีจริง 400 · เปลี่ยนอีเมล = อีเมลเข้าระบบเปลี่ยนตาม · อีเมลชนบัญชีอื่น 409", async () => {
    expect((await api(t.coopX.token, "PUT", `/api/admin/students/${s.c.pk}`, { firstName: "แก้" })).status).toBe(403);
    expect((await api(staff.token, "PUT", `/api/admin/students/${s.trA.pk}`, { firstName: "แก้" })).status).toBe(400);
    expect((await api(staff.token, "PUT", `/api/admin/students/${s.b.pk}`, { coopAdvisorId: 999999999 })).status).toBe(400);
    expect((await api(staff.token, "PUT", `/api/admin/students/${s.b.pk}`, { email: s.a.email })).status).toBe(409);
    const next = `${k.tag}-b-new@kkumail.com`;
    const r = await api(t.coopX.token, "PUT", `/api/admin/students/${s.b.pk}`, { email: next, phone: "0822222222" });
    expect(r.status, msg(r)).toBe(200);
    const u = await prisma.user.findUnique({ where: { id: s.b.userId } });
    expect([u.email, u.username]).toEqual([next, next]);
  });

  test("รหัสผ่าน: รีเซ็ต/ดู = เจ้าหน้าที่เท่านั้น · รีเซ็ตแล้ว session เดิมใช้ไม่ได้ + เข้าด้วยรหัสนักศึกษาได้ · ดูรหัสได้รหัสเริ่มต้น · ถังขยะ 404", async () => {
    const row = await prisma.student.findFirst({ where: { studentId: dashed(13) }, select: { id: true, userId: true } });
    const tk = k.token(row.userId, "student");
    expect((await api(tk, "GET", "/api/students/me")).status).toBe(200);
    expect((await api(t.coopX.token, "PATCH", `/api/admin/students/${row.id}/reset-password`)).status).toBe(403);
    expect((await api(t.coopX.token, "POST", `/api/admin/students/${row.id}/password/reveal`)).status).toBe(403);
    let r = await api(staff.token, "PATCH", `/api/admin/students/${row.id}/reset-password`);
    expect(r.status, msg(r)).toBe(200);
    expect((await api(tk, "GET", "/api/students/me")).status).toBe(401);
    r = await api(staff.token, "POST", `/api/admin/students/${row.id}/password/reveal`);
    expect(r.body.data.password).toBe(dashed(13));
    expect((await api(staff.token, "PATCH", `/api/admin/students/${s.trA.pk}/reset-password`)).status).toBe(404);
    expect((await api(staff.token, "POST", `/api/admin/students/${s.trA.pk}/password/reveal`)).status).toBe(404);
  });
});

// ══════════════════════════════════════════════════════
// C. ถังขยะ
// ══════════════════════════════════════════════════════
test.describe("C. ถังขยะ", () => {
  test("นักศึกษาในถังขยะไม่โผล่ในรายการอื่น: T000 · คำร้อง · การนิเทศ · ตัวเลขงานรอ · ส่งออก · อาจารย์ · เข้าระบบไม่ได้", async () => {
    const ids = [s.trA.studentId, s.trB.studentId];
    const leak = (r: Res) => ids.filter((id) => JSON.stringify(r.body).includes(id));
    for (const url of [`/api/admin/t000/students?coopPeriodId=${P}`, `/api/admin/coop-applications?coopPeriodId=${P}`, `/api/admin/supervisions?coopPeriodId=${P}`, `/api/admin/students?coopPeriodId=${P}`]) {
      const r = await api(staff.token, "GET", url);
      expect(r.status, `${url} ${msg(r)}`).toBe(200);
      expect(leak(r), url).toEqual([]);
    }
    expect(leak(await api(t.coopX.token, "GET", "/api/teacher/my-students?limit=200"))).toEqual([]);
    expect(leak(await api(t.coopX.token, "GET", "/api/teacher/supervisions"))).toEqual([]);
    expect((await api(t.coopX.token, "GET", "/api/notifications/pending")).body.pending.coopApplications).toBe(1);   // s.a เท่านั้น
    expect((await xlsxRows(staff.token, `/api/admin/students/export?coopPeriodId=${P}`)).ids.filter((id) => ids.includes(id))).toEqual([]);
    expect((await signin(s.trA.email, "x")).status).toBe(401);
  });

  test("ย้ายลงถังขยะ (ซ้ำ 409 · ไม่มี 404 · นอกหลักสูตร 403 · อาจารย์ทั่วไป 403) → รายการถังขยะตามหลักสูตร → กู้คืน (ไม่อยู่ในถัง 409) → กลับมาในรายชื่อ", async () => {
    expect((await api(t.coopX.token, "DELETE", `/api/admin/students/${s.c.pk}`)).status).toBe(403);
    expect((await api(t.advisor.token, "DELETE", `/api/admin/students/${s.a.pk}`)).status).toBe(403);
    expect((await api(staff.token, "DELETE", "/api/admin/students/999999999")).status).toBe(404);
    expect((await api(staff.token, "DELETE", `/api/admin/students/${s.trA.pk}`)).status).toBe(409);
    let r = await api(t.coopX.token, "DELETE", `/api/admin/students/${s.f.pk}`);
    expect(r.status, msg(r)).toBe(200);
    const trashOf = async (tk: string) => mine((await api(tk, "GET", "/api/admin/students/trash")).body.data.map((x: { id: number }) => x.id)).sort();
    expect(await trashOf(t.coopX.token)).toEqual([s.f.pk, s.trA.pk, s.trB.pk].sort());
    expect(await trashOf(t.coopY.token)).toEqual([]);
    expect((await api(t.advisor.token, "GET", "/api/admin/students/trash")).status).toBe(403);
    expect((await api(staff.token, "POST", `/api/admin/students/${s.a.pk}/restore`)).status).toBe(409);
    expect((await api(t.coopY.token, "POST", `/api/admin/students/${s.f.pk}/restore`)).status).toBe(403);
    r = await api(t.coopX.token, "POST", `/api/admin/students/${s.f.pk}/restore`);
    expect(r.status, msg(r)).toBe(200);
    expect((await list(staff.token, `search=${s.f.studentId}`)).ids).toEqual([s.f.pk]);
  });

  test("ลบถาวร: ต้องอยู่ในถังขยะก่อน (400) · นอกหลักสูตร 403 · ลบบัญชี + เอกสาร + นัดนิเทศ + ไฟล์ · ไม่มี 404", async () => {
    expect((await api(staff.token, "DELETE", `/api/admin/students/${s.a.pk}/permanent`)).status).toBe(400);
    expect((await api(t.coopY.token, "DELETE", `/api/admin/students/${s.trA.pk}/permanent`)).status).toBe(403);
    const file = path.join(UPLOADS, (await k.docs(s.trA.pk))[0].path);
    expect(fs.existsSync(file)).toBe(true);
    let r = await api(t.coopX.token, "DELETE", `/api/admin/students/${s.trA.pk}/permanent`);
    expect(r.status, msg(r)).toBe(200);
    expect([await prisma.student.findUnique({ where: { id: s.trA.pk } }), await prisma.user.findUnique({ where: { id: s.trA.userId } })]).toEqual([null, null]);
    expect(await prisma.document.count({ where: { studentId: s.trA.pk } })).toBe(0);
    expect(fs.existsSync(file)).toBe(false);
    r = await api(staff.token, "DELETE", `/api/admin/students/${s.trB.pk}/permanent`);
    expect(r.status, msg(r)).toBe(200);
    expect(await prisma.supervisionAppointment.count({ where: { studentId: s.trB.pk } })).toBe(0);
    expect((await api(staff.token, "DELETE", `/api/admin/students/${s.trB.pk}/permanent`)).status).toBe(404);
  });
});

// ══════════════════════════════════════════════════════
// D. ส่งออก Excel
// ══════════════════════════════════════════════════════
test.describe("D. ส่งออก Excel", () => {
  test("เจ้าหน้าที่: ตามรอบ · ตัวกรองหลักสูตรบนแถบบน · รอบผิด 400 · ประจำวิชาได้เฉพาะหลักสูตรตัวเอง · อาจารย์: นักศึกษาในที่ปรึกษา · อาจารย์ทั่วไปใช้ไฟล์ของเจ้าหน้าที่ไม่ได้", async () => {
    const sid = (x: KStudent) => x.studentId;
    let x = await xlsxRows(staff.token, `/api/admin/students/export?coopPeriodId=${P}`);
    expect([x.status, x.ids.sort()]).toEqual([200, [sid(s.a), sid(s.b), sid(s.c), sid(s.legacy)].sort()]);
    const r = await fetch(`http://localhost:5000/api/admin/students/export?coopPeriodId=${P}`, { headers: { Authorization: `Bearer ${staff.token}`, "x-major-filter": Y } });
    const wb = XLSX.read(Buffer.from(await r.arrayBuffer()), { type: "buffer" });
    expect((XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as Record<string, string>[]).map((row) => row["รหัสนักศึกษา"])).toEqual([sid(s.c)]);
    expect((await xlsxRows(staff.token, "/api/admin/students/export?coopPeriodId=abc")).status).toBe(400);
    x = await xlsxRows(t.coopX.token, `/api/admin/students/export?coopPeriodId=${P}`);
    expect(x.ids.sort()).toEqual([sid(s.a), sid(s.b)].sort());
    x = await xlsxRows(t.advisor.token, "/api/teacher/students/export");
    expect(x.ids).toEqual([sid(s.a)]);
    expect((await xlsxRows(t.advisor.token, "/api/admin/students/export")).status).toBe(403);
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

test.describe("E. หน้าเว็บ", () => {
  test("หน้านักศึกษา (เจ้าหน้าที่): ค้นหา → ย้ายไปถังขยะ → หน้าถังขยะ → กู้คืน → กลับมาในรายชื่อ", async ({ page }) => {
    await asUser(page, staff.token, staff.userId, "/admin/students");
    await page.getByPlaceholder("ค้นหา: รหัส / ชื่อ / อีเมล").fill(s.d.studentId);
    const row = page.locator("tr", { hasText: s.d.studentId });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: /ลบ|ถังขยะ/ }).first().click();
    await page.getByRole("button", { name: "ย้ายไปถังขยะ" }).click();
    await expect(row).toHaveCount(0);
    await expect.poll(async () => (await prisma.student.findUnique({ where: { id: s.d.pk } })).deletedAt).not.toBeNull();
    await page.getByRole("button", { name: /ถังขยะ/ }).first().click();
    const trashRow = page.locator("tr", { hasText: s.d.studentId });
    await trashRow.getByRole("button", { name: /กู้คืน/ }).click();
    await expect.poll(async () => (await prisma.student.findUnique({ where: { id: s.d.pk } })).deletedAt).toBeNull();
  });

  test("(ใหม่) หน้าข้อมูลนักศึกษา: รหัสแบบมีขีดขึ้นครบในช่องแก้ไข · กดบันทึกแล้วรหัสยังมีขีด", async ({ page }) => {
    const stu = await k.student("ui", 20, { major: X });
    await prisma.student.update({ where: { id: stu.pk }, data: { studentId: dashed(20) } });
    await asUser(page, stu.token, stu.userId, "/student/profile");
    await page.getByRole("button", { name: /แก้ไข/ }).first().click();
    await expect(page.locator("label", { hasText: /^รหัสนักศึกษา$/ }).locator("..").locator("input")).toHaveValue(dashed(20));
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText("บันทึกข้อมูลเรียบร้อย")).toBeVisible();
    expect((await prisma.student.findUnique({ where: { id: stu.pk } })).studentId).toBe(dashed(20));
  });

  test("กดป้ายสถานะในรายชื่อ = ขั้นตอนเดียวกับที่นักศึกษาเห็นในหน้าของตัวเอง", async ({ browser }) => {
    const staffPage = await (await browser.newContext()).newPage();
    await asUser(staffPage, staff.token, staff.userId, "/admin/students");
    await staffPage.getByPlaceholder("ค้นหา: รหัส / ชื่อ / อีเมล").fill(s.c.studentId);
    await staffPage.getByRole("button", { name: `ดูสถานะของ ${s.c.studentId}` }).click();
    const popupStep = (await staffPage.getByRole("dialog").getByText(/ขั้นตอนที่ \d+:/).first().textContent())?.trim();
    expect(popupStep).toBeTruthy();

    const stuPage = await (await browser.newContext()).newPage();
    await asUser(stuPage, s.c.token, s.c.userId, "/student");
    await stuPage.getByRole("button", { name: "ดูทุกขั้นตอน →" }).click();
    await expect(stuPage.getByText(/ขั้นตอนที่ \d+:/).first()).toHaveText(popupStep!);
  });
});
