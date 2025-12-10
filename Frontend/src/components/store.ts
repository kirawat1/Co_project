/* eslint-disable @typescript-eslint/no-explicit-any */
// ===================================================
// Coop Management System - STORE FILE (FINAL VERSION)
// ===================================================

// ---------- Document Types ----------
export type DocStatus = "waiting" | "under-review" | "approved" | "rejected";

export interface DocumentItem {
  fileData: any;
  id: string;           // เช่น T000, T001, W001
  title: string;        // ชื่อเอกสาร
  dueDate: string;      // YYYY-MM-DD
  status: DocStatus;

  fileName?: string;
  lastUpdated?: string;

  // ประเภทหลักของเอกสาร
  type: "form" | "upload" | "download";

  // ความสามารถเพิ่มเติม
  needForm?: boolean;      // ต้องกรอกในระบบ
  needDownload?: boolean;  // มีไฟล์ต้นฉบับให้ดาวน์โหลด
  needUpload?: boolean;    // ต้องอัปโหลดไฟล์กลับขึ้นระบบ
}

// -------- Company & Mentor --------
export interface CompanyInfo {
  id: string;
  name: string;
  address: string;
  hrName: string;
  hrEmail: string;
  mentors?: MentorInfo[];
}

export interface MentorInfo {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  title: string;
  companyId: string;
  department?: string;
}

// -------- Mentor Profile --------
export interface MentorProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
  department?: string;
  companyName?: string;
}

// -------- Student Profile --------
export interface StudentProfile {
  email: string;
  studentId: string;
  firstName: string;
  lastName: string;
  phone: string;
  gpa: string;
  major: string;
  curriculum: string;
  nationality: string;
  religion: string;

  company?: CompanyInfo;
  mentor?: MentorInfo;

  docs: DocumentItem[];
}

// -------- Daily Logs ----------
export interface DailyLog {
  id: string;
  studentId: string;
  date: string;
  studentName: string;
  checkIn: string;
  checkOut: string;
  note?: string;
  createdAt: string;

  signature?: string;
  mentorSignature?: string;
  mentorName?: string;
}

// ===================================================
// Utility
// ===================================================
const PROF_KEY = "coop.student.profile.v1";
const DAILY_KEY = "coop.student.daily.v1";

const isoDate = (d = new Date()) => d.toISOString().slice(0, 10);
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

// ===================================================
// Default Documents (FINAL VERSION)
// ===================================================

export const defaultDocs = (): DocumentItem[] => [
  // ---------- ก่อนออกสหกิจ ----------
  {
    id: "T000",
    title: "KKUCP-T000 ใบสมัครสหกิจ",
    type: "form",
    needForm: true,
    needDownload: true,
    needUpload: true,
    dueDate: isoDate(addDays(14)),
    status: "waiting",
  },
  {
    id: "T001",
    title: "KKUCP-T001 ใบยินยอมผู้ปกครอง",
    type: "upload",
    needDownload: true,
    needUpload: true,
    dueDate: isoDate(addDays(30)),
    status: "waiting",
  },
  {
    id: "T002",
    title: "KKUCP-T002 รายละเอียดงานและที่พัก",
    type: "upload",
    needDownload: true,
    needUpload: true,
    dueDate: isoDate(addDays(45)),
    status: "waiting",
  },
  {
    id: "T003",
    title: "KKUCP-T003 Proposal",
    type: "upload",
    needDownload: true,
    needUpload: true,
    dueDate: isoDate(addDays(60)),
    status: "waiting",
  },

  // ---------- ระหว่างสหกิจ ----------
  {
    id: "T004",
    title: "KKUCP-T004 แบบบันทึกนิเทศงาน",
    type: "form",
    needForm: true,
    needDownload: true,
    needUpload: true,
    dueDate: isoDate(addDays(70)),
    status: "waiting",
  },
  {
    id: "W001",
    title: "รายงานการปฏิบัติงานรายสัปดาห์",
    type: "form",
    needForm: true,
    needDownload: true,
    needUpload: true,
    dueDate: isoDate(addDays(90)),
    status: "waiting",
  },
  {
    id: "L001",
    title: "หนังสือขอเข้านิเทศ",
    type: "download",
    needDownload: true,
    dueDate: isoDate(addDays(90)),
    status: "approved",
  },

  // ---------- หลังสหกิจ ----------
  {
    id: "T007",
    title: "KKUCP-T007 รายงานปฏิบัติสหกิจ",
    type: "form",
    needForm: true,
    needDownload: true,
    needUpload: true,
    dueDate: isoDate(addDays(120)),
    status: "waiting",
  },
  {
    id: "009",
    title: "009 เล่มรายงานฉบับสมบูรณ์",
    type: "upload",
    needDownload: true,
    needUpload: true,
    dueDate: isoDate(addDays(150)),
    status: "waiting",
  },
];

// ===================================================
// Student Profile Load/Save
// ===================================================

export function loadProfile(): StudentProfile {
  try {
    const raw = localStorage.getItem(PROF_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw);
    return parsed as StudentProfile;
  } catch {
    return {
      email: "",
      studentId: "",
      firstName: "",
      lastName: "",
      phone: "",
      gpa: "",
      major: "",
      curriculum: "",
      nationality: "",
      religion: "",
      docs: defaultDocs(),
    };
  }
}

export function loadProfiles(): StudentProfile[] {
  try {
    const raw = localStorage.getItem(PROF_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

export function saveProfile(p: StudentProfile) {
  const list = loadProfiles();
  const idx = list.findIndex((x) => x.studentId === p.studentId);
  if (idx >= 0) list[idx] = p;
  else list.push(p);

  localStorage.setItem(PROF_KEY, JSON.stringify(list));
}

// ===================================================
// Daily Logs
// ===================================================

export function loadDaily(): DailyLog[] {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDaily(list: DailyLog[]) {
  localStorage.setItem(DAILY_KEY, JSON.stringify(list));
}

export function saveDailyForStudent(studentId: string, list: DailyLog[]) {
  const all = loadDaily();
  const merged = [...all.filter((x) => x.studentId !== studentId), ...list];
  localStorage.setItem(DAILY_KEY, JSON.stringify(merged));
}

// ===================================================
// Mentor / Teacher Management
// ===================================================

export function loadProfilesForMentor(): StudentProfile[] {
  try {
    const raw = localStorage.getItem("coop.mentor.students");
    const ids: string[] = raw ? JSON.parse(raw).map((s: any) => s.studentId) : [];
    return loadProfiles().filter((p) => ids.includes(p.studentId));
  } catch {
    return [];
  }
}

const ADMIN_KEY = "coop.admin.mentors";

export function loadMentors(): MentorProfile[] {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveMentors(list: MentorProfile[]) {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(list));
}

const TEACHER_KEY = "coop.admin.teachers";

export interface TeacherProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department?: string;
  title?: string;
}

export function loadTeachers(): TeacherProfile[] {
  try {
    return JSON.parse(localStorage.getItem(TEACHER_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveTeachers(list: TeacherProfile[]) {
  localStorage.setItem(TEACHER_KEY, JSON.stringify(list));
}
