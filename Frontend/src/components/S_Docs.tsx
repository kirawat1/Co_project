import React, { useState, useEffect, useMemo } from "react";
import DocTable from "./S_DocTable";
import { createT000PDF, type T000FormData } from "../utils/pdfGeneratorT000";
import PlacementLetterCard from "./PlacementLetterCard";
import { createParentalConsentPDF } from "../utils/pdfGeneratorParentalConsent";

// ✅ 1. Interface
export interface LocalStudentProfile {
  id?: number;
  studentId: string;
  prefix?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  gpa?: number;
  year?: string;
  major?: string;
  curriculum?: string;
  advisorName?: string;
  jobPosition?: string;

  docStatus?: "WAITING" | "WAITING_FOR_STAFF_CHECK" | "EDITS_REQUIRED" | "DOCS_APPROVED" | "REQ_LETTER_ISSUED" | "WAITING_FOR_PLACEMENT_LETTER" | "WAITING_FOR_STAFF_CHECK_LETTER" | "PLACEMENT_LETTER_ISSUED" | "INTERNSHIP_STARTED" | "ACCEPTANCE_CHECKED" | "T002_SUBMITTED" | "T002_EDITS_REQUIRED" | string;
  teacherComment?: string;

  company?: {
    name?: string;
    address?: string;
    phone?: string;
  };
  coop?: {
    company?: { name?: string };
    placeLetterUrl?: string;
    placeDocNumber?: string;
    placeDocDate?: string;
    status?: string;
    reqDocDate?: string;
    reqDocNumber?: string;
    reqLetterUrl?: string;
  };
  documents?: any[];
}

