import { useEffect, useMemo, useState } from "react";
import { IcAnnounce, IcDocs } from "./icons";
import {
  loadAnnouncements,
  loadDocPeriods,
  loadAcademicYear,
  loadStudents,
} from "./store";
import type { Announcement, DocPeriod, StudentProfile } from "./store";

/* ===============================
   Exam (นิเทศ)
=============================== */
type ExamItem = {
  id: string;
  studentId: string;
  round?: string;
  date: string;
  time?: string;
  location?: string;
  note?: string;
};

const K_EXAMS = "coop.teacher.exams.v1";

/* ===============================
   Document Name Mapping
=============================== */
const DOC_LABEL: Record<string, string> = {
  T001: "แบบฟอร์มคำร้องสหกิจ",
  T002: "หนังสือข้อตกลงบริษัท",
  W001: "ตารางการปฏิบัติงาน",
};

/* ===============================
   Helper
=============================== */
function buildDate(date?: string, time?: string): Date | null {
  if (!date) return null;
  return new Date(`${date}T${time || "00:00"}:00+07:00`);
}

/* ===============================
   Component
=============================== */
export default function S_Dashboard() {
  const [ann, setAnn] = useState<Announcement[]>([]);
  const [docs, setDocs] = useState<Record<string, DocPeriod>>({});

  const adminYear = loadAcademicYear();
  console.debug("Academic year:", adminYear);

  /** mock login: นักศึกษาคนปัจจุบัน */
  const student: StudentProfile | undefined = loadStudents()[0];
  const coopStatus = student?.coopRequest?.status;
  const canSubmit = coopStatus !== "approved";

  useEffect(() => {
    setAnn(loadAnnouncements());
    setDocs(loadDocPeriods());
  }, []);

  /* ===============================
     Announcements
  =============================== */
  const upcomingAnnouncements = useMemo<Announcement[]>(() => {
    return [...ann];
  }, [ann]);

  /* ===============================
     Active Docs
  =============================== */
  const activeDocs = useMemo(() => {
    const now = new Date();
    return Object.entries(docs)
      .map(([id, p]) => {
        const start = buildDate(p.startDate, p.startTime);
        const end = buildDate(p.endDate, p.endTime);
        if (!start || !end) return null;
        if (start <= now && now <= end) {
          return { id, start, end };
        }
        return null;
      })
      .filter((v): v is { id: string; start: Date; end: Date } => v !== null);
  }, [docs]);

  /* ===============================
     My Exams (นิเทศของนักศึกษา)
  =============================== */
  const myExams = useMemo<ExamItem[]>(() => {
    if (!student?.studentId) return [];

    try {
      const all: ExamItem[] = JSON.parse(localStorage.getItem(K_EXAMS) || "[]");

      return all
        .filter((x) => x.studentId === student.studentId)
        .sort((a, b) =>
          `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`)
        )
        .slice(0, 3);
    } catch {
      return [];
    }
  }, [student?.studentId]);

  return (
    <div className="dashboard-wrapper">
      <style>{DASHBOARD_CSS}</style>

      {/* HEADER */}
      <div className="dashboard-header">
        <h1>ภาพรวมสำหรับนักศึกษา</h1>
        <p>ติดตามประกาศ เอกสาร และนัดนิเทศในที่เดียว</p>
      </div>

      {/* GRID */}
      <div className="dash-grid">
        {/* ================= ANNOUNCEMENTS ================= */}
        <div className="dash-card">
          <div className="dash-title">
            <IcAnnounce className="dash-icon" />
            ประกาศ
          </div>

          <div className="dash-content">
            {upcomingAnnouncements.length === 0 && (
              <div className="dash-empty">ไม่มีประกาศในช่วงนี้</div>
            )}

            {upcomingAnnouncements.map((a) => (
              <div key={a.id} className="dash-item dash-left-info">
                <div className="dash-item-title">{a.title}</div>
                {"body" in a && a.body && (
                  <div className="dash-item-sub">{a.body}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ================= DOC PERIOD ================= */}
        <div className="dash-card">
          <div className="dash-title">
            <IcDocs className="dash-icon" />
            เอกสารที่ต้องส่ง
          </div>

          <div className="dash-content">
            {activeDocs.length === 0 && (
              <div className="dash-empty">ยังไม่มีเอกสารที่เปิดให้ส่ง</div>
            )}

            {activeDocs.map((d) => (
              <div key={d.id} className="dash-item dash-left-doc">
                <div className="dash-item-title">
                  เอกสาร {d.id} — {DOC_LABEL[d.id]}
                </div>
                <div className="dash-item-sub">
                  {d.start.toLocaleString("th-TH")} –{" "}
                  {d.end.toLocaleString("th-TH")}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ================= MY EXAMS ================= */}
        <div className="dash-card">
          <div className="dash-title">นัดนิเทศของฉัน</div>

          <div className="dash-content">
            {myExams.length === 0 && (
              <div className="dash-empty">ยังไม่มีนัดนิเทศ</div>
            )}

            {myExams.map((x) => (
              <div key={x.id} className="dash-item dash-left-final">
                <div className="dash-item-title">รอบที่ {x.round || "-"}</div>
                <div className="dash-item-sub">
                  {new Date(`${x.date}T${x.time || "00:00"}`).toLocaleString(
                    "th-TH"
                  )}
                </div>
                <div style={{ marginTop: 4, fontSize: 14 }}>
                  📍 {x.location || "-"}
                </div>
                {x.note && (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: "#374151",
                    }}
                  >
                    {x.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SUBMIT BUTTON */}
      {canSubmit && (
        <div className="dash-btn-wrapper">
          <a href="/student/gateway" className="dash-btn">
            ยื่นคำร้องเข้าร่วมโครงการ
          </a>
        </div>
      )}
    </div>
  );
}

/* ===============================
   CSS
=============================== */
const DASHBOARD_CSS = `
.dashboard-wrapper {
  width: 95%;
  padding: 20px 10px;
  margin-left: 45px;
}
.dashboard-header h1 {
  font-size: 28px;
  font-weight: 800;
}
.dashboard-header p {
  color: #6b7280;
}
.dash-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 26px;
  margin-top: 24px;
}
.dash-card {
  background: white;
  border-radius: 18px;
  padding: 24px;
  border: 1px solid #e7ecf5;
  box-shadow: 0 8px 22px rgba(0,0,0,.06);
}
.dash-title {
  display: flex;
  gap: 10px;
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 18px;
}
.dash-icon {
  width: 20px;
  height: 20px;
  color: #0a84ff;
}
.dash-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 260px;
}
.dash-empty {
  color: #a0a9b6;
  text-align: center;
  padding-top: 30px;
}
.dash-item {
  background: #f9fbff;
  border: 1px solid #e6ecf5;
  border-radius: 14px;
  padding: 14px 18px;
}
.dash-item-title {
  font-weight: 600;
}
.dash-item-sub {
  font-size: 13px;
  color: #6b7280;
}
.dash-left-info { border-left: 4px solid #3b82f6; }
.dash-left-doc { border-left: 4px solid #0ea5e9; }
.dash-left-final { border-left: 4px solid #ef4444; }
.dash-btn-wrapper { margin-top: 28px; }
.dash-btn {
  padding: 12px 26px;
  border-radius: 999px;
  background: linear-gradient(90deg,#0074B7,#0A84FF,#22D3EE);
  color: white;
  font-weight: 700;
}
`;
