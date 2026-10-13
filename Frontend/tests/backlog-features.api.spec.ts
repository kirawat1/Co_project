/**
 * backlog-features.api.spec.ts — ฟีเจอร์ backlog ที่ flow หลัก (coop-lifecycle) ไม่ครอบคลุม
 * ยิง backend จริง + DB จริง (ไม่เปิด browser) · ข้อมูลทั้งหมดสร้างใหม่และลบทิ้งใน afterAll (ดู helpers/backlogSeed.ts)
 *
 *   หนังสือรวม · กันเลขที่ซ้ำเมื่อออกพร้อมกัน · วันว่างอาจารย์นิเทศร่วม · ย้ายรอบ
 *   ปฏิทินนิเทศแยกหลักสูตร · zip หนังสือ · นำเข้า Excel ของอาจารย์ประจำวิชา
 */
import { test, expect } from "@playwright/test";
import { BacklogWorld, api, form, bkk, zipNames, prisma, XLSX, assertBackendUp } from "./helpers/backlogSeed";

const W = new BacklogWorld();
const docNo = (tag: string) => `660301.26.6.2/${W.stamp}${tag}`;

test.beforeAll(async () => {
  await assertBackendUp();
  await W.setup();
});
test.afterAll(async () => {
  await W.cleanup();
});

