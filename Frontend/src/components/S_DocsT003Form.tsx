import React, { useState } from "react";
import { createT003PDF } from "../utils/pdfGeneratorT003"; // สร้างไฟล์นี้เตรียมไว้ในอนาคต
import StatusBadge from "./StatusBadge";

interface Props {
    profile: any;
    onRefresh: () => void;
}

export default function S_DocsT003Form({ profile, onRefresh }: Props) {
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);

    // --- ตรวจสอบสถานะไฟล์ T003 ---
    const uploadedT003 = profile?.documents?.find((d: any) => d.type === 'T003_FORM');
    let currentStatusToShow = profile?.docStatus;

    if (profile?.docStatus === 'T003_EDITS_REQUIRED' || uploadedT003?.status === 'REJECTED') {
        currentStatusToShow = 'T003_EDITS_REQUIRED';
    } else if (uploadedT003 && uploadedT003.status !== 'REJECTED') {
        currentStatusToShow = 'T003_SUBMITTED';
    }

    // --- ดึงข้อมูลจาก Profile มาโชว์ (อ่านอย่างเดียว) ---
    const company = profile?.coop?.company || profile?.company || {};

    const savedT003 = profile?.t003Form || {};
    // --- State เก็บข้อมูลฟอร์ม (หน้า 2) ---
    const [formData, setFormData] = useState({
        reportTitleTh: savedT003.reportTitleTh || "",
        reportTitleEn: savedT003.reportTitleEn || "",
        objectives: savedT003.objectives || "",
        expectedOutcomes: savedT003.expectedOutcomes || "",
        significance: savedT003.significance || "",
        references: savedT003.references || "",
        methodology: savedT003.methodology || "",
        scope: savedT003.scope || "",
        otherSuggestions: savedT003.otherSuggestions || ""
    });

    // --- State เก็บข้อมูลแผนปฏิบัติงาน 16 สัปดาห์ (หน้า 3) ---
    // โครงสร้าง: [{ task: "ศึกษาข้อมูลระบบ", weeks: [1, 2, 3] }, ...]

    const initialWorkPlan = savedT003.workPlan
        ? (typeof savedT003.workPlan === 'string' ? JSON.parse(savedT003.workPlan) : savedT003.workPlan)
        : [{ task: "", weeks: [] }, { task: "", weeks: [] }, { task: "", weeks: [] }];

    const [workPlan, setWorkPlan] = useState<{ task: string; weeks: number[] }[]>(initialWorkPlan);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // --- จัดการแผนปฏิบัติงาน ---
    const handleTaskChange = (index: number, value: string) => {
        const newPlan = [...workPlan];
        newPlan[index].task = value;
        setWorkPlan(newPlan);
    };

    const toggleWeek = (taskIndex: number, weekNumber: number) => {
        const newPlan = [...workPlan];
        const weeks = newPlan[taskIndex].weeks;
        if (weeks.includes(weekNumber)) {
            newPlan[taskIndex].weeks = weeks.filter(w => w !== weekNumber); // เอาออก
        } else {
            newPlan[taskIndex].weeks.push(weekNumber); // ใส่เพิ่ม
        }
        setWorkPlan(newPlan);
    };

    const addWorkPlanRow = () => setWorkPlan([...workPlan, { task: "", weeks: [] }]);
    const removeWorkPlanRow = (index: number) => setWorkPlan(workPlan.filter((_, i) => i !== index));

    // ==========================================
    // 1. ฟังก์ชันเปิดดูตัวอย่าง PDF
    // ==========================================
    const handlePreviewPDF = async () => {
        setLoading(true);
        try {
            // รวมข้อมูลฟอร์ม และ ตารางแผนงาน ส่งไปให้ PDF Generator
            const payloadToPDF = { ...formData, workPlan };
            const doc = await createT003PDF(profile, payloadToPDF);

            const blob = doc.output("blob");
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
            setShowModal(true);
        } catch (err) {
            console.error(err);
            alert("เกิดข้อผิดพลาดในการสร้าง PDF");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!previewUrl) return;
        const link = document.createElement("a");
        link.href = previewUrl;
        link.download = `KKU_CP_T003_${profile?.studentId || 'form'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem("coop.token");
            const res = await fetch("http://localhost:5000/api/docs/t003-form", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ ...formData, workPlan })
            });

            if (res.ok) {
                alert("💾 บันทึกข้อมูลแบบร่าง T003 เรียบร้อยแล้ว! (สามารถกลับมาแก้ไขได้ภายหลัง)");
                // แนะนำให้เรียก onRefresh() เผื่อให้อัปเดต Profile ล่าสุด
                if (typeof onRefresh === 'function') onRefresh();
                setTimeout(() => window.location.reload(), 500);
            } else {
                alert("❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล");
            }
        } catch (err) {
            console.error(err);
            alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmUpload = async () => {
        if (!selectedUploadFile) return;
        setLoading(true);
        try {
            const uploadData = new FormData();
            uploadData.append("files", selectedUploadFile);
            uploadData.append("docType", "T003_FORM"); // ⚠️ ระบุว่าเป็น T003

            const token = localStorage.getItem("coop.token");
            const res = await fetch("http://localhost:5000/api/docs/upload", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: uploadData
            });

            if (res.ok) {
                alert("✅ อัปโหลดแบบฟอร์ม T003 สำเร็จ!");
                setSelectedUploadFile(null);
                if (typeof onRefresh === 'function') onRefresh();
                setTimeout(() => window.location.reload(), 500);
            } else {
                alert("❌ เกิดข้อผิดพลาดในการอัปโหลด");
            }
        } catch (error) {
            console.error(error);
            alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', background: '#fff', padding: 30, borderRadius: 12, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>

            {/* --- HEADER --- */}
            <div style={{ borderBottom: '2px solid #2563eb', paddingBottom: 15, marginBottom: 25, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 style={{ color: '#1e3a8a', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                        แบบฟอร์ม T003 (Proposal)
                        <StatusBadge status={currentStatusToShow} />
                    </h2>
                    <p style={{ color: '#64748b', margin: 0 }}>แบบแจ้งโครงร่างรายงานการปฏิบัติงานสหกิจศึกษา (ส่งภายในสัปดาห์ที่ 3)</p>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                    <button type="button" onClick={handlePreviewPDF} disabled={loading} style={{ ...btnOutline, borderColor: '#2563eb', color: '#2563eb' }}>
                        👁️ ดูตัวอย่าง / โหลด PDF
                    </button>
                </div>
            </div>

            {/* --- ฟอร์มกรอกข้อมูล (STEP 1) --- */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* ส่วนที่ 0: ข้อมูล Auto-fill (โชว์เฉยๆ ให้นักศึกษาดู) */}
                <Section title="ข้อมูลนักศึกษาและสถานประกอบการ (ระบบดึงข้อมูลอัตโนมัติ)">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, fontSize: 14, color: '#475569' }}>
                        <div><b>ชื่อ-สกุล:</b> {profile?.firstName} {profile?.lastName}</div>
                        <div><b>รหัสนักศึกษา:</b> {profile?.studentId}</div>
                        <div><b>สถานประกอบการ:</b> {company?.name || "-"}</div>
                        <div><b>จังหวัด:</b> {company?.province || "-"}</div>
                    </div>
                </Section>

                {/* ส่วนที่ 1: รายละเอียดโครงร่าง */}
                <Section title="1. ขอแจ้งรายละเอียดเกี่ยวกับโครงร่างรายงาน (อาจเปลี่ยนแปลงได้ภายหลัง)">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                        <Input label="หัวข้อรายงาน (ภาษาไทย)" name="reportTitleTh" value={formData.reportTitleTh} onChange={handleChange} />
                        <Input label="หัวข้อรายงาน (English)" name="reportTitleEn" value={formData.reportTitleEn} onChange={handleChange} />
                        <TextArea label="2. วัตถุประสงค์" name="objectives" value={formData.objectives} onChange={handleChange} />
                        <TextArea label="3. ผลที่คาดว่าจะได้รับ" name="expectedOutcomes" value={formData.expectedOutcomes} onChange={handleChange} />
                        <TextArea label="4. ความสำคัญ และที่มา" name="significance" value={formData.significance} onChange={handleChange} />
                        <TextArea label="5. เอกสารอ้างอิง" name="references" value={formData.references} onChange={handleChange} />
                        <TextArea label="6. ระเบียบวิธีดำเนินโครงงาน" name="methodology" value={formData.methodology} onChange={handleChange} />
                        <TextArea label="7. ขอบเขตของโครงงาน" name="scope" value={formData.scope} onChange={handleChange} />
                        <TextArea label="8. ข้อเสนอแนะอื่นๆ (ถ้ามี)" name="otherSuggestions" value={formData.otherSuggestions} onChange={handleChange} />
                    </div>
                </Section>

                {/* ส่วนที่ 2: แผนปฏิบัติงาน (ตาราง 16 สัปดาห์) */}
                <Section title="แผนปฏิบัติงานสหกิจศึกษา (คลิกเพื่อเลือกสัปดาห์ที่ทำ)">
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'center' }}>
                            <thead>
                                <tr>
                                    <th rowSpan={2} style={{ border: '1px solid #cbd5e1', padding: 8, width: '30%', background: '#f8fafc' }}>หัวข้องาน</th>
                                    <th colSpan={4} style={{ border: '1px solid #cbd5e1', padding: 4, background: '#e0f2fe' }}>เดือนที่ 1</th>
                                    <th colSpan={4} style={{ border: '1px solid #cbd5e1', padding: 4, background: '#f0fdfa' }}>เดือนที่ 2</th>
                                    <th colSpan={4} style={{ border: '1px solid #cbd5e1', padding: 4, background: '#e0f2fe' }}>เดือนที่ 3</th>
                                    <th colSpan={4} style={{ border: '1px solid #cbd5e1', padding: 4, background: '#f0fdfa' }}>เดือนที่ 4</th>
                                    <th rowSpan={2} style={{ border: '1px solid #cbd5e1', padding: 8, width: '5%', background: '#f8fafc' }}>ลบ</th>
                                </tr>
                                <tr>
                                    {Array.from({ length: 16 }).map((_, i) => (
                                        <th key={i} style={{ border: '1px solid #cbd5e1', padding: '4px 2px', width: '4%', fontSize: 11, background: '#f8fafc' }}>{i + 1}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {workPlan.map((row, rIndex) => (
                                    <tr key={rIndex}>
                                        <td style={{ border: '1px solid #cbd5e1', padding: 4 }}>
                                            <input
                                                type="text"
                                                value={row.task}
                                                onChange={(e) => handleTaskChange(rIndex, e.target.value)}
                                                style={{ width: '100%', border: 'none', outline: 'none', padding: 4 }}
                                                placeholder={`งานที่ ${rIndex + 1}`}

                                            />
                                        </td>
                                        {Array.from({ length: 16 }).map((_, wIndex) => {
                                            const weekNum = wIndex + 1;
                                            const isChecked = row.weeks.includes(weekNum);
                                            return (
                                                <td key={wIndex} style={{ border: '1px solid #cbd5e1', padding: 0, cursor: 'pointer', background: isChecked ? '#bae6fd' : 'white' }} onClick={() => toggleWeek(rIndex, weekNum)}>
                                                    <div style={{ width: '100%', height: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                        {isChecked && <span style={{ color: '#0284c7', fontWeight: 'bold' }}>✓</span>}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        <td style={{ border: '1px solid #cbd5e1', padding: 4 }}>
                                            <button type="button" onClick={() => removeWorkPlanRow(rIndex)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button type="button" onClick={addWorkPlanRow} style={{ marginTop: 10, padding: '6px 12px', background: '#f1f5f9', border: '1px dashed #94a3b8', borderRadius: 6, cursor: 'pointer', fontSize: 13, width: '100%' }}>
                        + เพิ่มหัวข้องาน
                    </button>
                </Section>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                    <button type="submit" style={{ ...btnSubmit, background: '#2563eb' }}>💾 บันทึกข้อมูลร่าง T003</button>
                </div>
            </form>

            {/* --- ส่วนอัปโหลดเอกสาร (STEP 2) --- */}
            <div style={{ marginTop: 40, padding: 24, borderRadius: 12, border: '1px solid #3b82f6', background: '#eff6ff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15 }}>
                    <div style={{ fontSize: 28 }}>📤</div>
                    <div>
                        <h3 style={{ margin: 0, color: '#1e40af' }}>อัปโหลดแบบฟอร์ม T003 (ฉบับลงนามแล้ว)</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#1d4ed8' }}>พิมพ์เอกสาร นำไปให้พนักงานที่ปรึกษาลงนาม แล้วนำมาอัปโหลดที่นี่</p>
                    </div>
                </div>

                {/* กล่องแสดงเหตุผลเมื่อโดนตีกลับ */}
                {currentStatusToShow === 'T003_EDITS_REQUIRED' && (
                    <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 24 }}>
                        <h4 style={{ margin: '0 0 8px 0', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>⚠️ เอกสารต้องแก้ไข</h4>
                        <p style={{ margin: 0, color: '#991b1b', fontSize: 14 }}><b>เหตุผลจากอาจารย์/เจ้าหน้าที่:</b> {uploadedT003?.rejectReason || "กรุณาตรวจสอบและอัปโหลดไฟล์ใหม่"}</p>
                    </div>
                )}

                {/* ระบบ Upload (ทำงานเหมือน T002) */}
                {uploadedT003 && !selectedUploadFile ? (
                    <div style={{ padding: 16, background: '#fff', border: '1px solid #93c5fd', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: 14, color: '#1e40af', fontWeight: 'bold' }}>✅ ส่งแบบฟอร์ม T003 แล้ว</div>
                            <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 4 }}>ไฟล์: {uploadedT003.name}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn-outline" onClick={() => window.open(`http://localhost:5000/uploads/${uploadedT003.path}`, '_blank')} style={{ ...btnOutline, borderColor: '#3b82f6', color: '#3b82f6' }}>👁️ ดูไฟล์ที่ส่ง</button>
                            <label htmlFor="upload-t003-change" style={{ ...btnOutline, cursor: 'pointer', textAlign: 'center', borderColor: currentStatusToShow === 'T003_EDITS_REQUIRED' ? '#ef4444' : '#f59e0b', color: currentStatusToShow === 'T003_EDITS_REQUIRED' ? '#dc2626' : '#d97706' }}>
                                {currentStatusToShow === 'T003_EDITS_REQUIRED' ? '🔄 ส่งไฟล์ใหม่' : '🔄 เปลี่ยนไฟล์'}
                            </label>
                            <input type="file" id="upload-t003-change" style={{ display: 'none' }} accept=".pdf,.jpg,.png" onChange={(e) => e.target.files?.[0] && setSelectedUploadFile(e.target.files[0])} />
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: 20, background: '#fff', border: `1px dashed ${selectedUploadFile ? '#f59e0b' : '#3b82f6'}`, borderRadius: 8 }}>
                        {selectedUploadFile ? (
                            <div>
                                <div style={{ fontSize: 14, color: '#d97706', marginBottom: 12, fontWeight: 'bold' }}>⏳ ไฟล์ที่เลือก: {selectedUploadFile.name}</div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={() => setSelectedUploadFile(null)} disabled={loading} style={{ flex: 1, padding: 10, background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>ยกเลิก</button>
                                    <button onClick={handleConfirmUpload} disabled={loading} style={{ flex: 1, padding: 10, background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
                                        {loading ? '⏳ กำลังอัปโหลด...' : '🚀 ยืนยันส่งไฟล์ T003'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center' }}>
                                <input type="file" id="upload-t003" style={{ display: 'none' }} accept=".pdf,.jpg,.png" onChange={(e) => e.target.files?.[0] && setSelectedUploadFile(e.target.files[0])} />
                                <label htmlFor="upload-t003" style={{ ...btnSubmit, background: '#2563eb', display: 'inline-block' }}>📂 เลือกไฟล์ T003 เพื่ออัปโหลด</label>
                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>(รองรับไฟล์ .pdf, .jpg, .png)</div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showModal && previewUrl && (
                <div style={modalBackdropStyle}>
                    <div style={modalCardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
                            <h3 style={{ margin: 0, color: '#1e3a8a' }}>📄 ตัวอย่างแบบฟอร์ม CP-T003 (Proposal)</h3>
                            <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>&times;</button>
                        </div>
                        <div style={{ flex: 1, background: '#525659', padding: '10px' }}>
                            <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 4 }} title="PDF Preview" />
                        </div>
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 12, background: '#f8fafc' }}>
                            <button onClick={handleCloseModal} style={btnOutline}>ปิด</button>
                            <button onClick={handleDownloadPDF} style={{ ...btnSubmit, background: '#2563eb' }}>⬇️ ดาวน์โหลด PDF ลงเครื่อง</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- UI Helper Components ---
const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '12px 15px', fontWeight: 'bold', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>{title}</div>
        <div style={{ padding: 15 }}>{children}</div>
    </div>
);

const Input = ({ label, ...props }: any) => (
    <div>
        {/* โชว์ดาวแดงเฉพาะเมื่อมีการส่งค่า required=true มา */}
        <label style={lblStyle}>{label} {props.required && <span style={{ color: 'red' }}>*</span>}</label>
        <input style={inputStyle} {...props} />
    </div>
);

const TextArea = ({ label, ...props }: any) => (
    <div>
        <label style={lblStyle}>{label} {props.required && <span style={{ color: 'red' }}>*</span>}</label>
        {/* ⚠️ เอาคำว่า required ที่เคยฝังตัวแดงๆ ตรงนี้ออกไป */}
        <textarea style={inputStyle} rows={3} {...props} />
    </div>
);

// --- Styles ---
const lblStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 14 };
const btnOutline: React.CSSProperties = { padding: '10px 16px', background: 'white', border: '1px solid #cbd5e1', color: '#475569', borderRadius: 8, cursor: 'pointer', fontWeight: 600 };
const btnSubmit: React.CSSProperties = { padding: '10px 24px', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 15 };
const modalBackdropStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 };
const modalCardStyle: React.CSSProperties = { background: 'white', width: '90%', maxWidth: '1000px', height: '90vh', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' };