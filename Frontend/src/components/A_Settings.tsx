// src/components/A_Settings.tsx

import { useState, useEffect } from "react";

const LS_YEAR = "coop.admin.academicYear";

const YEAR_OPTIONS = [
  "2568/1",
  "2568/2",
  "2567/1",
  "2567/2",
  "2566/1",
  "2566/2",
];

function loadYear(): string {
  return localStorage.getItem(LS_YEAR) || "2568/1";
}

export default function A_Settings() {
  const [year, setYear] = useState<string>(() => loadYear());

  useEffect(() => {
    localStorage.setItem(LS_YEAR, year);
  }, [year]);

  function clearAdmin() {
    if (!confirm("ต้องการลบข้อมูลแอดมินทั้งหมดหรือไม่?")) return;

    const keys = [
      "coop.student.profile.v1",              // นักศึกษา
      "coop.admin.teachers.v1",              // อาจารย์
      "coop.admin.teacherStudentsByYear.v1", // mapping ปี
      "coop.admin.companies",                // บริษัท
      "coop.shared.announcements",           // ประกาศ
      // ไม่ลบ mentor
    ];

    keys.forEach((k) => localStorage.removeItem(k));

    alert("ลบข้อมูลฝั่งแอดมินเรียบร้อย");
  }

  function clearStudentDaily() {
    if (!confirm("ลบประวัติบันทึกประจำวันทั้งหมด?")) return;

    localStorage.removeItem("coop.student.daily.v1");

    const mentorLogs = Object.keys(localStorage).filter((k) =>
      k.startsWith("coop.mentor.logs.")
    );
    mentorLogs.forEach((k) => localStorage.removeItem(k));

    alert("ลบประวัติบันทึกประจำวันเรียบร้อย");
  }

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ margin: 0, marginBottom: 12 }}>ตั้งค่าระบบ</h2>

        {/* ----------- Global Year Selector ----------- */}
        <div style={{ marginBottom: 20 }}>
          <label
            className="label"
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#111827",
              marginBottom: 6,
              marginRight: 15,
              display: "inline-block",
            }}
          >
            ปีการศึกษา
          </label>
          <div className="year-select-wrap">
            <select
              className="input year-select"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
            ทุกหน้าของแอดมินจะใช้งานปีการศึกษานี้
          </p>
        </div>

        {/* ----------- Clear Buttons ----------- */}
        <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
          <button className="btn" type="button" onClick={clearAdmin}>
            ลบข้อมูลของแอดมินทั้งหมด
          </button>

          <button className="btn" type="button" onClick={clearStudentDaily}>
            ลบประวัติบันทึกประจำวัน (นักศึกษา)
          </button>
        </div>
      </section>

      {/* สไตล์เฉพาะ select ปีการศึกษา ให้ฟีล iOS/card minimal */}
      <style>{`
        .page .year-select-wrap{
          display:inline-flex;
          align-items:center;
          padding:2px;
          border-radius:999px;
          background:rgba(148,163,184,.12);
        }

        .page .year-select{
          width: 130px;
          border-radius: 999px;
          height: 32px;
          padding: 4px 14px;
          border: 1px solid rgba(148,163,184,.6);
          background: #f9fafb;
          font-size: 15px;
          font-weight: 600;
          color:#111827;
          box-shadow:
            0 1px 0 rgba(255,255,255,.9),
            0 1px 2px rgba(15,23,42,.12);
          appearance: none;              /* ซ่อนลูกศร default บางเบราว์เซอร์ */
          -moz-appearance: none;
          -webkit-appearance: none;
          background-image:
            linear-gradient(45deg, #6b7280 50%, transparent 50%),
            linear-gradient(-45deg, #6b7280 50%, transparent 50%);
          background-position:
            calc(100% - 13px) 50%,
            calc(100% - 8px) 50%;
          background-size: 6px 6px, 6px 6px;
          background-repeat: no-repeat;
        }

        .page .year-select:focus{
          outline:none;
          border-color:#1d4ed8;
          background:#ffffff;
          box-shadow:
            0 0 0 1px rgba(59,130,246,.35),
            0 10px 24px rgba(15,23,42,.18);
        }

        .page .year-select option{
          font-size: 15px;
        }

        @media (max-width: 768px){
          .page{
            margin: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
