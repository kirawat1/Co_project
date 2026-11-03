/**
 * tests/intern.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * ช่วงฝึกงาน: T002 / T003 / นัดนิเทศ — กรณีข้างทางที่ coop-lifecycle (ทางปกติ) ไม่ได้เดิน
 * backend + DB จริง (ข้อมูลจาก helpers/internWorld.ts ลบทิ้งตอนจบ) · ต้องรัน backend ที่ :5000 และ frontend ที่ :5173
 *
 * บั๊กที่เคยเจอ (ล็อกไว้ไม่ให้กลับมา):
 *   - อนุมัติ T002 ดึงสถานะย้อนกลับไป "เริ่มฝึกงาน" · ลบ T002/T003 ระหว่างตรวจได้ · ส่ง T003 ข้าม T002 (เดิม — ตอนนี้ส่งได้ทุกลำดับ ดู A)
 *   - นัดนิเทศก่อนออกฝึก / ตอนระบบปิด / เสนอวันในอดีต · แก้นัดหลังอาจารย์ยืนยันแล้ว
 *   - ยืนยันวันชนคิวอาจารย์คนเดียวกัน · อาจารย์ร่วมไม่ว่างต้องเตือนก่อน · เสนอวันใหม่ต้องล้างวันว่างของอาจารย์ร่วม
 *   - ยืนยันแบบกลุ่ม: คิวเรียงตามลำดับที่ส่ง ต่อกันไม่ทับ
 *   - (รอบนี้) ป้ายเมนู T002 นับ T002 ที่ตรวจผ่านแล้วเป็นงานค้าง · แก้วัน/เปลี่ยนอาจารย์ร่วม/ออกร่างเลขอื่นระหว่างหนังสือขอนิเทศรอลงนาม
 *     · ยืนยันวันที่นักศึกษาไม่ได้เสนอ · เสนอ 0 วัน / เวลากลับหัว / ออนไลน์ไม่มีลิงก์ ผ่าน API ได้
 */
import { test, expect, type Page } from "@playwright/test";
import { api } from "./helpers/letterWorld";
import { InternWorld, day, at } from "./helpers/internWorld";

const w = new InternWorld();
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน (cd backend && npm run dev)");
  await w.setup();
});
test.afterAll(async () => { await w.cleanup(); await w.disconnect(); });

const PDF = Buffer.from("%PDF-1.4\nintern e2e\n%%EOF");
const st = (key: string) => w.s[key].token;
const pk = (key: string) => w.s[key].pk;
const staff = () => w.staff.token;
const msg = (r: { body: any }) => JSON.stringify(r.body);
function form(fields: Record<string, string | number>, fileField: string, name = "file.pdf") {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
  fd.append(fileField, new Blob([PDF], { type: "application/pdf" }), name);
  return fd;
}
const upload = (key: string, docType: string) => api(st(key), "POST", "/api/docs/upload", form({ docType }, "files"));
const pending = async (token = staff()) => (await api(token, "GET", "/api/notifications/pending")).body.pending;
const propose = (key: string, dates: string[], extra: object = {}) =>
  api(st(key), "POST", "/api/coop/supervision/propose", { proposedDates: JSON.stringify(dates), supervisionType: "ONSITE", ...extra });
const review = (token: string, id: number, body: object) => api(token, "PUT", `/api/teacher/supervisions/${id}/review`, body);
const supPending = (id: number, body: object) => api(staff(), "PUT", `/api/admin/supervisions/${id}/letter-pending`, body);
const no = (n: number) => `ZI${w.tail}.26/${n}`;

// ══════════════════════════════════════════════════════
// A. T002 / T003 คู่ขนาน — สถานะหลักคงที่ที่ INTERNSHIP_STARTED · สถานะรองต่อฟอร์มอ่านจากไฟล์ล่าสุด
// ══════════════════════════════════════════════════════
const rev2 = (token: string, who: "admin" | "teacher", form: "t002" | "t003", key: string, status: string, comment?: string) =>
  api(token, "PUT", `/api/${who}/documents/review-${form}`, { studentId: pk(key), status, comment });
