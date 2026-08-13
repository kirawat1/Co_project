import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useToast } from "./Toast";

interface GatewaySettings {
  gradeSheetDescription: string;
  gradeSheetUrl: string;
  gradeSheetLinkText: string;
  uploadDescription: string;
}

const DEFAULTS: GatewaySettings = {
  gradeSheetDescription: 'กรุณา Make a Copy แบบฟอร์มด้านล่าง กรอกข้อมูลให้ครบ แล้วนำลิงก์ที่แชร์มาใส่ในช่องด้านล่าง',
  gradeSheetUrl: 'https://docs.google.com/spreadsheets/d/1HGWTsoScRc3XU0abUn6J9TgyFksAoi1V/copy',
  gradeSheetLinkText: '📋 Make a Copy แบบฟอร์ม',
  uploadDescription: 'เช่น ใบคำร้อง, ทรานสคริปต์, หนังสือรับรอง ฯลฯ (รองรับ PDF, รูปภาพ)'
};

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch { return false; }
}

export default function A_GatewaySettings() {
  const toast = useToast();
  const [settings, setSettings] = useState<GatewaySettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const token = localStorage.getItem("coop.token");
    axios.get("/api/admin/config/gateway", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!mountedRef.current) return;
        if (res.data.ok && res.data.data) setSettings(res.data.data);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setLoadError(true);
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });

    return () => { mountedRef.current = false; };
  }, []);

  const handleSave = async (overrideSettings?: GatewaySettings) => {
    const toSave = overrideSettings ?? settings;

    // Client-side URL validation
    if (toSave.gradeSheetUrl && !isHttpUrl(toSave.gradeSheetUrl)) {
      toast.error('URL แบบฟอร์มต้องขึ้นต้นด้วย https:// หรือ http:// เท่านั้น');
      return;
    }
    if (!toSave.gradeSheetLinkText.trim()) {
      toast.error('ข้อความบนปุ่ม/ลิงก์ต้องไม่ว่างเปล่า');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("coop.token");
      const res = await axios.put("/api/admin/config/gateway", toSave, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.ok) toast.success("บันทึกการตั้งค่าเรียบร้อยแล้ว");
      else toast.error(res.data.message || "เกิดข้อผิดพลาด");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "ไม่สามารถบันทึกได้");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSettings(DEFAULTS);
    await handleSave(DEFAULTS);
  };

  if (loading) return <div style={{ padding: 32 }}>กำลังโหลด...</div>;

  if (loadError) return (
    <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ padding: 32, textAlign: 'center', color: '#ef4444' }}>
        ⚠️ ไม่สามารถโหลดการตั้งค่าได้ — กรุณาตรวจสอบการเชื่อมต่อหรือ login ใหม่อีกครั้ง
      </div>
    </div>
  );

  return (
    <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="card-head">
        <h2 className="profile-title">⚙️ ตั้งค่าหน้าฟอร์มยื่นคำร้อง</h2>
      </div>
      <div className="divider" />

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        ข้อความและลิงก์ที่ตั้งค่าที่นี่จะแสดงในหน้า "ฟอร์มยื่นคำร้องและอัปโหลดเอกสาร" ของนักศึกษา
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Grade Sheet Section */}
        <div className="gw-section">
          <div className="gw-section-head">
            <span className="gw-badge gw-badge-blue">📊</span>
            <span>ส่วน: แบบฟอร์มตรวจสอบการสำเร็จการศึกษา</span>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="label" style={{ marginBottom: 6, display: 'block' }}>คำอธิบายของส่วนนี้</label>
            <textarea
              className="input"
              rows={2}
              maxLength={500}
              value={settings.gradeSheetDescription}
              onChange={e => setSettings(s => ({ ...s, gradeSheetDescription: e.target.value }))}
              placeholder="คำอธิบายที่จะแสดงใต้หัวข้อ"
              style={{ height: 'auto', paddingTop: 10, paddingBottom: 10, resize: 'vertical' }}
            />
            <p className="gw-hint" style={{ textAlign: 'right' }}>{settings.gradeSheetDescription.length}/500</p>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="label" style={{ marginBottom: 6, display: 'block' }}>URL ของแบบฟอร์ม (Google Sheets)</label>
            <input
              className="input"
              value={settings.gradeSheetUrl}
              onChange={e => setSettings(s => ({ ...s, gradeSheetUrl: e.target.value }))}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              maxLength={500}
            />
            <p className="gw-hint">ต้องขึ้นต้นด้วย https:// เท่านั้น — ลิงก์ที่นักศึกษาจะกดเพื่อ Make a Copy</p>
          </div>

          <div>
            <label className="label" style={{ marginBottom: 6, display: 'block' }}>
              ข้อความบนปุ่ม/ลิงก์ <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              className="input"
              value={settings.gradeSheetLinkText}
              onChange={e => setSettings(s => ({ ...s, gradeSheetLinkText: e.target.value }))}
              placeholder="เช่น 📋 Make a Copy แบบฟอร์ม"
              maxLength={100}
            />
          </div>
        </div>

        {/* Upload Section */}
        <div className="gw-section">
          <div className="gw-section-head">
            <span className="gw-badge gw-badge-green">📎</span>
            <span>ส่วน: อัปโหลดเอกสารประกอบ</span>
          </div>

          <div>
            <label className="label" style={{ marginBottom: 6, display: 'block' }}>คำอธิบายใต้หัวข้ออัปโหลด</label>
            <input
              className="input"
              value={settings.uploadDescription}
              onChange={e => setSettings(s => ({ ...s, uploadDescription: e.target.value }))}
              placeholder="เช่น ใบคำร้อง, ทรานสคริปต์, หนังสือรับรอง ฯลฯ (รองรับ PDF, รูปภาพ)"
              maxLength={300}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="gw-section gw-preview">
          <div className="gw-section-head">
            <span className="gw-badge gw-badge-gray">👁️</span>
            <span>ตัวอย่างที่นักศึกษาจะเห็น</span>
          </div>
          <div className="gw-preview-card">
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: 'var(--text)' }}>
              📊 แบบฟอร์มตรวจสอบการสำเร็จการศึกษา
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
              {settings.gradeSheetDescription || <em style={{ color: 'var(--text-sub)' }}>(ยังไม่มีคำอธิบาย)</em>}
            </p>
            <span className="btn btn-primary" style={{ fontSize: 13, height: 36, padding: '0 16px', pointerEvents: 'none' }}>
              {settings.gradeSheetLinkText.trim() || <em style={{ opacity: .6 }}>(ข้อความว่าง)</em>}
            </span>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            📎 อัปโหลดเอกสารประกอบ — <em style={{ color: 'var(--text-sub)' }}>{settings.uploadDescription || '(ยังไม่มีคำอธิบาย)'}</em>
          </div>
        </div>
      </div>

      <div className="action-row" style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <button className="btn btn-secondary" onClick={handleReset} disabled={saving} type="button">
          รีเซ็ตค่าเริ่มต้น
        </button>
        <button className="btn btn-success" onClick={() => handleSave()} disabled={saving} type="button">
          {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
        </button>
      </div>

      <style>{`
        .gw-section {
          padding: 18px 20px;
          background: var(--surface2);
          border-radius: 12px;
          border: 1px solid var(--border);
        }
        .gw-section-head {
          display: flex; align-items: center; gap: 10px;
          font-weight: 700; font-size: 14px; color: var(--text);
          margin-bottom: 16px;
        }
        .gw-badge {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 8px; font-size: 15px; flex-shrink: 0;
        }
        .gw-badge-blue  { background: rgba(59,130,246,.12); }
        .gw-badge-green { background: rgba(16,185,129,.12); }
        .gw-badge-gray  { background: var(--border); }
        .gw-hint {
          font-size: 12px; color: var(--text-sub);
          margin: 4px 0 0;
        }
        .gw-preview-card {
          padding: 14px 16px;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
