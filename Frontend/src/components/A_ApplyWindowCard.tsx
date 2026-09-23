import { useEffect, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import DateInput from "./DateInput";

/**
 * กล่องตั้งช่วงเวลายื่นคำร้องขอเข้าร่วมสหกิจ — หน้าตาแบบเดียวกับกล่องตั้งเวลา T000–T003
 * แยกจากวันของ "รอบรับสมัครสหกิจ": นักศึกษายื่นได้ต้องผ่านทั้งสองอย่าง
 */
interface ApplyConfig {
    startDate: string | null;
    endDate: string | null;
    isOpen: boolean;
    state?: { open: boolean; configured: boolean; message: string | null };
}

export default function A_ApplyWindowCard() {
    const [config, setConfig] = useState<ApplyConfig>({ startDate: "", endDate: "", isOpen: false });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const load = async () => {
        try {
            const res = await apiFetch("/api/admin/config/apply");
            if (res.ok) {
                const data = await res.json();
                setConfig({ ...data, startDate: data.startDate || "", endDate: data.endDate || "" });
            }
        } catch (err) {
            console.error("Load apply config error", err);
        }
    };

    useEffect(() => { load(); }, []);

    const save = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await apiFetch("/api/admin/config/apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startDate: config.startDate || null, endDate: config.endDate || null, isOpen: config.isOpen }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
                setMessage({ ok: false, text: data.message || "บันทึกไม่สำเร็จ" });
                return;
            }
            setMessage({ ok: true, text: "บันทึกช่วงเวลายื่นคำร้องเรียบร้อย" });
            await load();
        } catch {
            setMessage({ ok: false, text: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" });
        } finally {
            setSaving(false);
        }
    };

    // สถานะตามที่ server ตัดสิน (เวลาไทย) — ยังไม่เคยตั้งค่า = เปิดตามรอบรับสมัครเหมือนเดิม
    const state = config.state;
    const open = state ? state.open : config.isOpen;
    const statusText = !state?.configured
        ? "🟢 ยังไม่ได้ตั้งช่วงเวลา — ยื่นได้ตามรอบรับสมัครที่เปิดอยู่"
        : open ? "🟢 สถานะ: เปิดรับคำร้อง" : `🔴 สถานะ: ${state?.message || "ปิดรับคำร้อง"}`;

    return (
        <section className="card" style={{ marginBottom: 24, borderLeft: `5px solid ${open ? "#10b981" : "#ef4444"}`, background: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
                <div>
                    <h3 style={{ margin: 0, color: "#0f172a", fontSize: 18 }}>⚙️ จัดการเวลายื่นคำร้องสหกิจ</h3>
                    <div style={{ fontSize: 13, marginTop: 6, color: open ? "#10b981" : "#ef4444", fontWeight: 600 }}>{statusText}</div>
                    <div style={{ fontSize: 12, marginTop: 4, color: "#64748b" }}>
                        นักศึกษายื่นได้เมื่อรอบรับสมัครเปิดอยู่ และอยู่ในช่วงเวลานี้
                    </div>
                </div>

                <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div>
                        <label style={labelStyle}>วันเปิดรับ</label>
                        <DateInput className="input" value={config.startDate || ""}
                            onChange={(e) => setConfig({ ...config, startDate: e.target.value })} style={{ background: "#fff" }} />
                    </div>
                    <div>
                        <label style={labelStyle}>วันปิดรับ</label>
                        <DateInput className="input" value={config.endDate || ""}
                            onChange={(e) => setConfig({ ...config, endDate: e.target.value })} style={{ background: "#fff" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", height: 42, gap: 16 }}>
                        <label style={{ fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "#334155" }}>
                            <input id="apply-open" type="checkbox" checked={config.isOpen}
                                onChange={(e) => setConfig({ ...config, isOpen: e.target.checked })}
                                style={{ width: 18, height: 18, accentColor: "#0ea5e9" }} />
                            เปิดระบบ
                        </label>
                        <button className="btn" style={{ background: "#0ea5e9", color: "white", padding: "10px 20px", height: 42 }}
                            onClick={save} disabled={saving}>
                            {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
                        </button>
                    </div>
                </div>
            </div>
            {message && (
                <div role={message.ok ? "status" : "alert"} style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: message.ok ? "#15803d" : "#b91c1c" }}>
                    {message.ok ? "✅" : "❌"} {message.text}
                </div>
            )}
        </section>
    );
}

const labelStyle = { fontSize: 12, display: "block", color: "#64748b", marginBottom: 6, fontWeight: 700 } as const;
