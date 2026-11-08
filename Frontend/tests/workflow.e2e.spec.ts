/**
 * tests/workflow.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * ข้ามขั้นตอนผ่าน API — หน้าเว็บซ่อนปุ่มเมื่อยังไม่ถึงขั้น แต่ยิง API ตรงต้องโดนปฏิเสธด้วย
 *   ทุกปุ่มที่เปลี่ยนสถานะ (นักศึกษา · อาจารย์ที่ปรึกษา · เจ้าหน้าที่) × ทุกสถานะสหกิจ (20) — รอบเปิดทุกกำหนดส่ง (ไม่ใช่โดนเพราะเลยกำหนด)
 *   ALLOW = สถานะที่ทำได้ · ที่เหลือต้องได้ 4xx และข้อมูลไม่เปลี่ยน
 */
import { test, expect } from "@playwright/test";


import { api, PDF, type Res } from "./helpers/letterWorld";
import { WorldKit, prisma, day, type KStudent, type KTeacher, type KUser } from "./helpers/worldKit";

const k = new WorldKit("ZK");
test.describe.configure({ mode: "serial" });

export const STATUSES = [
  "NOT_SUBMITTED", "APPLYING", "PENDING_GRADE", "QUALIFICATION_FAILED", "APPLICATION_EDITS_REQUIRED", "QUALIFIED",
  "WAITING_FOR_STAFF_CHECK", "EDITS_REQUIRED", "DOCS_APPROVED", "REQ_LETTER_ISSUED", "WAITING_FOR_PLACEMENT_LETTER",
  "WAITING_FOR_STAFF_CHECK_LETTER", "ACCEPTANCE_CHECKED", "PLACEMENT_LETTER_ISSUED", "INTERNSHIP_STARTED",
  "T002_SUBMITTED", "T002_EDITS_REQUIRED", "T003_SUBMITTED", "T003_EDITS_REQUIRED", "T003_APPROVED",
] as const;
type St = typeof STATUSES[number];
const IDX = (s: St) => STATUSES.indexOf(s);
const after = (s: St) => STATUSES.filter((x) => IDX(x) >= IDX(s));

let X = "", P = 0, staff: KUser, adv: KTeacher, coopX: KTeacher, coopY: KTeacher, companyId = "", contactIds: string[] = [], otherCompany = "";
let n = 0;
const T000_KEY = "CP-CV";
const file = (name = "f.pdf") => { const fd = new FormData(); fd.append("files", new Blob([PDF], { type: "application/pdf" }), name); return fd; };
const fdOf = (fields: Record<string, string>, field = "file") => {
  const fd = new FormData();
  for (const [a, b] of Object.entries(fields)) fd.append(a, b);
  fd.append(field, new Blob([PDF], { type: "application/pdf" }), "signed.pdf");
  return fd;
};

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน");
  X = await k.major("X");
  const open = { due: day(60) };
  P = await k.period(1, { [X]: { deadlines: { T000: open, T002: open, T003: open } } });
  await prisma.coopPeriodMajor.updateMany({ where: { periodId: P }, data: { isSupervisionOpen: true } });
  staff = await k.staff();
  adv = await k.teacher("ที่ปรึกษา", { major: X });
  coopX = await k.teacher("ประจำวิชาX", { major: X, coop: [X] });
  coopY = await k.teacher("ประจำวิชาY", { major: X, coop: [await k.major("Y")] });
  const c = await k.company(`${k.prefix}${k.tail} บริษัท`, ["HR"], staff.userId);
  companyId = c.id; contactIds = c.contactIds;
  otherCompany = (await k.company(`${k.prefix}${k.tail} บริษัทอื่น`, ["HR2"], staff.userId)).id;
});
test.afterAll(async () => { await k.cleanup(); await k.disconnect(); });

/** นักศึกษาในสถานะ s — ข้อมูลประกอบตามที่สถานะนั้นควรมี (หนังสือ/ไฟล์) */
async function studentIn(s: St, forms = true): Promise<KStudent & { coopId: number; docId: number }> {
  const st = await k.student(`s${++n}`, n, {
    major: X, status: s, periodId: P, companyId, contactIds, advisor: adv.pk,
    docs: [{ type: T000_KEY, file: true }, { type: "CP-ACCEPTANCE", file: true }, ...(forms ? [{ type: "T002_FORM", file: true }, { type: "T003_FORM", file: true }] : [])],
  });
  const coop = await k.coop(st.pk);
  const data: Record<string, unknown> = {};
  if (IDX(s) >= IDX("REQ_LETTER_ISSUED")) Object.assign(data, { reqLetterUrl: `${k.tag}-req.pdf`, reqDocNumber: `660301.26.6.2/${9000 + n}` });
  if (IDX(s) >= IDX("PLACEMENT_LETTER_ISSUED")) Object.assign(data, { placeLetterUrl: `${k.tag}-place.pdf`, placeDocNumber: `660301.26.6.2/${8000 + n}` });
  if (Object.keys(data).length) await prisma.studentCoop.update({ where: { id: coop.id }, data });
  const docs = await k.docs(st.pk, T000_KEY);
  return { ...st, coopId: coop.id, docId: docs[0].id };
}

