/* =========================================================
   Shared Store – FINAL VERSION
   ใช้ร่วมกันทั้ง Student / Admin / Teacher
========================================================= */

/* =========================
   Utils
========================= */
const jsonLoad = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const jsonSave = (key: string, val: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    console.warn("localStorage save failed:", key);
  }
};

/* =========================
   Storage Keys (UNIFIED)
========================= */
export const K = {
  STUDENTS: "coop.student.profile.v1", // ✅ ใช้ key เดียวทั้งระบบ
  STUDENT_INDEX: "coop.students.index",

  COMPANIES: "coop.admin.companies",

  ANNOUNCEMENTS: "coop.shared.announcements",
  DOC_PERIODS: "coop.admin.docPeriods.v1",
  ACADEMIC_YEAR: "coop.admin.academicYear",

  DAILY_PREFIX: "coop.student.daily.",

  TEACHERS: "coop.admin.teachers.v1",
  MENTORS: "coop.admin.mentors.v1",
};

/* =========================
   Document
========================= */
export type DocStatus = "waiting" | "under-review" | "approved" | "rejected";

export type DocumentHistory = {
  status: DocStatus;
  by: string;
  reason?: string;
  at: string;
};

export interface DocumentItem {
  id: string;
  title: string;
  status: DocStatus;

  dueDate?: string;

  fileName?: string;
  fileData?: string;
  lastUpdated?: string;

  needForm?: boolean;
  needUpload?: boolean;
  needDownload?: boolean;

  rejectReason?: string;
  history?: DocumentHistory[];
}

/* =========================
   Document Helper (IMPORTANT)
========================= */
export function updateDocumentStatus(
  doc: DocumentItem,
  status: DocStatus,
  by: string,
  reason?: string
): DocumentItem {
  const h: DocumentHistory = {
    status,
    by,
    reason,
    at: new Date().toISOString(),
  };

  return {
    ...doc,
    status,
    rejectReason: reason,
    lastUpdated: h.at,
    history: [...(doc.history ?? []), h],
  };
}

/* =========================
   Coop Request
========================= */
export type CoopRequestState = {
  status?: "draft" | "submitted" | "approved" | "rejected" | "waiting-special";

  coopField?: string;

  submitted?: boolean; // ✅ boolean ชัดเจน
  submittedAt?: string;

  teacherReviewedBy?: string;
  teacherReviewedAt?: string;

  teacherDecision?: "passed" | "failed";
  teacherComment?: string;

  rejectReason?: string;

  eligibility?: {
    passedPrepCourse?: boolean;
    prepCourseTerm?: string;
    prepCourseYear?: string;
    gpaOk?: boolean;
    coreGpaOk?: boolean;
    activityCredits60?: boolean;
    englishTestPassed?: boolean;
    computerTestPassed?: boolean;
    otherNote?: string;
  };
};

/* =========================
   Student
========================= */
export interface StudentEmail {
  email: string;
  primary: boolean;
}

export interface StudentCompany {
  id?: string;
  name: string;
  address?: string;
  hrName?: string;
  hrPosition?: string;
  hrEmail?: string;
  phone?: string;
  fax?: string;
  website?: string;
}

export interface StudentProfile {
  studentId: string;

  prefix?: "นาย" | "นางสาว";
  firstName?: string;
  lastName?: string;

  year?: string;
  major?: string;
  curriculum?: string;
  studyProgram?: "normal" | "special";

  phone?: string;

  emails: StudentEmail[];
  company?: StudentCompany;

  docs: DocumentItem[];
  coopRequest?: CoopRequestState;
}

/* =========================
   Student Normalizer
========================= */
function normalizeStudent(p: StudentProfile): StudentProfile {
  return {
    ...p,
    emails:
      p.emails && p.emails.length
        ? p.emails
        : [
            { email: "", primary: true },
            { email: "", primary: false },
          ],
    docs: p.docs ?? [],
  };
}

