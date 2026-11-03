/**
 * tests/application.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * ยื่นคำร้องเข้าร่วมโครงการ — นักศึกษายื่น/แก้/ลบไฟล์ · อาจารย์ที่ปรึกษาพิจารณา · เจ้าหน้าที่/อาจารย์ประจำวิชาตรวจคำร้อง
 * · ตั้งค่าหน้ายื่นคำร้อง — backend + DB จริง (ข้อมูล ZA ลบทิ้งตอนจบ · ค่าตั้งค่ากลางคืนค่าเดิม)
 *
 * กติกาที่ผู้ใช้ตัดสิน 2026-11-04:
 *   - ส่งกลับแก้ไข / ไม่ผ่าน ต้องมีเหตุผล (ทั้งหน้าอาจารย์ หน้าเจ้าหน้าที่ และ API)
 *   - เปลี่ยนผลคำร้องย้อนหลังได้จนกว่านักศึกษาจะส่ง T000 (ส่งแล้ว = ล็อก ไปจัดการที่หน้าเอกสาร T000)
 * บั๊กที่แก้รอบนี้: บันทึกใบสมัครวันที่ผิดรูปแบบ 500 / เริ่มหลังสิ้นสุดบันทึกได้ · ตั้งสถานะของ T000 (WAITING_FOR_STAFF_CHECK/EDITS_REQUIRED)
 *   ผ่าน API ตรวจคำร้องได้ · หน้ายื่นคำร้องตอน "แก้เอกสาร T000" มีปุ่มส่งแก้ไขคำร้องที่กดแล้ว 409 ทุกครั้ง + ลบไฟล์แนบได้
 */
import fs from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { api, type Res } from "./helpers/letterWorld";
import { WorldKit, UPLOADS, day, type KStudent, type KTeacher, type KUser } from "./helpers/worldKit";

const k = new WorldKit("ZA");
test.describe.configure({ mode: "serial" });
const msg = (r: Res) => JSON.stringify(r.body);
const PDF = Buffer.from("%PDF-1.4\napplication e2e\n%%EOF");
const uploads = () => fs.readdirSync(UPLOADS).length;

let staff: KUser;
const t = {} as Record<"adv" | "other" | "coopCS" | "coopAI", KTeacher>;
const s = {} as Record<string, KStudent>;
let openP: number, closedP: number, company: { id: string; name: string; contactIds: string[] };

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน");
  staff = await k.staff();
  t.adv = await k.teacher("ที่ปรึกษา");
  t.other = await k.teacher("อื่น");
  t.coopCS = await k.teacher("ประจำวิชาCS", { coop: ["CS"] });
  t.coopAI = await k.teacher("ประจำวิชาAI", { major: "AI", coop: ["AI"] });
  openP = await k.period(8, { CS: { isActive: true }, AI: { isActive: true } });
  closedP = await k.period(9, { CS: { isActive: false } });
  company = await k.company(`บริษัท ${k.prefix}${k.tail} จำกัด`, ["สมหญิง"], staff.userId);
  const ready = { companyId: company.id, contactIds: company.contactIds, advisor: t.adv.pk, periodId: openP };
  const plan: [string, Parameters<WorldKit["student"]>[2]][] = [
    ["fresh", { ...ready }],
    ["noContact", { ...ready, contactIds: [] }],
    ["noMajor", { ...ready, major: null }],
    ["pass", { ...ready, status: "QUALIFIED" }],
    ["failed", { ...ready, status: "QUALIFICATION_FAILED", teacherCheckComment: "เกรดไม่ถึง" }],
    ["edits", { ...ready, status: "APPLICATION_EDITS_REQUIRED", docs: [{ type: "APPLICATION_DOC", file: true }] }],
    ["applying", { ...ready, status: "APPLYING", docs: [{ type: "APPLICATION_DOC", file: true }, { type: "ACCEPTANCE_LETTER", file: true }] }],
    ["t000edit", { ...ready, status: "EDITS_REQUIRED", t000Status: "EDITS_REQUIRED", docs: [{ type: "APPLICATION_DOC", file: true }] }],
    ["form", { ...ready }],
    // อาจารย์ที่ปรึกษาพิจารณา
    ["rA", { ...ready, status: "APPLYING" }], ["rB", { ...ready, status: "APPLYING" }], ["rC", { ...ready, status: "PENDING_GRADE" }],
    ["rD", { ...ready, status: "WAITING_FOR_STAFF_CHECK", t000Status: "EDITS_REQUIRED" }], ["rE", { ...ready, status: "QUALIFIED" }],
    // เจ้าหน้าที่/อาจารย์ประจำวิชาตรวจคำร้อง
    ["aA", { ...ready, status: "APPLYING" }], ["aQ", { ...ready, status: "QUALIFIED" }],
    ["aW", { ...ready, status: "WAITING_FOR_STAFF_CHECK", t000Status: "PENDING" }], ["aE", { ...ready, status: "EDITS_REQUIRED", t000Status: "EDITS_REQUIRED" }],
    ["aAI", { ...ready, major: "AI", status: "APPLYING" }],
    // หน้าเว็บ
    ["uiNew", { ...ready }], ["uiNoContact", { ...ready, contactIds: [] }],
    ["uiEdits", { ...ready, status: "APPLICATION_EDITS_REQUIRED", teacherCheckComment: "ZA แนบทรานสคริปต์ฉบับล่าสุด" }],
    ["uiT000", { ...ready, status: "EDITS_REQUIRED", t000Status: "EDITS_REQUIRED", docs: [{ type: "APPLICATION_DOC", file: true }] }],
    ["uiTeach", { ...ready, status: "APPLYING" }], ["uiTeachDone", { ...ready, status: "QUALIFIED" }],
    ["uiStaff", { ...ready, status: "APPLYING" }], ["uiStaffW", { ...ready, status: "WAITING_FOR_STAFF_CHECK", t000Status: "PENDING" }],
  ];
  let n = 0;
  for (const [key, o] of plan) s[key] = await k.student(key, ++n, o);
  await k.snapshot("GATEWAY_SETTINGS");
});
test.afterAll(async () => { await k.cleanup(); await k.disconnect(); });

