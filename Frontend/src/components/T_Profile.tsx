import React, { useEffect, useRef, useState } from "react";
import { IcUser, IcEdit, IcSave } from "./icons";

/* =========================
   Types & Enums
========================= */
export type TeacherProfile = {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  faculty?: string;
  major?: string; // ✅ เปลี่ยนเป็น string ธรรมดา เพื่อรองรับชื่อสาขาจาก Database
};

const EMPTY: TeacherProfile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  faculty: "",
  major: "",
};

// ✅ เก็บ Map ไว้เผื่อกรณีมีข้อมูลเก่า (Legacy) ที่เซฟเป็นชื่อย่อไปแล้ว จะได้แสดงผลสวยงาม
const MAJOR_MAP: Record<string, string> = {
  CS: "วิทยาการคอมพิวเตอร์",
  IT: "เทคโนโลยีสารสนเทศ",
  GIS: "ภูมิสารสนเทศศาสตร์"
};

export default function T_Profile() {
  const [profile, setProfile] = useState<TeacherProfile>({ ...EMPTY });
  const [form, setForm] = useState<TeacherProfile>({ ...EMPTY });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState("");

  // ✅ State สำหรับเก็บรายการสาขาวิชาจาก Database
  const [majorOptions, setMajorOptions] = useState<string[]>([]);

  const timerRef = useRef<number | null>(null);
  const token = localStorage.getItem("coop.token");

  // ---------- Fetch Data ----------
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/teacher/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile({
          ...data,
          major: data.major || data.department || ""
        });
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ ดึงข้อมูลสาขาวิชาจาก API (อิงจากตาราง CoopCriteria)
  const fetchMajors = async () => {
    try {
      const res = await fetch("/api/admin/majors", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.ok) {
        setMajorOptions(data.majors);
      }
    } catch (err) {
      console.error("Failed to load majors:", err);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchMajors(); // 🟢 เรียกฟังก์ชันดึงสาขาตอนโหลดหน้า
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, []);

  const handleSave = async () => {
    try {
      const res = await fetch("/api/teacher/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const result = await res.json();
        const updatedData = result.data || form;
        setProfile(updatedData);
        setSavedMsg("บันทึกข้อมูลสำเร็จ");
        const newName = `${updatedData.firstName || ""} ${updatedData.lastName || ""}`.trim();
        localStorage.setItem("coop.teacher.displayName", newName);
        // แจ้ง T_App.tsx ให้อัปเดต displayName (storage event ไม่ยิงใน tab เดียวกัน)
        window.dispatchEvent(new CustomEvent("teacherNameUpdated", { detail: newName }));

        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setSavedMsg(""), 3000);
        setIsModalOpen(false);
      }
    } catch (err) {
      alert("ไม่สามารถบันทึกข้อมูลได้");
    }
  };

  if (loading) return <div style={{ padding: 100, textAlign: 'center', color: '#64748b' }}>กำลังโหลดข้อมูลโปรไฟล์...</div>;

  const isFirstTime = !profile.firstName || profile.firstName === "";

  // Helper สำหรับแสดงชื่อสาขา (เผื่อเจอคำย่อเก่า ให้แปลงก่อน ถ้าไม่เจอให้ใช้ชื่อตรงๆ)
  const displayMajor = MAJOR_MAP[profile.major || ""] || profile.major || "-";

  return (
    <div className="page" style={{ padding: "40px 20px", maxWidth: "900px", margin: "0 auto" }}>
      <style>{PROFILE_CSS}</style>

      {/* Header */}
      <div style={{ marginBottom: "28px", textAlign: 'center' }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, margin: 0, color: '#1e293b' }}>โปรไฟล์ของฉัน</h1>
        <p style={{ color: "#64748b", marginTop: "4px" }}>จัดการข้อมูลส่วนตัวและรายละเอียดการติดต่อ</p>
      </div>

      {savedMsg && (
        <div style={{ background: "#dcfce7", color: "#15803d", padding: "12px 20px", borderRadius: "12px", marginBottom: "20px", fontWeight: 700, textAlign: 'center' }}>
          ✅ {savedMsg}
        </div>
      )}

      {/* Profile Card */}
      <div className="profile-card">
        {isFirstTime ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ background: '#f8fafc', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <IcUser width={40} height={40} style={{ color: '#94a3b8' }} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>ยินดีต้อนรับ!</h2>
            <p style={{ color: '#64748b', marginBottom: '24px' }}>คุณยังไม่ได้ตั้งค่าโปรไฟล์อาจารย์นิเทศ กรุณากรอกข้อมูลเพื่อเริ่มใช้งาน</p>
            <button className="btn" onClick={() => { setForm(profile); setIsModalOpen(true); }}>
              ตั้งค่าโปรไฟล์ครั้งแรก
            </button>
          </div>
        ) : (
          <>
            <div className="card-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '12px' }}>
                  <IcUser width={30} height={30} style={{ color: '#2563eb' }} />
                </div>
                <div>
                  <div className="profile-title">{profile.firstName} {profile.lastName}</div>
                  <div className="profile-sub">
                    {profile.faculty} {profile.major ? `• ${displayMajor}` : ""}
                  </div>
                </div>
              </div>
              <button className="btn-edit" onClick={() => { setForm(profile); setIsModalOpen(true); }} style={editBtnStyle}>
                <IcEdit width={16} height={16} /> แก้ไขข้อมูล
              </button>
            </div>

            <div className="divider"></div>

            <div className="info-grid-single">
              <div className="info-row">
                <span className="label">ชื่อ-นามสกุล</span>
                <span className="value">{profile.firstName} {profile.lastName}</span>
              </div>
              <div className="info-row">
                <span className="label">อีเมลมหาวิทยาลัย</span>
                <span className="value"><span className="email-pill">{profile.email}</span></span>
              </div>
              <div className="info-row">
                <span className="label">เบอร์โทรศัพท์</span>
                <span className="value">{profile.phone || "-"}</span>
              </div>
              <div className="info-row">
                <span className="label">คณะ</span>
                <span className="value">{profile.faculty || "-"}</span>
              </div>
              <div className="info-row">
                <span className="label">สาขาวิชา</span>
                {/* ✅ แสดงสาขาวิชา */}
                <span className="value">{displayMajor}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal แก้ไขข้อมูล */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3 className="profile-title" style={{ fontSize: "22px" }}>
              {isFirstTime ? "ตั้งค่าโปรไฟล์ครั้งแรก" : "แก้ไขข้อมูลโปรไฟล์"}
            </h3>
            <p className="profile-sub" style={{ marginBottom: '20px' }}>กรุณากรอกข้อมูลส่วนตัวของคุณเพื่อใช้ในการนิเทศนักศึกษา</p>

            <div className="form-grid">
              <div>
                <label className="label">ชื่อ <span style={{ color: 'red' }}>*</span></label>
                <input
                  className="input"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">นามสกุล <span style={{ color: 'red' }}>*</span></label>
                <input
                  className="input"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">เบอร์โทรศัพท์</label>
                <input
                  className="input"
                  value={form.phone}
                  maxLength={10}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
                />
              </div>
              <div>
                <label className="label">อีเมล (ล็อกอิน)</label>
                <input className="input" value={form.email} disabled style={{ background: "#f1f5f9", cursor: 'not-allowed', color: '#94a3b8' }} />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label className="label">คณะ / สำนักวิชา</label>
                <input
                  className="input"
                  value={form.faculty}
                  onChange={(e) => setForm({ ...form, faculty: e.target.value })}
                  placeholder="เช่น วิทยาลัยการคอมพิวเตอร์"
                />
              </div>

              {/* 🟢 Dropdown สาขาวิชาที่ดึงจาก Database */}
              <div style={{ gridColumn: 'span 2' }}>
                <label className="label">สาขาวิชา</label>
                <select
                  className="input"
                  value={form.major || ""}
                  onChange={(e) => setForm({ ...form, major: e.target.value })}
                  style={{ appearance: 'none', background: '#fff url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E") no-repeat right 12px center', backgroundSize: '12px' }}
                >
                  <option value="">-- เลือกสาขาวิชา --</option>
                  {majorOptions.map((major) => (
                    <option key={major} value={major}>
                      {major}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="action-row">
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>ยกเลิก</button>
              <button className="btn" onClick={handleSave}>บันทึกข้อมูล</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ... Styles
const editBtnStyle = { background: "#f1f5f9", border: "none", padding: "8px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", color: "#475569" };
const PROFILE_CSS = `
.profile-card{ background:#fff; border-radius:24px; padding:40px; box-shadow:0 10px 30px rgba(15,23,42,.08); border: 1px solid #f1f5f9; }
.card-head{ display:flex; justify-content:space-between; align-items:center; }
.profile-title{ font-size:22px; font-weight:800; margin:0; color:#1e293b; }
.profile-sub{ font-size:14px; color:#64748b; margin-top:4px; }
.divider{ height:1px; background:#f1f5f9; margin:25px 0; }
.info-grid-single{ display:grid; gap:12px; }
.info-row{ display:grid; grid-template-columns:200px 1fr; padding:12px 0; border-bottom:1px solid #f8fafc; }
.info-row:last-child{ border-bottom:none; }
.label{ color:#64748b; font-weight:700; font-size:14px; }
.value{ font-weight:600; color:#1e293b; font-size:15px; }
.email-pill{ display:inline-block; padding:6px 14px; border-radius:999px; background:#f0f7ff; border:1px solid #e0efff; color:#0369a1; font-size:14px; font-weight:700; }
.input{ padding:12px 16px; border-radius:12px; border:1px solid #e2e8f0; font-weight:600; width:100%; margin-top:8px; box-sizing:border-box; font-family:inherit; transition: 0.2s; }
.input:focus{ border-color: #2563eb; outline: none; box-shadow: 0 0 0 4px rgba(37,99,235,0.1); }
.form-grid{ display:grid; grid-template-columns:1fr 1fr; gap:16px 24px; }
.action-row{ display:flex; justify-content:flex-end; gap:12px; margin-top:32px; }
.btn{ background:#2563eb; color:#fff; padding:12px 24px; border-radius:12px; font-weight:700; border:none; cursor:pointer; transition: 0.2s; }
.btn:hover{ background:#1d4ed8; transform: translateY(-1px); }
.btn-secondary{ background:#f1f5f9; color:#475569; padding:12px 24px; border-radius:12px; font-weight:700; border:none; cursor:pointer; }
.btn-secondary:hover{ background:#e2e8f0; }
.modal-backdrop{ position:fixed; inset:0; background:rgba(15,23,42,.6); display:flex; align-items:center; justify-content:center; z-index:100; backdrop-filter: blur(8px); }
.modal-card{ background:#fff; border-radius:24px; padding:40px; width:720px; max-width:95%; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.3); }
`;