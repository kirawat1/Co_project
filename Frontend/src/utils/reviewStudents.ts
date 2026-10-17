import { apiFetch } from "./apiFetch";

// รายชื่อในหน้าตรวจ T002/T003 — server กรองเฉพาะนักศึกษาที่เกี่ยวกับแบบฟอร์มนั้น และแนบเฉพาะไฟล์แบบฟอร์มนั้น
// (เดิมโหลดนักศึกษาทุกคนพร้อมเอกสารทุกไฟล์มากรองเอง — ช้าลงทุกปี และเกิน 1000 คนถูกตัดโดยไม่บอก)
export type ReviewKind = "T002" | "T003";

export interface PeriodOption {
  id: number;
  semester: string | number;
  academicYear: string;
}

/** จำนวนในรายการตรวจของแต่ละรอบ — coopPeriodId null = นักศึกษาที่ยังไม่ผูกรอบ (เห็นเฉพาะ "ทุกปีการศึกษา") */
export interface PeriodCount {
  coopPeriodId: number | null;
  count: number;
  pending: number;
}

const newestFirst = (periods: PeriodOption[]) => [...periods].sort((a, b) =>
  Number(b.academicYear) - Number(a.academicYear) || Number(b.semester) - Number(a.semester));

/**
 * รอบเริ่มต้นของหน้าตรวจ (แทน "ทุกปีการศึกษา" ที่ยาวขึ้นทุกปี):
 *   มีงานรอตรวจของนักศึกษาที่ยังไม่ผูกรอบ → ทุกปีการศึกษา (เลือกรอบไหนก็ไม่เห็น)
 *   → รอบล่าสุดที่มีงานรอตรวจ → รอบล่าสุดที่มีรายชื่อ → ทุกปีการศึกษา
 * ไม่ใช้ "รอบใหม่สุด" เฉยๆ: ช่วงที่รอบหน้าเปิดรับสมัครแล้ว งานตรวจยังอยู่รอบก่อน — หน้าจะว่างและงานค้างถูกซ่อน
 */
export function defaultReviewPeriod(periods: PeriodOption[], counts: PeriodCount[]): string {
  if (counts.some(c => c.coopPeriodId == null && c.pending > 0)) return "all";
  const of = (id: number) => counts.find(c => c.coopPeriodId === id);
  const sorted = newestFirst(periods);
  const pick = sorted.find(p => (of(p.id)?.pending ?? 0) > 0) ?? sorted.find(p => (of(p.id)?.count ?? 0) > 0);
  return pick ? String(pick.id) : "all";
}

/** งานรอตรวจที่อยู่นอกรอบที่เลือก — แสดงเตือนไม่ให้งานค้างถูกซ่อนเงียบๆ */
export function pendingOutside(counts: PeriodCount[], selected: string): number {
  if (!selected || selected === "all") return 0;
  return counts.filter(c => String(c.coopPeriodId) !== selected).reduce((n, c) => n + c.pending, 0);
}

/** ต่อท้ายชื่อรอบใน dropdown เช่น " · 12 คน · รอตรวจ 3" */
export function periodCountLabel(counts: PeriodCount[], periodId: number | string): string {
  const c = counts.find(x => String(x.coopPeriodId) === String(periodId));
  if (!c) return "";
  return ` · ${c.count} คน${c.pending ? ` · รอตรวจ ${c.pending}` : ""}`;
}

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