const OK2 = "T002_SUBMITTED", BAD2 = "T002_EDITS_REQUIRED", OK3 = "T003_APPROVED", BAD3 = "T003_EDITS_REQUIRED";

test.describe("A. T002 / T003 คู่ขนาน", () => {
  test("ส่ง T003 ก่อน T002 ได้ · ทั้งคู่รอตรวจ สถานะหลักไม่เปลี่ยน · ป้ายเมนูนับแยกกัน · ส่งซ้ำตอนรอตรวจ 400 · ลบตอนรอตรวจ 409", async () => {
    const b0 = await pending();
    let r = await upload("t2", "T003_FORM");
    expect(r.status, msg(r)).toBe(200);
    expect((await w.coop("t2")).status).toBe("INTERNSHIP_STARTED");
    expect((await w.doc("t2", "T003_FORM"))!.status).toBe("WAITING");
    const b1 = await pending();
    expect([b1.t002, b1.t003]).toEqual([b0.t002, b0.t003 + 1]); // T003 +1 · T002 ไม่ขยับ

    r = await upload("t2", "T002_FORM");
    expect(r.status, msg(r)).toBe(200);
    expect((await w.coop("t2")).status).toBe("INTERNSHIP_STARTED");
    expect((await w.doc("t2", "T002_FORM"))!.status).toBe("WAITING");
    const b2 = await pending();
    expect([b2.t002, b2.t003]).toEqual([b1.t002 + 1, b1.t003]);

    expect((await upload("t2", "T002_FORM")).status).toBe(400);
    expect((await upload("t2", "T003_FORM")).status).toBe(400);
    const t002 = (await w.doc("t2", "T002_FORM"))!;
    expect((await api(st("t2"), "DELETE", `/api/docs/delete/${t002.id}`)).status).toBe(409);
  });

  test("ตีกลับ T002 (ต้องมีเหตุผล) → T003 ไม่เปลี่ยน · สถานะหลักไม่เปลี่ยน · ตีกลับซ้ำ 400 · ส่ง T002 ใหม่ → รอตรวจ", async () => {
    expect((await rev2(staff(), "admin", "t002", "t2", BAD2)).status).toBe(400); // ไม่มีเหตุผล
    expect((await w.doc("t2", "T002_FORM"))!.status).toBe("WAITING");

    const b0 = await pending();
    let r = await rev2(staff(), "admin", "t002", "t2", BAD2, "แก้ข้อ 3");
    expect(r.status, msg(r)).toBe(200);
    expect((await w.coop("t2")).status).toBe("INTERNSHIP_STARTED");
    expect((await w.doc("t2", "T002_FORM"))!.status).toBe("REJECTED");
    expect((await w.doc("t2", "T003_FORM"))!.status).toBe("WAITING");
    const b1 = await pending();
    expect([b1.t002, b1.t003]).toEqual([b0.t002 - 1, b0.t003]);
    await expect.poll(async () => (await w.notes("t2", "T002_REVIEWED")).length).toBeGreaterThan(0);
    expect((await rev2(staff(), "admin", "t002", "t2", BAD2, "อีกที")).status).toBe(400); // ตีกลับแล้ว
    expect((await rev2(staff(), "admin", "t002", "t2", OK2)).status).toBe(400);

    r = await upload("t2", "T002_FORM");
    expect(r.status, msg(r)).toBe(200);
    expect((await w.coop("t2")).status).toBe("INTERNSHIP_STARTED");
    expect((await w.doc("t2", "T002_FORM"))!.status).toBe("WAITING");
    expect((await pending()).t002).toBe(b0.t002);
  });

  test("นัดนิเทศระหว่างที่ฟอร์มค้างตรวจได้ · อาจารย์อื่นตรวจไม่ได้ · อนุมัติทั้งคู่ (ที่ปรึกษา + เจ้าหน้าที่) → สถานะหลักไม่ถอย · ป้ายลดแยกกัน", async () => {
    const r0 = await propose("t2", [`${day(30)}|10:00-12:00|ONSITE`]);
    expect(r0.status, msg(r0)).toBe(200);

    expect((await rev2(w.t.other.token, "teacher", "t002", "t2", OK2)).status).toBe(403);
    const b0 = await pending();
    let r = await rev2(w.t.main.token, "teacher", "t002", "t2", OK2);
    expect(r.status, msg(r)).toBe(200);
    expect((await w.doc("t2", "T002_FORM"))!.status).toBe("APPROVED");
    expect((await w.doc("t2", "T003_FORM"))!.status).toBe("WAITING");
    const b1 = await pending();
    expect([b1.t002, b1.t003]).toEqual([b0.t002 - 1, b0.t003]);

    r = await rev2(staff(), "admin", "t003", "t2", OK3);
    expect(r.status, msg(r)).toBe(200);
    expect((await w.doc("t2", "T003_FORM"))!.status).toBe("APPROVED");
    expect((await w.coop("t2")).status).toBe("INTERNSHIP_STARTED");
    const b2 = await pending();
    expect([b2.t002, b2.t003]).toEqual([b0.t002 - 1, b0.t003 - 1]);
  });

  test("ไฟล์ที่ผ่านแล้ว: อนุมัติซ้ำ 400 · ส่ง/ลบไม่ได้ · ตีกลับ T003 ที่ผ่านแล้วได้ (ต้องมีเหตุผล) → ส่งใหม่ → อนุมัติ", async () => {
    expect((await rev2(staff(), "admin", "t003", "t2", OK3)).status).toBe(400);
    expect((await rev2(staff(), "admin", "t002", "t2", OK2)).status).toBe(400);
    expect((await upload("t2", "T003_FORM")).status).toBe(400);
    const t003 = (await w.doc("t2", "T003_FORM"))!;
    expect((await api(st("t2"), "DELETE", `/api/docs/delete/${t003.id}`)).status).toBe(409);

    expect((await rev2(staff(), "admin", "t003", "t2", BAD3)).status).toBe(400); // ไม่มีเหตุผล
    let r = await rev2(staff(), "admin", "t003", "t2", BAD3, "แผนงานไม่ครบ");
    expect(r.status, msg(r)).toBe(200);
    expect((await w.doc("t2", "T003_FORM"))!.status).toBe("REJECTED");
    expect((await w.doc("t2", "T002_FORM"))!.status).toBe("APPROVED"); // อีกฟอร์มไม่กระทบ
    expect((await w.coop("t2")).status).toBe("INTERNSHIP_STARTED");

    const b0 = await pending();
    r = await upload("t2", "T003_FORM");
    expect(r.status, msg(r)).toBe(200);
    expect((await pending()).t003).toBe(b0.t003 + 1);
    r = await rev2(staff(), "admin", "t003", "t2", OK3);
    expect(r.status, msg(r)).toBe(200);
    expect((await w.doc("t2", "T003_FORM"))!.status).toBe("APPROVED");
    expect((await w.coop("t2")).status).toBe("INTERNSHIP_STARTED");
  });

  test("ลบไฟล์: เฉพาะที่ถูกตีกลับ (T002) · รอตรวจ (T003) ลบไม่ได้ 409", async () => {
    const t002 = (await w.doc("del", "T002_FORM"))!, t003 = (await w.doc("del", "T003_FORM"))!;
    expect((await api(st("del"), "DELETE", `/api/docs/delete/${t003.id}`)).status).toBe(409);
    const r = await api(st("del"), "DELETE", `/api/docs/delete/${t002.id}`);
    expect(r.status, msg(r)).toBe(200);
    expect(await w.doc("del", "T002_FORM")).toBeNull();
  });

  test("กำหนดส่ง: ส่งครั้งแรกหลังกำหนด 403 · ถูกตีกลับแล้วส่งใหม่หลังกำหนดได้ (สถานะหลักไม่เปลี่ยน)", async () => {
    let r = await upload("closed", "T002_FORM");
    expect(r.status, msg(r)).toBe(403);
    r = await upload("t2late", "T002_FORM");
    expect(r.status, msg(r)).toBe(200);
    expect((await w.coop("t2late")).status).toBe("INTERNSHIP_STARTED");
    expect((await w.doc("t2late", "T002_FORM"))!.status).toBe("WAITING");
  });

  test("ค่าสถานะหลักแบบเก่า (T003_SUBMITTED + T002 รอตรวจ): ขึ้นในรายการ/ป้าย · ตรวจได้ · สถานะหลักไม่ถูกแตะ", async () => {
    const b0 = await pending();
    const periodPending = async () => (await api(staff(), "GET", "/api/admin/students?review=T002&countsOnly=1")).body.periods.find((p: any) => p.coopPeriodId === w.openPeriodId).pending;
    const listed = async () => {
      const l = await api(staff(), "GET", `/api/students?coopPeriodId=${w.openPeriodId}&search=${w.s.legacy.studentId}`);
      return (Array.isArray(l.body) ? l.body : l.body.data).find((s: any) => s.studentId === w.s.legacy.studentId);
    };
    const row = await listed();
    expect(row, "นักศึกษาสถานะเก่าต้องอยู่ในรายการของรอบ").toBeTruthy();
    expect(row.coop.status).toBe("T003_SUBMITTED");
    expect(row.documents.find((d: any) => d.type === "T002_FORM")?.status).toBe("WAITING");
    const c0 = await periodPending();

    let r = await rev2(staff(), "admin", "t002", "legacy", BAD2, "ลายเซ็นไม่ชัด");
    expect(r.status, msg(r)).toBe(200);
    expect((await w.doc("legacy", "T002_FORM"))!.status).toBe("REJECTED");
    expect((await w.coop("legacy")).status).toBe("T003_SUBMITTED");
    expect((await pending()).t002).toBe(b0.t002 - 1);
    expect(await periodPending()).toBe(c0 - 1);

    r = await upload("legacy", "T002_FORM");
    expect(r.status, msg(r)).toBe(200);
    expect((await pending()).t002).toBe(b0.t002);
    expect(await periodPending()).toBe(c0);
    r = await rev2(w.t.main.token, "teacher", "t002", "legacy", OK2);
    expect(r.status, msg(r)).toBe(200);
    expect((await w.doc("legacy", "T002_FORM"))!.status).toBe("APPROVED");
    expect((await w.coop("legacy")).status).toBe("T003_SUBMITTED");
    expect((await pending()).t002).toBe(b0.t002 - 1);
    expect(await periodPending()).toBe(c0 - 1);
  });
});

