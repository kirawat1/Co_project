import React, { useState } from "react";
import type { StudentProfile, CoopRequestState } from "./store";

/* =========================
   Mapping ภาษาไทย
========================= */

const MAJOR_TH: Record<string, string> = {
  CS: "วิทยาการคอมพิวเตอร์",
  GIS: "ภูมิสารสนเทศศาสตร์",
  IT: "เทคโนโลยีสารสนเทศ",
};

const CURRICULUM_TH: Record<string, string> = {
  regular: "ภาคปกติ",
  special: "ภาคพิเศษ",
};

type Props = {
  profile: StudentProfile;
  setProfile: (p: StudentProfile) => void;
};

/* =========================
   Main Component
========================= */

export default function S_Gateway({ profile, setProfile }: Props) {
  const req: CoopRequestState = profile.coopRequest ?? { status: "draft" };
  /* ================= LOCK ================= */
  const isLocked =
    req.status === "submitted" ||
    req.status === "approved" ||
    req.status === "waiting-special";

  /* ===== special request ===== */
  const [showSpecialModal, setShowSpecialModal] = useState(false);
  const [specialReason, setSpecialReason] = useState("");

  function submitSpecialRequest() {
    if (isLocked) {
      alert("ไม่สามารถยื่นคำขอซ้ำได้");
      return;
    }

    const ok = window.confirm(
      "ยืนยันการยื่นคำขอพิจารณาเป็นกรณีพิเศษ?\n\nเมื่อส่งแล้วจะไม่สามารถแก้ไขได้"
    );
    if (!ok) return;

    const updated: StudentProfile = {
      ...profile,
      coopRequest: {
        ...req,
        status: "waiting-special",
      },
    };

    setProfile(updated);
    setShowSpecialModal(false);
    alert("ส่งคำขอพิจารณาเป็นกรณีพิเศษแล้ว");
  }

  return (
    <div style={{ padding: 32, background: "#f6f9ff", minHeight: "100vh" }}>
      <div style={card}>
        <h2>ใบยื่นคำร้องเข้าร่วมโครงการสหกิจศึกษา</h2>

        {/* ===== Student Info ===== */}
        <div style={{ marginTop: 20, lineHeight: 1.8 }}>
          <div>
            <b>ชื่อ–นามสกุล:</b> {profile.prefix}
            {profile.firstName} {profile.lastName}
          </div>
          <div>
            <b>รหัสนักศึกษา:</b> {profile.studentId}
          </div>
          <div>
            <b>สาขาวิชา:</b> {MAJOR_TH[profile.major ?? ""] ?? profile.major}
          </div>
          <div>
            <b>หลักสูตร:</b>{" "}
            {CURRICULUM_TH[profile.curriculum ?? ""] ?? profile.curriculum}
          </div>
        </div>

        {/* ===== REJECTED ===== */}
        {req.status === "rejected" && (
          <div style={rejectBox}>คำร้องไม่ผ่านการอนุมัติ</div>
        )}

        {/* ===== SPECIAL REQUEST ===== */}
        {req.status === "rejected" && (
          <div style={{ textAlign: "right", marginTop: 20 }}>
            <button
              className="btn-ios-primary"
              disabled={isLocked}
              onClick={() => setShowSpecialModal(true)}
            >
              ยื่นขอพิจารณาเป็นกรณีพิเศษ
            </button>
          </div>
        )}
      </div>

      {/* ===== SPECIAL MODAL ===== */}
      {showSpecialModal && (
        <div style={overlay}>
          <div style={modal}>
            <h3>ยื่นขอพิจารณาเป็นกรณีพิเศษ</h3>

            <textarea
              value={specialReason}
              onChange={(e) => setSpecialReason(e.target.value)}
              placeholder="อธิบายเหตุผลเพิ่มเติม"
              style={textarea}
            />

            <div style={{ textAlign: "right", marginTop: 16 }}>
              <button
                className="btn-ios-ghost"
                onClick={() => setShowSpecialModal(false)}
              >
                ยกเลิก
              </button>{" "}
              <button
                className="btn-ios-primary"
                onClick={submitSpecialRequest}
                disabled={isLocked}
              >
                ส่งคำขอ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Styles
========================= */

const card: React.CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
  background: "#fff",
  borderRadius: 18,
  padding: 28,
  boxShadow: "0 10px 30px rgba(0,0,0,.08)",
};

const rejectBox: React.CSSProperties = {
  marginTop: 20,
  padding: 14,
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 10,
  fontWeight: 600,
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
};

const modal: React.CSSProperties = {
  background: "#fff",
  padding: 24,
  borderRadius: 16,
  width: "100%",
  maxWidth: 420,
};

const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: 120,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #c7d2fe",
};
