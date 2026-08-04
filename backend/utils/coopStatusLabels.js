// พอร์ตจาก Frontend/src/components/StatusBadge.tsx:STATUS_CONFIG — เอาแค่ field label
// (ไม่เอา color/icon/isInternship เพราะไฟล์ Excel ไม่ต้องใช้)
const COOP_STATUS_LABEL_TH = {
  NOT_SUBMITTED: 'ยังไม่ยื่นสหกิจ',
  APPLYING: 'รอตรวจสอบคุณสมบัติ',
  QUALIFIED: 'ผ่านคุณสมบัติ',
  QUALIFICATION_FAILED: 'ไม่ผ่านคุณสมบัติ',
  APPLICATION_EDITS_REQUIRED: 'แก้ไขใบสมัคร',
  WAITING_FOR_STAFF_CHECK: 'รอตรวจเอกสาร',
  EDITS_REQUIRED: 'แก้ไขเอกสาร T000',
  DOCS_APPROVED: 'เอกสารผ่าน (รอหนังสือ)',
  REQ_LETTER_ISSUED: 'ออกหนังสือขอความอนุเคราะห์แล้ว',
  PLACEMENT_LETTER_ISSUED: 'ออกหนังสือส่งตัวแล้ว',
  WAITING_FOR_PLACEMENT_LETTER: 'รอใบตอบรับ',
  WAITING_FOR_STAFF_CHECK_LETTER: 'รอตรวจใบตอบรับ',
  ACCEPTANCE_CHECKED: 'ตรวจใบตอบรับแล้ว',
  INTERNSHIP_STARTED: 'ออกฝึกสหกิจ',
  T002_SUBMITTED: 'ส่งเอกสาร T002 แล้ว',
  T002_EDITS_REQUIRED: 'ต้องแก้ไข T002',
  T003_SUBMITTED: 'ส่งโครงร่าง T003 แล้ว',
  T003_EDITS_REQUIRED: 'ต้องแก้ไขโครงร่าง T003',
  T003_APPROVED: 'อนุมัติโครงร่าง T003 แล้ว',
};

function getStatusLabelTh(status) {
  if (!status) return COOP_STATUS_LABEL_TH.NOT_SUBMITTED;
  return COOP_STATUS_LABEL_TH[status] || COOP_STATUS_LABEL_TH.NOT_SUBMITTED;
}

module.exports = { COOP_STATUS_LABEL_TH, getStatusLabelTh };