// ══════════════════════════════════════════════════════
// B. เสนอวันนิเทศ — ด่านของนักศึกษา
// ══════════════════════════════════════════════════════
test.describe("B. นักศึกษาเสนอวันนิเทศ", () => {
  test("ยังไม่ออกฝึก 403 · รอบปิดนัด 403 · วันในอดีต 400 · เกิน 30 ตัวเลือก 400", async () => {
    expect((await propose("notYet", [`${day(10)}|10:00-12:00|ONSITE`])).status).toBe(403);
    expect((await propose("closed", [`${day(10)}|10:00-12:00|ONSITE`])).status).toBe(403);
    expect((await propose("sup", [`${day(-1)}|10:00-12:00|ONSITE`])).status).toBe(400);
    expect((await propose("sup", Array.from({ length: 31 }, (_, i) => `${day(10 + i)}|10:00-11:00|ONSITE`))).status).toBe(400);
    expect(await w.supervision("sup")).toBeNull();
  });

  test("ด่านที่หน้าเว็บกัน (เดิมผ่าน API ได้): 0 วัน · เวลาเริ่ม ≥ เวลาจบ · ออนไลน์ไม่มีลิงก์ · ส่งเป็นรายการแทนข้อความ", async () => {
    const results = [
      await propose("sup", []),
      await propose("sup", [`${day(10)}|14:00-13:00|ONSITE`]),
      await propose("sup", [`${day(10)}|10:00-11:00|ONLINE`], { supervisionType: "ONLINE" }),
      await api(st("sup"), "POST", "/api/coop/supervision/propose", { proposedDates: [`${day(10)}|10:00-11:00|ONSITE`], supervisionType: "ONSITE" }),
    ];
    expect(results.map((r) => r.status)).toEqual([400, 400, 400, 400]);
    expect(await w.supervision("sup")).toBeNull();
  });
});

