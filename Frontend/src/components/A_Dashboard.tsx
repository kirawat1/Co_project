/* eslint-disable react-refresh/only-export-components */

import {
  loadStudents,
  loadAnnouncements,
  loadDaily,
} from "./store";

import {
  IcUsers,
  IcDocs,
  IcAnnounce,
  IcCalendar,
} from "./icons";

export default function A_Dashboard() {
  const students = loadStudents();
  const announcements = loadAnnouncements();
  const dailyLogs = loadDaily();

  /* =========================
     Section 1: ภาพรวม (การ์ดไอคอน)
  ========================= */

  const totalStudents = students.length;

  const submittedStudents = students.filter(
    (s) => s.coopRequest?.status === "submitted"
  ).length;

  const totalAnnouncements = announcements.length;
  const totalDailyLogs = dailyLogs.length;

  /* =========================
     Section 2: สถานะโครงการสหกิจ
  ========================= */

  const waiting = submittedStudents;

  const approved = students.filter(
    (s) => s.coopRequest?.status === "approved"
  ).length;

  const rejected = students.filter(
    (s) => s.coopRequest?.status === "rejected"
  ).length;

  // ❗ store.ts ยังไม่มี specialRequestedAt
  // ใช้ค่า 0 ไปก่อน เพื่อให้ compile ผ่าน
  const specialRequests = 0;

  return (
    <div className="page" style={{ padding: 28, marginLeft: 35 }}>
      {/* =========================
          SECTION 1: ภาพรวม
      ========================= */}
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>
          ภาพรวม
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 20,
          }}
        >
          <IconCard
            icon={<IcUsers />}
            title="จำนวนนักศึกษา"
            value={totalStudents}
          />

          <IconCard
            icon={<IcDocs />}
            title="จำนวนนักศึกษาที่ยื่น"
            value={submittedStudents}
          />

          <IconCard
            icon={<IcAnnounce />}
            title="ประกาศ"
            value={totalAnnouncements}
          />

          <IconCard
            icon={<IcCalendar />}
            title="บันทึกนักศึกษา (รายงาน)"
            value={totalDailyLogs}
          />
        </div>
      </section>

      {/* =========================
          SECTION 2: ภาพรวมโครงการสหกิจศึกษา
      ========================= */}
      <section>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 800,
            marginBottom: 16,
          }}
        >
          ภาพรวมโครงการสหกิจศึกษา
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 20,
            marginBottom: 20,
          }}
        >
          <SummaryCard title="นักศึกษาทั้งหมด" value={totalStudents} />
          <SummaryCard title="รอพิจารณา" value={waiting} />
          <SummaryCard title="อนุมัติแล้ว" value={approved} />
          <SummaryCard title="ไม่ผ่าน" value={rejected} />
        </div>

        <div
          className="card"
          style={{
            padding: 20,
            background: "#fff7ed",
          }}
        >
          <div style={{ color: "#92400e", fontWeight: 700 }}>
            คำขอพิจารณาเป็นกรณีพิเศษ
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: "#9a3412",
              marginTop: 6,
            }}
          >
            {specialRequests}
          </div>
        </div>
      </section>
    </div>
  );
}

/* =========================
   Components
========================= */

function IconCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
}) {
  return (
    <div
      className="card"
      style={{
        padding: 20,
        borderRadius: 18,
        boxShadow: "0 10px 25px rgba(0,0,0,.08)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "#e0f2fe",
          color: "#0284c7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        {icon}
      </div>

      <div style={{ color: "#6b7280", fontSize: 14 }}>
        {title}
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          marginTop: 6,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div
      className="card"
      style={{
        padding: 20,
        borderRadius: 18,
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 14 }}>
        {title}
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 800,
          marginTop: 8,
        }}
      >
        {value}
      </div>
    </div>
  );
}
