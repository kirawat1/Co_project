import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const IOS_BLUE = "#0074B7";

/* ===============================
    Types
=============================== */
interface CoopPeriod {
  id: number;
  semester: string | number;
  academicYear: string;
  isActive: boolean;
}

interface TeacherStats {
  myStudentsCount: number;
  pendingRequests: number;
  approvedStudents: number; // 🟢 เพิ่มสถิติผ่านคุณสมบัติ
}

interface StudentRequest {
  studentId: string;
  firstName: string;
  lastName: string;
  coop?: {
    status: string;
    company?: { name: string };
  };
}

interface SupervisionAppt {
  id: number;
  supervisionType: "ONLINE" | "ONSITE";
  confirmedDate: string | null;
  status: string;
  student: {
    studentId: string;
    firstName: string;
    lastName: string;
    coop?: {
      company?: { name: string };
    };
  };
}

/* ===============================
    UI helpers
=============================== */
function chip(status?: string) {
  const s = String(status || "draft").toLowerCase();
  const statusMap: Record<string, { bg: string; color: string; label: string }> = {
    submitted: { bg: "#fef3c7", color: "#d97706", label: "รอพิจารณา" },
    pending_teacher: { bg: "#fef3c7", color: "#d97706", label: "รอพิจารณา" },
    approved: { bg: "#dcfce7", color: "#16a34a", label: "ผ่านคุณสมบัติ" },
    date_confirmed: { bg: "#d0f2ff", color: "#0369a1", label: "ยืนยันวันแล้ว" },
    rejected: { bg: "#fee2e2", color: "#dc2626", label: "ไม่ผ่าน" },
    draft: { bg: "#f1f5f9", color: "#64748b", label: "ฉบับร่าง" },
  };

  const { bg, color, label } = statusMap[s] || statusMap["draft"];
  return (
    <span style={{ background: bg, color: color, padding: "4px 10px", borderRadius: "20px", fontSize: 12, fontWeight: 700 }}>
      {label}
    </span>
  );
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "รอยืนยันเวลา";
  return new Date(dateStr).toLocaleString("th-TH", {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }) + " น.";
}

