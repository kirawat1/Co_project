/**
 * tests/helpers/t000World.ts
 * ─────────────────────────────────────────────────────
 * ข้อมูลทดสอบเอกสาร T000 / ใบตอบรับ (t000.e2e.spec.ts) — backend + DB จริง ไม่ mock
 * นักศึกษาคนละขั้นพร้อมกัน: ยังไม่ส่ง · ถูกส่งกลับแก้ · เอกสารผ่านแล้ว · รอ/ตีกลับใบตอบรับ · ออกหนังสือส่งตัวแล้ว ฯลฯ
 * สองรอบ (หลักสูตร CS): รอบเปิด (กำหนดส่ง T000 อีกไกล) · รอบเลยกำหนด (HARD เมื่อวาน) — ทดสอบส่งแก้หลังกำหนด/ขยายเวลา
 *
 * หัวข้อบังคับอ่านจาก DB ตอนรัน (requiredDocKeys ของ backend) — ไม่ผูกกับหัวข้อที่ตั้งไว้ในเครื่องนี้
 * cleanup ลบทุกอย่างที่สร้าง รวมแจ้งเตือนที่ส่งถึงเจ้าหน้าที่จริงในเครื่อง (relatedId = นักศึกษาของรอบนี้) และไฟล์ที่อัปโหลด
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PDF } from "./letterWorld";

const require = createRequire(import.meta.url);
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../backend");
require(path.join(BACKEND_DIR, "node_modules/dotenv")).config({ path: path.join(BACKEND_DIR, ".env") });
const prisma = require(path.join(BACKEND_DIR, "config/prismaClient.js"));
const jwt = require(path.join(BACKEND_DIR, "node_modules/jsonwebtoken"));
const { requiredDocKeys } = require(path.join(BACKEND_DIR, "utils/submittedSteps.js"));

export interface WorldStudent { key: string; userId: number; pk: number; studentId: string; token: string }

/** ฟอร์มอัปโหลดของนักศึกษา (POST /api/docs/upload) */
export function uploadForm(docType: string, name = "file.pdf"): FormData {
  const fd = new FormData();
  fd.append("docType", docType);
  fd.append("files", new Blob([PDF], { type: "application/pdf" }), name);
  return fd;
}
/** ฟอร์มของเจ้าหน้าที่ (acceptance-received / acceptance-replace) */
export function staffFileForm(fields: Record<string, string | number>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
  fd.append("file", new Blob([PDF], { type: "application/pdf" }), "acceptance.pdf");
  return fd;
}

type DocSeed = Record<string, string>; // docType → สถานะไฟล์

export class T000World {
  stamp = Date.now();
  startedAt = new Date();
  tail = String(this.stamp).slice(-5);
  staff!: { userId: number; token: string };
  teacher!: { userId: number; pk: number; token: string };
  openPeriodId!: number;
  latePeriodId!: number;
  companyId!: string;
  required: string[] = [];
  titles: Record<string, string> = {}; // docKey → ชื่อหัวข้อที่นักศึกษาเห็น
  s: Record<string, WorldStudent> = {};

  token(userId: number, role: "student" | "teacher" | "staff") {
    return jwt.sign({ id: userId, role, tv: 0 }, process.env.JWT_SECRET, { expiresIn: "30m" });
  }

  /** ไฟล์ครบทุกหัวข้อบังคับในสถานะเดียวกัน (ยกเว้นที่ระบุ) */
  all(status: string, except: DocSeed = {}): DocSeed {
    return Object.fromEntries(this.required.map((k) => [k, except[k] ?? status]));
  }

