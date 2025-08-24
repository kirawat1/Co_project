import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DailyLog } from "./store";
import { loadDaily, saveDaily } from "./store";

/* --------- Types --------- */
type StudentProfile = {
  studentId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
};

/** โหลดนักศึกษาที่พี่เลี้ยงดูแล + เชื่อมกับ profile */
function loadMentorStudentsWithProfile(): StudentProfile[] {
  try {
    const rawMentor = JSON.parse(localStorage.getItem("coop.mentor.students") || "[]");
    const rawProfiles = JSON.parse(localStorage.getItem("coop.student.profile.v1") || "[]");

    const mentors: any[] = Array.isArray(rawMentor) ? rawMentor : [];
    const profiles: any[] = Array.isArray(rawProfiles) ? rawProfiles : [rawProfiles];

    const mentorIds = mentors.map((m) => m.studentId ?? m.id);

    return profiles
      .filter((p) => mentorIds.includes(p.studentId))
      .map((p) => ({
        studentId: p.studentId,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
      }));
  } catch {
    return [];
  }
}

function getMentorName(): string {
  try {
    const p = JSON.parse(localStorage.getItem("coop.mentor.profile") || "{}");
    const full = `${p.firstName || ""} ${p.lastName || ""}`.trim();
    if (full) return full;
  } catch { }
  return (localStorage.getItem("coop.mentor.displayName") || "พี่เลี้ยง").trim();
}

export default function MentorDaily() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [studentId, setStudentId] = useState<string>("");
  const [popupLog, setPopupLog] = useState<DailyLog | null>(null);
  const signerName = useMemo(() => getMentorName(), []);

  useEffect(() => {
    const s = loadMentorStudentsWithProfile();
    setStudents(s);
    if (s[0]) setStudentId(s[0].studentId);

    const allLogs = loadDaily();
    setLogs(allLogs);
  }, []);

  const currentStudent = useMemo(
    () => students.find((x) => x.studentId === studentId) || null,
    [students, studentId]
  );

  const currentLogs = useMemo(
    () => logs.filter((l) => l.studentId === studentId),
    [logs, studentId]
  );

  function handleSaveSignature(dataUrl: string) {
    if (!popupLog) return;
    const next = logs.map((l) =>
      l.id === popupLog.id ? { ...l, mentorSignature: dataUrl, mentorName: signerName } : l
    );
    setLogs(next);
    saveDaily(next);
    setPopupLog(null);
  }

  return (
    <div className="page" style={{ padding: 16, margin: 28, marginLeft: 65 }}>
      <h2 style={{ marginBottom: 16 }}>บันทึกประจำวันนักศึกษา</h2>

      {/* เลือกนักศึกษา */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 12 }}>เลือกนักศึกษา:</label>
        <select
          className="input"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          {students.map((s) => (
            <option key={s.studentId} value={s.studentId}>
              {s.firstName} {s.lastName}
            </option>
          ))}
        </select>
      </div>

      {/* ข้อมูลนักศึกษา */}
      {currentStudent ? (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <p><b>ชื่อ-นามสกุล:</b> {currentStudent.firstName} {currentStudent.lastName}</p>
          <p><b>อีเมล:</b> {currentStudent.email || "-"}</p>
          <p><b>โทรศัพท์:</b> {currentStudent.phone || "-"}</p>
        </div>
      ) : (
        <p>— เลือกนักศึกษาก่อน —</p>
      )}

      {/* ตารางบันทึก */}
      <table className="tbl">
        <thead>
          <tr>
            <th>วันที่ทำงาน</th>
            <th>เข้า</th>
            <th>ออก</th>
            <th>สรุปงาน</th>
            <th>ลายเซ็น นศ.</th>
            <th>ชื่อพี่เลี้ยง</th>
            <th>ลายเซ็น พี่เลี้ยง</th>
            <th>วันที่บันทึก</th>
          </tr>
        </thead>
        <tbody>
          {currentLogs.map((l) => (
            <tr key={l.id}>
              <td>{fmtDate(l.date)}</td>
              <td>{l.checkIn}</td>
              <td>{l.checkOut}</td>
              <td style={{ whiteSpace: "pre-line" }}>{l.note || "-"}</td>
              <td>
                {l.signature ? (
                  <img src={l.signature} alt="sig" style={{ height: 32 }} />
                ) : (
                  "-"
                )}
              </td>
              <td>
                {l.mentorSignature ? (
                  <img src={l.mentorSignature} alt="mentor sig" style={{ height: 32 }} />
                ) : (
                  <button className="btn" onClick={() => setPopupLog(l)}>
                    เซ็นรับรอง
                  </button>
                )}
              </td>
              <td>{l.mentorName || "-"}</td>  {/* ✅ แสดงชื่อพี่เลี้ยง */}
              <td>{new Date(l.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {currentLogs.length === 0 && (
            <tr>
              <td colSpan={7} style={{ color: "#6b7280" }}>
                — ยังไม่มีรายการ —
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* popup เซ็น */}
      {popupLog && (
        <SignaturePopup
          log={popupLog}
          signerName={signerName}
          onCancel={() => setPopupLog(null)}
          onSave={handleSaveSignature}
        />
      )}

      <style>{`
        .tbl{ width:100%; border-collapse:separate; border-spacing:0 8px }
        th{ text-align:left; font-size:13px; color:#6b7280; font-weight:700; padding:4px }
        td{ background:#fff; border:1px solid #e5e7eb; padding:8px; vertical-align:top }
        td:first-child{ border-radius:12px 0 0 12px }
        td:last-child{ border-radius:0 12px 12px 0 }
        .btn{ background:#0074B7; color:#fff; border-radius:8px; padding:6px 12px; font-weight:600; }
      `}</style>
    </div>
  );
}

function SignaturePopup({
  log,
  signerName,
  onCancel,
  onSave,
}: {
  log: DailyLog;
  signerName: string;
  onCancel: () => void;
  onSave: (sig: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#000";
        setCtx(ctx);
      }
    }
  }, []);

  function start(e: React.PointerEvent) {
    ctx?.beginPath();
    ctx?.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setDrawing(true);
  }
  function move(e: React.PointerEvent) {
    if (!drawing) return;
    ctx?.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx?.stroke();
  }
  function end() {
    setDrawing(false);
  }
  function clear() {
    if (canvasRef.current && ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }
  function save() {
    if (canvasRef.current) {
      onSave(canvasRef.current.toDataURL("image/png"));
    }
  }

  return (
    <div className="popup">
      <div className="popup-content">
        <h3>เซ็นรับรอง</h3>
        <p>ผู้เซ็น: {signerName}</p>
        <canvas
          ref={canvasRef}
          width={400}
          height={160}
          style={{ border: "1px dashed #ccc", borderRadius: 8 }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button className="btn" onClick={save}>บันทึก</button>
          <button className="btn" style={{ background: "#999" }} onClick={onCancel}>ยกเลิก</button>
          <button className="btn" style={{ background: "#fff", color: "#000" }} onClick={clear}>ล้าง</button>
        </div>
      </div>
      <style>{`
        .popup{ position:fixed; inset:0; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; }
        .popup-content{ background:#fff; padding:24px; border-radius:12px; min-width:480px; }
      `}</style>
    </div>
  );
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}/${m}/${y + 543}`;
}
