/**
 * tests/rounds.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * รอบสหกิจ (แยกหลักสูตร) · ปฏิทินกำหนดส่ง (ค่าวิทยาลัย/ค่าหลักสูตร/คัดลอก) · ขยายเวลารายคน · ย้ายรอบ · หัวข้อเอกสาร T000 แยกหลักสูตร
 * · หลายหลักสูตร (อาจารย์ประจำวิชาหลายหลักสูตร + ตัวกรองหลักสูตรบนแถบบน) — backend + DB จริง (ข้อมูล ZR ลบทิ้งตอนจบ ·
 * สถานะเปิดรับสมัครของรอบจริงถูกเก็บไว้แล้วคืนให้ เพราะเปิดรอบทดสอบ = ปิดรอบอื่นของหลักสูตรเดียวกัน)
 *
 * บั๊กที่แก้รอบนี้ (/scrutinize 2026-11-04): ย้ายรอบแล้ววันขยายเวลารายคนติดไปใช้กับรอบใหม่ · สร้าง/แก้รอบให้วันปิดก่อนวันเปิดได้
 *   · หัวข้อ T000 ตั้งรหัสซ้ำชนิดเอกสารของระบบ (T002_FORM ฯลฯ) / รหัส-ชื่อว่างได้ · เปลี่ยนรหัสหัวข้อแล้วไฟล์ที่ส่งไว้หลุดจากรายการ
 */
import { test, expect, type Page } from "@playwright/test";
import { api, type Res } from "./helpers/letterWorld";
import { WorldKit, prisma, day, type KStudent, type KTeacher, type KUser } from "./helpers/worldKit";

