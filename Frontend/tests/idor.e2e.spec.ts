/**
 * tests/idor.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * IDOR — ผู้ใช้บทบาทเดียวกันแต่ไม่ใช่เจ้าของ เปลี่ยนเลขไอดีใน URL/body แล้วดู/แก้ข้อมูลของคนอื่นไม่ได้ (ข้อมูลไม่เปลี่ยน)
 *   นักศึกษา B → เอกสาร/ไฟล์ของนักศึกษา A
 *   อาจารย์ที่ไม่ใช่ที่ปรึกษา → คำร้อง/ฟอร์ม/การนิเทศ/การเยี่ยมของนักศึกษา A
 *   อาจารย์ประจำวิชาหลักสูตร Y → นักศึกษาหลักสูตร X (เอกสาร · คำร้อง · นิเทศ · วันขยาย · แก้/ลบ/รหัสผ่าน · T000)
 * (ข้อมูลบริษัท/ผู้ติดต่อ/พี่เลี้ยงเป็นสมุดรายชื่อกลางที่แก้ร่วมกันได้ — ผู้ใช้ตัดสินคงไว้ 2026-11-08 · ลบได้เฉพาะที่ไม่มีคนอื่นใช้ ทดสอบใน company.e2e)
 */
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { api, type Res } from "./helpers/letterWorld";
import { WorldKit, prisma, UPLOADS, day, type KStudent, type KTeacher } from "./helpers/worldKit";

const k = new WorldKit("ZQ");
test.describe.configure({ mode: "serial" });
const msg = (r: Res) => JSON.stringify(r.body);
const denied = (r: Res, what: string) => expect(r.status, `${what} ${msg(r)}`).toBe(403);   // 403 จริง (ไม่ใช่ 404 จาก path ผิด)

let sA: KStudent, sB: KStudent, advA: KTeacher, advB: KTeacher, coopY: KTeacher;
let docA = 0, coopIdA = 0, apptA = 0, visitA = 0, fileA = "";

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน");
  const X = await k.major("X"), Y = await k.major("Y");
  const P = await k.period(1, { [X]: {}, [Y]: {} });
  advA = await k.teacher("ที่ปรึกษาA", { major: X });
  advB = await k.teacher("ที่ปรึกษาB", { major: X });
  coopY = await k.teacher("ประจำวิชาY", { major: Y, coop: [Y] });
  await k.teacher("ประจำวิชาX", { major: X, coop: [X] });
  sA = await k.student("a", 1, { major: X, status: "APPLYING", periodId: P, advisor: advA.pk, docs: [{ type: "APPLICATION_DOC", file: true }, { type: "T002_FORM", file: true, status: "WAITING" }] });
  sB = await k.student("b", 2, { major: Y, status: "APPLYING", periodId: P, advisor: advB.pk });
  const docs = await k.docs(sA.pk);
  docA = docs[0].id; fileA = docs[0].path;
  coopIdA = (await k.coop(sA.pk)).id;
  apptA = (await prisma.supervisionAppointment.create({ data: { studentId: sA.pk, teacherId: advA.pk, proposedDates: JSON.stringify([`${day(20)}T09:00:00+07:00`]), supervisionType: "ONLINE" } })).id;
  visitA = (await prisma.visit.create({ data: { studentId: sA.pk, teacherId: advA.pk, date: new Date(`${day(5)}T00:00:00+07:00`), status: "PENDING" } })).id;
});
test.afterAll(async () => {
  await prisma.visit.deleteMany({ where: { id: visitA } });
  await k.cleanup(); await k.disconnect();
});

test("นักศึกษา B → เอกสาร/ไฟล์ของนักศึกษา A: ลบไม่ได้ (ทั้ง 2 เส้น) · เปิดไฟล์ไม่ได้ · เอกสารยังอยู่", async () => {
  denied(await api(sB.token, "DELETE", `/api/coop/documents/${docA}`), "coop/documents");
  denied(await api(sB.token, "DELETE", `/api/docs/delete/${docA}`), "docs/delete");
  expect(await prisma.document.findUnique({ where: { id: docA } })).not.toBeNull();
  expect(fs.existsSync(path.join(UPLOADS, fileA))).toBe(true);
  // เปิดไฟล์ /uploads ด้วย cookie ของ B (cookie ได้จากคำขอที่มี token)
  const me = await fetch("http://localhost:5000/api/auth/me", { headers: { Authorization: `Bearer ${sB.token}` } });
  const cookie = (me.headers.get("set-cookie") || "").split(";")[0];
  expect(cookie).toMatch(/^coop_file=/);
  const f = await fetch(`http://localhost:5000/uploads/${fileA}`, { headers: { cookie } });
  expect([403, 404]).toContain(f.status);
  const own = await fetch(`http://localhost:5000/uploads/${fileA}`, { headers: { cookie: (await fetch("http://localhost:5000/api/auth/me", { headers: { Authorization: `Bearer ${sA.token}` } })).headers.get("set-cookie")!.split(";")[0] } });
  expect(own.status).toBe(200);                                                     // เจ้าของเปิดได้ (เทสต์ไม่ได้กันทุกอย่าง)
});

