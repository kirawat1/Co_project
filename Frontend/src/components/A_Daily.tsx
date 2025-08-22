// src/components/A_Daily.tsx
import { useMemo, useState } from "react";
import type { DailyLog } from "./store";

/* ========== โหลดข้อมูล ========== */
function loadStudentLogs(): DailyLog[] {
  try { return JSON.parse(localStorage.getItem("coop.daily") || "[]") || []; }
  catch { return []; }
}
function loadMentorLogs(): { studentId: string; studentName: string; log: DailyLog }[] {
  try {
    const studs = JSON.parse(localStorage.getItem("coop.mentor.students") || "[]") as {
      studentId: string; firstName?: string; lastName?: string;
    }[];
    const out: { studentId: string; studentName: string; log: DailyLog }[] = [];
    for (const s of studs) {
      const key = `coop.mentor.logs.${s.studentId}`;
      const list = (JSON.parse(localStorage.getItem(key) || "[]") || []) as DailyLog[];
      const n = `${s.firstName || ""} ${s.lastName || ""}`.trim() || s.studentId;
      list.forEach(l => out.push({ studentId: s.studentId, studentName: n, log: l }));
    }
    return out.sort((a, b) => (b.log.createdAt || "").localeCompare(a.log.createdAt || ""));
  } catch { return []; }
}
function loadMentorProfile() {
  try {
    const p = JSON.parse(localStorage.getItem("coop.mentor.profile") || "{}");
    const full = `${p.firstName || ""} ${p.lastName || ""}`.trim();
    return full || "พี่เลี้ยง";
  } catch { return "พี่เลี้ยง"; }
}

/* ========== UI หลัก ========== */
export default function A_Daily() {
  const [tab, setTab] = useState<"student" | "mentor">("student");
  const [q, setQ] = useState(""); // 🔍 ค้นหาชื่อ/รหัสของนักศึกษา

  const sLogsRaw = useMemo(() => loadStudentLogs(), []);
  const mLogsRaw = useMemo(() => loadMentorLogs(), []);
  const mentorName = useMemo(() => loadMentorProfile(), []);

  // กรองเฉพาะตาม "ชื่อ/รหัสนักศึกษา"
  const filteredStudentLogs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return sLogsRaw;
    return sLogsRaw.filter(l => {
      const sid = ((l as any).studentId || "").toString();
      const name = (l.studentName || "").toString();
      return `${sid} ${name}`.toLowerCase().includes(needle);
    });
  }, [sLogsRaw, q]);

  const filteredMentorLogs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return mLogsRaw;
    return mLogsRaw.filter(x => (`${x.studentId} ${x.studentName}`).toLowerCase().includes(needle));
  }, [mLogsRaw, q]);

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <section className="card" style={{ padding: 15, marginBottom: 28 }}>
        <div className="segment" role="tablist" aria-label="เลือกประเภทบันทึก">
          <button className={`seg ${tab==="student"?"active":""}`} onClick={()=>setTab("student")} type="button">
            บันทึกโดยนักศึกษา
          </button>
          <button className={`seg ${tab==="mentor"?"active":""}`}  onClick={()=>setTab("mentor")} type="button">
            บันทึกโดยพี่เลี้ยง
          </button>
        </div>
      </section>

      {tab==="student" ? (
        <section className="card">
          <h2 style={{ padding: 15, marginBottom: 12 }}>บันทึกโดยนักศึกษา</h2>

          {/* 🔍 แถบค้นหาเฉพาะชื่อ/รหัสนักศึกษา */}
          <div className="tools" style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginLeft: 25, marginBottom: 16 }}>
            <input
              className="input"
              placeholder="ค้นหา: ชื่อ/รหัสนักศึกษา"
              value={q}
              onChange={e=>setQ(e.target.value)}
              style={{ flex:"0 1 420px", minWidth: 240 }}
            />
          </div>

          <StudentTable
            logs={filteredStudentLogs.map(l => ({
              date: l.date,
              sid: (l as any).studentId || "-",
              name: (l.studentName || "").trim() || "นักศึกษา",
              in: l.checkIn || "-",
              out: l.checkOut || "-",
              note: l.note || "-",
              created: l.createdAt
            }))}
          />
        </section>
      ) : (
        <section className="card">
          <h2 style={{ padding: 15, marginBottom: 12 }}>บันทึกโดยพี่เลี้ยง</h2>

          {/* 🔍 แถบค้นหาเฉพาะชื่อ/รหัสนักศึกษา */}
          <div className="tools" style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginLeft: 25, marginBottom: 16 }}>
            <input
              className="input"
              placeholder="ค้นหา: ชื่อ/รหัสนักศึกษา"
              value={q}
              onChange={e=>setQ(e.target.value)}
              style={{ flex:"0 1 420px", minWidth: 240 }}
            />
          </div>

          <MentorTable
            logs={filteredMentorLogs.map(x => ({
              mentor: mentorName,
              student: `${x.studentId} · ${x.studentName}`,
              date: x.log.date,
              summary: x.log.note || "-",
              created: x.log.createdAt
            }))}
          />
        </section>
      )}

      <style>{`
        .segment{ display:grid; grid-template-columns:repeat(2,1fr); gap:6px; background:#EFF3FF; border:1px solid rgba(10,132,255,.15); padding:6px; border-radius:14px }
        .seg{ border:0; background:transparent; padding:10px 12px; border-radius:11px; font-weight:700; color:#4b5563 }
        .seg.active{ background:#fff; color:#111827; box-shadow:0 1px 0 rgba(0,0,0,.02), 0 6px 18px rgba(10,132,255,.18) }

        @media (max-width:1024px){
          .tools .input{ flex: 1 1 100% !important; min-width: 0 !important; }
        }
      `}</style>
    </div>
  );
}