// ─────────────────────────────────────────────────────────────
test.describe("หนังสือรวม (ขอความอนุเคราะห์ / ส่งตัว)", () => {
  test("ออกรวม 2 คน → เลขที่/ไฟล์/batch เดียวกัน · คนนอกฉบับใช้เลขเดิมไม่ได้ · ออกเดี่ยวทีหลังหลุดจาก batch", async () => {
    const a = await W.student(W.A, "DOCS_APPROVED");
    const b = await W.student(W.A, "DOCS_APPROVED");
    const outsider = await W.student(W.A, "DOCS_APPROVED");
    const NUM = docNo("R1");

    let r = await api(W.staff.token, "PUT", "/api/admin/t000/letter-batch", form({ letter: "REQUEST", studentIds: JSON.stringify([a.id, b.id]), docNumber: NUM }, "batch.pdf"));
    expect(r.status, r.body?.message).toBe(200);
    const [ca, cb] = await Promise.all([a, b].map((s) => prisma.studentCoop.findUnique({ where: { studentId: s.id } })));
    expect(ca.reqDocNumber).toBe(NUM);
    expect(cb.reqDocNumber).toBe(NUM);
    expect(ca.reqLetterUrl).toBe(cb.reqLetterUrl);
    expect(ca.reqLetterBatch).toBeTruthy();
    expect(ca.reqLetterBatch).toBe(cb.reqLetterBatch);
    expect(ca.status).toBe("REQ_LETTER_ISSUED");

    r = await api(W.staff.token, "PUT", "/api/admin/t000/review", form({ studentId: outsider.id, status: "REQ_LETTER_ISSUED", docType: "DISPATCH_LETTER", reqDocNumber: NUM }, "s.pdf"));
    expect(r.status).toBe(409);

    // ออกเดี่ยวให้ a ด้วยเลขใหม่ → หลุดจากหนังสือรวม · ไฟล์รวมเดิมยังอยู่ให้ b
    r = await api(W.staff.token, "PUT", "/api/admin/t000/review", form({ studentId: a.id, status: "REQ_LETTER_ISSUED", docType: "DISPATCH_LETTER", reqDocNumber: docNo("R2") }, "s.pdf"));
    expect(r.status, r.body?.message).toBe(200);
    expect((await prisma.studentCoop.findUnique({ where: { studentId: a.id } })).reqLetterBatch).toBeNull();
    const bAfter = await prisma.studentCoop.findUnique({ where: { studentId: b.id } });
    expect(bAfter.reqLetterUrl).toBe(cb.reqLetterUrl);
  });

  test("คนละบริษัท → 400 · ส่งตัวรวมที่มีคนไม่มีวันฝึก → 400 บอกรหัส", async () => {
    const a = await W.student(W.A, "DOCS_APPROVED");
    const other = await W.student(W.A, "DOCS_APPROVED", { companyId: await W.company() });
    let r = await api(W.staff.token, "PUT", "/api/admin/t000/letter-batch", form({ letter: "REQUEST", studentIds: JSON.stringify([a.id, other.id]), docNumber: docNo("R3") }, "b.pdf"));
    expect(r.status).toBe(400);

    const dated = { actualStartDate: new Date("2026-11-01"), actualEndDate: new Date("2027-02-28") };
    const p1 = await W.student(W.A, "ACCEPTANCE_CHECKED", dated);
    const p2 = await W.student(W.A, "ACCEPTANCE_CHECKED");
    r = await api(W.staff.token, "PUT", "/api/admin/t000/letter-batch", form({ letter: "PLACEMENT", studentIds: JSON.stringify([p1.id, p2.id]), docNumber: docNo("P1") }, "b.pdf"));
    expect(r.status).toBe(400);
    expect(r.body.message).toContain(p2.studentId);
  });

  test("รอลงนามแบบรวม → เลขร่างเดียวกัน · คนนอกร่างใช้เลขร่างนั้นไม่ได้", async () => {
    const a = await W.student(W.A, "DOCS_APPROVED");
    const b = await W.student(W.A, "DOCS_APPROVED");
    const outsider = await W.student(W.A, "DOCS_APPROVED");
    const DRAFT = docNo("D1");
    let r = await api(W.staff.token, "PUT", "/api/admin/t000/letter-pending", { studentIds: [a.id, b.id], letter: "REQUEST", docNumber: DRAFT });
    expect(r.status, r.body?.message).toBe(200);
    const drafts = await prisma.studentCoop.findMany({ where: { studentId: { in: [a.id, b.id] } }, select: { reqLetterDraftNumber: true } });
    expect(drafts.map((d: any) => d.reqLetterDraftNumber)).toEqual([DRAFT, DRAFT]);
    r = await api(W.staff.token, "PUT", "/api/admin/t000/letter-pending", { studentId: outsider.id, letter: "REQUEST", docNumber: DRAFT });
    expect(r.status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────
test.describe("กันเลขที่ซ้ำเมื่อออกพร้อมกัน (DocNumberLock)", () => {
  test("หนังสือรวม 2 ฉบับ / ออกเดี่ยว vs รวม เลขเดียวกันพร้อมกัน → 200 หนึ่ง 409 หนึ่ง ทุกรอบ", async () => {
    const g1 = [await W.student(W.A, "DOCS_APPROVED"), await W.student(W.A, "DOCS_APPROVED")];
    const g2 = [await W.student(W.A, "DOCS_APPROVED"), await W.student(W.A, "DOCS_APPROVED")];
    const solo = await W.student(W.A, "DOCS_APPROVED");
    const all = [...g1, ...g2, solo].map((s) => s.id);
    for (let round = 0; round < 4; round++) {
      await prisma.studentCoop.updateMany({ where: { studentId: { in: all } }, data: { reqDocNumber: null, reqLetterUrl: null, reqLetterBatch: null, status: "DOCS_APPROVED" } });
      const NUM = docNo(`X${round}`);
      const batch = (g: typeof g1) => api(W.staff.token, "PUT", "/api/admin/t000/letter-batch", form({ letter: "REQUEST", studentIds: JSON.stringify(g.map((s) => s.id)), docNumber: NUM }, "b.pdf"));
      const single = () => api(W.staff.token, "PUT", "/api/admin/t000/review", form({ studentId: solo.id, status: "REQ_LETTER_ISSUED", docType: "DISPATCH_LETTER", reqDocNumber: NUM }, "s.pdf"));
      const results = await Promise.all(round % 2 ? [batch(g1), batch(g2)] : [batch(g1), single()]);
      expect(results.map((x) => x.status).sort(), `รอบ ${round + 1}`).toEqual([200, 409]);
      const holders = await prisma.studentCoop.count({ where: { reqDocNumber: NUM } });
      expect(holders).toBeLessThanOrEqual(2);
    }
  });

  test("หนังสือขอนิเทศ 2 นัดคนละกลุ่ม เลขเดียวกันพร้อมกัน → 200 หนึ่ง 409 หนึ่ง", async () => {
    const t = await W.teacher(W.A);
    const s1 = await W.student(W.A, "INTERNSHIP_STARTED");
    const s2 = await W.student(W.A, "INTERNSHIP_STARTED");
    const confirmed = { status: "DATE_CONFIRMED", confirmedDate: new Date(bkk("2026-12-14", "09:00")) };
    const a1 = await W.appointment(s1.id, t.id, confirmed);
    const a2 = await W.appointment(s2.id, t.id, confirmed);
    const NUM = docNo("V1");
    const up = (id: number) => api(W.staff.token, "POST", `/api/admin/supervisions/${id}/upload-letter`, form({ docNumber: NUM }, "v.pdf"));
    const results = await Promise.all([up(a1.id), up(a2.id)]);
    expect(results.map((x) => x.status).sort()).toEqual([200, 409]);
  });
});

// ─────────────────────────────────────────────────────────────
test.describe("วันว่างอาจารย์นิเทศร่วม", () => {
  const PROPOSED = ["2026-12-01|09:00-11:00|ONLINE", "2026-12-02|09:00-11:00|ONLINE", "2026-12-03|13:00-15:00|ONSITE"];

  test("สิทธิ์ · วันที่ไม่ได้เสนอ · เพิ่มอาจารย์ร่วมแล้ววันว่างเดิมอยู่ · เตือน 409 แล้วยืนยันซ้ำได้ · ยืนยันแล้วแก้ไม่ได้", async () => {
    const main = await W.teacher(W.A), co1 = await W.teacher(W.A), co2 = await W.teacher(W.A), other = await W.teacher(W.A);
    const s = await W.student(W.A, "INTERNSHIP_STARTED");
    const appt = await W.appointment(s.id, main.id, { status: "PENDING_TEACHER", proposedDates: JSON.stringify(PROPOSED) });

    // ใส่อาจารย์หลักซ้ำในรายชื่อ → ไม่นับเป็นอาจารย์ร่วม
    let r = await api(W.staff.token, "PUT", `/api/admin/supervisions/${appt.id}/co-teachers`, { coTeacherIds: [co1.id, main.id] });
    expect(r.status).toBe(200);
    expect((await prisma.supervisionCoTeacher.findMany({ where: { appointmentId: appt.id } })).map((c: any) => c.teacherId)).toEqual([co1.id]);

    expect((await api(other.token, "PUT", `/api/teacher/supervisions/${appt.id}/availability`, { availableDates: ["2026-12-01"] })).status).toBe(403);
    expect((await api(co1.token, "PUT", `/api/teacher/supervisions/${appt.id}/availability`, { availableDates: ["2026-12-05"] })).status).toBe(400);
    r = await api(co1.token, "PUT", `/api/teacher/supervisions/${appt.id}/availability`, { availableDates: ["2026-12-02", "2026-12-02"] });
    expect(r.status).toBe(200);

    await api(W.staff.token, "PUT", `/api/admin/supervisions/${appt.id}/co-teachers`, { coTeacherIds: [co1.id, co2.id] });
    const keep = await prisma.supervisionCoTeacher.findFirst({ where: { appointmentId: appt.id, teacherId: co1.id } });
    expect(JSON.parse(keep.availableDates)).toEqual(["2026-12-02"]);

    const approve = (extra = {}) => api(main.token, "PUT", `/api/teacher/supervisions/${appt.id}/review`, { action: "APPROVE", confirmedDate: bkk("2026-12-02", "09:00"), supervisionType: "ONLINE", ...extra });
    r = await approve();
    expect(r.status).toBe(409);
    expect(r.body.message).toContain("ยังไม่ระบุวันว่าง");
    r = await approve({ acknowledgeUnavailable: true });
    expect(r.status, r.body?.message).toBe(200);
    expect((await api(co2.token, "PUT", `/api/teacher/supervisions/${appt.id}/availability`, { availableDates: ["2026-12-02"] })).status).toBe(400);
  });

  test("ยืนยันกลุ่มนัด 06:30 เวลาไทย (UTC ยังเป็นวันก่อน) → ตรงวันที่เสนอ · อาจารย์ร่วมไม่ว่าง → 409 แล้วยืนยันซ้ำได้", async () => {
    const main = await W.teacher(W.A), co = await W.teacher(W.A);
    const s1 = await W.student(W.A, "INTERNSHIP_STARTED"), s2 = await W.student(W.A, "INTERNSHIP_STARTED");
    const proposed = JSON.stringify(["2026-12-10|06:30-08:00|ONSITE"]);
    const g1 = await W.appointment(s1.id, main.id, { status: "PENDING_TEACHER", supervisionType: "ONSITE", proposedDates: proposed });
    const g2 = await W.appointment(s2.id, main.id, { status: "PENDING_TEACHER", supervisionType: "ONSITE", proposedDates: proposed });
    await prisma.supervisionCoTeacher.create({ data: { appointmentId: g2.id, teacherId: co.id, availableDates: JSON.stringify(["2026-12-11"]), respondedAt: new Date() } });
    const body = { appointmentIds: [g1.id, g2.id], confirmedDate: bkk("2026-12-10", "06:30") };
    let r = await api(main.token, "POST", "/api/teacher/supervisions/confirm-group", body);
    expect(r.status, r.body?.message).toBe(409);
    r = await api(main.token, "POST", "/api/teacher/supervisions/confirm-group", { ...body, acknowledgeUnavailable: true });
    expect(r.status, r.body?.message).toBe(200);
    const rows = await prisma.supervisionAppointment.findMany({ where: { id: { in: [g1.id, g2.id] } } });
    expect(rows.every((x: any) => x.status === "DATE_CONFIRMED" && x.groupId === rows[0].groupId)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
test.describe("ย้ายรอบ", () => {
  test("เริ่ม T000 ใหม่ → ล้างหนังสือ/batch + ลบเอกสารขั้นหนังสือ · ไฟล์หนังสือรวมของเพื่อนยังอยู่", async () => {
    const mv = await W.student(W.A, "DOCS_APPROVED");
    const mate = await W.student(W.A, "DOCS_APPROVED");
    let r = await api(W.staff.token, "PUT", "/api/admin/t000/letter-batch", form({ letter: "REQUEST", studentIds: JSON.stringify([mv.id, mate.id]), docNumber: docNo("M1") }, "m.pdf"));
    expect(r.status).toBe(200);
    r = await api(W.staff.token, "POST", `/api/admin/students/${mv.id}/move-period`, { periodId: W.otherPeriodId, resetTo: "QUALIFIED", reason: "e2e" });
    expect(r.status, r.body?.message).toBe(200);
    const coop = await prisma.studentCoop.findUnique({ where: { studentId: mv.id } });
    expect(coop).toMatchObject({ status: "QUALIFIED", coopPeriodId: W.otherPeriodId, reqLetterUrl: null, reqLetterBatch: null, reqDocNumber: null });
    expect(await prisma.document.count({ where: { studentId: mv.id, type: { in: ["DISPATCH_LETTER", "PLACEMENT_LETTER", "CP-ACCEPTANCE", "ACCEPTANCE_FORM"] } } })).toBe(0);
    const mateCoop = await prisma.studentCoop.findUnique({ where: { studentId: mate.id } });
    const file = await fetch(`http://localhost:5000/uploads/${mateCoop.reqLetterUrl}`, { method: "HEAD" });
    expect(file.status).toBe(200);
  });

  test("ผ่านคุณสมบัติแล้วเลือก KEEP → 400 · หลักสูตรยังไม่ตั้งรอบปลายทาง → 400 · อาจารย์ประจำวิชาหลักสูตรอื่น → 403", async () => {
    const s = await W.student(W.A, "DOCS_APPROVED");
    expect((await api(W.staff.token, "POST", `/api/admin/students/${s.id}/move-period`, { periodId: W.otherPeriodId, resetTo: "KEEP", reason: "e2e" })).status).toBe(400);
    const sB = await W.student(W.B, "DOCS_APPROVED");
    const r = await api(W.staff.token, "POST", `/api/admin/students/${sB.id}/move-period`, { periodId: W.otherPeriodId, resetTo: "QUALIFIED", reason: "e2e" });
    expect(r.status).toBe(400);
    expect(r.body.message).toContain("ยังไม่ได้ตั้งรอบ");
    const coopB = await W.teacher(W.B, [W.B]);
    expect((await api(coopB.token, "POST", `/api/admin/students/${s.id}/move-period`, { periodId: W.otherPeriodId, resetTo: "QUALIFIED", reason: "e2e" })).status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
test.describe("ปฏิทินนิเทศแยกหลักสูตร", () => {
  test("นักศึกษา/อาจารย์/อาจารย์ประจำวิชา/เจ้าหน้าที่ เห็นตามหลักสูตร + ตัวกรองบนแถบบน", async () => {
    const tA = await W.teacher(W.A), tB = await W.teacher(W.B), tX = await W.teacher(null), coop = await W.teacher(W.A, [W.A, W.B]);
    const sA = await W.student(W.A, "INTERNSHIP_STARTED"), sB = await W.student(W.B, "INTERNSHIP_STARTED"), sNone = await W.student(null, "INTERNSHIP_STARTED");
    const at = (day: string) => ({ status: "DATE_CONFIRMED", confirmedDate: new Date(bkk(day, "09:00")) });
    const aA = await W.appointment(sA.id, tA.id, at("2026-12-20"));
    const aB = await W.appointment(sB.id, tB.id, at("2026-12-21"));
    const aN = await W.appointment(sNone.id, tA.id, at("2026-12-22"));
    await prisma.supervisionCoTeacher.create({ data: { appointmentId: aB.id, teacherId: tX.id } });
    const mine = new Set([aA.id, aB.id, aN.id]);
    const see = async (token: string, filter?: string) => {
      const r = await api(token, "GET", "/api/coop/supervision/calendar", undefined, filter ? { "X-Major-Filter": filter } : {});
      expect(r.status).toBe(200);
      return (r.body.events as any[]).filter((e) => mine.has(e.id)).map((e) => e.id).sort((x, y) => x - y);
    };
    const sorted = (...ids: number[]) => ids.sort((x, y) => x - y);
    expect(await see(sA.token)).toEqual([aA.id]);
    expect(await see(sB.token)).toEqual([aB.id]);
    expect(await see(sNone.token)).toEqual([aN.id]);                    // ไม่มีหลักสูตร = นัดตัวเองเท่านั้น
    expect(await see(tA.token)).toEqual(sorted(aA.id, aN.id));          // หลักสูตรตัวเอง + นัดที่ตัวเองนิเทศ
    expect(await see(tX.token)).toEqual([aB.id]);                       // ไม่มีหลักสูตร แต่เป็นอาจารย์ร่วม
    expect(await see(tA.token, W.B)).toEqual(sorted(aA.id, aN.id));     // อาจารย์ทั่วไปส่งตัวกรอง → ไม่มีผล
    expect(await see(coop.token)).toEqual(sorted(aA.id, aB.id));        // ดูแล A+B · นัดนักศึกษาไม่มีหลักสูตร (aN) เห็นเฉพาะเจ้าหน้าที่/อาจารย์ที่นิเทศ
    expect(await see(coop.token, W.B)).toEqual([aB.id]);                // ตัวกรอง = เฉพาะหลักสูตรนั้น
    expect(await see(W.staff.token, W.A)).toEqual([aA.id]);
    const all = await see(W.staff.token);
    expect(all).toEqual(sorted(aA.id, aB.id, aN.id));
  });
});

// ─────────────────────────────────────────────────────────────
test.describe("zip หนังสือที่ออกแล้ว", () => {
  test("หนังสือรวม → ไฟล์ทุกคน · ไฟล์หาย → _ไม่พบไฟล์.txt · อาจารย์ประจำวิชาเห็นเฉพาะหลักสูตรที่ดูแล", async () => {
    const a1 = await W.student(W.A, "DOCS_APPROVED"), a2 = await W.student(W.A, "DOCS_APPROVED"), b1 = await W.student(W.B, "DOCS_APPROVED");
    const lost = await W.student(W.A, "REQ_LETTER_ISSUED", { reqLetterUrl: `zz-missing-${W.stamp}.pdf` });
    expect((await api(W.staff.token, "PUT", "/api/admin/t000/letter-batch", form({ letter: "REQUEST", studentIds: JSON.stringify([a1.id, a2.id]), docNumber: docNo("Z1") }, "z.pdf"))).status).toBe(200);
    expect((await api(W.staff.token, "PUT", "/api/admin/t000/review", form({ studentId: b1.id, status: "REQ_LETTER_ISSUED", docType: "DISPATCH_LETTER", reqDocNumber: docNo("Z2") }, "z.pdf"))).status).toBe(200);
    const url = `/api/admin/letters/download?type=REQ&coopPeriodId=${W.periodId}`;
    const hasCode = (names: string[], code: string) => names.some((n) => n.startsWith(code));

    let r = await api(W.staff.token, "GET", url);
    expect(r.status).toBe(200);
    let names = zipNames(r.buf!);
    for (const s of [a1, a2, b1]) expect(hasCode(names, s.studentId)).toBe(true);
    expect(hasCode(names, lost.studentId)).toBe(false);
    expect(names).toContain("_ไม่พบไฟล์.txt");

    const coopA = await W.teacher(W.A, [W.A]);
    r = await api(coopA.token, "GET", url);
    names = zipNames(r.buf!);
    expect(hasCode(names, a1.studentId)).toBe(true);
    expect(hasCode(names, b1.studentId)).toBe(false);

    expect((await api(W.staff.token, "GET", `/api/admin/letters/download?type=PLACE&coopPeriodId=${W.periodId}`)).status).toBe(404);
  });

  test("หน้าต่างยืนยัน → ลิงก์ → เบราว์เซอร์ดาวน์โหลดเอง: สรุปตรงกับไฟล์ · เลือกหลักสูตรได้ · ลิงก์ใช้แทน login ไม่ได้", async () => {
    const a1 = await W.student(W.A, "DOCS_APPROVED"), b1 = await W.student(W.B, "DOCS_APPROVED");
    expect((await api(W.staff.token, "PUT", "/api/admin/t000/letter-batch", form({ letter: "REQUEST", studentIds: JSON.stringify([a1.id, (await W.student(W.A, "DOCS_APPROVED")).id]), docNumber: docNo("L1") }, "l.pdf"))).status).toBe(200);
    expect((await api(W.staff.token, "PUT", "/api/admin/t000/review", form({ studentId: b1.id, status: "REQ_LETTER_ISSUED", docType: "DISPATCH_LETTER", reqDocNumber: docNo("L2") }, "l.pdf"))).status).toBe(200);
    const q = (major: string) => `/api/admin/letters/summary?type=REQ&coopPeriodId=${W.periodId}&major=${major}`;

    const onlyA = await api(W.staff.token, "GET", q(W.A));
    expect(onlyA.status).toBe(200);
    expect(onlyA.body.students.map((s: any) => s.major)).toEqual(expect.arrayContaining([W.A]));
    expect(onlyA.body.students.some((s: any) => s.studentId === b1.studentId)).toBe(false);
    expect(onlyA.body.fileName).toBe(`หนังสือขอความอนุเคราะห์_เทอม8-ZZ${W.stamp}_${W.A}.zip`);
    expect(onlyA.body.totalBytes).toBeGreaterThan(0);

    // อาจารย์ประจำวิชา A เลือกหลักสูตร B → ไม่ขยายสิทธิ์ (ยังเห็นแค่ A)
    const coopA = await W.teacher(W.A, [W.A]);
    const widened = await api(coopA.token, "GET", q(W.B));
    expect(widened.body.students.every((s: any) => s.major === W.A)).toBe(true);

    const link = await api(W.staff.token, "POST", "/api/admin/letters/download-link", { type: "REQ", coopPeriodId: String(W.periodId), major: W.A });
    expect(link.status).toBe(200);
    expect(link.body.count).toBe(onlyA.body.count);
    const zip = await fetch(`http://localhost:5000${link.body.url}`); // ไม่มี header Authorization — เหมือนเบราว์เซอร์เปิดลิงก์
    expect(zip.status).toBe(200);
    expect(decodeURIComponent(zip.headers.get("content-disposition")!.split("UTF-8''")[1])).toBe(onlyA.body.fileName);
    const names = zipNames(Buffer.from(await zip.arrayBuffer()));
    expect(names.filter((n) => !n.startsWith("_"))).toHaveLength(onlyA.body.count);

    const t = decodeURIComponent(link.body.url.split("t=")[1]);
    expect((await api(t, "GET", "/api/auth/me")).status).toBe(401);           // ใช้แทน token login ไม่ได้
    expect((await fetch(`http://localhost:5000/api/admin/letters/zip?t=bogus`)).status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
test.describe("นำเข้า Excel (อาจารย์ประจำวิชา)", () => {
  test("เฉพาะหลักสูตรที่ดูแล · ไม่ระบุหลักสูตร = หลักสูตรที่ดูแล · ชื่อไทยได้ · หลักสูตรไม่มีในระบบข้าม · นักศึกษาหลักสูตรอื่นไม่ถูกแก้", async () => {
    const coopA = await W.teacher(W.A, [W.A]);
    const existingB = await W.student(W.B, "NOT_SUBMITTED");
    const code = (n: number) => `7${W.stamp}${n}`;
    const row = (n: number, major: string) => ({ "รหัสนักศึกษา": code(n), "คำนำหน้าชื่อ": "นาย", "ชื่อ-นามสกุล (ภาษาไทย)": `นำเข้า ${n}`, "อีเมล": `zz-im${W.stamp}${n}@kkumail.com`, "สาขาวิชา": major });
    const rows = [
      row(1, W.A), row(2, W.B), row(3, ""), row(4, W.nameA), row(5, `ZZ ไม่มีหลักสูตรนี้ ${W.stamp}`),
      { "รหัสนักศึกษา": existingB.studentId, "คำนำหน้าชื่อ": "นาย", "ชื่อ-นามสกุล (ภาษาไทย)": "แก้ ชื่อ", "อีเมล": `zz-bl${W.stamp}-x@kkumail.com`, "สาขาวิชา": W.A },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Sheet1");
    const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fd = new FormData();
    fd.append("file", new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "import.xlsx");
    const codes = [1, 2, 3, 4, 5].map(code);
    try {
      const r = await api(coopA.token, "POST", "/api/admin/students/import-excel", fd);
      expect(r.status, r.body?.message).toBe(200);
      const got = Object.fromEntries((await prisma.student.findMany({ where: { studentId: { in: [...codes, existingB.studentId] } }, select: { studentId: true, major: true, firstName: true } })).map((s: any) => [s.studentId, s]));
      expect(got[code(1)]?.major).toBe(W.A);
      expect(got[code(2)]).toBeUndefined();
      expect(got[code(3)]?.major).toBe(W.A);
      expect(got[code(4)]?.major).toBe(W.A);
      expect(got[code(5)]).toBeUndefined();
      expect(await prisma.coopCriteria.count({ where: { major: { contains: `ไม่มีหลักสูตรนี้ ${W.stamp}` } } })).toBe(0);
      expect(got[existingB.studentId]).toMatchObject({ major: W.B, firstName: expect.not.stringContaining("แก้") });
    } finally {
      await W.adopt(codes);
    }
  });
});