// -------------------------------------------------------------------
// COMPONENT 1: การ์ดแสดงสถานะ (Status Card)
// -------------------------------------------------------------------
const StudentStatusCard = ({ status, comment }: { status?: string, comment?: string }) => {
  const getStatusConfig = (s?: string) => {
    switch (s) {
      case "WAITING": return { bg: '#f8fafc', border: '#e2e8f0', icon: '⚪', label: 'รอส่งเอกสาร / รอตรวจสอบ', color: '#64748b' };
      case "WAITING_FOR_STAFF_CHECK": return { bg: '#eff6ff', border: '#bfdbfe', icon: '🔍', label: 'รอเจ้าหน้าที่ตรวจสอบ', color: '#0369a1' };
      case "EDITS_REQUIRED": return { bg: '#fff7ed', border: '#fed7aa', icon: '📝', label: 'ต้องแก้ไขเอกสาร', color: '#c2410c' };
      case "DOCS_APPROVED": return { bg: '#ecfdf5', border: '#bbf7d0', icon: '✅', label: 'เอกสารผ่านแล้ว (รอออกหนังสือ)', color: '#047857' };
      case "REQ_LETTER_ISSUED": return { bg: '#f5f3ff', border: '#ddd6fe', icon: '🚚', label: 'ออกหนังสือขอความอนุเคราะห์แล้ว', color: '#6d28d9' };
      case "WAITING_FOR_PLACEMENT_LETTER": return { bg: '#ecfeff', border: '#a5f3fc', icon: '🏢', label: 'รอใบตอบรับจากบริษัท', color: '#0891b2' };
      case "WAITING_FOR_STAFF_CHECK_LETTER": return { bg: '#fffbeb', border: '#fcd34d', icon: '🕵️', label: 'รอเจ้าหน้าที่ตรวจใบตอบรับ', color: '#d97706' };
      case "PLACEMENT_LETTER_ISSUED": return { bg: '#d1fae5', border: '#6ee7b7', icon: '🏁', label: 'ออกใบส่งตัวจริงแล้ว', color: '#047857' };
      case "INTERNSHIP_STARTED": return { bg: '#e0e7ff', border: '#c7d2fe', icon: '🚀', label: 'กำลังฝึกงาน', color: '#4338ca' }
      case "ACCEPTANCE_CHECKED": return { bg: '#d1fae5', border: '#6ee7b7', icon: '✨', label: 'ตรวจใบตอบรับแล้ว', color: '#059669' };
      case "T002_SUBMITTED": return { bg: '#f0f9ff', border: '#a5f3fc', icon: '📤', label: 'ส่งเอกสารรายละเอียด (CP-T002) แล้ว', color: '#0891b2' };
      case "T002_EDITS_REQUIRED": return { bg: '#fff7ed', border: '#fed7aa', icon: '📝', label: 'ต้องแก้ไขเอกสารรายละเอียด (CP-T002)', color: '#c2410c' };
      default: return { bg: '#f8fafc', border: '#e2e8f0', icon: '📄', label: 'สถานะทั่วไป', color: '#64748b' };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div style={{
      padding: "20px", marginBottom: "24px", borderRadius: "12px",
      backgroundColor: config.bg, border: `1px solid ${config.border}`,
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ fontSize: '32px', lineHeight: 1 }}>{config.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: config.color }}>{config.label}</h3>
          </div>
          <div style={{ fontSize: '14px', color: '#475569', lineHeight: 1.5 }}>
            สถานะปัจจุบัน: <strong>{status}</strong>
          </div>
          {comment && (status === 'EDITS_REQUIRED' || status === 'REJECTED') && (
            <div style={{
              marginTop: '12px', fontSize: '14px', color: '#b91c1c',
              background: 'rgba(255,255,255,0.7)', padding: '10px 14px',
              borderRadius: '8px', border: '1px dashed #fca5a5', display: 'flex', gap: 8
            }}>
              <span>💬</span>
              <div><strong>สิ่งที่ต้องแก้ไข:</strong> {comment}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------------
// COMPONENT 2: การ์ดจัดการหนังสือส่งตัว & ใบตอบรับ
// -------------------------------------------------------------------
const DispatchManagementCard = ({ profile, onUpload, onRefresh }: { profile: any, onUpload: (type: string, file: File) => void, onRefresh: () => void }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  // ค้นหาเอกสารใบตอบรับ
  const uploadedAcceptance = profile.documents?.find((d: any) => d.type === 'CP-ACCEPTANCE' || d.type === 'ACCEPTANCE_FORM');

  // ค้นหาไฟล์หนังสือขอความอนุเคราะห์ (DISPATCH_LETTER)
  const dispatchDoc = profile.documents?.find((d: any) => d.type === 'DISPATCH_LETTER');
  const dispatchUrl = dispatchDoc ? `http://localhost:5000/uploads/${dispatchDoc.path}` : null;
  const dispatchFileName = dispatchDoc ? dispatchDoc.name : "หนังสือขอความอนุเคราะห์.pdf";

  // ✅ แก้ปัญหาข้อความแยกกล่อง: ดึง Comment ออกมาให้ครอบคลุมทั้ง 2 แบบ
  const currentStatus = profile.docStatus;
  const rawComment = profile.teacherComment || (profile.coop as any)?.t000Comment;

  let adminMessagePhase1 = null;
  let adminMessagePhase2 = null;

  // 📦 ถ้าสถานะยังวนเวียนอยู่แค่ตอนออกหนังสืออนุเคราะห์ -> ให้โชว์ในกล่อง 1
  if (['REQ_LETTER_ISSUED', 'WAITING_FOR_STAFF_CHECK_LETTER', 'WAITING_FOR_PLACEMENT_LETTER'].includes(currentStatus)) {
    adminMessagePhase1 = rawComment;
  }

  // 📦 ถ้าสถานะไปถึงขั้นตรวจใบตอบรับ หรือ ออกหนังสือส่งตัวแล้ว -> ให้โชว์ในกล่อง 2
  if (['ACCEPTANCE_CHECKED', 'PLACEMENT_LETTER_ISSUED'].includes(currentStatus) || (currentStatus === 'EDITS_REQUIRED' && uploadedAcceptance)) {
    adminMessagePhase2 = rawComment;
  }

  const handlePreview = (url: string, title: string) => { setPreviewUrl(url); setPreviewTitle(title); };

  const handleDownloadAndAck = async () => {
    if (!dispatchUrl) return;
    try {
      window.open(dispatchUrl, '_blank');
      const token = localStorage.getItem("coop.token");
      await fetch("http://localhost:5000/api/students/acknowledge-dispatch", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      onRefresh();
    } catch (err) { console.error("Error ack download:", err); }
  };

  const handleConfirmUpload = () => {
    if (selectedFile) {
      onUpload('CP-ACCEPTANCE', selectedFile);
      setSelectedFile(null);
    }
  };

  if (profile.docStatus !== 'REQ_LETTER_ISSUED' &&
    profile.docStatus !== 'WAITING_FOR_PLACEMENT_LETTER' &&
    profile.docStatus !== 'WAITING_FOR_STAFF_CHECK_LETTER' &&
    profile.docStatus !== 'ACCEPTANCE_CHECKED' &&
    profile.docStatus !== 'PLACEMENT_LETTER_ISSUED' && // เผื่อกรณีออกหนังสือส่งตัวแล้ว
    !dispatchUrl) return null;

  return (
    <div style={{ marginTop: 24, padding: 24, borderRadius: 12, border: '1px solid #d8b4fe', background: '#faf5ff' }}>
      <h3 style={{ margin: "0 0 20px 0", color: "#6b21a8", display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e9d5ff', paddingBottom: 10 }}>
        🚀 ขั้นตอนต่อไป: รับหนังสืออนุเคราะห์ & ยืนยันบริษัท
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>

        {/* BOX 1: หนังสืออนุเคราะห์ */}
        <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #e9d5ff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h4 style={{ margin: '0 0 5px 0', color: '#4c1d95', fontSize: 16 }}>1. หนังสืออนุเคราะห์</h4>
              <p style={{ fontSize: 13, color: '#666', margin: 0 }}>เอกสารสำหรับนำไปยื่นสถานประกอบการ</p>
            </div>
            <div style={{ fontSize: 24 }}>📄</div>
          </div>

          {/* ✅ แจ้งเตือนจากเจ้าหน้าที่ (Phase 1) */}
          {adminMessagePhase1 && (
            <div style={{ marginTop: 12, padding: '10px', background: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: 4, fontSize: 13, color: '#b45309' }}>
              <strong>💬 แจ้งเตือนการจัดส่ง:</strong> <br />
              {adminMessagePhase1}
            </div>
          )}

          <div style={{ marginTop: 15, padding: 12, background: '#f5f3ff', borderRadius: 8, border: '1px dashed #ddd6fe' }}>
            {dispatchUrl ? (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#5b21b6', marginBottom: 10, wordBreak: 'break-all' }}>📎 {dispatchFileName}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn-secondary" onClick={() => handlePreview(dispatchUrl, "ตัวอย่างหนังสืออนุเคราะห์")} style={{ flex: 1, fontSize: 13, padding: '8px' }}>👁️ ดูตัวอย่าง</button>
                  <button className="btn" onClick={handleDownloadAndAck} style={{ flex: 1, background: '#7c3aed', color: 'white', border: 'none', cursor: 'pointer' }}>⬇️ ดาวน์โหลด</button>
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8, textAlign: 'center' }}>* เมื่อกดดาวน์โหลด สถานะจะเปลี่ยนเป็น "รอใบตอบรับจากบริษัท"</div>
              </div>
            ) : (<div style={{ color: '#ef4444', fontSize: 13, textAlign: 'center' }}>⚠️ ไม่พบไฟล์ (โปรดติดต่อเจ้าหน้าที่)</div>)}
          </div>
        </div>

        {/* BOX 2: ใบตอบรับ */}
        <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #e9d5ff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h4 style={{ margin: '0 0 5px 0', color: '#4c1d95', fontSize: 16 }}>2. ใบตอบรับ (Acceptance)</h4>
              <p style={{ fontSize: 13, color: '#666', margin: 0 }}>เมื่อบริษัทลงนามแล้ว ให้อัปโหลดกลับเข้าระบบ</p>
            </div>
            <div style={{ fontSize: 24 }}>📤</div>
          </div>

          {/* ✅ แจ้งเตือนผลการตรวจใบตอบรับ (Phase 2) */}
          {adminMessagePhase2 && (
            <div style={{
              marginTop: 12, padding: '10px', borderRadius: 4, fontSize: 13,
              background: currentStatus === 'EDITS_REQUIRED' ? '#fef2f2' : '#f0fdf4',
              borderLeft: `4px solid ${currentStatus === 'EDITS_REQUIRED' ? '#ef4444' : '#22c55e'}`,
              color: currentStatus === 'EDITS_REQUIRED' ? '#991b1b' : '#166534'
            }}>
              <strong>{currentStatus === 'EDITS_REQUIRED' ? '❌ แจ้งแก้ไขใบตอบรับ:' : '💬 ข้อความจากเจ้าหน้าที่:'}</strong> <br />
              {adminMessagePhase2}
            </div>
          )}

          <div style={{ marginTop: 15 }}>
            {uploadedAcceptance && !selectedFile ? (
              <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                <div style={{ fontSize: 13, color: '#166534', marginBottom: 8 }}>✅ <strong>ส่งแล้ว:</strong> {uploadedAcceptance.name}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-secondary" style={{ flex: 1, fontSize: 13, padding: 8 }} onClick={() => handlePreview(`http://localhost:5000/uploads/${uploadedAcceptance.path}`, "ใบตอบรับที่ส่งแล้ว")}>👁️ ดูไฟล์ที่ส่ง</button>
                  <label htmlFor="upload-acceptance-change" className="btn-secondary" style={{ flex: 1, cursor: 'pointer', textAlign: 'center', fontSize: 13, padding: 8 }}>🔄 เปลี่ยนไฟล์</label>
                  <input type="file" id="upload-acceptance-change" style={{ display: 'none' }} accept=".pdf,.jpg,.png" onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])} />
                </div>
              </div>
            ) : (
              <div style={{ padding: 12, background: selectedFile ? '#fff7ed' : '#f8fafc', border: `1px dashed ${selectedFile ? '#f97316' : '#cbd5e1'}`, borderRadius: 8 }}>
                {selectedFile ? (
                  <div>
                    <div style={{ fontSize: 13, color: '#c2410c', marginBottom: 8, fontWeight: 600 }}>⏳ รอการยืนยัน: {selectedFile.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button className="btn-secondary" onClick={() => handlePreview(URL.createObjectURL(selectedFile), "ตัวอย่างไฟล์ที่เลือก")} style={{ width: '100%', fontSize: 13, padding: 8 }}>👁️ กดดูตัวอย่างก่อนส่ง</button>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-secondary" onClick={() => setSelectedFile(null)} style={{ flex: 1, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>ยกเลิก</button>
                        <button className="btn" onClick={handleConfirmUpload} style={{ flex: 1, background: '#ea580c', color: 'white' }}>🚀 ยืนยันส่งไฟล์</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <input type="file" id="upload-acceptance" style={{ display: 'none' }} accept=".pdf,.jpg,.png" onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])} />
                    <label htmlFor="upload-acceptance" className="btn" style={{ background: '#059669', color: 'white', cursor: 'pointer', display: 'inline-block', padding: '10px 20px' }}>📂 เลือกไฟล์ใบตอบรับ</label>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>(.pdf, .jpg, .png)</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Preview ฝั่งนักศึกษา */}
      {previewUrl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, width: '80%', height: '85%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: '#333' }}>{previewTitle}</h3>
              <button onClick={() => setPreviewUrl(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>&times;</button>
            </div>
            <iframe src={previewUrl} style={{ flex: 1, border: '1px solid #eee', borderRadius: 8 }} title="Preview" />
          </div>
        </div>
      )}
    </div>
  );
};
// -------------------------------------------------------------------
// MAIN PAGE COMPONENT
// -------------------------------------------------------------------
export default function S_Docs({ profile, setProfile }: { profile: LocalStudentProfile; setProfile: (p: LocalStudentProfile) => void; }) {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<{ endDate?: string; isOpen?: boolean } | null>(null);

  // ✅ 1. เพิ่ม State เก็บหัวข้อเอกสารที่ดึงจาก Backend
  const [requiredDocs, setRequiredDocs] = useState<{ id: string; title: string; isRequired: boolean }[]>([]);

  const token = localStorage.getItem("coop.token");

  const [formData, setFormData] = useState<T000FormData>({
    contactAddress: "", contactPhone: profile.phone || "", contactEmail: profile.email || "",
    emergencyName: "", emergencyRelation: "", emergencyJob: "", emergencyWorkplace: "", emergencyAddress: "",
    emergencyPhone: "", emergencyEmail: "", careerObjective1: "", careerObjective2: "", careerObjective3: "", startDate: "", endDate: ""
  });

  const [showPDFPopup, setShowPDFPopup] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState("");

  const refreshProfile = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/students/me", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setProfile({ ...data, docStatus: data.coop?.status || "WAITING", teacherComment: data.coop?.t000Comment || data.coop?.teacherCheckComment });
      }
    } catch (err) { console.error("Failed to refresh profile:", err); }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // ดึง Config เวลา
        const resConf = await fetch("http://localhost:5000/api/admin/config/t000", { headers: { Authorization: `Bearer ${token}` } });
        if (resConf.ok) setConfig(await resConf.json());

        // ✅ 2. ดึงรายการเอกสาร (โจทย์) จาก Backend
        const resReq = await fetch("http://localhost:5000/api/students/doc-requirements", { headers: { Authorization: `Bearer ${token}` } });
        if (resReq.ok) {
          const reqData = await resReq.json();
          if (reqData.ok) {
            setRequiredDocs(reqData.requirements.map((r: any) => ({
              id: r.docKey,
              title: r.title,
              isRequired: r.isRequired
            })));
          }
        }

        // ดึงแบบฟอร์มเดิม
        const resForm = await fetch("http://localhost:5000/api/docs/my-application", { headers: { Authorization: `Bearer ${token}` } });
        if (resForm.ok) {
          const data = await resForm.json();
          if (data.form) setFormData(prev => ({ ...prev, ...data.form }));
        }

        await refreshProfile();
      } catch (err) { console.error(err); }
    };
    fetchData();
  }, [token]);

  const handleUpdateProfileField = async (field: string, value: string) => {
    const newProfile = { ...profile, [field]: value };
    setProfile(newProfile);
    try {
      await fetch("http://localhost:5000/api/students/me", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(newProfile) });
    } catch (err) { console.error("Auto-save failed", err); }
  };

  const handleSaveForm = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch("http://localhost:5000/api/docs/save-form", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(formData) });
      if (!silent && res.ok) alert("✅ บันทึกข้อมูลแบบฟอร์มเรียบร้อยแล้ว");
    } catch (err) { if (!silent) alert("Connection Error"); }
    finally { if (!silent) setLoading(false); }
  };

  const handleGeneratePDF = async (mode: "preview" | "download") => {
    try {
      await handleSaveForm(true);
      const doc = await createT000PDF(profile as any, formData);
      if (mode === "download") doc.save(`KKU_T000_${profile.studentId}.pdf`);
      else { setPdfDataUrl(doc.output("datauristring")); setShowPDFPopup(true); }
    } catch (error) { console.error(error); alert("PDF Error"); }
  };

  const handleGenerateConsentPDF = async (mode: "preview" | "download") => {
    try {
      await handleSaveForm(true);
      const doc = await createParentalConsentPDF(profile, formData);
      if (mode === "download") doc.save(`Parental_Consent_${profile.studentId}.pdf`);
      else { setPdfDataUrl(doc.output("datauristring")); setShowPDFPopup(true); }
    } catch (error) { console.error(error); alert("ไม่สามารถสร้าง PDF ได้"); }
  };

  const handleUpload = async (docTypeId: string, file: File) => {
    if (!file) return;
    if (config && config.isOpen === false && docTypeId !== 'CP-ACCEPTANCE') {
      alert("⛔ ระบบปิดรับเอกสารสมัครแล้ว");
      return;
    }
    setLoading(true);
    const data = new FormData();
    data.append("files", file);
    data.append("docType", docTypeId); // ใช้ docKey (เช่น "CP-T000") ที่ได้จาก Requirement ส่งเป็น type
    try {
      const res = await fetch("http://localhost:5000/api/docs/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: data });
      if (res.ok) { alert("✅ Uploaded"); await refreshProfile(); } else alert("❌ Failed");
    } catch (err) { alert("Connect Error"); }
    finally { setLoading(false); }
  };

  const handleDeleteFile = async (documentId?: number) => {
    if (!documentId) return;
    if (!window.confirm("คุณต้องการลบไฟล์นี้ใช่หรือไม่?")) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/docs/delete/${documentId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { alert("🗑️ ลบไฟล์เรียบร้อยแล้ว"); await refreshProfile(); }
    } finally { setLoading(false); }
  };

  // ✅ 3. แมปเอกสาร (ดึงจาก State requiredDocs แทบของที่ fix เอาไว้)
  const docItems = useMemo(() => requiredDocs.map((req) => {
    const uploaded = profile.documents?.find(d => {
      if (d.type === req.id) return true;
      // กฎเช็คเผื่อของเก่า
      if (req.id === 'CP-T000' && d.type === 'T000_SIGNED') return true;
      if (req.id === 'CP-TRANSCRIPT' && d.type === 'TRANSCRIPT') return true;
      if (req.id === 'CP-CV' && d.type === 'CV') return true;
      if (req.id === 'CP-STUDENT_CARD' && d.type === 'STUDENT_CARD') return true;
      if (req.id === 'CP-CITIZEN_CARD' && d.type === 'CITIZEN_CARD') return true;
      if (req.id === 'CP-PARENTAL_CONSENT' && d.type === 'PARENTAL_CONSENT') return true;
      return false;
    });

    return {
      id: req.id,
      documentId: uploaded?.id,
      title: req.isRequired ? `${req.title} *` : req.title, // เพิ่มดอกจันถ้าบังคับส่ง
      dueDate: config?.endDate,
      fileName: uploaded ? uploaded.name : undefined,
      status: uploaded ? (uploaded.status as any) : "waiting",
      lastUpdated: uploaded ? uploaded.uploadedAt : undefined,
      rejectReason: uploaded ? uploaded.rejectReason : undefined,
      history: uploaded ? uploaded.history : [],
    };
  }), [profile.documents, config, requiredDocs]); // <- เพิ่ม requiredDocs เข้า dependencies

  const formattedDueDate = config?.endDate ? new Date(config.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : "รอประกาศ";
  const displayStatus = profile.docStatus || profile.coop?.status || "WAITING";

  return (
    <div className="page" style={{ padding: 4, margin: 28 }}>
      {loading && <div className="loading-overlay">Processing...</div>}

      <StudentStatusCard status={displayStatus} comment={profile.teacherComment} />

      <section className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: "0" }}>📝 ข้อมูลใบสมัคร (T000)</h2>
          <button className="btn btn-save" onClick={() => handleSaveForm(false)}>💾 บันทึกแบบร่าง</button>
        </div>

        {/* ... (ฟอร์ม T000 ยังคงเหมือนเดิมเป๊ะ) ... */}
        <div style={{ marginTop: 20, marginBottom: 20, padding: 15, background: '#f0f9ff', borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0369a1' }}>ข้อมูลการสมัคร</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
            <div><label style={lbl}>ตำแหน่งงาน (Position):</label><input className="input" value={profile.jobPosition || ""} onChange={e => handleUpdateProfileField("jobPosition", e.target.value)} placeholder="Ex. Software Engineer" /></div>
            <div><label style={lbl}>อาจารย์ที่ปรึกษา (Advisor):</label><input className="input" value={profile.advisorName || "-"} disabled style={{ backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }} /></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          <div>
            <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: 5 }}>ข้อมูลติดต่อของนักศึกษา (ปัจจุบัน)</h4>
            <label style={lbl}>ที่อยู่:</label>
            <textarea className="input" rows={2} value={formData.contactAddress || ""} onChange={e => setFormData({ ...formData, contactAddress: e.target.value })} />
            <label style={lbl}>เบอร์โทร:</label>
            <input className="input" value={formData.contactPhone || ""} onChange={e => setFormData({ ...formData, contactPhone: e.target.value })} />
            <label style={lbl}>อีเมล:</label>
            <input className="input" value={formData.contactEmail || ""} onChange={e => setFormData({ ...formData, contactEmail: e.target.value })} />
          </div>
          <div>
            <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: 5 }}>บุคคลติดต่อฉุกเฉิน (ผู้ปกครอง)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>ชื่อ-สกุล:</label><input className="input" value={formData.emergencyName || ""} onChange={e => setFormData({ ...formData, emergencyName: e.target.value })} /></div>
              <div><label style={lbl}>ความเกี่ยวข้อง:</label><input className="input" value={formData.emergencyRelation || ""} onChange={e => setFormData({ ...formData, emergencyRelation: e.target.value })} /></div>
            </div>
            <label style={lbl}>อาชีพ / สถานที่ทำงาน:</label><input className="input" value={formData.emergencyJob || ""} onChange={e => setFormData({ ...formData, emergencyJob: e.target.value })} />
            <label style={lbl}>ที่อยู่:</label><textarea className="input" rows={2} value={formData.emergencyAddress || ""} onChange={e => setFormData({ ...formData, emergencyAddress: e.target.value })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>เบอร์โทร:</label><input className="input" value={formData.emergencyPhone || ""} onChange={e => setFormData({ ...formData, emergencyPhone: e.target.value })} /></div>
              <div><label style={lbl}>อีเมล:</label><input className="input" value={formData.emergencyEmail || ""} onChange={e => setFormData({ ...formData, emergencyEmail: e.target.value })} /></div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: 5 }}>ระยะเวลาและจุดมุ่งหมาย</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 15 }}>
            <div><label style={lbl}>วันที่เริ่มฝึก:</label><input type="date" className="input" value={formData.startDate || ""} onChange={e => setFormData({ ...formData, startDate: e.target.value })} /></div>
            <div><label style={lbl}>ถึงวันที่:</label><input type="date" className="input" value={formData.endDate || ""} onChange={e => setFormData({ ...formData, endDate: e.target.value })} /></div>
          </div>
          <p style={{ fontSize: 13, color: '#666' }}>ระบุสายงานและลักษณะงานอาชีพที่นักศึกษาสนใจ</p>
          <input className="input" placeholder="1." value={formData.careerObjective1 || ""} onChange={e => setFormData({ ...formData, careerObjective1: e.target.value })} />
          <input className="input" placeholder="2." value={formData.careerObjective2 || ""} onChange={e => setFormData({ ...formData, careerObjective2: e.target.value })} />
          <input className="input" placeholder="3." value={formData.careerObjective3 || ""} onChange={e => setFormData({ ...formData, careerObjective3: e.target.value })} />
        </div>

        <section className="card" style={{ padding: 24, marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><h3 style={{ margin: 0, color: '#0369a1' }}>📂 เอกสาร T000 </h3></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => handleGeneratePDF("preview")}>👁️ ดูตัวอย่าง T000</button>
              <button className="btn btn-primary" onClick={() => handleGeneratePDF("download")}>⬇️ ดาวน์โหลด T000 ไปเซ็นชื่อ</button>
            </div>
          </div>
        </section>

        <section className="card" style={{ padding: 24, marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><h3 style={{ margin: 0, color: '#4c1d95' }}>👪 ใบยินยอมผู้ปกครอง (Parental Consent)</h3></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ backgroundColor: '#0369a1' }} onClick={() => handleGenerateConsentPDF("preview")}>👁️ ดูตัวอย่าง</button>
              <button className="btn btn-primary" onClick={() => handleGenerateConsentPDF("download")}>⬇️ ดาวน์โหลดไปให้ผู้ปกครองเซ็น</button>
            </div>
          </div>
        </section>
      </section>

      <section className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 15 }}>
          <div>
            <h2 style={{ margin: 0 }}>📂 อัปโหลดเอกสารประกอบการสมัคร</h2>
            <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: 14 }}>กรุณาอัปโหลดเอกสารให้ครบถ้วน</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'block', fontSize: 12, color: '#64748b', fontWeight: 600 }}>กำหนดส่งภายใน</span>
            <span style={{ display: 'block', fontSize: 20, color: config?.isOpen ? '#ef4444' : '#9ca3af', fontWeight: 'bold' }}>📅 {formattedDueDate}</span>
            {!config?.isOpen && <span style={{ display: 'block', fontSize: 12, color: '#b91c1c', marginTop: 4 }}>(ระบบปิดรับเอกสาร)</span>}
          </div>
        </div>

        {/* ✅ ส่ง docItems ที่แมปจาก Dynamic Requirements ให้ DocTable จัดการ */}
        {requiredDocs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: '#f8fafc', borderRadius: 12 }}>
            ขณะนี้ยังไม่มีการกำหนดหัวข้อเอกสารจากเจ้าหน้าที่
          </div>
        ) : (
          <DocTable
            items={docItems}
            onUploadCall={handleUpload}
            onDeleteCall={(docTypeId: string) => {
              const targetDoc = profile.documents?.find(d => {
                if (d.type === docTypeId) return true;
                if (docTypeId === 'CP-T000' && d.type === 'T000_SIGNED') return true;
                if (docTypeId === 'CP-TRANSCRIPT' && d.type === 'TRANSCRIPT') return true;
                if (docTypeId === 'CP-CV' && d.type === 'CV') return true;
                if (docTypeId === 'CP-STUDENT_CARD' && d.type === 'STUDENT_CARD') return true;
                if (docTypeId === 'CP-CITIZEN_CARD' && d.type === 'CITIZEN_CARD') return true;
                if (docTypeId === 'CP-PARENTAL_CONSENT' && d.type === 'PARENTAL_CONSENT') return true;
                return false;
              });

              if (targetDoc) {
                handleDeleteFile(targetDoc.id);
              } else {
                console.error("Document not found for type:", docTypeId);
              }
            }}
            allowStatusChange={false}
          />
        )}

        <DispatchManagementCard profile={profile} onUpload={handleUpload} onRefresh={refreshProfile} />

        {(profile.docStatus === "PLACEMENT_LETTER_ISSUED" || profile.docStatus === "INTERNSHIP_STARTED") && (
          <PlacementLetterCard placeLetterUrl={profile.coop?.placeLetterUrl} placeDocNumber={profile.coop?.placeDocNumber} placeDocDate={profile.coop?.placeDocDate} />
        )}
      </section>

      {/* PDF Modal */}
      {showPDFPopup && (
        <div className="pdf-modal-backdrop">
          <div className="pdf-modal-card">
            <div className="pdf-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>📄</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: '#1e293b' }}>ตัวอย่างเอกสาร (Preview)</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>ตรวจสอบความถูกต้องก่อนดาวน์โหลด</p>
                </div>
              </div>
              <button onClick={() => setShowPDFPopup(false)} className="btn-close" title="ปิดหน้าต่าง">&times;</button>
            </div>
            <div className="pdf-modal-body">
              <iframe src={pdfDataUrl} title="PDF Preview" className="pdf-iframe" />
            </div>
            <div className="pdf-modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPDFPopup(false)}>ปิด</button>
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => handleGeneratePDF("download")}>
                <span>⬇️</span> ดาวน์โหลด PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .pdf-modal-backdrop { position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease-out; padding: 20px; }
        .pdf-modal-card { background: white; width: 100%; max-width: 1000px; height: 90vh; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); display: flex; flex-direction: column; overflow: hidden; animation: scaleIn 0.2s ease-out; }
        .pdf-modal-header { padding: 16px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
        .btn-close { background: transparent; border: none; font-size: 28px; line-height: 1; color: #94a3b8; cursor: pointer; transition: color 0.2s; padding: 0 8px; border-radius: 4px; }
        .btn-close:hover { color: #ef4444; background: #fee2e2; }
        .pdf-modal-body { flex: 1; background: #525659; position: relative; overflow: hidden; }
        .pdf-iframe { width: 100%; height: 100%; border: none; display: block; }
        .pdf-modal-footer { padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px; background: white; }
        .input { width: 100%; padding: 8px; border: 1px solid #ddd; borderRadius: 6px; marginTop: 4px; box-sizing: border-box; font-family: inherit; font-size: 14px; }
        .input:disabled { background: #f9fafb; color: #9ca3af; }
        .btn { padding: 10px 16px; border: none; borderRadius: 6px; cursor: pointer; fontWeight: 600; display: inline-flex; align-items: center; gap: 6px; transition: 0.2s; font-family: inherit; font-size: 14px; }
        .btn:hover { opacity: 0.9; }
        .btn-primary { background: #0074B7; color: white; }
        .btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
        .btn-save { background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; }
        .card { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; }
        .loading-overlay { position: fixed; inset: 0; background: rgba(255,255,255,0.7); display: flex; alignItems: center; justifyContent: center; z-index: 9999; color: #0074B7; font-weight: bold; }
      `}</style>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#64748b', marginTop: 12, display: 'block' };