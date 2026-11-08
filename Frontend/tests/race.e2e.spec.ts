/**
 * tests/race.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * กดซ้ำ / กดพร้อมกัน — ยิงคำขอเดียวกันหลายครั้งพร้อมกัน (กดปุ่มรัว · 2 แท็บ · 2 คนทำรายการเดียวกัน)
 *   ต้องไม่มี 500 · ผลมีครั้งเดียว (แถวไม่ซ้ำ · สถานะไม่ถูกตัดสินสองแบบ · เลขหนังสือไม่ซ้ำ · แจ้งเตือนไม่ซ้ำ)
 */
import { test, expect } from "@playwright/test";
import { api, PDF, type Res } from "./helpers/letterWorld";
import fs from "node:fs";
import path from "node:path";
import { WorldKit, prisma, UPLOADS, day, type KStudent, type KTeacher, type KUser } from "./helpers/worldKit";

const k = new WorldKit("ZG");
test.describe.configure({ mode: "default" });   // แต่ละข้อไม่ขึ้นต่อกัน — ข้อหนึ่งล้มยังเห็นผลข้ออื่น
const N = 6;
const burst = (f: () => Promise<Res>, n = N) => Promise.all(Array.from({ length: n }, f));
const codes = (rs: Res[]) => rs.map((r) => r.status).sort().join(",");
const oks = (rs: Res[]) => rs.filter((r) => r.status < 300).length;
const no500 = (rs: Res[], what: string) => expect(rs.filter((r) => r.status >= 500).map((r) => JSON.stringify(r.body)), what).toEqual([]);
const fileForm = (fields: Record<string, string>, field = "files") => {
  const fd = new FormData();
  for (const [a, b] of Object.entries(fields)) fd.append(a, b);
  fd.append(field, new Blob([PDF], { type: "application/pdf" }), "f.pdf");
  return fd;
};

let X = "", P = 0, staff: KUser, staff2: KUser, coopX: KTeacher, adv: KTeacher, companyId = "", contactIds: string[] = [];
let n = 0;
const docNo = (i: number) => `660301.26.6.2/9${k.tail}${i}`;
async function stu(status: string, extra: Record<string, unknown> = {}, docs: { type: string; status?: string; file?: boolean }[] = []): Promise<KStudent> {
  const s = await k.student(`r${++n}`, n, { major: X, status, periodId: P, companyId, contactIds, advisor: adv.pk, docs });
  if (Object.keys(extra).length) await prisma.studentCoop.update({ where: { studentId: s.pk }, data: extra });
  return s;
}

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน");
  X = await k.major("X");
  const open = { due: day(60) };
  P = await k.period(1, { [X]: { deadlines: { T000: open, T002: open, T003: open } } });
  await prisma.coopPeriodMajor.updateMany({ where: { periodId: P }, data: { isSupervisionOpen: true } });
  staff = await k.staff("staff1"); staff2 = await k.staff("staff2");
  coopX = await k.teacher("ประจำวิชา", { major: X, coop: [X] });
  adv = await k.teacher("ที่ปรึกษา", { major: X });
  const c = await k.company(`${k.prefix}${k.tail} บริษัท`, ["HR"], staff.userId);
  companyId = c.id; contactIds = c.contactIds;
});
test.afterAll(async () => {
  await prisma.docNumberLock.deleteMany({ where: { number: { contains: `9${k.tail}` } } });
  await k.cleanup(); await k.disconnect();
});

test("ยื่นคำร้องรัว ๆ: คำร้องเดียว · ไฟล์แนบชุดเดียว", async () => {
  const s = await stu("NOT_SUBMITTED");
  const rs = await burst(() => api(s.token, "POST", "/api/coop/apply", fileForm({ jobPosition: "dev", coopPeriodId: String(P), gradeSheetUrl: "https://docs.google.com/x" })));
  no500(rs, codes(rs));
  expect(oks(rs), codes(rs)).toBe(1);
  expect(await prisma.studentCoop.count({ where: { studentId: s.pk } })).toBe(1);
  expect((await k.docs(s.pk, "APPLICATION_DOC")).length).toBe(1);
});

