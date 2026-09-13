import { useState } from "react";
import { useToast } from "./Toast";
import Spinner from "./Spinner";
import { apiFetch } from "../utils/apiFetch";

interface Props {
  onClose: () => void;
}

// กติกาเดียวกับ backend/utils/validatePassword.js
const RULES: { label: string; test: (pw: string) => boolean }[] = [
  { label: "อย่างน้อย 8 ตัวอักษร", test: (pw) => pw.length >= 8 },
  { label: "ตัวพิมพ์ใหญ่ (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { label: "ตัวพิมพ์เล็ก (a-z)", test: (pw) => /[a-z]/.test(pw) },
  { label: "ตัวเลข (0-9)", test: (pw) => /\d/.test(pw) },
  { label: "อักขระพิเศษ เช่น !@#$%^&*", test: (pw) => /[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/.test(pw) },
];

export default function S_ChangePasswordModal({ onClose }: Props) {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const rulesPassed = RULES.every((r) => r.test(newPassword));
  const mismatch = confirmPassword !== "" && confirmPassword !== newPassword;
  const canSubmit = !!currentPassword && rulesPassed && confirmPassword === newPassword && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/auth/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
        return;
      }
      toast.success("เปลี่ยนรหัสผ่านเรียบร้อย");
      onClose();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form style={modal} onSubmit={handleSubmit}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>🔑 เปลี่ยนรหัสผ่าน</h3>
          <button type="button" onClick={onClose} disabled={saving} style={closeBtn} aria-label="ปิด">✕</button>
        </div>

        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
          ใช้เข้าสู่ระบบด้วยอีเมลมหาวิทยาลัยและรหัสผ่าน ถ้ายังไม่เคยเปลี่ยน รหัสผ่านปัจจุบันคือรหัสนักศึกษาแบบมีขีด
        </p>

        <label style={label} htmlFor="cp-current">รหัสผ่านปัจจุบัน</label>
        <input id="cp-current" type="password" autoComplete="current-password" style={input}
          value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />

        <label style={label} htmlFor="cp-new">รหัสผ่านใหม่</label>
        <input id="cp-new" type="password" autoComplete="new-password" style={input}
          value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px", fontSize: 12, display: "grid", gap: 2 }}>
          {RULES.map((r) => {
            const ok = r.test(newPassword);
            return (
              <li key={r.label} style={{ color: ok ? "#15803d" : "#94a3b8" }}>
                {ok ? "✓" : "•"} {r.label}
              </li>
            );
          })}
        </ul>

        <label style={label} htmlFor="cp-confirm">ยืนยันรหัสผ่านใหม่</label>
        <input id="cp-confirm" type="password" autoComplete="new-password" style={input}
          value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        {mismatch && <div style={{ color: "#dc2626", fontSize: 12, marginTop: -8, marginBottom: 12 }}>รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน</div>}

        {error && <div style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button type="button" onClick={onClose} disabled={saving} style={ghostBtn}>ยกเลิก</button>
          <button type="submit" disabled={!canSubmit} style={{ ...primaryBtn, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "not-allowed" }}>
            {saving ? <><Spinner size={16} color="#fff" /> กำลังบันทึก...</> : "เปลี่ยนรหัสผ่าน"}
          </button>
        </div>
      </form>
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)", padding: 16 };
const modal: React.CSSProperties = { background: "var(--surface,#fff)", borderRadius: 20, padding: 28, width: 420, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 40px rgba(0,0,0,.2)" };
const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 6 };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, boxSizing: "border-box", marginBottom: 14 };
const closeBtn: React.CSSProperties = { background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" };
const ghostBtn: React.CSSProperties = { padding: "10px 18px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontWeight: 700 };
const primaryBtn: React.CSSProperties = { padding: "10px 20px", borderRadius: 8, border: "none", background: "#1d4ed8", color: "#fff", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 };