type Ctx = KStudent & { coopId: number; docId: number };
const ACTIONS: Record<string, (s: Ctx) => Promise<Res>> = {
  // นักศึกษา
  "นศ ยื่นคำร้อง": (s) => { const fd = file(); fd.append("jobPosition", "dev"); fd.append("coopPeriodId", String(P)); fd.append("gradeSheetUrl", "https://docs.google.com/x"); return api(s.token, "POST", "/api/coop/apply", fd); },
  "นศ บันทึกฟอร์มคำร้อง": (s) => api(s.token, "POST", "/api/docs/save-form", { phone: "0811111111" }),
  "นศ ส่งเอกสาร T000": (s) => { const fd = file(); fd.append("docType", T000_KEY); return api(s.token, "POST", "/api/docs/upload", fd); },
  "นศ ลบเอกสาร T000": (s) => api(s.token, "DELETE", `/api/docs/delete/${s.docId}`),
  "นศ ส่งใบตอบรับ": (s) => { const fd = file(); fd.append("docType", "CP-ACCEPTANCE"); return api(s.token, "POST", "/api/docs/upload", fd); },
  "นศ ส่งไฟล์ T002": (s) => { const fd = file(); fd.append("docType", "T002_FORM"); return api(s.token, "POST", "/api/docs/upload", fd); },
  "นศ ส่งไฟล์ T003": (s) => { const fd = file(); fd.append("docType", "T003_FORM"); return api(s.token, "POST", "/api/docs/upload", fd); },
  "นศ บันทึกฟอร์ม T002": (s) => api(s.token, "POST", "/api/docs/t002-form", { accommodationPhone: "0811111111" }),
  "นศ บันทึกฟอร์ม T003": (s) => api(s.token, "POST", "/api/docs/t003-form", { projectTitle: "หัวข้อ" }),
  "นศ เสนอวันนิเทศ": (s) => api(s.token, "POST", "/api/coop/supervision/propose", { proposedDates: JSON.stringify([`${day(20)}T09:00:00+07:00`]), supervisionType: "ONLINE", onlineLink: "https://meet.google.com/abc" }),
  "นศ รับหนังสือขอความอนุเคราะห์": (s) => api(s.token, "POST", "/api/students/acknowledge-dispatch", {}),
  "นศ รับหนังสือส่งตัว": (s) => api(s.token, "POST", "/api/students/download-placement-letter", {}),
  "นศ เปลี่ยนบริษัท": (s) => api(s.token, "PUT", "/api/students/me", { companyId: otherCompany, contactIds: [] }),
  // อาจารย์ที่ปรึกษา
  "อ ผ่านคำร้อง": (s) => api(adv.token, "PUT", "/api/coop/status", { studentId: s.pk, status: "APPROVED" }),
  "อ ตีกลับคำร้อง": (s) => api(adv.token, "PUT", "/api/coop/status", { studentId: s.pk, status: "APPLICATION_EDITS_REQUIRED", comment: "แก้" }),
  "อ ผ่าน T002": (s) => api(adv.token, "PUT", "/api/teacher/documents/review-t002", { studentId: s.pk, status: "T002_SUBMITTED" }),
  "อ ผ่าน T003": (s) => api(adv.token, "PUT", "/api/teacher/documents/review-t003", { studentId: s.pk, status: "T003_APPROVED" }),
  // อาจารย์ประจำวิชา (ผู้พิจารณาคำร้องร่วมกับเจ้าหน้าที่ — 2026-11-08)
  "ป ผ่านคำร้อง (หลักสูตรตัวเอง)": (s) => api(coopX.token, "PUT", "/api/coop/status", { studentId: s.pk, status: "APPROVED" }),
  "ป ผ่านคำร้อง (หลักสูตรอื่น)": (s) => api(coopY.token, "PUT", "/api/coop/status", { studentId: s.pk, status: "APPROVED" }),
  // เจ้าหน้าที่
  "จ ผ่านคำร้อง": (s) => api(staff.token, "PATCH", `/api/admin/coop-applications/${s.coopId}/status`, { status: "QUALIFIED" }),
  "จ อนุมัติเอกสารรายชิ้น": (s) => api(staff.token, "PUT", `/api/admin/doc/${s.docId}/status`, { status: "APPROVED" }),
  "จ อนุมัติเอกสารทั้งหมด": (s) => api(staff.token, "POST", "/api/admin/t000/approve-all", { studentId: s.pk }),
  "จ T000 ผ่าน": (s) => api(staff.token, "PUT", "/api/admin/t000/review", { studentId: s.pk, status: "DOCS_APPROVED" }),
  "จ T000 ส่งกลับแก้": (s) => api(staff.token, "PUT", "/api/admin/t000/review", { studentId: s.pk, status: "EDITS_REQUIRED", comment: "แก้" }),
  "จ ออกหนังสือขอความอนุเคราะห์": (s) => api(staff.token, "PUT", "/api/admin/t000/review", fdOf({ studentId: String(s.pk), status: "REQ_LETTER_ISSUED", reqDocNumber: `660301.26.6.2/${7000 + s.pk % 1000}`, reqDocDate: day(0) })),
  "จ ใบตอบรับผ่าน": (s) => api(staff.token, "PUT", "/api/admin/t000/review", { studentId: s.pk, status: "ACCEPTANCE_CHECKED" }),
  "จ ใบตอบรับส่งกลับ": (s) => api(staff.token, "PUT", "/api/admin/t000/review", { studentId: s.pk, status: "WAITING_FOR_PLACEMENT_LETTER", comment: "แก้" }),
  "จ ตั้งสถานะที่หน้าเว็บไม่ส่ง (QUALIFIED)": (s) => api(staff.token, "PUT", "/api/admin/t000/review", { studentId: s.pk, status: "QUALIFIED" }),
  "จ บันทึกรับใบตอบรับ": (s) => api(staff.token, "POST", "/api/admin/t000/acceptance-received", fdOf({ studentId: String(s.pk) })),
  "จ ออกหนังสือส่งตัว": (s) => api(staff.token, "PUT", "/api/admin/t000/review", fdOf({ studentId: String(s.pk), status: "PLACEMENT_LETTER_ISSUED", placeDocNumber: `660301.26.6.2/${6000 + s.pk % 1000}`, placeDocDate: day(0), actualStartDate: day(10), actualEndDate: day(100) })),
  "จ ร่างหนังสือขอความอนุเคราะห์": (s) => api(staff.token, "PUT", "/api/admin/t000/letter-pending", { studentId: s.pk, letter: "REQUEST", docNumber: `660301.26.6.2/${5000 + s.pk % 1000}` }),
  "จ ร่างหนังสือส่งตัว": (s) => api(staff.token, "PUT", "/api/admin/t000/letter-pending", { studentId: s.pk, letter: "PLACEMENT", docNumber: `660301.26.6.2/${4000 + s.pk % 1000}` }),
  "จ ผ่าน T002": (s) => api(staff.token, "PUT", "/api/admin/documents/review-t002", { studentId: s.pk, status: "T002_SUBMITTED" }),
  "จ ผ่าน T003": (s) => api(staff.token, "PUT", "/api/admin/documents/review-t003", { studentId: s.pk, status: "T003_APPROVED" }),
};

