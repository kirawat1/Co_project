// src/components/M_Daily.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DailyLog } from "./store";

type MentorSignature = { name: string; role?: string; dataUrl: string };
type MentorDailyLog = Omit<DailyLog, "checkIn" | "checkOut"> & {
  studentName: string;
  signatures: MentorSignature[];
  checkIn?: string;   // ให้เป็น optional เพื่อให้โค้ดฝั่งแอดมินอ่านได้
  checkOut?: string;  // เช่น แสดงค่าว่างแทน
};
type StudentLite = {
  studentId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  gpa?: string;
  major?: string;
  curriculum?: string;
  company?: { name?: string } | null;
};

const LS_STUDENTS_KEY = "coop.mentor.students";
function loadStudents(){
  try{ return JSON.parse(localStorage.getItem(LS_STUDENTS_KEY)||"[]") as StudentLite[] }catch{return []}
}
function logsKey(stdId:string){ return `coop.mentor.logs.${stdId}` }
function loadLogs(stdId:string){ try{ return JSON.parse(localStorage.getItem(logsKey(stdId))||"[]") as any[] }catch{return []} }
function saveLogs(stdId:string, list:any[]){ localStorage.setItem(logsKey(stdId), JSON.stringify(list)); }

function getMentorName(): string {
  try{
    const p = JSON.parse(localStorage.getItem("coop.mentor.profile")||"{}");
    const full = `${p.firstName||""} ${p.lastName||""}`.trim();
    if (full) return full;
  }catch{}
  return (localStorage.getItem("coop.mentor.displayName") || "พี่เลี้ยง").trim();
}

