import React, { useState, useEffect } from "react";
import axios from "axios";

import {
  IcUsers,
  IcDocs,
  IcAnnounce,
  IcCalendar,
} from "./icons";

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

  // State สำหรับ Filter
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  // 1. ดึงปีการศึกษาที่มีในระบบ (เพื่อทำ Dropdown)
  const fetchAvailableYears = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/coop-periods");
      if (res.data.ok) {
        // ดึงเฉพาะปีการศึกษาที่ไม่ซ้ำกัน
        const periods = res.data.periods;
        const uniqueYears = Array.from(new Set(periods.map((p: any) => p.academicYear))) as string[];
        setAvailableYears(uniqueYears.sort().reverse()); // เรียงปีล่าสุดขึ้นก่อน
      }
    } catch (err) {
      console.error("Failed to fetch periods", err);
    }
  };

  // 2. ดึงข้อมูล Dashboard ตามปีที่เลือก
  const fetchStats = async (year: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/admin/dashboard-stats?year=${year}`);
      if (res.data.ok) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
    } finally {
      setLoading(false);
    }
  };

  // ทำงานครั้งแรกเมื่อโหลดหน้าเว็บ
  useEffect(() => {
    fetchAvailableYears();
    fetchStats(selectedYear);
  }, []); // eslint-disable-line

  // ทำงานทุกครั้งที่เปลี่ยนปีการศึกษาใน Dropdown
  useEffect(() => {
    fetchStats(selectedYear);
  }, [selectedYear]);

  return (
    <div className="page" style={{ padding: 28, marginLeft: 35 }}>

      {/* =========================
          HEADER & FILTER
      ========================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: '#1e293b' }}>
          Dashboard
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', padding: '8px 16px', borderRadius: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <label style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>🔍 กรองข้อมูลปีการศึกษา:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontWeight: 600,
              color: '#0f172a',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">แสดงทั้งหมด</option>
            {availableYears.map(year => (
              <option key={year} value={year}>ปีการศึกษา {year}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div style={{ color: '#64748b', marginBottom: 20 }}>กำลังโหลดข้อมูล...</div>}

      {/* =========================
          SECTION 1: ภาพรวม
      ========================= */}
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>
          ภาพรวม {selectedYear !== 'all' ? `(ปีการศึกษา ${selectedYear})` : '(ทั้งหมด)'}
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          <IconCard icon={<IcUsers />} title="จำนวนนักศึกษา" value={stats.totalStudents} />
          <IconCard icon={<IcDocs />} title="จำนวนนักศึกษาที่ยื่น" value={stats.submittedStudents} />
          <IconCard icon={<IcAnnounce />} title="ประกาศ" value={stats.totalAnnouncements} />
          <IconCard icon={<IcCalendar />} title="บันทึกนักศึกษา (รายงาน)" value={stats.totalDailyLogs} />
        </div>
      </section>

      {/* =========================
          SECTION 2: ภาพรวมโครงการสหกิจศึกษา
      ========================= */}
      <section>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
          สถานะการยื่นคำร้อง
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 20 }}>
          <SummaryCard title="นักศึกษาทั้งหมด" value={stats.totalStudents} />
          <SummaryCard title="รอพิจารณา" value={stats.waiting} color="#ca8a04" />
          <SummaryCard title="อนุมัติ/ผ่านแล้ว" value={stats.approved} color="#16a34a" />
          <SummaryCard title="ไม่ผ่าน/ต้องแก้ไข" value={stats.rejected} color="#dc2626" />
        </div>

        <div className="card" style={{ padding: 20, background: "#fff7ed" }}>
          <div style={{ color: "#92400e", fontWeight: 700 }}>คำขอพิจารณาเป็นกรณีพิเศษ</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#9a3412", marginTop: 6 }}>
            {stats.specialRequests}
          </div>
        </div>
      </section>
    </div>
  );
}

/* =========================
   Components 
========================= */

function IconCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: number; }) {
  return (
    <div className="card" style={{ padding: 20, borderRadius: 18, boxShadow: "0 10px 25px rgba(0,0,0,.04)", border: '1px solid #f1f5f9' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: "#e0f2fe", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        {icon}
      </div>
      <div style={{ color: "#64748b", fontSize: 14, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4, color: '#0f172a' }}>{value}</div>
    </div>
  );
}

function SummaryCard({ title, value, color = "#0f172a" }: { title: string; value: number; color?: string }) {
  return (
    <div className="card" style={{ padding: 20, borderRadius: 18, border: '1px solid #f1f5f9' }}>
      <div style={{ color: "#64748b", fontSize: 14, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 800, marginTop: 8, color: color }}>{value}</div>
    </div>
  );
}