// ══════════════════════════════════════════════════════
// C. นัดนิเทศครบวง — อาจารย์ร่วม · ยืนยัน · หนังสือ · จบนิเทศ
// ══════════════════════════════════════════════════════
test.describe("C. นัดนิเทศครบวง", () => {
  const D1 = day(15), D2 = day(16);
  let id = 0;

  test("เสนอ 2 วัน → รออาจารย์ · ป้ายอาจารย์หลัก +1 · มอบหมายอาจารย์ร่วม → ระบุวันว่าง (วันที่ไม่ได้เสนอ 400)", async () => {
    const before = (await pending(w.t.main.token)).teacherSupervision;
    let r = await propose("sup", [`${D1}|10:00-12:00|ONSITE`, `${D2}|13:00-14:00|ONSITE`]);
    expect(r.status, msg(r)).toBe(200);
    id = r.body.appointment.id;
    expect((await w.supervision("sup"))!.status).toBe("PENDING_TEACHER");
    expect((await pending(w.t.main.token)).teacherSupervision).toBe(before + 1);

    r = await api(staff(), "PUT", `/api/admin/supervisions/${id}/co-teachers`, { coTeacherIds: [w.t.co.pk] });
    expect(r.status, msg(r)).toBe(200);
    expect((await pending(w.t.co.token)).teacherSupervision).toBe(1);
    r = await api(w.t.co.token, "PUT", `/api/teacher/supervisions/${id}/availability`, { availableDates: [day(17)] });
    expect(r.status, msg(r)).toBe(400);
    r = await api(w.t.co.token, "PUT", `/api/teacher/supervisions/${id}/availability`, { availableDates: [D2] });
    expect(r.status, msg(r)).toBe(200);
    expect((await pending(w.t.co.token)).teacherSupervision).toBe(0);
  });

  test("อาจารย์อื่น 403 · วันที่ไม่ได้เสนอ 400 · อาจารย์ร่วมไม่ว่าง 409 → ยืนยันซ้ำได้ · นักศึกษาแก้นัดหลังยืนยันไม่ได้", async () => {
    expect((await review(w.t.other.token, id, { action: "APPROVE", confirmedDate: at(D1, "10:00") })).status).toBe(403);
    let r = await review(w.t.main.token, id, { action: "APPROVE", confirmedDate: at(day(17), "10:00") });
    expect(r.status, msg(r)).toBe(400);
    r = await review(w.t.main.token, id, { action: "APPROVE", confirmedDate: at(D1, "10:00") });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("CO_TEACHER_UNAVAILABLE");
    expect((await w.supervision("sup"))!.status).toBe("PENDING_TEACHER");
    r = await review(w.t.main.token, id, { action: "APPROVE", confirmedDate: at(D1, "10:00"), acknowledgeUnavailable: true });
    expect(r.status, msg(r)).toBe(200);
    const a = (await w.supervision("sup"))!;
    expect(a.status).toBe("DATE_CONFIRMED");
    expect(new Date(a.confirmedEndDate!).toISOString()).toBe(at(D1, "12:00")); // ความยาวคิวจากช่วงที่เสนอ
    await expect.poll(async () => (await w.notes("sup", "SUPERVISION_DATE_UPDATED")).length).toBeGreaterThan(0);

    expect((await propose("sup", [`${D2}|13:00-14:00|ONSITE`])).status).toBe(403);
  });

  test("รอลงนาม: แก้วัน 409 · เปลี่ยนอาจารย์ร่วม 409 · ออกร่างเลขอื่น 409 · เลขเดิมได้ · ยกเลิกแล้วแก้วันได้", async () => {
    let r = await supPending(id, { docNumber: no(1), docDate: day(0) });
    expect(r.status, msg(r)).toBe(200);
    const moved = at(D1, "13:00");

    r = await api(staff(), "PUT", `/api/admin/supervisions/${id}/confirmed-date`, { confirmedDate: moved });
    expect(r.status, msg(r)).toBe(409);
    expect(r.body.message).toMatch(/ยกเลิกรอลงนาม/);
    r = await api(staff(), "PUT", `/api/admin/supervisions/${id}/co-teachers`, { coTeacherIds: [] });
    expect(r.status, msg(r)).toBe(409);
    expect((await supPending(id, { docNumber: no(2), docDate: day(0) })).status).toBe(409);
    expect((await supPending(id, { docNumber: no(1), docDate: day(0) })).status).toBe(200);
    let a = (await w.supervision("sup"))!;
    expect([new Date(a.confirmedDate!).toISOString(), a.coTeachers.length, a.letterDraftNumber]).toEqual([at(D1, "10:00"), 1, no(1)]);

    expect((await supPending(id, { cancel: true })).status).toBe(200);
    r = await api(staff(), "PUT", `/api/admin/supervisions/${id}/confirmed-date`, { confirmedDate: moved });
    expect(r.status, msg(r)).toBe(200);
    a = (await w.supervision("sup"))!;
    expect(new Date(a.confirmedDate!).toISOString()).toBe(moved);
    expect(new Date(a.confirmedEndDate!).toISOString()).toBe(at(D1, "15:00")); // ย้ายแล้วคิวยาวเท่าเดิม (2 ชม.)
  });

  test("อัปโหลดฉบับลงนาม → ออกหนังสือแล้ว · แก้วัน 400 · จบนิเทศ: อาจารย์อื่น 403 · ที่ปรึกษาได้ · ซ้ำ 400", async () => {
    let r = await api(staff(), "POST", `/api/admin/supervisions/${id}/upload-letter`, form({ docNumber: no(3), docDate: day(0) }, "file", "signed.pdf"));
    expect(r.status, msg(r)).toBe(200);
    expect((await w.supervision("sup"))!.status).toBe("LETTER_UPLOADED");
    expect((await api(staff(), "PUT", `/api/admin/supervisions/${id}/confirmed-date`, { confirmedDate: at(D2, "10:00") })).status).toBe(400);

    expect((await api(w.t.other.token, "PUT", `/api/teacher/supervisions/${id}/complete`)).status).toBe(403);
    r = await api(w.t.main.token, "PUT", `/api/teacher/supervisions/${id}/complete`);
    expect(r.status, msg(r)).toBe(200);
    expect((await w.supervision("sup"))!.status).toBe("COMPLETED");
    expect((await api(w.t.main.token, "PUT", `/api/teacher/supervisions/${id}/complete`)).status).toBe(400);
  });
});

