// src/components/StudentDocumentsPage.tsx
import DocTable from "./S_DocTable";
import type { StudentProfile, DocumentItem } from "./store";

export default function StudentDocumentsPage({
  profile,
  setProfile,
}: {
  profile: StudentProfile;
  setProfile: (p: StudentProfile) => void;
}) {
  function updateDocs(next: DocumentItem[]) {
    setProfile({ ...profile, docs: next });
  }

  return (
    <div className="page" style={{ padding: 4, margin: 28 }}>
      <section className="card" style={{ padding: 24 }}>
        <h2 style={{ marginTop: 0, marginBottom: 20 }}>เอกสารสหกิจศึกษา (ทั้งหมด)</h2>

        {/* ตารางรวมเอกสาร */}
        <DocTable items={profile.docs} onChange={updateDocs} allowStatusChange={false} />

        <p style={{ marginTop: 16, color: "#6b7280", fontSize: 13 }}>
          * เอกสารบางรายการต้องกรอกก่อนดาวน์โหลด เช่น T007, T004, บันทึกประจำสัปดาห์, ใบสมัครสหกิจ และ ใบคำร้องเข้าร่วมโครงการ
        </p>
      </section>

      {/* Responsive */}
      <style>{`
        @media (max-width: 1024px){
          .page section.card{
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
