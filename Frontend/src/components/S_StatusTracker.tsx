import { useNavigate } from "react-router-dom";

type SubStep = { key: string; label: string; statuses: string[]; doneStatuses: string[] };
type Phase = { id: number; label: string; icon: string; subSteps: SubStep[]; entryStatuses: string[] };

const PHASES: Phase[] = [
  {
    id: 1, label: "ยื่นคำร้อง", icon: "📋",
    entryStatuses: ["NOT_SUBMITTED","APPLYING","QUALIFICATION_FAILED","APPLICATION_EDITS_REQUIRED","QUALIFIED"],
    subSteps: [{ key:"submit", label:"ยื่นคำร้องขอสหกิจ", statuses:["APPLYING","QUALIFICATION_FAILED","APPLICATION_EDITS_REQUIRED","QUALIFIED"], doneStatuses:["QUALIFIED"] }],
  },
  {
    id: 2, label: "เอกสาร T000", icon: "📄",
    entryStatuses: ["WAITING_FOR_STAFF_CHECK","EDITS_REQUIRED","DOCS_APPROVED","REQ_LETTER_ISSUED","WAITING_FOR_PLACEMENT_LETTER","WAITING_FOR_STAFF_CHECK_LETTER","ACCEPTANCE_CHECKED","PLACEMENT_LETTER_ISSUED"],
    subSteps: [
      { key:"t000", label:"2.1 อัปโหลดเอกสาร T000", statuses:["WAITING_FOR_STAFF_CHECK","EDITS_REQUIRED","DOCS_APPROVED","REQ_LETTER_ISSUED","WAITING_FOR_PLACEMENT_LETTER","WAITING_FOR_STAFF_CHECK_LETTER","ACCEPTANCE_CHECKED","PLACEMENT_LETTER_ISSUED"], doneStatuses:["DOCS_APPROVED","REQ_LETTER_ISSUED","WAITING_FOR_PLACEMENT_LETTER","WAITING_FOR_STAFF_CHECK_LETTER","ACCEPTANCE_CHECKED","PLACEMENT_LETTER_ISSUED"] },
      { key:"req_letter", label:"2.2 หนังสือขอความอนุเคราะห์", statuses:["REQ_LETTER_ISSUED","WAITING_FOR_PLACEMENT_LETTER","WAITING_FOR_STAFF_CHECK_LETTER","ACCEPTANCE_CHECKED","PLACEMENT_LETTER_ISSUED"], doneStatuses:["REQ_LETTER_ISSUED","WAITING_FOR_PLACEMENT_LETTER","WAITING_FOR_STAFF_CHECK_LETTER","ACCEPTANCE_CHECKED","PLACEMENT_LETTER_ISSUED"] },
      { key:"acceptance", label:"2.3 ใบตอบรับ (Acceptance)", statuses:["WAITING_FOR_PLACEMENT_LETTER","WAITING_FOR_STAFF_CHECK_LETTER","ACCEPTANCE_CHECKED","PLACEMENT_LETTER_ISSUED"], doneStatuses:["ACCEPTANCE_CHECKED","PLACEMENT_LETTER_ISSUED"] },
    ],
  },
  {
    id: 3, label: "ออกฝึกสหกิจ", icon: "🚀",
    entryStatuses: ["INTERNSHIP_STARTED","T002_SUBMITTED","T002_EDITS_REQUIRED","T003_SUBMITTED","T003_EDITS_REQUIRED","PENDING_TEACHER","TEACHER_REJECTED","DATE_CONFIRMED","LETTER_UPLOADED","COMPLETED"],
    subSteps: [
      { key:"t002", label:"3.1 T002 แบบแจ้งรายละเอียดงาน", statuses:["T002_SUBMITTED","T002_EDITS_REQUIRED","T003_SUBMITTED","T003_EDITS_REQUIRED","PENDING_TEACHER","TEACHER_REJECTED","DATE_CONFIRMED","LETTER_UPLOADED","COMPLETED"], doneStatuses:["T003_SUBMITTED","T003_EDITS_REQUIRED","PENDING_TEACHER","TEACHER_REJECTED","DATE_CONFIRMED","LETTER_UPLOADED","COMPLETED"] },
      { key:"t003", label:"3.2 T003 โครงร่างรายงาน", statuses:["T003_SUBMITTED","T003_EDITS_REQUIRED","PENDING_TEACHER","TEACHER_REJECTED","DATE_CONFIRMED","LETTER_UPLOADED","COMPLETED"], doneStatuses:["PENDING_TEACHER","TEACHER_REJECTED","DATE_CONFIRMED","LETTER_UPLOADED","COMPLETED"] },
      { key:"supervision", label:"3.3 นัดหมายนิเทศสหกิจ", statuses:["PENDING_TEACHER","TEACHER_REJECTED","DATE_CONFIRMED","LETTER_UPLOADED","COMPLETED"], doneStatuses:["COMPLETED"] },
      { key:"t005t006", label:"3.4 แบบประเมิน T005 / T006", statuses:["LETTER_UPLOADED","COMPLETED"], doneStatuses:["COMPLETED"] },
      { key:"t007", label:"3.5 แบบประเมินสถานประกอบการ T007", statuses:["COMPLETED"], doneStatuses:["COMPLETED"] },
    ],
  },
  {
    id: 4, label: "รายงาน T008", icon: "📚",
    entryStatuses: [],
    subSteps: [{ key:"t008", label:"4. อัปโหลดเล่มรายงานสหกิจ T008", statuses:[], doneStatuses:[] }],
  },
];

