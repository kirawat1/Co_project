import React, { useState, useEffect, useMemo, useRef } from "react";
import DocTable from "./S_DocTable";
import { createT000PDF, type T000FormData } from "../utils/pdfGeneratorT000";
import PlacementLetterCard from "./PlacementLetterCard";
import { createParentalConsentPDF } from "../utils/pdfGeneratorParentalConsent";
import StatusBadge from "../components/StatusBadge";
import AutoTextarea from "./AutoTextarea";
import CountdownTimer from "../components/CountdownTimer";
import { apiFetch } from "../utils/apiFetch";

// ✅ Interface
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
    t000Comment?: string;
    teacherCheckComment?: string;
  };
  documents?: any[];
}

// -------------------------------------------------------------------
// COMPONENT 1: การ์ดแสดงสถานะ (Status Card)
// -------------------------------------------------------------------
const StudentStatusCard = ({ status, comment }: { status?: string, comment?: string }) => {
  return (
    <div style={{
      padding: "24px", marginBottom: "24px", borderRadius: "16px",
      backgroundColor: '#fff', border: '1px solid #e2e8f0',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
      display: 'flex', alignItems: 'flex-start', gap: '20px'
    }}>
      <div style={{ fontSize: '36px', lineHeight: 1, background: '#f8fafc', padding: 12, borderRadius: '50%' }}>📌</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>สถานะการดำเนินการปัจจุบัน:</h3>
          <StatusBadge status={status} hidePrefix={true} />
        </div>
        <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>กรุณาทำตามขั้นตอนด้านล่างและติดตามสถานะอย่างสม่ำเสมอ</p>

        {/* กล่องแสดงแจ้งเตือนสิ่งที่ต้องแก้ไข */}
        {comment && ['EDITS_REQUIRED', 'REJECTED', 'APPLICATION_EDITS_REQUIRED', 'T002_EDITS_REQUIRED'].includes(status || "") && (
          <div style={{
            marginTop: '16px', fontSize: '14px', color: '#b91c1c',
            background: '#fef2f2', padding: '12px 16px',
            borderRadius: '8px', border: '1px dashed #fca5a5', display: 'flex', gap: 10, alignItems: 'center'
          }}>
            <span style={{ fontSize: 20 }}>💬</span>
            <div><strong>ข้อความจากเจ้าหน้าที่ (ต้องแก้ไข):</strong> {comment}</div>
          </div>
        )}
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

  const uploadedAcceptance = profile.documents?.find((d: any) => d.type === 'CP-ACCEPTANCE' || d.type === 'ACCEPTANCE_FORM');
  const dispatchDoc = profile.documents?.find((d: any) => d.type === 'DISPATCH_LETTER');
  const dispatchUrl = dispatchDoc ? `/uploads/${dispatchDoc.path}` : null;
  const dispatchFileName = dispatchDoc ? dispatchDoc.name : "หนังสือขอความอนุเคราะห์.pdf";

  const currentStatus = profile.docStatus;
  const rawComment = profile.teacherComment || (profile.coop as any)?.t000Comment;

  let adminMessagePhase1 = null;
  let adminMessagePhase2 = null;

  if (['REQ_LETTER_ISSUED', 'WAITING_FOR_STAFF_CHECK_LETTER', 'WAITING_FOR_PLACEMENT_LETTER'].includes(currentStatus)) {
    adminMessagePhase1 = rawComment;
  }

  if (['ACCEPTANCE_CHECKED', 'PLACEMENT_LETTER_ISSUED'].includes(currentStatus) || (currentStatus === 'EDITS_REQUIRED' && uploadedAcceptance)) {
    adminMessagePhase2 = rawComment;
  }

  const handlePreview = (url: string, title: string) => { setPreviewUrl(url); setPreviewTitle(title); };

  const handleDownloadAndAck = async () => {
    if (!dispatchUrl) return;
    try {
      window.open(dispatchUrl, '_blank');
      const token = localStorage.getItem("coop.token");
      await apiFetch("/api/students/acknowledge-dispatch", {
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
    profile.docStatus !== 'PLACEMENT_LETTER_ISSUED' &&
    !dispatchUrl) return null;

  return (
    <div style={{ marginTop: 32, padding: 24, borderRadius: 16, border: '1px solid #d8b4fe', background: '#faf5ff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
      <h3 style={{ margin: "0 0 20px 0", color: "#6b21a8", display: 'flex', alignItems: 'center', gap: 10, borderBottom: '2px solid #e9d5ff', paddingBottom: 12, fontSize: 20 }}>
        🚀 ขั้นตอนที่ 4: รับหนังสือขอความอนุเคราะห์ & อัปโหลดใบตอบรับ
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>

        {/* BOX 1: หนังสืออนุเคราะห์ */}
        <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #e9d5ff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h4 style={{ margin: '0 0 5px 0', color: '#4c1d95', fontSize: 16 }}>1. หนังสือขอความอนุเคราะห์</h4>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>ดาวน์โหลดเอกสารไปยื่นสถานประกอบการ</p>
            </div>
            <div style={{ fontSize: 24 }}>📄</div>
          </div>

          {adminMessagePhase1 && (
            <div style={{ marginTop: 12, padding: '10px', background: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: 4, fontSize: 13, color: '#b45309' }}>
              <strong>💬 แจ้งเตือนการจัดส่ง:</strong> <br />
              {adminMessagePhase1}
            </div>
          )}

          <div style={{ marginTop: 15, padding: 16, background: '#f5f3ff', borderRadius: 8, border: '1px dashed #ddd6fe' }}>
            {dispatchUrl ? (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#5b21b6', marginBottom: 12, wordBreak: 'break-all' }}>📎 {dispatchFileName}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button className="btn-secondary" onClick={() => handlePreview(dispatchUrl, "ตัวอย่างหนังสืออนุเคราะห์")} style={{ flex: 1, fontSize: 13, padding: '10px' }}>👁️ ดูตัวอย่าง</button>
                  <button className="btn-primary" onClick={handleDownloadAndAck} style={{ flex: 1, background: '#7c3aed', border: 'none' }}>⬇️ ดาวน์โหลด</button>
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 10, textAlign: 'center' }}>* เมื่อกดดาวน์โหลด สถานะจะเปลี่ยนเป็น "รอใบตอบรับจากบริษัท" อัตโนมัติ</div>
              </div>
            ) : (<div style={{ color: '#ef4444', fontSize: 13, textAlign: 'center' }}>⚠️ ไม่พบไฟล์ (โปรดติดต่อเจ้าหน้าที่)</div>)}
          </div>
        </div>

        {/* BOX 2: ใบตอบรับ */}
        <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid #e9d5ff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h4 style={{ margin: '0 0 5px 0', color: '#4c1d95', fontSize: 16 }}>2. ใบตอบรับ (Acceptance)</h4>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>เมื่อบริษัทตอบรับแล้ว ให้อัปโหลดกลับเข้าระบบ</p>
            </div>
            <div style={{ fontSize: 24 }}>📤</div>
          </div>

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
              <div style={{ padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                <div style={{ fontSize: 14, color: '#166534', marginBottom: 12 }}>✅ <strong>อัปโหลดสำเร็จ:</strong> {uploadedAcceptance.name}</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-secondary" style={{ flex: 1, fontSize: 13, padding: '10px' }} onClick={() => handlePreview(`/uploads/${uploadedAcceptance.path}`, "ใบตอบรับที่ส่งแล้ว")}>👁️ ดูไฟล์ที่ส่ง</button>
                  <label htmlFor="upload-acceptance-change" className="btn-secondary" style={{ flex: 1, cursor: 'pointer', textAlign: 'center', fontSize: 13, padding: '10px' }}>🔄 เปลี่ยนไฟล์</label>
                  <input type="file" id="upload-acceptance-change" style={{ display: 'none' }} accept=".pdf,.jpg,.png" onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])} />
                </div>
              </div>
            ) : (
              <div style={{ padding: 16, background: selectedFile ? '#fff7ed' : '#f8fafc', border: `1px dashed ${selectedFile ? '#f97316' : '#cbd5e1'}`, borderRadius: 8 }}>
                {selectedFile ? (
                  <div>
                    <div style={{ fontSize: 14, color: '#c2410c', marginBottom: 12, fontWeight: 600 }}>⏳ รอการยืนยัน: {selectedFile.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <button className="btn-secondary" onClick={() => handlePreview(URL.createObjectURL(selectedFile), "ตัวอย่างไฟล์ที่เลือก")} style={{ width: '100%', fontSize: 13, padding: '10px' }}>👁️ กดดูตัวอย่างก่อนส่ง</button>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn-secondary" onClick={() => setSelectedFile(null)} style={{ flex: 1, background: '#fee2e2', color: '#b91c1c', border: 'none' }}>ยกเลิก</button>
                        <button className="btn-primary" onClick={handleConfirmUpload} style={{ flex: 1, background: '#ea580c', border: 'none' }}>🚀 ยืนยันส่งไฟล์</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <input type="file" id="upload-acceptance" style={{ display: 'none' }} accept=".pdf,.jpg,.png" onChange={(e) => e.target.files?.[0] && setSelectedFile(e.target.files[0])} />
                    <label htmlFor="upload-acceptance" className="btn-primary" style={{ background: '#059669', border: 'none', cursor: 'pointer', display: 'inline-block', padding: '10px 20px' }}>📂 เลือกไฟล์ใบตอบรับ</label>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>(รองรับ .pdf, .jpg, .png)</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Preview ฝั่ง Dispatch */}
      {previewUrl && (
        <div className="pdf-modal-backdrop">
          <div className="pdf-modal-card">
            <div className="pdf-modal-header">
              <h3 style={{ margin: 0, color: '#333' }}>{previewTitle}</h3>
              <button onClick={() => setPreviewUrl(null)} className="btn-close">&times;</button>
            </div>
            <div className="pdf-modal-body">
              <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Preview" />
            </div>
            <div className="pdf-modal-footer">
              <button className="btn btn-secondary" onClick={() => setPreviewUrl(null)}>ปิดหน้าต่าง</button>
            </div>
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
  const [requiredDocs, setRequiredDocs] = useState<{ id: string; title: string; isRequired: boolean }[]>([]);

  // 💾 เวลาบันทึกอัตโนมัติล่าสุด
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

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
      const res = await apiFetch("/api/students/me", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setProfile({ ...data, docStatus: data.coop?.status || "WAITING", teacherComment: data.coop?.t000Comment || data.coop?.teacherCheckComment });
      }
    } catch (err) { console.error("Failed to refresh profile:", err); }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resConf = await apiFetch("/api/admin/config/t000", { headers: { Authorization: `Bearer ${token}` } });
        if (resConf.ok) setConfig(await resConf.json());

        const resReq = await apiFetch("/api/students/doc-requirements", { headers: { Authorization: `Bearer ${token}` } });
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

        const resForm = await apiFetch("/api/docs/my-application", { headers: { Authorization: `Bearer ${token}` } });
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
      await apiFetch("/api/students/me", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(newProfile) });
    } catch (err) { console.error("Auto-save failed", err); }
  };

  const handleSaveForm = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await apiFetch("/api/docs/save-form", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(formData) });
      if (res.ok) {
        setLastSavedAt(new Date());
        if (!silent) alert("✅ บันทึกข้อมูลแบบฟอร์มเรียบร้อยแล้ว");
      }
    } catch (err) { if (!silent) alert("Connection Error"); }
    finally { if (!silent) setLoading(false); }
  };

  // 💾 บันทึกข้อมูลอัตโนมัติหลังหยุดพิมพ์ ~1.5 วิ (ข้ามครั้งแรกตอน mount ไม่ให้ save ทันทีที่โหลดหน้า)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => { handleSaveForm(true); }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  const handleGeneratePDF = async (mode: "preview" | "download") => {
    try {
      await handleSaveForm(true);
      const doc = await createT000PDF(profile as any, formData);
      if (mode === "download") {
        doc.save(`KKU_T000_${profile.studentId}.pdf`);
      } else {
        const pdfBlobUrl = doc.output("bloburl");
        setPdfDataUrl(pdfBlobUrl.toString());
        setShowPDFPopup(true);
      }
    } catch (error) {
      console.error(error);
      alert("PDF Error: ตรวจสอบ Console สำหรับรายละเอียด");
    }
  };

  const handleGenerateConsentPDF = async (mode: "preview" | "download") => {
    try {
      await handleSaveForm(true);
      const doc = await createParentalConsentPDF(profile, formData);
      if (mode === "download") {
        doc.save(`Parental_Consent_${profile.studentId}.pdf`);
      } else {
        const pdfBlobUrl = doc.output("bloburl");
        setPdfDataUrl(pdfBlobUrl.toString());
        setShowPDFPopup(true);
      }
    } catch (error) {
      console.error(error);
      alert("ไม่สามารถสร้าง PDF ได้");
    }
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
    data.append("docType", docTypeId);
    try {
      const res = await apiFetch("/api/docs/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: data });
      if (res.ok) {
        alert("✅ อัปโหลดไฟล์สำเร็จ");
        await refreshProfile();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || "❌ อัปโหลดล้มเหลว");
      }
    } catch (err) { alert("Connect Error"); }
    finally { setLoading(false); }
  };

  const handleDeleteFile = async (documentId?: number) => {
    if (!documentId) return;
    if (!window.confirm("คุณต้องการลบไฟล์นี้ใช่หรือไม่?")) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/docs/delete/${documentId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { alert("🗑️ ลบไฟล์เรียบร้อยแล้ว"); await refreshProfile(); }
    } finally { setLoading(false); }
  };

  const docItems = useMemo(() => requiredDocs.map((req) => {
    const uploaded = profile.documents?.find(d => {
      if (d.type === req.id) return true;
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
      title: req.isRequired ? `${req.title} *` : req.title,
      dueDate: config?.endDate,
      fileName: uploaded ? uploaded.name : undefined,
      status: uploaded ? (uploaded.status as any) : "waiting",
      lastUpdated: uploaded ? uploaded.uploadedAt : undefined,
      rejectReason: uploaded ? uploaded.rejectReason : undefined,
      history: uploaded ? uploaded.history : [],
    };
  }), [profile.documents, config, requiredDocs]);

  const displayStatus = profile.docStatus || profile.coop?.status || "WAITING";

  return (
    <div className="page" style={{ padding: 4, margin: 28, maxWidth: 1200, marginInline: 'auto' }}>
      {loading && <div className="loading-overlay">กำลังประมวลผล...</div>}

      <StudentStatusCard status={displayStatus} comment={profile.teacherComment} />

      {/* ================= STEP 1: กรอกข้อมูลฟอร์ม ================= */}
      <section className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: 16, marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: '#e0f2fe', color: '#0284c7', width: 32, height: 32, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%', fontSize: 16 }}>1</span>
            กรอกข้อมูลใบสมัคร (T000)
          </h2>
          {lastSavedAt && (
            <span style={{ fontSize: 12, color: '#16a34a' }}>
              💾 บันทึกล่าสุด {lastSavedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gap: 24 }}>
          {/* ข้อมูลพื้นฐาน */}
          <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#334155' }}>📌 ข้อมูลการสมัคร</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
              <div><label style={lbl}>ตำแหน่งงานที่สมัคร (Job Position):</label><input className="input" value={profile.jobPosition || ""} onChange={e => handleUpdateProfileField("jobPosition", e.target.value)} placeholder="Ex. Software Engineer" /></div>
              <div><label style={lbl}>อาจารย์ที่ปรึกษา (Advisor):</label><input className="input" value={profile.advisorName || "-"} disabled style={{ backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }} /></div>
            </div>
          </div>

          {/* ข้อมูลติดต่อ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
            <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#334155', borderBottom: '1px dashed #cbd5e1', paddingBottom: 8 }}>📍 ข้อมูลติดต่อของนักศึกษา (ปัจจุบัน)</h4>
              <label style={lbl}>ที่อยู่:</label><AutoTextarea className="input" rows={2} value={formData.contactAddress || ""} onChange={e => setFormData({ ...formData, contactAddress: e.target.value })} />
              <label style={lbl}>เบอร์โทร:</label><input className="input" value={formData.contactPhone || ""} onChange={e => setFormData({ ...formData, contactPhone: e.target.value })} />
              <label style={lbl}>อีเมล:</label><input className="input" value={formData.contactEmail || ""} onChange={e => setFormData({ ...formData, contactEmail: e.target.value })} />
            </div>

            <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#334155', borderBottom: '1px dashed #cbd5e1', paddingBottom: 8 }}>🚨 บุคคลติดต่อฉุกเฉิน (ผู้ปกครอง)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>ชื่อ-สกุล:</label><input className="input" value={formData.emergencyName || ""} onChange={e => setFormData({ ...formData, emergencyName: e.target.value })} /></div>
                <div><label style={lbl}>ความเกี่ยวข้อง:</label><input className="input" value={formData.emergencyRelation || ""} onChange={e => setFormData({ ...formData, emergencyRelation: e.target.value })} /></div>
              </div>
              <label style={lbl}>อาชีพ / สถานที่ทำงาน:</label><input className="input" value={formData.emergencyJob || ""} onChange={e => setFormData({ ...formData, emergencyJob: e.target.value })} />
              <label style={lbl}>ที่อยู่:</label><AutoTextarea className="input" rows={2} value={formData.emergencyAddress || ""} onChange={e => setFormData({ ...formData, emergencyAddress: e.target.value })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>เบอร์โทร:</label><input className="input" value={formData.emergencyPhone || ""} onChange={e => setFormData({ ...formData, emergencyPhone: e.target.value })} /></div>
                <div><label style={lbl}>อีเมล:</label><input className="input" value={formData.emergencyEmail || ""} onChange={e => setFormData({ ...formData, emergencyEmail: e.target.value })} /></div>
              </div>
            </div>
          </div>

          {/* เป้าหมาย */}
          <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#334155' }}>🎯 ระยะเวลาและจุดมุ่งหมาย</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 16 }}>
              <div><label style={lbl}>วันที่เริ่มฝึก:</label><input type="date" className="input" value={formData.startDate || ""} onChange={e => setFormData({ ...formData, startDate: e.target.value })} /></div>
              <div><label style={lbl}>ถึงวันที่:</label><input type="date" className="input" value={formData.endDate || ""} onChange={e => setFormData({ ...formData, endDate: e.target.value })} /></div>
            </div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>ระบุสายงานและลักษณะงานอาชีพที่นักศึกษาสนใจ (สูงสุด 3 ข้อ)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="input" placeholder="1." value={formData.careerObjective1 || ""} onChange={e => setFormData({ ...formData, careerObjective1: e.target.value })} />
              <input className="input" placeholder="2." value={formData.careerObjective2 || ""} onChange={e => setFormData({ ...formData, careerObjective2: e.target.value })} />
              <input className="input" placeholder="3." value={formData.careerObjective3 || ""} onChange={e => setFormData({ ...formData, careerObjective3: e.target.value })} />
            </div>
          </div>
        </div>
      </section>

      {/* ================= STEP 2: สร้างและพิมพ์เอกสาร ================= */}
      <section className="card" style={{ marginBottom: 24, background: '#eff6ff', borderColor: '#bfdbfe' }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '2px solid #bfdbfe', paddingBottom: 16 }}>
          <span style={{ background: '#2563eb', color: '#fff', width: 32, height: 32, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%', fontSize: 16 }}>2</span>
          ตรวจสอบและพิมพ์เอกสาร PDF
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {/* T000 */}
          <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #93c5fd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', color: '#0369a1', fontSize: 18 }}>📝 ใบสมัครงานสหกิจศึกษา (T000)</h3>
                <div style={{ fontSize: 13, color: '#64748b' }}>กรอกข้อมูลด้านบนให้ครบก่อนพิมพ์</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
              <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => handleGeneratePDF("preview")}>👁️ ดูตัวอย่างใบสมัคร</button>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', background: '#0284c7' }} onClick={() => handleGeneratePDF("download")}>⬇️ ดาวน์โหลดไปเซ็นชื่อ</button>
            </div>
          </div>

          {/* Parental Consent */}
          <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #93c5fd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', color: '#4c1d95', fontSize: 18 }}>👪 ใบยินยอมผู้ปกครอง (T001)</h3>
                <div style={{ fontSize: 13, color: '#64748b' }}>ใช้ข้อมูลจากฉุกเฉิน (ผู้ปกครอง)</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
              <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center', borderColor: '#c084fc', color: '#6b21a8' }} onClick={() => handleGenerateConsentPDF("preview")}>👁️ ดูตัวอย่างใบยินยอม</button>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', background: '#7c3aed' }} onClick={() => handleGenerateConsentPDF("download")}>⬇️ ดาวน์โหลดไปให้ผู้ปกครองเซ็น</button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= STEP 3: อัปโหลดเอกสาร ================= */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '2px solid #e2e8f0', paddingBottom: 16 }}>
          <h2 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: '#e0f2fe', color: '#0284c7', width: 32, height: 32, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%', fontSize: 16 }}>3</span>
            อัปโหลดเอกสารประกอบการสมัคร
          </h2>

          <CountdownTimer endDate={config?.endDate} isOpen={config?.isOpen} />
        </div>

        {requiredDocs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: '#f8fafc', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
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
              }
            }}
            allowStatusChange={false}
          />
        )}

        {/* STEP 4: รับหนังสือส่งตัว & อัปโหลดใบตอบรับ */}
        <DispatchManagementCard profile={profile} onUpload={handleUpload} onRefresh={refreshProfile} />

        {/* STEP 5: หนังสือส่งตัว */}
        {(profile.docStatus === "PLACEMENT_LETTER_ISSUED" || profile.docStatus === "INTERNSHIP_STARTED") && (
          <PlacementLetterCard placeLetterUrl={profile.coop?.placeLetterUrl} placeDocNumber={profile.coop?.placeDocNumber} placeDocDate={profile.coop?.placeDocDate} docStatus={profile.docStatus} onRefresh={refreshProfile} />
        )}
      </section>

      {/* PDF Modal Preview */}
      {showPDFPopup && (
        <div className="pdf-modal-backdrop">
          <div className="pdf-modal-card">
            <div className="pdf-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>📄</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: '#1e293b' }}>ตัวอย่างเอกสาร (Preview)</h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>ตรวจสอบความถูกต้องก่อนดาวน์โหลดไปเซ็นชื่อ</p>
                </div>
              </div>
              <button onClick={() => setShowPDFPopup(false)} className="btn-close" title="ปิดหน้าต่าง">&times;</button>
            </div>
            <div className="pdf-modal-body">
              <iframe src={pdfDataUrl} title="PDF Preview" className="pdf-iframe" />
            </div>
            <div className="pdf-modal-footer">
              <button className="btn-secondary" style={{ padding: '10px 20px', borderRadius: 8, fontWeight: 700 }} onClick={() => setShowPDFPopup(false)}>ปิด</button>
              <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, fontWeight: 700 }} onClick={() => handleGeneratePDF("download")}>
                <span>⬇️</span> ดาวน์โหลด PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        .card { background: #fff; padding: 32px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .input { width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 8px; margin-top: 6px; box-sizing: border-box; font-family: inherit; font-size: 14px; transition: 0.2s; outline: none; }
        .input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1); }
        .input:disabled { background: #f8fafc; color: #94a3b8; border-color: #e2e8f0; cursor: not-allowed; }
        
        .btn-primary { background: #0ea5e9; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.2s; font-family: inherit; font-size: 14px; display: inline-flex; align-items: center; gap: 6px; }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        
        .btn-secondary { background: white; color: #475569; border: 1px solid #cbd5e1; padding: 12px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.2s; font-family: inherit; font-size: 14px; display: inline-flex; align-items: center; gap: 6px; }
        .btn-secondary:hover { background: #f8fafc; color: #0f172a; }

        .pdf-modal-backdrop { position: fixed; inset: 0; background-color: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease-out; padding: 20px; }
        .pdf-modal-card { background: white; width: 100%; max-width: 1000px; height: 90vh; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); display: flex; flex-direction: column; overflow: hidden; animation: scaleIn 0.2s ease-out; }
        .pdf-modal-header { padding: 16px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #fff; }
        .btn-close { background: transparent; border: none; font-size: 28px; line-height: 1; color: #94a3b8; cursor: pointer; transition: color 0.2s; padding: 0 8px; border-radius: 4px; }
        .btn-close:hover { color: #ef4444; background: #fee2e2; }
        .pdf-modal-body { flex: 1; background: #334155; position: relative; overflow: hidden; }
        .pdf-iframe { width: 100%; height: 100%; border: none; display: block; }
        .pdf-modal-footer { padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px; background: #f8fafc; }
        
        .loading-overlay { position: fixed; inset: 0; background: rgba(255,255,255,0.8); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 9999; color: #0ea5e9; font-weight: 800; font-size: 18px; }
      `}</style>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#475569', marginTop: 12, display: 'block' };