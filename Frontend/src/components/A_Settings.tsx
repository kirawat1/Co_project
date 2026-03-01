import React, { useState, useEffect } from "react";

// --- 1. Config สำหรับปีการศึกษา ---
const LS_YEAR = "coop.admin.academicYear";
const YEAR_OPTIONS = ["2568/1", "2568/2", "2567/1", "2567/2", "2566/1"];

function loadYear(): string {
  return localStorage.getItem(LS_YEAR) || "2568/1";
}

// --- 2. Config สำหรับไฟล์แม่แบบ ---
const ASSET_KEYS = [
  { key: "KRUT", label: "ตราสัญลักษณ์มหาวิทยาลัย", accept: "image/png, image/jpeg", desc: "แนะนำไฟล์ PNG พื้นหลังใส" },
  { key: "SIGNATURE", label: "ลายเซ็นคณบดี", accept: "image/png", desc: "ไฟล์ PNG พื้นหลังใสเท่านั้น" },
  { key: "PROJECT_DETAILS", label: "รายละเอียดโครงการ (หน้า 2-6)", accept: "application/pdf", desc: "ไฟล์ PDF ข้อมูลโครงการ" },
  { key: "ACCEPTANCE_FORM", label: "แบบฟอร์มตอบรับ (หน้าสุดท้าย)", accept: "application/pdf", desc: "ไฟล์ PDF ใบตอบรับ" },
];

