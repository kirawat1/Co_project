import React, { useState, useEffect } from "react";
import axios from "axios";
import AutoTextarea from "./AutoTextarea";

export default function A_DocT005_006() {
    const [isFetching, setIsFetching] = useState(true); // ✅ State สำหรับตอนดึงข้อมูลครั้งแรก
    const [isSaving, setIsSaving] = useState(false);    // ✅ State สำหรับตอนกดปุ่มบันทึก

    // State เก็บข้อมูลฟอร์ม
    const [instructionText, setInstructionText] = useState("");
    const [ccEmails, setCcEmails] = useState("");
    const [t005Link, setT005Link] = useState("");
    const [t006Link, setT006Link] = useState("");
    const [templateLink, setTemplateLink] = useState("");

    const token = localStorage.getItem("coop.token");



    // โหลดข้อมูลเดิมมาแสดงทุกครั้งที่เปิดหน้านี้
    useEffect(() => {
        const fetchConfig = async () => {
            setIsFetching(true); // เริ่มโหลด
            try {
                const res = await axios.get("/api/admin/config/evaluation", {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data?.config) {
                    const cfg = res.data.config;
                    setInstructionText(cfg.instructionText || "");
                    setCcEmails(cfg.ccEmails || "");
                    setT005Link(cfg.t005Link || "");
                    setT006Link(cfg.t006Link || "");
                    setTemplateLink(cfg.templateLink || "");
                }
            } catch (err) {
                console.warn("ไม่พบข้อมูลเดิม (จะแสดงฟอร์มเปล่า)");
            } finally {
                setIsFetching(false); // โหลดเสร็จแล้ว
            }
        };
        fetchConfig();
    }, [token]); // โหลดใหม่เสมอเมื่อ Component ถูก Mount

    // บันทึกการแก้ไข
    const handleSave = async () => {
        if (!confirm("ยืนยันการบันทึกการเปลี่ยนแปลง? (นักศึกษาจะเห็นข้อความใหม่ทันที)")) return;

        setIsSaving(true);
        try {
            const payload = { instructionText, ccEmails, t005Link, t006Link, templateLink };
            await axios.put("/api/admin/config/evaluation", payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("✅ บันทึกข้อมูลสำเร็จ");
        } catch (err) {
            alert("❌ เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setIsSaving(false);
        }
    };

    // ✅ ถ้ายังโหลดข้อมูลล่าสุดไม่เสร็จ ให้โชว์หน้า Loading ป้องกันหน้ากระพริบ
    if (isFetching) {
        return <div style={{ padding: 40, textAlign: 'center', color: '#0074B7', marginLeft: 65 }}>กำลังโหลดข้อมูลล่าสุด...</div>;
    }

    return (
        <div className="page" style={{ padding: 4, margin: "28px 28px 28px 65px" }}>

            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>⚙️ จัดการแบบประเมินสหกิจ (T005, T006)</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>แก้ไขข้อความคำชี้แจงและลิงก์สำหรับส่งให้นักศึกษา</div>
                </div>
                <button className="btn btn-primary" onClick={handleSave} disabled={isSaving} style={{ padding: '12px 24px' }}>
                    {isSaving ? '⏳ กำลังบันทึก...' : '💾 บันทึกการเปลี่ยนแปลง'}
                </button>
            </div>

            <div className="card" style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* 1. ส่วนคำชี้แจง */}
                <div>
                    <label style={labelStyle}>📝 ข้อความคำชี้แจง / ขั้นตอนการปฏิบัติ (แสดงบนสุดของหน้า)</label>
                    <AutoTextarea
                        className="input"
                        rows={10}
                        value={instructionText}
                        onChange={e => setInstructionText(e.target.value)}
                        placeholder="พิมพ์ข้อความคำชี้แจงให้นักศึกษา..."
                    />
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>* การเว้นบรรทัด (Enter) จะถูกแสดงผลเหมือนที่พิมพ์ในนี้</div>
                </div>

                {/* 2. อีเมล CC */}
                <div>
                    <label style={labelStyle}>📧 รายชื่ออีเมลอาจารย์ (ให้นักศึกษา CC ตอนส่งเมล์หาพี่เลี้ยง)</label>
                    <input
                        type="text"
                        className="input"
                        value={ccEmails}
                        onChange={e => setCcEmails(e.target.value)}
                        placeholder="เช่น thanaphon@kku.ac.th, chitsutha@kku.ac.th"
                    />
                </div>

                {/* 3. ลิงก์ต่างๆ */}
                <div style={{ padding: 20, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <h4 style={{ margin: 0, color: '#334155' }}>🔗 จัดการลิงก์เอกสาร (URL)</h4>

                    <div>
                        <label style={labelStyle}>ลิงก์แบบประเมินผล T005</label>
                        <input type="text" className="input" value={t005Link} onChange={e => setT005Link(e.target.value)} placeholder="https://..." />
                    </div>

                    <div>
                        <label style={labelStyle}>ลิงก์แบบประเมินเอกสาร T006</label>
                        <input type="text" className="input" value={t006Link} onChange={e => setT006Link(e.target.value)} placeholder="https://..." />
                    </div>

                    <div>
                        <label style={labelStyle}>ลิงก์ Template อีเมล (Google Docs / PDF)</label>
                        <input type="text" className="input" value={templateLink} onChange={e => setTemplateLink(e.target.value)} placeholder="https://docs.google.com/..." />
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