// ══════════════════════════════════════════════════════
// D. ปฏิเสธ → เสนอใหม่ · คิวชน · ยืนยันแบบกลุ่ม
// ══════════════════════════════════════════════════════
test.describe("D. ปฏิเสธ / คิวชน / กลุ่ม", () => {
  test("ปฏิเสธ → แจ้งนักศึกษา · เสนอใหม่ → รออาจารย์ + ล้างวันว่างที่อาจารย์ร่วมตอบไว้", async () => {
    let r = await propose("rej", [`${day(20)}|09:00-10:00|ONSITE`]);
    expect(r.status, msg(r)).toBe(200);
    const id = r.body.appointment.id;
    expect((await api(staff(), "PUT", `/api/admin/supervisions/${id}/co-teachers`, { coTeacherIds: [w.t.co.pk] })).status).toBe(200);
    expect((await api(w.t.co.token, "PUT", `/api/teacher/supervisions/${id}/availability`, { availableDates: [day(20)] })).status).toBe(200);

    r = await review(w.t.main.token, id, { action: "REJECT", rejectReason: "วันนั้นติดสอน" });
    expect(r.status, msg(r)).toBe(200);
    let a = (await w.supervision("rej"))!;
    expect([a.status, a.rejectReason]).toEqual(["TEACHER_REJECTED", "วันนั้นติดสอน"]);
    await expect.poll(async () => (await w.notes("rej", "SUPERVISION_DATE_UPDATED")).map((n: any) => n.title).join()).toMatch(/ปฏิเสธ/);

    r = await propose("rej", [`${day(21)}|09:00-10:00|ONSITE`]);
    expect(r.status, msg(r)).toBe(200);
    a = (await w.supervision("rej"))!;
    expect([a.status, a.rejectReason]).toEqual(["PENDING_TEACHER", null]);
    expect(a.coTeachers.map((c: any) => [c.availableDates, c.respondedAt])).toEqual([[null, null]]);
  });

  test("เวลาทับคิวที่ยืนยันแล้วของอาจารย์คนเดียวกัน → 409 · ต่อคิวพอดีได้", async () => {
    let r = await propose("clashY", [`${day(12)}|11:00-12:00|ONSITE`, `${day(12)}|12:00-13:00|ONSITE`]);
    expect(r.status, msg(r)).toBe(200);
    const id = r.body.appointment.id;
    r = await review(w.t.main.token, id, { action: "APPROVE", confirmedDate: at(day(12), "11:00") });
    expect(r.status, msg(r)).toBe(409);
    r = await review(w.t.main.token, id, { action: "APPROVE", confirmedDate: at(day(12), "12:00") });
    expect(r.status, msg(r)).toBe(200);
  });

  test("ยืนยันแบบกลุ่ม: คิวเรียงตามลำดับที่ส่ง ต่อกันไม่ทับ กลุ่มเดียวกัน · วันที่บางคนไม่ได้เสนอ 400", async () => {
    const D = day(25);
    const p = (await propose("gP", [`${D}|09:00-10:00|ONSITE`])).body.appointment.id;
    const q = (await propose("gQ", [`${D}|09:00-10:00|ONSITE`, `${day(26)}|09:00-10:00|ONSITE`])).body.appointment.id;
    let r = await api(w.t.main.token, "POST", "/api/teacher/supervisions/confirm-group", { appointmentIds: [q, p], confirmedDate: at(day(26), "09:00") });
    expect(r.status, msg(r)).toBe(400);
    r = await api(w.t.main.token, "POST", "/api/teacher/supervisions/confirm-group", { appointmentIds: [q, p], confirmedDate: at(D, "09:00") });
    expect(r.status, msg(r)).toBe(200);
    const [aq, ap] = [(await w.supervision("gQ"))!, (await w.supervision("gP"))!];
    expect([new Date(aq.confirmedDate!).toISOString(), new Date(ap.confirmedDate!).toISOString()]).toEqual([at(D, "09:00"), at(D, "10:00")]);
    expect(aq.groupId).toBeTruthy();
    expect(ap.groupId).toBe(aq.groupId);
  });
});