const ACTION_CONFIG: Record<string, { text: string; link?: string; linkText?: string; isWarning?: boolean }> = {
  NOT_SUBMITTED:               { text: "กรอกข้อมูลและยื่นคำร้องขอเข้าร่วมโครงการ", link: "/student/gateway", linkText: "ยื่นคำร้อง" },
  APPLYING:                    { text: "รอเจ้าหน้าที่ตรวจสอบคุณสมบัติ (1-3 วันทำการ)" },
  APPLICATION_EDITS_REQUIRED:  { text: "ต้องแก้ไขใบสมัคร — ดูความคิดเห็นและส่งใหม่", link: "/student/gateway", linkText: "ไปแก้ไข", isWarning: true },
  QUALIFICATION_FAILED:        { text: "คุณสมบัติไม่ผ่านเกณฑ์ กรุณาติดต่อเจ้าหน้าที่", isWarning: true },
  QUALIFIED:                   { text: "ผ่านคุณสมบัติแล้ว รอเจ้าหน้าที่ตรวจเอกสาร T000" },
  WAITING_FOR_STAFF_CHECK:     { text: "รอเจ้าหน้าที่ตรวจเอกสาร T000 (1-3 วันทำการ)" },
  EDITS_REQUIRED:              { text: "ต้องแก้ไขเอกสาร T000 — ดูความคิดเห็นจากเจ้าหน้าที่", link: "/student/docs", linkText: "ไปแก้ไข", isWarning: true },
  DOCS_APPROVED:               { text: "เอกสาร T000 ผ่านแล้ว รอเจ้าหน้าที่ออกหนังสือขอความอนุเคราะห์" },
  REQ_LETTER_ISSUED:           { text: "ออกหนังสือขอความอนุเคราะห์แล้ว รอบริษัทตอบรับ" },
  WAITING_FOR_PLACEMENT_LETTER:{ text: "รอใบตอบรับจากบริษัท" },
  WAITING_FOR_STAFF_CHECK_LETTER:{ text: "รอเจ้าหน้าที่ตรวจใบตอบรับ" },
  ACCEPTANCE_CHECKED:          { text: "ตรวจใบตอบรับแล้ว รอออกหนังสือส่งตัว" },
  PLACEMENT_LETTER_ISSUED:     { text: "ได้รับหนังสือส่งตัวแล้ว 🎉 เตรียมตัวออกปฏิบัติงาน" },
  INTERNSHIP_STARTED:          { text: "กำลังฝึกสหกิจ — ส่งเอกสาร T002 แบบแจ้งรายละเอียดงาน", link: "/student/docs-t002", linkText: "ไปหน้า T002" },
  T002_SUBMITTED:              { text: "รออาจารย์ตรวจสอบ T002" },
  T002_EDITS_REQUIRED:         { text: "ต้องแก้ไข T002 — แบบแจ้งรายละเอียดงานและที่พัก", link: "/student/docs-t002", linkText: "ไปแก้ไข", isWarning: true },
  T003_SUBMITTED:              { text: "รออาจารย์ตรวจสอบ T003 โครงร่างรายงาน" },
  T003_EDITS_REQUIRED:         { text: "ต้องแก้ไข T003 — โครงร่างรายงานสหกิจ", link: "/student/docs-t003", linkText: "ไปแก้ไข", isWarning: true },
  PENDING_TEACHER:             { text: "รออาจารย์เลือกวันนัดหมายนิเทศ", link: "/student/supervision", linkText: "ดูการนิเทศ" },
  TEACHER_REJECTED:            { text: "ต้องแก้ไขวันนัดหมายนิเทศ", link: "/student/supervision", linkText: "ไปแก้ไข", isWarning: true },
  DATE_CONFIRMED:              { text: "วันนิเทศได้รับการยืนยัน รอเจ้าหน้าที่ออกหนังสือนิเทศ" },
  LETTER_UPLOADED:             { text: "หนังสือนิเทศอนุมัติแล้ว เตรียมพร้อมรับการนิเทศ" },
  COMPLETED:                   { text: "การนิเทศเสร็จสิ้น ✅ ดำเนินการส่งเล่มรายงาน T008", link: "/student/doc-t008", linkText: "ไปหน้า T008" },
};

