/**
 * demo/data.ts — ข้อมูลสาธิต (สร้างในฐานข้อมูลตาม backend/.env · ลบได้ด้วย resetDemo)
 *
 * ทุกอย่างของ demo มีป้ายชัด: บัญชี username ขึ้นต้น "demo." · หลักสูตร DEMO · บริษัทชื่อขึ้นต้น "บริษัท ตัวอย่าง"
 * · เลขที่หนังสือลงท้าย "/สาธิต…" · รอบที่ demo สร้างจดไว้ใน demo/.state.json
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_DIR = path.resolve(HERE, "../../backend");
require(path.join(BACKEND_DIR, "node_modules/dotenv")).config({ path: path.join(BACKEND_DIR, ".env") });
if ((process.env.NODE_ENV || "").toLowerCase() === "production") throw new Error("backend/.env เป็น production — ไม่สร้างข้อมูลสาธิต");
export const prisma = require(path.join(BACKEND_DIR, "config/prismaClient.js"));
const bcrypt = require(path.join(BACKEND_DIR, "node_modules/bcryptjs"));
const UPLOADS = path.join(BACKEND_DIR, "uploads");
const STATE = path.join(HERE, ".state.json");
const FILES = path.join(HERE, ".files");

export const MAJOR = "DEMO";
export const MAJOR_NAME = "หลักสูตรสาธิตระบบ";
export const PASSWORD = "demo1234";
// เลขที่หนังสือของ demo = 9xxxx (ออกหลายฉบับไล่เลขท้ายที่เป็นตัวเลข) — ล้างเฉพาะเลขที่ข้อมูลสาธิตใช้จริง
export const DOC_NO = (n: number) => `660301.26.6.2/${90000 + n}`;
const DAY = 86_400_000;
export const isoDay = (n: number) => new Date(Date.now() + n * DAY).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

export const ACCOUNTS = {
  staff: { email: "demo.staff@kkumail.com", name: "นางสาวสุดา ตัวอย่าง" },
  teacher: { email: "demo.teacher@kkumail.com", name: "ผศ.ดร.ธนา ตัวอย่าง" },
};
export const STUDENTS = [
  { key: "s1", studentId: "669990001-1", prefix: "MR", first: "สมชาย", last: "ตัวอย่าง" },
  { key: "s2", studentId: "669990002-2", prefix: "MS", first: "สมหญิง", last: "ตัวอย่าง" },
  { key: "s3", studentId: "669990003-3", prefix: "MR", first: "ปิติ", last: "ตัวอย่าง" },
  { key: "s4", studentId: "669990004-4", prefix: "MS", first: "มานี", last: "ตัวอย่าง" },
] as const;
export const studentEmail = (key: string) => `demo.${key}@kkumail.com`;
export const COMPANY = { name: "บริษัท ตัวอย่างซอฟต์แวร์ จำกัด", hr: "วิภา", hrLast: "ฝ่ายบุคคล" };

interface DemoState { periodIds: number[] }
const readState = (): DemoState => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return { periodIds: [] }; } };
const writeState = (s: DemoState) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
export function rememberPeriod(id: number) { const s = readState(); if (!s.periodIds.includes(id)) s.periodIds.push(id); writeState(s); }

/** ปีการศึกษาที่ยังไม่มีในระบบ (รอบที่ demo สร้างจะลบได้โดยไม่แตะรอบจริง) */
export async function freeAcademicYear() {
  const thisYear = new Date().getFullYear() + 543;
  for (let y = thisYear + 1; y < thisYear + 30; y++) {
    if (!(await prisma.coopPeriod.findFirst({ where: { academicYear: String(y) } }))) return String(y);
  }
  throw new Error("หาปีการศึกษาว่างสำหรับสาธิตไม่ได้");
}

