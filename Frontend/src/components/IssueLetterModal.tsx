// Frontend/src/components/IssueLetterModal.tsx 
//หนังสืออนุเคราะห์
import React, { useState } from "react";
import { createDispatchPDF } from "../utils/pdfDispatchGenerator";

interface Props {
    student: any;
    onClose: () => void;
    onSuccess: () => void;
}

export default function IssueLetterModal({ student, onClose, onSuccess }: Props) {
    const [docNumber, setDocNumber] = useState("660301.26.6.2/.......");
    const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    // --- Logic วันที่ ---
    const startDate =
        student.coop?.actualStartDate ? new Date(student.coop.actualStartDate).toISOString().split('T')[0] :
            student.coopApplicationForm?.startDate ? new Date(student.coopApplicationForm.startDate).toISOString().split('T')[0] : "";

    const endDate =
        student.coop?.actualEndDate ? new Date(student.coop.actualEndDate).toISOString().split('T')[0] :
            student.coopApplicationForm?.endDate ? new Date(student.coopApplicationForm.endDate).toISOString().split('T')[0] : "";

    // Helper วันที่ไทย
    const toThaiDate = (dateStr: string) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    // Helper ข้อมูล
    const studentName = `${student.firstName} ${student.lastName}`;
    const companyName = student.coop?.company?.name || "-";

    const handlePreview = async () => {
        setLoading(true);
        try {
            const resAssets = await fetch("http://localhost:5000/api/admin/assets");
            const dataAssets = await resAssets.json();
            const assets = dataAssets.assets || [];

            const getAssetUrl = (key: string) => {
                const found = assets.find((a: any) => a.key === key);
                return found ? `http://localhost:5000/uploads/system/${found.path}` : null;
            };

            const krutUrl = getAssetUrl("KRUT");
            const sigUrl = getAssetUrl("SIGNATURE");
            const projectUrl = getAssetUrl("PROJECT_DETAILS");
            const acceptUrl = getAssetUrl("ACCEPTANCE_FORM");

            if (!krutUrl || !projectUrl || !acceptUrl) return alert("⚠️ ไม่พบไฟล์แม่แบบ");

            const studentFiles = (student.documents || []).map((d: any) => ({ type: d.type, url: `http://localhost:5000/uploads/${d.path}` }));

            const previewProfile = {
                ...student,
                coop: {
                    ...student.coop,
                    actualStartDate: startDate,
                    actualEndDate: endDate,
                    coopApplicationForm: { startDate, endDate }
                }
            };

            const blob = await createDispatchPDF(previewProfile, docNumber, docDate, krutUrl, sigUrl || "", projectUrl, acceptUrl, studentFiles);
            setPdfUrl(URL.createObjectURL(blob));
        } catch (err) { alert("Error: " + err); } finally { setLoading(false); }
    };

    const handleConfirm = async () => {
        if (!confirm("ยืนยันการออกหนังสือ?")) return;

        try {
            // 1. แปลง Blob URL กลับมาเป็น File Object
            let fileToSend = null;
            if (pdfUrl) {
                const blob = await fetch(pdfUrl).then(r => r.blob());
                // ตั้งชื่อไฟล์ เช่น dispatch_653380000-1.pdf
                fileToSend = new File([blob], `dispatch_${student.studentId}.pdf`, { type: "application/pdf" });
            }

            // 2. ใช้ FormData แทน JSON
            const formData = new FormData();
            formData.append("studentId", student.id);
            formData.append("status", "REQ_LETTER_ISSUED");
            formData.append("comment", `ออกหนังสือเลขที่ ${docNumber} เรียบร้อยแล้ว`);
            formData.append("reqDocNumber", docNumber);
            formData.append("reqDocDate", docDate);
            formData.append("actualStartDate", startDate);
            formData.append("actualEndDate", endDate);

            // ✅ แนบไฟล์ PDF ไปด้วย
            if (fileToSend) {
                formData.append("file", fileToSend);
            }

            const token = localStorage.getItem("coop.token");

            // 3. ส่งไปที่ Server (ไม่ต้องใส่ Content-Type, Browser จะจัดการเอง)
            await fetch("http://localhost:5000/api/admin/t000/review", {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            alert("✅ บันทึกและจัดเก็บไฟล์เรียบร้อย");
            onSuccess();

        } catch (err) {
            console.error(err);
            alert("Error updating status");
        }
    };

    return (
        <div className="modal-backdrop" style={{ zIndex: 10000 }}>
            <div className="modal-card" style={{ width: '95%', height: '95%', maxWidth: '1400px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #eee' }}>
                    <h3 style={{ margin: 0 }}>📄 ออกหนังสือส่งตัว (Dispatch Letter)</h3>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer' }}>&times;</button>
                </div>

                <div style={{ display: 'flex', gap: 24, height: '100%', paddingTop: 20, overflow: 'hidden' }}>

                    {/* --- COLUMN 1: PDF PREVIEW (Remaining) --- */}
                    <div style={{ flex: 1, background: '#525659', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {pdfUrl ? (
                            <iframe src={pdfUrl} width="100%" height="100%" style={{ border: 'none', flex: 1 }} title="PDF Preview" />
                        ) : (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ccc', gap: 10 }}>
                                <div style={{ fontSize: 40 }}>📄</div>
                                <div>กดปุ่ม <b>"ดูตัวอย่าง"</b> เพื่อสร้างเอกสาร</div>
                            </div>
                        )}
                    </div>

                    <div style={{ width: '300px', display: 'flex', flexDirection: 'row', gap: 15, flexShrink: 0 }}>
                        {/* --- COLUMN 2: INPUT FORM (20%) --- */}
                        <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: 15, flexShrink: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 'bold', color: '#334155', borderBottom: '2px solid #3b82f6', paddingBottom: 4, marginBottom: 4 }}>1. ข้อมูลหนังสือ</div>

                            <div>
                                <label style={labelStyle}>เลขที่หนังสือ (ที่ อว...)</label>
                                <input className="input" value={docNumber} onChange={e => setDocNumber(e.target.value)} />
                            </div>
                            <div>
                                <label style={labelStyle}>วันที่ออกหนังสือ</label>
                                <input type="date" className="input" value={docDate} onChange={e => setDocDate(e.target.value)} />
                            </div>

                            <div style={{ fontSize: 14, fontWeight: 'bold', color: '#334155', borderBottom: '2px solid #f59e0b', paddingBottom: 4, marginBottom: 4 }}>2. ตรวจสอบข้อมูล</div>

                            {/* Card: นักศึกษา */}
                            <div style={infoCardStyle}>
                                <div style={infoLabelStyle}>👤 นักศึกษา</div>
                                <div style={infoValueStyle}>{studentName}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{student.studentId}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{student.major || "-"}</div>
                            </div>

                            {/* Card: บริษัท */}
                            <div style={infoCardStyle}>
                                <div style={infoLabelStyle}>🏢 สถานประกอบการ</div>
                                <div style={infoValueStyle}>{companyName}</div>
                            </div>

                            {/* Card: วันที่ฝึกงาน */}
                            <div style={{ ...infoCardStyle, background: '#f0f9ff', borderColor: '#bae6fd' }}>
                                <div style={{ ...infoLabelStyle, color: '#0369a1' }}>📅 ระยะเวลาปฏิบัติงาน</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 4, fontSize: 13, marginBottom: 8 }}>
                                    <span style={{ color: '#64748b' }}>เริ่ม:</span>
                                    <span style={{ fontWeight: 600 }}>{toThaiDate(startDate)}</span>
                                    <span style={{ color: '#64748b' }}>ถึง:</span>
                                    <span style={{ fontWeight: 600 }}>{toThaiDate(endDate)}</span>
                                </div>
                                <div style={{ fontSize: 11, color: '#0c4a6e', background: 'rgba(255,255,255,0.6)', padding: 6, borderRadius: 4 }}>
                                    * ดึงจากใบตอบรับ/ใบสมัคร
                                </div>
                            </div>

                            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <button className="btn btn-secondary" onClick={handlePreview} disabled={loading}>
                                    {loading ? '⏳ กำลังโหลด...' : '👁️ ดูตัวอย่าง (Preview)'}
                                </button>
                                <button className="btn btn-success" onClick={handleConfirm} disabled={!pdfUrl}>
                                    🚀 ยืนยันการออกหนังสือ
                                </button>
                            </div>
                        </div>


                    </div>
                </div>
            </div>

            <style>{`
        .input { width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: inherit; font-size: 14px; }
        .btn { padding: 12px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; transition: 0.2s; }
        .btn-secondary { background: #e2e8f0; color: #334155; }
        .btn-success { background: #10b981; color: white; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; justify-content: center; alignItems: center; z-index: 10000; }
        .modal-card { background: white; padding: 24px; border-radius: 16px; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
      `}</style>
        </div>
    );
}

// Styles
const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4, display: 'block' };
const infoCardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };
const infoLabelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 };
const infoValueStyle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 2 };