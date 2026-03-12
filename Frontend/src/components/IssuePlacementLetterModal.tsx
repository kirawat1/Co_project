// Frontend/src/components/IssuePlacementLetterModal.tsx
// หนังสือส่งตัว
import React, { useState } from "react";
import { createPlacementPDF } from "../utils/pdfGeneratorPlacement";

interface Props {
    student: any;
    onClose: () => void;
    onSuccess: () => void;
}

export default function IssuePlacementLetterModal({
    student,
    onClose,
    onSuccess
}: Props) {
    const [placeDocNumber, setPlaceDocNumber] = useState("อว 660301.26.6.2/xxxx");
    const [placeDocDate, setPlaceDocDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [loading, setLoading] = useState(false);

    // ✅ เช็คไฟล์หนังสือส่งตัวเดิม (ให้ตรงกับ Type ใน Backend)
    const existingDoc = student.documents?.find((d: any) => d.type === 'PLACEMENT_LETTER');

    // ✅ โหลด PDF เริ่มต้น: ถ้ามีไฟล์ในระบบแล้ว ให้เอามาโชว์เลย
    const [pdfUrl, setPdfUrl] = useState<string | null>(
        existingDoc ? `http://localhost:5000/uploads/${existingDoc.path}` : null
    );
    const [pdfBlobRaw, setPdfBlobRaw] = useState<Blob | null>(null);
    const [customUploadFile, setCustomUploadFile] = useState<File | null>(null);
    const [deliveryMethod, setDeliveryMethod] = useState<"STUDENT" | "STAFF">("STUDENT");

    // --- วันที่ฝึกงาน ---
    const startDate =
        student.coop?.actualStartDate ||
        student.coopApplicationForm?.startDate ||
        "";

    const endDate =
        student.coop?.actualEndDate ||
        student.coopApplicationForm?.endDate ||
        "";

    const toThaiDate = (dateStr: string) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("th-TH", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    };

    const studentName = `${student.firstName} ${student.lastName}`;
    const companyName = student.coop?.company?.name || "-";

    // --- Preview PDF ---
    const handlePreview = async (includeSignature: boolean = true) => {
        setLoading(true);
        try {
            // 1. ดึงไฟล์รูปภาพ (ตราครุฑ และ ลายเซ็น)
            const resAssets = await fetch("http://localhost:5000/api/admin/assets");
            const dataAssets = await resAssets.json();
            const assets = dataAssets.assets || [];

            const getAssetUrl = (key: string) => {
                const found = assets.find((a: any) => a.key === key);
                return found ? `http://localhost:5000/uploads/system/${found.path}` : null;
            };

            const krutUrl = getAssetUrl("KRUT");
            const sigUrl = includeSignature ? getAssetUrl("SIGNATURE") : null;

            if (!krutUrl) return alert("⚠️ ไม่พบไฟล์ตราสัญลักษณ์มหาวิทยาลัย (KRUT) กรุณาตั้งค่าในระบบ");

            // 2. ดึงข้อมูลคณบดี
            const token = localStorage.getItem("coop.token");
            const resDean = await fetch("http://localhost:5000/api/admin/config/dean-info", {
                headers: { Authorization: `Bearer ${token}` }
            });
            let deanName = "รองศาสตราจารย์สิรภัทร เชี่ยวชาญวัฒนา";
            let deanPosition = "คณบดีวิทยาลัยการคอมพิวเตอร์";

            if (resDean.ok) {
                const deanData = await resDean.json();
                if (deanData.deanName) deanName = deanData.deanName;
                if (deanData.deanPosition) deanPosition = deanData.deanPosition;
            }

            // 3. ส่งข้อมูลทั้งหมดให้ฟังก์ชันสร้าง PDF 
            const doc = await createPlacementPDF(
                student,
                {
                    placeDocNumber,
                    placeDocDate,
                    actualStartDate: startDate,
                    actualEndDate: endDate
                },
                sigUrl || "",     // ส่งลายเซ็น
                krutUrl || "",    // ส่งตราครุฑ
                deanName,         // ส่งชื่อคณบดี
                deanPosition      // ส่งตำแหน่งคณบดี
            );

            const blob = doc.output("blob");
            setPdfBlobRaw(blob);
            setPdfUrl(URL.createObjectURL(blob));
            setCustomUploadFile(null); // เคลียร์ไฟล์ที่อัปโหลดเอง ถ้ากดสร้างใหม่
        } catch (err) {
            console.error(err);
            alert("ไม่สามารถสร้าง PDF ได้");
        } finally {
            setLoading(false);
        }
    };

    // ✅ ฟังก์ชันจัดการอัปโหลดไฟล์เซ็นสด (พรีวิวทันที)
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCustomUploadFile(file);
            setPdfUrl(URL.createObjectURL(file)); // นำไฟล์ไปแสดงบน Iframe ทันที
            setPdfBlobRaw(null);
        }
    };

    // ✅ ฟังก์ชันยกเลิกไฟล์ที่อัปโหลด
    const handleRemoveFile = () => {
        setCustomUploadFile(null);
        const fileInput = document.getElementById('custom-upload-placement') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

        // ดึงไฟล์เก่ามาพรีวิวใหม่ (ถ้ามีไฟล์ที่ระบบเคยสร้าง หรือมีใน DB)
        if (pdfBlobRaw) {
            setPdfUrl(URL.createObjectURL(pdfBlobRaw));
        } else if (existingDoc) {
            setPdfUrl(`http://localhost:5000/uploads/${existingDoc.path}`);
        } else {
            setPdfUrl(null);
        }
    };

    // ฟังก์ชันดาวน์โหลด PDF ลงเครื่องเจ้าหน้าที่
    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = `Placement_${student.studentId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Confirm Issue ---
    const handleConfirm = async () => {
        if (!confirm("ยืนยันการบันทึกข้อมูล และอัปเดตสถานะให้นักศึกษา?")) return;

        try {
            let fileToSend: File | null = null;

            if (customUploadFile) {
                fileToSend = customUploadFile;
            } else if (pdfBlobRaw) {
                fileToSend = new File([pdfBlobRaw], `placement_${student.studentId}.pdf`, { type: "application/pdf" });
            }

            const formData = new FormData();
            formData.append("studentId", student.id);
            formData.append("status", "PLACEMENT_LETTER_ISSUED");
            // ✅ ให้ Backend บันทึก Type ให้ตรงด้วย (เพื่อให้เปิดกลับมาแล้วเจอไฟล์)
            formData.append("docType", "PLACEMENT_LETTER");

            // เปลี่ยนข้อความแจ้งเตือนตามวิธีส่ง
            const msg = deliveryMethod === "STUDENT"
                ? `เจ้าหน้าที่ออกหนังสือส่งตัวแล้ว ให้นักศึกษามารับเอกสารตัวจริงที่คณะ หรือดาวน์โหลดไปยื่นบริษัทในวันรายงานตัว`
                : `เจ้าหน้าที่ออกหนังสือส่งตัวและจัดส่งให้บริษัทล่วงหน้าเรียบร้อยแล้ว`;
            formData.append("comment", msg);

            formData.append("placeDocNumber", placeDocNumber);
            formData.append("placeDocDate", placeDocDate);

            if (fileToSend) {
                formData.append("file", fileToSend);
            }

            const token = localStorage.getItem("coop.token");

            await fetch("http://localhost:5000/api/admin/t000/review", {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            alert("✅ บันทึกเข้าระบบเรียบร้อย");
            onSuccess();
        } catch (err) {
            console.error(err);
            alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        }
    };

    return (
        <div className="modal-backdrop" style={{ zIndex: 10000 }}>
            <div
                className="modal-card"
                style={{ width: "95%", height: "95%", maxWidth: "1400px" }}
            >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 12, borderBottom: "1px solid #eee" }}>
                    <h3 style={{ margin: 0 }}>📄 ออกหนังสือส่งตัว (Placement Letter)</h3>
                    <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 24, cursor: "pointer" }}>&times;</button>
                </div>

                {/* Body */}
                <div style={{ display: "flex", gap: 24, height: "100%", paddingTop: 20, overflow: "hidden" }}>
                    {/* PDF Preview */}
                    <div style={{ flex: 1, background: "#525659", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                        {pdfUrl ? (
                            <iframe src={pdfUrl} title="PDF Preview" style={{ border: "none", flex: 1 }} />
                        ) : (
                            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#ccc", gap: 10 }}>
                                <div style={{ fontSize: 40 }}>📄</div>
                                <div>ยังไม่มีไฟล์ในระบบ กดปุ่ม <b>"สร้างไฟล์..."</b> เพื่อเริ่มทำงาน</div>
                            </div>
                        )}
                    </div>

                    {/* Right Panel */}
                    <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 15, flexShrink: 0, overflowY: 'auto', paddingRight: 5 }}>

                        {/* Section 1 */}
                        <div style={{ fontSize: 14, fontWeight: "bold", color: "#334155", borderBottom: "2px solid #3b82f6", paddingBottom: 4 }}>
                            1. ข้อมูลหนังสือ
                        </div>

                        <div>
                            <label style={labelStyle}>เลขที่หนังสือ</label>
                            <input className="input" value={placeDocNumber} onChange={e => setPlaceDocNumber(e.target.value)} />
                        </div>

                        <div>
                            <label style={labelStyle}>วันที่ออกหนังสือ</label>
                            <input type="date" className="input" value={placeDocDate} onChange={e => setPlaceDocDate(e.target.value)} />
                        </div>

                        {/* Section 2: PDF Actions */}
                        <div style={{ fontSize: 14, fontWeight: 'bold', color: '#334155', borderBottom: '2px solid #f59e0b', paddingBottom: 4, marginTop: 10 }}>2. สร้างเอกสาร PDF</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <button className="btn btn-secondary" onClick={() => handlePreview(true)} disabled={loading}>
                                {loading ? '⏳ กำลังสร้าง...' : '🖊️ สร้างไฟล์ (มีรูปลายเซ็น)'}
                            </button>
                            <button className="btn btn-outline" onClick={() => handlePreview(false)} disabled={loading}>
                                {loading ? '⏳ กำลังสร้าง...' : '📝 สร้างไฟล์ (เว้นลายเซ็นสำหรับเซ็นสด)'}
                            </button>
                        </div>

                        {pdfUrl && !customUploadFile && (
                            <button className="btn" style={{ background: '#3b82f6', color: 'white', marginTop: 5 }} onClick={handleDownload}>
                                ⬇️ ดาวน์โหลด PDF ลงเครื่อง
                            </button>
                        )}

                        {/* ✅ SECTION อัปโหลดไฟล์เซ็นสด */}
                        <div style={{ padding: '12px', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 8, marginTop: 5 }}>
                            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#334155', marginBottom: 8 }}>
                                📎 อัปโหลดไฟล์ฉบับสมบูรณ์ (ที่เซ็นแล้ว)
                            </div>

                            {/* แสดงสถานะไฟล์ */}
                            {customUploadFile ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0f9ff', padding: '8px', borderRadius: '6px', border: '1px solid #bae6fd', marginBottom: 8 }}>
                                    <span style={{ fontSize: 12, color: '#0369a1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {customUploadFile.name}</span>
                                    <button onClick={handleRemoveFile} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>✖</button>
                                </div>
                            ) : existingDoc ? (
                                <div style={{ marginBottom: 10, padding: '8px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: 12, color: '#166534' }}>
                                    ✅ มีเอกสารในระบบแล้ว <br /><span style={{ fontSize: 10 }}>ถ้าต้องการเปลี่ยนให้เลือกไฟล์ใหม่ด้านล่าง</span>
                                </div>
                            ) : null}

                            {/* ปุ่มเลือกไฟล์ซ่อน/แสดงตามเงื่อนไข */}
                            {!customUploadFile && (
                                <input
                                    id="custom-upload-placement" type="file" accept="application/pdf" className="input"
                                    style={{ fontSize: 12, padding: '6px', width: '100%', boxSizing: 'border-box' }}
                                    onChange={handleFileUpload}
                                />
                            )}

                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                * หากไม่แนบไฟล์ ระบบจะใช้ PDF ที่พรีวิวด้านซ้าย ส่งเข้าระบบให้นักศึกษาอัตโนมัติ
                            </div>
                        </div>

                        {/* Section 3: Delivery Method */}
                        <div style={{ fontSize: 14, fontWeight: 'bold', color: '#334155', borderBottom: '2px solid #10b981', paddingBottom: 4, marginTop: 10 }}>3. การจัดส่งเอกสารให้บริษัท</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                                <input type="radio" name="delivery" value="STUDENT" checked={deliveryMethod === "STUDENT"} onChange={() => setDeliveryMethod("STUDENT")} style={{ marginTop: 2 }} />
                                <div>
                                    <b>ให้นักศึกษามารับ / ดาวน์โหลดไปยื่นเอง</b>
                                    <div style={{ color: '#64748b', fontSize: 12 }}>แจ้งเตือนให้นักศึกษาทราบว่าสามารถมารับเอกสารที่คณะ หรือดาวน์โหลดจากระบบไปยื่นในวันรายงานตัว</div>
                                </div>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginTop: 5 }}>
                                <input type="radio" name="delivery" value="STAFF" checked={deliveryMethod === "STAFF"} onChange={() => setDeliveryMethod("STAFF")} style={{ marginTop: 2 }} />
                                <div>
                                    <b>เจ้าหน้าที่ส่งไปรษณีย์ / อีเมลให้บริษัท</b>
                                    <div style={{ color: '#64748b', fontSize: 12 }}>ระบบจะแจ้งนักศึกษาว่าคณะได้จัดส่งเอกสารให้บริษัทเรียบร้อยแล้ว</div>
                                </div>
                            </label>
                        </div>

                        <div style={{ marginTop: "auto", paddingTop: 15, paddingBottom: 10 }}>
                            <button className="btn btn-success" onClick={handleConfirm} disabled={!pdfUrl} style={{ width: '100%', padding: '14px' }}>
                                🚀 บันทึกเข้าระบบ & แจ้งนักศึกษา
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
        .input { width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: inherit; font-size: 14px; box-sizing: border-box; }
        .btn { padding: 10px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; transition: 0.2s; }
        .btn-secondary { background: #e2e8f0; color: #334155; } .btn-secondary:hover { background: #cbd5e1; }
        .btn-outline { background: white; color: #3b82f6; border: 1px solid #3b82f6; } .btn-outline:hover { background: #eff6ff; }
        .btn-success { background: #10b981; color: white; } .btn-success:hover { background: #059669; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 10000; }
        .modal-card { background: white; padding: 24px; border-radius: 16px; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
      `}</style>
        </div>
    );
}

// Shared styles
const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
    marginBottom: 4,
    display: "block"
};