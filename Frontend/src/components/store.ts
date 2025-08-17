export type DocStatus = "waiting" | "under-review" | "approved" | "rejected";
export interface DocumentItem { id: string; title: string; dueDate: string; status: DocStatus; fileName?: string; lastUpdated?: string; }
export interface CompanyInfo { name: string; address: string; hrName: string; hrEmail: string; }
export interface MentorInfo { firstName: string; lastName: string; phone: string; email: string; title: string; }
export interface StudentProfile {
  email: string; studentId: string; firstName: string; lastName: string; phone: string; gpa: string;
  major: string; curriculum: string; nationality: string; religion: string;
  company?: CompanyInfo; mentor?: MentorInfo; docs: DocumentItem[];
}
export interface DailyLog { 
  id: string;
  date: string;
  studentName: string;
  checkIn: string;
  checkOut: string;
  note?: string;
  createdAt: string;
  signature?: string; 
}

const PROF_KEY = "coop.student.profile.v1";
const DAILY_KEY = "coop.student.daily.v1";

const isoDate = (d = new Date()) => d.toISOString().slice(0, 10);
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

const defaultDocs = (): DocumentItem[] => [
  { id: "req",   title: "แบบคำร้องขอฝึกสหกิจ",            dueDate: isoDate(addDays(7)),  status: "waiting" },
  { id: "mou",   title: "บันทึกข้อตกลง (MOU)",            dueDate: isoDate(addDays(14)), status: "waiting" },
  { id: "prog",  title: "รายงานความก้าวหน้า (Progress)", dueDate: isoDate(addDays(45)), status: "waiting" },
  { id: "final", title: "รายงานฉบับสมบูรณ์ (Final)",     dueDate: isoDate(addDays(90)), status: "waiting" },
];

export function loadProfile(): StudentProfile {
  try {
    const raw = localStorage.getItem(PROF_KEY);
    if (raw) return JSON.parse(raw) as StudentProfile;
  } catch (_err: unknown) {
    // localStorage / JSON.parse มีปัญหา -> ใช้ค่าเริ่มต้นแทน
    void _err;
  }
  return {
    email: "", studentId: "", firstName: "", lastName: "", phone: "", gpa: "",
    major: "", curriculum: "", nationality: "", religion: "",
    docs: defaultDocs(),
  };
}

export function saveProfile(p: StudentProfile) {
  localStorage.setItem(PROF_KEY, JSON.stringify(p));
}

export function loadDaily(): DailyLog[] {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (raw) return JSON.parse(raw) as DailyLog[];
  } catch (_err: unknown) {
    // localStorage / JSON.parse มีปัญหา -> คืนอาเรย์ว่าง
    void _err;
  }
  return [];
}

export function saveDaily(list: DailyLog[]) {
  localStorage.setItem(DAILY_KEY, JSON.stringify(list));
}
