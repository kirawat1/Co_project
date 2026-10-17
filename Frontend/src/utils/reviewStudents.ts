import { apiFetch } from "./apiFetch";

// รายชื่อในหน้าตรวจ T002/T003 — server กรองเฉพาะนักศึกษาที่เกี่ยวกับแบบฟอร์มนั้น และแนบเฉพาะไฟล์แบบฟอร์มนั้น
// (เดิมโหลดนักศึกษาทุกคนพร้อมเอกสารทุกไฟล์มากรองเอง — ช้าลงทุกปี และเกิน 1000 คนถูกตัดโดยไม่บอก)
export type ReviewKind = "T002" | "T003";

// จำนวนต่อรอบ / เตือนงานค้างรอบอื่น / ป้ายใน dropdown ใช้ร่วมทุกหน้า → utils/defaultPeriod
export { pendingOutside, periodCountLabel, type PeriodCount } from "./defaultPeriod";
import type { PeriodCount } from "./defaultPeriod";

export async function loadReviewCounts(review: ReviewKind): Promise<PeriodCount[]> {
  const res = await apiFetch(`/api/admin/students?review=${review}&countsOnly=1`);
  const data = await res.json().catch(() => null);
  return res.ok && data?.ok ? (data.periods ?? []) : [];
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