  async setup() {
    this.required = await requiredDocKeys(prisma, "CS");
    for (const r of await prisma.documentRequirement.findMany({ where: { docKey: { in: this.required }, isActive: true }, select: { docKey: true, title: true } })) this.titles[r.docKey] ??= r.title;
    if (this.required.length < 3) throw new Error(`หลักสูตร CS ต้องมีหัวข้อบังคับอย่างน้อย 3 หัวข้อ (มี ${this.required.length})`);
    const tag = `zt${this.stamp}`;

    const staffUser = await prisma.user.create({ data: { username: `${tag}-staff`, email: `${tag}-staff@kkumail.com`, password: "x", role: "staff" } });
    await prisma.staffProfile.create({ data: { userId: staffUser.id, firstName: "ทดสอบ", lastName: "ทีศูนย์" } });
    this.staff = { userId: staffUser.id, token: this.token(staffUser.id, "staff") };

    const tUser = await prisma.user.create({ data: { username: `${tag}-teacher`, email: `${tag}-teacher@kkumail.com`, password: "x", role: "teacher" } });
    const teacher = await prisma.teacher.create({ data: { userId: tUser.id, prefix: "อ.", firstName: "ทดสอบ", lastName: "ที่ปรึกษา", email: tUser.email } });
    this.teacher = { userId: tUser.id, pk: teacher.id, token: this.token(tUser.id, "teacher") };

    const day = 86_400_000;
    const win = { startDate: new Date(Date.now() - day * 30), endDate: new Date(Date.now() + day * 120) };
    const mkPeriod = async (semester: number, due: string) => (await prisma.coopPeriod.create({
      data: { academicYear: `ZT${this.tail}`, semester, ...win, majors: { create: [{ major: "CS", ...win, isActive: true, deadlines: { T000: { due } } }] } },
    })).id as number;
    const iso = (d: number) => new Date(Date.now() + d).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
    this.openPeriodId = await mkPeriod(8, iso(day * 60));
    this.latePeriodId = await mkPeriod(9, iso(-day * 2));

    const c = await prisma.company.create({ data: { name: `บริษัท ZT${this.tail} จำกัด`, address: "ขอนแก่น", province: "ขอนแก่น", createdById: staffUser.id } });
    this.companyId = c.id;

    const [k0, k1] = this.required;
    // key → [สถานะ, รอบ, ไฟล์, ข้อมูลเพิ่ม]
    const plan: [string, string, "open" | "late", DocSeed, Record<string, any>][] = [
      // ยังไม่ส่ง — อัปโหลดทีละหัวข้อจนครบ = ส่งครั้งแรก
      ["fresh", "QUALIFIED", "open", {}, { t000Status: "WAITING" }],
      // ส่งครั้งแรกครบแล้ว รอตรวจ — อาจารย์ที่ปรึกษาเปลี่ยนผลคุณสมบัติไม่ได้
      ["firstWaiting", "WAITING_FOR_STAFF_CHECK", "open", this.all("WAITING"), { t000Status: "PENDING" }],
      // ถูกส่งกลับแก้ 2 ไฟล์ ในรอบที่เลยกำหนดแล้ว (ส่งแก้ไม่ติดกำหนด)
      ["sentBack", "EDITS_REQUIRED", "late", this.all("APPROVED", { [k0]: "REJECTED", [k1]: "EDITS_REQUIRED" }), { t000Status: "PENDING" }],
      // เอกสารผ่านแล้ว รอออกหนังสือ
      ["approved", "DOCS_APPROVED", "open", this.all("APPROVED"), {}],
      // ยังไม่ส่ง ในรอบที่เลยกำหนด — ส่งไม่ได้จนกว่าจะขยายเวลา
      ["late", "QUALIFIED", "late", {}, { t000Status: "WAITING" }],
      // เจ้าหน้าที่กำลังตรวจ (ไฟล์รอตรวจ) — อนุมัติทั้งหมด / ผ่านรายไฟล์
      ["review", "WAITING_FOR_STAFF_CHECK", "open", this.all("WAITING"), { t000Status: "PENDING" }],
      // ใบตอบรับรอตรวจ
      ["accWait", "WAITING_FOR_STAFF_CHECK_LETTER", "open", { ...this.all("APPROVED"), "CP-ACCEPTANCE": "WAITING" }, { reqLetterUrl: "zt-req.pdf", acceptanceFileUrl: "zt-acc.pdf" }],
      // ข้อมูลเก่า: ตีกลับใบตอบรับเป็น EDITS_REQUIRED ทั้งที่ออกหนังสือขอความอนุเคราะห์แล้ว
      ["accLegacy", "EDITS_REQUIRED", "open", { ...this.all("APPROVED"), "CP-ACCEPTANCE": "REJECTED" }, { reqLetterUrl: "zt-req.pdf" }],
      // ออกหนังสือขอความอนุเคราะห์แล้ว ยังไม่มีใบตอบรับ — บริษัทส่งตรงถึงเจ้าหน้าที่
      ["reqIssued", "REQ_LETTER_ISSUED", "open", this.all("APPROVED"), { reqLetterUrl: "zt-req.pdf" }],
      // ออกหนังสือส่งตัวแล้ว — ใบตอบรับล็อก
      ["placed", "PLACEMENT_LETTER_ISSUED", "open", { ...this.all("APPROVED"), "CP-ACCEPTANCE": "APPROVED" }, { reqLetterUrl: "zt-req.pdf", placeLetterUrl: "zt-place.pdf", acceptanceFileUrl: "zt-acc.pdf" }],
      // ฝึกงานอยู่ — เจ้าหน้าที่ถอยกลับไปขั้นเอกสารไม่ได้
      ["intern", "INTERNSHIP_STARTED", "open", { ...this.all("APPROVED"), "CP-ACCEPTANCE": "APPROVED" }, { reqLetterUrl: "zt-req.pdf", placeLetterUrl: "zt-place.pdf" }],
    ];
    let i = 0;
    for (const [key, status, round, docs, extra] of plan) {
      i++;
      const u = await prisma.user.create({ data: { username: `${tag}-${key}`, email: `${tag}-${key}@kkumail.com`, password: "x", role: "student" } });
      const st = await prisma.student.create({
        data: {
          userId: u.id, studentId: `ZT${this.tail}${String(i).padStart(2, "0")}`, prefix: "MR", firstName: `นักศึกษา${key}`, lastName: "ทดสอบทีศูนย์",
          email: u.email, major: "CS", year: "4", studyProgram: "normal", coopAdvisorId: teacher.id,
        },
      });
      await prisma.studentCoop.create({
        data: { studentId: st.id, status, companyId: c.id, coopPeriodId: round === "open" ? this.openPeriodId : this.latePeriodId, ...extra },
      });
      for (const [type, docStatus] of Object.entries(docs)) {
        await prisma.document.create({ data: { studentId: st.id, type, path: `zt-${key}-${type}.pdf`, name: `${type}.pdf`, status: docStatus } });
      }
      this.s[key] = { key, userId: u.id, pk: st.id, studentId: st.studentId, token: this.token(u.id, "student") };
    }
  }

