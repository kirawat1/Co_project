/**
 * tests/supervision.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * ระบบนิเทศทั้งระบบ — ทุกเงื่อนไข ทุกบทบาท ทุกปุ่ม (backend + DB จริง · ข้อมูลจาก helpers/supervisionWorld.ts ลบทิ้งตอนจบ)
 * ต้องรัน backend ที่ :5000 และ frontend ที่ :5173
 *
 * บทบาท: นักศึกษา · อาจารย์ที่ปรึกษา (ผู้นิเทศหลัก) · อาจารย์ร่วม · อาจารย์ประจำวิชาของหลักสูตร (CS/AI) · อาจารย์อื่น · เจ้าหน้าที่
 * สถานะนัด: PENDING_TEACHER → (TEACHER_REJECTED ↔ เสนอใหม่) → DATE_CONFIRMED → (รอลงนาม) → LETTER_UPLOADED → COMPLETED
 *
 * กติกาที่ผู้ใช้ตัดสิน 2026-11-03 (/scrutinize นิเทศ):
 *   - ช่วงนิเทศของหลักสูตรบังคับเฉพาะวันที่นักศึกษาเสนอ · อาจารย์/เจ้าหน้าที่แก้วันที่ยืนยันแล้วไปนอกช่วงได้ · ไม่ได้ตั้งช่วง = ไม่บังคับ
 *   - ปฏิเสธวันที่เสนอต้องมีเหตุผล
 * บั๊กที่แก้รอบนี้ (ล็อกไว้): ตั้งช่วงนิเทศวันที่ผิดรูปแบบ/เริ่มหลังสิ้นสุด · หนังสือลงนามที่เป็นรูปถูกตั้งชื่อ .pdf
 *   (race เสนอใหม่ทับนัดที่เพิ่งยืนยัน + ยืนยันวันที่นักศึกษาเพิ่งแก้ → backend/__tests__/supervisionController.test.js)
 */
import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { api, type Res } from "./helpers/letterWorld";
import { SupervisionWorld, SUP_DIR, day, at, slot, DAYS } from "./helpers/supervisionWorld";

const w = new SupervisionWorld();
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน (cd backend && npm run dev)");
  await w.setup();
});
test.afterAll(async () => { await w.cleanup(); await w.disconnect(); });

const API = "http://localhost:5000";
const st = (k: string) => w.s[k].token;
const T = (k: keyof typeof w.t) => w.t[k].token;
const staff = () => w.staff.token;
const msg = (r: Res) => JSON.stringify(r.body);
const BIG = 999_999_999;
const no = (n: number) => `ZS${w.tail}.26/${n}`;
const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
const PDF = Buffer.from("%PDF-1.4\nsupervision e2e\n%%EOF");

const propose = (key: string, dates: string[], extra: Record<string, unknown> = {}) =>
  api(st(key), "POST", "/api/coop/supervision/propose", { proposedDates: JSON.stringify(dates), supervisionType: "ONSITE", ...extra });
const review = (token: string, id: number | string, body: object) => api(token, "PUT", `/api/teacher/supervisions/${id}/review`, body);
const approve = (id: number, iso: string, extra: object = {}) => review(T("main"), id, { action: "APPROVE", confirmedDate: iso, ...extra });
const assign = (token: string, id: number | string, ids: unknown) => api(token, "PUT", `/api/admin/supervisions/${id}/co-teachers`, { coTeacherIds: ids });
const avail = (token: string, id: number | string, days: unknown) => api(token, "PUT", `/api/teacher/supervisions/${id}/availability`, { availableDates: days });
const editDate = (token: string, id: number | string, iso?: string) => api(token, "PUT", `/api/admin/supervisions/${id}/confirmed-date`, { confirmedDate: iso });
const letterPending = (token: string, id: number | string, body: object) => api(token, "PUT", `/api/admin/supervisions/${id}/letter-pending`, body);
const complete = (token: string, id: number | string, via: "teacher" | "admin") => api(token, "PUT", `/api/${via}/supervisions/${id}/complete`, {});
const savePeriod = (token: string, body: object) => api(token, "POST", "/api/admin/supervision-periods", { periodId: w.openPeriodId, isSupervisionOpen: true, supervisionStartDate: day(-5), supervisionEndDate: day(60), ...body });
function letterForm(fields: Record<string, string>, file: "png" | "pdf" | null = "png") {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (file === "png") fd.append("file", new Blob([PNG], { type: "image/png" }), "signed.png");
  if (file === "pdf") fd.append("file", new Blob([PDF], { type: "application/pdf" }), "signed.pdf");
  return fd;
}
const upload = (token: string, id: number | string, fields: Record<string, string>, file: "png" | "pdf" | null = "png") =>
  api(token, "POST", `/api/admin/supervisions/${id}/upload-letter`, letterForm(fields, file));
const supFiles = () => fs.readdirSync(SUP_DIR).length;
const pendingOf = async (token: string) => (await api(token, "GET", "/api/notifications/pending")).body.pending;
const dayOf = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }) : null);
const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);
// แจ้งเตือนสร้างหลังตอบกลับแล้ว (ไม่รอ) — อ่านแบบรอจนมา
const titles = async (userId: number, type: string) => (await w.notes(userId, type)).map((n) => n.title);

// ══════════════════════════════════════════════════════
// A. ตั้งค่าช่วงนิเทศ (เจ้าหน้าที่ · อาจารย์ประจำวิชาของหลักสูตรนั้น)
// ══════════════════════════════════════════════════════
test.describe("A. ช่วงนิเทศของหลักสูตร", () => {
  test("สิทธิ์: เจ้าหน้าที่ตั้งได้ทุกหลักสูตร · อาจารย์ประจำวิชาตั้งได้เฉพาะหลักสูตรตัวเอง (ไม่ต้องระบุ) · อาจารย์อื่น/นักศึกษา 403 · รายการเห็นตามหลักสูตร", async () => {
    let r = await savePeriod(staff(), { major: "CS" });
    expect(r.status, msg(r)).toBe(200);
    r = await savePeriod(T("coopCS"), {});
    expect(r.status, msg(r)).toBe(200);
    expect(r.body.period.majors.map((m) => m.major)).toEqual(["CS"]);
    expect((await savePeriod(T("coopCS"), { major: "AI" })).status).toBe(403);
    expect((await savePeriod(T("coopAI"), { major: "CS" })).status).toBe(403);
    expect((await savePeriod(T("other"), { major: "CS" })).status).toBe(403);
    expect((await savePeriod(st("val"), { major: "CS" })).status).toBe(403);

    const mine = (await api(T("coopCS"), "GET", "/api/admin/supervision-periods")).body.periods.find((p) => p.id === w.openPeriodId);
    expect(mine.majors.map((m) => m.major)).toEqual(["CS"]);
    const all = (await api(staff(), "GET", "/api/admin/supervision-periods")).body.periods.find((p) => p.id === w.openPeriodId);
    expect(all.majors.map((m) => m.major).sort()).toEqual(["AI", "CS"]);
    expect((await api(T("other"), "GET", "/api/admin/supervision-periods")).status).toBe(403);
    expect((await api(st("val"), "GET", "/api/admin/supervision-periods")).status).toBe(403);
  });

  test("ตรวจข้อมูล: periodId ผิด 400 · ไม่มีรอบ 404 · เจ้าหน้าที่ไม่ระบุหลักสูตร 400 · หลักสูตรที่ไม่มี 400 · (ใหม่) วันผิดรูปแบบ / เริ่มหลังสิ้นสุด 400 — ช่วงเดิมไม่ถูกแตะ", async () => {
    expect((await savePeriod(staff(), { major: "CS", periodId: "x" })).status).toBe(400);
    expect((await savePeriod(staff(), { major: "CS", periodId: BIG })).status).toBe(404);
    expect((await savePeriod(staff(), {})).status).toBe(400);
    expect((await savePeriod(staff(), { major: "ZZ" })).status).toBe(400);
    let r = await savePeriod(staff(), { major: "CS", supervisionStartDate: "abc" });
    expect(r.status, msg(r)).toBe(400);
    r = await savePeriod(staff(), { major: "CS", supervisionStartDate: day(30), supervisionEndDate: day(10) });
    expect(r.status, msg(r)).toBe(400);
    expect(r.body.message).toMatch(/ต้องไม่หลังวันสิ้นสุด/);
    const row = await w.periodRow("CS");
    expect([row.isSupervisionOpen, dayOf(row.supervisionStartDate), dayOf(row.supervisionEndDate)]).toEqual([true, day(-5), day(60)]);
  });
});

