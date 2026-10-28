// ใช้เฉพาะ CoopStatus enum values จริงใน Prisma schema
export const STATUS_GROUPS: Record<string, { label: string; icon: string; color: string; bg: string; statuses: string[] }> = {
  ALL:           { label:"ทั้งหมด",          icon:"📋", color:"#334155", bg:"#f1f5f9", statuses:[] },
  // รอตรวจสอบ = ก่อนฝึก (ยื่นคำร้อง / รอตรวจเอกสาร T000 / รอใบตอบรับ)
  PENDING_REVIEW:{ label:"รอตรวจสอบ",        icon:"⏳", color:"#92400e", bg:"#fef9c3",
    statuses:["APPLYING","PENDING_GRADE","WAITING_FOR_STAFF_CHECK","WAITING_FOR_STAFF_CHECK_LETTER"] },
  // ต้องแก้ไข — เฉพาะก่อนฝึก (T002/T003_EDITS_REQUIRED อยู่ใน INTERNSHIP แล้ว ไม่ซ้ำ)
  NEEDS_EDIT:    { label:"ต้องแก้ไข",         icon:"📝", color:"#9a3412", bg:"#fff7ed",
    statuses:["APPLICATION_EDITS_REQUIRED","EDITS_REQUIRED"] },
  // กำลังดำเนินการ = ผ่านคุณสมบัติถึงก่อนออกฝึก
  IN_PROGRESS:   { label:"กำลังดำเนินการ",    icon:"🔄", color:"#1e40af", bg:"#eff6ff",
    statuses:["QUALIFIED","DOCS_APPROVED","REQ_LETTER_ISSUED","WAITING_FOR_PLACEMENT_LETTER","ACCEPTANCE_CHECKED","PLACEMENT_LETTER_ISSUED"] },
  // ฝึกสหกิจ = ออกฝึกแล้ว (รวมส่งเอกสาร T002/T003)
  INTERNSHIP:    { label:"ฝึกสหกิจ",          icon:"🚀", color:"#4338ca", bg:"#e0e7ff",
    statuses:["INTERNSHIP_STARTED","T002_SUBMITTED","T002_EDITS_REQUIRED","T003_SUBMITTED","T003_EDITS_REQUIRED","T003_APPROVED"] },
  // ไม่ผ่านคุณสมบัติ
  FAILED:        { label:"ไม่ผ่านเกณฑ์",      icon:"❌", color:"#dc2626", bg:"#fef2f2",
    statuses:["QUALIFICATION_FAILED"] },
};

interface Props {
  students: { coop?: { status?: string } | null }[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function StatusFilterChips({ students, activeFilter, onFilterChange }: Props) {
  const counts: Record<string, number> = { ALL: students.length };
  for (const groupKey of Object.keys(STATUS_GROUPS)) {
    if (groupKey === "ALL") continue;
    counts[groupKey] = students.filter(s => STATUS_GROUPS[groupKey].statuses.includes(s.coop?.status ?? "")).length;
  }

  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
      {Object.entries(STATUS_GROUPS).map(([key, group]) => {
        const count = counts[key] ?? 0;
        const isActive = activeFilter === key;
        if (key !== "ALL" && count === 0) return null;
        return (
          <button key={key} className={isActive ? "filter-chip on" : "filter-chip"} onClick={() => onFilterChange(key)}>
            <span>{group.icon}</span>
            <span>{group.label}</span>
            <span className="count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