  coop(key: string) { return prisma.studentCoop.findUnique({ where: { studentId: this.s[key].pk } }); }
  docs(key: string) { return prisma.document.findMany({ where: { studentId: this.s[key].pk }, orderBy: { id: "asc" } }); }
  doc(key: string, type: string) { return prisma.document.findFirst({ where: { studentId: this.s[key].pk, type } }); }
  /** แจ้งเตือนที่เกิดหลังเริ่มรอบนี้ ของนักศึกษาคนนี้ (relatedId = Student.id) */
  notes(key: string, type: string) {
    return prisma.notification.findMany({ where: { relatedId: String(this.s[key].pk), type, createdAt: { gte: this.startedAt } } });
  }

  async cleanup() {
    const pks = Object.values(this.s).map((x) => x.pk);
    const userIds = [...Object.values(this.s).map((x) => x.userId), this.staff?.userId, this.teacher?.userId].filter(Boolean);
    const files = (await prisma.document.findMany({ where: { studentId: { in: pks } }, select: { path: true } })).map((d: any) => d.path);
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    // แจ้งเตือนที่ส่งถึงเจ้าหน้าที่ทุกคนในเครื่อง (นักศึกษาส่ง T000 / ใบตอบรับ)
    await prisma.notification.deleteMany({ where: { relatedId: { in: pks.map(String) }, createdAt: { gte: this.startedAt }, type: { in: ["T000_SUBMITTED", "ACCEPTANCE_UPLOADED"] } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds }, createdAt: { gte: this.startedAt } } });
    await prisma.document.deleteMany({ where: { studentId: { in: pks } } });
    await prisma.studentCoop.deleteMany({ where: { studentId: { in: pks } } });
    await prisma.student.deleteMany({ where: { id: { in: pks } } });
    if (this.companyId) await prisma.company.deleteMany({ where: { id: this.companyId } });
    if (this.teacher) await prisma.teacher.deleteMany({ where: { id: this.teacher.pk } });
    if (this.staff) await prisma.staffProfile.deleteMany({ where: { userId: this.staff.userId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.coopPeriod.deleteMany({ where: { id: { in: [this.openPeriodId, this.latePeriodId].filter(Boolean) } } });
    const fs = require("node:fs");
    for (const f of files) { try { fs.unlinkSync(path.join(BACKEND_DIR, "uploads", f)); } catch { /* ไฟล์ที่ seed ไม่มีจริง */ } }
  }

  async disconnect() { await prisma.$disconnect(); }
}