// ══════════════════════════════════════════════════════
// B. นักศึกษาเสนอวันนิเทศ
// ══════════════════════════════════════════════════════
test.describe("B. นักศึกษาเสนอวัน", () => {
  test("ด่านสิทธิ์: ยังไม่ออกฝึก 403 · รอบปิดนัด 403 · ไม่มีหลักสูตร 403 (+ หน้าบอกสาเหตุ) · ไม่มีที่ปรึกษา 400 · อาจารย์/เจ้าหน้าที่เรียก 403", async () => {
    const d = [slot(10, "09:00-10:00")];
    expect((await propose("notYet", d)).status).toBe(403);
    expect((await propose("closed", d)).status).toBe(403);
    let r = await propose("noMajor", d);
    expect(r.status).toBe(403);
    expect(r.body.message).toMatch(/ยังไม่ได้ระบุหลักสูตร/);
    r = await api(st("noMajor"), "GET", "/api/coop/supervision/me");
    expect([r.status, r.body.reason, r.body.supervisionPeriod]).toEqual([200, "NO_MAJOR", null]);
    r = await propose("noAdvisor", d);
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/อาจารย์ที่ปรึกษาโครงการ/);
    expect((await api(T("main"), "POST", "/api/coop/supervision/propose", { proposedDates: JSON.stringify(d), supervisionType: "ONSITE" })).status).toBe(403);
    expect((await api(staff(), "POST", "/api/coop/supervision/propose", { proposedDates: JSON.stringify(d), supervisionType: "ONSITE" })).status).toBe(403);
    for (const k of ["notYet", "closed", "noMajor", "noAdvisor"]) expect(await w.supervision(k)).toBeNull();
  });

  test("ด่านข้อมูล: รูปแบบผิด · ลิงก์ไม่ใช่ http(s) · ไม่ใช่ข้อความ JSON · 0 วัน · เวลากลับหัว · ออนไลน์ไม่มีลิงก์ · วันในอดีต · เกิน 30 · นัดใหม่ไม่ระบุรูปแบบ — ไม่สร้างนัด", async () => {
    const ok = [slot(10, "09:00-10:00")];
    const bad: [string, () => Promise<Res>][] = [
      ["HYBRID", () => propose("val", ok, { supervisionType: "HYBRID" })],
      ["ftp link", () => propose("val", ok, { onlineLink: "ftp://x.example.com" })],
      ["javascript link", () => propose("val", ok, { onlineLink: "javascript:alert(1)" })],
      ["array", () => api(st("val"), "POST", "/api/coop/supervision/propose", { proposedDates: ok, supervisionType: "ONSITE" })],
      ["empty", () => propose("val", [])],
      ["inverted", () => propose("val", [slot(10, "10:00-09:00")])],
      ["online no link", () => propose("val", [slot(10, "09:00-10:00", "ONLINE")], { supervisionType: "ONLINE" })],
      ["past", () => propose("val", [slot(-1, "09:00-10:00")])],
      ["31 dates", () => propose("val", Array.from({ length: 31 }, (_, i) => slot(10 + i, "09:00-10:00")))],
      ["no type", () => propose("val", ok, { supervisionType: undefined })],
    ];
    for (const [name, call] of bad) {
      const r = await call();
      expect(r.status, `${name}: ${msg(r)}`).toBe(400);
    }
    expect(await w.supervision("val")).toBeNull();
  });

  test("(ใหม่) ช่วงนิเทศ: นอกช่วง 400 (ก่อนเริ่ม/หลังสิ้นสุด/ตัวเลือกเดียวที่หลุด) · วันแรก-วันสุดท้ายได้ · ตั้งฝั่งเดียวเช็คฝั่งนั้น · หลักสูตรที่ไม่ได้ตั้งช่วงเสนอไกลแค่ไหนก็ได้", async () => {
    let r = await propose("win", [slot(61, "09:00-10:00")]);
    expect(r.status, msg(r)).toBe(400);
    expect(r.body.message).toMatch(/นอกช่วงนิเทศของหลักสูตร/);
    expect((await propose("win", [slot(10, "09:00-10:00"), slot(61, "09:00-10:00")])).status).toBe(400);
    expect(await w.supervision("win")).toBeNull();

    await w.setWindow("CS", day(10), day(60));
    expect((await propose("win", [slot(9, "09:00-10:00")])).status).toBe(400);
    r = await propose("win", [slot(10, "09:00-10:00"), slot(60, "09:00-10:00")]);
    expect(r.status, msg(r)).toBe(200);
    await w.setWindow("CS", day(10), null);
    expect((await propose("win", [slot(200, "09:00-10:00")])).status).toBe(200);
    expect((await propose("win", [slot(9, "09:00-10:00")])).status).toBe(400);
    await w.setWindow("CS", null, day(15));
    expect((await propose("win", [slot(16, "09:00-10:00")])).status).toBe(400);
    expect((await propose("win", [slot(12, "09:00-10:00")])).status).toBe(200);
    await w.setWindow("CS", day(-5), day(60));

    r = await propose("aiNoWin", [slot(200, "09:00-10:00")]);
    expect(r.status, msg(r)).toBe(200);
    r = await api(st("win"), "GET", "/api/coop/supervision/me");
    expect([dayOf(r.body.supervisionPeriod.supervisionStartDate), dayOf(r.body.supervisionPeriod.supervisionEndDate), r.body.supervisionPeriod.isSupervisionOpen]).toEqual([day(-5), day(60), true]);
  });

  test("สำเร็จ (ออนไลน์ + ลิงก์) → รออาจารย์ · ป้ายอาจารย์หลัก +1 · เสนอใหม่ระหว่างรอ = แทนที่ทั้งชุด (ป้ายไม่เพิ่ม)", async () => {
    const before = (await pendingOf(T("main"))).teacherSupervision;
    let r = await propose("val", [slot(45, "10:00-11:00", "ONLINE")], { supervisionType: "ONLINE", onlineLink: "https://meet.example.com/zs-val" });
    expect(r.status, msg(r)).toBe(200);
    let a = await w.supervision("val");
    expect([a.status, a.supervisionType, a.onlineLink, a.teacherId]).toEqual(["PENDING_TEACHER", "ONLINE", "https://meet.example.com/zs-val", w.t.main.pk]);
    expect((await pendingOf(T("main"))).teacherSupervision).toBe(before + 1);

    r = await propose("val", [slot(46, "13:00-14:00")], { onlineLink: null });
    expect(r.status, msg(r)).toBe(200);
    a = await w.supervision("val");
    expect([a.status, a.supervisionType, JSON.parse(a.proposedDates)]).toEqual(["PENDING_TEACHER", "ONSITE", [slot(46, "13:00-14:00")]]);
    expect((await pendingOf(T("main"))).teacherSupervision).toBe(before + 1);
    r = await api(st("val"), "GET", "/api/coop/supervision/me");
    expect(r.body.appointment.id).toBe(a.id);
  });

  test("นัดที่ล็อกแล้ว (ยืนยันวัน / ออกหนังสือ / นิเทศเสร็จ) เสนอใหม่ไม่ได้ 403 — สถานะไม่เปลี่ยน", async () => {
    for (const [k, status] of [["lockC", "DATE_CONFIRMED"], ["lockL", "LETTER_UPLOADED"], ["lockD", "COMPLETED"]]) {
      const r = await propose(k, [slot(50, "09:00-10:00")]);
      expect(r.status, `${k}: ${msg(r)}`).toBe(403);
      expect((await w.supervision(k)).status).toBe(status);
    }
  });
});

// ══════════════════════════════════════════════════════
// C. อาจารย์ที่ปรึกษาพิจารณา (เลือกวัน / ปฏิเสธ)
// ══════════════════════════════════════════════════════
test.describe("C. อาจารย์พิจารณาวันนิเทศ", () => {
  test("ด่าน: action ผิด · id ผิด · ไม่มีนัด 404 · ไม่ระบุวัน/วันผิดรูปแบบ · วันที่ไม่ได้เสนอ 400 · ใครที่ไม่ใช่อาจารย์หลัก (อื่น/ร่วม/ประจำวิชา/เจ้าหน้าที่/นักศึกษา) ทำไม่ได้", async () => {
    const id = w.appt.rej;
    expect((await review(T("main"), id, { action: "X" })).status).toBe(400);
    expect((await review(T("main"), "abc", { action: "APPROVE", confirmedDate: at(day(DAYS.rej), "09:00") })).status).toBe(400);
    expect((await review(T("main"), BIG, { action: "APPROVE", confirmedDate: at(day(DAYS.rej), "09:00") })).status).toBe(404);
    expect((await review(T("main"), id, { action: "APPROVE" })).status).toBe(400);
    expect((await review(T("main"), id, { action: "APPROVE", confirmedDate: "xx" })).status).toBe(400);
    const r = await approve(id, at(day(DAYS.rej + 1), "09:00"));
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/เฉพาะวันที่นักศึกษาเสนอ/);
    for (const k of ["other", "co", "coopCS"] as const) expect((await review(T(k), id, { action: "APPROVE", confirmedDate: at(day(DAYS.rej), "09:00") })).status, k).toBe(403);
    expect((await review(staff(), id, { action: "APPROVE", confirmedDate: at(day(DAYS.rej), "09:00") })).status).not.toBe(200);
    expect((await review(st("rej"), id, { action: "APPROVE", confirmedDate: at(day(DAYS.rej), "09:00") })).status).toBe(403);
    expect((await w.supervision("rej")).status).toBe("PENDING_TEACHER");
  });

  test("(ใหม่) ปฏิเสธต้องมีเหตุผล → ปฏิเสธได้ (ตัดช่องว่าง · แจ้งนักศึกษา) → ปฏิเสธซ้ำได้ → อนุมัติตอนถูกปฏิเสธไม่ได้ → นักศึกษาเสนอใหม่ (เหตุผลเดิมถูกล้าง)", async () => {
    const id = w.appt.rej;
    for (const reason of [undefined, "", "   "]) {
      const r = await review(T("main"), id, { action: "REJECT", rejectReason: reason });
      expect(r.status, msg(r)).toBe(400);
    }
    expect((await w.supervision("rej")).status).toBe("PENDING_TEACHER");

    let r = await review(T("main"), id, { action: "REJECT", rejectReason: "  ไม่ว่างช่วงนั้น  " });
    expect(r.status, msg(r)).toBe(200);
    let a = await w.supervision("rej");
    expect([a.status, a.rejectReason, a.confirmedDate]).toEqual(["TEACHER_REJECTED", "ไม่ว่างช่วงนั้น", null]);
    await expect.poll(() => titles(w.s.rej.userId, "SUPERVISION_DATE_UPDATED")).toContain("วันนิเทศถูกปฏิเสธ");
    r = await review(T("main"), id, { action: "REJECT", rejectReason: "ขอเลื่อนอีกครั้ง" });
    expect(r.status, msg(r)).toBe(200);
    expect((await approve(id, at(day(DAYS.rej), "09:00"))).status).toBe(400);

    r = await propose("rej", [slot(DAYS.rej + 1, "14:00-16:00", "ONLINE")], { supervisionType: "ONLINE", onlineLink: "https://meet.example.com/zs-rej" });
    expect(r.status, msg(r)).toBe(200);
    a = await w.supervision("rej");
    expect([a.status, a.rejectReason]).toEqual(["PENDING_TEACHER", null]);
  });

  test("อนุมัติ: เวลาสิ้นสุดจากช่วงที่เสนอ · รูปแบบจากตัวเลือกนั้น · แจ้งนักศึกษา · อนุมัติ/ปฏิเสธซ้ำหลังยืนยันไม่ได้", async () => {
    const id = w.appt.rej;
    const r = await approve(id, at(day(DAYS.rej + 1), "14:00"));
    expect(r.status, msg(r)).toBe(200);
    const a = await w.supervision("rej");
    expect([a.status, iso(a.confirmedDate), iso(a.confirmedEndDate), a.supervisionType]).toEqual(["DATE_CONFIRMED", at(day(DAYS.rej + 1), "14:00"), at(day(DAYS.rej + 1), "16:00"), "ONLINE"]);
    await expect.poll(() => titles(w.s.rej.userId, "SUPERVISION_DATE_UPDATED")).toContain("วันนิเทศได้รับการยืนยัน");
    expect((await approve(id, at(day(DAYS.rej + 1), "14:00"))).status).toBe(400);
    expect((await review(T("main"), id, { action: "REJECT", rejectReason: "เปลี่ยนใจ" })).status).toBe(400);
  });

  test("คิวชน: เวลาทับคิวที่ยืนยันแล้วของอาจารย์คนเดียวกัน 409 · ต่อคิวพอดี (จบ 09:00 เริ่ม 09:00) ได้", async () => {
    expect((await propose("win", [slot(DAYS.lockC, "08:30-09:30"), slot(DAYS.lockC, "09:00-10:00")])).status).toBe(200);
    const id = await w.apptId("win");
    let r = await approve(id, at(day(DAYS.lockC), "08:30"));
    expect(r.status, msg(r)).toBe(409);
    r = await approve(id, at(day(DAYS.lockC), "09:00"));
    expect(r.status, msg(r)).toBe(200);
  });
});

