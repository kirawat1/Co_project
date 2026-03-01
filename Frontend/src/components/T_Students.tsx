import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { loadAcademicYear } from "./store";

// --- Interfaces ---
interface StudentProfile {
  id: number;
  studentId: string;
  firstName?: string;
  lastName?: string;
  major?: string;
  company?: { name: string };
  coop?: {
    status: string;
  };
  coopRequest?: {
    status: string;
  };
}

// --- UI Helper: Status Chip ---
function chip(status: string) {
  const s = (status || "").toLowerCase();

  let cls = "waiting";
  let label = "ฉบับร่าง";

  if (s === "submitted" || s === "pending") {
    cls = "under"; label = "รอพิจารณา";
  } else if (s === "approved") {
    cls = "appr"; label = "ผ่าน";
  } else if (s === "rejected") {
    cls = "rej"; label = "ไม่ผ่าน";
  } else if (s === "edits_required") {
    cls = "edit"; label = "รอแก้ไข";
  }

  return <span className={`chip ${cls}`}>{label}</span>;
}

// --- Main Component ---
export default function T_Students() {
  const year = loadAcademicYear();

  // State เก็บข้อมูลนักศึกษาจริงจาก API
  const [allStudents, setAllStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // --- 1. Fetch Data จาก API ---
  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("coop.token");
      try {
        const res = await fetch("http://localhost:5000/api/students", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAllStudents(data);
        }
      } catch (err) {
        console.error("Error fetching students:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- 2. Filter: แสดงทุกคน (เอา assignedIds ออก) ---
  const filteredStudents = useMemo(() => {
    return allStudents.filter((s) => {
      // กรองตามคำค้นหา (Search)
      const t = `${s.studentId} ${s.firstName || ""} ${s.lastName || ""} ${s.company?.name || s.coop?.status || ""}`.toLowerCase();
      return t.includes(q.toLowerCase());
    });
  }, [allStudents, q]);

  if (loading) return <div style={{ padding: 20 }}>กำลังโหลดข้อมูล...</div>;

  return (
    <div style={{ display: "grid", gap: 16, marginLeft: 35, marginTop: 28 }}>

      {/* Header Card */}
      <section className="card">
        <div style={{ fontWeight: 1000, fontSize: 20 }}>รายชื่อนักศึกษาทั้งหมด</div>
        <div style={{ color: "#6b7280", marginTop: 4 }}>
          ปีการศึกษา <b>{year}</b>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder="ค้นหา: รหัส / ชื่อ / บริษัท"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: "1 1 320px" }}
          />
          <div style={{ display: "inline-flex", alignItems: "center", color: "#6b7280", fontWeight: 800 }}>
            ทั้งหมด {filteredStudents.length} คน
          </div>
        </div>
      </section>

      {/* Table Card */}
      <section className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", padding: 14 }}>
            <thead>
              <tr>
                {["รหัส", "ชื่อ-นามสกุล", "สาขา", "บริษัท", "คำร้อง", "เปิดดู"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 13, color: "#374151" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => {
                const name = `${s.firstName || ""} ${s.lastName || ""}`.trim() || "-";
                // ใช้ status จาก coop (DB) หรือ fallback
                const st = s.coop?.status || s.coopRequest?.status || "DRAFT";

                return (
                  <tr key={s.studentId} style={{ background: "#fff" }}>
                    <td style={td()}>{s.studentId}</td>
                    <td style={td()}>{name}</td>
                    <td style={td()}>{s.major || "-"}</td>
                    <td style={td()}>{s.company?.name || "-"}</td>
                    <td style={td()}>{chip(st)}</td>
                    <td style={td()}>
                      <Link className="btn" to={`/teacher/students/${s.studentId}`} style={{ padding: "6px 20px", fontSize: 16, textDecoration: 'none' }}>
                        รายละเอียด
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: "#6b7280", textAlign: 'center' }}>
                    — ไม่พบรายชื่อ —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        .chip.edit { background: #ffedd5; color: #c2410c; } /* สีส้มสำหรับรอแก้ไข */
      `}</style>
    </div>
  );
}

function td(): React.CSSProperties {
  return { padding: "12px 10px", borderTop: "1px solid rgba(0,0,0,.04)", borderBottom: "1px solid rgba(0,0,0,.04)" };
}