import React, { useState, useEffect } from "react";
import axios from "axios";
import { IcUsers, IcDocs, IcAnnounce, IcCalendar } from "./icons";

// --- Types ---
interface DashboardStats {
  totalStudents: number;
  submittedStudents: number;
  totalAnnouncements: number;
  totalDailyLogs: number;
  waiting: number;
  approved: number;
  rejected: number;
  specialRequests: number;
}

interface CoopPeriod {
  id: number;
  semester: string | number;
  academicYear: string;
  isActive: boolean;
}

export default function A_Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    submittedStudents: 0,
    totalAnnouncements: 0,
    totalDailyLogs: 0,
    waiting: 0,
    approved: 0,
    rejected: 0,
    specialRequests: 0,
  });

  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<CoopPeriod[]>([]);
  // selectedPeriod เก็บเป็น "semester/year" หรือ "all"
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");

  const token = localStorage.getItem("coop.token");

  /* ==========================================
      1. ดึงรอบปีการศึกษาทั้งหมด และตั้งค่าเริ่มต้น
     ========================================== */
  const fetchPeriods = async () => {
    try {
      const res = await axios.get("/api/admin/coop-periods", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.ok) {
        const periodList: CoopPeriod[] = res.data.periods;
        setPeriods(periodList);

        // 🟢 หาตัวที่ isActive เพื่อเป็นค่าเริ่มต้น
        const active = periodList.find(p => p.isActive);
        if (active) {
          setSelectedPeriod(`${active.semester}/${active.academicYear}`);
        } else {
          setSelectedPeriod("all");
        }
      }
    } catch (err) {
      console.error("Failed to fetch periods", err);
    }
  };

  /* ==========================================
      2. ดึงสถิติ Dashboard ตามเทอม/ปีที่เลือก
     ========================================== */
  const fetchStats = async (periodKey: string) => {
    if (!periodKey) return;
    setLoading(true);
    try {
      // แยก semester และ year ออกจาก string "1/2569"
      let url = "/api/admin/dashboard-stats";
      if (periodKey !== "all") {
        const [semester, year] = periodKey.split("/");
        url += `?semester=${semester}&year=${year}`;
      }

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.ok) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
    } finally {
      setLoading(false);
    }
  };

  /* ==========================================
      3. ส่งออกข้อมูลนักศึกษาเป็นไฟล์ Excel
     ========================================== */
  const handleExport = async () => {
    try {
      let coopPeriodId: string = "all";
      if (selectedPeriod !== "all") {
        const match = periods.find(p => `${p.semester}/${p.academicYear}` === selectedPeriod);
        if (match) coopPeriodId = String(match.id);
      }

      const res = await axios.get(`/api/admin/students/export?coopPeriodId=${coopPeriodId}`, {
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

  // ทำงานครั้งแรกเพื่อโหลดเทอม
  useEffect(() => {
    fetchPeriods();
  }, []);

  // เมื่อเปลี่ยนตัวกรอง ให้โหลดสถิติใหม่
  useEffect(() => {
    if (selectedPeriod) fetchStats(selectedPeriod);
  }, [selectedPeriod]);

  return (
    <div className="page" style={{ padding: 28, marginLeft: 35 }}>
      {/* =========================
          HEADER & FILTER
      ========================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: '#1e293b' }}>
            Dashboard
          </h1>
          <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>สรุปภาพรวมและสถิติของโครงการสหกิจศึกษา</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', padding: '8px 16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <label style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>📍 รอบปีการศึกษา:</label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontWeight: 600,
              color: '#0f172a',
              outline: 'none',
              cursor: 'pointer',
              backgroundColor: '#f8fafc'
            }}
          >
            <option value="all">📚 แสดงทั้งหมด (All Time)</option>
            {periods.map(p => {
              const val = `${p.semester}/${p.academicYear}`;
              return (
                <option key={p.id} value={val}>
                  เทอม {val} {p.isActive ? "⭐ (รอบปัจจุบัน)" : ""}
                </option>
              );
            })}
          </select>
          <button
            onClick={handleExport}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
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

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
          กำลังสรุปข้อมูลสถิติ...
        </div>
      ) : (
        <>
          {/* =========================
              SECTION 1: ภาพรวมตัวเลขสำคัญ
          ========================= */}
          <section className="card" style={{ padding: 24, marginBottom: 28, border: '1px solid #f1f5f9' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              📊 ภาพรวมระบบ {selectedPeriod !== 'all' ? `ประจำเทอม ${selectedPeriod}` : '(ทั้งหมดทุกรอบ)'}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
              <IconCard icon={<IcUsers />} title="นักศึกษาในระบบ" value={stats.totalStudents} color="#0284c7" bgColor="#e0f2fe" />
              <IconCard icon={<IcDocs />} title="ยื่นสหกิจแล้ว" value={stats.submittedStudents} color="#10b981" bgColor="#dcfce7" />
              <IconCard icon={<IcAnnounce />} title="ข่าวประกาศ" value={stats.totalAnnouncements} color="#f59e0b" bgColor="#fef3c7" />
              <IconCard icon={<IcCalendar />} title="บันทึกรายงาน" value={stats.totalDailyLogs} color="#6366f1" bgColor="#e0e7ff" />
            </div>
          </section>

          {/* =========================
              SECTION 2: สถานะการยื่นคำร้อง
          ========================= */}
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
              📝 สถานะการพิจารณาคำร้อง
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 20 }}>
              <SummaryCard title="รอดำเนินการ (Waiting)" value={stats.waiting} color="#ca8a04" subText="ต้องเข้าตรวจสอบ" />
              <SummaryCard title="อนุมัติผ่านแล้ว (Approved)" value={stats.approved} color="#16a34a" subText="ผ่านคุณสมบัติ" />
              <SummaryCard title="ไม่ผ่าน/แก้ไข (Rejected)" value={stats.rejected} color="#dc2626" subText="รอการแก้ไขจาก นศ." />

              <div className="card" style={{ padding: 20, background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)", borderRadius: 18, border: '1px solid #fed7aa' }}>
                <div style={{ color: "#9a3412", fontWeight: 700, fontSize: 14 }}>🎯 คำขอพิจารณากรณีพิเศษ</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: "#9a3412", marginTop: 8 }}>
                  {stats.specialRequests}
                </div>
                <div style={{ fontSize: 12, color: "#c2410c", marginTop: 4 }}>สิทธิ์เข้าเรียนเตรียมความพร้อม</div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/* =========================
    Components 
========================= */

function IconCard({ icon, title, value, color, bgColor }: { icon: React.ReactNode; title: string; value: number; color: string; bgColor: string; }) {
  return (
    <div className="card" style={{ padding: 24, borderRadius: 20, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)", border: '1px solid #f1f5f9', backgroundColor: '#fff' }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: bgColor, color: color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        {React.cloneElement(icon as React.ReactElement<{ size: number }>, { size: 24 })}
      </div>
      <div style={{ color: "#64748b", fontSize: 14, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 800, marginTop: 4, color: '#0f172a' }}>{value.toLocaleString()}</div>
    </div>
  );
}

function SummaryCard({ title, value, color, subText }: { title: string; value: number; color: string; subText: string }) {
  return (
    <div className="card" style={{ padding: 20, borderRadius: 18, border: '1px solid #f1f5f9', backgroundColor: '#fff' }}>
      <div style={{ color: "#64748b", fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: color }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{subText}</div>
    </div>
  );
}