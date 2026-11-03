import Modal, { ModalCloseButton } from "./Modal";
import S_StatusTracker from "./S_StatusTracker";
import { formState, latestForm } from "../utils/internshipForms";

// หน้าต่างสถานะของนักศึกษา — เจ้าหน้าที่/อาจารย์กดป้ายสถานะในรายชื่อนักศึกษา แล้วเห็นแถบสถานะเดียวกับที่นักศึกษาเห็นในหน้าของตัวเอง
// ดูอย่างเดียว (viewer): ไม่มีปุ่มพาไปหน้าของนักศึกษา · ข้อมูลมาจากแถวในรายชื่อ (/api/students ส่งสถานะสหกิจ + เอกสารมาแล้ว ไม่ต้องโหลดเพิ่ม)
type Doc = { id?: number; type?: string; status?: string; rejectReason?: string | null };
export type StatusModalStudent = {
  studentId: string;
  firstName?: string | null;
  lastName?: string | null;
  docStatus?: string | null;
  coop?: { status?: string | null; teacherCheckComment?: string | null; t000Comment?: string | null } | null;
  documents?: Doc[] | null;
};

export default function StudentStatusModal({ student, onClose }: { student: StatusModalStudent; onClose: () => void }) {
  const status = student.coop?.status || student.docStatus || "NOT_SUBMITTED";
  const t002Doc = latestForm(student.documents, "T002");
  const t003Doc = latestForm(student.documents, "T003");
  const forms = { t002: formState(t002Doc), t003: formState(t003Doc) };
  // ความเห็นที่เกี่ยวกับขั้นที่ต้องแก้ — ฟอร์มที่ถูกตีกลับใช้เหตุผลของไฟล์นั้น (ความเห็นของ T000/คำร้องเป็นเรื่องอื่น)
  const lastComment = (forms.t002 === "REJECTED" && t002Doc?.rejectReason)
    || (forms.t003 === "REJECTED" && t003Doc?.rejectReason)
    || student.coop?.teacherCheckComment || student.coop?.t000Comment || "";
  const name = `${student.firstName || ""} ${student.lastName || ""}`.trim();

  return (
    <Modal
      maxWidth={820}
      ariaLabel="สถานะของนักศึกษา"
      onClose={onClose}
      header={
        <div className="modal-card-header" style={{ alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0 }}>สถานะของนักศึกษา</h2>
            <div style={{ color: "#64748b" }}>{student.studentId}{name ? ` · ${name}` : ""}</div>
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>
      }
    >
      <S_StatusTracker status={status} forms={forms} lastComment={lastComment} viewer />
    </Modal>
  );
}