test("อาจารย์ประจำวิชา + เจ้าหน้าที่ตัดสินคำร้องพร้อมกัน (ผ่าน vs ส่งกลับแก้): ตัดสินได้ครั้งเดียว ไม่ได้สองผล", async () => {
  const s = await stu("APPLYING");
  const rs = await Promise.all([
    api(coopX.token, "PUT", "/api/coop/status", { studentId: s.pk, status: "APPROVED" }),
    api(coopX.token, "PUT", "/api/coop/status", { studentId: s.pk, status: "APPLICATION_EDITS_REQUIRED", comment: "แก้" }),
    api(coopX.token, "PUT", "/api/coop/status", { studentId: s.pk, status: "QUALIFICATION_FAILED", comment: "ไม่ผ่าน" }),
  ]);
  no500(rs, codes(rs));
  expect(oks(rs), codes(rs)).toBe(1);
  // เจ้าหน้าที่ (หน้าคำร้อง) + อาจารย์ประจำวิชาพร้อมกัน — คำร้องใหม่อีกคน
  const s2 = await stu("APPLYING");
  const coopId = (await k.coop(s2.pk)).id;
  const r2 = await Promise.all([
    api(coopX.token, "PUT", "/api/coop/status", { studentId: s2.pk, status: "APPROVED" }),
    api(staff.token, "PATCH", `/api/admin/coop-applications/${coopId}/status`, { status: "QUALIFICATION_FAILED", comment: "ไม่ผ่าน" }),
  ]);
  no500(r2, codes(r2));
  const final = (await k.coop(s2.pk)).status;
  expect(["QUALIFIED", "QUALIFICATION_FAILED"]).toContain(final);   // เจ้าหน้าที่พิจารณาใหม่ได้จนกว่าจะส่ง T000 — ผลสุดท้ายเป็นผลใดผลหนึ่ง
  const notes = await k.notes(s.userId, "STATUS_UPDATED");
  expect(notes.length, "นักศึกษาได้แจ้งผลครั้งเดียว").toBe(1);
});

test("ส่งไฟล์ T000 หัวข้อเดียวกันรัว ๆ: เหลือไฟล์เดียว ไฟล์มีจริง", async () => {
  const s = await stu("QUALIFIED");
  const rs = await burst(() => api(s.token, "POST", "/api/docs/upload", fileForm({ docType: "CP-CV" })));
  no500(rs, codes(rs));
  const docs = await k.docs(s.pk, "CP-CV");
  expect(docs.length, codes(rs)).toBe(1);
  expect(fs.existsSync(path.join(UPLOADS, docs[0].path)), "ไฟล์ของแถวที่เหลือต้องมีจริง (ไม่ถูกลบโดยคำขอที่ทับ)").toBe(true);
});

test("ส่งใบตอบรับรัว ๆ: ไฟล์เดียว · สถานะรอตรวจ", async () => {
  const s = await stu("REQ_LETTER_ISSUED", { reqLetterUrl: `${k.tag}-req.pdf` });
  const rs = await burst(() => api(s.token, "POST", "/api/docs/upload", fileForm({ docType: "CP-ACCEPTANCE" })));
  no500(rs, codes(rs));
  expect((await k.docs(s.pk, "CP-ACCEPTANCE")).length, codes(rs)).toBe(1);
  expect((await k.coop(s.pk)).status).toBe("WAITING_FOR_STAFF_CHECK_LETTER");
});

test("กดรับหนังสือขอความอนุเคราะห์/หนังสือส่งตัวรัว ๆ: เปลี่ยนสถานะครั้งเดียว", async () => {
  const a = await stu("REQ_LETTER_ISSUED", { reqLetterUrl: `${k.tag}-req.pdf` });
  const ra = await burst(() => api(a.token, "POST", "/api/students/acknowledge-dispatch", {}));
  no500(ra, codes(ra));
  expect(oks(ra), codes(ra)).toBe(1);
  const b = await stu("PLACEMENT_LETTER_ISSUED", { reqLetterUrl: `${k.tag}-req.pdf`, placeLetterUrl: `${k.tag}-place.pdf` });
  const rb = await burst(() => api(b.token, "POST", "/api/students/download-placement-letter", {}));
  no500(rb, codes(rb));
  expect((await k.coop(b.pk)).status).toBe("INTERNSHIP_STARTED");
});

test("เสนอวันนิเทศรัว ๆ: นัดเดียว", async () => {
  const s = await stu("INTERNSHIP_STARTED");
  const rs = await burst(() => api(s.token, "POST", "/api/coop/supervision/propose", { proposedDates: JSON.stringify([`${day(20)}T09:00:00+07:00`]), supervisionType: "ONLINE", onlineLink: "https://meet.google.com/abc" }));
  no500(rs, codes(rs));
  expect(await prisma.supervisionAppointment.count({ where: { studentId: s.pk } })).toBe(1);
});