const k = new WorldKit("ZR");
test.describe.configure({ mode: "serial" });
const msg = (r: Res) => JSON.stringify(r.body);
const Y = () => `${k.prefix}${k.tail}`;
async function apiH(token: string, method: string, url: string, headers: Record<string, string>, body?: unknown): Promise<Res> {
  const r = await fetch(`http://localhost:5000${url}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
}

let staff: KUser;
const t = {} as Record<"coopCS" | "coopAI" | "coopMulti" | "plain", KTeacher>;
const s = {} as Record<string, KStudent>;
let P1: number, M: string;
const created: number[] = [];

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน");
  await k.snapshotActiveFlags();
  staff = await k.staff();
  M = await k.major("M");
  t.coopCS = await k.teacher("ประจำวิชาCS", { coop: ["CS"] });
  t.coopAI = await k.teacher("ประจำวิชาAI", { major: "AI", coop: ["AI"] });
  t.coopMulti = await k.teacher("ประจำวิชาสองหลักสูตร", { coop: ["CS", M] });
  t.plain = await k.teacher("ทั่วไป");
  P1 = await k.period(3, { CS: { isActive: false }, AI: { isActive: false }, [M]: { isActive: false } });
  s.cs = await k.student("cs", 1, { periodId: P1, status: "QUALIFIED" });
  s.ai = await k.student("ai", 2, { major: "AI", periodId: P1, status: "QUALIFIED" });
  s.m = await k.student("m", 3, { major: M, periodId: P1, status: "QUALIFIED" });
  s.noMajor = await k.student("noMajor", 4, { major: null, periodId: P1, status: "NOT_SUBMITTED" });
  s.move = await k.student("move", 5, { periodId: P1, status: "APPLYING" });
  s.intern = await k.student("intern", 6, { periodId: P1, status: "INTERNSHIP_STARTED" });
});
test.afterAll(async () => {
  await prisma.documentRequirement.deleteMany({ where: { docKey: { startsWith: Y() } } });
  await prisma.studentCoop.updateMany({ where: { coopPeriodId: { in: created } }, data: { coopPeriodId: null } });
  await prisma.coopPeriod.deleteMany({ where: { id: { in: created } } });
  await k.cleanup();
  await k.disconnect();
});

const createRound = (token: string, body: object) => api(token, "POST", "/api/admin/coop-periods", { academicYear: Y(), semester: 1, startDate: day(-10), endDate: day(60), ...body });
const periodRow = (periodId: number, major: string) => prisma.coopPeriodMajor.findUnique({ where: { periodId_major: { periodId, major } } });

// ══════════════════════════════════════════════════════
// A. สร้าง / แก้รอบ (แยกหลักสูตร)
// ══════════════════════════════════════════════════════
test.describe("A. สร้างและแก้รอบ", () => {
  test("สร้าง: ประจำวิชาได้เฉพาะหลักสูตรตัวเอง · ประจำวิชาอีกหลักสูตรเพิ่มแถวของตัวเองเข้ารอบเดิม · ซ้ำ 409 · ด่านข้อมูล · (ใหม่) วันปิดก่อนวันเปิด 400 · อาจารย์ทั่วไป/นักศึกษา 403", async () => {
    let r = await createRound(t.coopCS.token, {});
    expect(r.status, msg(r)).toBe(200);
    created.push(r.body.period.id);
    expect(r.body.added).toEqual(["CS"]);
    r = await createRound(t.coopAI.token, {});
    expect([r.status, r.body.added]).toEqual([200, ["AI"]]);
    expect((await createRound(t.coopCS.token, {})).status).toBe(409);
    expect((await createRound(staff.token, { academicYear: "" })).status).toBe(400);
    expect((await createRound(staff.token, { semester: 0 })).status).toBe(400);
    expect((await createRound(staff.token, { startDate: "" })).status).toBe(400);
    r = await createRound(staff.token, { semester: 2, startDate: day(30), endDate: day(10) });
    expect(r.status, msg(r)).toBe(400);
    expect(r.body.message).toMatch(/วันเปิดรับสมัครต้องไม่หลังวันปิด/);
    expect((await createRound(t.plain.token, { semester: 2 })).status).toBe(403);
    expect((await createRound(s.cs.token, { semester: 2 })).status).toBe(403);
    r = await createRound(staff.token, { semester: 2 });
    expect(r.status, msg(r)).toBe(200);
    created.push(r.body.period.id);
    expect(r.body.added).toEqual(expect.arrayContaining(["AI", "CS", M]));
  });

  test("แก้: ประจำวิชาแก้วันของหลักสูตรตัวเอง · หลักสูตรอื่น 403 · เจ้าหน้าที่แก้ปี/เทอม (ไม่ทับวันรายหลักสูตร) · (ใหม่) วันปิดก่อนวันเปิด 400 · ไม่มีรอบ 404", async () => {
    const id = created[0];
    let r = await api(t.coopCS.token, "PUT", `/api/admin/coop-periods/${id}`, { major: "CS", startDate: day(-5), endDate: day(40) });
    expect(r.status, msg(r)).toBe(200);
    expect((await periodRow(id, "CS"))?.endDate.toISOString().slice(0, 10)).toBe(day(40));
    expect((await api(t.coopCS.token, "PUT", `/api/admin/coop-periods/${id}`, { major: "AI", startDate: day(-5), endDate: day(40) })).status).toBe(403);
    r = await api(t.coopCS.token, "PUT", `/api/admin/coop-periods/${id}`, { major: "CS", startDate: day(50), endDate: day(40) });
    expect(r.status, msg(r)).toBe(400);
    r = await api(staff.token, "PUT", `/api/admin/coop-periods/${id}`, { academicYear: `${Y()}x`, semester: 1, startDate: day(-1), endDate: day(1) });
    expect(r.status, msg(r)).toBe(200);
    expect((await periodRow(id, "CS"))?.endDate.toISOString().slice(0, 10)).toBe(day(40));
    expect((await api(staff.token, "PUT", "/api/admin/coop-periods/999999999", { startDate: day(1), endDate: day(2) })).status).toBe(404);
  });
});

// ══════════════════════════════════════════════════════
// B. เปิด/ปิดรับสมัคร · ลบ
// ══════════════════════════════════════════════════════
test.describe("B. เปิด-ปิด และลบ", () => {
  test("เปิดรอบให้หลักสูตรหนึ่ง = ปิดรอบอื่นของหลักสูตรนั้นเท่านั้น (หลักสูตรอื่นไม่เกี่ยว) · ประจำวิชาเปิดของหลักสูตรอื่นไม่ได้ · เลยวันปิด/ยังไม่ตั้งแถว/ค่าผิด 400", async () => {
    const [a, b] = created;
    await prisma.coopPeriodMajor.update({ where: { periodId_major: { periodId: P1, major: "AI" } }, data: { isActive: true } });
    let r = await api(t.coopCS.token, "PATCH", `/api/admin/coop-periods/${a}/toggle`, { isActive: true, major: "CS" });
    expect(r.status, msg(r)).toBe(200);
    expect((await periodRow(a, "CS"))?.isActive).toBe(true);
    r = await api(staff.token, "PATCH", `/api/admin/coop-periods/${b}/toggle`, { isActive: true, major: "CS" });
    expect(r.status, msg(r)).toBe(200);
    expect([(await periodRow(a, "CS"))?.isActive, (await periodRow(b, "CS"))?.isActive, (await periodRow(P1, "AI"))?.isActive]).toEqual([false, true, true]);
    expect((await api(t.coopCS.token, "PATCH", `/api/admin/coop-periods/${b}/toggle`, { isActive: true, major: "AI" })).status).toBe(403);
    expect((await api(staff.token, "PATCH", `/api/admin/coop-periods/${b}/toggle`, { isActive: "yes" })).status).toBe(400);
    await prisma.coopPeriodMajor.update({ where: { periodId_major: { periodId: P1, major: "CS" } }, data: { endDate: new Date(Date.now() - 3 * 86400000) } });
    r = await api(staff.token, "PATCH", `/api/admin/coop-periods/${P1}/toggle`, { isActive: true, major: "CS" });
    expect([r.status, r.body.message]).toEqual([400, expect.stringMatching(/เลยวันปิดรับสมัครแล้ว/)]);
    await prisma.coopPeriodMajor.update({ where: { periodId_major: { periodId: P1, major: "CS" } }, data: { endDate: new Date(Date.now() + 90 * 86400000) } });
    expect((await api(staff.token, "PATCH", `/api/admin/coop-periods/${a}/toggle`, { isActive: true, major: M })).status).toBe(400);
  });

  test("รอบที่เปิดของนักศึกษาตามหลักสูตร · ไม่มีหลักสูตร = บอกสาเหตุ · ลบรอบ: เจ้าหน้าที่เท่านั้น · มีนักศึกษา 409 · เอาหลักสูตรออกจากรอบ: มีนักศึกษาหลักสูตรนั้น 409 · ไม่มีแถว 404", async () => {
    expect((await api(s.cs.token, "GET", "/api/students/coop-periods/active")).body.period?.id).toBe(created[1]);
    expect((await api(s.ai.token, "GET", "/api/students/coop-periods/active")).body.period?.id).toBe(P1);
    const nm = await api(s.noMajor.token, "GET", "/api/students/coop-periods/active");
    expect([nm.body.period, nm.body.reason]).toEqual([null, "NO_MAJOR"]);

    expect((await api(t.coopCS.token, "DELETE", `/api/admin/coop-periods/${created[0]}`)).status).toBe(403);
    expect((await api(staff.token, "DELETE", `/api/admin/coop-periods/${P1}`)).status).toBe(409);
    expect((await api(staff.token, "DELETE", `/api/admin/coop-periods/${P1}/majors/AI`)).status).toBe(409);
    expect((await api(t.coopCS.token, "DELETE", `/api/admin/coop-periods/${created[0]}/majors/AI`)).status).toBe(403);
    const r = await api(t.coopAI.token, "DELETE", `/api/admin/coop-periods/${created[0]}/majors/AI`);
    expect(r.status, msg(r)).toBe(200);
    expect(await periodRow(created[0], "AI")).toBeNull();
    expect((await api(t.coopAI.token, "DELETE", `/api/admin/coop-periods/${created[0]}/majors/AI`)).status).toBe(404);
  });
});

// ══════════════════════════════════════════════════════
// C. ปฏิทินกำหนดส่ง (ค่าวิทยาลัย / ค่าหลักสูตร / คัดลอก)
// ══════════════════════════════════════════════════════
test.describe("C. ปฏิทินกำหนดส่ง", () => {
  const save = (token: string, id: number, body: object) => api(token, "PUT", `/api/admin/coop-periods/${id}/deadlines`, body);

  test("อ่าน: เจ้าหน้าที่เห็นทุกหลักสูตร (แก้ค่าวิทยาลัยได้) · ประจำวิชาเห็นเฉพาะหลักสูตรตัวเอง · อาจารย์ประจำวิชาหลายหลักสูตร + ตัวกรองบนแถบบน = เฉพาะหลักสูตรที่กรอง", async () => {
    let r = await api(staff.token, "GET", `/api/admin/coop-periods/${P1}/deadlines`);
    expect([r.body.canEditCollege, r.body.majors.map((m: { major: string }) => m.major).sort()]).toEqual([true, ["AI", "CS", M].sort()]);
    r = await api(t.coopCS.token, "GET", `/api/admin/coop-periods/${P1}/deadlines`);
    expect([r.body.canEditCollege, r.body.majors.map((m: { major: string }) => m.major)]).toEqual([false, ["CS"]]);
    r = await api(t.coopMulti.token, "GET", `/api/admin/coop-periods/${P1}/deadlines`);
    expect(r.body.majors.map((m: { major: string }) => m.major).sort()).toEqual(["CS", M].sort());
    r = await apiH(t.coopMulti.token, "GET", `/api/admin/coop-periods/${P1}/deadlines`, { "x-major-filter": M });
    expect(r.body.majors.map((m: { major: string }) => m.major)).toEqual([M]);
    r = await apiH(t.coopMulti.token, "GET", `/api/admin/coop-periods/${P1}/deadlines`, { "x-major-filter": "AI" });   // กรองเกินขอบเขต = ไม่ขยาย
    expect(r.body.majors.map((m: { major: string }) => m.major)).not.toContain("AI");
    expect((await api(t.plain.token, "GET", `/api/admin/coop-periods/${P1}/deadlines`)).status).toBe(403);
  });

  test("ค่าวิทยาลัย: เจ้าหน้าที่เท่านั้น · ใช้กับหลักสูตรที่ติ๊กเฉพาะขั้นที่เปลี่ยน · ด่านข้อมูล (ขั้นไม่รู้จัก/วันไม่มีจริง/โหมดของขั้นที่ไม่มีโหมด/ปิดชั่วคราวไม่ใช่ true-false/หลักสูตรนอกรอบ) 400", async () => {
    const college = { T002: { due: day(-1), mode: "HARD" }, T008: { due: day(90) } };
    expect((await save(t.coopCS.token, P1, { major: "", deadlines: college })).status).toBe(403);
    const r = await save(staff.token, P1, { major: "", deadlines: college, applyTo: ["CS", M] });
    expect(r.status, msg(r)).toBe(200);
    expect(r.body.updated.sort()).toEqual(["CS", M].sort());
    expect([(await periodRow(P1, "CS"))?.deadlines?.T002?.due, (await periodRow(P1, "AI"))?.deadlines?.T002]).toEqual([day(-1), undefined]);
    for (const [name, deadlines] of [["step", { T999: { due: day(1) } }], ["date", { T002: { due: "2026-02-30" } }], ["mode", { T008: { due: day(1), mode: "SOFT" } }], ["closed", { T002: { due: day(1), closed: "yes" } }]] as const) {
      expect((await save(staff.token, P1, { major: "", deadlines })).status, name).toBe(400);
    }
    expect((await save(staff.token, P1, { major: "", deadlines: college, applyTo: ["ZZZ"] })).status).toBe(400);
    expect((await save(staff.token, P1, { deadlines: college })).status).toBe(400);
  });

  test("ค่าหลักสูตร: ประจำวิชาตั้งของหลักสูตรตัวเอง · หลักสูตรอื่น 403 · หลักสูตรที่ยังไม่อยู่ในรอบ 404 → นักศึกษาเห็นผลทันที (HARD เลยกำหนด = ปิด · SOFT = ส่งได้แต่ช้า · ปิดชั่วคราว = ปิด)", async () => {
    const cfg = async (key: string) => (await api(s[key].token, "GET", "/api/coop/config/t002")).body;
    expect(await cfg("cs")).toMatchObject({ isOpen: false, late: true, endDate: day(-1) });
    let r = await save(t.coopCS.token, P1, { major: "CS", deadlines: { T002: { due: day(-1), mode: "SOFT" } } });
    expect(r.status, msg(r)).toBe(200);
    expect(await cfg("cs")).toMatchObject({ isOpen: true, late: true });
    expect((await save(t.coopCS.token, P1, { major: "AI", deadlines: {} })).status).toBe(403);
    expect((await save(t.coopCS.token, created[0], { major: "CS", deadlines: {} })).status).toBe(200);
    const noRow = await save(staff.token, created[0], { major: "AI", deadlines: {} });
    expect(noRow.status, msg(noRow)).toBe(404);
    r = await save(t.coopMulti.token, P1, { major: M, deadlines: { T002: { due: day(5), closed: true } } });
    expect(r.status, msg(r)).toBe(200);
    expect(await cfg("m")).toMatchObject({ isOpen: false, closed: true });
  });

  test("คัดลอกจากรอบก่อน: เทอมเดียวกันเท่านั้น · เลื่อนปีให้ · ขั้นที่ปลายทางตั้งแล้วไม่ถูกทับ · ประจำวิชาคัดลอกเฉพาะแถวหลักสูตรตัวเอง (ไม่แตะค่าวิทยาลัย)", async () => {
    // ปีเป็นตัวเลขห่างกัน 1 ปี (เลื่อนปีให้) — ใช้ 9569/9570 ไม่ให้ชนรอบจริง
    const src = await k.period(4, { CS: { deadlines: { T003: { due: "2026-06-10" }, T002: { due: "2026-06-01" } } }, AI: { deadlines: { T003: { due: "2026-06-11" } } } });
    await prisma.coopPeriod.update({ where: { id: src }, data: { academicYear: "9569", deadlines: { T007: { due: "2026-07-01" } } } });
    const dst = await k.period(4, { CS: {}, AI: {} });
    await prisma.coopPeriod.update({ where: { id: dst }, data: { academicYear: "9570" } });
    await prisma.coopPeriodMajor.update({ where: { periodId_major: { periodId: dst, major: "CS" } }, data: { deadlines: { T002: { due: "2027-05-05" } } } });
    expect((await api(staff.token, "POST", `/api/admin/coop-periods/${dst}/deadlines/copy`, { fromPeriodId: dst })).status).toBe(400);
    expect((await api(staff.token, "POST", `/api/admin/coop-periods/${dst}/deadlines/copy`, { fromPeriodId: P1 })).status).toBe(400);
    let r = await api(t.coopCS.token, "POST", `/api/admin/coop-periods/${dst}/deadlines/copy`, { fromPeriodId: src });
    expect(r.status, msg(r)).toBe(200);
    expect([r.body.updated, r.body.college, r.body.copied, r.body.kept]).toEqual([["CS"], false, 1, 1]);
    const cs = (await periodRow(dst, "CS"))?.deadlines;
    expect([cs.T002.due, cs.T003.due]).toEqual(["2027-05-05", "2027-06-10"]);
    expect((await periodRow(dst, "AI"))?.deadlines?.T003).toBeUndefined();
    r = await api(staff.token, "POST", `/api/admin/coop-periods/${dst}/deadlines/copy`, { fromPeriodId: src });
    expect([r.status, r.body.college]).toEqual([200, true]);
    expect((await prisma.coopPeriod.findUnique({ where: { id: dst } })).deadlines.T007.due).toBe("2027-07-01");
    expect((await periodRow(dst, "AI"))?.deadlines?.T003?.due).toBe("2027-06-11");
  });
});

// ══════════════════════════════════════════════════════
// D. ขยายเวลารายคน · ย้ายรอบ
// ══════════════════════════════════════════════════════
test.describe("D. ขยายเวลา และย้ายรอบ", () => {
  const extend = (token: string, key: string, body: object) => api(token, "PUT", `/api/admin/students/${s[key].pk}/deadline-extension`, body);

  test("ขยายเวลา: เฉพาะ T000/T002/T003 · วันไม่ถูก/ย้อนหลัง 400 · เหตุผลยาวเกิน 400 · ประจำวิชาหลักสูตรอื่น 403 · นักศึกษาส่งได้ถึงวันที่ขยาย (ยังนับว่าช้า) · ปิดชั่วคราวชนะการขยาย · ล้างได้", async () => {
    await api(t.coopCS.token, "PUT", `/api/admin/coop-periods/${P1}/deadlines`, { major: "CS", deadlines: { T002: { due: day(-1), mode: "HARD" } } });
    expect((await extend(staff.token, "cs", { stepKey: "T008", until: day(3) })).status).toBe(400);
    expect((await extend(staff.token, "cs", { stepKey: "T002", until: "2026-02-31" })).status).toBe(400);
    expect((await extend(staff.token, "cs", { stepKey: "T002", until: day(-1) })).status).toBe(400);
    expect((await extend(staff.token, "cs", { stepKey: "T002", until: day(3), reason: "ก".repeat(201) })).status).toBe(400);
    expect((await extend(t.coopAI.token, "cs", { stepKey: "T002", until: day(3) })).status).toBe(403);
    let r = await extend(t.coopCS.token, "cs", { stepKey: "T002", until: day(3), reason: "ป่วย" });
    expect([r.status, r.body.deadlineExtensions]).toEqual([200, { T002: day(3) }]);
    expect((await api(s.cs.token, "GET", "/api/coop/config/t002")).body).toMatchObject({ isOpen: true, late: true });
    await api(t.coopCS.token, "PUT", `/api/admin/coop-periods/${P1}/deadlines`, { major: "CS", deadlines: { T002: { due: day(-1), mode: "HARD", closed: true } } });
    expect((await api(s.cs.token, "GET", "/api/coop/config/t002")).body.isOpen).toBe(false);
    await api(t.coopCS.token, "PUT", `/api/admin/coop-periods/${P1}/deadlines`, { major: "CS", deadlines: { T002: { due: day(-1), mode: "HARD" } } });
    r = await api(staff.token, "DELETE", `/api/admin/students/${s.cs.pk}/deadline-extension/T002`);
    expect([r.status, r.body.deadlineExtensions]).toEqual([200, {}]);
    expect((await api(s.cs.token, "GET", "/api/coop/config/t002")).body.isOpen).toBe(false);
  });

  test("ย้ายรอบ: (ใหม่) วันขยายเวลาของรอบเดิมถูกล้าง · ย้ายไปรอบเดิม 400 · ออกฝึกแล้ว ย้ายไม่ได้ · ประจำวิชาหลักสูตรอื่น 403 · แจ้งนักศึกษา", async () => {
    expect((await extend(staff.token, "move", { stepKey: "T000", until: day(5) })).status).toBe(200);
    expect((await api(staff.token, "POST", `/api/admin/students/${s.move.pk}/move-period`, { periodId: P1, resetTo: "KEEP", reason: "x" })).status).toBe(400);
    expect((await api(t.coopAI.token, "POST", `/api/admin/students/${s.move.pk}/move-period`, { periodId: created[1], resetTo: "KEEP", reason: "x" })).status).toBe(403);
    let r = await api(staff.token, "POST", `/api/admin/students/${s.move.pk}/move-period`, { periodId: created[1], resetTo: "KEEP", reason: "ไปเทอมหน้า" });
    expect(r.status, msg(r)).toBe(200);
    const c = await k.coop(s.move.pk);
    expect([c.coopPeriodId, c.deadlineExtensions]).toEqual([created[1], {}]);
    await expect.poll(async () => (await k.notes(s.move.userId, "COOP_PERIOD_MOVED")).length).toBe(1);
    r = await api(staff.token, "POST", `/api/admin/students/${s.intern.pk}/move-period`, { periodId: created[1], resetTo: "QUALIFIED", reason: "x" });
    expect(r.status, msg(r)).toBe(400);
  });
});

// ══════════════════════════════════════════════════════
// E. หัวข้อเอกสาร T000 แยกหลักสูตร
// ══════════════════════════════════════════════════════
test.describe("E. หัวข้อเอกสาร T000", () => {
  const create = (token: string, body: object) => api(token, "POST", "/api/admin/doc-requirements", { title: "หัวข้อทดสอบ", isRequired: true, isActive: true, ...body });
  const mine = async (key: string) => (await api(s[key].token, "GET", "/api/coop/doc-requirements")).body.requirements.map((r: { docKey: string }) => r.docKey);

  test("สร้าง: ประจำวิชาได้เฉพาะหัวข้อของหลักสูตรตัวเอง (หัวข้อทุกหลักสูตร = เจ้าหน้าที่) · (ใหม่) รหัสซ้ำชนิดเอกสารของระบบ/รหัสว่าง/ชื่อว่าง 400 · รหัสซ้ำ 400 · หลักสูตรที่ไม่มี 400 · นักศึกษาเห็นเฉพาะหัวข้อที่ใช้กับหลักสูตรตัวเอง", async () => {
    expect((await create(t.coopCS.token, { docKey: `${Y()}-ALL`, majors: [] })).status).toBe(403);
    expect((await create(t.coopCS.token, { docKey: `${Y()}-X`, majors: ["AI"] })).status).toBe(403);
    for (const docKey of ["T002_FORM", "APPLICATION_DOC", "CP-ACCEPTANCE", "T000_SIGNED", "   "]) {
      const r = await create(staff.token, { docKey, majors: [M] });
      expect(r.status, `${docKey}: ${msg(r)}`).toBe(400);
    }
    expect((await create(staff.token, { docKey: `${Y()}-T`, title: "  ", majors: [M] })).status).toBe(400);
    expect((await create(staff.token, { docKey: `${Y()}-X`, majors: ["NOPE"] })).status).toBe(400);
    let r = await create(t.coopMulti.token, { docKey: `${Y()}-M`, title: "เฉพาะหลักสูตรทดสอบ", majors: [M] });
    expect(r.status, msg(r)).toBe(200);
    r = await create(staff.token, { docKey: `${Y()}-ALL`, title: "ทุกหลักสูตร", majors: [] });
    expect(r.status, msg(r)).toBe(200);
    expect((await create(staff.token, { docKey: `${Y()}-ALL`, majors: [] })).status).toBe(400);
    expect(await mine("m")).toEqual(expect.arrayContaining([`${Y()}-M`, `${Y()}-ALL`]));
    expect(await mine("cs")).toContain(`${Y()}-ALL`);
    expect(await mine("cs")).not.toContain(`${Y()}-M`);
  });

  test("ปิดหัวข้อทุกหลักสูตรรายหลักสูตร · ประจำวิชาแก้/ลบหัวข้อทุกหลักสูตรไม่ได้ (ปิดของหลักสูตรตัวเองได้) · (ใหม่) เปลี่ยนรหัสหัวข้อ → ไฟล์ที่ส่งไว้ตามมา · ลบหัวข้อ", async () => {
    const all = await prisma.documentRequirement.findUnique({ where: { docKey: `${Y()}-ALL` } });
    const m = await prisma.documentRequirement.findUnique({ where: { docKey: `${Y()}-M` } });
    expect((await api(t.coopCS.token, "PUT", `/api/admin/doc-requirements/${all.id}`, { title: "แก้" })).status).toBe(403);
    expect((await api(t.coopCS.token, "DELETE", `/api/admin/doc-requirements/${all.id}`)).status).toBe(403);
    expect((await api(t.coopCS.token, "PUT", `/api/admin/doc-requirements/${all.id}/exclusions`, { major: "AI", excluded: true })).status).toBe(403);
    let r = await api(t.coopCS.token, "PUT", `/api/admin/doc-requirements/${all.id}/exclusions`, { major: "CS", excluded: true });
    expect(r.status, msg(r)).toBe(200);
    expect(await mine("cs")).not.toContain(`${Y()}-ALL`);
    expect(await mine("ai")).toContain(`${Y()}-ALL`);
    expect((await api(staff.token, "PUT", `/api/admin/doc-requirements/${m.id}/exclusions`, { major: M, excluded: true })).status).toBe(400);
    await api(t.coopCS.token, "PUT", `/api/admin/doc-requirements/${all.id}/exclusions`, { major: "CS", excluded: false });
    expect(await mine("cs")).toContain(`${Y()}-ALL`);

    await prisma.document.create({ data: { studentId: s.m.pk, type: `${Y()}-M`, path: `${k.tag}-t000.pdf`, name: "t000.pdf", status: "WAITING" } });
    expect((await api(staff.token, "PUT", `/api/admin/doc-requirements/${m.id}`, { docKey: "T003_FORM" })).status).toBe(400);
    r = await api(t.coopMulti.token, "PUT", `/api/admin/doc-requirements/${m.id}`, { docKey: `${Y()}-M2` });
    expect(r.status, msg(r)).toBe(200);
    expect((await k.docs(s.m.pk)).map((d: { type: string }) => d.type)).toEqual([`${Y()}-M2`]);
    expect((await api(t.coopMulti.token, "DELETE", `/api/admin/doc-requirements/${m.id}`)).status).toBe(200);
    expect(await mine("m")).not.toContain(`${Y()}-M2`);
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

test.describe("F. หน้ารอบสหกิจ / ปฏิทินของรอบ / หัวข้อเอกสาร", () => {
  test("สร้างรอบใหม่ (หน้าต่าง) → (ใหม่) วันปิดก่อนวันเปิดถูกปฏิเสธพร้อมเหตุผล · สร้างสำเร็จ → ปฏิทินของรอบเปิดให้ตั้งต่อ → ตั้งค่าหลักสูตร → บันทึก", async ({ page }) => {
    await asUser(page, t.coopCS.token, t.coopCS.userId, "/admin/coop-period");
    await page.getByRole("button", { name: "+ สร้างรอบใหม่" }).click();
    await page.locator('input.input:not([type="date"])').first().fill(`${Y()}ui`);
    const dates = page.getByRole("dialog").locator('input[type="date"]');
    await dates.nth(0).fill(day(20));
    await dates.nth(1).fill(day(5));
    await page.getByRole("button", { name: "บันทึกข้อมูล" }).click();
    await expect(page.getByText("วันเปิดรับสมัครต้องไม่หลังวันปิดรับสมัคร")).toBeVisible();
    await dates.nth(1).fill(day(80));
    await page.getByRole("button", { name: "บันทึกข้อมูล" }).click();
    await expect(page.getByText(/สร้างรอบ .* แล้ว/)).toBeVisible();
    const p = await prisma.coopPeriod.findFirst({ where: { academicYear: `${Y()}ui` }, include: { majors: true } });
    created.push(p.id);
    expect(p.majors.map((r: { major: string }) => r.major)).toEqual(["CS"]);
    await expect(page.getByText(`📆 ปฏิทินของรอบ 1/${Y()}ui`)).toBeVisible();
    await page.getByRole("tab", { name: "หลักสูตร CS" }).click();
    await page.locator("div", { hasText: /^T003 โครงร่างรายงาน/ }).locator('input[type="date"]').first().fill(day(70));
    await page.getByRole("button", { name: "บันทึกของหลักสูตร CS" }).click();
    await expect(page.getByText("บันทึกกำหนดส่งของหลักสูตร CS แล้ว")).toBeVisible();
    expect((await periodRow(p.id, "CS"))?.deadlines?.T003?.due).toBe(day(70));
  });

  test("หัวข้อเอกสาร: (ใหม่) ใช้รหัสของระบบถูกปฏิเสธพร้อมเหตุผล · สร้างหัวข้อของหลักสูตรตัวเองได้", async ({ page }) => {
    await asUser(page, t.coopMulti.token, t.coopMulti.userId, "/admin/doc-requirements");
    await page.locator("button.btn").filter({ hasText: /เพิ่ม/ }).first().click();
    await page.getByPlaceholder("เช่น CP-T000, CP-CV (ห้ามซ้ำ)").fill("T002_FORM");
    await page.getByPlaceholder("เช่น ใบสมัครงานสหกิจศึกษา (T000)").fill("ZR หัวข้อจากหน้าเว็บ");
    await page.locator("label", { hasText: M }).locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: "💾 บันทึกหัวข้อเอกสาร" }).click();
    await expect(page.getByText(/เป็นชนิดเอกสารของระบบ/)).toBeVisible();
    await page.getByPlaceholder("เช่น CP-T000, CP-CV (ห้ามซ้ำ)").fill(`${Y()}-UI`);
    await page.getByRole("button", { name: "💾 บันทึกหัวข้อเอกสาร" }).click();
    await expect(page.getByText("บันทึกข้อมูลเรียบร้อย")).toBeVisible();
    expect(await prisma.documentRequirement.count({ where: { docKey: `${Y()}-UI` } })).toBe(1);
  });
});
