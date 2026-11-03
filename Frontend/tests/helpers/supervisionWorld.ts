/**
 * tests/helpers/supervisionWorld.ts
 * ─────────────────────────────────────────────────────
 * ข้อมูลทดสอบระบบนิเทศ (supervision.e2e.spec.ts) — backend + DB จริง ไม่ mock · ลบทุกอย่างที่สร้างตอนจบ
 *
 * อาจารย์: main (ที่ปรึกษาของนักศึกษาเกือบทุกคน · หลักสูตร CS) · co / co2 (อาจารย์ร่วม) · other (CS ไม่เกี่ยว ไม่ใช่อาจารย์ประจำวิชา)
 *          coopCS / coopAI (อาจารย์ประจำวิชาของหลักสูตร CS / AI) · aiAdv (ที่ปรึกษาของนักศึกษา AI)
 * รอบ: open (CS เปิดนัด ช่วงนิเทศ วันนี้-5 … วันนี้+60 · AI เปิดนัด ไม่ได้ตั้งช่วง) · closed (CS ปิดนัด)
 * วันของนัดที่ seed ไม่ทับกัน (อาจารย์คนเดียวกันห้ามเวลาทับ) — ดูตาราง DAYS
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../backend");
require(path.join(BACKEND_DIR, "node_modules/dotenv")).config({ path: path.join(BACKEND_DIR, ".env") });
const prisma = require(path.join(BACKEND_DIR, "config/prismaClient.js"));
const jwt = require(path.join(BACKEND_DIR, "node_modules/jsonwebtoken"));
const fs = require("node:fs");

export const SUP_DIR = path.join(BACKEND_DIR, "uploads/supervision");
const DAY = 86_400_000;
/** วันที่ (เวลาไทย) ห่างจากวันนี้ n วัน — YYYY-MM-DD */
export const day = (n: number) => new Date(Date.now() + n * DAY).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
/** เวลาไทย → ISO (แบบที่หน้าเว็บส่ง) */
export const at = (d: string, hhmm: string) => new Date(`${d}T${hhmm}:00+07:00`).toISOString();
export const slot = (n: number, time: string, type: "ONSITE" | "ONLINE" = "ONSITE") => `${day(n)}|${time}|${type}`;

export interface WS { key: string; userId: number; pk: number; studentId: string; token: string }
export interface WT { userId: number; pk: number; token: string; name: string }
type TeacherKey = "main" | "co" | "co2" | "other" | "coopCS" | "coopAI" | "aiAdv";

// วันของนัดที่ seed (ห้ามทับกันสำหรับอาจารย์คนเดียวกัน)
export const DAYS = {
  lockC: 20, lockL: 21, edit: 22, coClash: 23, busyCo: 23, queueMate: 25, aiConfirmed: 26, linkCS: 27,
  flowA: 30, flowB: 31, uiConfirmed: 33, uiLetter: 34, uiLetter2: 35, uiPendingA: 36, uiPendingB: 37, rej: 38,
  group: 40, groupOnlyA: 41, uiGroup: 43, lockD: -2, pastConfirmed: -3,
};

interface Seed {
  key: string;
  status?: string;                // สถานะสหกิจ (ค่าเริ่ม INTERNSHIP_STARTED)
  round?: "open" | "closed";
  major?: string | null;
  advisor?: TeacherKey | null;
  company?: "A" | "B" | null;
  appt?: {
    status: string; teacher?: TeacherKey; proposed: string[]; type?: "ONSITE" | "ONLINE"; link?: string;
    confirmed?: [number, string, string]; // [วัน, เริ่ม, จบ]
    co?: TeacherKey[]; letter?: boolean; reason?: string; group?: string;
  };
}

export class SupervisionWorld {
  stamp = Date.now();
  startedAt = new Date();
  tail = String(this.stamp).slice(-5);
  staff!: { userId: number; token: string };
  t = {} as Record<TeacherKey, WT>;
  openPeriodId!: number;
  closedPeriodId!: number;
  company = {} as Record<"A" | "B", string>;
  companyName = {} as Record<"A" | "B", string>;
  s: Record<string, WS> = {};
  appt: Record<string, number> = {};
  files: string[] = []; // ไฟล์ที่ seed ไว้ใน uploads/supervision

