import { apiFetch } from "./apiFetch";

// รายชื่อในหน้าตรวจ T002/T003 — server กรองเฉพาะนักศึกษาที่เกี่ยวกับแบบฟอร์มนั้น และแนบเฉพาะไฟล์แบบฟอร์มนั้น
// (เดิมโหลดนักศึกษาทุกคนพร้อมเอกสารทุกไฟล์มากรองเอง — ช้าลงทุกปี และเกิน 1000 คนถูกตัดโดยไม่บอก)
export type ReviewKind = "T002" | "T003";

export interface PeriodOption {
  id: number;
  semester: string | number;
  academicYear: string;
}

/** รอบล่าสุด (ปีการศึกษามากสุด แล้วภาคการศึกษามากสุด) — ค่าเริ่มของหน้ารายการ แทน "ทุกปีการศึกษา" */
export function latestPeriodId(periods: PeriodOption[]): string {
  const sorted = [...periods].sort((a, b) =>
    Number(b.academicYear) - Number(a.academicYear) || Number(b.semester) - Number(a.semester));
  return sorted.length ? String(sorted[0].id) : "all";
}

/** total > students.length = ถูกจำกัดจำนวน — หน้าเว็บควรบอกให้เลือกรอบ */
export async function loadReviewStudents<T>(review: ReviewKind, period: string): Promise<{ students: T[]; total: number }> {
  const params = new URLSearchParams({ review });
  if (period && period !== "all") params.set("coopPeriodId", period);
  const res = await apiFetch(`/api/admin/students?${params}`);
  const data = await res.json();
  if (!res.ok || data?.ok === false) throw new Error(data?.message || "โหลดรายชื่อไม่สำเร็จ");
  const students: T[] = Array.isArray(data) ? data : (data?.data ?? []);
  return { students, total: data?.meta?.total ?? students.length };
}