function applyForm(fields: Record<string, string | number>, files = 1) {
  const fd = new FormData();
  for (const [key, v] of Object.entries(fields)) fd.append(key, String(v));
  for (let i = 0; i < files; i++) fd.append("files", new Blob([PDF], { type: "application/pdf" }), `เอกสาร${i + 1}.pdf`);
  return fd;
}
const apply = (key: string, fields: Record<string, string | number> = {}, files = 1) =>
  api(s[key].token, "POST", "/api/coop/apply", applyForm({ jobPosition: "Frontend Developer", coopPeriodId: openP, ...fields }, files));
const coopOf = (key: string) => k.coop(s[key].pk);
const advise = (token: string, key: string, status: string, comment?: string) => api(token, "PUT", "/api/coop/status", { studentId: s[key].pk, status, comment });
const review = async (token: string, key: string, status: string, comment?: string) =>
  api(token, "PATCH", `/api/admin/coop-applications/${(await coopOf(key)).id}/status`, { status, comment });
const titles = async (key: string) => (await k.notes(s[key].userId, "STATUS_UPDATED")).map((x: { message: string }) => x.message);

// ══════════════════════════════════════════════════════
// A. ใบสมัคร (ข้อมูลส่วนตัวสำหรับใบคำร้อง)
// ══════════════════════════════════════════════════════
test.describe("A. ใบสมัคร", () => {
  test("บันทึกแล้วอ่านกลับได้ (วันที่ YYYY-MM-DD · ที่อยู่ประกอบจากช่องย่อย) · (ใหม่) วันที่ผิด/เริ่มหลังสิ้นสุด 400 · อาจารย์เรียก 403", async () => {
    let r = await api(s.form.token, "POST", "/api/docs/save-form", {
      contactPhone: "0812345678", emergencyName: "แม่", startDate: day(30), endDate: day(150), careerObjective1: "เป็นนักพัฒนา",
      contactHouseNo: "12", contactProvince: "ขอนแก่น",
    });
    expect(r.status, msg(r)).toBe(200);
    r = await api(s.form.token, "GET", "/api/docs/my-application");
    expect([r.body.form.startDate, r.body.form.endDate, r.body.form.contactPhone, r.body.form.careerObjective1]).toEqual([day(30), day(150), "0812345678", "เป็นนักพัฒนา"]);

    r = await api(s.form.token, "POST", "/api/docs/save-form", { startDate: "abc" });
    expect(r.status, msg(r)).toBe(400);
    r = await api(s.form.token, "POST", "/api/docs/save-form", { startDate: day(150), endDate: day(30) });
    expect(r.status, msg(r)).toBe(400);
    expect((await api(s.form.token, "GET", "/api/docs/my-application")).body.form.startDate).toBe(day(30));
    expect((await api(t.adv.token, "POST", "/api/docs/save-form", { startDate: day(30) })).status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════
// B. นักศึกษายื่นคำร้อง
// ══════════════════════════════════════════════════════
test.describe("B. ยื่นคำร้อง", () => {
  test("ด่าน: รอบผิด 400 · ไม่มีหลักสูตร 400 · รอบปิด 400 · ไม่มีผู้ติดต่อ (HR) 400 · ลิงก์ผลการเรียนไม่ใช่ http(s) 400 · อาจารย์ 403 — ไฟล์ที่ส่งมาไม่ค้าง", async () => {
    const before = uploads();
    expect((await apply("fresh", { coopPeriodId: "x" })).status).toBe(400);
    let r = await apply("noMajor");
    expect([r.status, r.body.message]).toEqual([400, expect.stringMatching(/ยังไม่ได้ระบุหลักสูตร/)]);
    r = await apply("fresh", { coopPeriodId: closedP });
    expect([r.status, r.body.message]).toEqual([400, expect.stringMatching(/ถูกปิดไปแล้ว/)]);
    r = await apply("noContact");
    expect([r.status, r.body.message]).toEqual([400, expect.stringMatching(/ผู้ติดต่อ \(HR\)/)]);
    expect((await apply("fresh", { gradeSheetUrl: "javascript:alert(1)" })).status).toBe(400);
    expect((await api(t.adv.token, "POST", "/api/coop/apply", applyForm({ jobPosition: "x", coopPeriodId: openP }))).status).toBe(403);
    expect(uploads()).toBe(before);
    expect((await coopOf("fresh")).status).toBe("NOT_SUBMITTED");
  });

  test("ยื่นสำเร็จ → รอพิจารณา · ไฟล์แนบ/ตำแหน่ง/ลิงก์ผลการเรียนถูกบันทึก · แก้ไขระหว่างรอได้ (ไฟล์เพิ่ม) · ไม่ผ่าน/ส่งกลับแก้ ยื่นใหม่ได้", async () => {
    let r = await apply("fresh", { gradeSheetUrl: "https://docs.google.com/spreadsheets/d/zz" }, 2);
    expect(r.status, msg(r)).toBe(200);
    const c = await coopOf("fresh");
    expect([c.status, c.jobPosition, c.coopPeriodId]).toEqual(["APPLYING", "Frontend Developer", openP]);
    expect((await k.docs(s.fresh.pk, "APPLICATION_DOC")).map((d: { name: string }) => d.name)).toEqual(["เอกสาร1.pdf", "เอกสาร2.pdf"]);
    expect((await api(s.fresh.token, "GET", "/api/docs/my-application")).body.form.gradeSheetUrl).toBe("https://docs.google.com/spreadsheets/d/zz");

    r = await apply("fresh", { jobPosition: "Data Engineer" });
    expect(r.status, msg(r)).toBe(200);
    expect([(await coopOf("fresh")).jobPosition, (await k.docs(s.fresh.pk, "APPLICATION_DOC")).length]).toEqual(["Data Engineer", 3]);
    for (const key of ["failed", "edits"]) {
      r = await apply(key);
      expect(r.status, `${key}: ${msg(r)}`).toBe(200);
      expect((await coopOf(key)).status).toBe("APPLYING");
    }
  });

  test("ผ่านแล้ว / อยู่ในขั้น T000 ยื่นใหม่ไม่ได้ 409 — สถานะไม่ถอย · ไฟล์ที่ส่งมาไม่ค้าง", async () => {
    const before = uploads();
    for (const [key, status] of [["pass", "QUALIFIED"], ["t000edit", "EDITS_REQUIRED"]]) {
      const r = await apply(key);
      expect(r.status, `${key}: ${msg(r)}`).toBe(409);
      expect((await coopOf(key)).status).toBe(status);
    }
    expect(uploads()).toBe(before);
  });
});

// ══════════════════════════════════════════════════════
// C. ลบไฟล์แนบคำร้อง
// ══════════════════════════════════════════════════════
test.describe("C. ลบไฟล์แนบ", () => {
  test("ลบได้เฉพาะไฟล์แนบคำร้องของตัวเอง ตอนที่แก้คำร้องได้ (ยังไม่ส่ง/ส่งกลับแก้) · รอพิจารณา 409 · (ใหม่) แก้เอกสาร T000 409 · ไฟล์ชนิดอื่น 409 · คนอื่น 403", async () => {
    const del = (key: string, id: number | string) => api(s[key].token, "DELETE", `/api/coop/documents/${id}`);
    const [appDoc, otherDoc] = await k.docs(s.applying.pk);
    expect((await del("applying", appDoc.id)).status).toBe(409);
    expect((await del("applying", otherDoc.id)).status).toBe(409);
    expect((await del("fresh", appDoc.id)).status).toBe(403);
    const [t000Doc] = await k.docs(s.t000edit.pk);
    expect((await del("t000edit", t000Doc.id)).status).toBe(409);
    expect((await del("fresh", "x")).status).toBe(400);
    expect((await del("fresh", 999_999_999)).status).toBe(404);

    // ส่งกลับแก้ไข → ลบได้ (ไฟล์บนเครื่องหายด้วย)
    await advise(t.adv.token, "edits", "APPLICATION_EDITS_REQUIRED", "แนบใหม่").then((r) => expect(r.status).toBe(200));
    const [mine] = await k.docs(s.edits.pk, "APPLICATION_DOC");
    expect(fs.existsSync(`${UPLOADS}/${mine.path}`)).toBe(true);
    expect((await del("edits", mine.id)).status).toBe(200);
    expect(fs.existsSync(`${UPLOADS}/${mine.path}`)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
// D. อาจารย์ที่ปรึกษาพิจารณา (PUT /api/coop/status)
// ══════════════════════════════════════════════════════
test.describe("D. อาจารย์ที่ปรึกษาพิจารณา", () => {
  test("ด่าน: studentId/สถานะผิด 400 · (ใหม่) สถานะของ T000 400 · อาจารย์ที่ไม่ใช่ที่ปรึกษา 403 · นักศึกษา 403 · (ใหม่) ส่งกลับแก้/ไม่ผ่าน ไม่มีเหตุผล 400", async () => {
    expect((await api(t.adv.token, "PUT", "/api/coop/status", { studentId: "x", status: "APPROVED" })).status).toBe(400);
    expect((await advise(t.adv.token, "rA", "HELLO")).status).toBe(400);
    expect((await advise(t.adv.token, "rA", "EDITS_REQUIRED", "แก้ T000")).status).toBe(400);
    expect((await advise(t.other.token, "rA", "APPROVED")).status).toBe(403);
    expect((await advise(s.rA.token, "rA", "APPROVED")).status).toBe(403);
    for (const [status, comment] of [["APPLICATION_EDITS_REQUIRED", undefined], ["REJECTED", ""], ["QUALIFICATION_FAILED", "   "]]) {
      const r = await advise(t.adv.token, "rA", status as string, comment as string | undefined);
      expect(r.status, `${status}: ${msg(r)}`).toBe(400);
    }
    expect((await coopOf("rA")).status).toBe("APPLYING");
  });

  test("อนุมัติ → ผ่านเกณฑ์ · ส่งกลับแก้ (มีเหตุผล) · ไม่ผ่าน (มีเหตุผล) · รอพิจารณาเกรดอนุมัติได้ · เจ้าหน้าที่ทำแทนได้ · แจ้งนักศึกษาทุกครั้ง", async () => {
    let r = await advise(t.adv.token, "rA", "APPROVED");
    expect(r.status, msg(r)).toBe(200);
    expect((await coopOf("rA")).status).toBe("QUALIFIED");
    r = await advise(t.adv.token, "rB", "APPLICATION_EDITS_REQUIRED", "  แนบเกรดเทอมล่าสุด  ");
    expect(r.status, msg(r)).toBe(200);
    expect([(await coopOf("rB")).status, (await coopOf("rB")).teacherCheckComment]).toEqual(["APPLICATION_EDITS_REQUIRED", "แนบเกรดเทอมล่าสุด"]);
    r = await advise(t.adv.token, "rC", "APPROVED");
    expect(r.status, msg(r)).toBe(200);
    await expect.poll(() => titles("rA")).toContain("คำร้องของคุณผ่านการพิจารณา ✅");
    await expect.poll(() => titles("rB")).toContain("คำร้องของคุณต้องแก้ไข กรุณาตรวจสอบ");

    await apply("rB");
    r = await advise(staff.token, "rB", "REJECTED", "ไม่ผ่านเกณฑ์หน่วยกิต");
    expect(r.status, msg(r)).toBe(200);
    expect((await coopOf("rB")).status).toBe("QUALIFICATION_FAILED");
    await expect.poll(() => titles("rB")).toContain("คำร้องของคุณไม่ผ่านการพิจารณา");
  });

  test("(ใหม่) ส่ง T000 แล้ว (ส่งแก้รอตรวจ) / ผ่านเกณฑ์ไปแล้ว อาจารย์เปลี่ยนผลไม่ได้ 400", async () => {
    for (const [key, status] of [["rD", "WAITING_FOR_STAFF_CHECK"], ["rE", "QUALIFIED"]]) {
      const r = await advise(t.adv.token, key, "REJECTED", "เปลี่ยนใจ");
      expect(r.status, `${key}: ${msg(r)}`).toBe(400);
      expect((await coopOf(key)).status).toBe(status);
    }
  });
});

// ══════════════════════════════════════════════════════
// E. เจ้าหน้าที่ / อาจารย์ประจำวิชาตรวจคำร้อง (PATCH /api/admin/coop-applications/:id/status)
// ══════════════════════════════════════════════════════
test.describe("E. ตรวจคำร้อง (เจ้าหน้าที่/อาจารย์ประจำวิชา)", () => {
  test("ด่าน: id/สถานะผิด 400 · (ใหม่) สถานะของ T000 400 · อาจารย์ทั่วไป 403 · ประจำวิชาหลักสูตรอื่น 403 · (ใหม่) ส่งกลับแก้/ไม่ผ่าน ไม่มีเหตุผล 400", async () => {
    expect((await api(staff.token, "PATCH", "/api/admin/coop-applications/x/status", { status: "QUALIFIED" })).status).toBe(400);
    expect((await review(staff.token, "aA", "HELLO")).status).toBe(400);
    for (const st of ["WAITING_FOR_STAFF_CHECK", "EDITS_REQUIRED"]) expect((await review(staff.token, "aA", st, "x")).status, st).toBe(400);
    expect((await review(t.other.token, "aA", "QUALIFIED")).status).toBe(403);
    expect((await review(t.coopAI.token, "aA", "QUALIFIED")).status).toBe(403);
    expect((await review(t.coopCS.token, "aAI", "QUALIFIED")).status).toBe(403);
    expect((await review(s.aA.token, "aA", "QUALIFIED")).status).toBe(403);
    for (const st of ["APPLICATION_EDITS_REQUIRED", "QUALIFICATION_FAILED"]) expect((await review(staff.token, "aA", st, " ")).status, st).toBe(400);
    expect((await coopOf("aA")).status).toBe("APPLYING");
  });

  test("รอพิจารณาเกรด → ผ่าน (อาจารย์ประจำวิชาของหลักสูตร) · ไม่ผ่าน (มีเหตุผล) · ผ่านแล้วแต่ยังไม่ส่ง T000 เปลี่ยนผลได้ · แจ้งนักศึกษา", async () => {
    let r = await review(staff.token, "aA", "PENDING_GRADE");
    expect(r.status, msg(r)).toBe(200);
    await expect.poll(() => titles("aA")).toContain("คำร้องของคุณรอพิจารณาเกรด — จะแจ้งผลอีกครั้งเมื่อเกรดออก");
    r = await review(t.coopCS.token, "aA", "QUALIFIED");
    expect(r.status, msg(r)).toBe(200);
    r = await review(t.coopAI.token, "aAI", "QUALIFICATION_FAILED", "ZA หน่วยกิตไม่ครบ");
    expect(r.status, msg(r)).toBe(200);
    expect([(await coopOf("aAI")).status, (await coopOf("aAI")).staffCheckComment]).toEqual(["QUALIFICATION_FAILED", "ZA หน่วยกิตไม่ครบ"]);
    r = await review(staff.token, "aQ", "APPLICATION_EDITS_REQUIRED", "ขอเอกสารเพิ่ม");
    expect(r.status, msg(r)).toBe(200);
    expect((await coopOf("aQ")).status).toBe("APPLICATION_EDITS_REQUIRED");
  });

  test("(ใหม่) ส่ง T000 แล้ว (รอตรวจ / ต้องแก้) เปลี่ยนผลคำร้องไม่ได้ 400 — บอกให้ไปหน้าเอกสาร T000", async () => {
    for (const [key, status] of [["aW", "WAITING_FOR_STAFF_CHECK"], ["aE", "EDITS_REQUIRED"]]) {
      const r = await review(staff.token, key, "QUALIFICATION_FAILED", "เปลี่ยนใจ");
      expect(r.status, `${key}: ${msg(r)}`).toBe(400);
      expect(r.body.message).toMatch(/หน้าเอกสาร T000/);
      expect((await coopOf(key)).status).toBe(status);
    }
  });

  test("รายการคำร้อง: เจ้าหน้าที่เห็นทุกหลักสูตร · ประจำวิชาเห็นเฉพาะหลักสูตรตัวเอง · ไม่รวมยังไม่ยื่น · รอบผิด 400 · ตัวนับรอตรวจ = APPLYING", async () => {
    const q = `?coopPeriodId=${openP}`;
    const ids = async (token: string) => (await api(token, "GET", `/api/admin/coop-applications${q}`)).body.applications.map((a: { studentId: number }) => a.studentId);
    const [all, cs, ai] = [await ids(staff.token), await ids(t.coopCS.token), await ids(t.coopAI.token)];
    expect(all).toEqual(expect.arrayContaining([s.aA.pk, s.aAI.pk]));
    expect(all).not.toContain(s.noContact.pk);                  // ยังไม่ยื่น (NOT_SUBMITTED)
    expect(cs).toContain(s.aA.pk);
    expect(cs).not.toContain(s.aAI.pk);
    expect(ai).toEqual([s.aAI.pk]);
    expect((await api(t.other.token, "GET", `/api/admin/coop-applications${q}`)).status).toBe(403);
    expect((await api(staff.token, "GET", "/api/admin/coop-applications?coopPeriodId=abc")).status).toBe(400);
    const counts = (await api(staff.token, "GET", "/api/admin/coop-applications?countsOnly=1")).body.periods.find((p: { coopPeriodId: number }) => p.coopPeriodId === openP);
    const rows = (await api(staff.token, "GET", `/api/admin/coop-applications${q}`)).body.applications;
    expect([counts.count, counts.pending]).toEqual([rows.length, rows.filter((a: { status: string }) => a.status === "APPLYING").length]);
  });
});

// ══════════════════════════════════════════════════════
// F. ตั้งค่าหน้ายื่นคำร้อง (ข้อความ/ลิงก์แบบฟอร์มผลการเรียน)
// ══════════════════════════════════════════════════════
test.describe("F. ตั้งค่าหน้ายื่นคำร้อง", () => {
  test("แก้ได้เฉพาะเจ้าหน้าที่ · ลิงก์ไม่ใช่ http(s) 400 · ข้อความปุ่มว่าง 400 · นักศึกษาเห็นค่าที่ตั้ง (+ค่าเฉพาะหลักสูตร)", async () => {
    const body = { gradeSheetDescription: "ZA คำอธิบาย", gradeSheetUrl: "https://docs.google.com/spreadsheets/d/za", gradeSheetLinkText: "ZA ปุ่ม", uploadDescription: "ZA แนบไฟล์" };
    expect((await api(t.coopCS.token, "PUT", "/api/admin/config/gateway", body)).status).toBe(403);
    expect((await api(s.fresh.token, "PUT", "/api/admin/config/gateway", body)).status).toBe(403);
    expect((await api(staff.token, "PUT", "/api/admin/config/gateway", { ...body, gradeSheetUrl: "javascript:x" })).status).toBe(400);
    expect((await api(staff.token, "PUT", "/api/admin/config/gateway", { ...body, gradeSheetLinkText: "  " })).status).toBe(400);
    let r = await api(staff.token, "PUT", "/api/admin/config/gateway", body);
    expect(r.status, msg(r)).toBe(200);
    expect((await api(t.coopCS.token, "GET", "/api/admin/config/gateway")).body.data.gradeSheetLinkText).toBe("ZA ปุ่ม");
    r = await api(s.fresh.token, "GET", "/api/coop/config/gateway");
    expect(r.body.data).toMatchObject(body);
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
const SUBMIT = /ส่งคำร้องขอสหกิจศึกษา|ส่งแก้ไขคำร้อง|นอกช่วงเวลาการยื่นคำร้อง/;
const listPeriod = (page: Page) => page.locator("select", { has: page.locator("option", { hasText: "📚 ทุกปีการศึกษา" }) });

test.describe("G. หน้ายื่นคำร้อง (นักศึกษา)", () => {
  test("ไม่มีผู้ติดต่อ (HR): เตือน + กดส่งแล้วเตือน ไม่ส่ง · ยื่นครบ: กรอกตำแหน่ง แนบไฟล์ ลบไฟล์ที่เตรียม → ส่ง → รอพิจารณา", async ({ page }) => {
    await asUser(page, s.uiNoContact.token, s.uiNoContact.userId, "/student/gateway");
    await expect(page.getByText("ยังไม่ได้เลือกผู้ติดต่อ")).toBeVisible();
    await page.getByPlaceholder("เช่น Frontend Developer, System Analyst, Data Scientist...").fill("Tester");
    await page.getByRole("button", { name: SUBMIT }).click();
    await expect(page.getByText("กรุณาเลือกผู้ติดต่อ (HR) ของบริษัทที่หน้าข้อมูลนักศึกษาก่อนยื่นคำร้อง")).toBeVisible();
    expect((await coopOf("uiNoContact")).status).toBe("NOT_SUBMITTED");

    await asUser(page, s.uiNew.token, s.uiNew.userId, "/student/gateway");
    await expect(page.getByText("กำลังเปิดรับสมัครคำร้องสหกิจศึกษา")).toBeVisible();
    await expect(page.getByText(company.name).first()).toBeVisible();
    await page.getByRole("button", { name: "🚀 ส่งคำร้องขอสหกิจศึกษา" }).click();
    await expect(page.getByText("กรุณาอัปโหลดเอกสารประกอบอย่างน้อย 1 ไฟล์")).toBeVisible();
    await page.getByPlaceholder("เช่น Frontend Developer, System Analyst, Data Scientist...").fill("QA Engineer");
    const file = page.locator('input[type="file"]');
    await file.setInputFiles([{ name: "ใบคำร้อง.pdf", mimeType: "application/pdf", buffer: PDF }, { name: "ทิ้ง.pdf", mimeType: "application/pdf", buffer: PDF }]);
    await expect(page.getByText("📄 ทิ้ง.pdf")).toBeVisible();
    await page.locator("li", { hasText: "ทิ้ง.pdf" }).getByRole("button", { name: "ลบไฟล์ ✕" }).click();
    await expect(page.getByText("📄 ทิ้ง.pdf")).toHaveCount(0);
    await page.getByPlaceholder("https://docs.google.com/spreadsheets/d/...").fill("https://docs.google.com/spreadsheets/d/ui");
    await page.getByRole("button", { name: "🚀 ส่งคำร้องขอสหกิจศึกษา" }).click();
    await expect(page.getByText("ส่งคำร้องเรียบร้อยแล้ว สถานะ: รออาจารย์ตรวจสอบ")).toBeVisible();
    await expect.poll(async () => (await coopOf("uiNew")).status).toBe("APPLYING");
    expect((await k.docs(s.uiNew.pk, "APPLICATION_DOC")).map((d: { name: string }) => d.name)).toEqual(["ใบคำร้อง.pdf"]);
    await expect(page.getByPlaceholder("เช่น Frontend Developer, System Analyst, Data Scientist...")).toBeDisabled();
  });

  test("ส่งกลับแก้ไข: เห็นสิ่งที่ต้องแก้ + ปุ่ม \"ส่งแก้ไขคำร้อง\" · (ใหม่) แก้เอกสาร T000: แก้คำร้อง/ลบไฟล์ไม่ได้ (ไม่มีปุ่มที่กดแล้ว 409)", async ({ page }) => {
    await asUser(page, s.uiEdits.token, s.uiEdits.userId, "/student/gateway");
    await expect(page.getByText("ZA แนบทรานสคริปต์ฉบับล่าสุด")).toBeVisible();
    await expect(page.getByRole("button", { name: "📤 ส่งแก้ไขคำร้อง" })).toBeEnabled();

    await asUser(page, s.uiT000.token, s.uiT000.userId, "/student/gateway");
    await expect(page.getByRole("button", { name: SUBMIT })).toBeDisabled();
    await expect(page.getByRole("button", { name: "ลบไฟล์ ✕" })).toHaveCount(0);
    await expect(page.getByPlaceholder("เช่น Frontend Developer, System Analyst, Data Scientist...")).toBeDisabled();
  });
});

test.describe("H. หน้าพิจารณาคำร้อง (อาจารย์ที่ปรึกษา)", () => {
  test("ค้นหา → พิจารณา → ไม่ผ่านโดยไม่มีเหตุผลถูกเตือน → ส่งกลับแก้ไขพร้อมเหตุผล · (ใหม่) คำร้องที่พิจารณาแล้วไม่มีปุ่มผล", async ({ page }) => {
    await asUser(page, t.adv.token, t.adv.userId, "/teacher/requests");
    await listPeriod(page).selectOption("all");
    const search = page.getByPlaceholder("🔍 ค้นหารหัสนักศึกษา, ชื่อ, หรือบริษัท...");
    await search.fill(s.uiTeach.studentId);
    await page.locator("tr", { hasText: s.uiTeach.studentId }).getByRole("button", { name: "พิจารณา" }).click();
    await page.getByRole("button", { name: "❌ ไม่ผ่าน" }).click();
    await expect(page.getByText("กรุณาระบุเหตุผล/ข้อความก่อนส่งกลับ")).toBeVisible();
    await page.getByPlaceholder("ระบุสิ่งที่ต้องแก้ไข...").fill("ZA ขอใบรับรองผลการเรียน");
    await page.getByRole("button", { name: "⚠️ ส่งกลับแก้ไข" }).click();
    await page.getByRole("button", { name: "ยืนยัน", exact: true }).click();
    await expect.poll(async () => { const c = await coopOf("uiTeach"); return [c.status, c.teacherCheckComment]; }).toEqual(["APPLICATION_EDITS_REQUIRED", "ZA ขอใบรับรองผลการเรียน"]);

    await page.keyboard.press("Escape");
    await search.fill(s.uiTeachDone.studentId);
    await page.locator("tr", { hasText: s.uiTeachDone.studentId }).getByRole("button", { name: "พิจารณา" }).click();
    await expect(page.getByText("คำร้องนี้พิจารณาแล้ว")).toBeVisible();
    await expect(page.getByRole("button", { name: "✅ อนุมัติผ่านเกณฑ์" })).toHaveCount(0);
  });
});

test.describe("I. หน้าตรวจคำร้อง (เจ้าหน้าที่)", () => {
  test("ตรวจคำร้อง: (ใหม่) ไม่ผ่านต้องมีเหตุผล · รอพิจารณาเกรด → ผ่านเกณฑ์ · (ใหม่) ส่ง T000 แล้วขึ้นว่าเปลี่ยนผลไม่ได้", async ({ page }) => {
    await asUser(page, staff.token, staff.userId, "/admin/coop-applications");
    await listPeriod(page).selectOption("all");
    const search = page.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท...");
    await search.fill(s.uiStaff.studentId);
    const rowOf = (key: string) => page.locator("tr", { hasText: s[key].studentId });
    await rowOf("uiStaff").getByRole("button", { name: "🔍 ตรวจคำร้อง" }).click();
    await page.getByRole("button", { name: "❌ ไม่ผ่าน" }).click();
    await expect(page.getByText("กรุณาระบุเหตุผลที่ไม่ผ่าน เพื่อให้นักศึกษาทราบ")).toBeVisible();
    await page.getByRole("button", { name: "📊 รอพิจารณาเกรด" }).click();
    await page.getByRole("button", { name: "ยืนยัน", exact: true }).click();
    await expect.poll(async () => (await coopOf("uiStaff")).status).toBe("PENDING_GRADE");

    await search.fill(s.uiStaff.studentId);
    await rowOf("uiStaff").getByRole("button", { name: /ตรวจคำร้อง|ดูคำร้อง/ }).click();
    await page.getByRole("button", { name: "✅ คำร้องผ่านเกณฑ์" }).click();
    await page.getByRole("button", { name: "ยืนยัน", exact: true }).click();
    await expect.poll(async () => (await coopOf("uiStaff")).status).toBe("QUALIFIED");

    await search.fill(s.uiStaffW.studentId);
    await rowOf("uiStaffW").getByRole("button", { name: "📄 ดูคำร้อง" }).click();
    await expect(page.getByText("นักศึกษาส่งเอกสาร T000 แล้ว — เปลี่ยนผลคำร้องไม่ได้")).toBeVisible();
    await expect(page.getByRole("button", { name: "❌ ไม่ผ่าน" })).toHaveCount(0);
  });

  test("ตั้งค่าหน้ายื่นคำร้อง: ลิงก์ผิดถูกเตือน · บันทึกแล้วนักศึกษาเห็นข้อความใหม่", async ({ page }) => {
    await asUser(page, staff.token, staff.userId, "/admin/gateway-settings");
    await page.getByPlaceholder("https://docs.google.com/spreadsheets/d/...").fill("ftp://bad");
    await page.getByRole("button", { name: "💾 บันทึก" }).click();
    await expect(page.getByText("URL แบบฟอร์มต้องขึ้นต้นด้วย https:// หรือ http:// เท่านั้น")).toBeVisible();
    await page.getByPlaceholder("https://docs.google.com/spreadsheets/d/...").fill("https://docs.google.com/spreadsheets/d/za-ui");
    await page.getByPlaceholder("เช่น 📋 Make a Copy แบบฟอร์ม").fill("ZA ปุ่มจากหน้าเว็บ");
    await page.getByRole("button", { name: "💾 บันทึก" }).click();
    await expect(page.getByText("บันทึกการตั้งค่าเรียบร้อยแล้ว")).toBeVisible();
    await asUser(page, s.uiNoContact.token, s.uiNoContact.userId, "/student/gateway");
    await expect(page.getByRole("link", { name: "ZA ปุ่มจากหน้าเว็บ" })).toHaveAttribute("href", "https://docs.google.com/spreadsheets/d/za-ui");
  });
});
