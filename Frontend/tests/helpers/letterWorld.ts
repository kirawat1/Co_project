/**
 * tests/helpers/letterWorld.ts
 * ─────────────────────────────────────────────────────
 * ข้อมูลทดสอบเรื่องหนังสือ (letters.e2e.spec.ts) — backend + DB จริง ไม่ mock
 * นักศึกษาคนละขั้นพร้อมกันหลายคน (ต่างจาก e2eSeed ที่เดินคนเดียวตั้งแต่ต้น) เพื่อทดสอบกรณีข้างทาง:
 * รอลงนาม/ยกเลิก · พิมพ์ซ้ำ · เลขที่ซ้ำข้ามประเภท · ออกร่างหลายคน · วิธีจัดส่ง → สถานะ · นักศึกษาโหลดหนังสือ
 *
 * เลขที่หนังสือทุกเลขขึ้นต้น ZW<stamp> — ไม่ชนข้อมูลจริง · cleanup ลบทั้งหมด (รวม DocNumberLock)
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../backend");
require(path.join(BACKEND_DIR, "node_modules/dotenv")).config({ path: path.join(BACKEND_DIR, ".env") });
const prisma = require(path.join(BACKEND_DIR, "config/prismaClient.js"));
const jwt = require(path.join(BACKEND_DIR, "node_modules/jsonwebtoken"));

export const API = "http://localhost:5000";
export type Role = "student" | "teacher" | "staff";
export interface Res { status: number; body: any }

export async function api(token: string, method: string, url: string, body?: any): Promise<Res> {
  const init: RequestInit = { method, headers: { Authorization: `Bearer ${token}` } };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) { init.body = JSON.stringify(body); (init.headers as any)["Content-Type"] = "application/json"; }
  const r = await fetch(API + url, init);
  return { status: r.status, body: await r.json().catch(() => null) };
}

export const PDF = Buffer.from("%PDF-1.4\nletters e2e\n%%EOF");
export function signedForm(fields: Record<string, string | number>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
  fd.append("file", new Blob([PDF], { type: "application/pdf" }), "signed.pdf");
  return fd;
}

export interface WorldStudent { key: string; userId: number; pk: number; studentId: string; token: string }

export class LetterWorld {
  stamp = Date.now();
  tail = String(this.stamp).slice(-5);
  staff!: { userId: number; token: string; email: string };
  teacherPk!: number;
  teacherUserId!: number;
  periodId!: number;
  companyA!: string;
  companyB!: string;
  s: Record<string, WorldStudent> = {};
  supervisionId!: number;

  /** เลขที่หนังสือของรอบทดสอบนี้ — เลขท้ายเป็นตัวเลข (ออกร่างหลายคนต้องการ) */
  no(n: number) { return `ZW${this.tail}.26/${n}`; }

  token(userId: number, role: Role) {
    return jwt.sign({ id: userId, role, tv: 0 }, process.env.JWT_SECRET, { expiresIn: "30m" });
  }

  async setup() {
    const tag = `zw${this.stamp}`;
    const staffUser = await prisma.user.create({ data: { username: `${tag}-staff`, email: `${tag}-staff@kkumail.com`, password: "x", role: "staff" } });
    await prisma.staffProfile.create({ data: { userId: staffUser.id, firstName: "ทดสอบ", lastName: "หนังสือ" } });
    this.staff = { userId: staffUser.id, token: this.token(staffUser.id, "staff"), email: staffUser.email };

    const tUser = await prisma.user.create({ data: { username: `${tag}-teacher`, email: `${tag}-teacher@kkumail.com`, password: "x", role: "teacher" } });
    const teacher = await prisma.teacher.create({ data: { userId: tUser.id, prefix: "อ.", firstName: "ทดสอบ", lastName: "นิเทศ", email: tUser.email, isCoopTeacher: true } });
    this.teacherPk = teacher.id;
    this.teacherUserId = tUser.id;

    const win = { startDate: new Date(Date.now() - 86_400_000 * 30), endDate: new Date(Date.now() + 86_400_000 * 120) };
    const period = await prisma.coopPeriod.create({
      data: { academicYear: `ZW${this.tail}`, semester: 8, ...win, majors: { create: [{ major: "CS", ...win, isActive: true }] } },
    });
    this.periodId = period.id;

    const mkCompany = async (name: string) => {
      const c = await prisma.company.create({ data: { name, address: "ขอนแก่น", province: "ขอนแก่น", createdById: staffUser.id } });
      await prisma.companyContact.create({ data: { firstName: "คุณทดสอบ", lastName: name.slice(-1), position: "HR", companyId: c.id, createdById: staffUser.id } });
      return c.id as string;
    };
    this.companyA = await mkCompany(`บริษัท ZW${this.tail} เอ จำกัด`);
    this.companyB = await mkCompany(`บริษัท ZW${this.tail} บี จำกัด`);

    // key → [สถานะ, บริษัท, ข้อมูลหนังสือที่มีอยู่แล้ว]
    const plan: [string, string, string, Record<string, any>][] = [
      ["reqA1", "DOCS_APPROVED", this.companyA, {}],
      ["reqA2", "DOCS_APPROVED", this.companyA, {}],
      ["reqB", "DOCS_APPROVED", this.companyB, {}],
      ["place", "ACCEPTANCE_CHECKED", this.companyB, { reqDocNumber: this.no(1), reqLetterUrl: "zw-req.pdf" }],
      ["placeStaff", "ACCEPTANCE_CHECKED", this.companyB, { reqDocNumber: this.no(2), reqLetterUrl: "zw-req.pdf" }],
      ["placed", "PLACEMENT_LETTER_ISSUED", this.companyA, { reqDocNumber: this.no(3), placeDocNumber: this.no(4), reqLetterUrl: "zw-req.pdf", placeLetterUrl: "zw-place.pdf" }],
      ["intern", "INTERNSHIP_STARTED", this.companyA, { reqDocNumber: this.no(5), placeDocNumber: this.no(6), reqLetterUrl: "zw-req.pdf", placeLetterUrl: "zw-place.pdf" }],
      ["reqIssued", "REQ_LETTER_ISSUED", this.companyA, { reqDocNumber: this.no(7), reqLetterUrl: "zw-req.pdf" }],
    ];
    let i = 0;
    for (const [key, status, companyId, letter] of plan) {
      i++;
      const u = await prisma.user.create({ data: { username: `${tag}-${key}`, email: `${tag}-${key}@kkumail.com`, password: "x", role: "student" } });
      const st = await prisma.student.create({
        data: {
          userId: u.id, studentId: `ZW${this.tail}${String(i).padStart(2, "0")}`, prefix: "MR", firstName: `นักศึกษา${key}`, lastName: "ทดสอบหนังสือ",
          email: u.email, major: "CS", year: "4", studyProgram: "normal", coopAdvisorId: teacher.id,
        },
      });
      const contact = await prisma.companyContact.findFirst({ where: { companyId } });
      await prisma.studentCoop.create({
        data: {
          studentId: st.id, status, companyId, coopPeriodId: period.id,
          actualStartDate: new Date("2026-12-01"), actualEndDate: new Date("2027-03-31"),
          contacts: { connect: [{ id: contact.id }] },
          ...letter,
        },
      });
      // หน้า T000 แสดงเฉพาะคนที่มีไฟล์เอกสารแล้ว (ของจริงทุกคนที่ผ่านตรวจมีไฟล์ T000)
      await prisma.document.create({ data: { studentId: st.id, type: "CP-TRANSCRIPT", path: "zw-none.pdf", name: "transcript.pdf", status: "APPROVED" } });
      this.s[key] ={ key, userId: u.id, pk: st.id, studentId: st.studentId, token: this.token(u.id, "student") };
    }

    // นัดนิเทศของ intern ยืนยันวันแล้ว → ออกหนังสือขอนิเทศได้
    const sup = await prisma.supervisionAppointment.create({
      data: {
        studentId: this.s.intern.pk, teacherId: teacher.id, proposedDates: "[]", supervisionType: "ONLINE",
        confirmedDate: new Date("2027-01-15T06:30:00Z"), status: "DATE_CONFIRMED",
      },
    });
    this.supervisionId = sup.id;
  }

  coop(key: string) { return prisma.studentCoop.findUnique({ where: { studentId: this.s[key].pk } }); }
  supervision() { return prisma.supervisionAppointment.findUnique({ where: { id: this.supervisionId } }); }

  /** ล้างป้ายรอลงนามของทุกคน (เทสต์แต่ละข้อเริ่มสะอาด) */
  async clearPending() {
    const pks = Object.values(this.s).map((x) => x.pk);
    await prisma.studentCoop.updateMany({ where: { studentId: { in: pks } }, data: {
      reqLetterPendingAt: null, reqLetterDraftNumber: null, reqLetterDraftDate: null,
      placeLetterPendingAt: null, placeLetterDraftNumber: null, placeLetterDraftDate: null,
    } });
    await prisma.supervisionAppointment.update({ where: { id: this.supervisionId }, data: { letterPendingAt: null, letterDraftNumber: null, letterDraftDate: null } });
  }

  async cleanup() {
    const pks = Object.values(this.s).map((x) => x.pk);
    const userIds = [...Object.values(this.s).map((x) => x.userId), this.staff?.userId, this.teacherUserId].filter(Boolean);
    const files = (await prisma.document.findMany({ where: { studentId: { in: pks } }, select: { path: true } })).map((d: any) => d.path);
    await prisma.supervisionAppointment.deleteMany({ where: { studentId: { in: pks } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.document.deleteMany({ where: { studentId: { in: pks } } });
    await prisma.studentCoop.deleteMany({ where: { studentId: { in: pks } } });
    await prisma.student.deleteMany({ where: { id: { in: pks } } });
    await prisma.companyContact.deleteMany({ where: { companyId: { in: [this.companyA, this.companyB].filter(Boolean) } } });
    await prisma.company.deleteMany({ where: { id: { in: [this.companyA, this.companyB].filter(Boolean) } } });
    if (this.teacherPk) await prisma.teacher.deleteMany({ where: { id: this.teacherPk } });
    if (this.staff) await prisma.staffProfile.deleteMany({ where: { userId: this.staff.userId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (this.periodId) await prisma.coopPeriod.deleteMany({ where: { id: this.periodId } });
    await prisma.docNumberLock.deleteMany({ where: { number: { startsWith: `ZW${this.tail}` } } });
    // ไฟล์ฉบับลงนามที่เทสต์อัปโหลด
    const fs = require("node:fs");
    for (const f of files) { try { fs.unlinkSync(path.join(BACKEND_DIR, "uploads", f)); } catch { /* ไม่มีไฟล์ */ } }
  }

  async disconnect() { await prisma.$disconnect(); }
}
