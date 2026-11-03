/**
 * tests/helpers/internWorld.ts
 * ─────────────────────────────────────────────────────
 * ข้อมูลทดสอบช่วงฝึกงาน (intern.e2e.spec.ts): T002 / T003 / นัดนิเทศ — backend + DB จริง ไม่ mock
 * อาจารย์ 3 คน: ที่ปรึกษา (main) · อาจารย์ร่วม (co) · อาจารย์อื่นที่ไม่เกี่ยว (other)
 * สองรอบ (หลักสูตร CS): รอบเปิด (กำหนดส่ง T002/T003 อีกไกล · เปิดนัดนิเทศ) · รอบเลยกำหนด (T002 เมื่อวาน HARD · ปิดนัดนิเทศ)
 * cleanup ลบทุกอย่างที่สร้าง รวมแจ้งเตือน/บันทึกการใช้งานของผู้ใช้ทดสอบ และไฟล์ที่อัปโหลด (uploads/ · uploads/supervision/)
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../backend");
require(path.join(BACKEND_DIR, "node_modules/dotenv")).config({ path: path.join(BACKEND_DIR, ".env") });
const prisma = require(path.join(BACKEND_DIR, "config/prismaClient.js"));
const jwt = require(path.join(BACKEND_DIR, "node_modules/jsonwebtoken"));

export interface WorldStudent { key: string; userId: number; pk: number; studentId: string; token: string }
export interface WorldTeacher { userId: number; pk: number; token: string }

const DAY = 86_400_000;
/** วันที่ (เวลาไทย) ห่างจากวันนี้ n วัน — YYYY-MM-DD */
export const day = (n: number) => new Date(Date.now() + n * DAY).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
/** เวลาเริ่มนิเทศตามเวลาไทย → ISO (แบบที่หน้าเว็บส่ง) */
export const at = (d: string, hhmm: string) => new Date(`${d}T${hhmm}:00+07:00`).toISOString();

export class InternWorld {
  stamp = Date.now();
  startedAt = new Date();
  tail = String(this.stamp).slice(-5);
  staff!: { userId: number; token: string };
  t: Record<"main" | "co" | "other", WorldTeacher> = {} as any;
  openPeriodId!: number;
  latePeriodId!: number;
  companyA!: string;
  s: Record<string, WorldStudent> = {};
  appt: Record<string, number> = {}; // นัดที่ seed ไว้

  token(userId: number, role: "student" | "teacher" | "staff") {
    return jwt.sign({ id: userId, role, tv: 0 }, process.env.JWT_SECRET, { expiresIn: "30m" });
  }

  async setup() {
    const tag = `zi${this.stamp}`;
    const staffUser = await prisma.user.create({ data: { username: `${tag}-staff`, email: `${tag}-staff@kkumail.com`, password: "x", role: "staff" } });
    await prisma.staffProfile.create({ data: { userId: staffUser.id, firstName: "ทดสอบ", lastName: "ฝึกงาน" } });
    this.staff = { userId: staffUser.id, token: this.token(staffUser.id, "staff") };

    for (const [k, name] of [["main", "ที่ปรึกษา"], ["co", "ร่วม"], ["other", "อื่น"]] as const) {
      const u = await prisma.user.create({ data: { username: `${tag}-t-${k}`, email: `${tag}-t-${k}@kkumail.com`, password: "x", role: "teacher" } });
      const tr = await prisma.teacher.create({ data: { userId: u.id, prefix: "อ.", firstName: `ทดสอบ${name}`, lastName: `ZI${this.tail}`, email: u.email } });
      this.t[k] = { userId: u.id, pk: tr.id, token: this.token(u.id, "teacher") };
    }

    const win = { startDate: new Date(Date.now() - DAY * 60), endDate: new Date(Date.now() + DAY * 120) };
    const mkPeriod = async (semester: number, due: string, supervisionOpen: boolean) => (await prisma.coopPeriod.create({
      data: {
        academicYear: `ZI${this.tail}`, semester, ...win,
        majors: { create: [{
          major: "CS", ...win, isActive: true, deadlines: { T002: { due }, T003: { due } },
          isSupervisionOpen: supervisionOpen, supervisionStartDate: new Date(Date.now() - DAY * 5), supervisionEndDate: new Date(Date.now() + DAY * 90),
        }] },
      },
    })).id as number;
    this.openPeriodId = await mkPeriod(8, day(60), true);
    this.latePeriodId = await mkPeriod(9, day(-2), false);

    const c = await prisma.company.create({ data: { name: `บริษัท ZI${this.tail} จำกัด`, address: "ขอนแก่น", province: "ขอนแก่น", createdById: staffUser.id } });
    this.companyA = c.id;

    // key → [สถานะ, รอบ, ไฟล์ {ชนิด: สถานะ}]
    const plan: [string, string, "open" | "late", Record<string, string>][] = [
      ["t2", "INTERNSHIP_STARTED", "open", {}],                       // เดิน T002 → T003 ครบวง
      ["t2late", "T002_EDITS_REQUIRED", "late", { T002_FORM: "REJECTED" }], // ส่งแก้หลังกำหนด
      ["closed", "INTERNSHIP_STARTED", "late", {}],                   // เลยกำหนด T002 · ปิดนัดนิเทศ
      ["notYet", "DOCS_APPROVED", "open", {}],                        // ยังไม่ออกฝึก
      ["sup", "INTERNSHIP_STARTED", "open", {}],                      // นัดนิเทศครบวง
      ["rej", "T002_SUBMITTED", "open", { T002_FORM: "WAITING" }],    // อาจารย์ปฏิเสธ → เสนอใหม่
      ["clashX", "INTERNSHIP_STARTED", "open", {}],                   // คิวที่ยืนยันแล้วของอาจารย์หลัก
      ["clashY", "INTERNSHIP_STARTED", "open", {}],                   // เสนอเวลาทับ clashX
      ["gP", "INTERNSHIP_STARTED", "open", {}],                       // ยืนยันแบบกลุ่ม
      ["gQ", "INTERNSHIP_STARTED", "open", {}],
      // ส่ง T003 ไปก่อน T002 ถูกตรวจ → ตรวจ T002 ย้อนหลัง
      ["t23", "INTERNSHIP_STARTED", "open", {}],
      // ถูกตีกลับ T002 ย้อนหลังแล้ว ในรอบที่เลยกำหนด T002 — ส่งใหม่ต้องได้
      ["late23", "T003_SUBMITTED", "late", { T002_FORM: "REJECTED", T003_FORM: "WAITING" }],
    ];
    let i = 0;
    for (const [key, status, round, docs] of plan) {
      i++;
      const u = await prisma.user.create({ data: { username: `${tag}-${key}`, email: `${tag}-${key}@kkumail.com`, password: "x", role: "student" } });
      const st = await prisma.student.create({
        data: {
          userId: u.id, studentId: `ZI${this.tail}${String(i).padStart(2, "0")}`, prefix: "MR", firstName: `นักศึกษา${key}`, lastName: "ทดสอบฝึกงาน",
          email: u.email, major: "CS", year: "4", studyProgram: "normal", coopAdvisorId: this.t.main.pk,
        },
      });
      await prisma.studentCoop.create({
        data: { studentId: st.id, status, companyId: c.id, coopPeriodId: round === "open" ? this.openPeriodId : this.latePeriodId, actualStartDate: new Date(Date.now() - DAY * 20), actualEndDate: new Date(Date.now() + DAY * 100) },
      });
      for (const [type, docStatus] of Object.entries(docs)) {
        await prisma.document.create({ data: { studentId: st.id, type, path: `zi-${key}-${type}.pdf`, name: `${type}.pdf`, status: docStatus } });
      }
      this.s[key] = { key, userId: u.id, pk: st.id, studentId: st.studentId, token: this.token(u.id, "student") };
    }

    // คิวของอาจารย์หลักที่ยืนยันแล้ว: clashX วัน +12 10:00–12:00
    const x = await prisma.supervisionAppointment.create({
      data: {
        studentId: this.s.clashX.pk, teacherId: this.t.main.pk, supervisionType: "ONSITE", status: "DATE_CONFIRMED",
        proposedDates: JSON.stringify([`${day(12)}|10:00-12:00|ONSITE`]),
        confirmedDate: new Date(at(day(12), "10:00")), confirmedEndDate: new Date(at(day(12), "12:00")),
      },
    });
    this.appt.clashX = x.id;
  }

