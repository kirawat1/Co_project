//store.ts
export type DocStatus = "waiting" | "under-review" | "approved" | "rejected";
export interface DocumentItem {
  id: string;
  title: string;
  dueDate: string;
  status: DocStatus;
  fileName?: string;
  lastUpdated?: string;
}
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
}

export interface MentorProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string; // ตำแหน่ง
  department?: string; // แผนก
  companyName?: string; // ชื่อบริษัท
}

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

const PROF_KEY = "coop.student.profile.v1";
const DAILY_KEY = "coop.student.daily.v1";

const isoDate = (d = new Date()) => d.toISOString().slice(0, 10);
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

const defaultDocs = (): DocumentItem[] => [
  {
    id: "req",
    title: "แบบคำร้องขอฝึกสหกิจ",
    dueDate: isoDate(addDays(7)),
    status: "waiting",
  },
  {
    id: "KKUCP-T000",
    title: "KKUCP-T000_ใบสมัครงานสหกิจศึกษา",
    dueDate: isoDate(addDays(14)),
    status: "waiting",
  },
  {
    id: "KKUCP-T001",
    title: "KKUCP-T001_ใบยินยอมจากผู้ปกครอง",
    dueDate: isoDate(addDays(45)),
    status: "waiting",
  },
  {
    id: "KKUCP-T002",
    title: "KKUCP-T002_แบบแจ้งรายละเอียดงานและรายละเอียดที่พัก",
    dueDate: isoDate(addDays(90)),
    status: "waiting",
  },
  {
    id: "KKUCP-T003",
    title: "KKUCP-T003_แบบแผนและโครงร่างรายงานการปฏิบัติงานสหกิจศึกษา-Proposal",
    dueDate: isoDate(addDays(90)),
    status: "waiting",
  },
  {
    id: "KKUCP-T004",
    title: "KKUCP-T004_แบบบันทึกการนิเทศงานนักศึกษาสหกิจศึกษา",
    dueDate: isoDate(addDays(90)),
    status: "waiting",
  },
];

/** โหลดโปรไฟล์เดี่ยว (ใช้ตอนนักศึกษา login ตัวเอง) */
export function loadProfile(): StudentProfile {
  try {
    const raw = localStorage.getItem(PROF_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed[0] as StudentProfile; // ถ้าเป็น array คืนตัวแรก
    }
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

/** โหลดหลายโปรไฟล์ (ใช้เวลา mentor ดูนักศึกษาหลายคน) */
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

/** บันทึกโปรไฟล์ (ถ้ามีอยู่แล้วจะ update, ถ้าไม่มีจะ push ใหม่) */
export function saveProfile(p: StudentProfile) {
  const profiles = loadProfiles();
  const idx = profiles.findIndex((x) => x.studentId === p.studentId);
  if (idx >= 0) profiles[idx] = p;
  else profiles.push(p);

  localStorage.setItem(PROF_KEY, JSON.stringify(profiles));
}

//
// ---------- Daily Logs ----------
//

export function loadDaily(): DailyLog[] {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as DailyLog[]) : [];
    }
  } catch (err) {
    console.warn("loadDaily error", err);
  }
  return [];
}

export function saveDaily(list: DailyLog[]) {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("saveDaily error", err);
  }
}

export function saveDailyForStudent(studentId: string, list: DailyLog[]) {
  try {
    const all = loadDaily();
    const merged = [...all.filter((l) => l.studentId !== studentId), ...list];
    localStorage.setItem(DAILY_KEY, JSON.stringify(merged));
  } catch (err) {
    console.error("saveDaily error", err);
  }
}

// ---------- Mentor view: โหลดโปรไฟล์นักศึกษาที่ตัวเองดูแล ----------

/** โหลดโปรไฟล์นักศึกษาที่อยู่ใน mentor's list เท่านั้น */
export function loadProfilesForMentor(): StudentProfile[] {
  try {
    const rawMentor = localStorage.getItem("coop.mentor.students");
    const mentorIds: string[] = rawMentor
      ? JSON.parse(rawMentor).map((s: any) => s.studentId ?? s.id)
      : [];

    const profiles = loadProfiles();

    // ✅ กรองเฉพาะ studentId ที่อยู่ใน mentor list
    return profiles.filter((p) => mentorIds.includes(p.studentId));
  } catch {
    return [];
  }
}

// ---------- Addmin: ลบ Profile ----------
export function removeProfile(studentId: string) {
  const profiles = loadProfiles().filter((p) => p.studentId !== studentId);
  localStorage.setItem(PROF_KEY, JSON.stringify(profiles));
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