/* =========================
   Students APIs
========================= */
export function loadStudents(): StudentProfile[] {
  return jsonLoad<StudentProfile[]>(K.STUDENTS, []).map(normalizeStudent);
}

export function saveStudents(list: StudentProfile[]) {
  jsonSave(K.STUDENTS, list);
}

export function upsertStudent(profile: StudentProfile) {
  const list = loadStudents();
  const idx = list.findIndex((s) => s.studentId === profile.studentId);
  const next = normalizeStudent(profile);

  if (idx >= 0) list[idx] = { ...next };
  else list.push(next);

  saveStudents(list);

  const index = jsonLoad<Record<string, boolean>>(K.STUDENT_INDEX, {});
  index[profile.studentId] = true;
  jsonSave(K.STUDENT_INDEX, index);
}

export function loadProfile(studentId: string): StudentProfile {
  return (
    loadStudents().find((s) => s.studentId === studentId) ??
    normalizeStudent({
      studentId,
      emails: [],
      docs: [],
    } as StudentProfile)
  );
}

export function saveProfile(profile: StudentProfile) {
  upsertStudent(profile);
}

/* =========================
   Announcements
========================= */
export interface AnnouncementAttachment {
  type: "link" | "file" | "image";
  name: string;
  url: string;
}

export interface Announcement {
  id: string;
  title: string;
  body?: string;
  date: string;
  year?: string;
  attachments?: AnnouncementAttachment[];
}

export function loadAnnouncements(): Announcement[] {
  return jsonLoad<Announcement[]>(K.ANNOUNCEMENTS, []);
}

export function saveAnnouncements(list: Announcement[]) {
  jsonSave(K.ANNOUNCEMENTS, list);
}

/* =========================
   Academic Year
========================= */
export function loadAcademicYear(): string {
  const y = localStorage.getItem(K.ACADEMIC_YEAR);
  if (y) return y;

  const now = new Date();
  const th = now.getFullYear() + 543;
  const term = now.getMonth() + 1 >= 6 ? 1 : 2;
  const guess = `${th}/${term}`;

  localStorage.setItem(K.ACADEMIC_YEAR, guess);
  return guess;
}

export function saveAcademicYear(y: string) {
  localStorage.setItem(K.ACADEMIC_YEAR, y);
}

/* =========================
   Document Periods
========================= */
export interface DocPeriod {
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
}

export function loadDocPeriods(): Record<string, DocPeriod> {
  return jsonLoad<Record<string, DocPeriod>>(K.DOC_PERIODS, {});
}

export function saveDocPeriods(p: Record<string, DocPeriod>) {
  jsonSave(K.DOC_PERIODS, p);
}

/* =========================
   Daily Logs
========================= */
export interface DailyLog {
  id: string;
  studentId: string;
  studentName?: string;
  mentorName?: string;

  date: string;
  checkIn?: string;
  checkOut?: string;
  note?: string;

  status?: "draft" | "submitted";
  submittedAt?: string;

  createdAt?: string;
}

export function loadDaily(studentId: string): DailyLog[] {
  return jsonLoad<DailyLog[]>(`${K.DAILY_PREFIX}${studentId}`, []);
}

export function saveDaily(studentId: string, list: DailyLog[]) {
  jsonSave(`${K.DAILY_PREFIX}${studentId}`, list);
}

export function loadAllDaily(): DailyLog[] {
  return loadStudents().flatMap((s) =>
    loadDaily(s.studentId).map((l) => ({
      ...l,
      studentId: s.studentId,
    }))
  );
}

/* =========================
   Mentors / Teachers
========================= */
export interface MentorProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
  department?: string;
}

export function loadMentors(): MentorProfile[] {
  return jsonLoad<MentorProfile[]>(K.MENTORS, []);
}

export function saveMentors(list: MentorProfile[]) {
  jsonSave(K.MENTORS, list);
}

/* =========================
   Notifications (Optional)
========================= */
export type StudentNotification = {
  id: string;
  studentId: string;
  message: string;
  createdAt: string;
  read?: boolean;
};
