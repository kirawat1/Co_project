// รอบเริ่มต้นของทุกหน้าที่มีตัวเลือกรอบ = รอบที่เปิดอยู่ (เปิดรับสมัคร)
// isActive มากับ /api/admin/coop-periods(/all) ตามหลักสูตรที่ผู้ใช้ดูแลอยู่แล้ว (เจ้าหน้าที่ = เปิดในหลักสูตรใดก็ได้)
// เปิดหลายรอบ → รอบใหม่สุด · ไม่มีรอบเปิด → รอบใหม่สุด · ไม่มีรอบเลย → ทุกปีการศึกษา
export interface PeriodLike {
  id: number | string;
  semester: number | string;
  academicYear: string | number;
  isActive?: boolean;
}

export const newestFirst = <T extends PeriodLike>(periods: T[]): T[] => [...periods].sort((a, b) =>
  Number(b.academicYear) - Number(a.academicYear) || Number(b.semester) - Number(a.semester));

export function defaultPeriod<T extends PeriodLike>(periods: T[]): T | null {
  const sorted = newestFirst(periods);
  return sorted.find(p => p.isActive) ?? sorted[0] ?? null;
}

export function defaultPeriodId(periods: PeriodLike[]): string {
  const p = defaultPeriod(periods);
  return p ? String(p.id) : "all";
}

/** จำนวนในรายการของแต่ละรอบ (จาก server ?countsOnly=1) — coopPeriodId null = ยังไม่ผูกรอบ (เห็นใน "ทุกปีการศึกษา"/"ยังไม่เลือกรอบ") */
export interface PeriodCount {
  coopPeriodId: number | null;
  count: number;
  pending: number;
}

/** งานรอดำเนินการที่อยู่นอกรอบที่เลือก — แสดงเตือนไม่ให้งานค้างถูกซ่อนเงียบๆ */
export function pendingOutside(counts: PeriodCount[], selected: string): number {
  if (!selected || selected === "all") return 0;
  const inSelected = (c: PeriodCount) => selected === "none" ? c.coopPeriodId == null : String(c.coopPeriodId) === selected;
  return counts.filter(c => !inSelected(c)).reduce((n, c) => n + c.pending, 0);
}

/** ต่อท้ายชื่อรอบใน dropdown เช่น " · 12 คน · รอตรวจ 3" — periodId "none" = กลุ่มที่ยังไม่ผูกรอบ */
export function periodCountLabel(counts: PeriodCount[], periodId: number | string, pendingWord = "รอตรวจ"): string {
  const c = counts.find(x => periodId === "none" ? x.coopPeriodId == null : String(x.coopPeriodId) === String(periodId));
  if (!c) return "";
  return ` · ${c.count} คน${c.pending ? ` · ${pendingWord} ${c.pending}` : ""}`;
}
