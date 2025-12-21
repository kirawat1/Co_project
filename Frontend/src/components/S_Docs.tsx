// src/components/S_Docs.tsx
import DocTable from "./S_DocTable";
import type { StudentProfile, DocumentItem } from "./store";

/**
 * หน้านี้ = ฝั่งนักศึกษา
 * - ดูเอกสารทั้งหมด
 * - แนบไฟล์ / ส่งใหม่
 * - ไม่สามารถเปลี่ยนสถานะเองได้
 */
export default function S_Docs({
  profile,
  setProfile,
}: {
  profile: StudentProfile;
  setProfile: (p: StudentProfile) => void;
}) {
  /** update docs กลับเข้า profile */
  function updateDocs(next: DocumentItem[]) {
    setProfile({
      ...profile,
      docs: next,
    });
  }

  return (
    <div className="page" style={{ padding: 4, margin: 28 }}>
      <section className="card" style={{ padding: 24 }}>
        <h2 style={{ marginTop: 0, marginBottom: 20 }}>
          เอกสารสหกิจศึกษา
        </h2>

        {/* ================= DOC TABLE ================= */}
        <DocTable
          items={profile.docs}
          onChange={updateDocs}
          allowStatusChange={false} // นักศึกษา "ดู + ส่งไฟล์" เท่านั้น
        />

        {/* ================= NOTE ================= */}
        <p
          style={{
            marginTop: 16,
            color: "#6b7280",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          * เอกสารที่สถานะ <b>ไม่ผ่าน</b> สามารถแนบไฟล์ใหม่เพื่อส่งแก้ไขได้
          <br />
          * เมื่ออาจารย์อนุมัติแล้ว เอกสารจะถูกล็อกไม่สามารถแก้ไขได้
        </p>
      </section>

      {/* ================= Responsive ================= */}
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