  token(userId: number, role: "student" | "teacher" | "staff") {
    return jwt.sign({ id: userId, role, tv: 0 }, process.env.JWT_SECRET, { expiresIn: "60m" });
  }

  async setup() {
    const tag = `zs${this.stamp}`;
    const staffUser = await prisma.user.create({ data: { username: `${tag}-staff`, email: `${tag}-staff@kkumail.com`, password: "x", role: "staff" } });
    await prisma.staffProfile.create({ data: { userId: staffUser.id, firstName: "ทดสอบ", lastName: "นิเทศ" } });
    this.staff = { userId: staffUser.id, token: this.token(staffUser.id, "staff") };

    const teachers: [TeacherKey, string, string][] = [
      ["main", "ที่ปรึกษา", "CS"], ["co", "ร่วมหนึ่ง", "CS"], ["co2", "ร่วมสอง", "CS"], ["other", "อื่น", "CS"],
      ["coopCS", "ประจำวิชาCS", "CS"], ["coopAI", "ประจำวิชาAI", "AI"], ["aiAdv", "ที่ปรึกษาAI", "AI"],
    ];
    for (const [k, name, major] of teachers) {
      const u = await prisma.user.create({ data: { username: `${tag}-t-${k}`, email: `${tag}-t-${k}@kkumail.com`, password: "x", role: "teacher" } });
      // อาจารย์ประจำวิชา = isCoopTeacher (ด่าน verifyCoopTeacherOrStaff) + หลักสูตรที่ดูแล (CoopTeacherMajor — ขอบเขตข้อมูล)
      const tr = await prisma.teacher.create({ data: { userId: u.id, prefix: "อ.", firstName: `ทดสอบ${name}`, lastName: `ZS${this.tail}`, email: u.email, major, isCoopTeacher: k.startsWith("coop") } });
      this.t[k] = { userId: u.id, pk: tr.id, token: this.token(u.id, "teacher"), name: `อ.ทดสอบ${name} ZS${this.tail}` };
    }
    await prisma.coopTeacherMajor.createMany({ data: [{ teacherId: this.t.coopCS.pk, major: "CS" }, { teacherId: this.t.coopAI.pk, major: "AI" }] });

    const win = { startDate: new Date(Date.now() - DAY * 60), endDate: new Date(Date.now() + DAY * 120) };
    const supWin = { supervisionStartDate: new Date(`${day(-5)}T00:00:00Z`), supervisionEndDate: new Date(`${day(60)}T00:00:00Z`) };
    this.openPeriodId = (await prisma.coopPeriod.create({
      data: {
        academicYear: `ZS${this.tail}`, semester: 8, ...win,
        majors: { create: [
          { major: "CS", ...win, isActive: true, isSupervisionOpen: true, ...supWin },
          { major: "AI", ...win, isActive: true, isSupervisionOpen: true, supervisionStartDate: null, supervisionEndDate: null },
        ] },
      },
    })).id;
    this.closedPeriodId = (await prisma.coopPeriod.create({
      data: { academicYear: `ZS${this.tail}`, semester: 9, ...win, majors: { create: [{ major: "CS", ...win, isActive: true, isSupervisionOpen: false, ...supWin }] } },
    })).id;

    for (const k of ["A", "B"] as const) {
      const c = await prisma.company.create({ data: { name: `บริษัท ZS${this.tail}${k} จำกัด`, address: "ขอนแก่น", province: "ขอนแก่น", createdById: staffUser.id } });
      this.company[k] = c.id;
      this.companyName[k] = c.name;
    }

    const C = (d: number, s: string, e: string) => [d, s, e] as [number, string, string];
    const plan: Seed[] = [
      // ── นักศึกษาเสนอวัน (API) ──
      { key: "notYet", status: "DOCS_APPROVED" },
      { key: "noMajor", major: null },
      { key: "closed", round: "closed" },
      { key: "noAdvisor", advisor: null, company: null },
      { key: "val" },                                   // ด่านตรวจข้อมูล → สำเร็จ ONLINE → เสนอใหม่
      { key: "win" },                                   // ช่วงนิเทศของหลักสูตร
      { key: "aiNoWin", major: "AI", advisor: "aiAdv" }, // หลักสูตร AI ไม่ได้ตั้งช่วง
      { key: "flow" },                                  // ครบวง: เสนอ → อาจารย์ร่วม → ยืนยัน → หนังสือ → จบ
      { key: "rej", appt: { status: "PENDING_TEACHER", proposed: [slot(DAYS.rej, "09:00-10:00")] } },
      // ── นัดที่ล็อกแล้ว ──
      { key: "lockC", appt: { status: "DATE_CONFIRMED", proposed: [slot(DAYS.lockC, "08:00-09:00")], confirmed: C(DAYS.lockC, "08:00", "09:00") } },
      { key: "lockL", appt: { status: "LETTER_UPLOADED", proposed: [slot(DAYS.lockL, "08:00-09:00")], confirmed: C(DAYS.lockL, "08:00", "09:00"), letter: true } },
      { key: "lockD", appt: { status: "COMPLETED", proposed: [slot(DAYS.lockD, "08:00-09:00")], confirmed: C(DAYS.lockD, "08:00", "09:00"), letter: true } },
      // ── แก้วันที่ยืนยันแล้ว (กลุ่มเดียวกับ editMate) ──
      { key: "edit", appt: { status: "DATE_CONFIRMED", proposed: [slot(DAYS.edit, "08:00-10:00")], confirmed: C(DAYS.edit, "08:00", "10:00"), group: "G-edit" } },
      { key: "editMate", appt: { status: "DATE_CONFIRMED", proposed: [slot(DAYS.edit, "10:00-12:00")], confirmed: C(DAYS.edit, "10:00", "12:00"), group: "G-edit" } },
      // ── อาจารย์ร่วมติดนิเทศเวลาเดียวกัน ──
      { key: "busyCo", advisor: "other", appt: { status: "DATE_CONFIRMED", teacher: "other", proposed: [slot(DAYS.busyCo, "08:00-10:00")], confirmed: C(DAYS.busyCo, "08:00", "10:00"), co: ["co2"] } },
      { key: "coClash", appt: { status: "DATE_CONFIRMED", proposed: [slot(DAYS.coClash, "09:00-10:00")], confirmed: C(DAYS.coClash, "09:00", "10:00") } },
      // ── คิวบริษัท / ปฏิทิน / ลิงก์ออนไลน์ ──
      { key: "queueMate", appt: { status: "DATE_CONFIRMED", proposed: [slot(DAYS.queueMate, "13:00-14:00")], confirmed: C(DAYS.queueMate, "13:00", "14:00") } },
      { key: "pastMate", appt: { status: "DATE_CONFIRMED", proposed: [slot(DAYS.pastConfirmed, "13:00-14:00")], confirmed: C(DAYS.pastConfirmed, "13:00", "14:00") } },
      { key: "aiConfirmed", major: "AI", advisor: "aiAdv", company: "B", appt: { status: "DATE_CONFIRMED", teacher: "aiAdv", type: "ONLINE", link: "https://meet.example.com/zs-ai", proposed: [slot(DAYS.aiConfirmed, "09:00-10:00", "ONLINE")], confirmed: C(DAYS.aiConfirmed, "09:00", "10:00") } },
      { key: "linkCS", appt: { status: "DATE_CONFIRMED", type: "ONLINE", link: "https://meet.example.com/zs-cs", proposed: [slot(DAYS.linkCS, "09:00-10:00", "ONLINE")], confirmed: C(DAYS.linkCS, "09:00", "10:00") } },
      // ── ยืนยันแบบกลุ่ม (บริษัท B) ──
      { key: "gA", company: "B", appt: { status: "PENDING_TEACHER", proposed: [slot(DAYS.group, "09:00-10:00"), slot(DAYS.groupOnlyA, "09:00-10:00")] } },
      { key: "gB", company: "B", appt: { status: "TEACHER_REJECTED", reason: "เดิม", proposed: [slot(DAYS.group, "13:00-14:00", "ONLINE")], link: "https://meet.example.com/zs-gb" } },
      // ── หน้าเว็บ ──
      { key: "uiNew" },
      { key: "uiNotYet", status: "REQ_LETTER_ISSUED" },
      { key: "uiClosed", round: "closed" },
      { key: "uiNoAdvisor", advisor: null },
      { key: "uiPending", appt: { status: "PENDING_TEACHER", proposed: [slot(DAYS.uiPendingA, "09:00-10:00"), slot(DAYS.uiPendingB, "13:00-14:00")], co: ["co"] } },
      { key: "uiReject", appt: { status: "PENDING_TEACHER", proposed: [slot(DAYS.uiPendingA, "13:00-14:00")] } },
      { key: "uiRejected", appt: { status: "TEACHER_REJECTED", reason: "ZS ขอเลื่อนเป็นสัปดาห์หน้า", proposed: [slot(DAYS.uiPendingB, "09:00-10:00")] } },
      { key: "uiConfirmed", appt: { status: "DATE_CONFIRMED", proposed: [slot(DAYS.uiConfirmed, "09:00-10:00")], confirmed: C(DAYS.uiConfirmed, "09:00", "10:00") } },
      { key: "uiLetter", appt: { status: "LETTER_UPLOADED", proposed: [slot(DAYS.uiLetter, "09:00-10:00")], confirmed: C(DAYS.uiLetter, "09:00", "10:00"), letter: true, co: ["co"] } },
      { key: "uiLetter2", appt: { status: "LETTER_UPLOADED", proposed: [slot(DAYS.uiLetter2, "09:00-10:00")], confirmed: C(DAYS.uiLetter2, "09:00", "10:00"), letter: true } },
      // แท็บ "นิเทศตามบริษัท" มีเฉพาะอาจารย์ประจำวิชา → ที่ปรึกษาของคู่นี้คือ coopCS
      { key: "uiGP", company: "B", advisor: "coopCS", appt: { status: "PENDING_TEACHER", teacher: "coopCS", proposed: [slot(DAYS.uiGroup, "09:00-10:00")] } },
      { key: "uiGQ", company: "B", advisor: "coopCS", appt: { status: "PENDING_TEACHER", teacher: "coopCS", proposed: [slot(DAYS.uiGroup, "10:00-11:00")] } },
    ];

    let i = 0;
    for (const p of plan) {
      i++;
      const u = await prisma.user.create({ data: { username: `${tag}-${p.key}`, email: `${tag}-${p.key}@kkumail.com`, password: "x", role: "student" } });
      const advisor = p.advisor === undefined ? "main" : p.advisor;
      const st = await prisma.student.create({
        data: {
          userId: u.id, studentId: `ZS${this.tail}${String(i).padStart(2, "0")}`, prefix: "MR", firstName: `นศ${p.key}`, lastName: "ทดสอบนิเทศ",
          email: u.email, major: p.major === undefined ? "CS" : p.major, year: "4", studyProgram: "normal",
          coopAdvisorId: advisor ? this.t[advisor].pk : null,
        },
      });
      const company = p.company === undefined ? "A" : p.company;
      await prisma.studentCoop.create({
        data: {
          studentId: st.id, status: p.status || "INTERNSHIP_STARTED", companyId: company ? this.company[company] : null,
          coopPeriodId: p.round === "closed" ? this.closedPeriodId : this.openPeriodId,
          actualStartDate: new Date(Date.now() - DAY * 20), actualEndDate: new Date(Date.now() + DAY * 100),
        },
      });
      this.s[p.key] = { key: p.key, userId: u.id, pk: st.id, studentId: st.studentId, token: this.token(u.id, "student") };

      if (p.appt) {
        const a = p.appt;
        let letterPath: string | null = null;
        if (a.letter) {
          letterPath = `ZS${this.tail}-${p.key}.pdf`;
          fs.writeFileSync(path.join(SUP_DIR, letterPath), "%PDF-1.4\nsupervision e2e\n%%EOF");
          this.files.push(letterPath);
        }
        const row = await prisma.supervisionAppointment.create({
          data: {
            studentId: st.id, teacherId: this.t[a.teacher || "main"].pk, status: a.status,
            supervisionType: a.type || "ONSITE", onlineLink: a.link || null, proposedDates: JSON.stringify(a.proposed),
            rejectReason: a.reason || null, officialLetterPath: letterPath,
            groupId: a.group ? `${a.group}-${this.tail}` : null,
            ...(a.confirmed ? { confirmedDate: new Date(at(day(a.confirmed[0]), a.confirmed[1])), confirmedEndDate: new Date(at(day(a.confirmed[0]), a.confirmed[2])) } : {}),
          },
        });
        for (const co of a.co || []) await prisma.supervisionCoTeacher.create({ data: { appointmentId: row.id, teacherId: this.t[co].pk } });
        if (a.co?.length) await prisma.supervisionAppointment.update({ where: { id: row.id }, data: { coTeacherName: a.co.map((k) => this.t[k].name).join(", ") } });
        this.appt[p.key] = row.id;
      }
    }
  }