export default function MentorDaily(){
  const students = loadStudents();
  const url = new URL(window.location.href);
  const preselect = url.searchParams.get("student") || "";

  const [studentId, setStudentId] = useState<string>(
    preselect && students.find(s=>s.studentId===preselect) ? preselect : (students[0]?.studentId || "")
  );
  const current = useMemo(()=>students.find(s=>s.studentId===studentId)||null,[students,studentId]);

  const [logs, setLogs] = useState<any[]>(()=> studentId ? loadLogs(studentId) : []);
  useEffect(()=>{ setLogs(studentId?loadLogs(studentId):[]); }, [studentId]);
  useEffect(()=>{ if(studentId) saveLogs(studentId, logs); }, [studentId, logs]);

  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [note, setNote] = useState("");

  const signerName = useMemo(()=>getMentorName(),[]);

  // signature pad
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D|null>(null);
  const drawingRef = useRef(false);
  const blankDataUrlRef = useRef<string>("");

  useEffect(()=>{
    function layout(){
      const wrap = wrapRef.current, canvas = canvasRef.current;
      if(!wrap || !canvas) return;

      const cssW = Math.max(420, Math.min(wrap.clientWidth - 16, 720));
      const cssH = 160;
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);

      const ctx = canvas.getContext("2d");
      if(!ctx) return;
      ctxRef.current = ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      clearCanvas();
    }

    layout();
    const ro = (window as any).ResizeObserver ? new ResizeObserver(layout) : null;
    if(ro && wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("orientationchange", layout);
    return ()=>{ if(ro && wrapRef.current) ro.unobserve(wrapRef.current); window.removeEventListener("orientationchange", layout); };
  },[]);

  function clearCanvas(){
    const c = canvasRef.current, ctx = ctxRef.current;
    if(!c || !ctx) return;

    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,c.width,c.height);
    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0,0,c.width,c.height);
    ctx.strokeStyle = "rgba(0,0,0,.08)";
    ctx.lineWidth = 2;

    const cssW = parseFloat((canvasRef.current as HTMLCanvasElement).style.width);
    const cssH = parseFloat((canvasRef.current as HTMLCanvasElement).style.height);
    ctx.strokeRect(1,1,cssW-2,cssH-2);

    blankDataUrlRef.current = c.toDataURL("image/png");
  }
  function getPos(e: MouseEvent|TouchEvent){
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    if ((e as TouchEvent).touches){
      const t = (e as TouchEvent).touches[0];
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }else{
      const m = e as MouseEvent;
      return { x: m.clientX - r.left, y: m.clientY - r.top };
    }
  }
  function startDraw(e: MouseEvent|TouchEvent){ e.preventDefault(); const ctx=ctxRef.current; if(!ctx) return; drawingRef.current=true; const {x,y}=getPos(e); ctx.beginPath(); ctx.moveTo(x,y); }
  function moveDraw(e: MouseEvent|TouchEvent){ if(!drawingRef.current) return; const ctx=ctxRef.current; if(!ctx) return; const {x,y}=getPos(e); ctx.lineCap="round"; ctx.lineJoin="round"; ctx.strokeStyle="#111827"; ctx.lineWidth=2.4; ctx.lineTo(x,y); ctx.stroke(); }
  function endDraw(){ drawingRef.current=false; }

  function add(e: React.FormEvent){
    e.preventDefault();
    if(!studentId || !date) return;

    const name = current ? `${current.firstName} ${current.lastName}`.trim() : "นักศึกษา";

    const c = canvasRef.current!;
    const dataUrl = c?.toDataURL("image/png") || "";
    const isBlank = dataUrl === blankDataUrlRef.current;
    if(isBlank){ alert("กรุณาเซ็นในช่องลายเซ็นก่อนบันทึก"); return; }

    const item: MentorDailyLog = {
      id: crypto.randomUUID(),
      date,
      studentName: name,
      note: note.trim(),
      checkIn: "",           // ให้ค่าว่างไว้ เพื่อไม่ให้ฝั่ง A_Daily แตกเวลา map
      checkOut: "",          // ให้ค่าว่างเหมือนกัน
      signatures: [{ name: signerName, role: "พี่เลี้ยง", dataUrl }],
      createdAt: new Date().toISOString(),
    };

    setLogs([item, ...logs]);
    setNote("");
    clearCanvas();
  }

  return (
    <div className="page" style={{padding:4, margin:28, marginLeft:65}}>
      {/* ฟอร์มลงบันทึก */}
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>ลงบันทึกประจำวันของนักศึกษา</h2>

        <form className="grid4" onSubmit={add} style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginLeft: 18}}>
          {/* แถว 1 */}
          <div>
            <label className="label" style={{ marginLeft: 10}}>นักศึกษาที่ดูแล</label>
            <select className="input" value={studentId} onChange={e=>setStudentId(e.target.value)} required>
              <option value="" disabled>— เลือกนักศึกษา —</option>
              {students.map(s=> (
                <option key={s.studentId} value={s.studentId}>
                  {s.studentId} · {s.firstName} {s.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" style={{ marginLeft: 10}}>วันที่ทำงาน</label>
            <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} required/>
          </div>

          {/* แถว 2: สรุปงาน */}
          <div className="note-wrap">
            <label className="label" style={{ marginLeft: 10 }}>สรุปงาน/สิ่งที่ทำ</label>
            <textarea
              className="input note-input"
              rows={3}
              value={note}
              onChange={(e)=>setNote(e.target.value)}
              placeholder="รายละเอียดงานที่นักศึกษาทำวันนี้"
            />
          </div>

          {/* แถว 3: ผู้เซ็นแบบ 1 คอลัมน์ (บนชื่อ / ล่างลายเซ็น) */}
          <div style={{gridColumn:"1 / -1"}}>
            <label className="label" style={{display:"block", marginBottom:6, marginLeft: 10}}>ผู้เซ็นรับรอง</label>

            <div className="sign-stack card" style={{padding:12}}>
              {/* บน: ชื่อผู้เซ็น*/}
              <div className="sign-info" style={{marginTop:18}}>
                <label className="label" style={{marginLeft:18}}>ชื่อผู้เซ็น</label>

                <input
                  className="input"
                  value={signerName}
                  readOnly
                  size={Math.max(12, signerName.length + 2)}
                  style={{ width: `${Math.max(12, signerName.length + 2)}ch`, display: "inline-block", marginLeft:15 }}
                  aria-readonly
                  title={signerName}
                />

                {/* ย้ายบทบาทมาไว้ใต้ช่องชื่อ */}
                <small className="role-under-input" style={{marginLeft:90}}>บทบาท: พี่เลี้ยง</small>
              </div>

              {/* ล่าง: ลายเซ็น */}
              <div className="sign-pad">
                <div className="pad-wrap" ref={wrapRef} style={{ marginLeft: 10}}>
                  <canvas
                    ref={canvasRef}
                    /* Mouse */
                    onMouseDown={(e) => { e.preventDefault(); startDraw(e.nativeEvent); }}
                    onMouseMove={(e) => moveDraw(e.nativeEvent)}
                    onMouseUp={() => endDraw()}
                    onMouseLeave={() => endDraw()}
                    /* Touch */
                    onTouchStart={(e) => { e.preventDefault(); startDraw(e.nativeEvent as any); }}
                    onTouchMove={(e) => { e.preventDefault(); moveDraw(e.nativeEvent as any); }}
                    onTouchEnd={() => endDraw()}
                    /* กันคลิกขวา/กดค้าง */
                    onContextMenu={(e) => e.preventDefault()}
                    /* a11y */
                    role="img"
                    aria-label="พื้นที่เซ็นลายเซ็น"
                    tabIndex={0}
                    /* style */
                    style={{
                      display: "block",
                      background: "#fff",
                      borderRadius: 8,
                      touchAction: "none",
                      outline: "none"
                    }}
                  />
                  <button
                    type="button"
                    className="icon-btn clear-btn"
                    onClick={clearCanvas}
                    aria-label="ล้างลายเซ็น"
                    title="ล้างลายเซ็น"
                    style={{margin:5}}
                  >
                    <TrashIcon />
                  </button>

                </div>
                <div className="muted align-right" style={{ marginRight: 10}}>เซ็นด้วยเมาส์/นิ้ว</div>
              </div>
            </div>
          </div>

          {/* ปุ่มบันทึก */}
          <div><button className="btn" type="submit" disabled={!studentId} >บันทึก</button></div>
        </form>

        <p style={{color:"#6b7280", fontSize:12, marginTop:8, marginLeft:20}}>* บันทึกแล้วแก้ไขไม่ได้ — เก็บตามนักศึกษาแต่ละคน</p>
      </section>

      {/* แสดงข้อมูลนักศึกษา */}
      <section className="card" aria-live="polite" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>ข้อมูลนักศึกษา</h2>
        {current ? (
          <div className="studgrid" style={{display:"grid", gridTemplateColumns:"180px 1fr", gap:16, alignItems:"start"}}>
            <div className="card" style={{height:160, borderStyle:"dashed", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:28}}>
              {(current.firstName||"?").charAt(0)}
            </div>
            <div className="info" style={{display:"grid", gridTemplateColumns:"repeat(2, minmax(220px,1fr))", gap:10}}>
              <Field label="ชื่อ-นามสกุล" value={`${current.firstName} ${current.lastName}`.trim()} />
              <Field label="อีเมล" value={current.email||"—"} />
              <Field label="โทรศัพท์" value={current.phone||"—"} />
              <Field label="สาขา" value={current.major||"—"} />
            </div>
          </div>
        ) : (
          <p style={{marginTop:0, color:"#6b7280", marginLeft:40}}>— เลือกนักศึกษาก่อน —</p>
        )}
      </section>

      {/* ประวัติการบันทึก */}
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>ประวัติการบันทึก</h2>
        {current ? (
          <p style={{marginTop:0, color:"#6b7280", marginLeft:40}}>นักศึกษา: <b>{current.firstName} {current.lastName}</b> · รหัส {current.studentId}</p>
        ) : (
          <p style={{marginTop:0, color:"#6b7280", marginLeft:40}}>— เลือกนักศึกษาก่อน —</p>
        )}

        <div className="tbl-wrap">
          <table className="tbl" style={{ marginLeft:40}}>
            <thead>
              <tr>
                <th>วันที่ทำงาน</th>
                <th>ชื่อ</th>
                <th>สรุปงาน/สิ่งที่ทำ</th>
                <th>ผู้เซ็น</th>
                <th>ลายเซ็น</th>
                <th>วันที่เพิ่มข้อมูล</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l:any)=>(
                <tr key={l.id}>
                  <td>{fmtDate(l.date)}</td>
                  <td>{l.studentName}</td>
                  <td className="note">{l.note||"-"}</td>
                  <td>{l.signatures?.[0]?.name ? `${l.signatures[0].name}${l.signatures[0].role ? ` (${l.signatures[0].role})`:""}` : "—"}</td>
                  <td>{l.signatures?.[0]?.dataUrl ? <img src={l.signatures[0].dataUrl} alt="ลายเซ็น" style={{maxHeight:48, maxWidth:220, display:"block"}}/> : "—"}</td>
                  <td>{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {logs.length===0 && <tr><td colSpan={6} style={{color:"#6b7280"}}>ยังไม่มีรายการ</td></tr>}
            </tbody>
          </table>
        </div>

        <style>{`
          .tbl{ width:100%; border-collapse:separate; border-spacing:0 8px }
          th{ text-align:left; font-size:13px; color:#6b7280; font-weight:700; padding:0 10px }
          td{ background:#fff; border:1px solid #e5e7eb; padding:10px; vertical-align:top }
          td:first-child{ border-radius:12px 0 0 12px } td:last-child{ border-radius:0 12px 12px 0 }
          .note{ max-width:420px }
        `}</style>
      </section>

      {/* Responsive */}
      <style>{`
        .muted{ color:#6b7280; font-size:12px; margin-top:4px }
        .align-right{ text-align:right }

        /*เปลี่ยนเป็น 1 คอลัมน์ถาวร */
        .sign-stack{ display:grid; grid-template-columns: 1fr; row-gap: 12px; max-width:700px; }
        .sign-pad{
          max-width: 680px;     /* ปรับเลขนี้ได้ตามต้องการ */
        }
        .pad-wrap{ 
          position:relative; border:1px dashed #cbd5e1; 
          border-radius:12px; background:#f8fafc; padding:8px 
        }
        .clear-btn{ position:absolute; right:12px; bottom:12px }
        .sign-info .input{ width:auto !important; display:inline-block; }
        /* ย้ายบทบาทมาไว้ใต้ช่องชื่อ */
          .role-under-input{
            display:block;
            margin: 6px 0 0;      /* เว้นช่องเหนือบทบาทนิดหน่อย */
            font-size:12px;
            color:#6b7280;
            font-weight:700;
            margin-left:80px
          }

        /* กัน input ถูกบังคับให้เต็มแถว — คงความกว้างตามความยาวชื่อ */
          .sign-info .input{
            width:auto !important;
            display:inline-block;
          }
        /* ทำให้ช่องสรุปงานแคบลงบนเดสก์ท็อป */
          .note-wrap{
            grid-column: 1 / span 3;   /* ใช้ 3 คอลัมน์จาก 4 */
            max-width: 900px;          /* ย่อความกว้างสูงสุด */
          }
          .note-input{ width: 100%; }
        /* ปุ่มไอคอน */
        .icon-btn{
          width:38px; height:38px;
          display:inline-flex; align-items:center; justify-content:center;
          border-radius:10px;
          border:1px solid rgba(0,0,0,.08);
          background:#fff; color:#0f172a;
          cursor:pointer;
          transition: background .12s ease, border-color .12s ease, box-shadow .12s ease, color .12s ease;
          box-shadow:0 1px 0 rgba(0,0,0,.02);
        }
        .icon-btn:hover{
          background:#f8fafc; border-color:#c7d2fe; color:#0074B7;
          box-shadow:0 6px 14px rgba(0,116,183,.14);
        }
        .icon-btn svg{ width:20px; height:20px; display:block }

        /* ตำแหน่งปุ่มในกรอบลายเซ็น (มีอยู่แล้วก็ปล่อยไว้ได้) */
        .clear-btn{ position:absolute; right:12px; bottom:12px }
        .tbl-wrap{
          max-width: 1350px;     /* ปรับเลขนี้ตามต้องการ */
          margin-left: 18px;    /* ให้ชิดซ้ายเท่า heading */
          margin-right: 18px;
        }

        .tbl{ width:100%; border-collapse:separate; border-spacing:0 8px table-layout: fixed; }
        /* 1) ลดความกว้างคอลัมน์ "วันที่ทำงาน" (คอลัมน์ที่ 1) */
        .tbl th:nth-child(1),
        .tbl td:nth-child(1){
          width: 120px;            /* ปรับเลขได้ เช่น 100–140 */
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-variant-numeric: tabular-nums;
        }

        /* 2) เพิ่มความกว้างคอลัมน์ "ชื่อ" (คอลัมน์ที่ 2) */
        .tbl th:nth-child(2),
        .tbl td:nth-child(2){
          width: 280px;            /* ปรับเลขได้ เช่น 260/300 */
        }
        .tbl th:nth-child(6), .tbl td:nth-child(6){
          width: 140px;                        /* ← ปรับเลขได้ เช่น 120/160 */
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-variant-numeric: tabular-nums;  /* จัดตัวเลขเสมอคอลัมน์ อ่านง่าย */
}
        th{ text-align:left; font-size:13px; color:#6b7280; font-weight:700; padding:0 10px }
        td{ background:#fff; border:1px solid #e5e7eb; padding:10px; vertical-align:top }
        td:first-child{ border-radius:12px 0 0 12px } td:last-child{ border-radius:0 12px 12px 0 }
        .note{ max-width:420px }


        @media (max-width: 1024px){
          .grid4{ grid-template-columns: 1fr !important }
          .studgrid{ grid-template-columns: 1fr !important }
          .studgrid .info{ grid-template-columns: 1fr !important }
          .align-right{ text-align:left }
          .note-wrap{
            grid-column: 1 / -1;     /* กลับไปเต็มความกว้างบนจอเล็ก */
            max-width: none;
          }
          .sign-stack, .sign-pad, .sign-pad .pad-wrap{
            max-width: none;
          }
          .tbl-wrap{ max-width: 100%; margin-left: 0; margin-right: 0; }
          .tbl th:nth-child(1),
          .tbl td:nth-child(1){ width: 96px; }
          .tbl th:nth-child(2),
          .tbl td:nth-child(2){ width: auto; }
        }
      `}</style>
    </div>
  );
}

function Field({label, value}:{label:string, value:string}){
  return (
    <div className="field card" style={{padding:10}}>
      <div style={{fontSize:12, color:"#6b7280", fontWeight:700}}>{label}</div>
      <div style={{fontWeight:800}}>{value || "—"}</div>
    </div>
  );
}

function fmtDate(iso:string){ return new Date(iso+"T00:00:00").toLocaleDateString(); }

function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <rect x="5" y="6" width="14" height="14" rx="2" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
