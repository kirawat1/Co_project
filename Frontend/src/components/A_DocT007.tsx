import React, { useState, useEffect } from "react";
import axios from "axios";

export default function A_DocT007() {
    const [isFetching, setIsFetching] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // State เก็บข้อมูลฟอร์ม T007
    const [instructionText, setInstructionText] = useState("");
    const [t007Link, setT007Link] = useState("");

    const token = localStorage.getItem("coop.token");

    // โหลดข้อมูลเดิม
    useEffect(() => {
        const fetchConfig = async () => {
            setIsFetching(true);
            try {
                const res = await axios.get("http://localhost:5000/api/admin/config/t007", {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data?.config) {
                    const cfg = res.data.config;
                    setInstructionText(cfg.instructionText || "");
                    setT007Link(cfg.t007Link || "");
                }
            } catch (err) {
                console.warn("ไม่พบข้อมูล T007 (จะแสดงฟอร์มเปล่า)");
            } finally {
                setIsFetching(false);
            }
        };
        fetchConfig();
    }, [token]);

    // บันทึกการแก้ไข
    const handleSave = async () => {
        if (!confirm("ยืนยันการบันทึกการเปลี่ยนแปลง? (นักศึกษาจะเห็นข้อความใหม่ทันที)")) return;

        setIsSaving(true);
        try {
            const payload = { instructionText, t007Link };
            await axios.put("http://localhost:5000/api/admin/config/t007", payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("✅ บันทึกข้อมูลสำเร็จ");
        } catch (err) {
            alert("❌ เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setIsSaving(false);
        }
    };

    if (isFetching) {
        return <div style={{ padding: 40, textAlign: 'center', color: '#0074B7', marginLeft: 65 }}>กำลังโหลดข้อมูลล่าสุด...</div>;
    }

    return (
        <div className="page" style={{ padding: 4, margin: "28px 28px 28px 65px" }}>

            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>⚙️ จัดการแบบประเมินสถานประกอบการ (T007)</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>แก้ไขข้อความคำชี้แจงและลิงก์สำหรับให้นักศึกษาประเมินบริษัท</div>
                </div>
                <button className="btn btn-primary" onClick={handleSave} disabled={isSaving} style={{ padding: '12px 24px' }}>
                    {isSaving ? '⏳ กำลังบันทึก...' : '💾 บันทึกการเปลี่ยนแปลง'}
                </button>
            </div>

            <div className="card" style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* 1. ส่วนคำชี้แจง */}
                <div>
                    <label style={labelStyle}>📝 ข้อความคำชี้แจง (แสดงให้นักศึกษาอ่าน)</label>
                    <textarea
                        className="input"
                        rows={8}
                        value={instructionText}
                        onChange={e => setInstructionText(e.target.value)}
                        placeholder="พิมพ์ข้อความคำชี้แจงให้นักศึกษา..."
                    />
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>* การเว้นบรรทัด (Enter) จะถูกแสดงผลเหมือนที่พิมพ์ในนี้</div>
                </div>

                {/* 2. ลิงก์ฟอร์ม T007 */}
                <div style={{ padding: 20, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <h4 style={{ margin: 0, color: '#334155' }}>🔗 จัดการลิงก์เอกสาร (URL)</h4>

                    <div>
                        <label style={labelStyle}>ลิงก์ Google Form แบบประเมิน (T007)</label>
                        <input
                            type="text"
                            className="input"
                            value={t007Link}
                            onChange={e => setT007Link(e.target.value)}
                            placeholder="https://forms.gle/..."
                        />
                    </div>
                </div>

            </div>

            <style>{`
                .card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .input { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 14px; box-sizing: border-box; outline: none; transition: 0.2s; }
                .input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
                .btn { border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-family: inherit; font-size: 14px; transition: 0.2s; }
                .btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .btn-primary { background: #10b981; color: white; }
                .btn-primary:hover:not(:disabled) { background: #059669; }
            `}</style>
        </div>
    );
}

const labelStyle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 8, display: 'block' };