test("อาจารย์ที่ไม่ใช่ที่ปรึกษา → นักศึกษา A: คำร้อง · T002 · การนิเทศ (ตอบ/เสร็จ/อาจารย์ร่วม) · การเยี่ยม (ดู/แก้/ลบ/เพิ่ม)", async () => {
  denied(await api(advB.token, "PUT", "/api/coop/status", { studentId: sA.pk, status: "QUALIFIED" }), "coop/status");
  denied(await api(advB.token, "PUT", "/api/teacher/documents/review-t002", { studentId: sA.pk, status: "T002_SUBMITTED" }), "review-t002");
  denied(await api(advB.token, "PUT", `/api/teacher/supervisions/${apptA}/review`, { action: "APPROVE", confirmedDate: `${day(20)}T09:00:00+07:00` }), "supervision review");
  denied(await api(advB.token, "PUT", `/api/teacher/supervisions/${apptA}/complete`), "supervision complete");
  denied(await api(advB.token, "PUT", `/api/teacher/supervisions/${apptA}/availability`, { availableDates: [] }), "co-teacher availability");
  denied(await api(advB.token, "GET", `/api/visits/student/${sA.studentId}`), "visits list");
  denied(await api(advB.token, "PUT", `/api/visits/${visitA}/toggle`), "visit toggle");
  denied(await api(advB.token, "DELETE", `/api/visits/${visitA}`), "visit delete");
  denied(await api(advB.token, "POST", "/api/visits", { studentId: sA.studentId, date: day(7), note: "x" }), "visit create");
  expect((await k.coop(sA.pk)).status).toBe("APPLYING");
  expect((await prisma.supervisionAppointment.findUnique({ where: { id: apptA } })).status).toBe("PENDING_TEACHER");
  expect(await prisma.visit.findUnique({ where: { id: visitA } })).not.toBeNull();
  expect((await k.docs(sA.pk, "T002_FORM"))[0].status).toBe("WAITING");
  // ที่ปรึกษาตัวจริงทำได้ (เทสต์ไม่ได้กันทุกคน)
  expect((await api(advA.token, "GET", `/api/visits/student/${sA.studentId}`)).status).toBe(200);
});

test("อาจารย์ประจำวิชาหลักสูตร Y → นักศึกษาหลักสูตร X: เอกสาร · คำร้อง · นิเทศ · วันขยาย · แก้/ลบ/ย้ายรอบ · T000 — ทำไม่ได้ ข้อมูลไม่เปลี่ยน", async () => {
  denied(await api(coopY.token, "PUT", `/api/admin/doc/${docA}/status`, { status: "APPROVED" }), "doc status");
  denied(await api(coopY.token, "PATCH", `/api/admin/coop-applications/${coopIdA}/status`, { status: "QUALIFIED" }), "application status");
  denied(await api(coopY.token, "PUT", `/api/admin/supervisions/${apptA}/co-teachers`, { coTeacherIds: [coopY.pk] }), "co-teachers");
  denied(await api(coopY.token, "PUT", `/api/admin/supervisions/${apptA}/confirmed-date`, { confirmedDate: `${day(21)}T09:00:00+07:00` }), "confirmed-date");
  denied(await api(coopY.token, "PUT", `/api/admin/supervisions/${apptA}/complete`), "admin complete");
  denied(await api(coopY.token, "PUT", `/api/admin/students/${sA.pk}/deadline-extension`, { stepKey: "T000", until: day(30), reason: "x" }), "extension");
  denied(await api(coopY.token, "PUT", `/api/admin/students/${sA.pk}`, { firstName: "แก้" }), "edit student");
  denied(await api(coopY.token, "DELETE", `/api/admin/students/${sA.pk}`), "trash student");
  denied(await api(coopY.token, "POST", `/api/admin/students/${sA.pk}/move-period`, { periodId: 1, resetTo: "KEEP" }), "move period");
  denied(await api(coopY.token, "POST", `/api/admin/students/${sA.pk}/password/reveal`), "reveal password");
  denied(await api(coopY.token, "PUT", "/api/admin/t000/review", { studentId: sA.pk, status: "EDITS_REQUIRED", comment: "x" }), "t000 review");
  denied(await api(coopY.token, "PUT", "/api/admin/documents/review-t002", { studentId: sA.pk, status: "T002_SUBMITTED" }), "admin review-t002");
  const st = await prisma.student.findUnique({ where: { id: sA.pk } });
  expect([st.firstName, st.deletedAt]).toEqual(["นศa", null]);
  expect((await k.coop(sA.pk)).status).toBe("APPLYING");
  expect((await k.coop(sA.pk)).deadlineExtensions ?? {}).toEqual({});
  expect((await prisma.document.findUnique({ where: { id: docA } })).status).toBe("WAITING");
  const appt = await prisma.supervisionAppointment.findUnique({ where: { id: apptA }, include: { coTeachers: true } });
  expect([appt.status, appt.confirmedDate, appt.coTeachers.length]).toEqual(["PENDING_TEACHER", null, 0]);
});

test("รายการรวมไม่หลุดข้ามขอบเขต: อาจารย์ทั่วไปเห็นเฉพาะนักศึกษาในที่ปรึกษา · ประจำวิชา Y ไม่เห็นนักศึกษา X · นักศึกษาไม่เห็นรายชื่อ", async () => {
  const ids = (r: Res) => JSON.stringify(r.body);
  expect(ids(await api(advB.token, "GET", "/api/teacher/my-students?limit=200"))).not.toContain(sA.studentId);
  expect(ids(await api(coopY.token, "GET", "/api/students?limit=100"))).not.toContain(sA.studentId);
  expect(ids(await api(coopY.token, "GET", "/api/admin/t000/students"))).not.toContain(sA.studentId);
  expect(ids(await api(coopY.token, "GET", "/api/admin/supervisions"))).not.toContain(sA.studentId);
  expect(ids(await api(advB.token, "GET", "/api/teacher/supervisions"))).not.toContain(sA.studentId);
  expect((await api(sB.token, "GET", "/api/students")).status).toBe(403);
  expect((await api(sB.token, "GET", "/api/teacher/my-students")).status).toBe(403);
});