/* ===============================
    Component
=============================== */
export default function T_Dashboard() {
  const [periods, setPeriods] = useState<CoopPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");

  const [stats, setStats] = useState<TeacherStats>({ myStudentsCount: 0, pendingRequests: 0, approvedStudents: 0 });
  const [pendingStudents, setPendingStudents] = useState<StudentRequest[]>([]);
  const [approvedStudents, setApprovedStudents] = useState<StudentRequest[]>([]);
  const [supervisions, setSupervisions] = useState<SupervisionAppt[]>([]);
  const [t002Count, setT002Count] = useState(0);
  const [t003Count, setT003Count] = useState(0);
  const [supPendingCount, setSupPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("coop.token");

  /* ==========================================
      1. ดึงรอบปีการศึกษาทั้งหมด
     ========================================== */
  const fetchPeriods = async () => {
    try {
      const res = await axios.get("/api/admin/coop-periods", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.ok) {
        const periodList: CoopPeriod[] = res.data.periods;
        setPeriods(periodList);

        const active = periodList.find(p => p.isActive);
        if (active) setSelectedPeriod(`${active.semester}/${active.academicYear}`);
        else setSelectedPeriod("all");
      }
    } catch (err) { console.error("Failed to fetch periods", err); }
  };

  /* ==========================================
      2. ดึงข้อมูล (สถิติ + คำร้อง + นัดนิเทศ)
     ========================================== */
  const fetchData = async (periodKey: string) => {
    if (!periodKey) return;
    setLoading(true);

    try {
      let query = "";
      if (periodKey !== "all") {
        const [semester, year] = periodKey.split("/");
        query = `?semester=${semester}&year=${year}`;
      }

      // 2.1 ดึงสถิติ
      const statsRes = await axios.get(`/api/teacher/stats${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (statsRes.data?.ok) setStats(statsRes.data.data);

      // 2.2 ดึงคำร้อง
      const listRes = await axios.get(`/api/teacher/latest-requests${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (listRes.data?.ok) {
        const allStudents: StudentRequest[] = listRes.data.students || [];
        // 🟢 แยกนักศึกษา "รอพิจารณา"
        setPendingStudents(allStudents.filter(s => s.coop?.status === 'submitted' || s.coop?.status === 'pending').slice(0, 5));
        // 🟢 แยกนักศึกษา "ผ่านคุณสมบัติ"
        setApprovedStudents(allStudents.filter(s => s.coop?.status === 'approved').slice(0, 5));
      }

      // 2.3 ดึงนัดนิเทศของอาจารย์
      try {
        const supRes = await axios.get(`/api/teacher/supervisions${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (supRes.data?.ok) {
          const supList = supRes.data.supervisions || supRes.data.list || [];
          setSupervisions(supList);
          setSupPendingCount(supList.filter((s: SupervisionAppt) => s.status === "PENDING_TEACHER").length);
        }
      } catch (err) { console.warn("Supervision API not ready or error", err); }

      // 2.4 ดึงจำนวน T002/T003 รอตรวจ
      try {
        const [t002Res, t003Res] = await Promise.allSettled([
          axios.get(`/api/admin/students${query ? query + "&" : "?"}status=T002_SUBMITTED&limit=1`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`/api/admin/students${query ? query + "&" : "?"}status=T003_SUBMITTED&limit=1`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (t002Res.status === "fulfilled" && t002Res.value.data?.meta) setT002Count(t002Res.value.data.meta.total ?? 0);
        if (t003Res.status === "fulfilled" && t003Res.value.data?.meta) setT003Count(t003Res.value.data.meta.total ?? 0);
      } catch { /* silent */ }

    } catch (err) {
      console.error("Teacher Dashboard Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      let coopPeriodId: string = "all";
      if (selectedPeriod !== "all") {
        const match = periods.find(p => `${p.semester}/${p.academicYear}` === selectedPeriod);
        if (match) coopPeriodId = String(match.id);
      }

      const res = await axios.get(`/api/teacher/students/export?coopPeriodId=${coopPeriodId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `students_${coopPeriodId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
      alert("ดาวน์โหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่");
    }
  };

  useEffect(() => { fetchPeriods(); }, []);
  useEffect(() => { fetchData(selectedPeriod); }, [selectedPeriod]);

  return (
    <div style={{ display: "grid", gap: 20, marginLeft: 35, marginTop: 28, paddingRight: 20, paddingBottom: 40 }}>
      {/* Header & Filter */}
      <section className="card" style={{ borderLeft: `6px solid ${IOS_BLUE}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 22, color: '#1e293b' }}>หน้าหลักอาจารย์ที่ปรึกษา</div>
            <div style={{ color: "#64748b", marginTop: 4, fontSize: 14 }}>สรุปข้อมูลและคำร้องของนักศึกษา</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>รอบปีการศึกษา:</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
            >
              <option value="all">ดูทั้งหมด (All Time)</option>
              {periods.map(p => {
                const val = `${p.semester}/${p.academicYear}`;
                return <option key={p.id} value={val}>เทอม {val} {p.isActive ? "⭐" : ""}</option>;
              })}
            </select>
            <button
              onClick={handleExport}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #16a34a',
                background: '#16a34a',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              📥 Export Excel
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>กำลังโหลดข้อมูล...</div>
      ) : (
        <>
          {/* ================= ACTION REQUIRED ================= */}
          {(stats.pendingRequests > 0 || t002Count > 0 || t003Count > 0 || supPendingCount > 0) && (
            <section className="card" style={{ borderLeft: `5px solid #f59e0b`, background: 'linear-gradient(135deg,#fffbeb,#fef3c7)' }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#92400e', marginBottom: 14 }}>⚡ สิ่งที่ต้องดำเนินการ</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {stats.pendingRequests > 0 && (
                  <Link to="/teacher/requests" style={actionChip('#ef4444')}>
                    📋 คำร้องสหกิจ <strong>{stats.pendingRequests}</strong> รายการ →
                  </Link>
                )}
                {t002Count > 0 && (
                  <Link to="/teacher/review-t002" style={actionChip('#0ea5e9')}>
                    📄 T002 รอตรวจ <strong>{t002Count}</strong> ราย →
                  </Link>
                )}
                {t003Count > 0 && (
                  <Link to="/teacher/review-t003" style={actionChip('#8b5cf6')}>
                    📘 T003 รอตรวจ <strong>{t003Count}</strong> ราย →
                  </Link>
                )}
                {supPendingCount > 0 && (
                  <Link to="/teacher/review-supervision" style={actionChip('#10b981')}>
                    📅 นิเทศรอยืนยัน <strong>{supPendingCount}</strong> ราย →
                  </Link>
                )}
              </div>
            </section>
          )}

          {/* ================= Stats ================= */}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
            <CardStat title="นักศึกษาในดูแล" value={stats.myStudentsCount} hint="นักศึกษาที่คุณเป็นที่ปรึกษา" color="#0ea5e9" />
            <CardStat title="คำร้องรอพิจารณา" value={stats.pendingRequests} hint="นักศึกษาที่ยื่นคำร้องเข้ามาใหม่" color="#f59e0b" />
            <CardStat title="ผ่านคุณสมบัติ" value={stats.approvedStudents || approvedStudents.length} hint="นักศึกษาที่ได้ออกฝึกสหกิจ" color="#10b981" />
          </section>

          {/* ================= นัดนิเทศ ================= */}
          <section className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: '#1e293b' }}>🚗 กำหนดการนิเทศของฉัน</div>
              <Link to="/teacher/review-supervision" style={{ color: IOS_BLUE, fontWeight: 800, textDecoration: "none", fontSize: 14 }}>
                จัดการนัดนิเทศ →
              </Link>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="responsive-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    {["รหัสนักศึกษา", "ชื่อนักศึกษา", "สถานที่ / รูปแบบ", "วันเวลานิเทศ", "สถานะ"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "12px 8px", fontSize: 13, color: "#64748b", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {supervisions.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 30, color: "#94a3b8", textAlign: "center" }}>— ไม่มีคิวนัดนิเทศ —</td></tr>
                  ) : (
                    supervisions.slice(0, 5).map((sup) => (
                      <tr key={sup.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                        <td style={td()} data-label="รหัสนักศึกษา">{sup.student.studentId}</td>
                        <td style={td()} data-label="ชื่อนักศึกษา">{`${sup.student.firstName} ${sup.student.lastName}`}</td>
                        <td style={td()} data-label="สถานที่ / รูปแบบ">
                          <div style={{ fontWeight: 600, color: sup.supervisionType === 'ONLINE' ? '#0284c7' : '#059669' }}>
                            {sup.supervisionType === 'ONLINE' ? '🌐 ออนไลน์' : '🏢 ออนไซต์'}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                            {sup.student.coop?.company?.name || "-"}
                          </div>
                        </td>
                        <td style={td()} data-label="วันเวลานิเทศ"><b>{formatDateTime(sup.confirmedDate)}</b></td>
                        <td style={td()} data-label="สถานะ">{chip(sup.status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ================= ตารางคำร้อง (รอพิจารณา & ผ่านแล้ว) ================= */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 20 }}>

            {/* กล่องรอพิจารณา */}
            <section className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontWeight: 900, color: '#d97706' }}>⏳ คำร้องล่าสุด (รอพิจารณา)</div>
                <Link to="/teacher/requests" style={{ color: IOS_BLUE, fontWeight: 700, textDecoration: "none", fontSize: 13 }}>ดูทั้งหมด</Link>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {pendingStudents.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>— ไม่มีคำร้องที่รอพิจารณา —</td></tr>
                  ) : (
                    pendingStudents.map((s) => (
                      <tr key={s.studentId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={td()}>{s.studentId}</td>
                        <td style={td()}>{`${s.firstName} ${s.lastName}`}</td>
                        <td style={td({ textAlign: 'right' })}>{chip(s.coop?.status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            {/* กล่องผ่านคุณสมบัติ */}
            <section className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontWeight: 900, color: '#16a34a' }}>✅ ผ่านคุณสมบัติล่าสุด</div>
                <Link to="/teacher/requests" style={{ color: IOS_BLUE, fontWeight: 700, textDecoration: "none", fontSize: 13 }}>ดูทั้งหมด</Link>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {approvedStudents.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>— ยังไม่มีนักศึกษาที่ผ่านคุณสมบัติ —</td></tr>
                  ) : (
                    approvedStudents.map((s) => (
                      <tr key={s.studentId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={td()}>{s.studentId}</td>
                        <td style={td()}>{`${s.firstName} ${s.lastName}`}</td>
                        <td style={td({ textAlign: 'right' })}>{chip('approved')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

          </div>
        </>
      )}
    </div>
  );
}

/* ===============================
    Sub components
=============================== */
function CardStat({ title, value, hint, color }: { title: string; value: number; hint: string; color: string; }) {
  return (
    <div className="card" style={{ padding: 22, borderBottom: `4px solid ${color}` }}>
      <div style={{ color: "#64748b", fontWeight: 700, fontSize: 13 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 32, fontWeight: 900, color: '#1e293b' }}>{value.toLocaleString()}</div>
      <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 12 }}>{hint}</div>
    </div>
  );
}

function td(customStyle?: React.CSSProperties): React.CSSProperties {
  return { padding: "14px 8px", fontSize: 14, color: "#334155", ...customStyle };
}

function actionChip(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 16px", borderRadius: 10,
    background: color, color: "#fff",
    fontWeight: 700, fontSize: 14,
    textDecoration: "none", transition: ".15s",
    boxShadow: `0 4px 12px ${color}40`,
  };
}