// ───── ที่ทำได้ (ที่เหลือต้องโดนปฏิเสธ) ─────
const INTERN: St[] = ["INTERNSHIP_STARTED", "T002_SUBMITTED", "T002_EDITS_REQUIRED", "T003_SUBMITTED", "T003_EDITS_REQUIRED", "T003_APPROVED"];
const T000_OPEN: St[] = ["QUALIFIED", "WAITING_FOR_STAFF_CHECK", "EDITS_REQUIRED"];
const T000_REVIEW: St[] = [...T000_OPEN, "DOCS_APPROVED"];
const ACC_REVIEW: St[] = ["WAITING_FOR_PLACEMENT_LETTER", "WAITING_FOR_STAFF_CHECK_LETTER", "ACCEPTANCE_CHECKED"];
const PRE_T000: St[] = ["APPLYING", "PENDING_GRADE", "QUALIFICATION_FAILED", "APPLICATION_EDITS_REQUIRED", "QUALIFIED"];
const ALL = [...STATUSES];
const ALLOW: Record<string, St[] | "ไม่มี"> = {
  "นศ ยื่นคำร้อง": ["NOT_SUBMITTED", "APPLICATION_EDITS_REQUIRED"],
  "นศ บันทึกฟอร์มคำร้อง": ALL,                                  // ข้อมูลติดต่อ/ผู้ติดต่อฉุกเฉิน แก้ได้ตลอด (ตั้งใจ)
  "นศ ส่งเอกสาร T000": T000_OPEN,
  "นศ ลบเอกสาร T000": T000_OPEN,
  "นศ ส่งใบตอบรับ": ["REQ_LETTER_ISSUED", "WAITING_FOR_PLACEMENT_LETTER", "WAITING_FOR_STAFF_CHECK_LETTER", "ACCEPTANCE_CHECKED"],
  "นศ ส่งไฟล์ T002": INTERN,
  "นศ ส่งไฟล์ T003": INTERN,
  "นศ บันทึกฟอร์ม T002": INTERN,
  "นศ บันทึกฟอร์ม T003": INTERN,
  "นศ เสนอวันนิเทศ": INTERN,
  "นศ รับหนังสือขอความอนุเคราะห์": ["REQ_LETTER_ISSUED"],
  "นศ รับหนังสือส่งตัว": ["PLACEMENT_LETTER_ISSUED"],
  "นศ เปลี่ยนบริษัท": STATUSES.filter((x) => IDX(x) <= IDX("DOCS_APPROVED")),
  "อ ผ่านคำร้อง": "ไม่มี",                                        // อาจารย์ที่ปรึกษาไม่ได้พิจารณาคำร้อง
  "อ ตีกลับคำร้อง": "ไม่มี",
  "อ ผ่าน T002": INTERN,
  "อ ผ่าน T003": INTERN,
  "ป ผ่านคำร้อง (หลักสูตรตัวเอง)": ["APPLYING", "PENDING_GRADE"],
  "ป ผ่านคำร้อง (หลักสูตรอื่น)": "ไม่มี",
  "จ ผ่านคำร้อง": PRE_T000,                                       // พิจารณาใหม่ได้จนกว่าจะส่ง T000
  "จ อนุมัติเอกสารรายชิ้น": T000_REVIEW,
  "จ อนุมัติเอกสารทั้งหมด": T000_REVIEW,
  "จ T000 ผ่าน": T000_REVIEW,
  "จ T000 ส่งกลับแก้": T000_REVIEW,
  "จ ออกหนังสือขอความอนุเคราะห์": after("DOCS_APPROVED"),          // หลังออกแล้ว = พิมพ์ซ้ำ (สถานะคงเดิม)
  "จ ใบตอบรับผ่าน": ACC_REVIEW,
  "จ ใบตอบรับส่งกลับ": ACC_REVIEW,
  "จ ตั้งสถานะที่หน้าเว็บไม่ส่ง (QUALIFIED)": "ไม่มี",
  "จ บันทึกรับใบตอบรับ": ["REQ_LETTER_ISSUED", "WAITING_FOR_PLACEMENT_LETTER"],
  "จ ออกหนังสือส่งตัว": after("ACCEPTANCE_CHECKED"),
  "จ ร่างหนังสือขอความอนุเคราะห์": after("DOCS_APPROVED"),
  "จ ร่างหนังสือส่งตัว": after("ACCEPTANCE_CHECKED"),
  "จ ผ่าน T002": INTERN,
  "จ ผ่าน T003": INTERN,
};
const NO_FORMS = new Set(["นศ ส่งไฟล์ T002", "นศ ส่งไฟล์ T003"]);       // ยังไม่ส่งฟอร์ม = ส่งได้ (ไม่งั้นติด "รอตรวจอยู่")

