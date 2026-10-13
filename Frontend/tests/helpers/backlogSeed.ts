/**
 * tests/helpers/backlogSeed.ts
 * ─────────────────────────────────────────────────────
 * Fixture สำหรับ backlog-features.api.spec.ts — ยิง backend จริง เขียน DB จริง (เหมือน e2eSeed.ts)
 * แต่ไม่ต้องเปิด browser: ทดสอบระดับ API ของฟีเจอร์ที่ flow หลักไม่ครอบคลุม
 * (หนังสือรวม, กันเลขซ้ำพร้อมกัน, วันว่างอาจารย์ร่วม, ย้ายรอบ, ปฏิทินแยกหลักสูตร, zip, นำเข้า Excel)
 *
 * แยกขาดจากข้อมูลจริง: หลักสูตร/รอบสหกิจ/บริษัท/ผู้ใช้ สร้างใหม่ทั้งหมด (รหัสหลักสูตร ZA…/ZB…)
 * token: sign ด้วย JWT_SECRET ของ backend (โหลดจาก backend/.env) — ไม่ผ่าน /api/auth/signin ที่จำกัด 30 ครั้ง/15 นาที
 * cleanup: ลบตามที่สร้าง + ไฟล์ที่ผูกกับข้อมูลชุดนี้เท่านั้น
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../backend");
require(path.join(BACKEND_DIR, "node_modules/dotenv")).config({ path: path.join(BACKEND_DIR, ".env") });
const prisma = require(path.join(BACKEND_DIR, "config/prismaClient.js"));
const jwt = require(path.join(BACKEND_DIR, "node_modules/jsonwebtoken"));
export const XLSX = require(path.join(BACKEND_DIR, "node_modules/xlsx"));
export { prisma };

export const API = "http://localhost:5000";
const UPLOADS = path.join(BACKEND_DIR, "uploads");

export type Role = "student" | "teacher" | "staff";
export interface Res { status: number; body: any; headers: Headers; buf?: Buffer }

/** เรียก API — body เป็น FormData (multipart) หรือ object (JSON) */
export async function api(token: string | null, method: string, url: string, body?: any, headers: Record<string, string> = {}): Promise<Res> {
  const init: RequestInit = { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) { init.body = JSON.stringify(body); (init.headers as any)["Content-Type"] = "application/json"; }
  const r = await fetch(API + url, init);
  if ((r.headers.get("content-type") || "").includes("zip")) return { status: r.status, body: null, headers: r.headers, buf: Buffer.from(await r.arrayBuffer()) };
  return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
}

export const pdfBlob = () => new Blob([Buffer.from("%PDF-1.4\n%%EOF")], { type: "application/pdf" });
export function form(fields: Record<string, string | number>, file?: string): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
  if (file) fd.append("file", pdfBlob(), file);
  return fd;
}

/** วันที่ตามเวลาไทย → ISO (หน้าเว็บส่ง toISOString()) */
export const bkk = (day: string, time: string) => new Date(`${day}T${time}:00+07:00`).toISOString();

/** ชื่อไฟล์ใน zip (อ่าน central directory) */
export function zipNames(buf: Buffer): string[] {
  const names: string[] = [];
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let off = buf.readUInt32LE(eocd + 16);
  const n = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < n; i++) {
    const len = buf.readUInt16LE(off + 28), extra = buf.readUInt16LE(off + 30), cm = buf.readUInt16LE(off + 32);
    names.push(buf.subarray(off + 46, off + 46 + len).toString("utf8"));
    off += 46 + len + extra + cm;
  }
  return names;
}

export async function assertBackendUp(): Promise<void> {
  try {
    const r = await fetch(`${API}/api/auth/me`);
    if (r.status >= 500) throw new Error(`status ${r.status}`);
  } catch (err) {
    throw new Error(`ต้องใช้ backend จริงที่ ${API} แต่เชื่อมต่อไม่ได้ (${err})\nแก้: cd backend && npm run dev`);
  }
}

/** ชุดข้อมูลของเทสต์หนึ่งไฟล์ — สร้างผ่าน method แล้ว cleanup() ทีเดียว */
export class BacklogWorld {
  readonly stamp = String(Date.now()).slice(-7);
  readonly A = `ZA${this.stamp.slice(-5)}`; // หลักสูตรทดสอบ 2 หลักสูตร
  readonly B = `ZB${this.stamp.slice(-5)}`;
  readonly nameA = `ZZ หลักสูตรเอ ${this.stamp}`;
  private seq = 0;
  private users: number[] = [];
  private students: number[] = [];
  private teachers: number[] = [];
  private companies: string[] = [];
  private periods: number[] = [];
  private majors: string[] = [];
  staff!: { userId: number; token: string };
  /** รอบหลัก (ทั้ง 2 หลักสูตร) และรอบปลายทางสำหรับย้ายรอบ (ตั้งเฉพาะหลักสูตร A) */
  periodId!: number;
  otherPeriodId!: number;
  companyId!: string;

