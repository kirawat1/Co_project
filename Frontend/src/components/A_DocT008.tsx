import React, { useState, useEffect } from "react";
import axios from "axios";

export default function A_DocT008() {
    const [isFetching, setIsFetching] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [instructionText, setInstructionText] = useState("");
    const [driveLink, setDriveLink] = useState("");

    // สำหรับจัดการรูปภาพ
    const [existingImage, setExistingImage] = useState(""); // ชื่อไฟล์รูปเดิมในระบบ
    const [imageFile, setImageFile] = useState<File | null>(null); // ไฟล์ใหม่ที่เพิ่งเลือก
    const [imagePreview, setImagePreview] = useState(""); // URL สำหรับพรีวิวรูป

    const token = localStorage.getItem("coop.token");

    useEffect(() => {
        const fetchConfig = async () => {
            setIsFetching(true);
            try {
                const res = await axios.get("/api/admin/config/t008", {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data?.config) {
                    const cfg = res.data.config;
                    setInstructionText(cfg.instructionText || "");
                    setDriveLink(cfg.driveLink || "");
                    setExistingImage(cfg.imagePath || "");
                    if (cfg.imagePath) {
                        // กำหนด URL พรีวิวรูปเดิมที่อยู่บน Server
                        setImagePreview(`/uploads/system/${cfg.imagePath}`);
                    }
                }
            } catch (err) {
                console.warn("ไม่พบข้อมูล T008");
            } finally {
                setIsFetching(false);
            }
        };
        fetchConfig();
    }, [token]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file)); // สร้าง URL พรีวิวรูปใหม่ชั่วคราว
        }
    };

    const handleSave = async () => {
        if (!confirm("ยืนยันการบันทึกการเปลี่ยนแปลง?")) return;

        setIsSaving(true);
        try {
            // ✅ ใช้ FormData เพราะมีการส่งไฟล์รูปภาพ
            const formData = new FormData();
            formData.append("instructionText", instructionText);
            formData.append("driveLink", driveLink);
            formData.append("existingImage", existingImage); // ส่งชื่อไฟล์เดิมไปด้วยเผื่อไม่ได้เปลี่ยนรูป

            if (imageFile) {
                formData.append("image", imageFile); // แนบไฟล์รูปใหม่
            }

            const res = await axios.put("/api/admin/config/t008", formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data"
                }
            });

            alert("✅ บันทึกข้อมูลสำเร็จ");
            if (res.data.imagePath) {
                setExistingImage(res.data.imagePath); // อัปเดตชื่อรูปใหม่
                setImageFile(null);
            }
        } catch (err) {
            alert("❌ เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setIsSaving(false);
        }
    };

    if (isFetching) return <div style={{ padding: 40, textAlign: 'center', color: '#0074B7', marginLeft: 65 }}>กำลังโหลดข้อมูลล่าสุด...</div>;

    return (
        <div className="page" style={{ padding: 4, margin: "28px 28px 28px 65px" }}>

            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>⚙️ จัดการส่งเล่มรายงาน (T008)</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>แก้ไขรายละเอียด ลิงก์ Drive และรูปภาพประกอบ</div>
                </div>
                <button className="btn btn-primary" onClick={handleSave} disabled={isSaving} style={{ padding: '12px 24px' }}>
                    {isSaving ? '⏳ กำลังบันทึก...' : '💾 บันทึกการเปลี่ยนแปลง'}
                </button>
            </div>

            <div className="card" style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* 1. ส่วนคำชี้แจง */}
                <div>
                    <label style={labelStyle}>📝 ข้อความคำชี้แจง / ขั้นตอนปฏิบัติ</label>
                    <textarea
                        className="input"
                        rows={14}
                        value={instructionText}
                        onChange={e => setInstructionText(e.target.value)}
                        placeholder="พิมพ์ขั้นตอนการส่งเล่มรายงาน..."
                    />
                </div>

                {/* 2. ลิงก์ Drive */}
                <div style={{ padding: 20, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>🔗 ลิงก์ Google Drive (สำหรับส่งเล่ม)</h4>
                    <input
                        type="text"
                        className="input"
                        value={driveLink}
                        onChange={e => setDriveLink(e.target.value)}
                        placeholder="https://drive.google.com/drive/folders/..."
                    />
                </div>

                {/* 3. อัปโหลดรูปภาพ */}
                <div style={{ padding: 20, background: '#fffbeb', borderRadius: 12, border: '1px solid #fde68a' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#92400e' }}>🖼️ อัปโหลดรูปภาพประกอบ (ถ้ามี)</h4>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="input" style={{ background: 'white' }} />

                    {imagePreview && (
                        <div style={{ marginTop: 15 }}>
                            <div style={{ fontSize: 13, color: '#92400e', marginBottom: 5, fontWeight: 'bold' }}>พรีวิวรูปภาพ:</div>
                            <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: 8, border: '1px solid #fcd34d' }} />
                        </div>
                    )}
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