  supervision(key: string) {
    return prisma.supervisionAppointment.findUnique({ where: { studentId: this.s[key].pk }, include: { coTeachers: true } });
  }
  async apptId(key: string) {
    if (!this.appt[key]) this.appt[key] = (await this.supervision(key))?.id;
    return this.appt[key];
  }
  notes(userId: number, type: string) {
    return prisma.notification.findMany({ where: { userId, type, createdAt: { gte: this.startedAt } } });
  }
  setAppt(key: string, data: Record<string, unknown>) {
    return prisma.supervisionAppointment.update({ where: { studentId: this.s[key].pk }, data });
  }
  setWindow(major: string, start: string | null, end: string | null, open = true) {
    return prisma.coopPeriodMajor.update({
      where: { periodId_major: { periodId: this.openPeriodId, major } },
      data: { isSupervisionOpen: open, supervisionStartDate: start ? new Date(`${start}T00:00:00Z`) : null, supervisionEndDate: end ? new Date(`${end}T00:00:00Z`) : null },
    });
  }
  periodRow(major: string, periodId = this.openPeriodId) {
    return prisma.coopPeriodMajor.findUnique({ where: { periodId_major: { periodId, major } } });
  }
  visits(key: string) { return prisma.visit.findMany({ where: { studentId: this.s[key].pk } }); }