/* ========== ตาราง: นักศึกษา ========== */
function StudentTable({
  logs
}: {
  logs: { date: string; sid: string; name: string; in: string; out: string; note: string; created?: string }[];
}) {
  return (
    <table className="doc-table" style={{ width: "100%", tableLayout: "fixed", marginLeft: 25 }}>
      <colgroup>
        <col style={{ width: "15ch" }} />   {/* วันที่ทำงาน */}
        <col style={{ width: "15ch" }} />   {/* รหัสนักศึกษา */}
        <col style={{ width: "25ch" }} />   {/* ชื่อ-นามสกุล */}
        <col style={{ width: "18ch" }} />    {/* เวลาเข้า */}
        <col style={{ width: "18ch" }} />    {/* เวลาออก */}
        <col />                              {/* หมายเหตุ */}
        <col style={{ width: "18ch" }} />   {/* วันที่เพิ่มข้อมูล */}
      </colgroup>

      <thead>
        <tr>
          <th align="left">วันที่ทำงาน</th>
          <th align="left">รหัสนักศึกษา</th>
          <th align="left">ชื่อ-นามสกุล</th>
          <th className="cell-time">เวลาเข้า</th>
          <th className="cell-time">เวลาออก</th>
          <th align="left">หมายเหตุ</th>
          <th align="left">วันที่เพิ่มข้อมูล</th>
        </tr>
      </thead>

      <tbody>
        {logs.map((l, i) => {
          const d1 = new Date(l.date + "T00:00:00").toLocaleDateString();
          const d2 = l.created ? new Date(l.created).toLocaleString() : "-";
          return (
            <tr key={i} className="row">
              <td className="cell-ellipsis" title={d1}>{d1}</td>
              <td className="cell-ellipsis" title={l.sid}>{l.sid}</td>
              <td className="cell-ellipsis" title={l.name}>{l.name}</td>
              <td className="cell-time">{l.in}</td>
              <td className="cell-time">{l.out}</td>
              <td className="cell-note">{l.note}</td>
              <td className="cell-ellipsis" title={d2}>{d2}</td>
            </tr>
          );
        })}
        {logs.length === 0 && (
          <tr><td colSpan={7} style={{ color: "#6b7280" }}>— ไม่มีข้อมูล —</td></tr>
        )}
      </tbody>

      <style>{`
        .cell-ellipsis{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .cell-note{ white-space: normal; overflow-wrap:anywhere; word-break:break-word; }
        .cell-time{ text-align:center; }
      `}</style>
    </table>
  );
}

/* ========== ตาราง: พี่เลี้ยง ========== */
function MentorTable({
  logs
}: {
  logs: { mentor: string; student: string; date: string; summary: string; created?: string }[];
}) {
  return (
    <table className="doc-table" style={{ width: "100%", tableLayout: "fixed", marginLeft: 25 }}>
      <colgroup>
        <col style={{ width: "25ch" }} />   {/* ชื่อพี่เลี้ยง */}
        <col style={{ width: "25ch" }} />   {/* นักศึกษาที่ดูแล */}
        <col style={{ width: "18ch" }} />   {/* วันที่นักศึกษาทำงาน */}
        <col />                              {/* สรุปงาน/สิ่งที่ทำ */}
        <col style={{ width: "18ch" }} />   {/* วันที่เพิ่มข้อมูล */}
      </colgroup>
      <thead>
        <tr>
          <th align="left">ชื่อ-นามสกุล</th>
          <th align="left">นักศึกษาที่ดูแล</th>
          <th align="left">วันที่นักศึกษาทำงาน</th>
          <th align="left">สรุปงาน/สิ่งที่ทำ</th>
          <th align="left">วันที่เพิ่มข้อมูล</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((l, i) => {
          const d1 = new Date(l.date + "T00:00:00").toLocaleDateString();
          const d2 = l.created ? new Date(l.created).toLocaleString() : "-";
          return (
            <tr key={i}>
              <td className="cell-ellipsis" title={l.mentor}>{l.mentor}</td>
              <td className="cell-ellipsis" title={l.student}>{l.student}</td>
              <td className="cell-ellipsis" title={d1}>{d1}</td>
              <td className="cell-note">{l.summary}</td>
              <td className="cell-ellipsis" title={d2}>{d2}</td>
            </tr>
          );
        })}
        {logs.length === 0 && (
          <tr><td colSpan={5} style={{ color: "#6b7280" }}>— ไม่มีข้อมูล —</td></tr>
        )}
      </tbody>

      <style>{`
        .cell-ellipsis{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .cell-note{ white-space: normal; overflow-wrap:anywhere; word-break:break-word; }
      `}</style>
    </table>
  );
}
