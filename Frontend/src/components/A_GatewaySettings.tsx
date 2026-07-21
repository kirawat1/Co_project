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
        <h2 className="profile-title">⚙️ ตั้งค่าหน้าฟอร์มยื่นคำร้อง (S_Gateway)</h2>
      </div>
      <div className="divider" />

      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
        ข้อความและลิงก์ที่ตั้งค่าที่นี่จะแสดงในหน้า "ฟอร์มยื่นคำร้องและอัปโหลดเอกสาร" ของนักศึกษา
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Grade Sheet Section */}
        <div style={{ padding: '16px 20px', background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1e40af', marginBottom: 14 }}>
            📊 ส่วน: แบบฟอร์มตรวจสอบการสำเร็จการศึกษา
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="label">คำอธิบายของส่วนนี้</label>
            <textarea
              className="input"
              rows={2}
              maxLength={500}
              value={settings.gradeSheetDescription}
              onChange={e => setSettings(s => ({ ...s, gradeSheetDescription: e.target.value }))}
              placeholder="คำอธิบายที่จะแสดงใต้หัวข้อ"
            />
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0', textAlign: 'right' }}>
              {settings.gradeSheetDescription.length}/500
            </p>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="label">URL ของแบบฟอร์ม (Google Sheets)</label>
            <input
              className="input"
              value={settings.gradeSheetUrl}
              onChange={e => setSettings(s => ({ ...s, gradeSheetUrl: e.target.value }))}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              maxLength={500}
            />
            <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
              ต้องขึ้นต้นด้วย https:// เท่านั้น — ลิงก์ที่นักศึกษาจะกดเพื่อ Make a Copy
            </p>
          </div>

          <div>
            <label className="label">ข้อความบนปุ่ม/ลิงก์ <span style={{ color: 'red' }}>*</span></label>
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
        <div style={{ padding: '16px 20px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#166534', marginBottom: 14 }}>
            📎 ส่วน: อัปโหลดเอกสารประกอบ
          </div>

          <div>
            <label className="label">คำอธิบายใต้หัวข้ออัปโหลด</label>
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
        <div style={{ padding: '16px 20px', background: '#fafafa', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#334155', marginBottom: 10 }}>
            👁️ ตัวอย่างที่นักศึกษาจะเห็น
          </div>
          <div style={{ padding: '12px 16px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e40af', marginBottom: 4 }}>
              📊 แบบฟอร์มตรวจสอบการสำเร็จการศึกษา
            </div>
            <p style={{ fontSize: 12, color: '#3b82f6', margin: '0 0 8px' }}>
              {settings.gradeSheetDescription || <em style={{ color: '#94a3b8' }}>(ยังไม่มีคำอธิบาย)</em>}
            </p>
            <span style={{ display: 'inline-block', padding: '6px 14px', background: '#2563eb', color: '#fff', borderRadius: 6, fontWeight: 700, fontSize: 12 }}>
              {settings.gradeSheetLinkText.trim() || <em style={{ color: '#bfdbfe' }}>(ข้อความว่าง — ปุ่มจะมองไม่เห็น)</em>}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            อัปโหลดเอกสารประกอบ — <em>{settings.uploadDescription || '(ยังไม่มีคำอธิบาย)'}</em>
          </div>
        </div>
      </div>

      <div className="action-row" style={{ marginTop: 24, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
        <button className="btn btn-secondary" onClick={handleReset} disabled={saving} type="button">
          รีเซ็ตและบันทึกค่าเริ่มต้น
        </button>
        <button
          className="btn btn-success"
          onClick={() => handleSave()}
          disabled={saving}
          type="button"
        >
          {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
        </button>
      </div>
    </div>
  );
}
