import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/apiFetch";
import { IcUsers, IcDocs, IcAnnounce } from "./icons";
import { LoadingBlock } from "./Spinner";
import { notify } from "../utils/notify";
import { defaultPeriod } from "../utils/defaultPeriod";
import PendingWorkPanel, { type PendingItem } from "./PendingWorkPanel";

// งานที่รอบนหน้าจัดการ — เมนูที่ผู้ใช้ไม่มี (อาจารย์ประจำวิชา: หนังสือนิเทศ/เรื่องที่ผู้ใช้แจ้ง) backend ไม่ส่งมา จึงไม่แสดง
const ADMIN_PENDING: PendingItem[] = [
  { key: "coopApplications", label: "คำร้องรอตรวจคุณสมบัติ", to: "/admin/coop-applications" },
  { key: "t000", label: "T000 รอตรวจ / รอออกหนังสือ", to: "/admin/doct000" },
  { key: "t002", label: "T002 รอตรวจ", to: "/admin/doct002" },
  { key: "t003", label: "T003 รอตรวจ", to: "/admin/doct003" },
  { key: "supervisionManager", label: "หนังสือขอนิเทศรอออก", to: "/admin/supervision-manager" },
  { key: "feedback", label: "เรื่องที่ผู้ใช้แจ้งใหม่", to: "/admin/feedback" },
];

// --- Types ---
interface DashboardStats {
  totalStudents: number;
  submittedStudents: number;
  totalAnnouncements: number;
  waiting: number;
  approved: number;
  rejected: number;
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
    waiting: 0,
    approved: 0,
    rejected: 0,
  });

  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<CoopPeriod[]>([]);
  // selectedPeriod เก็บเป็น "semester/year" หรือ "all"
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");

  /* ==========================================
      1. ดึงรอบปีการศึกษาทั้งหมด และตั้งค่าเริ่มต้น
     ========================================== */
  const fetchPeriods = async () => {
    try {
      const res = await apiFetch("/api/admin/coop-periods");
      if (res.ok) {
        const data = await res.json();
        const periodList: CoopPeriod[] = data.periods;
        setPeriods(periodList);

        // รอบที่เปิดอยู่ (ไม่มีรอบเปิด = รอบใหม่สุด) — utils/defaultPeriod
        const active = defaultPeriod(periodList);
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

      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setStats(data.data);
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

      const res = await apiFetch(`/api/admin/students/export?coopPeriodId=${coopPeriodId}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `students_${coopPeriodId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
      notify.error("ดาวน์โหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่");
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
    <div className="page" style={{ padding: 'clamp(4px, 3vw, 28px)', marginLeft: 'clamp(0px, 3vw, 35px)' }}>
      {/* =========================
          HEADER & FILTER
      ========================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: '#1e293b' }}>
            Dashboard
          </h1>
          <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>สรุปภาพรวมและสถิติของโครงการสหกิจศึกษา</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, minWidth: 0, maxWidth: '100%', background: '#fff', padding: '8px 16px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
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
              backgroundColor: '#f8fafc',
              minWidth: 0,
              maxWidth: '100%'
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
          <button className="btn-success" onClick={handleExport}>
            📊 Export Excel
          </button>
        </div>
      </div>

      <PendingWorkPanel items={ADMIN_PENDING} />

      {loading ? (
        <LoadingBlock text="กำลังสรุปข้อมูลสถิติ…" style={{ padding: '40px 0' }} />
      ) : (
        <>
          {/* =========================
              SECTION 1: ภาพรวมตัวเลขสำคัญ
          ========================= */}
          <section className="card" style={{ padding: 24, marginBottom: 28, border: '1px solid #f1f5f9' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              📊 ภาพรวมระบบ {selectedPeriod !== 'all' ? `ประจำเทอม ${selectedPeriod}` : '(ทั้งหมดทุกรอบ)'}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 20 }}>
              <IconCard icon={<IcUsers />} title="นักศึกษาในระบบ" value={stats.totalStudents} color="#0284c7" bgColor="#e0f2fe" />
              <IconCard icon={<IcDocs />} title="ยื่นสหกิจแล้ว" value={stats.submittedStudents} color="#10b981" bgColor="#dcfce7" />
              <IconCard icon={<IcAnnounce />} title="ข่าวประกาศ" value={stats.totalAnnouncements} color="#f59e0b" bgColor="#fef3c7" />
            </div>
          </section>

          {/* =========================
              SECTION 2: สถานะการยื่นคำร้อง
          ========================= */}
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
              📝 สถานะการพิจารณาคำร้อง
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 20, marginBottom: 20 }}>
              <SummaryCard title="รอดำเนินการ (Waiting)" value={stats.waiting} color="#ca8a04" subText="ต้องเข้าตรวจสอบ" />
              <SummaryCard title="อนุมัติผ่านแล้ว (Approved)" value={stats.approved} color="#16a34a" subText="ผ่านคุณสมบัติ" />
              <SummaryCard title="ไม่ผ่าน/แก้ไข (Rejected)" value={stats.rejected} color="#dc2626" subText="รอการแก้ไขจาก นศ." />
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
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{subText}</div>
    </div>
  );
}