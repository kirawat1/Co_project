/**
 * tests/helpers/worldKit.ts
 * ─────────────────────────────────────────────────────
 * ตัวช่วยสร้างข้อมูลทดสอบกับ backend + DB จริง (ใช้ร่วม application / forms / company e2e)
 *   - ทุกอย่างที่สร้างผ่าน kit ถูกจดไว้ และ cleanup() ลบทิ้งตามลำดับ FK (รวมสิ่งที่ผู้ใช้ทดสอบสร้างผ่าน API)
 *   - ค่าตั้งค่ากลาง (SystemConfig) ที่เทสต์จะแตะ: snapshot() ก่อน → cleanup() คืนค่าเดิม (ไม่มีเดิม = ลบแถว)
 *     ถ้าค่าเดิมชี้ไปที่ไฟล์ (เช่น CONFIG_T008.imagePath) ให้ overwrite() ด้วยค่าทดสอบก่อนเรียก API
 *     — server ลบไฟล์ตามค่าเดิมเมื่อเปลี่ยนรูป (บทเรียนจาก T008 e2e)
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
export const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../backend");
require(path.join(BACKEND_DIR, "node_modules/dotenv")).config({ path: path.join(BACKEND_DIR, ".env") });
export const prisma = require(path.join(BACKEND_DIR, "config/prismaClient.js"));
const jwt = require(path.join(BACKEND_DIR, "node_modules/jsonwebtoken"));
const fs = require("node:fs");

export const UPLOADS = path.join(BACKEND_DIR, "uploads");
const DAY = 86_400_000;
export const day = (n: number) => new Date(Date.now() + n * DAY).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

export interface KUser { userId: number; token: string }
export interface KTeacher extends KUser { pk: number; name: string }
export interface KStudent extends KUser { key: string; pk: number; studentId: string; email: string }

export class WorldKit {
  stamp = Date.now();
  tail = String(this.stamp).slice(-5);
  startedAt = new Date();
  users: number[] = [];
  teachers: number[] = [];
  students: number[] = [];
  periods: number[] = [];
  companies: string[] = [];
  files: string[] = [];                       // path เต็มของไฟล์ที่ seed
  configs = new Map<string, string | null>(); // ค่าเดิมของ SystemConfig ที่ต้องคืน

  constructor(public prefix: string) {}
  get tag() { return `${this.prefix.toLowerCase()}${this.stamp}`; }
  code(n: number) { return `${this.prefix}${this.tail}${String(n).padStart(2, "0")}`; }

  token(userId: number, role: "student" | "teacher" | "staff") {
    return jwt.sign({ id: userId, role, tv: 0 }, process.env.JWT_SECRET, { expiresIn: "60m" });
  }

  private async user(key: string, role: "student" | "teacher" | "staff") {
    const u = await prisma.user.create({ data: { username: `${this.tag}-${key}`, email: `${this.tag}-${key}@kkumail.com`, password: "x", role } });
    this.users.push(u.id);
    return u;
  }

  async staff(key = "staff"): Promise<KUser> {
    const u = await this.user(key, "staff");
    await prisma.staffProfile.create({ data: { userId: u.id, firstName: "ทดสอบ", lastName: this.prefix } });
    return { userId: u.id, token: this.token(u.id, "staff") };
  }

  /** coop = หลักสูตรที่เป็นอาจารย์ประจำวิชา (isCoopTeacher + CoopTeacherMajor) */
  async teacher(key: string, { major = "CS", coop = [] as string[] } = {}): Promise<KTeacher> {
    const u = await this.user(`t-${key}`, "teacher");
    const t = await prisma.teacher.create({ data: { userId: u.id, prefix: "อ.", firstName: `ทดสอบ${key}`, lastName: `${this.prefix}${this.tail}`, email: u.email, major, isCoopTeacher: coop.length > 0 } });
    if (coop.length) await prisma.coopTeacherMajor.createMany({ data: coop.map((m) => ({ teacherId: t.id, major: m })) });
    this.teachers.push(t.id);
    return { userId: u.id, pk: t.id, token: this.token(u.id, "teacher"), name: `อ.ทดสอบ${key} ${this.prefix}${this.tail}` };
  }

  /** รอบสหกิจ — majors: { CS: { isActive, deadlines } } (วันรับสมัคร −60 … +120 วัน) */
  async period(semester: number, majors: Record<string, { isActive?: boolean; deadlines?: object }>) {
    const win = { startDate: new Date(Date.now() - DAY * 60), endDate: new Date(Date.now() + DAY * 120) };
    const p = await prisma.coopPeriod.create({
      data: {
        academicYear: `${this.prefix}${this.tail}`, semester, ...win,
        majors: { create: Object.entries(majors).map(([major, o]) => ({ major, ...win, isActive: o.isActive ?? true, ...(o.deadlines ? { deadlines: o.deadlines } : {}) })) },
      },
    });
    this.periods.push(p.id);
    return p.id as number;
  }

  async company(name: string, contacts: string[] = [], createdBy?: number) {
    const c = await prisma.company.create({ data: { name, address: "ขอนแก่น", province: "ขอนแก่น", createdById: createdBy ?? this.users[0] } });
    this.companies.push(c.id);
    const contactIds: string[] = [];
    for (const first of contacts) {
      contactIds.push((await prisma.companyContact.create({ data: { companyId: c.id, firstName: first, lastName: "HR", email: `${first}@example.com` } })).id);
    }
    return { id: c.id as string, name: c.name as string, contactIds };
  }

  async student(key: string, n: number, o: {
    major?: string | null; status?: string | null; periodId?: number | null; companyId?: string | null; contactIds?: string[];
    advisor?: number | null; t000Status?: string; teacherCheckComment?: string; phone?: string | null; year?: string | null;
    docs?: { type: string; status?: string; file?: boolean }[];
  } = {}): Promise<KStudent> {
    const u = await this.user(key, "student");
    const st = await prisma.student.create({
      data: {
        userId: u.id, studentId: this.code(n), prefix: "MR", firstName: `นศ${key}`, lastName: `ทดสอบ${this.prefix}`, email: u.email,
        major: o.major === undefined ? "CS" : o.major, year: o.year === undefined ? "4" : o.year, phone: o.phone ?? null, studyProgram: "normal",
        coopAdvisorId: o.advisor ?? null,
      },
    });
    this.students.push(st.id);
    if (o.status !== null) {
      await prisma.studentCoop.create({
        data: {
          studentId: st.id, status: o.status || "NOT_SUBMITTED", coopPeriodId: o.periodId ?? null, companyId: o.companyId ?? null,
          ...(o.t000Status ? { t000Status: o.t000Status } : {}), ...(o.teacherCheckComment ? { teacherCheckComment: o.teacherCheckComment } : {}),
          ...(o.contactIds?.length ? { contacts: { connect: o.contactIds.map((id) => ({ id })) } } : {}),
        },
      });
    }
    for (const [i, d] of (o.docs || []).entries()) {
      const name = `${this.tag}-${key}-${i}.pdf`;
      if (d.file) { fs.writeFileSync(path.join(UPLOADS, name), "%PDF-1.4\nworld kit\n%%EOF"); this.files.push(path.join(UPLOADS, name)); }
      await prisma.document.create({ data: { studentId: st.id, type: d.type, path: name, name: `${d.type}.pdf`, status: d.status || "WAITING" } });
    }
    return { key, userId: u.id, pk: st.id, studentId: st.studentId, email: u.email, token: this.token(u.id, "student") };
  }

  /** เก็บค่าเดิมของ SystemConfig ไว้คืนตอนจบ */
  async snapshot(...keys: string[]) {
    for (const key of keys) {
      if (this.configs.has(key)) continue;
      const row = await prisma.systemConfig.findUnique({ where: { key } });
      this.configs.set(key, row ? row.value : null);
    }
  }
  /** เขียนค่าทดสอบลง SystemConfig ตรง ๆ (ต้อง snapshot ก่อน) */
  async overwrite(key: string, value: unknown) {
    if (!this.configs.has(key)) throw new Error(`snapshot ${key} ก่อน`);
    if (value === null) { await prisma.systemConfig.deleteMany({ where: { key } }); return; }
    const v = typeof value === "string" ? value : JSON.stringify(value);
    await prisma.systemConfig.upsert({ where: { key }, update: { value: v }, create: { key, value: v } });
  }
  async config(key: string) {
    const row = await prisma.systemConfig.findUnique({ where: { key } });
    try { return row ? JSON.parse(row.value) : null; } catch { return row?.value ?? null; }
  }

  coop(pk: number) { return prisma.studentCoop.findUnique({ where: { studentId: pk }, include: { contacts: true } }); }
  docs(pk: number, type?: string) { return prisma.document.findMany({ where: { studentId: pk, ...(type ? { type } : {}) }, orderBy: { id: "asc" } }); }
  notes(userId: number, type: string) { return prisma.notification.findMany({ where: { userId, type, createdAt: { gte: this.startedAt } } }); }

  async cleanup() {
    // คืนค่าตั้งค่ากลางก่อน (ถ้าเทสต์ล้มกลางทาง ค่าจริงต้องกลับมา)
    for (const [key, value] of this.configs) {
      if (value === null) await prisma.systemConfig.deleteMany({ where: { key } });
      else await prisma.systemConfig.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
    // นักศึกษาที่ถูกสร้างจากการนำเข้า/หน้าเว็บด้วยรหัสของ world นี้
    const imported = await prisma.student.findMany({ where: { studentId: { startsWith: `${this.prefix}${this.tail}` } }, select: { id: true, userId: true } });
    const pks = [...new Set([...this.students, ...imported.map((s: { id: number }) => s.id)])];
    const importedUsers = await prisma.user.findMany({ where: { OR: [{ email: { startsWith: this.tag } }, { id: { in: imported.map((s: { userId: number }) => s.userId).filter(Boolean) } }] }, select: { id: true } });
    const userIds = [...new Set([...this.users, ...importedUsers.map((u: { id: number }) => u.id)])];

    const docFiles = (await prisma.document.findMany({ where: { studentId: { in: pks } }, select: { path: true } })).map((d: { path: string }) => path.join(UPLOADS, d.path));
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds }, createdAt: { gte: this.startedAt } } });
    await prisma.document.deleteMany({ where: { studentId: { in: pks } } });
    await prisma.coopApplicationForm.deleteMany({ where: { studentId: { in: pks } } });
    await prisma.studentCoop.deleteMany({ where: { studentId: { in: pks } } });
    await prisma.student.deleteMany({ where: { id: { in: pks } } });
    // บริษัท/ผู้ติดต่อ/พี่เลี้ยงที่ world สร้าง หรือผู้ใช้ทดสอบสร้างผ่าน API
    const companyIds = [...new Set([...this.companies, ...(await prisma.company.findMany({ where: { OR: [{ createdById: { in: userIds } }, { name: { contains: `${this.prefix}${this.tail}` } }] }, select: { id: true } })).map((c: { id: string }) => c.id)])];
    await prisma.mentor.deleteMany({ where: { OR: [{ companyId: { in: companyIds } }, { createdById: { in: userIds } }] } });
    await prisma.companyContact.deleteMany({ where: { OR: [{ companyId: { in: companyIds } }, { createdById: { in: userIds } }] } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.coopTeacherMajor.deleteMany({ where: { teacherId: { in: this.teachers } } });
    await prisma.teacher.deleteMany({ where: { id: { in: this.teachers } } });
    await prisma.staffProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.coopPeriod.deleteMany({ where: { id: { in: this.periods } } });
    for (const f of [...docFiles, ...this.files]) { try { fs.unlinkSync(f); } catch { /* ไม่มีไฟล์จริง */ } }
  }

  async disconnect() { await prisma.$disconnect(); }
}