export default function A_Settings() {
  // State: Year
  const [year, setYear] = useState<string>(() => loadYear());

  // State: Assets
  const [assets, setAssets] = useState<any[]>([]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // --- Effect: Save Year ---
  useEffect(() => {
    localStorage.setItem(LS_YEAR, year);
  }, [year]);

  // --- Effect: Load Assets from DB ---
  const fetchAssets = async () => {
    try {
      // เรียก API ที่เราสร้างไว้
      const res = await fetch("http://localhost:5000/api/admin/assets");
      const data = await res.json();
      if (data.ok) setAssets(data.assets);
    } catch (err) { console.error("Load assets failed", err); }
  };

  useEffect(() => { fetchAssets(); }, []);

  // --- Handlers: Upload ---
  const handleUpload = async (key: string, file: File) => {
    if (!confirm(`ยืนยันการเปลี่ยนไฟล์ "${key}"?`)) return;

    setUploadingKey(key);
    const formData = new FormData();
    formData.append("key", key);
    formData.append("file", file);
    const label = ASSET_KEYS.find(k => k.key === key)?.label || key;
    formData.append("label", label);

    try {
      const res = await fetch("http://localhost:5000/api/admin/assets", {
        method: "POST",
        body: formData, // ไม่ต้องใส่ header Content-Type (browser จัดการเอง)
      });
      if (res.ok) {
        alert("✅ อัปโหลดเรียบร้อย");
        fetchAssets(); // โหลดข้อมูลใหม่
      } else {
        alert("❌ อัปโหลดล้มเหลว");
      }
    } catch (err) { alert("Error uploading file"); }
    finally { setUploadingKey(null); }
  };

  // --- Handlers: Clear Data (Legacy) ---
  function clearAdmin() {
    if (!confirm("⚠️ คำเตือน: ต้องการลบข้อมูล LocalStorage ทั้งหมดหรือไม่?")) return;
    const keys = [
      "coop.student.profile.v1", "coop.admin.teachers.v1",
      "coop.admin.teacherStudentsByYear.v1", "coop.admin.companies",
      "coop.shared.announcements",
    ];
    keys.forEach((k) => localStorage.removeItem(k));
    alert("ลบข้อมูลฝั่งแอดมินเรียบร้อย");
  }

  function clearStudentDaily() {
    if (!confirm("ลบประวัติบันทึกประจำวันทั้งหมด?")) return;
    localStorage.removeItem("coop.student.daily.v1");
    const mentorLogs = Object.keys(localStorage).filter((k) => k.startsWith("coop.mentor.logs."));
    mentorLogs.forEach((k) => localStorage.removeItem(k));
    alert("ลบประวัติบันทึกประจำวันเรียบร้อย");
  }

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <h2 style={{ marginBottom: 24, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>⚙️ ตั้งค่าระบบ (System Settings)</h2>

      {/* ------------------------------------------------ */}
      {/* SECTION 1: GENERAL SETTINGS (YEAR) */}
      {/* ------------------------------------------------ */}
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h3 style={sectionTitle}>📅 ปีการศึกษา (Academic Year)</h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          <label className="label" style={{ fontWeight: 600 }}>เลือกปีการศึกษาปัจจุบัน:</label>
          <div className="year-select-wrap">
            <select
              className="input year-select"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>
          * ค่านี้จะถูกใช้เป็น default สำหรับกรองข้อมูลนักศึกษาในหน้าอื่นๆ
        </p>
      </section>

      {/* ------------------------------------------------ */}
      {/* SECTION 2: DOCUMENT TEMPLATES (NEW!) */}
      {/* ------------------------------------------------ */}
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ ...sectionTitle, marginBottom: 0 }}>📄 เอกสารแม่แบบ (Document Templates)</h3>
          <span style={{ fontSize: 12, color: '#64748b' }}>ใช้สำหรับระบบออกหนังสือส่งตัวอัตโนมัติ</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
          {ASSET_KEYS.map((item) => {
            const current = assets.find(a => a.key === item.key);
            const fileUrl = current ? `http://localhost:5000/uploads/system/${current.path}` : null;
            const isImage = item.accept.includes("image");

            return (
              <div key={item.key} style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20,
                display: 'flex', flexDirection: 'column'
              }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: '#334155' }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.desc}</div>
                </div>

                {/* Preview Box */}
                <div style={{
                  flex: 1, background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1',
                  marginBottom: 15, minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', position: 'relative'
                }}>
                  {fileUrl ? (
                    isImage ? (
                      <img src={fileUrl} style={{ maxHeight: 100, maxWidth: '90%', objectFit: 'contain' }} alt="preview" />
                    ) : (
                      <a href={fileUrl} target="_blank" rel="noreferrer" style={{ textAlign: 'center', textDecoration: 'none', color: '#475569' }}>
                        <div style={{ fontSize: 32 }}>📄</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>คลิกเพื่อดูไฟล์ PDF</div>
                      </a>
                    )
                  ) : (
                    <div style={{ color: '#cbd5e1', fontSize: 13 }}>ยังไม่มีไฟล์</div>
                  )}

                  {/* Timestamp Badge */}
                  {current && (
                    <div style={{
                      position: 'absolute', bottom: 5, right: 5, fontSize: 10,
                      background: 'rgba(255,255,255,0.9)', padding: '2px 6px', borderRadius: 4,
                      color: '#64748b', border: '1px solid #e2e8f0'
                    }}>
                      อัปเดต: {new Date(current.updatedAt).toLocaleDateString('th-TH')}
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div>
                  <input
                    type="file"
                    accept={item.accept}
                    id={`upload-${item.key}`}
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files?.[0] && handleUpload(item.key, e.target.files[0])}
                    disabled={uploadingKey === item.key}
                  />
                  <label
                    htmlFor={`upload-${item.key}`}
                    className="btn"
                    style={{
                      display: 'block', textAlign: 'center', width: '100%', boxSizing: 'border-box',
                      background: uploadingKey === item.key ? '#cbd5e1' : '#3b82f6',
                      cursor: uploadingKey === item.key ? 'wait' : 'pointer',

                    }}
                  >
                    {uploadingKey === item.key ? 'กำลังอัปโหลด...' : '📤 อัปโหลดไฟล์ใหม่'}
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------ */}
      {/* SECTION 3: SYSTEM MAINTENANCE (DANGER ZONE) */}
      {/* ------------------------------------------------ */}
      <section className="card" style={{ padding: 24, borderLeft: '4px solid #ef4444' }}>
        <h3 style={{ ...sectionTitle, color: '#b91c1c' }}>⚠️ เขตอันตราย (Danger Zone)</h3>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 15 }}>
          การกดปุ่มด้านล่างจะลบข้อมูลที่ถูกเก็บใน Browser (LocalStorage) ของเครื่องนี้เท่านั้น ไม่มีผลกับฐานข้อมูลหลัก
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: 'wrap' }}>
          <button className="btn" type="button" onClick={clearAdmin} style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
            🗑️ ลบ Cache แอดมิน
          </button>

          <button className="btn" type="button" onClick={clearStudentDaily} style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
            🗑️ ลบ Cache บันทึกประจำวัน
          </button>
        </div>
      </section>

      {/* CSS Styles */}
      <style>{`
        .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #f1f5f9; }
        .page .year-select-wrap { display:inline-flex; align-items:center; padding:2px; border-radius:999px; background:rgba(148,163,184,.12); }
        .page .year-select { width: 130px; border-radius: 999px; height: 32px; padding: 4px 14px; border: 1px solid rgba(148,163,184,.6); background: #f9fafb; font-size: 15px; font-weight: 600; color:#111827; appearance: none; background-image: linear-gradient(45deg, #6b7280 50%, transparent 50%), linear-gradient(-45deg, #6b7280 50%, transparent 50%); background-position: calc(100% - 13px) 50%, calc(100% - 8px) 50%; background-size: 6px 6px, 6px 6px; background-repeat: no-repeat; }
        .page .year-select:focus { outline:none; border-color:#3b82f6; background:#ffffff; box-shadow: 0 0 0 2px rgba(59,130,246,.2); }
        
        .btn { padding: 10px 16px; border-radius: 8px; border: none; font-weight: 600; font-size: 14px; transition: 0.2s; color: white; background: #0074B7; cursor: pointer; }
        .btn:hover { opacity: 0.9; }
        
        @media (max-width: 768px){ .page{ margin: 16px !important; margin-left: 16px !important; } }
      `}</style>
    </div>
  );
}

const sectionTitle: React.CSSProperties = { margin: "0 0 16px 0", fontSize: 18, fontWeight: 700, color: "#334155" };