// ══════════════════════════════════════════════════════
// E. หน้าเว็บจริง
// ══════════════════════════════════════════════════════
async function asUser(page: Page, token: string, userId: number) {
  await page.goto("/");
  await page.evaluate(([t, uid]) => {
    localStorage.clear();
    localStorage.setItem("coop.token", t); localStorage.setItem("coop.userId", uid); localStorage.setItem("coop.theme", "light");
  }, [token, String(userId)]);
}

test.describe("E. หน้าเว็บ", () => {
  test("จัดการการนิเทศ: รอลงนามอยู่ ปุ่ม \"แก้ไขวัน\" กดไม่ได้ (บอกเหตุผล) · ยกเลิกแล้วกดได้", async ({ page }) => {
    const id = (await w.supervision("clashY"))!.id;
    expect((await supPending(id, { docNumber: no(10), docDate: day(0) })).status).toBe(200);
    await asUser(page, staff(), w.staff.userId);
    await page.goto("/admin/supervision-manager", { waitUntil: "networkidle" });
    await page.locator("select", { has: page.locator('option[value="all"]', { hasText: "ทุกปีการศึกษา" }) }).first().selectOption(String(w.openPeriodId));
    await page.getByPlaceholder(/ค้นหา/).first().fill(w.s.clashY.studentId);
    const row = page.locator("tbody tr", { hasText: w.s.clashY.studentId });
    const edit = row.getByRole("button", { name: "✏️ แก้ไขวัน" });
    await expect(edit).toBeDisabled();
    await expect(edit).toHaveAttribute("title", /ยกเลิกรอลงนาม/);

    expect((await supPending(id, { cancel: true })).status).toBe(200);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("select", { has: page.locator('option[value="all"]', { hasText: "ทุกปีการศึกษา" }) }).first().selectOption(String(w.openPeriodId));
    await page.getByPlaceholder(/ค้นหา/).first().fill(w.s.clashY.studentId);
    await expect(page.locator("tbody tr", { hasText: w.s.clashY.studentId }).getByRole("button", { name: "✏️ แก้ไขวัน" })).toBeEnabled();
  });
});