// ═════════════ ลบข้อมูลสาธิตทั้งหมด ═════════════
export async function resetDemo() {
  const users = await prisma.user.findMany({ where: { username: { startsWith: "demo." } }, select: { id: true } });
  const userIds = users.map((u: { id: number }) => u.id);
  const students = await prisma.student.findMany({ where: { OR: [{ userId: { in: userIds } }, { major: MAJOR }] }, select: { id: true } });
  const pks = students.map((s: { id: number }) => s.id);
  const teachers = (await prisma.teacher.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((t: { id: number }) => t.id);

  // ไฟล์ที่อัปโหลด/ออกหนังสือของนักศึกษาสาธิต
  const files = new Set<string>();
  const numbers = new Set<string>(); // เลขที่หนังสือที่ข้อมูลสาธิตจองไว้ (DocNumberLock)
  for (const d of await prisma.document.findMany({ where: { studentId: { in: pks } }, select: { path: true } })) files.add(d.path);
  const collect = (row: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(row)) {
      if (typeof v !== "string") continue;
      if (/\.(pdf|png|jpe?g|docx?)$/i.test(v)) files.add(v);
      if (/DocNumber$|DraftNumber$/i.test(k)) numbers.add(v);
    }
  };
  for (const c of await prisma.studentCoop.findMany({ where: { studentId: { in: pks } } })) collect(c);
  const appts = await prisma.supervisionAppointment.findMany({ where: { OR: [{ studentId: { in: pks } }, { teacherId: { in: teachers } }] } });
  for (const a of appts) collect(a);
  const apptIds = appts.map((a: { id: number }) => a.id);

  await prisma.supervisionCoTeacher.deleteMany({ where: { OR: [{ appointmentId: { in: apptIds } }, { teacherId: { in: teachers } }] } });
  await prisma.supervisionAppointment.deleteMany({ where: { id: { in: apptIds } } });
  await prisma.visit.deleteMany({ where: { studentId: { in: pks } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.document.deleteMany({ where: { studentId: { in: pks } } });
  await prisma.coopT002Form.deleteMany({ where: { studentId: { in: pks } } });
  await prisma.coopT003Form.deleteMany({ where: { studentId: { in: pks } } });
  await prisma.coopApplicationForm.deleteMany({ where: { studentId: { in: pks } } });
  await prisma.studentCoop.deleteMany({ where: { studentId: { in: pks } } });
  await prisma.student.deleteMany({ where: { id: { in: pks } } });
  const companyIds = (await prisma.company.findMany({ where: { OR: [{ createdById: { in: userIds } }, { name: COMPANY.name }] }, select: { id: true } })).map((c: { id: string }) => c.id);
  await prisma.mentor.deleteMany({ where: { OR: [{ companyId: { in: companyIds } }, { createdById: { in: userIds } }] } });
  await prisma.companyContact.deleteMany({ where: { OR: [{ companyId: { in: companyIds } }, { createdById: { in: userIds } }] } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  await prisma.announcement.deleteMany({ where: { authorId: { in: userIds } } });
  await prisma.feedback.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.coopTeacherMajor.deleteMany({ where: { OR: [{ teacherId: { in: teachers } }, { major: MAJOR }] } });
  await prisma.teacher.deleteMany({ where: { id: { in: teachers } } });
  await prisma.staffProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  const st = readState();
  await prisma.coopPeriod.deleteMany({ where: { id: { in: st.periodIds } } });
  writeState({ periodIds: [] });
  await prisma.coopPeriodMajor.deleteMany({ where: { major: MAJOR } });
  await prisma.documentRequirementMajor.deleteMany({ where: { major: MAJOR } });
  await prisma.systemConfig.deleteMany({ where: { key: { endsWith: `@${MAJOR}` } } });
  await prisma.coopCriteria.deleteMany({ where: { major: MAJOR } });
  await prisma.docNumberLock.deleteMany({ where: { number: { in: [...numbers] } } });
  for (const f of files) {
    const full = path.resolve(UPLOADS, f.replace(/^\/?uploads\//, ""));
    if (full.startsWith(UPLOADS + path.sep)) { try { fs.unlinkSync(full); } catch { /* ไม่มีไฟล์ */ } }
  }
  return { users: userIds.length, students: pks.length };
}

// ═════════════ สร้างข้อมูลตั้งต้น ═════════════
export interface Base { staffUserId: number; teacherPk: number; teacherUserId: number; companyId: string; contactId: string }

export async function seedBase(): Promise<Base> {
  const hash = await bcrypt.hash(PASSWORD, 10);
  await prisma.coopCriteria.create({ data: { major: MAJOR, nameTh: MAJOR_NAME } });
  const staff = await prisma.user.create({ data: { username: "demo.staff", email: ACCOUNTS.staff.email, password: hash, role: "staff" } });
  await prisma.staffProfile.create({ data: { userId: staff.id, firstName: "สุดา", lastName: "ตัวอย่าง" } });
  const tu = await prisma.user.create({ data: { username: "demo.teacher", email: ACCOUNTS.teacher.email, password: hash, role: "teacher" } });
  const teacher = await prisma.teacher.create({ data: { userId: tu.id, prefix: "ผศ.ดร.", firstName: "ธนา", lastName: "ตัวอย่าง", email: tu.email, major: MAJOR, isCoopTeacher: true } });
  await prisma.coopTeacherMajor.create({ data: { teacherId: teacher.id, major: MAJOR } });
  const company = await prisma.company.create({ data: {
    name: COMPANY.name, address: "123 ถนนมิตรภาพ ตำบลในเมือง อำเภอเมืองขอนแก่น จังหวัดขอนแก่น 40000",
    addressNo: "123", road: "มิตรภาพ", subDistrict: "ในเมือง", district: "เมืองขอนแก่น", province: "ขอนแก่น", zipcode: "40000",
    phone: "043-000000", email: "contact@example.com", createdById: staff.id,
  } });
  const contact = await prisma.companyContact.create({ data: { companyId: company.id, firstName: COMPANY.hr, lastName: COMPANY.hrLast, position: "ผู้จัดการฝ่ายบุคคล", email: "hr@example.com", phone: "043-000000" } });
  return { staffUserId: staff.id, teacherPk: teacher.id, teacherUserId: tu.id, companyId: company.id, contactId: contact.id };
}

/** ข้อมูลส่วนตัวในใบสมัคร T000 (ที่อยู่/ผู้ปกครอง) กรอกไว้ก่อน — ขั้นสาธิตกรอกเฉพาะวันฝึกและเป้าหมาย */
const FORM = {
  contactAddrNo: "99/9", contactRoad: "มิตรภาพ", contactSubDistrict: "ในเมือง", contactDistrict: "เมืองขอนแก่น", contactProvince: "ขอนแก่น", contactZipcode: "40000",
  contactAddress: "99/9 ถนนมิตรภาพ ตำบลในเมือง อำเภอเมืองขอนแก่น จังหวัดขอนแก่น 40000", contactPhone: "0812345678",
  emergencyName: "นางสมใจ ตัวอย่าง", emergencyRelation: "มารดา", emergencyJob: "ค้าขาย",
  emerAddrNo: "99/9", emerRoad: "มิตรภาพ", emerSubDistrict: "ในเมือง", emerDistrict: "เมืองขอนแก่น", emerProvince: "ขอนแก่น", emerZipcode: "40000",
  emergencyAddress: "99/9 ถนนมิตรภาพ ตำบลในเมือง อำเภอเมืองขอนแก่น จังหวัดขอนแก่น 40000", emergencyPhone: "0898765432",
};

export async function seedStudent(i: number, base: Base, o: { coop?: Record<string, unknown> | null; form?: Record<string, unknown>; company?: boolean } = {}) {
  const s = STUDENTS[i];
  const hash = await bcrypt.hash(PASSWORD, 10);
  const u = await prisma.user.create({ data: { username: `demo.${s.key}`, email: studentEmail(s.key), password: hash, role: "student" } });
  const st = await prisma.student.create({ data: {
    userId: u.id, studentId: s.studentId, prefix: s.prefix, firstName: s.first, lastName: s.last, email: u.email,
    major: MAJOR, year: "4", phone: "0812345678", studyProgram: "normal", gpa: 3.25, coopAdvisorId: base.teacherPk,
  } });
  await prisma.coopApplicationForm.create({ data: { studentId: st.id, ...FORM, contactEmail: u.email, ...(o.form || {}) } });
  if (o.coop !== null) {
    await prisma.studentCoop.create({ data: {
      studentId: st.id, status: "NOT_SUBMITTED",
      ...(o.company ? { companyId: base.companyId, contacts: { connect: [{ id: base.contactId }] } } : {}),
      ...(o.coop || {}),
    } });
  }
  return { pk: st.id as number, userId: u.id as number, ...s, email: u.email as string };
}

// ═════════════ ไฟล์ PDF ตัวอย่าง (มีข้อความไทยจริง ให้เปิดดูแล้วรู้ว่าเป็นเอกสารอะไร) ═════════════
export async function samplePdf(name: string, title: string, lines: string[] = []) {
  fs.mkdirSync(FILES, { recursive: true });
  const file = path.join(FILES, `${name}.pdf`);
  if (fs.existsSync(file)) return file;
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent(`<!doctype html><html lang="th"><head><meta charset="utf-8"><style>
    body{font-family:'Sarabun','Leelawadee UI',Tahoma,sans-serif;padding:60px 70px;color:#0f172a}
    h1{font-size:26px;margin:0 0 6px}.tag{display:inline-block;background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:999px;font-size:14px}
    p{font-size:17px;line-height:1.7}.box{margin-top:30px;border:2px dashed #cbd5e1;border-radius:12px;padding:30px;text-align:center;color:#64748b}
  </style></head><body><span class="tag">เอกสารตัวอย่างสำหรับสาธิตระบบ</span><h1>${title}</h1>
  ${lines.map((l) => `<p>${l}</p>`).join("")}<div class="box">( เนื้อหาเอกสารจริงจะอยู่ตรงนี้ )</div></body></html>`);
  await p.pdf({ path: file, format: "A4" });
  await b.close();
  return file;
}

/** คัดลอกไฟล์ตัวอย่างเข้า uploads (ข้อมูลที่ seed ตรง เช่น เอกสารที่ส่งไว้ก่อนแล้ว) */
export function putUpload(src: string, name: string) {
  const dest = path.join(UPLOADS, name);
  fs.copyFileSync(src, dest);
  return name;
}

// ═════════════ เริ่มกลางทาง: รอบเปิดอยู่แล้ว + นักศึกษาผ่านขั้นก่อนหน้า ═════════════
const { requiredDocKeys } = require(path.join(BACKEND_DIR, "utils/submittedSteps.js"));

/** รอบที่เปิดรับสมัคร + เปิดนัดนิเทศของหลักสูตรสาธิต (สร้างตรงในฐานข้อมูล) */
export async function seedOpenPeriod() {
  const year = await freeAcademicYear();
  const s = new Date(isoDay(-30)), e = new Date(isoDay(60));
  const p = await prisma.coopPeriod.create({ data: {
    academicYear: year, semester: 1, startDate: s, endDate: e,
    majors: { create: [{ major: MAJOR, startDate: s, endDate: e, isActive: true, isSupervisionOpen: true, supervisionStartDate: new Date(isoDay(-1)), supervisionEndDate: new Date(isoDay(120)) }] },
  } });
  rememberPeriod(p.id);
  return { id: p.id as number, label: `1/${year}` };
}

export async function seedCompany(name: string, hr: string, staffUserId: number) {
  const c = await prisma.company.create({ data: {
    name, address: "456 ถนนศรีจันทร์ ตำบลในเมือง อำเภอเมืองขอนแก่น จังหวัดขอนแก่น 40000",
    addressNo: "456", road: "ศรีจันทร์", subDistrict: "ในเมือง", district: "เมืองขอนแก่น", province: "ขอนแก่น", zipcode: "40000",
    phone: "043-111111", createdById: staffUserId,
  } });
  const ct = await prisma.companyContact.create({ data: { companyId: c.id, firstName: hr, lastName: "ฝ่ายบุคคล", position: "เจ้าหน้าที่ฝ่ายบุคคล", email: "hr2@example.com" } });
  return { id: c.id as string, contactId: ct.id as string, name };
}

/**
 * นักศึกษาที่ผ่านขั้นเอกสาร T000 แล้ว (ไฟล์จริงทุกหัวข้อ ผ่านแล้ว) ในสถานะที่ระบุ
 * coop เพิ่มเติม เช่น เลข/ไฟล์หนังสือที่ออกแล้ว
 */
export async function seedReadyStudent(i: number, base: Base, periodId: number, company: { id: string; contactId: string }, status: string, coop: Record<string, unknown> = {}) {
  const st = await seedStudent(i, base, {
    coop: { status, coopPeriodId: periodId, companyId: company.id, contacts: { connect: [{ id: company.contactId }] }, jobPosition: "Software Developer", ...coop },
    form: { startDate: new Date(isoDay(45)), endDate: new Date(isoDay(165)), careerObjective1: "นักพัฒนาซอฟต์แวร์" },
  });
  const keys: string[] = await requiredDocKeys(prisma, MAJOR);
  const titles = Object.fromEntries((await prisma.documentRequirement.findMany({ where: { docKey: { in: keys } }, select: { docKey: true, title: true } })).map((r: { docKey: string; title: string }) => [r.docKey, r.title]));
  for (const k of keys) {
    const file = await samplePdf(`doc-${k}`, titles[k] || k, ["(เอกสารที่นักศึกษาส่งไว้ก่อนแล้ว)"]);
    const name = putUpload(file, `demo-${st.key}-${k}.pdf`);
    await prisma.document.create({ data: { studentId: st.pk, type: k, path: name, name: `${titles[k] || k}.pdf`, status: "APPROVED" } });
  }
  return st;
}

/** ไฟล์หนังสือที่ออกแล้ว (สำหรับนักศึกษาที่เริ่มกลางทาง) */
export async function seedLetterFile(key: string, kind: string, title: string) {
  return putUpload(await samplePdf(`letter-${kind}`, title, ["(ฉบับลงนาม — ข้อมูลตั้งต้นของการสาธิต)"]), `demo-${key}-${kind}.pdf`);
}