// ══════════════════════════════════════════════════════
// D. อาจารย์นิเทศร่วม (มอบหมาย · ระบุวันว่าง · เตือนก่อนยืนยัน)
// ══════════════════════════════════════════════════════
test.describe("D. อาจารย์นิเทศร่วม", () => {
  let id: number;
  test("มอบหมาย — ด่าน: อาจารย์อื่น/นักศึกษา 403 · อาจารย์ประจำวิชาหลักสูตรอื่น 403 · รายการไม่ใช่ array / id ผิด / อาจารย์ไม่มีจริง 400 · ไม่มีนัด 404", async () => {
    expect((await propose("flow", [slot(DAYS.flowA, "10:00-12:00"), slot(DAYS.flowB, "13:00-15:00")])).status).toBe(200);
    id = await w.apptId("flow");
    expect((await assign(T("other"), id, [w.t.co.pk])).status).toBe(403);
    expect((await assign(st("flow"), id, [w.t.co.pk])).status).toBe(403);
    expect((await assign(T("coopAI"), id, [w.t.co.pk])).status).toBe(403);
    expect((await assign(staff(), id, "x")).status).toBe(400);
    expect((await assign(staff(), id, ["abc"])).status).toBe(400);
    expect((await assign(staff(), id, [BIG])).status).toBe(400);
    expect((await assign(staff(), "x", [w.t.co.pk])).status).toBe(400);
    expect((await assign(staff(), BIG, [w.t.co.pk])).status).toBe(404);
    expect((await w.supervision("flow")).coTeachers).toHaveLength(0);
  });

  test("อาจารย์ประจำวิชาใส่ [ร่วม, ที่ปรึกษา] → ที่ปรึกษาถูกตัด · ชื่อบนหนังสือ = อาจารย์ร่วม · ป้ายอาจารย์ร่วม +1 (ยังไม่ตอบวันว่าง)", async () => {
    const before = (await pendingOf(T("co"))).teacherSupervision;
    const r = await assign(T("coopCS"), id, [w.t.co.pk, w.t.main.pk]);
    expect(r.status, msg(r)).toBe(200);
    const a = await w.supervision("flow");
    expect(a.coTeachers.map((c) => c.teacherId)).toEqual([w.t.co.pk]);
    expect(a.coTeacherName).toBe(w.t.co.name);
    expect((await pendingOf(T("co"))).teacherSupervision).toBe(before + 1);
  });

  test("ระบุวันว่าง — ด่าน: ไม่ใช่ array 400 · วันที่ไม่ได้เสนอ 400 · ที่ปรึกษา/อาจารย์อื่น 403 · เจ้าหน้าที่/นักศึกษา 403 → อาจารย์ร่วมตอบ (ตัดซ้ำ) · ป้าย -1", async () => {
    expect((await avail(T("co"), id, "x")).status).toBe(400);
    expect((await avail(T("co"), id, ["2099-01-01"])).status).toBe(400);
    for (const tk of [T("main"), T("other"), staff(), st("flow")]) expect((await avail(tk, id, [day(DAYS.flowA)])).status).toBe(403);
    const before = (await pendingOf(T("co"))).teacherSupervision;
    const r = await avail(T("co"), id, [day(DAYS.flowA), day(DAYS.flowA)]);
    expect(r.status, msg(r)).toBe(200);
    expect(r.body.availableDates).toEqual([day(DAYS.flowA)]);
    expect((await pendingOf(T("co"))).teacherSupervision).toBe(before - 1);
  });

  test("แก้รายชื่อ [ร่วม, ร่วมสอง] → คำตอบเดิมของอาจารย์ร่วมยังอยู่ · คนใหม่ยังไม่ตอบ · รายการนัดของแต่ละคนบอกสิทธิ์ถูก (หลัก/ร่วม) · อาจารย์อื่นไม่เห็น", async () => {
    expect((await assign(staff(), id, [w.t.co.pk, w.t.co2.pk])).status).toBe(200);
    const a = await w.supervision("flow");
    const co = a.coTeachers.find((c) => c.teacherId === w.t.co.pk);
    const co2 = a.coTeachers.find((c) => c.teacherId === w.t.co2.pk);
    expect([JSON.parse(co.availableDates), !!co.respondedAt, co2.availableDates, co2.respondedAt]).toEqual([[day(DAYS.flowA)], true, null, null]);

    const mainRow = (await api(T("main"), "GET", "/api/teacher/supervisions")).body.supervisions.find((x) => x.id === id);
    expect(mainRow.isPrimaryAdvisor).toBe(true);
    const coRow = (await api(T("co"), "GET", "/api/teacher/supervisions")).body.supervisions.find((x) => x.id === id);
    expect([coRow.isPrimaryAdvisor, coRow.myAvailableDates]).toEqual([false, [day(DAYS.flowA)]]);
    expect((await api(T("other"), "GET", "/api/teacher/supervisions")).body.supervisions.some((x) => x.id === id)).toBe(false);
  });

  test("ยืนยันวัน: อาจารย์ร่วมไม่ว่าง/ยังไม่ตอบ → 409 บอกชื่อ · ยืนยันซ้ำ (รับทราบ) ได้ · หลังยืนยันตอบวันว่าง 400 · นักศึกษาแก้ 403", async () => {
    let r = await approve(id, at(day(DAYS.flowB), "13:00"));
    expect(r.status, msg(r)).toBe(409);
    expect(r.body.code).toBe("CO_TEACHER_UNAVAILABLE");
    expect(r.body.unavailable.map((u) => [u.teacherId, u.reason]).sort()).toEqual([[w.t.co.pk, "NOT_FREE"], [w.t.co2.pk, "NO_RESPONSE"]].sort());
    r = await approve(id, at(day(DAYS.flowA), "10:00"));
    expect(r.status).toBe(409);
    expect(r.body.unavailable.map((u) => u.teacherId)).toEqual([w.t.co2.pk]);
    r = await approve(id, at(day(DAYS.flowA), "10:00"), { acknowledgeUnavailable: true });
    expect(r.status, msg(r)).toBe(200);
    const a = await w.supervision("flow");
    expect([a.status, iso(a.confirmedEndDate)]).toEqual(["DATE_CONFIRMED", at(day(DAYS.flowA), "12:00")]);
    expect((await avail(T("co"), id, [day(DAYS.flowA)])).status).toBe(400);
    expect((await propose("flow", [slot(DAYS.flowB, "13:00-15:00")])).status).toBe(403);
  });

  test("เพิ่มอาจารย์ร่วมให้นัดที่ยืนยันแล้ว: คนที่ติดนิเทศเวลาเดียวกัน 409 · คนที่ว่างได้", async () => {
    const r = await assign(staff(), w.appt.coClash, [w.t.co2.pk]);
    expect(r.status, msg(r)).toBe(409);
    expect((await assign(staff(), w.appt.coClash, [w.t.co.pk])).status).toBe(200);
  });
});