test.describe("E2. หน้าเว็บ T002 / T003 คู่ขนาน", () => {
  test("นักศึกษา: หน้า T003 มีปุ่มส่งโดยไม่ต้องส่ง T002 · ป้ายสถานะหลัก \"ส่งเอกสารฝึกสหกิจ\"", async ({ page }) => {
    await asUser(page, st("uiNone"), w.s.uiNone.userId);
    await page.goto("/student/docs-t003", { waitUntil: "networkidle" });
    await expect(page.getByText("📂 เลือกไฟล์ T003 เพื่ออัปโหลด")).toBeVisible();
    await expect(page.getByText("🔒 ยังส่ง T003 ไม่ได้")).toHaveCount(0);
    await page.goto("/student/docs-t002", { waitUntil: "networkidle" });
    await expect(page.getByText("📂 เลือกไฟล์ T002 เพื่ออัปโหลด")).toBeVisible();
    await page.goto("/student/dashboard", { waitUntil: "networkidle" });
    await expect(page.getByText("ส่งเอกสารฝึกสหกิจ").first()).toBeVisible();
  });

  test("เจ้าหน้าที่: ไฟล์ T003 ที่ผ่านแล้วมีปุ่มตีกลับ แต่ไม่มีปุ่มอนุมัติ (มีกลุ่มควบคุม: ไฟล์รอตรวจมีปุ่มอนุมัติ)", async ({ page }) => {
    const openFor = async (key: string) => {
      await page.goto("/admin/doct003", { waitUntil: "networkidle" });
      await page.locator("select", { has: page.locator(`option[value="${w.openPeriodId}"]`) }).first().selectOption(String(w.openPeriodId));
      await page.getByPlaceholder(/ค้นหา/).first().fill(w.s[key].studentId);
      const row = page.locator("tbody tr", { hasText: w.s[key].studentId });
      return row;
    };
    await asUser(page, staff(), w.staff.userId);
    // กลุ่มควบคุม: T003 รอตรวจ → มีทั้งปุ่มอนุมัติ (ป้ายตรงตัวที่ใช้ตรวจด้านล่าง) และปุ่มตีกลับ
    let row = await openFor("del");
    await expect(row.getByText("รอตรวจ", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "🔍 พิจารณา" }).click();
    await expect(page.getByRole("button", { name: "✅ อนุมัติโครงร่างรายงาน" })).toBeVisible();
    await expect(page.getByRole("button", { name: "❌ ตีกลับให้แก้ไข" })).toBeVisible();

    row = await openFor("uiOk");
    await expect(row.getByText("ผ่าน", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "🔍 พิจารณา" }).click();
    await expect(page.getByRole("button", { name: "❌ ตีกลับให้แก้ไข" })).toBeVisible();
    await expect(page.getByRole("button", { name: "✅ อนุมัติโครงร่างรายงาน" })).toHaveCount(0);
  });
});