  coop(key: string) { return prisma.studentCoop.findUnique({ where: { studentId: this.s[key].pk } }); }
  doc(key: string, type: string) { return prisma.document.findFirst({ where: { studentId: this.s[key].pk, type } }); }
  supervision(key: string) {
    return prisma.supervisionAppointment.findUnique({ where: { studentId: this.s[key].pk }, include: { coTeachers: true } });
  }
  notes(key: string, type: string) {
    return prisma.notification.findMany({ where: { userId: this.s[key].userId, type, createdAt: { gte: this.startedAt } } });
  }

  async cleanup() {
    const pks = Object.values(this.s).map((x) => x.pk);
    const userIds = [...Object.values(this.s).map((x) => x.userId), this.staff?.userId, ...Object.values(this.t).map((x) => x.userId)].filter(Boolean);
    const fs = require("node:fs");
    const files = (await prisma.document.findMany({ where: { studentId: { in: pks } }, select: { path: true } })).map((d: any) => path.join(BACKEND_DIR, "uploads", d.path));
    const letters = (await prisma.supervisionAppointment.findMany({ where: { studentId: { in: pks } }, select: { officialLetterPath: true } }))
      .map((a: any) => a.officialLetterPath).filter(Boolean).map((p: string) => path.join(BACKEND_DIR, "uploads/supervision", p));
    const apptIds = (await prisma.supervisionAppointment.findMany({ where: { studentId: { in: pks } }, select: { id: true } })).map((a: any) => a.id);
    await prisma.supervisionCoTeacher.deleteMany({ where: { appointmentId: { in: apptIds } } });
    await prisma.supervisionAppointment.deleteMany({ where: { id: { in: apptIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds }, createdAt: { gte: this.startedAt } } });
    await prisma.document.deleteMany({ where: { studentId: { in: pks } } });
    await prisma.coopT002Form.deleteMany({ where: { studentId: { in: pks } } });
    await prisma.coopT003Form.deleteMany({ where: { studentId: { in: pks } } });
    await prisma.studentCoop.deleteMany({ where: { studentId: { in: pks } } });
    await prisma.student.deleteMany({ where: { id: { in: pks } } });
    if (this.companyA) {
      await prisma.companyContact.deleteMany({ where: { companyId: this.companyA } });
      await prisma.company.deleteMany({ where: { id: this.companyA } });
    }
    await prisma.teacher.deleteMany({ where: { id: { in: Object.values(this.t).map((x) => x.pk) } } });
    if (this.staff) await prisma.staffProfile.deleteMany({ where: { userId: this.staff.userId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.coopPeriod.deleteMany({ where: { id: { in: [this.openPeriodId, this.latePeriodId].filter(Boolean) } } });
    await prisma.docNumberLock.deleteMany({ where: { number: { startsWith: `ZI${this.tail}` } } });
    for (const f of [...files, ...letters]) { try { fs.unlinkSync(f); } catch { /* ไฟล์ที่ seed ไม่มีจริง */ } }
  }

  async disconnect() { await prisma.$disconnect(); }
}
