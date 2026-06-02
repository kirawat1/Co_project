export const STATUS_GROUPS: Record<string, { label: string; icon: string; color: string; bg: string; statuses: string[] }> = {
  ALL:           { label:"ทั้งหมด",          icon:"📋", color:"#334155", bg:"#f1f5f9", statuses:[] },
  PENDING_REVIEW:{ label:"รอตรวจสอบ",        icon:"⏳", color:"#92400e", bg:"#fef9c3", statuses:["APPLYING","WAITING_FOR_STAFF_CHECK","T002_SUBMITTED","T003_SUBMITTED","DATE_CONFIRMED","WAITING_FOR_STAFF_CHECK_LETTER"] },
  NEEDS_EDIT:    { label:"ต้องแก้ไข",         icon:"📝", color:"#9a3412", bg:"#fff7ed", statuses:["APPLICATION_EDITS_REQUIRED","EDITS_REQUIRED","T002_EDITS_REQUIRED","T003_EDITS_REQUIRED","TEACHER_REJECTED"] },
  IN_PROGRESS:   { label:"กำลังดำเนินการ",    icon:"🔄", color:"#1e40af", bg:"#eff6ff", statuses:["QUALIFIED","DOCS_APPROVED","REQ_LETTER_ISSUED","WAITING_FOR_PLACEMENT_LETTER","ACCEPTANCE_CHECKED","PLACEMENT_LETTER_ISSUED","PENDING_TEACHER","LETTER_UPLOADED"] },
  INTERNSHIP:    { label:"ฝึกสหกิจ",          icon:"🚀", color:"#4338ca", bg:"#e0e7ff", statuses:["INTERNSHIP_STARTED","T002_SUBMITTED","T002_EDITS_REQUIRED","T003_SUBMITTED","T003_EDITS_REQUIRED","PENDING_TEACHER","TEACHER_REJECTED","DATE_CONFIRMED","LETTER_UPLOADED"] },
  COMPLETED:     { label:"เสร็จสิ้น",          icon:"✅", color:"#166534", bg:"#dcfce7", statuses:["COMPLETED"] },
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
          <button key={key} onClick={() => onFilterChange(key)} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:99, fontSize:13, fontWeight:700, cursor:"pointer", transition:"all .15s", border:"none", background:isActive?group.color:group.bg, color:isActive?"#fff":group.color, boxShadow:isActive?`0 2px 8px ${group.color}40`:"none" }}>
            <span>{group.icon}</span>
            <span>{group.label}</span>
            <span style={{ background:isActive?"rgba(255,255,255,.25)":`${group.color}20`, borderRadius:99, padding:"1px 7px", fontSize:12 }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
