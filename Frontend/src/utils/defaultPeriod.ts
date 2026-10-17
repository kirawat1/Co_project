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
