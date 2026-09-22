import { useState } from "react";
import type { CSSProperties } from "react";
import { apiFetch } from "../utils/apiFetch";

/**
 * รหัสผ่านปัจจุบันของนักศึกษา/อาจารย์ ให้เจ้าหน้าที่ตอบคนที่ลืมรหัสผ่าน
 * ปกติซ่อน · กด "แสดง" ถึงจะขอจาก server (POST — ทุกครั้งที่ดูถูกบันทึกใน log ว่าใครดูของใคร)
 */
type Source = "stored" | "default" | "none" | "unknown";
interface Revealed { password: string | null; source: Source }

export default function PasswordReveal({ endpoint }: { endpoint: string }) {
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const reveal = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(endpoint, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message || "ดูรหัสผ่านไม่สำเร็จ");
        return;
      }
      setRevealed(data.data);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  const hide = () => { setRevealed(null); setCopied(false); };

  const copy = async () => {
    if (!revealed?.password) return;
    try {
      await navigator.clipboard.writeText(revealed.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("คัดลอกไม่สำเร็จ — เลือกข้อความแล้วคัดลอกเอง");
    }
  };

  if (!revealed) {
    return (
      <span style={row}>
        <span style={{ letterSpacing: 2, color: "#94a3b8" }}>••••••••</span>
        <button type="button" style={btn} onClick={reveal} disabled={loading}>
          {loading ? "กำลังโหลด..." : "👁 แสดง"}
        </button>
        {error && <span role="alert" style={{ color: "#dc2626", fontSize: 12, fontWeight: 500 }}>{error}</span>}
      </span>
    );
  }

  if (revealed.password) {
    return (
      <span style={row}>
        <code data-testid="revealed-password" style={code}>{revealed.password}</code>
        <button type="button" style={btn} onClick={copy}>{copied ? "✓ คัดลอกแล้ว" : "📋 คัดลอก"}</button>
        <button type="button" style={btn} onClick={hide}>🙈 ซ่อน</button>
        {revealed.source === "default" && <span style={note}>(รหัสเริ่มต้น ยังไม่เคยเปลี่ยน)</span>}
        {error && <span role="alert" style={{ color: "#dc2626", fontSize: 12, fontWeight: 500 }}>{error}</span>}
      </span>
    );
  }

  return (
    <span style={row}>
      <span style={note}>
        {revealed.source === "none"
          ? "บัญชีนี้เข้าสู่ระบบด้วย Google — ไม่มีรหัสผ่านในระบบ"
          : "ยังไม่ทราบรหัส (ตั้งไว้ก่อนเปิดให้ดูรหัสได้) — จะเห็นหลังเจ้าของบัญชี login ครั้งถัดไป หรือรีเซ็ตรหัสผ่านให้ใหม่"}
      </span>
      <button type="button" style={btn} onClick={hide}>ปิด</button>
    </span>
  );
}

const row: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" };
const btn: CSSProperties = {
  padding: "3px 10px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff",
  color: "#334155", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const code: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", fontSize: 14, padding: "2px 8px",
  borderRadius: 6, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", userSelect: "all",
};
const note: CSSProperties = { fontSize: 12, color: "#64748b", fontWeight: 500 };