test("ทุกปุ่มมีกติกา (ปุ่มใหม่ต้องใส่ใน ALLOW)", () => {
  expect(Object.keys(ACTIONS).filter((a) => !(a in ALLOW))).toEqual([]);
});

for (const [name, act] of Object.entries(ACTIONS)) {
  test(`ข้ามขั้นไม่ได้: ${name}`, async () => {
    test.setTimeout(120_000);
    const allow = ALLOW[name] === "ไม่มี" ? [] : (ALLOW[name] as St[]);
    const wrong: string[] = [];
    for (const s of STATUSES) {
      const st = await studentIn(s, !NO_FORMS.has(name));
      const r = await act(st);
      const now = (await k.coop(st.pk))?.status;
      const ok = r.status < 300;
      if (r.status >= 500) wrong.push(`${s}: 500 ${JSON.stringify(r.body)}`);
      else if (ok && !allow.includes(s)) wrong.push(`${s}: ทำได้ทั้งที่ไม่ควร → ${now}`);
      else if (!ok && allow.includes(s)) wrong.push(`${s}: ควรทำได้ แต่ได้ ${r.status} ${r.body?.message}`);
      else if (!ok && now !== s) wrong.push(`${s}: ถูกปฏิเสธแต่สถานะเปลี่ยนเป็น ${now}`);
    }
    expect(wrong).toEqual([]);
  });
}