  token(userId: number, role: Role) {
    return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, { expiresIn: "30m" });
  }

  async setup() {
    for (const [major, nameTh] of [[this.A, this.nameA], [this.B, `ZZ หลักสูตรบี ${this.stamp}`]]) {
      await prisma.coopCriteria.create({ data: { major, nameTh } });
      this.majors.push(major);
    }
    const open = { startDate: new Date(Date.now() - 86_400_000), endDate: new Date(Date.now() + 86_400_000 * 60) };
    const row = (major: string) => ({ major, ...open, isActive: false, isSupervisionOpen: true });
    const p1 = await prisma.coopPeriod.create({ data: { academicYear: `ZZ${this.stamp}`, semester: 8, ...open, majors: { create: [row(this.A), row(this.B)] } } });
    const p2 = await prisma.coopPeriod.create({ data: { academicYear: `ZZ${this.stamp}`, semester: 9, ...open, majors: { create: [row(this.A)] } } });
    this.periods.push(p1.id, p2.id);
    this.periodId = p1.id;
    this.otherPeriodId = p2.id;
    const u = await this.user("staff");
    this.staff = { userId: u.id, token: this.token(u.id, "staff") };
    this.companyId = await this.company();
  }

  private async user(role: Role) {
    const n = ++this.seq;
    const u = await prisma.user.create({ data: { username: `zz-bl${this.stamp}-${n}`, email: `zz-bl${this.stamp}-${n}@kkumail.com`, role } });
    this.users.push(u.id);
    return u;
  }

  async company(name = `ZZ-BL บริษัท ${this.stamp}-${this.companies.length + 1}`) {
    const c = await prisma.company.create({ data: { name, province: "ขอนแก่น" } });
    this.companies.push(c.id);
    return c.id as string;
  }

  /** อาจารย์ · coopMajors = หลักสูตรที่ดูแลในฐานะอาจารย์ประจำวิชา */
  async teacher(major: string | null, coopMajors: string[] = []) {
    const u = await this.user("teacher");
    const t = await prisma.teacher.create({ data: { userId: u.id, email: u.email, firstName: `อจ${this.seq}`, lastName: `ZZ${this.stamp}`, major, isCoopTeacher: coopMajors.length > 0 } });
    for (const m of coopMajors) await prisma.coopTeacherMajor.create({ data: { teacherId: t.id, major: m } });
    this.teachers.push(t.id);
    return { userId: u.id, id: t.id as number, token: this.token(u.id, "teacher") };
  }

  async student(major: string | null, status: string, coop: Record<string, any> = {}) {
    const u = await this.user("student");
    const s = await prisma.student.create({
      data: { userId: u.id, studentId: `8${this.stamp}${String(this.seq).padStart(2, "0")}`, firstName: `นศ${this.seq}`, lastName: `ZZ`, email: u.email, major },
    });
    await prisma.studentCoop.create({ data: { studentId: s.id, status, companyId: this.companyId, coopPeriodId: this.periodId, ...coop } });
    this.students.push(s.id);
    return { userId: u.id, id: s.id as number, studentId: s.studentId as string, token: this.token(u.id, "student") };
  }

  /** นัดนิเทศ (สร้างตรงใน DB) */
  async appointment(studentPk: number, teacherPk: number, data: Record<string, any>) {
    return prisma.supervisionAppointment.create({ data: { studentId: studentPk, teacherId: teacherPk, supervisionType: "ONLINE", proposedDates: "[]", ...data } });
  }

  /** นักศึกษาที่ถูกสร้างโดย API (เช่น นำเข้า Excel) — ให้ cleanup ลบด้วย */
  async adopt(studentCodes: string[]) {
    const rows = await prisma.student.findMany({ where: { studentId: { in: studentCodes } }, select: { id: true, userId: true } });
    for (const r of rows) { this.students.push(r.id); if (r.userId) this.users.push(r.userId); }
  }

  async cleanup() {
    const sids = this.students;
    // ไฟล์ที่ผูกกับข้อมูลชุดนี้ — ลบหลังลบแถว (ไฟล์ร่วมกันมีแค่ภายในชุดนี้)
    const coops = await prisma.studentCoop.findMany({ where: { studentId: { in: sids } }, select: { reqLetterUrl: true, placeLetterUrl: true, acceptanceFileUrl: true } });
    const docs = await prisma.document.findMany({ where: { studentId: { in: sids } }, select: { path: true } });
    const sups = await prisma.supervisionAppointment.findMany({ where: { studentId: { in: sids } }, select: { officialLetterPath: true } });
    const files = [
      ...coops.flatMap((c: any) => [c.reqLetterUrl, c.placeLetterUrl, c.acceptanceFileUrl]),
      ...docs.map((d: any) => d.path),
    ].filter(Boolean).map((f: string) => path.join(UPLOADS, path.basename(f)));
    const supFiles = sups.map((s: any) => s.officialLetterPath).filter(Boolean).map((f: string) => path.join(UPLOADS, "supervision", path.basename(f)));

    await prisma.supervisionCoTeacher.deleteMany({ where: { OR: [{ teacherId: { in: this.teachers } }, { appointment: { studentId: { in: sids } } }] } });
    await prisma.supervisionAppointment.deleteMany({ where: { studentId: { in: sids } } });
    await prisma.document.deleteMany({ where: { studentId: { in: sids } } });
    await prisma.studentCoop.deleteMany({ where: { studentId: { in: sids } } });
    await prisma.student.deleteMany({ where: { id: { in: sids } } });
    await prisma.coopTeacherMajor.deleteMany({ where: { teacherId: { in: this.teachers } } });
    await prisma.teacher.deleteMany({ where: { id: { in: this.teachers } } });
    await prisma.notification.deleteMany({ where: { userId: { in: this.users } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: this.users } } });
    await prisma.user.deleteMany({ where: { id: { in: this.users } } });
    await prisma.company.deleteMany({ where: { id: { in: this.companies } } });
    await prisma.coopPeriod.deleteMany({ where: { id: { in: this.periods } } });
    await prisma.coopCriteria.deleteMany({ where: { major: { in: this.majors } } });
    await prisma.docNumberLock.deleteMany({ where: { number: { contains: this.stamp } } });
    for (const f of [...files, ...supFiles]) { try { fs.unlinkSync(f); } catch { /* ไม่มีแล้ว */ } }
  }
}
