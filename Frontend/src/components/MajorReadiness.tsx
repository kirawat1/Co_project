import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../utils/apiFetch";
import { LoadingBlock } from "./Spinner";

// เช็กลิสต์ความพร้อมของหลักสูตร — เพิ่มหลักสูตรใหม่แล้วต้องตั้งอะไรบ้างก่อนนักศึกษาเริ่มใช้
interface Check { key: string; required: boolean; ok: boolean; page: string; label: string; detail: string }
interface Item { major: string; nameTh: string | null; students: number; ready: boolean; checks: Check[] }
interface Unregistered { major: string; teachers: number; students: number }
interface Readiness {
  period: { academicYear: string; semester: number } | null;
  items: Item[];
  unregistered: Unregistered[];
  studentsWithoutMajor: number;
}

const mark = (c: Check) =>
  c.ok ? { icon: "✓", color: "#15803d", bg: "#f0fdf4" }
  : c.required ? { icon: "✕", color: "#dc2626", bg: "#fef2f2" }
  : { icon: "!", color: "#b45309", bg: "#fffbeb" };

export default function MajorReadiness() {
  const [data, setData] = useState<Readiness | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/admin/major-readiness")
      .then(r => r.json())
      .then(d => (d.ok ? setData(d) : setError(d.message || "โหลดความพร้อมของหลักสูตรไม่สำเร็จ")))
      .catch(() => setError("โหลดความพร้อมของหลักสูตรไม่สำเร็จ"));
  }, []);

  if (error) return <div className="card" style={{ padding: 20, color: "#dc2626", marginBottom: 20 }}>{error}</div>;
  if (!data) return <div className="card" style={{ marginBottom: 20 }}><LoadingBlock text="กำลังตรวจความพร้อมของหลักสูตร…" style={{ padding: 20, justifyContent: "flex-start" }} /></div>;

  const notReady = data.items.filter(i => !i.ready).length;

  return (
    <section data-testid="major-readiness" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1e293b" }}>ความพร้อมของหลักสูตร</h3>
        <span style={{ fontSize: 13, color: notReady ? "#dc2626" : "#15803d", fontWeight: 700 }}>
          {data.items.length === 0 ? "" : notReady ? `ยังไม่พร้อม ${notReady} หลักสูตร` : "ทุกหลักสูตรพร้อม"}
        </span>
      </div>

      {(data.unregistered.length > 0 || data.studentsWithoutMajor > 0) && (
        <div style={{ padding: "12px 14px", marginBottom: 12, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, fontSize: 13, color: "#92400e" }}>
          {data.unregistered.length > 0 && (
            <div>
              <b>มีอาจารย์/นักศึกษาที่อยู่หลักสูตรซึ่งยังไม่ได้เพิ่มในระบบ:</b>{" "}
              {data.unregistered.map(u => (
                <span key={u.major} style={{ display: "inline-block", margin: "2px 6px 2px 0", padding: "1px 8px", background: "#fff", border: "1px solid #fcd34d", borderRadius: 999 }}>
                  {u.major} <span style={{ color: "#a16207" }}>(อาจารย์ {u.teachers} · นักศึกษา {u.students})</span>
                </span>
              ))}
              <div style={{ marginTop: 4, color: "#a16207" }}>
                หลักสูตรเหล่านี้ยังตั้งรอบ/อาจารย์ประจำวิชาไม่ได้ — <Link to="/admin/criteria" style={{ color: "#1d4ed8" }}>เพิ่มที่หน้าจัดการหลักสูตร →</Link>
                {" "}(รหัสต้องตรงกับที่อาจารย์ใช้อยู่)
              </div>
            </div>
          )}
          {data.studentsWithoutMajor > 0 && (
            <div style={{ marginTop: data.unregistered.length ? 8 : 0 }}>
              <b>นักศึกษายังไม่ระบุหลักสูตร {data.studentsWithoutMajor} คน</b> — อาจารย์ประจำวิชาไม่เห็นนักศึกษากลุ่มนี้ · <Link to="/admin/students" style={{ color: "#1d4ed8" }}>แก้ที่หน้านักศึกษา →</Link>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))" }}>
        {data.items.map(item => (
          <div key={item.major} className="card" data-testid={`readiness-${item.major}`}
            style={{ padding: 16, borderTop: `4px solid ${item.ready ? "#22c55e" : "#ef4444"}`, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#1e293b" }}>{item.major}</div>
                {item.nameTh && <div style={{ fontSize: 12, color: "#64748b", overflowWrap: "anywhere" }}>{item.nameTh}</div>}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", color: item.ready ? "#15803d" : "#dc2626" }}>
                {item.ready ? "พร้อม" : "ยังไม่พร้อม"}
              </span>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {item.checks.map(c => {
                const m = mark(c);
                return (
                  <Link key={c.key} to={c.page} style={{ display: "flex", gap: 8, alignItems: "flex-start", textDecoration: "none", padding: "6px 8px", borderRadius: 8, background: m.bg }}>
                    <span aria-hidden style={{ fontWeight: 800, color: m.color, width: 14, textAlign: "center", flexShrink: 0 }}>{m.icon}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
                        {c.label}{c.required && !c.ok ? " (จำเป็น)" : ""}
                      </span>
                      <span style={{ display: "block", fontSize: 12, color: "#64748b", overflowWrap: "anywhere" }}>{c.detail}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>นักศึกษา {item.students} คน</div>
          </div>
        ))}
      </div>
    </section>
  );
}