// ══════════════════════════════════════════════════════
// E. นิเทศตามบริษัท — ยืนยันแบบกลุ่ม
// ══════════════════════════════════════════════════════
test.describe("E. ยืนยันแบบกลุ่ม", () => {
  const group = () => [w.appt.gA, w.appt.gB];
  const confirmGroup = (token: string, body: object) => api(token, "POST", "/api/teacher/supervisions/confirm-group", body);

  test("รายการตามบริษัท: เฉพาะนัดที่รออาจารย์หลัก/ถูกปฏิเสธ · วันที่เสนอตรงกัน ≥ 2 คน = วันร่วม", async () => {
    const r = await api(T("main"), "GET", "/api/teacher/supervisions/by-company");
    expect(r.status, msg(r)).toBe(200);
    const b = r.body.companies.find((c) => c.companyId === w.company.B);
    expect(b.students.map((s) => s.appointmentId)).toEqual(expect.arrayContaining(group()));
    expect(b.commonDates.map((e: string) => e.slice(0, 10))).toContain(day(DAYS.group));
    expect(b.commonDates.map((e: string) => e.slice(0, 10))).not.toContain(day(DAYS.groupOnlyA));
    expect(b.students.map((s) => s.appointmentId)).not.toContain(w.appt.uiGP);   // นัดของอาจารย์คนอื่น (coopCS)
    expect((await api(st("gA"), "GET", "/api/teacher/supervisions/by-company")).status).toBe(403);
  });

  test("ด่าน: ว่าง/ไม่ใช่ตัวเลข/ไม่ระบุวัน/id ซ้ำ 400 · ไม่มีนัด 404 · นัดของอาจารย์คนอื่น 403 · นัดที่ยืนยันแล้ว 400 · วันที่บางคนไม่ได้เสนอ 400", async () => {
    const d = at(day(DAYS.group), "09:00");
    expect((await confirmGroup(T("main"), { appointmentIds: [], confirmedDate: d })).status).toBe(400);
    expect((await confirmGroup(T("main"), { appointmentIds: ["x"], confirmedDate: d })).status).toBe(400);
    expect((await confirmGroup(T("main"), { appointmentIds: group() })).status).toBe(400);
    expect((await confirmGroup(T("main"), { appointmentIds: [w.appt.gA, w.appt.gA], confirmedDate: d })).status).toBe(400);
    expect((await confirmGroup(T("main"), { appointmentIds: [w.appt.gA, BIG], confirmedDate: d })).status).toBe(404);
    expect((await confirmGroup(T("other"), { appointmentIds: group(), confirmedDate: d })).status).toBe(403);
    expect((await confirmGroup(T("main"), { appointmentIds: [w.appt.gA, w.appt.lockC], confirmedDate: d })).status).toBe(400);
    expect((await confirmGroup(T("main"), { appointmentIds: group(), confirmedDate: at(day(DAYS.groupOnlyA), "09:00") })).status).toBe(400);
    expect((await w.supervision("gA")).status).toBe("PENDING_TEACHER");
  });

  // ผู้ใช้ตัดสิน 2026-11-10: แต่ละคนได้เวลาตามช่วงที่ตัวเองเสนอ (เดิม gB ที่เสนอ 13:00 ถูกต่อคิวเป็น 09:00)
  test("สำเร็จ: แต่ละคนได้ช่วงที่ตัวเองเสนอ เรียงตามเวลา (ไม่ขึ้นกับลำดับที่ส่ง) · กลุ่มเดียวกัน · รูปแบบตามตัวเลือกของแต่ละคน · แจ้งนักศึกษาทุกคน", async () => {
    const r = await confirmGroup(T("main"), { appointmentIds: [w.appt.gB, w.appt.gA], confirmedDate: at(day(DAYS.group), "00:00") });
    expect(r.status, msg(r)).toBe(200);
    const [b, a] = [await w.supervision("gB"), await w.supervision("gA")];
    expect([a.status, iso(a.confirmedDate), iso(a.confirmedEndDate), a.supervisionType]).toEqual(["DATE_CONFIRMED", at(day(DAYS.group), "09:00"), at(day(DAYS.group), "10:00"), "ONSITE"]);
    expect([b.status, iso(b.confirmedDate), iso(b.confirmedEndDate), b.supervisionType]).toEqual(["DATE_CONFIRMED", at(day(DAYS.group), "13:00"), at(day(DAYS.group), "14:00"), "ONLINE"]);
    expect(a.groupId).toBeTruthy();
    expect(b.groupId).toBe(a.groupId);
    for (const k of ["gA", "gB"]) await expect.poll(async () => (await titles(w.s[k].userId, "SUPERVISION_DATE_UPDATED")).length, { message: k }).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════
// F. แก้วันนิเทศที่ยืนยันแล้ว (เจ้าหน้าที่ · อาจารย์ประจำวิชา)
// ══════════════════════════════════════════════════════
test.describe("F. แก้วันที่ยืนยันแล้ว", () => {
  test("ด่าน: อาจารย์อื่น/นักศึกษา 403 · ประจำวิชาหลักสูตรอื่น 403 · id ผิด 400 · ไม่มีนัด 404 · ไม่ระบุ/ผิดรูปแบบ 400 · ยังรออาจารย์ 400 · ออกหนังสือแล้ว 400 · ชนคิวอาจารย์ 409", async () => {
    const id = w.appt.edit;
    const to = at(day(24), "08:00");
    expect((await editDate(T("other"), id, to)).status).toBe(403);
    expect((await editDate(st("edit"), id, to)).status).toBe(403);
    expect((await editDate(T("coopAI"), id, to)).status).toBe(403);
    expect((await editDate(staff(), "x", to)).status).toBe(400);
    expect((await editDate(staff(), BIG, to)).status).toBe(404);
    expect((await editDate(staff(), id)).status).toBe(400);
    expect((await editDate(staff(), id, "xx")).status).toBe(400);
    expect((await editDate(staff(), await w.apptId("val"), to)).status).toBe(400);
    expect((await editDate(staff(), w.appt.lockL, to)).status).toBe(400);
    const r = await editDate(staff(), id, at(day(DAYS.lockL), "08:30"));
    expect(r.status, msg(r)).toBe(409);
    expect(iso((await w.supervision("edit")).confirmedDate)).toBe(at(day(DAYS.edit), "08:00"));
  });

  test("เจ้าหน้าที่เลื่อนวัน: คงความยาวคิวเดิม (2 ชม.) · ย้ายไปวันอื่น = ออกจากกลุ่ม (เพื่อนในกลุ่มไม่โดน) · แจ้งนักศึกษา · (ใหม่) เลื่อนไปนอกช่วงนิเทศได้ · อาจารย์ประจำวิชาเลื่อนได้", async () => {
    const id = w.appt.edit;
    let r = await editDate(staff(), id, at(day(24), "08:00"));
    expect(r.status, msg(r)).toBe(200);
    let a = await w.supervision("edit");
    expect([iso(a.confirmedDate), iso(a.confirmedEndDate), a.groupId]).toEqual([at(day(24), "08:00"), at(day(24), "10:00"), null]);
    expect((await w.supervision("editMate")).groupId).toBeTruthy();
    await expect.poll(() => titles(w.s.edit.userId, "SUPERVISION_DATE_UPDATED")).toContain("วันนิเทศมีการเปลี่ยนแปลง");

    r = await editDate(staff(), id, at(day(70), "09:00"));
    expect(r.status, msg(r)).toBe(200);
    r = await editDate(T("coopCS"), id, at(day(24), "13:00"));
    expect(r.status, msg(r)).toBe(200);
    a = await w.supervision("edit");
    expect([iso(a.confirmedDate), iso(a.confirmedEndDate)]).toEqual([at(day(24), "13:00"), at(day(24), "15:00")]);
  });

  test("รอลงนามอยู่: แก้วัน 409 → ยกเลิกรอลงนาม → แก้ได้", async () => {
    const id = w.appt.edit;
    expect((await letterPending(staff(), id, { docNumber: no(9) })).status).toBe(200);
    expect((await editDate(staff(), id, at(day(24), "08:00"))).status).toBe(409);
    expect((await letterPending(staff(), id, { cancel: true })).status).toBe(200);
    expect((await editDate(staff(), id, at(day(24), "08:00"))).status).toBe(200);
  });
});

// ══════════════════════════════════════════════════════
// G. หนังสือขอนิเทศ (รอลงนาม · อัปโหลดฉบับลงนาม · หนังสือรวมของกลุ่ม) — เจ้าหน้าที่เท่านั้น
// ══════════════════════════════════════════════════════
test.describe("G. หนังสือขอนิเทศ", () => {
  test("รอลงนาม: อาจารย์ (หลัก/ประจำวิชา)/นักศึกษา 403 · ยังไม่ยืนยันวัน 400 · ไม่มีนัด 404 · ร่างเลขอื่นระหว่างรอ 409 · เลขเดิมได้ · ยกเลิกได้", async () => {
    const id = await w.apptId("flow");
    for (const tk of [T("main"), T("coopCS"), st("flow")]) expect((await letterPending(tk, id, { docNumber: no(1) })).status).toBe(403);
    expect((await letterPending(staff(), await w.apptId("val"), { docNumber: no(1) })).status).toBe(400);
    expect((await letterPending(staff(), BIG, { docNumber: no(1) })).status).toBe(404);
    let r = await letterPending(staff(), id, { docNumber: no(1) });
    expect(r.status, msg(r)).toBe(200);
    expect(r.body.draftNumber).toBe(no(1));
    expect((await letterPending(staff(), id, { docNumber: no(2) })).status).toBe(409);
    expect((await letterPending(staff(), id, { docNumber: no(1) })).status).toBe(200);
    r = await letterPending(staff(), id, { cancel: true });
    expect(r.status).toBe(200);
    expect((await w.supervision("flow")).letterPendingAt).toBeNull();
    expect((await letterPending(staff(), id, { docNumber: no(1) })).status).toBe(200);
  });

  test("อัปโหลด — ด่าน: อาจารย์ 403 · ไม่มีไฟล์ 400 · ยังไม่ยืนยันวัน 400 · เลขที่ยังไม่ได้กรอก 400 · วันที่ผิด 400 — ไฟล์ที่ส่งมาไม่ค้างในเครื่อง", async () => {
    const id = await w.apptId("flow");
    const files = supFiles();
    expect((await upload(T("coopCS"), id, { docNumber: no(1) })).status).toBe(403);
    expect((await upload(T("main"), id, { docNumber: no(1) })).status).toBe(403);
    expect((await upload(staff(), id, { docNumber: no(1) }, null)).status).toBe(400);
    expect((await upload(staff(), await w.apptId("val"), { docNumber: no(1) })).status).toBe(400);
    expect((await upload(staff(), id, { docNumber: `ZS${w.tail}.26/` })).status).toBe(400);
    expect((await upload(staff(), id, { docNumber: no(1), docDate: "xx" })).status).toBe(400);
    expect(supFiles()).toBe(files);
    expect((await w.supervision("flow")).status).toBe("DATE_CONFIRMED");
  });

  test("อัปโหลดฉบับลงนาม (รูป .png) → ออกหนังสือแล้ว · (ใหม่) ไฟล์ใช้นามสกุลจริง · ป้ายรอลงนามหาย · แจ้งนักศึกษา · แก้วันไม่ได้ · เลขเดียวกันใช้กับนัดอื่นไม่ได้ 409", async () => {
    const id = await w.apptId("flow");
    let r = await upload(staff(), id, { docNumber: no(1), docDate: day(0) });
    expect(r.status, msg(r)).toBe(200);
    const a = await w.supervision("flow");
    expect([a.status, a.letterPendingAt, a.letterDocNumber]).toEqual(["LETTER_UPLOADED", null, no(1)]);
    expect(a.officialLetterPath).toMatch(/\.png$/);
    expect(fs.existsSync(path.join(SUP_DIR, a.officialLetterPath))).toBe(true);
    await expect.poll(async () => (await titles(w.s.flow.userId, "SUPERVISION_LETTER_UPLOADED")).length).toBe(1);
    expect((await editDate(staff(), id, at(day(DAYS.flowB), "13:00"))).status).toBe(400);

    const files = supFiles();
    r = await upload(staff(), w.appt.lockC, { docNumber: no(1) }, "pdf");
    expect(r.status, msg(r)).toBe(409);
    expect((await w.supervision("lockC")).status).toBe("DATE_CONFIRMED");
    expect(supFiles()).toBe(files);
  });

  test("หนังสือรวมของกลุ่ม: ไฟล์เดียว เลขเดียว ทุกนัดในกลุ่ม · นัดต่างกลุ่มรวมกันไม่ได้ 400", async () => {
    let r = await upload(staff(), w.appt.lockC, { docNumber: no(4), appointmentIds: JSON.stringify([w.appt.lockC, w.appt.edit]) }, "pdf");
    expect(r.status, msg(r)).toBe(400);
    r = await upload(staff(), w.appt.gA, { docNumber: no(3), appointmentIds: JSON.stringify([w.appt.gA, w.appt.gB]) }, "pdf");
    expect(r.status, msg(r)).toBe(200);
    expect(r.body.appointmentIds.sort()).toEqual([w.appt.gA, w.appt.gB].sort());
    const [a, b] = [await w.supervision("gA"), await w.supervision("gB")];
    expect([a.status, b.status, a.letterDocNumber, b.letterDocNumber]).toEqual(["LETTER_UPLOADED", "LETTER_UPLOADED", no(3), no(3)]);
    expect(b.officialLetterPath).toBe(a.officialLetterPath);
  });
});

// ══════════════════════════════════════════════════════
// H. จบนิเทศ
// ══════════════════════════════════════════════════════
test.describe("H. จบนิเทศ", () => {
  test("ด่าน: ยังไม่ออกหนังสือ 400 · id ผิด 400 · ไม่มีนัด 404 · อาจารย์ร่วม/อาจารย์อื่น 403 · ประจำวิชาหลักสูตรอื่น 403 · นักศึกษา 403", async () => {
    expect((await complete(staff(), w.appt.lockC, "admin")).status).toBe(400);
    expect((await complete(staff(), "x", "admin")).status).toBe(400);
    expect((await complete(staff(), BIG, "admin")).status).toBe(404);
    const id = await w.apptId("flow");
    expect((await complete(T("co"), id, "teacher")).status).toBe(403);
    expect((await complete(T("other"), id, "teacher")).status).toBe(403);
    expect((await complete(T("coopAI"), id, "admin")).status).toBe(403);
    expect((await complete(st("flow"), id, "teacher")).status).toBe(403);
    expect((await w.supervision("flow")).status).toBe("LETTER_UPLOADED");
  });

  test("ที่ปรึกษา (หน้าอาจารย์) · อาจารย์ประจำวิชา (หน้าจัดการ) · เจ้าหน้าที่ จบได้ → แจ้งนักศึกษาให้ส่ง T008 · จบซ้ำ 400", async () => {
    let r = await complete(T("main"), await w.apptId("flow"), "teacher");
    expect(r.status, msg(r)).toBe(200);
    expect((await w.supervision("flow")).status).toBe("COMPLETED");
    await expect.poll(async () => (await titles(w.s.flow.userId, "SUPERVISION_COMPLETED")).length).toBe(1);
    expect((await complete(T("main"), await w.apptId("flow"), "teacher")).status).toBe(400);
    r = await complete(T("coopCS"), w.appt.gA, "admin");
    expect(r.status, msg(r)).toBe(200);
    r = await complete(staff(), w.appt.gB, "teacher");
    expect(r.status, msg(r)).toBe(200);
    expect([(await w.supervision("gA")).status, (await w.supervision("gB")).status]).toEqual(["COMPLETED", "COMPLETED"]);
  });
});

// ══════════════════════════════════════════════════════
// I. รายการ · ตัวนับ · ส่งออก Excel · ปฏิทิน (ใครเห็นอะไร) · คิวบริษัท
// ══════════════════════════════════════════════════════
test.describe("I. รายการ ปฏิทิน คิวบริษัท", () => {
  test("รายการหน้าจัดการ: เจ้าหน้าที่เห็นทุกหลักสูตร · ประจำวิชาเห็นเฉพาะหลักสูตรตัวเอง · อาจารย์อื่น/นักศึกษา 403 · รอบผิด 400 · ตัวนับรอออกหนังสือตรงกับข้อมูล", async () => {
    const q = `?coopPeriodId=${w.openPeriodId}`;
    const ids = async (token: string) => (await api(token, "GET", `/api/admin/supervisions${q}`)).body.supervisions.map((s) => s.id);
    const [all, cs, ai] = [await ids(staff()), await ids(T("coopCS")), await ids(T("coopAI"))];
    expect(all).toEqual(expect.arrayContaining([w.appt.linkCS, w.appt.aiConfirmed]));
    expect(cs).toContain(w.appt.linkCS);
    expect(cs).not.toContain(w.appt.aiConfirmed);
    expect(ai).toContain(w.appt.aiConfirmed);
    expect(ai).not.toContain(w.appt.linkCS);
    expect((await api(T("other"), "GET", `/api/admin/supervisions${q}`)).status).toBe(403);
    expect((await api(st("val"), "GET", `/api/admin/supervisions${q}`)).status).toBe(403);
    expect((await api(staff(), "GET", "/api/admin/supervisions?coopPeriodId=abc")).status).toBe(400);

    const counts = (await api(staff(), "GET", "/api/admin/supervisions?countsOnly=1&pending=letter")).body.periods.find((p) => p.coopPeriodId === w.openPeriodId);
    const rows = (await api(staff(), "GET", `/api/admin/supervisions${q}`)).body.supervisions.filter((s) => !s.outsidePeriod);
    expect(counts.count).toBe(rows.length);
    expect(counts.pending).toBe(rows.filter((s) => s.status === "DATE_CONFIRMED" && !s.letterPendingAt).length);
  });

  test("ส่งออกตารางนิเทศ (Excel): เจ้าหน้าที่/ประจำวิชาได้ไฟล์ · รอบ/วันที่ผิด 400 · นักศึกษา/อาจารย์อื่น 403", async () => {
    const get = (token: string, q = "") => fetch(`${API}/api/admin/supervisions/export${q}`, { headers: { Authorization: `Bearer ${token}` } });
    const r = await get(staff(), `?coopPeriodId=${w.openPeriodId}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/spreadsheetml/);
    expect((await r.arrayBuffer()).byteLength).toBeGreaterThan(100);
    expect((await get(T("coopCS"))).status).toBe(200);
    expect((await get(staff(), "?coopPeriodId=abc")).status).toBe(400);
    expect((await get(staff(), "?from=bad")).status).toBe(400);
    expect((await get(st("val"))).status).toBe(403);
    expect((await get(T("other"))).status).toBe(403);
  });

  test("ปฏิทิน: เฉพาะนัดที่ยืนยันแล้วขึ้นไป · เห็นตามหลักสูตร · ลิงก์ออนไลน์เฉพาะคนที่เกี่ยว (เจ้าหน้าที่/ผู้นิเทศ/ประจำวิชา) — นักศึกษาและอาจารย์ทั่วไปไม่ได้ลิงก์", async () => {
    const cal = async (token: string) => {
      const r = await api(token, "GET", "/api/coop/supervision/calendar");
      expect(r.status).toBe(200);
      return new Map<number, Res["body"]>(r.body.events.map((e) => [e.id, e]));
    };
    const linkCS = "https://meet.example.com/zs-cs", linkAI = "https://meet.example.com/zs-ai";
    const s = await cal(staff());
    expect([s.get(w.appt.linkCS)?.onlineLink, s.get(w.appt.aiConfirmed)?.onlineLink]).toEqual([linkCS, linkAI]);
    expect(s.has(w.appt.lockD)).toBe(true);                      // นิเทศเสร็จแล้วยังอยู่ในปฏิทิน
    expect(s.has(await w.apptId("val"))).toBe(false);            // รออาจารย์ — ยังไม่ขึ้น
    expect(s.get(w.appt.linkCS).studentName).toBeTruthy();

    const main = await cal(T("main"));
    expect(main.get(w.appt.linkCS)?.onlineLink).toBe(linkCS);
    expect(main.has(w.appt.aiConfirmed)).toBe(false);
    const other = await cal(T("other"));
    expect(other.has(w.appt.linkCS)).toBe(true);
    expect(other.get(w.appt.linkCS)).not.toHaveProperty("onlineLink");
    expect(other.has(w.appt.aiConfirmed)).toBe(false);
    expect((await cal(T("coopCS"))).get(w.appt.linkCS)?.onlineLink).toBe(linkCS);
    const coopAI = await cal(T("coopAI"));
    expect([coopAI.get(w.appt.aiConfirmed)?.onlineLink, coopAI.has(w.appt.linkCS)]).toEqual([linkAI, false]);
    expect((await cal(T("aiAdv"))).get(w.appt.aiConfirmed)?.onlineLink).toBe(linkAI);

    const csStudent = await cal(st("val"));
    expect(csStudent.has(w.appt.linkCS)).toBe(true);
    expect(csStudent.get(w.appt.linkCS)).not.toHaveProperty("onlineLink");
    expect(csStudent.has(w.appt.aiConfirmed)).toBe(false);
    const aiStudent = await cal(st("aiNoWin"));
    expect(aiStudent.has(w.appt.aiConfirmed)).toBe(true);
    expect(aiStudent.get(w.appt.aiConfirmed)).not.toHaveProperty("onlineLink");
  });

  test("คิวบริษัทเดียวกัน (นักศึกษา): เฉพาะคิวที่ยังไม่ถึง (ยืนยัน/ออกหนังสือ) ของเพื่อนบริษัทเดียวกัน · บอกว่าอาจารย์คนเดียวกันไหม · ไม่มีบริษัท = ว่าง · อาจารย์ 403", async () => {
    const r = await api(st("val"), "GET", "/api/coop/supervision/company-queue");
    expect(r.status, msg(r)).toBe(200);
    expect(r.body.company.id).toBe(w.company.A);
    const q = new Map<number, Res["body"]>(r.body.queue.map((x) => [x.id, x]));
    expect(q.get(w.appt.queueMate)).toMatchObject({ date: day(DAYS.queueMate), start: "13:00", end: "14:00", sameTeacher: true });
    expect(q.get(w.appt.lockL)?.status).toBe("LETTER_UPLOADED");
    expect(q.get(w.appt.busyCo)?.sameTeacher).toBe(false);       // อาจารย์คนอื่น — ใช้ดูว่าไปพร้อมกันวันไหน
    for (const gone of [w.appt.pastMate, w.appt.lockD, w.appt.aiConfirmed, w.appt.gA, await w.apptId("val")]) expect(q.has(gone), String(gone)).toBe(false);
    const none = await api(st("noAdvisor"), "GET", "/api/coop/supervision/company-queue");
    expect([none.body.company, none.body.queue]).toEqual([null, []]);
    expect((await api(T("main"), "GET", "/api/coop/supervision/company-queue")).status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════
// J. แบบประเมินการนิเทศ (สิทธิ์ — ไม่เขียนค่าตั้งค่ากลาง)
// ══════════════════════════════════════════════════════
test.describe("J. แบบประเมินการนิเทศ", () => {
  test("ค่าตั้งค่า: เจ้าหน้าที่/ประจำวิชาอ่านได้ · แก้ค่ากลางได้เฉพาะเจ้าหน้าที่ · อาจารย์อื่น/นักศึกษา 403 · อาจารย์ดูแบบประเมินของตัวเองได้", async () => {
    expect((await api(staff(), "GET", "/api/admin/supervision-eval/config")).status).toBe(200);
    expect((await api(T("coopCS"), "GET", "/api/admin/supervision-eval/config")).status).toBe(200);
    expect((await api(T("coopCS"), "PUT", "/api/admin/supervision-eval/config", { evalLink: "https://x" })).status).toBe(403);
    expect((await api(T("other"), "GET", "/api/admin/supervision-eval/config")).status).toBe(403);
    expect((await api(st("val"), "GET", "/api/admin/supervision-eval/config")).status).toBe(403);
    expect((await api(T("main"), "GET", "/api/teacher/supervision-eval")).status).toBe(200);
    expect((await api(staff(), "GET", "/api/admin/supervision-eval")).status).toBe(200);
    expect((await api(st("val"), "POST", "/api/admin/supervision-eval/send", { ids: [w.appt.lockD] })).status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════
// K. บันทึกการไปนิเทศของอาจารย์ (/api/visits — หน้ารายละเอียดนักศึกษาของอาจารย์)
// ══════════════════════════════════════════════════════
test.describe("K. บันทึกการไปนิเทศ", () => {
  test("ที่ปรึกษาสร้าง/ดู/สลับสถานะ/ลบได้ · วันเดียวกันซ้ำ 409 · ไม่ระบุวัน/วันผิด 400 · ไม่มีนักศึกษา 404 · อาจารย์อื่น 403 · เจ้าหน้าที่ดูได้แต่สร้างไม่ได้", async () => {
    const code = w.s.flow.studentId;
    const body = { studentId: code, date: day(DAYS.flowA), time: "10:00", location: "บริษัท", note: "ZS" };
    let r = await api(T("main"), "POST", "/api/visits", body);
    expect(r.status, msg(r)).toBe(200);
    const vid = r.body.data.id;
    expect((await api(T("main"), "POST", "/api/visits", body)).status).toBe(409);
    expect((await api(T("main"), "POST", "/api/visits", { ...body, date: undefined })).status).toBe(400);
    expect((await api(T("main"), "POST", "/api/visits", { ...body, date: "xx" })).status).toBe(400);
    expect((await api(T("main"), "POST", "/api/visits", { ...body, studentId: "ZS-NOPE" })).status).toBe(404);
    expect((await api(T("other"), "POST", "/api/visits", { ...body, date: day(DAYS.flowB) })).status).toBe(403);
    expect((await api(staff(), "POST", "/api/visits", { ...body, date: day(DAYS.flowB) })).status).toBe(403);

    expect((await api(T("main"), "GET", `/api/visits/student/${code}`)).body.data).toHaveLength(1);
    expect((await api(staff(), "GET", `/api/visits/student/${code}`)).status).toBe(200);
    expect((await api(T("other"), "GET", `/api/visits/student/${code}`)).status).toBe(403);
    expect((await api(st("flow"), "GET", `/api/visits/student/${code}`)).status).toBe(403);

    expect((await api(T("other"), "PUT", `/api/visits/${vid}/toggle`)).status).toBe(403);
    r = await api(T("main"), "PUT", `/api/visits/${vid}/toggle`);
    expect(r.status, msg(r)).toBe(200);
    expect((await w.visits("flow"))[0].status).not.toBe("scheduled");
    expect((await api(T("other"), "DELETE", `/api/visits/${vid}`)).status).toBe(403);
    expect((await api(T("main"), "DELETE", `/api/visits/${vid}`)).status).toBe(200);
    expect(await w.visits("flow")).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════
// หน้าเว็บจริง (ปุ่มทุกปุ่มของแต่ละบทบาท)
// ══════════════════════════════════════════════════════
test.use({ timezoneId: "Asia/Bangkok" });
async function asUser(page: Page, token: string, userId: number, to: string) {
  await page.goto("/");
  await page.evaluate(([t, uid]) => {
    localStorage.clear();
    localStorage.setItem("coop.token", t); localStorage.setItem("coop.userId", uid); localStorage.setItem("coop.theme", "light");
  }, [token, String(userId)]);
  await page.goto(to, { waitUntil: "networkidle" });
}
const asStudent = (page: Page, k: string) => asUser(page, st(k), w.s[k].userId, "/student/supervision");
const asTeacher = (page: Page, k: keyof typeof w.t) => asUser(page, T(k), w.t[k].userId, "/teacher/review-supervision");
const row = (page: Page, key: string) => page.locator("tr", { hasText: w.s[key].studentId });
const SUBMIT = "🚀 ส่งข้อมูลให้อาจารย์พิจารณา";
const confirmBtn = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
// ช่องกรองรอบของรายการนัด (ตารางนิเทศด้านบนก็มีช่องเลือกรอบที่มีตัวเลือก "all" — แยกด้วยข้อความ)
const listPeriod = (page: Page) => page.locator("select", { has: page.locator("option", { hasText: "📚 ทุกปีการศึกษา" }) });

test.describe("L. หน้านักศึกษา", () => {
  test("ยังไม่ออกฝึก: กล่องแจ้ง ไม่มีฟอร์ม · รอบปิดนัด: ปุ่มส่งกดไม่ได้ · ไม่มีที่ปรึกษา: เตือน + ปุ่มส่งกดไม่ได้", async ({ page }) => {
    await asStudent(page, "uiNotYet");
    await expect(page.getByText("ยังไม่สามารถนัดหมายนิเทศได้")).toBeVisible();
    await expect(page.getByRole("button", { name: SUBMIT })).toHaveCount(0);
    await asStudent(page, "uiClosed");
    await expect(page.getByText("🔴 ปิดระบบ")).toBeVisible();
    await expect(page.getByRole("button", { name: SUBMIT })).toBeDisabled();
    await asStudent(page, "uiNoAdvisor");
    await expect(page.getByText("ยังไม่ได้ระบุอาจารย์ที่ปรึกษาโครงการ")).toBeVisible();
    await expect(page.getByRole("button", { name: SUBMIT })).toBeDisabled();
  });

  test("ฟอร์ม: เพิ่ม/ลบตัวเลือก · (ใหม่) บอกช่วงนิเทศ + วันนอกช่วงเตือนก่อนส่ง · ออนไลน์ต้องมีลิงก์ · ส่ง → รออาจารย์ · แก้ไข → ต่อคิวเพื่อนบริษัทเดียวกัน → ยกเลิกแก้ไข", async ({ page }) => {
    await asStudent(page, "uiNew");
    await expect(page.getByText("📌 เลือกวันในช่วงนิเทศของหลักสูตร:")).toBeVisible();
    await expect(page.getByText("สูงสุด 3 ตัวเลือก")).toHaveCount(0);
    await page.getByRole("button", { name: "+ เพิ่มตัวเลือกวันที่" }).click();
    await expect(page.getByText("ตัวเลือก 2", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "ลบวันนี้" }).last().click();
    await expect(page.getByText("ตัวเลือก 2", { exact: true })).toHaveCount(0);

    const date = page.locator('input[type="date"]');
    await date.first().fill(day(61));
    await page.getByRole("button", { name: SUBMIT }).click();
    await expect(page.getByText(/อยู่นอกช่วงนิเทศของหลักสูตร/)).toBeVisible();
    await date.first().fill(day(50));
    await expect(page.getByPlaceholder("https://meet.google.com/...")).toBeVisible();   // ตัวเลือกใหม่เริ่มเป็นออนไลน์
    await page.getByRole("button", { name: SUBMIT }).click();
    await expect(page.getByText("กรุณาระบุ Link สำหรับการนิเทศออนไลน์").first()).toBeVisible();
    expect(await w.supervision("uiNew")).toBeNull();

    await page.locator('select:has(option[value="ONSITE"])').first().selectOption("ONSITE");
    await expect(page.getByPlaceholder("https://meet.google.com/...")).toHaveCount(0);
    await page.getByRole("button", { name: SUBMIT }).click();
    await confirmBtn(page, "ส่งให้อาจารย์พิจารณา").click();
    await expect(page.getByText("รออาจารย์ยืนยันวันนิเทศ")).toBeVisible();
    const a = await w.supervision("uiNew");
    expect([a.status, JSON.parse(a.proposedDates)]).toEqual(["PENDING_TEACHER", [`${day(50)}|08:00-10:30|ONSITE`]]);

    await page.getByRole("button", { name: "✏️ แก้ไขเวลา หรือรูปแบบการนิเทศ" }).click();
    await expect(page.getByText("✏️ แก้ไขวันนิเทศ")).toBeVisible();
    await expect(page.getByText(`เพื่อนที่ ${w.companyName.A} นัดไว้แล้ว`)).toBeVisible();
    const join = page.locator("div", { has: page.getByRole("button", { name: "➕ ขอนัดวันนี้ (ต่อคิว)" }), hasText: "นศqueueMate" }).last();
    await join.getByRole("button", { name: "➕ ขอนัดวันนี้ (ต่อคิว)" }).click();
    await expect(date.nth(1)).toHaveValue(day(DAYS.queueMate));
    await expect(page.locator('select:has(option[value="08:00"])').nth(2)).toHaveValue("14:00"); // ต่อจากคิวเพื่อนที่จบ 14:00
    await page.getByRole("button", { name: "ยกเลิกการแก้ไข" }).click();
    await expect(page.getByText("รออาจารย์ยืนยันวันนิเทศ")).toBeVisible();
    expect(JSON.parse((await w.supervision("uiNew")).proposedDates)).toHaveLength(1);
  });

  test("ถูกปฏิเสธ: เห็นเหตุผล + ฟอร์มเสนอใหม่ · ยืนยันแล้ว: ล็อก ไม่มีปุ่มแก้ · ออกหนังสือแล้ว: ปุ่มดาวน์โหลดเปิดไฟล์หนังสือ · มีปฏิทิน/ตารางของหลักสูตร", async ({ page }) => {
    await asStudent(page, "uiRejected");
    await expect(page.getByText("อาจารย์ไม่สะดวกในวันดังกล่าว แจ้งว่า:")).toBeVisible();
    await expect(page.getByText("ZS ขอเลื่อนเป็นสัปดาห์หน้า").first()).toBeVisible();
    await expect(page.getByRole("button", { name: SUBMIT })).toBeEnabled();

    await asStudent(page, "uiConfirmed");
    await expect(page.getByText("สรุปข้อมูลการนิเทศสหกิจศึกษา")).toBeVisible();
    await expect(page.getByText("🔒 ล็อกแล้ว")).toBeVisible();
    await expect(page.getByText(/กำลังรอเจ้าหน้าที่พิจารณาออกหนังสือ/)).toBeVisible();
    await expect(page.getByRole("button", { name: /แก้ไขเวลา/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: SUBMIT })).toHaveCount(0);

    await asStudent(page, "uiLetter");
    // Chromium แบบไม่มีหน้าจอเปิด PDF เป็นการดาวน์โหลด (แท็บใหม่ไม่เปลี่ยน URL) — ดูจากคำขอไฟล์ในแท็บใหม่แทน
    const fileReq = page.context().waitForEvent("request", (r) => r.url().includes(`/uploads/supervision/ZS${w.tail}-uiLetter.pdf`));
    await page.getByRole("button", { name: "⬇️ ดาวน์โหลดหนังสือนิเทศ (PDF)" }).click();
    const res = await (await fileReq).response();
    expect(res?.status()).toBe(200);
    await expect(page.getByText("📅 ปฏิทินนิเทศสหกิจ หลักสูตรของคุณ (วันที่ยืนยันแล้ว)")).toBeVisible();
    await expect(page.getByText("🗓️ ตารางนิเทศหลักสูตรของคุณ (เรียงตามวัน)")).toBeVisible();
  });
});

test.describe("M. หน้าอาจารย์ (ที่ปรึกษา / อาจารย์ร่วม)", () => {
  async function openMine(page: Page, k: keyof typeof w.t, key: string) {
    await asTeacher(page, k);
    await listPeriod(page).selectOption("all");
    await page.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท...").fill(w.s[key].studentId);
    return row(page, key);
  }

  test("ที่ปรึกษา (ไม่ใช่ประจำวิชา) ไม่มีแท็บจัดการ · หน้าต่างพิจารณา: ปุ่มเลือกวันทุกวันที่เสนอ + อาจารย์ร่วมยังไม่ตอบ · ปฏิเสธโดยไม่ใส่เหตุผลถูกเตือน", async ({ page }) => {
    const r = await openMine(page, "main", "uiPending");
    await expect(page.getByText("🗂️ ทั้งหมด")).toHaveCount(0);
    await expect(r.getByText("👑 หลัก")).toBeVisible();
    await r.getByRole("button", { name: "พิจารณาวันนิเทศ" }).click();
    await expect(page.getByText(`พิจารณาวันนิเทศ: นศuiPending ทดสอบนิเทศ`)).toBeVisible();
    await expect(page.getByRole("button", { name: "เลือกวันนี้" })).toHaveCount(2);
    await expect(page.getByText("(ยังไม่ตอบ)").first()).toBeVisible();
    await page.getByRole("button", { name: "ปฏิเสธให้เลือกวันใหม่" }).click();
    await expect(page.getByText("กรุณาระบุเหตุผล เพื่อให้นักศึกษาทราบและเลือกวันใหม่")).toBeVisible();
    expect((await w.supervision("uiPending")).status).toBe("PENDING_TEACHER");
  });

  test("อาจารย์ร่วม: ปุ่ม \"ระบุวันว่าง\" → ติ๊กวัน → บันทึก → ปุ่มกลายเป็น \"แก้วันว่าง\" · นัดที่ออกหนังสือแล้วไม่มีปุ่มจบนิเทศ (เฉพาะผู้นิเทศหลัก)", async ({ page }) => {
    const r = await openMine(page, "co", "uiPending");
    await expect(r.getByText("🤝 ร่วม")).toBeVisible();
    await r.getByRole("button", { name: "📅 ระบุวันว่าง" }).click();
    await expect(page.getByText("📅 ติ๊กวันที่คุณว่าง")).toBeVisible();
    await expect(page.getByRole("button", { name: "💾 บันทึก — ไม่ว่างทุกวันที่เสนอ" })).toBeVisible();
    await page.locator('input[type="checkbox"]').first().check();
    await page.getByRole("button", { name: "💾 บันทึกวันว่าง (1 วัน)" }).click();
    await expect(page.getByText(/บันทึกวันว่าง 1 วันแล้ว/)).toBeVisible();
    await expect(r.getByRole("button", { name: "📅 แก้วันว่าง" })).toBeVisible();
    const co = (await w.supervision("uiPending")).coTeachers[0];
    expect(JSON.parse(co.availableDates)).toEqual([day(DAYS.uiPendingA)]);

    await page.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท...").fill(w.s.uiLetter.studentId);
    await expect(row(page, "uiLetter").getByText("🤝 ร่วม")).toBeVisible();
    await expect(row(page, "uiLetter").getByRole("button", { name: "🏁 จบนิเทศ" })).toHaveCount(0);
  });

  test("ที่ปรึกษา: เห็นว่าอาจารย์ร่วมว่าง → เลือกวันนี้ → ยืนยัน · ปฏิเสธพร้อมเหตุผล · ดูรายละเอียดนัดที่ยืนยันแล้ว · จบนิเทศ", async ({ page }) => {
    let r = await openMine(page, "main", "uiPending");
    await r.getByRole("button", { name: "พิจารณาวันนิเทศ" }).click();
    await expect(page.getByText(`✓ ${w.t.co.name}`)).toBeVisible();
    await page.getByRole("button", { name: "เลือกวันนี้" }).first().click();
    await confirmBtn(page, "ยืนยันวันนี้").click();
    await expect(page.getByText("บันทึกผลการพิจารณาเรียบร้อยแล้ว")).toBeVisible();
    await expect.poll(async () => { const x = await w.supervision("uiPending"); return [x.status, iso(x.confirmedDate)]; }).toEqual(["DATE_CONFIRMED", at(day(DAYS.uiPendingA), "09:00")]);

    await page.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท...").fill(w.s.uiReject.studentId);
    await row(page, "uiReject").getByRole("button", { name: "พิจารณาวันนิเทศ" }).click();
    await page.getByPlaceholder("เช่น ขอเลื่อนเป็นสัปดาห์หน้า...").fill("ZS ไม่สะดวกวันนั้น");
    await page.getByRole("button", { name: "ปฏิเสธให้เลือกวันใหม่" }).click();
    await confirmBtn(page, "ปฏิเสธ").click();
    // ข้อความ "บันทึกผล…" ของการยืนยันก่อนหน้ายังค้างอยู่ — รอจากข้อมูลจริง
    await expect.poll(async () => { const x = await w.supervision("uiReject"); return [x.status, x.rejectReason]; }).toEqual(["TEACHER_REJECTED", "ZS ไม่สะดวกวันนั้น"]);

    await page.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท...").fill(w.s.uiConfirmed.studentId);
    await row(page, "uiConfirmed").getByRole("button", { name: "🔍 ดูรายละเอียด" }).click();
    await expect(page.getByText("ยืนยันวันนิเทศเรียบร้อย")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท...").fill(w.s.uiLetter.studentId);
    r = row(page, "uiLetter");
    await r.getByRole("button", { name: "🏁 จบนิเทศ" }).click();
    await confirmBtn(page, "นิเทศเสร็จสิ้น").click();
    await expect(page.getByText("บันทึกผลนิเทศเสร็จสิ้นสำเร็จ")).toBeVisible();
    expect((await w.supervision("uiLetter")).status).toBe("COMPLETED");
  });
});

test.describe("N. หน้าอาจารย์ประจำวิชา (แท็บทั้งหมด · นิเทศตามบริษัท)", () => {
  test("แท็บทั้งหมด: กรองรอบ + ค้นหา → มอบหมายอาจารย์ร่วม → บันทึก", async ({ page }) => {
    await asTeacher(page, "coopCS");
    await expect(page.getByText("📋 ของฉัน")).toBeVisible();
    await page.getByText("🗂️ ทั้งหมด").click();
    await expect(page.getByText("🗂️ จัดการนิเทศสหกิจ (ทั้งหมด)")).toBeVisible();
    await listPeriod(page).selectOption(String(w.openPeriodId));
    await page.getByPlaceholder("ค้นหา รหัส / ชื่อ / บริษัท / อาจารย์...").fill(w.s.uiConfirmed.studentId);
    const r = row(page, "uiConfirmed");
    await expect(r.getByRole("button", { name: "✏️ แก้ไขวัน" })).toBeEnabled();
    await r.getByRole("button", { name: /มอบหมาย/ }).click();
    await page.locator("label", { hasText: `ทดสอบร่วมสอง ZS${w.tail}` }).locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: "💾 บันทึก", exact: true }).click();
    await expect.poll(async () => (await w.supervision("uiConfirmed")).coTeachers.map((c) => c.teacherId)).toEqual([w.t.co2.pk]);
    await expect(r.getByRole("button", { name: "👥 อาจารย์ร่วม" })).toBeVisible();
  });

  test("นิเทศตามบริษัท: ปุ่ม \"นัดพร้อมกัน\" → เลือกวันร่วม (ติ๊กให้คนที่เสนอวันนั้น) → ยืนยัน → นัดต่อคิวเป็นกลุ่มเดียวกัน", async ({ page }) => {
    await asTeacher(page, "coopCS");
    await page.getByText("🏢 นิเทศตามบริษัท").click();
    const card = page.locator("div", { hasText: w.companyName.B, has: page.getByRole("button", { name: /นัดพร้อมกัน/ }) }).last();
    await card.getByRole("button", { name: "นัดพร้อมกัน (1 วัน)" }).click();
    // ตัวอย่างคิวบอกเวลาของแต่ละคนตามที่เสนอ
    await expect(page.getByText(/นศuiGP ทดสอบนิเทศ — 09:00–10:00 น\./)).toBeVisible();
    await expect(page.getByText(/นศuiGQ ทดสอบนิเทศ — 10:00–11:00 น\./)).toBeVisible();
    await page.getByRole("button", { name: "ยืนยัน (2 คน)" }).click();
    await expect.poll(async () => (await w.supervision("uiGP")).status).toBe("DATE_CONFIRMED");
    const [p, q] = [await w.supervision("uiGP"), await w.supervision("uiGQ")];
    expect(q.status).toBe("DATE_CONFIRMED");
    expect(p.groupId).toBeTruthy();
    expect(q.groupId).toBe(p.groupId);
    expect(iso(q.confirmedDate) === iso(p.confirmedEndDate) || iso(p.confirmedDate) === iso(q.confirmedEndDate)).toBe(true);
  });
});

test.describe("O. หน้าจัดการการนิเทศ (เจ้าหน้าที่ / อาจารย์ประจำวิชา)", () => {
  const MANAGER = "/admin/supervision-manager";
  // แถวในตารางรายการนัด (ตารางนิเทศเรียงวันด้านบนก็มีรหัสนักศึกษา)
  const mrow = (page: Page, key: string) => page.locator(".responsive-table tr", { hasText: w.s[key].studentId });
  async function filterTable(page: Page, key?: string) {
    await listPeriod(page).selectOption(String(w.openPeriodId));
    await page.getByPlaceholder("ค้นหา รหัส / ชื่อ / บริษัท / อาจารย์...").fill(key ? w.s[key].studentId : "");
  }

  test("ตั้งค่าช่วงนิเทศ: เลือกรอบ + หลักสูตร → บันทึก · (ใหม่) เริ่มหลังสิ้นสุดถูกปฏิเสธ ค่าเดิมไม่เปลี่ยน", async ({ page }) => {
    await asUser(page, staff(), w.staff.userId, MANAGER);
    await expect(page.getByText("🚗 จัดการการนิเทศสหกิจศึกษา")).toBeVisible();
    await page.locator('select:has(option[value=""])').filter({ hasText: "-- เลือกรอบที่ต้องการ --" }).selectOption(String(w.openPeriodId));
    await page.getByLabel("หลักสูตรที่ตั้งช่วงนิเทศ").selectOption("CS");
    const dates = page.locator('input[type="date"]');
    await expect(dates.nth(0)).toHaveValue(day(-5));
    await dates.nth(1).fill(day(59));
    await page.locator('select:has(option[value="OPEN"])').selectOption("OPEN");
    await page.getByRole("button", { name: "💾 บันทึก", exact: true }).click();
    await expect(page.getByText("บันทึกช่วงเวลานิเทศของหลักสูตร CS เรียบร้อยแล้ว")).toBeVisible();
    expect(dayOf((await w.periodRow("CS")).supervisionEndDate)).toBe(day(59));

    await dates.nth(0).fill(day(70));
    await page.getByRole("button", { name: "💾 บันทึก", exact: true }).click();
    await expect(page.getByText("วันเริ่มนัดหมายนิเทศต้องไม่หลังวันสิ้นสุด")).toBeVisible();
    expect(dayOf((await w.periodRow("CS")).supervisionStartDate)).toBe(day(-5));
    await w.setWindow("CS", day(-5), day(60));
  });

  test("ตาราง: แก้ไขวัน (หน้าต่าง + ยืนยัน) · จัดการอาจารย์ · ออกหนังสือ (อัปโหลดฉบับลงนาม) → ดูเอกสาร/จบนิเทศ · จบนิเทศอีกนัด", async ({ page }) => {
    await asUser(page, staff(), w.staff.userId, MANAGER);
    await filterTable(page, "uiConfirmed");
    const r = mrow(page, "uiConfirmed");
    await r.getByRole("button", { name: "✏️ แก้ไขวัน" }).click();
    await expect(page.getByText("✏️ แก้ไขวัน-เวลานิเทศ")).toBeVisible();
    await page.locator('input[type="date"]').last().fill(day(32));
    await page.locator('input[type="time"]').fill("13:00");
    await page.getByRole("button", { name: "💾 บันทึกวันใหม่" }).click();
    await expect(page.getByText("ยืนยันการแก้ไขวันนิเทศ")).toBeVisible();
    await confirmBtn(page, "บันทึก").click();
    await expect(page.getByText("แก้ไขวันนิเทศเรียบร้อยแล้ว")).toBeVisible();
    expect(iso((await w.supervision("uiConfirmed")).confirmedDate)).toBe(at(day(32), "13:00"));

    await filterTable(page, "uiConfirmed");
    await r.getByRole("button", { name: "👥 จัดการอาจารย์" }).click();
    await page.locator("label", { hasText: `ทดสอบร่วมหนึ่ง ZS${w.tail}` }).locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: "💾 บันทึกการเปลี่ยนแปลง" }).click();
    await expect(page.getByText("บันทึกรายชื่ออาจารย์นิเทศเรียบร้อยแล้ว")).toBeVisible();
    expect((await w.supervision("uiConfirmed")).coTeachers.map((c) => c.teacherId).sort()).toEqual([w.t.co.pk, w.t.co2.pk].sort());

    await filterTable(page, "uiConfirmed");
    // บั๊กที่เจอรอบนี้: บันทึกอาจารย์ร่วมแล้วหน้าต่างออกหนังสือเด้งขึ้นเอง (นัดที่เลือกไม่ถูกล้าง) — เช็กหลังหน้าโหลดรายการใหม่เสร็จ
    await expect(r.getByRole("button", { name: "📄 ออกหนังสือ" })).toBeVisible();
    await expect(page.locator(".letter-modal-backdrop")).toHaveCount(0);
    await r.getByRole("button", { name: "📄 ออกหนังสือ" }).click();
    await page.getByPlaceholder("660301.26.6.2/1234").fill(no(7));
    await page.locator("#signed-file-supervision").setInputFiles({ name: "signed.pdf", mimeType: "application/pdf", buffer: PDF });
    await page.getByRole("button", { name: "🚀 บันทึกเข้าระบบ & แจ้งนักศึกษา" }).click();
    await confirmBtn(page, "บันทึก").click();
    await expect(page.getByText("บันทึกและจัดเก็บไฟล์หนังสือนิเทศเรียบร้อยแล้ว")).toBeVisible();
    const a = await w.supervision("uiConfirmed");
    expect([a.status, a.letterDocNumber]).toEqual(["LETTER_UPLOADED", no(7)]);
    await filterTable(page, "uiConfirmed");
    await expect(r.getByRole("button", { name: "👁️ ดูเอกสาร" })).toBeVisible();
    await expect(r.getByRole("button", { name: "✏️ แก้ไขวัน" })).toHaveCount(0);

    await filterTable(page, "uiLetter2");
    await mrow(page, "uiLetter2").getByRole("button", { name: "🏁 จบนิเทศ" }).click();
    await confirmBtn(page, "นิเทศเสร็จสิ้น").click();
    await expect(page.getByText("บันทึกผลนิเทศเสร็จสิ้นสำเร็จ")).toBeVisible();
    expect((await w.supervision("uiLetter2")).status).toBe("COMPLETED");
  });

  test("ตัวกรองหนังสือ: รอลงนาม (ป้าย + ปุ่มแก้วันกดไม่ได้) / รอออกหนังสือ · ส่งออก Excel ดาวน์โหลดได้ · ปฏิทิน: เดือนก่อน/ถัดไป/วันนี้ + ตัวกรองรูปแบบ", async ({ page }) => {
    expect((await letterPending(staff(), w.appt.coClash, { docNumber: no(8) })).status).toBe(200);
    await asUser(page, staff(), w.staff.userId, MANAGER);
    await filterTable(page);
    const letter = page.locator('select:has(option[value="PENDING_SIGN"])');
    await letter.selectOption("PENDING_SIGN");
    await expect(mrow(page, "coClash").getByText("รอลงนามหนังสือขอนิเทศ")).toBeVisible();
    await expect(mrow(page, "coClash").getByRole("button", { name: "✏️ แก้ไขวัน" })).toBeDisabled();
    await expect(mrow(page, "coClash").getByRole("button", { name: "✍️ อัปโหลดฉบับลงนาม" })).toBeVisible();
    await expect(mrow(page, "lockC")).toHaveCount(0);
    await letter.selectOption("TO_ISSUE");
    await expect(mrow(page, "lockC")).toBeVisible();
    await expect(mrow(page, "coClash")).toHaveCount(0);
    await letter.selectOption("all");
    expect((await letterPending(staff(), w.appt.coClash, { cancel: true })).status).toBe(200);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "📊 Export Excel" }).click();
    expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);

    const month = page.locator("span", { hasText: /^\S+ \d{4}$/ }).first();
    const now = await month.textContent();
    await page.getByRole("button", { name: "›", exact: true }).first().click();
    await expect(month).not.toHaveText(now!);
    await page.getByRole("button", { name: "‹", exact: true }).first().click();
    await page.getByRole("button", { name: "‹", exact: true }).first().click();
    await expect(month).not.toHaveText(now!);
    await page.getByRole("button", { name: "วันนี้", exact: true }).first().click();
    await expect(month).toHaveText(now!);
    for (const chip of ["🌐 ออนไลน์", "🏢 ออนไซต์", "ทั้งหมด"]) {
      const b = page.getByRole("button", { name: chip, exact: true }).first();
      await b.click();
      await expect(b).toHaveCSS("background-color", "rgb(15, 23, 42)");
    }
  });

  test("อาจารย์ประจำวิชา: เห็นเฉพาะหลักสูตรตัวเอง · ตั้งช่วงได้เฉพาะหลักสูตรตัวเอง (เลือกหลักสูตรไม่ได้) · ไม่มีปุ่มออกหนังสือ (รอเจ้าหน้าที่)", async ({ page }) => {
    await asUser(page, T("coopCS"), w.t.coopCS.userId, MANAGER);
    await expect(page.getByLabel("หลักสูตรที่ตั้งช่วงนิเทศ")).toBeDisabled();
    await expect(page.getByLabel("หลักสูตรที่ตั้งช่วงนิเทศ")).toHaveValue("CS");
    await filterTable(page, "lockC");
    await expect(mrow(page, "lockC").getByText("🕒 รอเจ้าหน้าที่ออกหนังสือ")).toBeVisible();
    await expect(mrow(page, "lockC").getByRole("button", { name: "📄 ออกหนังสือ" })).toHaveCount(0);
    await filterTable(page, "aiConfirmed");
    await expect(mrow(page, "aiConfirmed")).toHaveCount(0);
  });
});
