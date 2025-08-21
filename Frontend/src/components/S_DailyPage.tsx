// src/components/DailyPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { StudentProfile, DailyLog } from "./store";
import { loadDaily, saveDaily } from "./store";

/* ===== เรียงประวัติ: เก่าสุด -> ใหม่สุด ===== */
const compareLogs = (a: DailyLog, b: DailyLog) => {
  if (a.date !== b.date) return a.date.localeCompare(b.date);           // YYYY-MM-DD
  const at = (a.checkIn || "00:00");
  const bt = (b.checkIn || "00:00");
  if (at !== bt) return at.localeCompare(bt);                           // HH:MM
  return (a.createdAt || "").localeCompare(b.createdAt || "");          // ISO datetime
};

/* ===== ลายเซ็นแบบ Canvas (รองรับเมาส์/ทัช) ===== */
function SignaturePad({
  onChange,
  height = 160,
}: {
  onChange: (dataUrl: string | null) => void;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  const resizeCanvas = () => {
    const cvs = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cvs || !wrap) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const cssW = wrap.clientWidth;
    const cssH = height;
    cvs.width = Math.floor(cssW * ratio);
    cvs.height = Math.floor(cssH * ratio);
    cvs.style.width = cssW + "px";
    cvs.style.height = cssH + "px";
    const ctx = cvs.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0f172a";
    }
  };

  useEffect(() => {
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cvs = canvasRef.current!;
    const rect = cvs.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const begin = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = toPoint(e);
    drawing.current = true;
    hasDrawn.current = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = toPoint(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasDrawn.current) {
      const data = canvasRef.current!.toDataURL("image/png");
      onChange(data);
    }
  };

  const clear = () => {
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext("2d")!;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    hasDrawn.current = false;
    onChange(null);
  };

  return (
    <div>
      <div ref={wrapRef} className="sig-wrap">
        <canvas
          ref={canvasRef}
          className="sig-canvas"
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            begin(e);
          }}
          onPointerMove={move}
          onPointerUp={(e) => {
            (e.target as Element).releasePointerCapture(e.pointerId);
            end();
          }}
          onPointerLeave={end}
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn" type="button" onClick={clear} style={{ height: 36, background: "#fff", color: "#0f172a", border: "1px solid #e5e7eb" }}>
          ล้างลายเซ็น
        </button>
        <div className="sig-hint">* เซ็นด้วยนิ้ว/เมาส์บนกรอบด้านบน</div>
      </div>

      <style>{`
        .sig-wrap{
          width:100%;
          height:${height}px;
          border:1px dashed #cbd5e1;
          border-radius:12px;
          background:#fff;
          overflow:hidden;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,.02);
        }
        .sig-canvas{ width:100%; height:100%; touch-action:none; display:block; }
        .sig-hint{ color:#6b7280; font-size:12px; display:flex; align-items:center }
      `}</style>
    </div>
  );
}

