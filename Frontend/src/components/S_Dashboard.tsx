import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { IcAnnounce, IcDocs } from "./icons";
import StatusBadge from "./StatusBadge";

/* ===============================
    Types
=============================== */
interface Announcement {
  id: number;
  title: string;
  body: string;
  date: string;
  year: string;
  attachments?: any[];
}

interface SupervisionAppt {
  id: number;
  confirmedDate: string | null;
  supervisionType: string;
  status: string;
  coTeacherName?: string;
  teacher?: {
    prefix: string;
    firstName: string;
    lastName: string;
  };
}

interface SystemConfig {
  startDate: string;
  endDate: string;
  isOpen: boolean;
}

/* ===============================
    Document Name Mapping
=============================== */
const DOC_LABEL: Record<string, string> = {
  t000: "แบบขออนุมัติไปปฏิบัติงานสหกิจ (T000)",
  t002: "แบบแจ้งรายละเอียดงานและที่พัก (T002)",
  t003: "โครงร่างรายงานและแผนปฏิบัติงาน (T003)",
};

export default function S_Dashboard() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [supervisions, setSupervisions] = useState<SupervisionAppt | null>(null);
  const [configs, setConfigs] = useState<Record<string, SystemConfig>>({});
  const [studentStatus, setStudentStatus] = useState<string>("NOT_SUBMITTED");
  const [studentMajor, setStudentMajor] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);
  const token = localStorage.getItem("coop.token");

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Profile first (to get major for announcement filtering)
      const profileRes = await axios.get("/api/students/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const major = profileRes.data?.major || "";
      setStudentStatus(profileRes.data?.coop?.status || "NOT_SUBMITTED");
      setStudentMajor(major);

      // 2. Announcements filtered by major
      const majorParam = major ? `?major=${encodeURIComponent(major)}` : "";
      const annRes = await axios.get(`/api/announcements${majorParam}`);
      if (annRes.data?.ok && Array.isArray(annRes.data.list)) {
        setAnnouncements(annRes.data.list);
      } else {
        setAnnouncements([]);
      }

      // 3. ดึงข้อมูลนัดนิเทศของนักศึกษา
      const supRes = await axios.get("/api/coop/supervision/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (supRes.data?.appointment) setSupervisions(supRes.data.appointment);

      // 4. ดึง Config วันที่เปิด-ปิดของแต่ละฟอร์ม (T000, T002, T003)
      const configKeys = ['t000', 't002', 't003'];
      const configData: Record<string, SystemConfig> = {};

      for (const key of configKeys) {
        try {
          const res = await axios.get(`/api/admin/config/${key}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          configData[key] = res.data;
        } catch (e) { console.error(`Error loading config for ${key}`); }
      }
      setConfigs(configData);

    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* ===============================
      Check Active Docs
  =============================== */
  const activeDocs = useMemo(() => {
    const now = new Date();
    return Object.entries(configs)
      .map(([id, cfg]) => {
        if (!cfg.isOpen || !cfg.startDate || !cfg.endDate) return null;
        const start = new Date(cfg.startDate);
        const end = new Date(cfg.endDate);
        // เช็คว่าอยู่ในช่วงเวลาหรือไม่
        if (now >= start && now <= end) {
          return { id, start, end };
        }
        return null;
      })
      .filter((v): v is { id: string; start: Date; end: Date } => v !== null);
  }, [configs]);

  // Countdown สำหรับ deadline ที่ใกล้ที่สุด
  const nearestDeadline = useMemo(() => {
    if (activeDocs.length === 0) return null;
    return activeDocs.reduce((a, b) => (a.end < b.end ? a : b));
  }, [activeDocs]);

  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!nearestDeadline) return;
    const update = () => {
      const diff = nearestDeadline.end.getTime() - Date.now();
      if (diff <= 0) { setCountdown("หมดเวลาแล้ว"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(d > 0 ? `${d} วัน ${h} ชม.` : `${h} ชม. ${m} นาที`);
    };
    update();
    const iv = setInterval(update, 60000);
    return () => clearInterval(iv);
  }, [nearestDeadline]);

  // ข้อความแนะนำตามสถานะ
  const STATUS_HINT: Record<string, { icon: string; hint: string; link?: string; linkText?: string }> = {
    NOT_SUBMITTED:   { icon: "📋", hint: "ยังไม่ได้ยื่นคำร้องสหกิจ กรุณากรอกข้อมูลและส่งคำร้อง", link: "/student/gateway", linkText: "ยื่นคำร้องเลย" },
    APPLYING:        { icon: "⏳", hint: "คำร้องอยู่ระหว่างการตรวจสอบคุณสมบัติ กรุณารอ" },
    QUALIFICATION_FAILED: { icon: "❌", hint: "ไม่ผ่านเกณฑ์คุณสมบัติ กรุณาติดต่อเจ้าหน้าที่" },
    APPLICATION_EDITS_REQUIRED: { icon: "📝", hint: "ต้องแก้ไขคำร้อง กรุณาดูความคิดเห็นและแก้ไข", link: "/student/gateway", linkText: "แก้ไขคำร้อง" },
    QUALIFIED:       { icon: "✅", hint: "ผ่านคุณสมบัติแล้ว กรุณาอัปโหลดเอกสาร T000", link: "/student/docs", linkText: "ไปหน้าเอกสาร" },
    WAITING_FOR_STAFF_CHECK: { icon: "🔍", hint: "เอกสารส่งแล้ว กำลังรอเจ้าหน้าที่ตรวจสอบ" },
    EDITS_REQUIRED:  { icon: "⚠️", hint: "ต้องแก้ไขเอกสาร T000 กรุณาดูความคิดเห็น", link: "/student/docs", linkText: "แก้ไขเอกสาร" },
    DOCS_APPROVED:   { icon: "✨", hint: "เอกสารผ่านแล้ว รอเจ้าหน้าที่ออกหนังสือขอความอนุเคราะห์" },
    REQ_LETTER_ISSUED: { icon: "🚚", hint: "ออกหนังสือแล้ว รอบริษัทตอบรับและส่งหนังสือตอบกลับ" },
    WAITING_FOR_PLACEMENT_LETTER: { icon: "🏢", hint: "รอบริษัทส่งหนังสือตอบรับ", link: "/student/docs", linkText: "อัปโหลดหนังสือตอบรับ" },
    WAITING_FOR_STAFF_CHECK_LETTER: { icon: "🕵️", hint: "หนังสือตอบรับอยู่ระหว่างการตรวจสอบ" },
    ACCEPTANCE_CHECKED: { icon: "🚀", hint: "ผ่านแล้ว รอเจ้าหน้าที่ออกหนังสือส่งตัว" },
    PLACEMENT_LETTER_ISSUED: { icon: "🏁", hint: "ออกหนังสือส่งตัวแล้ว ขอให้โชคดีในการฝึกงาน!" },
    INTERNSHIP_STARTED: { icon: "💼", hint: "กำลังฝึกสหกิจ อย่าลืมส่งเอกสาร T002 และ T003", link: "/student/docs-t002", linkText: "ไปส่ง T002" },
    T002_SUBMITTED:  { icon: "📄", hint: "ส่ง T002 แล้ว รออาจารย์ตรวจสอบ" },
    T002_EDITS_REQUIRED: { icon: "⚠️", hint: "ต้องแก้ไข T002", link: "/student/docs-t002", linkText: "แก้ไข T002" },
    T003_SUBMITTED:  { icon: "📘", hint: "ส่ง T003 แล้ว รออาจารย์ตรวจสอบ" },
    T003_EDITS_REQUIRED: { icon: "⚠️", hint: "ต้องแก้ไข T003", link: "/student/docs-t003", linkText: "แก้ไข T003" },
    PENDING_TEACHER: { icon: "⏳", hint: "รออาจารย์เลือกวันนิเทศ", link: "/student/supervision", linkText: "ดูสถานะนิเทศ" },
    DATE_CONFIRMED:  { icon: "🔍", hint: "รอเจ้าหน้าที่อนุมัติหนังสือนิเทศ" },
    LETTER_UPLOADED: { icon: "✅", hint: "อนุมัติหนังสือนิเทศแล้ว เตรียมพบอาจารย์ตามนัด", link: "/student/supervision", linkText: "ดูวันนิเทศ" },
    COMPLETED:       { icon: "🎉", hint: "นิเทศเสร็จสิ้น ขอแสดงความยินดี!" },
  };
  const hint = STATUS_HINT[studentStatus] ?? { icon: "📋", hint: "ดำเนินการตามขั้นตอนที่กำหนด" };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>กำลังโหลดข้อมูลภาพรวม...</div>;

  return (
    <div className="dashboard-wrapper">
      <style>{DASHBOARD_CSS}</style>

      {/* HEADER */}
      <div className="dashboard-header">
        <h1>ภาพรวมสำหรับนักศึกษา</h1>
        <p>ติดตามประกาศ เอกสาร และนัดนิเทศของสหกิจศึกษา</p>
      </div>

      {/* ===== STATUS CARD ===== */}
      <div className="status-banner">
        <div className="status-banner-left">
          <span className="status-banner-icon">{hint.icon}</span>
          <div>
            <div className="status-banner-label">สถานะปัจจุบัน</div>
            <StatusBadge status={studentStatus} hidePrefix />
            <div className="status-banner-hint">{hint.hint}</div>
          </div>
        </div>
        <div className="status-banner-right">
          {nearestDeadline && countdown && (
            <div className="countdown-box">
              <div className="countdown-label">ปิดรับ {DOC_LABEL[nearestDeadline.id] ?? nearestDeadline.id}</div>
              <div className="countdown-timer">⏱ {countdown}</div>
            </div>
          )}
          {hint.link && (
            <a href={hint.link} className="status-action-btn">{hint.linkText} →</a>
          )}
        </div>
      </div>

      {/* GRID */}
      <div className="dash-grid">
        {/* ================= ANNOUNCEMENTS ================= */}
        <div className="dash-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="dash-title">
              <IcAnnounce className="dash-icon" />
              ข่าวประกาศล่าสุด
            </div>
            <a href="/student/announcements" style={{ fontSize: 13, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
              ดูทั้งหมด →
            </a>
          </div>

          <div className="dash-content">
            {announcements.length === 0 ? (
              <div className="dash-empty">ไม่มีประกาศในขณะนี้</div>
            ) : (
              announcements.slice(0, 3).map((a) => (
                <div
                  key={a.id}
                  className="dash-item dash-left-info"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedAnn(a)} // 🟢 เมื่อคลิกให้เก็บค่าประกาศลง State
                >
                  <div className="dash-item-title">
                    {a.title}
                    {a.attachments && a.attachments.length > 0 && <span style={{ fontSize: 12, marginLeft: 8 }}>📎</span>}
                  </div>
                  <div className="dash-item-sub">
                    {a.date ? new Date(a.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : "-"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ================= DOC PERIOD (OPEN NOW) ================= */}
        <div className="dash-card">
          <div className="dash-title">
            <IcDocs className="dash-icon" />
            เอกสารที่เปิดรับส่ง
          </div>

          <div className="dash-content">
            {activeDocs.length === 0 ? (
              <div className="dash-empty">อยู่นอกช่วงเวลาส่งเอกสาร</div>
            ) : (
              activeDocs.map((d) => (
                <div key={d.id} className="dash-item dash-left-doc">
                  <div className="dash-item-title">{DOC_LABEL[d.id] || d.id}</div>
                  <div className="dash-item-sub">
                    ปิดรับวันที่ {d.end.toLocaleDateString("th-TH")}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ================= SUPERVISION ================= */}
        <div className="dash-card">
          <div className="dash-title">📅 นัดนิเทศของฉัน</div>

          <div className="dash-content">
            {!supervisions || supervisions.status === "PENDING_TEACHER" ? (
              <div className="dash-empty">ยังไม่มีกำหนดการนิเทศที่ยืนยัน</div>
            ) : (
              <div className="dash-item dash-left-final">
                <div className="dash-item-title">
                  {supervisions.supervisionType === "ONLINE" ? "🌐 ออนไลน์" : "🏢 ออนไซต์"}
                </div>
                <div className="dash-item-sub" style={{ fontSize: '15px', fontWeight: 'bold', color: '#0369a1' }}>
                  {supervisions.confirmedDate ?
                    new Date(supervisions.confirmedDate).toLocaleString("th-TH", { dateStyle: 'long', timeStyle: 'short' }) + " น."
                    : "รอการยืนยันเวลา"}
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: '#475569' }}>
                  <b>อาจารย์:</b> {supervisions.teacher?.firstName} {supervisions.teacher?.lastName}
                  {supervisions.coTeacherName && <><br /><b>อาจารย์ร่วม:</b> {supervisions.coTeacherName}</>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SUBMIT BUTTON (ซ่อนถ้าได้รับการอนุมัติแล้ว) */}
      <div className="dash-btn-wrapper">
        <a href="/student/gateway" className="dash-btn">
          ยื่นคำร้องเข้าร่วมโครงการ
        </a>
      </div>

      {/* ANNOUNCEMENT MODAL */}
      {/* 🟢 MODAL: รายละเอียดประกาศ */}
      {selectedAnn && (
        <div className="modal-overlay" onClick={() => setSelectedAnn(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>{selectedAnn.title}</h3>
              <button className="close-btn" onClick={() => setSelectedAnn(null)}>&times;</button>
            </div>

            <div className="modal-body">
              <div style={{ color: '#64748b', fontSize: 13, marginBottom: 15 }}>
                📅 ประกาศเมื่อ: {new Date(selectedAnn.date).toLocaleDateString('th-TH', { dateStyle: 'long' })}
              </div>

              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#334155', marginBottom: 24 }}>
                {selectedAnn.body || "ไม่มีรายละเอียดเพิ่มเติม"}
              </div>

              {/* แสดงไฟล์แนบและรูปภาพ */}
              {selectedAnn.attachments && selectedAnn.attachments.length > 0 && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
                  <h4 style={{ fontSize: 14, marginBottom: 12 }}>📎 ไฟล์แนบและรูปภาพ</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {selectedAnn.attachments.map((file, idx) => (
                      <div key={idx}>
                        {file.type === 'image' ? (
                          <div style={{ marginBottom: 10 }}>
                            <img src={file.url} alt={file.name} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #e2e8f0' }} />
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{file.name}</div>
                          </div>
                        ) : (
                          <a href={file.url} target="_blank" rel="noreferrer" className="attachment-link">
                            {file.type === 'link' ? '🔗' : '📄'} {file.name}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}



    </div> // ปิด dashboard-wrapper
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
  color: #1e293b;
}
.dashboard-header p {
  color: #64748b;
  margin-top: 4px;
}
.dash-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 26px;
  margin-top: 24px;
}
.dash-card {
  background: white;
  border-radius: 18px;
  padding: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 15px rgba(0,0,0,.05);
}
.dash-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 20px;
  color: #1e293b;
}
.dash-icon {
  width: 22px;
  height: 22px;
  color: #0ea5e9;
}
.dash-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 200px;
}
.dash-empty {
  color: #94a3b8;
  text-align: center;
  padding-top: 40px;
  font-size: 14px;
  background: #f8fafc;
  border-radius: 12px;
  height: 100px;
}
.dash-item {
  background: #ffffff;
  border: 1px solid #f1f5f9;
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  transition: transform 0.2s;
}
.dash-item:hover {
  transform: translateY(-2px);
}
.dash-item-title {
  font-weight: 700;
  color: #334155;
  font-size: 15px;
}
.dash-item-sub {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}
.dash-left-info { border-left: 5px solid #3b82f6; }
.dash-left-doc { border-left: 5px solid #0ea5e9; }
.dash-left-final { border-left: 5px solid #10b981; }

/* ===== STATUS BANNER ===== */
.status-banner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 16px; padding: 20px 24px; margin-bottom: 24px;
  border: 1px solid rgba(255,255,255,.08);
  box-shadow: 0 8px 24px rgba(0,0,0,.18);
}
.status-banner-left { display: flex; align-items: center; gap: 16px; }
.status-banner-icon { font-size: 36px; flex-shrink: 0; }
.status-banner-label { font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
.status-banner-hint { margin-top: 6px; font-size: 13px; color: #cbd5e1; line-height: 1.4; }
.status-banner-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.countdown-box { text-align: right; }
.countdown-label { font-size: 11px; color: #64748b; font-weight: 600; }
.countdown-timer { font-size: 20px; font-weight: 800; color: #f59e0b; font-variant-numeric: tabular-nums; }
.status-action-btn {
  display: inline-flex; align-items: center;
  padding: 10px 18px; border-radius: 10px;
  background: #0074B7; color: #fff;
  font-weight: 700; font-size: 14px; text-decoration: none;
  white-space: nowrap; transition: .15s;
}
.status-action-btn:hover { background: #005a9e; }

.dash-btn-wrapper { margin-top: 32px; }
.dash-btn {
  padding: 14px 32px;
  border-radius: 12px;
  background: #0ea5e9;
  color: white;
  font-weight: 700;
  text-decoration: none;
  display: inline-block;
  transition: 0.3s;
}
.dash-btn:hover {
  background: #0284c7;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
}

.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; backdrop-filter: blur(4px);
}
.modal-content {
  background: white;
  width: 90%; max-width: 650px;
  max-height: 85vh;
  border-radius: 20px;
  overflow: hidden;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
  animation: modalFadeIn 0.3s ease-out;
}
@keyframes modalFadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  display: flex; justify-content: space-between; align-items: center;
}
.close-btn {
  background: #f1f5f9; border: none; width: 32px; height: 32px;
  border-radius: 50%; font-size: 20px; cursor: pointer; color: #64748b;
}
.modal-body {
  padding: 24px;
  overflow-y: auto;
}
.attachment-link {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 16px; background: #f8fafc;
  border: 1px solid #e2e8f0; border-radius: 10px;
  text-decoration: none; color: #0ea5e9; font-weight: 600; font-size: 13px;
}
.attachment-link:hover { background: #f1f5f9; }
`;