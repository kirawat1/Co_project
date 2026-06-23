import React, { useState, useEffect } from "react";
import { createT002PDF } from "../utils/pdfGeneratorT002";
import StatusBadge from "./StatusBadge";
import CountdownTimer from "../components/CountdownTimer"; // ✅ Import มาแล้ว
import AutoTextarea from "./AutoTextarea";
import { apiFetch } from "../utils/apiFetch";

interface Props {
    profile: any;
    onRefresh: () => void;
}

export default function S_DocsT002Form({ profile, onRefresh }: Props) {
    const [loading, setLoading] = useState(false);

    // 🟢 State สำหรับ Config เวลาเปิด-ปิดระบบ
    const [config, setConfig] = useState<any>(null);
    const [isSystemOpen, setIsSystemOpen] = useState(true);

    // --- State สำหรับ Popup Preview ---
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);

    // --- State สำหรับอัปโหลดไฟล์ ---
    const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);

    const uploadedT002 = profile?.documents?.find((d: any) => d.type === 'T002_FORM');
    const company = profile?.coop?.company || profile?.company || {};
    const mentor = profile?.coop?.mentor || profile?.mentor || {};
    const appForm = profile?.coopApplicationForm || {};
    const savedT002 = profile?.t002Form || {};

    let currentStatusToShow = profile?.docStatus;
    if (profile?.docStatus === 'T002_EDITS_REQUIRED' || uploadedT002?.status === 'REJECTED') {
        currentStatusToShow = 'T002_EDITS_REQUIRED';
    } else if (uploadedT002 && uploadedT002.status !== 'REJECTED') {
        currentStatusToShow = 'T002_SUBMITTED';
    }

    // --- State เก็บข้อมูลฟอร์ม ---
    const [formData, setFormData] = useState({
        companyNameTh: savedT002.companyNameTh || company.name || "",
        companyNameEn: savedT002.companyNameEn || company.nameEn || "",
        addressNo: savedT002.addressNo || company.addressNo || "",
        moo: savedT002.moo || company.moo || "",
        soi: savedT002.soi || company.soi || "",
        road: savedT002.road || company.road || "",
        subDistrict: savedT002.subDistrict || company.subDistrict || "",
        district: savedT002.district || company.district || "",
        province: savedT002.province || company.province || "",
        zipcode: savedT002.zipcode || company.zipcode || "",
        companyPhone: savedT002.companyPhone || company.phone || "",
        companyFax: savedT002.companyFax || company.fax || "",
        companyEmail: savedT002.companyEmail || company.email || "",

        managerName: savedT002.managerName || company.contactPerson || "",
        managerPosition: savedT002.managerPosition || company.contactPosition || "",
        managerPhone: savedT002.managerPhone || company.phone || "",
        managerFax: savedT002.managerFax || company.fax || "",
        managerEmail: savedT002.managerEmail || company.email || "",

        coordinatorType: savedT002.coordinatorType || "MANAGER",
        coordName: savedT002.coordName || "",
        coordPosition: savedT002.coordPosition || "",
        coordDept: savedT002.coordDept || "",
        coordPhone: savedT002.coordPhone || "",
        coordFax: savedT002.coordFax || "",
        coordEmail: savedT002.coordEmail || "",

        supervisorName: savedT002.supervisorName || (mentor.firstName ? `${mentor.firstName} ${mentor.lastName}`.trim() : ""),
        supervisorPosition: savedT002.supervisorPosition || mentor.position || "",
        supervisorDept: savedT002.supervisorDept || mentor.department || "",
        supervisorPhone: savedT002.supervisorPhone || mentor.phone || "",
        supervisorFax: savedT002.supervisorFax || "",
        supervisorEmail: savedT002.supervisorEmail || mentor.email || "",

        jobPosition: savedT002.jobPosition || profile?.coop?.jobPosition || profile?.jobPosition || "",
        jobDescription: savedT002.jobDescription || "",

        accommodationAddress: savedT002.accommodationAddress || "",
        accommodationPhone: savedT002.accommodationPhone || profile?.phone || "",

        emergencyName: savedT002.emergencyName || appForm.emergencyName || "",
        emergencyAddress: savedT002.emergencyAddress || appForm.emergencyAddress || "",
        emergencyPhone: savedT002.emergencyPhone || appForm.emergencyPhone || "",
        emergencyFax: savedT002.emergencyFax || "",
        emergencyEmail: savedT002.emergencyEmail || appForm.emergencyEmail || ""
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // 🟢 Fetch Config จาก Backend ตอนโหลดหน้า
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const token = localStorage.getItem("coop.token");
                const res = await apiFetch("/api/admin/config/t002", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setConfig(data);

                    if (!data.isOpen) {
                        setIsSystemOpen(false);
                    } else {
                        const now = new Date().getTime();

                        // เซ็ตเวลาเป้าหมายเป็น 23:59:59 ของวันสุดท้าย
                        const targetEnd = data.endDate ? new Date(data.endDate) : null;
                        if (targetEnd) targetEnd.setHours(23, 59, 59, 999);

                        const start = data.startDate ? new Date(data.startDate).getTime() : 0;
                        const end = targetEnd ? targetEnd.getTime() : Infinity;

                        if (start === 0 && end === Infinity) {
                            setIsSystemOpen(true);
                        } else {
                            setIsSystemOpen(now >= start && now <= end);
                        }
                    }
                }
            } catch (err) {
                console.error("Load config error", err);
            }
        };
        loadConfig();
    }, []);

    // 1. ฟังก์ชันเปิดดูตัวอย่าง PDF
    const handlePreviewPDF = async () => {
        setLoading(true);
        try {
            const payloadToPDF = {
                ...formData,
                coordinatorType: formData.coordinatorType as "MANAGER" | "OTHER"
            };
            const doc = await createT002PDF(profile, payloadToPDF);
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
        link.download = `KKU_CP_T002_${profile?.studentId || 'form'}.pdf`;
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
            const res = await apiFetch("/api/docs/t002-form", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                alert("💾 บันทึกข้อมูลแบบร่าง T002 เรียบร้อยแล้ว! (คุณสามารถกดดูตัวอย่าง PDF และดาวน์โหลดได้เลย)");
                if (typeof onRefresh === 'function') onRefresh();
            } else {
                alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
            }
        } catch (err) {
            console.error(err);
            alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        } finally {
            setLoading(false);
        }
    };

    // ฟังก์ชันอัปโหลดไฟล์ T002 ตัวจริง
    const handleConfirmUpload = async () => {
        if (!selectedUploadFile) return;
        setLoading(true);
        try {
            const uploadData = new FormData();
            uploadData.append("files", selectedUploadFile);
            uploadData.append("docType", "T002_FORM");

            const token = localStorage.getItem("coop.token");
            const res = await apiFetch("/api/docs/upload", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: uploadData
            });

            if (res.ok) {
                alert("✅ อัปโหลดแบบฟอร์ม T002 สำเร็จ!");
                setSelectedUploadFile(null);
                if (typeof onRefresh === 'function') {
                    onRefresh();
                }
                setTimeout(() => {
                    window.location.reload();
                }, 500);

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
        <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', padding: 30, borderRadius: 12, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>

            {/* 🔴 แจ้งเตือนถ้าระบบปิด (UI หลัก) */}
            {!isSystemOpen && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '16px', borderRadius: 8, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 24 }}>🔒</span>
                    <div>
                        <h4 style={{ margin: '0 0 4px 0', color: '#991b1b', fontSize: 16 }}>ขณะนี้ระบบปิดรับเอกสาร T002</h4>
                        <p style={{ margin: 0, color: '#b91c1c', fontSize: 13 }}>หมดเวลาการส่งเอกสาร หรือผู้ดูแลระบบได้ทำการปิดระบบชั่วคราว คุณไม่สามารถอัปโหลดไฟล์ใหม่ได้ในขณะนี้</p>
                    </div>
                </div>
            )}

            {/* --- HEADER และ STATUS BADGE --- */}
            <div style={{ borderBottom: '2px solid #6b21a8', paddingBottom: 15, marginBottom: 25, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 style={{ color: '#4c1d95', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                        แบบฟอร์ม T002
                        <StatusBadge status={currentStatusToShow} />
                    </h2>
                    <p style={{ color: '#64748b', margin: 0 }}>แบบแจ้งรายละเอียดงานและรายละเอียดที่พัก (สัปดาห์แรกของการฝึกงาน)</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>

                    {/* 🟢 เรียกใช้ Component นัับถอยหลังตรงนี้โดยตรงเลย */}
                    <CountdownTimer endDate={config?.endDate} isOpen={config?.isOpen} />

                    <button type="button" onClick={handlePreviewPDF} disabled={loading} style={btnOutline}>
                        {loading ? '⏳ กำลังทำงาน...' : '👁️ ดูตัวอย่าง / โหลด PDF'}
                    </button>
                </div>
            </div>

            {/* --- ฟอร์มกรอกข้อมูล (STEP 1) --- */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24, opacity: isSystemOpen ? 1 : 0.6, pointerEvents: isSystemOpen ? 'auto' : 'none' }}>

                <Section title="1. ข้อมูลสถานประกอบการ (สถานที่ปฏิบัติงานจริง)">
                    <div style={grid2}>
                        <Input label="ชื่อบริษัท (ไทย)" name="companyNameTh" value={formData.companyNameTh} onChange={handleChange} required />
                        <Input label="ชื่อบริษัท (อังกฤษ)" name="companyNameEn" value={formData.companyNameEn} onChange={handleChange} />
                    </div>
                    <div style={grid4}>
                        <Input label="เลขที่" name="addressNo" value={formData.addressNo} onChange={handleChange} required />
                        <Input label="หมู่" name="moo" value={formData.moo} onChange={handleChange} />
                        <Input label="ซอย" name="soi" value={formData.soi} onChange={handleChange} />
                        <Input label="ถนน" name="road" value={formData.road} onChange={handleChange} />
                    </div>
                    <div style={grid4}>
                        <Input label="ตำบล/แขวง" name="subDistrict" value={formData.subDistrict} onChange={handleChange} required />
                        <Input label="อำเภอ/เขต" name="district" value={formData.district} onChange={handleChange} required />
                        <Input label="จังหวัด" name="province" value={formData.province} onChange={handleChange} required />
                        <Input label="รหัสไปรษณีย์" name="zipcode" value={formData.zipcode} onChange={handleChange} required />
                    </div>
                    <div style={grid3}>
                        <Input label="โทรศัพท์" name="companyPhone" value={formData.companyPhone} onChange={handleChange} required />
                        <Input label="โทรสาร (Fax)" name="companyFax" value={formData.companyFax} onChange={handleChange} />
                        <Input label="อีเมล" type="email" name="companyEmail" value={formData.companyEmail} onChange={handleChange} />
                    </div>
                </Section>

                <Section title="2. ผู้จัดการทั่วไป และผู้ประสานงาน">
                    <div style={grid2}>
                        <Input label="ชื่อผู้จัดการ" name="managerName" value={formData.managerName} onChange={handleChange} />
                        <Input label="ตำแหน่งผู้จัดการ" name="managerPosition" value={formData.managerPosition} onChange={handleChange} />
                    </div>
                    <div style={{ marginTop: 15, padding: 15, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <label style={{ fontWeight: 600, display: 'block', marginBottom: 10, color: '#334155' }}>การติดต่อประสานงาน ขอมอบให้:</label>
                        <div style={{ display: 'flex', gap: 20, marginBottom: 15 }}>
                            <label><input type="radio" name="coordinatorType" value="MANAGER" checked={formData.coordinatorType === "MANAGER"} onChange={handleChange} /> ติดต่อผู้จัดการโดยตรง</label>
                            <label><input type="radio" name="coordinatorType" value="OTHER" checked={formData.coordinatorType === "OTHER"} onChange={handleChange} /> มอบหมายบุคคลอื่นประสานงานแทน</label>
                        </div>

                        {formData.coordinatorType === "OTHER" && (
                            <div style={grid3}>
                                <Input label="ชื่อผู้ประสานงาน" name="coordName" value={formData.coordName} onChange={handleChange} />
                                <Input label="ตำแหน่ง" name="coordPosition" value={formData.coordPosition} onChange={handleChange} />
                                <Input label="แผนก" name="coordDept" value={formData.coordDept} onChange={handleChange} />
                                <Input label="โทรศัพท์" name="coordPhone" value={formData.coordPhone} onChange={handleChange} />
                                <Input label="อีเมล" name="coordEmail" value={formData.coordEmail} onChange={handleChange} />
                            </div>
                        )}
                    </div>
                </Section>

                <Section title="3. พนักงานที่ปรึกษา (Job Supervisor / พี่เลี้ยง)">
                    <div style={grid3}>
                        <Input label="ชื่อ-สกุล" name="supervisorName" value={formData.supervisorName} onChange={handleChange} required />
                        <Input label="ตำแหน่ง" name="supervisorPosition" value={formData.supervisorPosition} onChange={handleChange} required />
                        <Input label="แผนก" name="supervisorDept" value={formData.supervisorDept} onChange={handleChange} required />
                        <Input label="โทรศัพท์" name="supervisorPhone" value={formData.supervisorPhone} onChange={handleChange} required />
                        <Input label="อีเมล" name="supervisorEmail" value={formData.supervisorEmail} onChange={handleChange} required />
                    </div>
                </Section>

                <Section title="4. งานที่ได้รับมอบหมาย">
                    <Input label="ตำแหน่งงานของนักศึกษา (Job Position)" name="jobPosition" value={formData.jobPosition} onChange={handleChange} required />
                    <div style={{ marginTop: 10 }}>
                        <label style={lblStyle}>ลักษณะงานที่ปฏิบัติ (Job Description)</label>
                        <AutoTextarea name="jobDescription" value={formData.jobDescription} onChange={handleChange} rows={4} style={inputStyle} required placeholder="อธิบายลักษณะงานที่ได้รับมอบหมายพอสังเขป..." />
                    </div>
                </Section>

                <Section title="5. ข้อมูลที่พักระหว่างฝึกงาน & กรณีฉุกเฉิน">
                    <div style={{ marginBottom: 15 }}>
                        <label style={lblStyle}>ที่อยู่หอพัก / ที่พักปัจจุบัน</label>
                        <AutoTextarea name="accommodationAddress" value={formData.accommodationAddress} onChange={handleChange} rows={2} style={inputStyle} required />
                        <div style={{ marginTop: 10, width: '50%' }}>
                            <Input label="เบอร์โทรศัพท์ที่พัก/เบอร์นักศึกษา" name="accommodationPhone" value={formData.accommodationPhone} onChange={handleChange} required />
                        </div>
                    </div>

                    <div style={{ padding: 15, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#991b1b' }}>บุคคลที่ติดต่อได้ในกรณีฉุกเฉิน</h4>
                        <div style={grid2}>
                            <Input label="ชื่อ-สกุล" name="emergencyName" value={formData.emergencyName} onChange={handleChange} required />
                            <Input label="ความสัมพันธ์ / โทรศัพท์" name="emergencyPhone" value={formData.emergencyPhone} onChange={handleChange} required />
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <label style={lblStyle}>ที่อยู่กรณีฉุกเฉิน</label>
                            <AutoTextarea name="emergencyAddress" value={formData.emergencyAddress} onChange={handleChange} rows={2} style={inputStyle} required />
                        </div>
                    </div>
                </Section>

                {isSystemOpen && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                        <button type="submit" style={btnSubmit}>💾 บันทึกข้อมูลร่าง T002</button>
                    </div>
                )}
            </form>

            {/* --- ส่วนอัปโหลดเอกสาร (STEP 2) --- */}
            <div style={{ marginTop: 30, padding: 24, borderRadius: 12, border: '1px solid #10b981', background: '#ecfdf5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15 }}>
                    <div style={{ fontSize: 28 }}>📤</div>
                    <div>
                        <h3 style={{ margin: 0, color: '#047857' }}>อัปโหลดแบบฟอร์ม T002 (ฉบับลงนามแล้ว)</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#059669' }}>พิมพ์เอกสาร นำไปให้พนักงานที่ปรึกษาลงนาม แล้วนำมาอัปโหลดที่นี่</p>
                    </div>
                </div>

                {currentStatusToShow === 'T002_EDITS_REQUIRED' && (
                    <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 24 }}>
                        <h4 style={{ margin: '0 0 8px 0', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
                            ⚠️ เอกสารต้องแก้ไข
                        </h4>
                        <p style={{ margin: 0, color: '#991b1b', fontSize: 14 }}>
                            <b>เหตุผลจากเจ้าหน้าที่:</b> {uploadedT002?.rejectReason || "กรุณาตรวจสอบและอัปโหลดไฟล์ใหม่"}
                        </p>
                    </div>
                )}

                {uploadedT002 && !selectedUploadFile ? (
                    <div style={{ padding: 16, background: '#fff', border: '1px solid #34d399', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 15 }}>
                        <div>
                            <div style={{ fontSize: 14, color: '#065f46', fontWeight: 'bold' }}>✅ ส่งแบบฟอร์ม T002 แล้ว</div>
                            <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>ไฟล์: {uploadedT002.name}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn-outline" onClick={() => window.open(`/uploads/${uploadedT002.path}`, '_blank')} style={{ ...btnOutline, borderColor: '#10b981', color: '#10b981' }}>👁️ ดูไฟล์ที่ส่ง</button>

                            {/* ปิดปุ่มส่งใหม่ถ้าระบบปิด */}
                            {isSystemOpen && (
                                <>
                                    <label htmlFor="upload-t002-change" style={{ ...btnOutline, cursor: 'pointer', textAlign: 'center', borderColor: currentStatusToShow === 'T002_EDITS_REQUIRED' ? '#ef4444' : '#f59e0b', color: currentStatusToShow === 'T002_EDITS_REQUIRED' ? '#dc2626' : '#d97706' }}>
                                        {currentStatusToShow === 'T002_EDITS_REQUIRED' ? '🔄 ส่งไฟล์ใหม่' : '🔄 เปลี่ยนไฟล์'}
                                    </label>
                                    <input type="file" id="upload-t002-change" style={{ display: 'none' }} accept=".pdf,.jpg,.png" onChange={(e) => e.target.files?.[0] && setSelectedUploadFile(e.target.files[0])} />
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: 20, background: '#fff', border: `1px dashed ${selectedUploadFile ? '#f59e0b' : '#10b981'}`, borderRadius: 8 }}>
                        {selectedUploadFile ? (
                            <div>
                                <div style={{ fontSize: 14, color: '#d97706', marginBottom: 12, fontWeight: 'bold' }}>⏳ ไฟล์ที่เลือก: {selectedUploadFile.name}</div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={() => setSelectedUploadFile(null)} disabled={loading} style={{ flex: 1, padding: 10, background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>ยกเลิก</button>
                                    <button onClick={handleConfirmUpload} disabled={loading} style={{ flex: 1, padding: 10, background: '#10b981', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
                                        {loading ? '⏳ กำลังอัปโหลด...' : '🚀 ยืนยันส่งไฟล์ T002'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', opacity: isSystemOpen ? 1 : 0.5 }}>
                                <input type="file" id="upload-t002" style={{ display: 'none' }} accept=".pdf,.jpg,.png" onChange={(e) => e.target.files?.[0] && setSelectedUploadFile(e.target.files[0])} disabled={!isSystemOpen} />
                                <label htmlFor="upload-t002" style={{ ...btnSubmit, background: isSystemOpen ? '#10b981' : '#9ca3af', display: 'inline-block', cursor: isSystemOpen ? 'pointer' : 'not-allowed' }}>
                                    {isSystemOpen ? '📂 เลือกไฟล์ T002 เพื่ออัปโหลด' : '🔒 ระบบปิดรับเอกสาร'}
                                </label>
                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>(รองรับไฟล์ .pdf, .jpg, .png)</div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* --- Modal Popup ดูตัวอย่าง PDF --- */}
            {showModal && previewUrl && (
                <div style={modalBackdropStyle}>
                    <div style={modalCardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
                            <h3 style={{ margin: 0, color: '#1e293b' }}>📄 ตัวอย่างแบบฟอร์ม CP-T002</h3>
                            <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>&times;</button>
                        </div>
                        <div style={{ flex: 1, background: '#525659', padding: '10px' }}>
                            <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 4 }} title="PDF Preview" />
                        </div>
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 12, background: '#f8fafc' }}>
                            <button onClick={handleCloseModal} style={btnOutline}>ปิด</button>
                            <button onClick={handleDownloadPDF} style={btnDownloadStyle}>⬇️ ดาวน์โหลด PDF ลงเครื่อง</button>
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
        <div style={{ background: '#f8fafc', padding: '10px 15px', fontWeight: 'bold', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>{title}</div>
        <div style={{ padding: 15 }}>{children}</div>
    </div>
);

const Input = ({ label, ...props }: any) => (
    <div>
        <label style={lblStyle}>{label} {props.required && <span style={{ color: 'red' }}>*</span>}</label>
        <input style={inputStyle} {...props} />
    </div>
);

// --- Styles ---
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 };
const grid3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 15 };
const grid4 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 15 };
const lblStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 14 };
const btnOutline: React.CSSProperties = { padding: '10px 16px', background: 'white', border: '1px solid #7c3aed', color: '#7c3aed', borderRadius: 8, cursor: 'pointer', fontWeight: 600 };
const btnSubmit: React.CSSProperties = { padding: '10px 24px', background: '#7c3aed', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 15 };
const btnDownloadStyle: React.CSSProperties = { padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 };

const modalBackdropStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 };
const modalCardStyle: React.CSSProperties = { background: 'white', width: '90%', maxWidth: '1000px', height: '90vh', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' };