export default function DailyPage({ profile }: { profile: StudentProfile }) {
  /* โหลดแล้วเรียงทันที */
  const [logs, setLogs] = useState<DailyLog[]>(() => loadDaily().slice().sort(compareLogs));
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [note, setNote] = useState("");
  const [signature, setSignature] = useState<string | null>(null);

  useEffect(() => { saveDaily(logs); }, [logs]);

  const canSubmit = useMemo(
    () => Boolean(date && checkIn && checkOut && signature),
    [date, checkIn, checkOut, signature]
  );

  function addLog(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const name = `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "นักศึกษา";

    const newItem: DailyLog = {
      id: crypto.randomUUID(),
      date,
      studentName: name,
      checkIn,
      checkOut,
      note,
      createdAt: new Date().toISOString(),
      signature: signature || undefined,
    };

    const next = [...logs, newItem].sort(compareLogs); // เรียงก่อนเซ็ต
    setLogs(next);

    setCheckIn("");
    setCheckOut("");
    setNote("");
    setSignature(null);
  }

  return (
    <div className="page" style={{ padding: 4, margin: 36, marginLeft: 65 }}>
      <form className="card" onSubmit={addLog}>
        <h2 style={{ paddingLeft: 24, marginBottom: 28 }}>เพิ่มบันทึกการทำงาน</h2>

        {/* ช่องไฟมากขึ้น + จำกัดความกว้างช่องสั้น ๆ */}
        <div
          className="grid4"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: "16px 24px",
            paddingLeft: 24,
            paddingRight: 24,
            alignItems: "start",
          }}
        >
          <div className="field">
            <label className="label">วันที่ทำงาน</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div className="field">
            <label className="label">ชื่อผู้บันทึก</label>
            <input className="input" value={`${profile.firstName} ${profile.lastName}`.trim()} disabled />
          </div>

          <div className="field">
            <label className="label">เวลาเข้า</label>
            <input className="input" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
          </div>

          <div className="field">
            <label className="label">เวลาออก</label>
            <input className="input" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required />
          </div>

          {/* ลายเซ็น เต็มแถว */}
          <div className="field wide" style={{ gridColumn: "1 / -1" }}>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>ลายเซ็น</label>
            <SignaturePad onChange={setSignature} />
          </div>

          {/* หมายเหตุ เต็มแถว */}
          <div className="field wide" style={{ gridColumn: "1 / -1" }}>
            <label className="label">หมายเหตุ</label>
            <textarea
              className="input"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="สรุปงาน/อุปสรรค/สิ่งที่เรียนรู้"
            />
          </div>

          <div className="field">
            <button className="btn" type="submit" style={{ marginBottom: 18 }} disabled={!canSubmit}>
              บันทึก
            </button>
          </div>
        </div>

        <p style={{ color: "#6b7280", fontSize: 12, marginTop: 8, paddingLeft: 24, paddingRight: 24 }}>
          * ต้องมีลายเซ็นก่อนจึงจะบันทึกได้ · บันทึกแล้ว <b>แก้ไขไม่ได้</b>
        </p>

        <style>{`
          /* จำกัดความกว้างช่องกรอกสั้นๆ บนจอใหญ่ */
          .field{ max-width: 320px; }
          .field > .input{ width: 100%; }
          .field.wide{ max-width: 100%; }  /* ลายเซ็น/หมายเหตุ ใช้เต็มแถว */

          /* Responsive: iPad ลงไปเป็น 1 คอลัมน์ */
          @media (max-width: 1440px){
            .grid4{ grid-template-columns: 1fr 1fr 1fr 1fr !important; }
          }
          @media (max-width: 1024px){
            .grid4{ grid-template-columns: 1fr 1fr !important; }
            .field{ max-width: 100%; }
          }
          @media (max-width: 900px){
            .grid4{ grid-template-columns: 1fr !important; }
          }
        `}</style>
      </form>

      <section className="card" style={{ paddingLeft: 24, marginTop: 14, paddingRight: 24 }}>
        <h2>ประวัติการบันทึก</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>วันที่ทำงาน</th>
              <th>ชื่อ</th>
              <th>เข้า</th>
              <th>ออก</th>
              <th>หมายเหตุ</th>
              <th>ลายเซ็น</th>
              <th>วันที่เพิ่มข้อมูล</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{fmtDate(l.date)}</td>
                <td>{l.studentName}</td>
                <td>{l.checkIn}</td>
                <td>{l.checkOut}</td>
                <td className="note">{l.note || "-"}</td>
                <td>
                  {l.signature ? (
                    <img src={l.signature} alt="ลายเซ็น" style={{ display: "block", height: 36, width: "auto", maxWidth: 200, objectFit: "contain" }} />
                  ) : <span style={{ color: "#6b7280" }}>-</span>}
                </td>
                <td>{new Date(l.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={7} style={{ color: "#6b7280" }}>ยังไม่มีรายการ</td></tr>
            )}
          </tbody>
        </table>
        <style>{`
          .tbl{ width:100%; border-collapse:separate; border-spacing:0 8px }
          th{ text-align:left; font-size:13px; color:#6b7280; font-weight:700; padding:0 10px }
          td{ background:#fff; border:1px solid #e5e7eb; padding:10px; vertical-align:middle }
          td:first-child{ border-radius:12px 0 0 12px } td:last-child{ border-radius:0 12px 12px 0 }
          .note{ max-width:420px }
        `}</style>
      </section>
    </div>
  );
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number); // iso: YYYY-MM-DD
  const TH_MONTH = ["ม.ค","ก.พ","มี.ค","เม.ย","พ.ค","มิ.ย","ก.ค","ส.ค","ก.ย","ต.ค","พ.ย","ธ.ค"];
  const yearBE = y + 543; // แสดงปี พ.ศ.
  return `${d} ${TH_MONTH[m - 1]} ${yearBE}`;
};
