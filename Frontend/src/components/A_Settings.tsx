import React, { useState, useEffect } from "react";

// --- Config สำหรับไฟล์แม่แบบ ---
const ASSET_KEYS = [
  { key: "KRUT", label: "ตราสัญลักษณ์มหาวิทยาลัย", accept: "image/png, image/jpeg", desc: "แนะนำไฟล์ PNG พื้นหลังใส" },
  { key: "SIGNATURE", label: "ลายเซ็นคณบดี", accept: "image/png", desc: "ไฟล์ PNG พื้นหลังใสเท่านั้น" },
  { key: "PROJECT_DETAILS", label: "รายละเอียดโครงการ (หน้า 2-6)", accept: "application/pdf", desc: "ไฟล์ PDF ข้อมูลโครงการ" },
  { key: "ACCEPTANCE_FORM", label: "แบบฟอร์มตอบรับ (หน้าสุดท้าย)", accept: "application/pdf", desc: "ไฟล์ PDF ใบตอบรับ" },
];

export default function A_Settings() {
  // State: Dean Info
  const [deanName, setDeanName] = useState("");
  const [deanPosition, setDeanPosition] = useState("คณบดีวิทยาลัยการคอมพิวเตอร์");

  // State: Assets
  const [assets, setAssets] = useState<any[]>([]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const token = localStorage.getItem("coop.token");

  // --- Effect: Load Data ---
  const loadData = async () => {
    try {
      const resAssets = await fetch("/api/admin/assets");
      const dataAssets = await resAssets.json();
      if (dataAssets.ok) setAssets(dataAssets.assets);

      const resDean = await fetch("/api/admin/config/dean-info", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resDean.ok) {
        const dataDean = await resDean.json();
        if (dataDean.deanName) setDeanName(dataDean.deanName);
        if (dataDean.deanPosition) setDeanPosition(dataDean.deanPosition);
      }
    } catch (err) { console.error("Load data failed", err); }
  };

  useEffect(() => { loadData(); }, []);

  // --- Handlers: Upload Assets ---
  const handleUpload = async (key: string, file: File) => {
    if (!confirm(`ยืนยันการเปลี่ยนไฟล์ "${key}"?`)) return;

    setUploadingKey(key);
    const formData = new FormData();
    formData.append("key", key);
    formData.append("file", file);
    const label = ASSET_KEYS.find(k => k.key === key)?.label || key;
    formData.append("label", label);

    try {
      const res = await fetch("/api/admin/assets", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        alert("✅ อัปโหลดเรียบร้อย");
        loadData();
      } else {
        alert("❌ อัปโหลดล้มเหลว");
      }
    } catch (err) { alert("Error uploading file"); }
    finally { setUploadingKey(null); }
  };

  // --- 🆕 Handlers: Delete Assets ---
  const handleDeleteAsset = async (key: string) => {
    if (!confirm(`⚠️ ยืนยันการลบไฟล์แม่แบบ "${key}" ใช่หรือไม่?\n(หากลบไปแล้ว ระบบจะไม่สามารถดึงไฟล์นี้ไปสร้าง PDF ได้จนกว่าจะอัปโหลดใหม่)`)) return;

    try {
      const res = await fetch(`/api/admin/assets/${key}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("🗑️ ลบไฟล์เรียบร้อยแล้ว");
        loadData();
      } else {
        alert("❌ ลบไฟล์ล้มเหลว");
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    }
  };

  // --- Handlers: Save Dean Info ---
  const handleSaveDeanInfo = async () => {
    try {
      const res = await fetch("/api/admin/config/dean-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ deanName, deanPosition })
      });

      if (res.ok) {
        alert("✅ บันทึกข้อมูลคณบดีเรียบร้อยแล้ว");
      } else {
        alert("❌ บันทึกไม่สำเร็จ");
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    }
  };

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <h2 style={{ marginBottom: 24, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>⚙️ ตั้งค่าระบบ (System Settings)</h2>

      {/* ------------------------------------------------ */}
      {/* SECTION 1: SIGNATURE INFO (DEAN) */}
      {/* ------------------------------------------------ */}
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ ...sectionTitle, marginBottom: 0 }}>✍️ ข้อมูลผู้ลงนาม (คณบดี)</h3>
          <span style={{ fontSize: 12, color: '#64748b' }}>ใช้สำหรับพิมพ์ชื่อในหนังสือส่งตัว / ขอความอนุเคราะห์</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, maxWidth: 800 }}>
          <div>
            <label className="label" style={lbl}>ชื่อ-นามสกุล (พร้อมคำนำหน้า)</label>
            <input
              className="input-text"
              placeholder="เช่น รองศาสตราจารย์สิรภัทร เชี่ยวชาญวัฒนา"
              value={deanName}
              onChange={e => setDeanName(e.target.value)}
            />
          </div>
          <div>
            <label className="label" style={lbl}>ตำแหน่ง</label>
            <input
              className="input-text"
              placeholder="เช่น คณบดีวิทยาลัยการคอมพิวเตอร์"
              value={deanPosition}
              onChange={e => setDeanPosition(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <button className="btn" onClick={handleSaveDeanInfo}>💾 บันทึกข้อมูลผู้ลงนาม</button>
        </div>
      </section>

      {/* ------------------------------------------------ */}
      {/* SECTION 2: DOCUMENT TEMPLATES */}
      {/* ------------------------------------------------ */}
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ ...sectionTitle, marginBottom: 0 }}>📄 เอกสารแม่แบบ (Document Templates)</h3>
          <span style={{ fontSize: 12, color: '#64748b' }}>ใช้ประกอบการสร้างหนังสือส่งตัวอัตโนมัติ</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
          {ASSET_KEYS.map((item) => {
            const current = assets.find(a => a.key === item.key);
            const fileUrl = current ? `/uploads/system/${current.path}` : null;
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

                {/* ปุ่มจัดการไฟล์ (แนบข้างกัน) */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="file"
                      accept={item.accept}
                      id={`upload-${item.key}`}
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleUpload(item.key, e.target.files[0]);
                          e.target.value = ''; // เคลียร์ค่าเผื่อเลือกไฟล์เดิม
                        }
                      }}
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
                      {uploadingKey === item.key ? 'กำลังอัปโหลด...' : (current ? '🔄 เปลี่ยนไฟล์' : '📤 อัปโหลด')}
                    </label>
                  </div>

                  {/* แสดงปุ่มลบเฉพาะตอนที่มีไฟล์อยู่แล้ว */}
                  {current && (
                    <button
                      onClick={() => handleDeleteAsset(item.key)}
                      style={{
                        background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5',
                        borderRadius: 8, padding: '0 12px', cursor: 'pointer', fontWeight: 600,
                        transition: '0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#fecaca'}
                      onMouseOut={(e) => e.currentTarget.style.background = '#fee2e2'}
                      title="ลบไฟล์แม่แบบนี้"
                    >
                      🗑️
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </section>

      <style>{`
        .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #f1f5f9; }
        .input-text { width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid #cbd5e1; font-family: inherit; font-size: 14px; color: #1e293b; transition: 0.2s; box-sizing: border-box; }
        .input-text:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
      `}</style>
    </div>
  );
}

const sectionTitle: React.CSSProperties = { margin: "0 0 16px 0", fontSize: 18, fontWeight: 700, color: "#334155" };
const lbl: React.CSSProperties = { display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: 14 };