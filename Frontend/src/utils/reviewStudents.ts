import { apiFetch } from "./apiFetch";

// รายชื่อในหน้าตรวจ T002/T003 — server กรองเฉพาะนักศึกษาที่เกี่ยวกับแบบฟอร์มนั้น และแนบเฉพาะไฟล์แบบฟอร์มนั้น
// (เดิมโหลดนักศึกษาทุกคนพร้อมเอกสารทุกไฟล์มากรองเอง — ช้าลงทุกปี และเกิน 1000 คนถูกตัดโดยไม่บอก)
export type ReviewKind = "T002" | "T003";

/** จำนวนในรายการตรวจของแต่ละรอบ — coopPeriodId null = นักศึกษาที่ยังไม่ผูกรอบ (เห็นเฉพาะ "ทุกปีการศึกษา") */
export interface PeriodCount {
  coopPeriodId: number | null;
  count: number;
  pending: number;
}

// รอบเริ่มต้นของหน้า = รอบที่เปิดอยู่ (utils/defaultPeriod) — งานค้างรอบอื่นเตือนด้วย pendingOutside

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