test("ที่ปรึกษา + เจ้าหน้าที่ตรวจ T002 พร้อมกัน (ผ่าน vs ส่งกลับแก้): ได้ผลเดียว", async () => {
  const s = await stu("INTERNSHIP_STARTED", {}, [{ type: "T002_FORM", file: true, status: "WAITING" }]);
  const rs = await Promise.all([
    api(adv.token, "PUT", "/api/teacher/documents/review-t002", { studentId: s.pk, status: "T002_SUBMITTED" }),
    api(staff.token, "PUT", "/api/admin/documents/review-t002", { studentId: s.pk, status: "T002_EDITS_REQUIRED", comment: "แก้" }),
    api(adv.token, "PUT", "/api/teacher/documents/review-t002", { studentId: s.pk, status: "T002_EDITS_REQUIRED", comment: "แก้" }),
  ]);
  no500(rs, codes(rs));
  expect(oks(rs), codes(rs)).toBe(1);
});

test("เจ้าหน้าที่ 2 คนร่างหนังสือเลขเดียวกันให้คนละคนพร้อมกัน: ได้คนเดียว", async () => {
  const a = await stu("DOCS_APPROVED"), b = await stu("DOCS_APPROVED");
  const no = docNo(1);
  const rs = await Promise.all([
    api(staff.token, "PUT", "/api/admin/t000/letter-pending", { studentId: a.pk, letter: "REQUEST", docNumber: no }),
    api(staff2.token, "PUT", "/api/admin/t000/letter-pending", { studentId: b.pk, letter: "REQUEST", docNumber: no }),
  ]);
  no500(rs, codes(rs));
  expect(oks(rs), codes(rs)).toBe(1);
  expect(await prisma.studentCoop.count({ where: { studentId: { in: [a.pk, b.pk] }, reqLetterDraftNumber: { not: null } } })).toBe(1);
});

test("เจ้าหน้าที่ 2 คนออกหนังสือเลขเดียวกันให้คนละคนพร้อมกัน: ได้คนเดียว", async () => {
  const a = await stu("DOCS_APPROVED"), b = await stu("DOCS_APPROVED");
  const no = docNo(2);
  const issue = (tk: string, pk: number) => api(tk, "PUT", "/api/admin/t000/review", fileForm({ studentId: String(pk), status: "REQ_LETTER_ISSUED", reqDocNumber: no, reqDocDate: day(0) }, "file"));
  const rs = await Promise.all([issue(staff.token, a.pk), issue(staff2.token, b.pk)]);
  no500(rs, codes(rs));
  expect(oks(rs), codes(rs)).toBe(1);
  expect(await prisma.studentCoop.count({ where: { studentId: { in: [a.pk, b.pk] }, reqDocNumber: { contains: `9${k.tail}2` } } })).toBe(1);
});

test("อนุมัติเอกสารทั้งหมด/บันทึกรับใบตอบรับรัว ๆ: ไม่พัง · สถานะถูก", async () => {
  const a = await stu("WAITING_FOR_STAFF_CHECK", {}, [{ type: "CP-CV", file: true }]);
  const ra = await burst(() => api(staff.token, "POST", "/api/admin/t000/approve-all", { studentId: a.pk }), 4);
  no500(ra, codes(ra));
  expect((await k.coop(a.pk)).status).toBe("DOCS_APPROVED");
  const b = await stu("WAITING_FOR_PLACEMENT_LETTER", { reqLetterUrl: `${k.tag}-req.pdf` });
  const fd = () => { const f = new FormData(); f.append("studentId", String(b.pk)); return f; };
  const rb = await burst(() => api(staff.token, "POST", "/api/admin/t000/acceptance-received", fd()), 4);
  no500(rb, codes(rb));
  expect((await k.coop(b.pk)).status).toBe("ACCEPTANCE_CHECKED");
});

test("เจ้าหน้าที่ 2 คนเพิ่มนักศึกษาคนเดียวกันพร้อมกัน: บัญชีเดียว", async () => {
  const body = { studentId: `8${k.tail}0099`, firstName: "ซ้ำ", lastName: "พร้อมกัน", email: `${k.tag}-dup@kkumail.com`, major: X };
  const rs = await Promise.all([staff, staff2, staff].map((u) => api(u.token, "POST", "/api/admin/students/create", body)));
  no500(rs, codes(rs));
  expect(oks(rs), codes(rs)).toBe(1);
  expect(await prisma.user.count({ where: { email: body.email } })).toBe(1);
});