function getCurrentPhaseIndex(status: string): number {
  for (let i = 0; i < PHASES.length; i++) {
    if (PHASES[i].entryStatuses.includes(status)) return i;
  }
  return 0;
}

interface Props { status: string; lastComment?: string }

export default function S_StatusTracker({ status, lastComment }: Props) {
  const navigate = useNavigate();
  const currentPhaseIdx = getCurrentPhaseIndex(status);
  const currentPhase = PHASES[currentPhaseIdx];
  const action = ACTION_CONFIG[status] ?? { text: "ดำเนินการตามขั้นตอนที่กำหนด" };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display:"flex", alignItems:"center", marginBottom:16, background:"#fff", borderRadius:16, padding:"16px 20px", boxShadow:"0 1px 4px rgba(0,0,0,.06)", border:"1px solid #e2e8f0" }}>
        {PHASES.map((phase, idx) => {
          const isDone = idx < currentPhaseIdx;
          const isActive = idx === currentPhaseIdx;
          return (
            <div key={phase.id} style={{ display:"flex", alignItems:"center", flex: idx < PHASES.length-1 ? 1 : 0 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, minWidth:72 }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:isDone?"#16a34a":isActive?"#2563eb":"#e2e8f0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, boxShadow:isActive?"0 0 0 4px #bfdbfe":"none" }}>
                  {isDone ? "✅" : phase.icon}
                </div>
                <span style={{ fontSize:11, fontWeight:700, color:isDone?"#16a34a":isActive?"#2563eb":"#94a3b8", textAlign:"center", lineHeight:1.3 }}>{phase.label}</span>
              </div>
              {idx < PHASES.length-1 && <div style={{ flex:1, height:3, borderRadius:2, background:idx < currentPhaseIdx?"#16a34a":"#e2e8f0", margin:"0 4px", marginBottom:20 }} />}
            </div>
          );
        })}
      </div>

      <div style={{ background:"#fff", borderRadius:16, padding:"16px 20px", boxShadow:"0 1px 4px rgba(0,0,0,.06)", border:"1px solid #e2e8f0", marginBottom:12 }}>
        <div style={{ fontWeight:800, fontSize:15, color:"#1e293b", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
          {currentPhase.icon} ขั้นตอนที่ {currentPhase.id}: {currentPhase.label}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {currentPhase.subSteps.map((step) => {
            const isDone = step.doneStatuses.includes(status);
            const isActive = !isDone && step.statuses.includes(status);
            return (
              <div key={step.key} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:10, background:isDone?"#f0fdf4":isActive?"#eff6ff":"#f8fafc", border:`1px solid ${isDone?"#bbf7d0":isActive?"#bfdbfe":"#e2e8f0"}` }}>
                <span style={{ fontSize:16, flexShrink:0 }}>{isDone?"✅":isActive?"▶":"○"}</span>
                <span style={{ fontSize:13, fontWeight:isActive?700:500, color:isDone?"#16a34a":isActive?"#1e40af":"#94a3b8", flex:1 }}>{step.label}</span>
                {isDone && <span style={{ fontSize:11, color:"#16a34a", fontWeight:600, whiteSpace:"nowrap" }}>เสร็จแล้ว</span>}
                {isActive && <span style={{ fontSize:11, color:"#2563eb", fontWeight:600, whiteSpace:"nowrap" }}>ดำเนินการอยู่</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background:action.isWarning?"#fff7ed":"#eff6ff", border:`1px solid ${action.isWarning?"#fed7aa":"#bfdbfe"}`, borderRadius:16, padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, fontWeight:700, color:action.isWarning?"#9a3412":"#1e40af", marginBottom:4, textTransform:"uppercase", letterSpacing:".5px" }}>
            {action.isWarning ? "⚠️ ต้องดำเนินการ" : "▶ ขั้นตอนถัดไป"}
          </div>
          <div style={{ fontSize:14, color:action.isWarning?"#7c2d12":"#1e3a8a", fontWeight:600 }}>{action.text}</div>
          {lastComment && action.isWarning && <div style={{ fontSize:12, color:"#92400e", marginTop:4, fontStyle:"italic" }}>💬 "{lastComment}"</div>}
        </div>
        {action.link && (
          <button onClick={() => navigate(action.link!)} style={{ padding:"8px 18px", background:action.isWarning?"#ea580c":"#2563eb", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:13, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
            {action.linkText} →
          </button>
        )}
      </div>
    </div>
  );
}
