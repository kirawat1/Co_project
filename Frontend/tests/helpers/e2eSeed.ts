/**
 * tests/helpers/e2eSeed.ts
 * ─────────────────────────────────────────────────────
 * Fixture สำหรับ E2E test ที่เดิน flow จริงทั้งระบบ (coop-lifecycle.e2e.spec.ts)
 *
 * ต่างจาก mockApi.ts: ไฟล์นี้ "ไม่ mock อะไรเลย" — ยิง backend จริง เขียน DB จริง
 * เพราะ flow สหกิจเป็นการส่งต่อสถานะข้าม 3 role ซึ่ง mock แล้วจะไม่เหลืออะไรให้ทดสอบ
 *
 * ข้อกำหนด:
 *   - backend ต้องรันอยู่ที่ http://localhost:5000
 *   - MySQL ต้องเข้าถึงได้ (ใช้ prisma client ของ backend โดยตรง)
 *
 * fixture สร้าง user ของตัวเองทั้ง 3 role + รอบสหกิจ + บริษัท แล้วลบทิ้งเมื่อจบ
 * จึงไม่ผูกกับบัญชีที่มีอยู่เดิมใน DB และรันซ้ำได้เรื่อย ๆ
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const BACKEND_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../backend"
);

const prisma = require(path.join(BACKEND_DIR, "config/prismaClient.js"));
const bcrypt = require(path.join(BACKEND_DIR, "node_modules/bcryptjs"));

export const API_BASE = "http://localhost:5000";
export const E2E_PASSWORD = "E2eTest#1234";

export interface LifecycleFixture {
  stamp: number;
  student: { userId: number; studentPk: number; studentId: string; email: string };
  teacher: { userId: number; teacherPk: number; email: string };
  staff: { userId: number; email: string };
  periodId: number;
  companyId: string;
}

/** ยืนยันว่า backend รันอยู่จริง — ถ้าไม่ ให้ fail ด้วยข้อความที่บอกวิธีแก้ทันที */
export async function assertBackendUp(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/announcements`);
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (err) {
    throw new Error(
      `E2E test ต้องใช้ backend จริงที่ ${API_BASE} แต่เชื่อมต่อไม่ได้ (${err})\n` +
        `แก้: cd backend && npm run dev`
    );
  }
}

export async function seedLifecycleFixture(): Promise<LifecycleFixture> {
  const stamp = Date.now();
  const hash = await bcrypt.hash(E2E_PASSWORD, 10);
  const tag = `e2e${stamp}`;

  // ── staff ─────────────────────────────────────────────
  const staffUser = await prisma.user.create({
    data: {
      username: `zz-${tag}-staff`,
      email: `zz-${tag}-staff@kkumail.com`,
      password: hash,
      role: "staff",
    },
  });
  await prisma.staffProfile.create({
    data: { userId: staffUser.id, firstName: "อีทูอี", lastName: "เจ้าหน้าที่" },
  });

  // ── teacher (เป็นทั้งที่ปรึกษาและอาจารย์ประจำวิชาสหกิจ) ──
  const teacherUser = await prisma.user.create({
    data: {
      username: `zz-${tag}-teacher`,
      email: `zz-${tag}-teacher@kkumail.com`,
      password: hash,
      role: "teacher",
    },
  });
  const teacher = await prisma.teacher.create({
    data: {
      userId: teacherUser.id,
      prefix: "ผศ. ดร.",
      firstName: "อีทูอี",
      lastName: "อาจารย์",
      email: teacherUser.email,
      phone: "0800000001",
      isCoopTeacher: true,
    },
  });

  // ── รอบสหกิจ: เปิดรับสมัคร + เปิดนัดนิเทศ ───────────────
  // ใช้ semester เลขสูงกันชนกับรอบจริงที่ unique [academicYear, semester]
  const period = await prisma.coopPeriod.create({
    data: {
      academicYear: `E2E${String(stamp).slice(-6)}`,
      semester: 9,
      isActive: true,
      startDate: new Date(Date.now() - 86_400_000),
      endDate: new Date(Date.now() + 86_400_000 * 30),
      isSupervisionOpen: true,
      supervisionStartDate: new Date(Date.now() - 86_400_000),
      supervisionEndDate: new Date(Date.now() + 86_400_000 * 90),
    },
  });

  // ── student (ผูกที่ปรึกษาไว้แล้ว เพราะ propose นิเทศต้องมี coopAdvisor) ──
  const studentUser = await prisma.user.create({
    data: {
      username: `zz-${tag}-student`,
      email: `zz-${tag}-student@kkumail.com`,
      password: hash,
      role: "student",
    },
  });
  const student = await prisma.student.create({
    data: {
      userId: studentUser.id,
      studentId: `90${String(stamp).slice(-8)}`,
      prefix: "MR",
      firstName: "อีทูอี",
      lastName: "นักศึกษา",
      email: studentUser.email,
      major: "CS",
      year: "4",
      studyProgram: "normal",
      generalAdvisorId: teacher.id,
      coopAdvisorId: teacher.id,
    },
  });

  const company = await prisma.company.create({
    data: {
      name: `ZZ-E2E บริษัททดสอบ ${stamp}`,
      address: "123 หมู่ 16 ถ.มิตรภาพ ตำบลในเมือง อำเภอเมืองขอนแก่น จังหวัดขอนแก่น 40002",
      province: "ขอนแก่น",
      email: "e2e@company.test",
      phone: "0800000002",
      contactPerson: "ผู้ประสานงาน อีทูอี",
      contactPosition: "HR",
      pastYears: "2569",
      createdById: staffUser.id,
    },
  });

  // สภาพตั้งต้น: นักศึกษาเลือกบริษัทจากหน้าโปรไฟล์ไว้แล้ว แต่ยังไม่ยื่นคำร้อง
  // (หน้า Gateway บล็อกการยื่นถ้ายังไม่มีบริษัท — ดู S_Gateway.tsx handleSubmitApplication)
  // coopPeriodId ปล่อยว่างไว้ ให้ endpoint ยื่นคำร้องเป็นคนผูกเอง
  await prisma.studentCoop.create({
    data: {
      studentId: student.id,
      status: "NOT_SUBMITTED",
      companyId: company.id,
    },
  });

  return {
    stamp,
    student: {
      userId: studentUser.id,
      studentPk: student.id,
      studentId: student.studentId,
      email: studentUser.email,
    },
    teacher: { userId: teacherUser.id, teacherPk: teacher.id, email: teacherUser.email },
    staff: { userId: staffUser.id, email: staffUser.email },
    periodId: period.id,
    companyId: company.id,
  };
}

export async function cleanupLifecycleFixture(fx: LifecycleFixture): Promise<void> {
  const { student, teacher, staff, periodId, companyId } = fx;

  // ลบตามลำดับ FK — ลูกก่อนพ่อแม่เสมอ
  await prisma.supervisionAppointment.deleteMany({ where: { studentId: student.studentPk } });
  await prisma.notification.deleteMany({
    where: { userId: { in: [student.userId, teacher.userId, staff.userId] } },
  });
  await prisma.document.deleteMany({ where: { studentId: student.studentPk } });
  await prisma.coopT002Form.deleteMany({ where: { studentId: student.studentPk } });
  await prisma.coopT003Form.deleteMany({ where: { studentId: student.studentPk } });
  await prisma.coopApplicationForm.deleteMany({ where: { studentId: student.studentPk } });
  await prisma.studentCoop.deleteMany({ where: { studentId: student.studentPk } });
  await prisma.student.deleteMany({ where: { id: student.studentPk } });

  await prisma.mentor.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });

  await prisma.teacher.deleteMany({ where: { id: teacher.teacherPk } });
  await prisma.staffProfile.deleteMany({ where: { userId: staff.userId } });
  await prisma.user.deleteMany({
    where: { id: { in: [student.userId, teacher.userId, staff.userId] } },
  });

  await prisma.coopPeriod.deleteMany({ where: { id: periodId } });
}

export async function disconnectSeed(): Promise<void> {
  await prisma.$disconnect();
}

/** อ่านสถานะสหกิจปัจจุบันจาก DB — ใช้ยืนยันการส่งต่อสถานะระหว่าง role */
export async function getCoopStatus(studentPk: number): Promise<string | null> {
  const coop = await prisma.studentCoop.findUnique({ where: { studentId: studentPk } });
  return coop?.status ?? null;
}

export async function getCoop(studentPk: number) {
  return prisma.studentCoop.findUnique({ where: { studentId: studentPk } });
}

export async function getSupervision(studentPk: number) {
  return prisma.supervisionAppointment.findUnique({ where: { studentId: studentPk } });
}

export async function getDocument(studentPk: number, type: string) {
  return prisma.document.findFirst({
    where: { studentId: studentPk, type },
    orderBy: { id: "desc" },
  });
}

export async function countNotifications(userId: number, messageContains: string) {
  return prisma.notification.count({
    where: { userId, message: { contains: messageContains } },
  });
}