  async cleanup() {
    const pks = Object.values(this.s).map((x) => x.pk);
    const userIds = [...Object.values(this.s).map((x) => x.userId), this.staff?.userId, ...Object.values(this.t).map((x) => x.userId)].filter(Boolean);
    const appts = await prisma.supervisionAppointment.findMany({ where: { studentId: { in: pks } }, select: { id: true, officialLetterPath: true } });
    const letters = [...new Set([...appts.map((a) => a.officialLetterPath).filter(Boolean), ...this.files])];
    const apptIds = appts.map((a) => a.id);
    await prisma.supervisionCoTeacher.deleteMany({ where: { appointmentId: { in: apptIds } } });
    await prisma.supervisionAppointment.deleteMany({ where: { id: { in: apptIds } } });
    await prisma.visit.deleteMany({ where: { studentId: { in: pks } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds }, createdAt: { gte: this.startedAt } } });
    await prisma.studentCoop.deleteMany({ where: { studentId: { in: pks } } });
    await prisma.student.deleteMany({ where: { id: { in: pks } } });
    for (const k of ["A", "B"] as const) {
      if (!this.company[k]) continue;
      await prisma.companyContact.deleteMany({ where: { companyId: this.company[k] } });
      await prisma.company.deleteMany({ where: { id: this.company[k] } });
    }
    await prisma.coopTeacherMajor.deleteMany({ where: { teacherId: { in: Object.values(this.t).map((x) => x.pk) } } });
    await prisma.teacher.deleteMany({ where: { id: { in: Object.values(this.t).map((x) => x.pk) } } });
    if (this.staff) await prisma.staffProfile.deleteMany({ where: { userId: this.staff.userId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.coopPeriod.deleteMany({ where: { id: { in: [this.openPeriodId, this.closedPeriodId].filter(Boolean) } } });
    await prisma.docNumberLock.deleteMany({ where: { number: { startsWith: `ZS${this.tail}` } } });
    for (const f of letters) { try { fs.unlinkSync(path.join(SUP_DIR, f)); } catch { /* ลบไปแล้ว */ } }
  }

  async disconnect() { await prisma.$disconnect(); }
}
