// Frontend/src/components/S_Gateway.tsx
import React, { useState, useEffect } from "react";
import { createCoopPDF } from "../utils/pdfGenerator";
import StatusBadge from "../components/StatusBadge";

// --- Interfaces ---
interface Mentor {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  position?: string;
  companyId?: string;
}

interface Company {
  id: string;
  name?: string;
  address?: string;
  phone?: string;
  hrName?: string;
  hrEmail?: string;
}

interface CoopInfo {
  company: Company;
  mentor?: Mentor;
  status?: string;          // CoopStatus Enum
  teacherCheckComment?: string;  // ✅ เปลี่ยนชื่อให้ตรง Schema
  t000Comment?: string;
}

interface StudentDocument {
  id: number;
  name: string;
  path: string;
}

interface StudentProfile {
  studentId: string;
  userEmail?: string;
  prefix?: string;
  firstName?: string;
  lastName?: string;
  year?: string;
  major?: string;
  curriculum?: string;
  studyProgram?: string;
  emails?: { email: string; primary: boolean }[];

  // ✅ เพิ่มฟิลด์สำหรับตรวจสอบคุณสมบัติ
  isQualified?: boolean;
  gpa?: number;
  coreGpa?: number;
  activityUnit?: number;
  isPassPrepCourse?: boolean;

  company?: Company;
  mentor?: Mentor;
  coop?: CoopInfo;
  documents?: StudentDocument[];
}

export default function CoopRequestPage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [coopField, setCoopField] = useState("");
  const [showPDFPopup, setShowPDFPopup] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState("");

  const token = localStorage.getItem("coop.token");

  // --- Helpers ---
  const getThaiPrefix = (prefix: string = "") => {
    const p = prefix.toUpperCase().trim();
    if (["MR", "MR.", "MISTER", "นาย"].includes(p)) return "นาย";
    if (["MS", "MS.", "MISS", "MRS", "MRS.", "นางสาว", "นาง"].includes(p)) return "นางสาว";
    return prefix;
  };

  // --- Fetch Data ---
  const fetchData = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/students/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile({
          ...data,
          studentId: data.studentId || "",
          prefix: data.prefix || "-",
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          userEmail: data.userEmail,
          // ✅ Mapping ข้อมูลคุณสมบัติ
          isQualified: data.isQualified,
          gpa: data.gpa,
          coreGpa: data.coreGpa,
          activityUnit: data.activityUnit,
          isPassPrepCourse: data.isPassPrepCourse
        });

        // ถ้าเคยกรอกตำแหน่งงานไว้ (ในกรณีแก้) ให้ดึงมาแสดง
        if (data.coop?.jobPosition) {
          setCoopField(data.coop.jobPosition);
        }
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // --- Handlers ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles((prev) => [...prev, ...newFiles]);
      e.target.value = "";
    }
  };

  const handleRemoveExistingFile = async (docId: number) => {
    if (!confirm("ต้องการลบไฟล์นี้ใช่หรือไม่?")) return;
    try {
      const res = await fetch(`http://localhost:5000/api/coop/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setProfile((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            documents: prev.documents?.filter((d) => d.id !== docId),
          };
        });
      } else {
        alert("ลบไม่สำเร็จ: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitApplication = async () => {
    // ✅ 1. ตรวจสอบคุณสมบัติก่อน (สำคัญมาก)
    if (!profile?.isQualified) {
      alert("❌ คุณสมบัติของคุณยังไม่ครบถ้วนตามเกณฑ์สาขา (เกรด/กิจกรรม/วิชาเตรียมความพร้อม) กรุณาตรวจสอบที่หน้า Profile");
      return;
    }

    const hasCompany = profile?.coop?.company || profile?.company;
    if (!hasCompany) {
      alert("กรุณาเลือกบริษัทและพี่เลี้ยงก่อนยื่นคำร้อง");
      return;
    }

    const hasExistingDocs = profile?.documents && profile.documents.length > 0;
    const hasNewDocs = uploadedFiles.length > 0;

    if (!hasExistingDocs && !hasNewDocs) {
      alert("กรุณาอัปโหลดเอกสารประกอบอย่างน้อย 1 ไฟล์");
      return;
    }

    const formData = new FormData();
    // ✅ เปลี่ยนชื่อ field ให้ตรงกับ Schema (jobPosition)
    formData.append("jobPosition", coopField);
    uploadedFiles.forEach((file) => formData.append("files", file));

    try {
      const res = await fetch("http://localhost:5000/api/coop/apply", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        alert("✅ ส่งคำร้องเรียบร้อยแล้ว สถานะ: รออาจารย์ตรวจสอบ");
        setUploadedFiles([]);
        fetchData();
      } else {
        alert("❌ เกิดข้อผิดพลาด: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

  const handleGeneratePDF = async (mode: "preview" | "download") => {
    if (!profile) return;
    try {
      const doc = await createCoopPDF(profile, coopField);
      if (mode === "download") {
        doc.save(`KKU_Coop_${profile.studentId}.pdf`);
      } else {
        setPdfDataUrl(doc.output("datauristring"));
        setShowPDFPopup(true);
      }
    } catch (error) {
      console.error("PDF Error:", error);
      alert("ไม่สามารถสร้าง PDF ได้: " + error);
    }
  };

  if (!profile) return <div style={{ padding: 40, textAlign: 'center' }}>กำลังโหลดข้อมูล...</div>;

  // --- Logic การแสดงผล ---
  const currentStatus = profile.coop?.status || "NOT_SUBMITTED";

  // ✅ แก้ไข: อนุญาตให้แก้ได้ถ้ายังไม่ส่ง (NOT_SUBMITTED) หรือส่งแล้วแต่ยังรอตรวจ (APPLYING) หรือถูกสั่งแก้ (EDITS_REQUIRED)
  // ถ้าคุณต้องการล็อกทันทีที่กดส่ง ให้เอา APPLYING ออก
  const canEdit = currentStatus === "NOT_SUBMITTED" || currentStatus === "APPLICATION_EDITS_REQUIRED" || currentStatus === "EDITS_REQUIRED";
  console.log("Can Edit Coop Request:", canEdit);
  console.log("Current Coop Status:", currentStatus);
  const canSubmit = profile?.isQualified && canEdit;

  return (
    <div style={{ padding: "40px 20px", maxWidth: "1200px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <style>{PROFILE_CSS}</style>

      {/* ✅ Section 0: แสดงสถานะคุณสมบัติ (Qualification Check) */}
      <div style={{
        padding: "15px 25px",
        marginBottom: "20px",
        borderRadius: "12px",
        background: profile.isQualified ? "#f0fdf4" : "#fff7ed",
        border: `1px solid ${profile.isQualified ? "#bbf7d0" : "#ffedd5"}`,
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <div>
          <strong style={{ color: profile.isQualified ? "#166534" : "#9a3412", fontSize: '16px' }}>
            {profile.isQualified ? "✅ คุณสมบัติครบถ้วน (Qualified)" : "⚠️ คุณสมบัติยังไม่ผ่านเกณฑ์"}
          </strong>
          <div style={{ marginTop: 5, fontSize: 13, color: '#666', display: 'flex', gap: '15px' }}>
            <span>GPA: <b>{profile.gpa?.toFixed(2)}</b></span>
            <span>GPA วิชาหมวดหลัก: <b>{profile.coreGpa?.toFixed(2)}</b></span>
            <span>หน่วยกิจ: <b>{profile.activityUnit}</b> หน่วย</span>
            <span>เตรียมความพร้อม: <b>{profile.isPassPrepCourse ? "ผ่าน" : "ไม่ผ่าน"}</b></span>
          </div>
        </div>
        {!profile.isQualified && (
          <button className="btn-link" onClick={() => window.location.href = '/student/profile'}>แก้ไขข้อมูล ↗</button>
        )}
      </div>

      {/* Section 1: Banner แสดงสถานะคำร้อง */}
      <div style={{
        padding: "20px",
        marginBottom: "20px",
        borderRadius: "16px",
        // ✅ ปรับ Logic สีพื้นหลังให้ครอบคลุมทุกสถานะ
        backgroundColor:
          ['QUALIFIED', 'DOCS_APPROVED', 'REQ_LETTER_ISSUED', 'PLACEMENT_LETTER_ISSUED'].includes(currentStatus) ? '#dcfce7' : // สีเขียว (ผ่าน/สำเร็จ)
            ['APPLICATION_EDITS_REQUIRED', 'EDITS_REQUIRED'].includes(currentStatus) ? '#ffedd5' : // สีส้ม (แก้)
              ['QUALIFICATION_FAILED', 'REJECTED'].includes(currentStatus) ? '#fee2e2' : // สีแดง (ตก)
                ['APPLYING'].includes(currentStatus) ? '#fef9c3' : // สีเหลือง (รอ)
                  ['WAITING_FOR_STAFF_CHECK', 'WAITING_FOR_PLACEMENT_LETTER'].includes(currentStatus) ? '#eff6ff' : // สีฟ้า (รอ จนท.)
                    ['ACCEPTANCE_CHECKED'].includes(currentStatus) ? '#d1fae5' : // สีเขียว (กำลังฝึกงาน)
                      '#f1f5f9', // สีเทา (ยังไม่ส่ง)
        border: '1px solid rgba(0,0,0,0.1)',
        color: '#1e293b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

          {/* Icon ใหญ่ด้านหน้า (ตกแต่ง) */}
          <span style={{ fontSize: '32px' }}>
            {['QUALIFIED', 'DOCS_APPROVED', 'REQ_LETTER_ISSUED'].includes(currentStatus) && "✅"}
            {['QUALIFICATION_FAILED', 'REJECTED'].includes(currentStatus) && "❌"}
            {['APPLICATION_EDITS_REQUIRED', 'EDITS_REQUIRED'].includes(currentStatus) && "📝"}
            {['ACCEPTANCE_CHECKED'].includes(currentStatus) && "🚀"}
            {currentStatus === 'APPLYING' && "⏳"}
            {currentStatus === 'NOT_SUBMITTED' && "⚪"}
            {currentStatus === 'WAITING_FOR_STAFF_CHECK' && "🔍"}
          </span>

          <div style={{ flex: 1 }}>
            {/* ✅ ใช้ StatusBadge แสดงชื่อสถานะ + Icon เล็ก */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>สถานะปัจจุบัน:</h3>
              <StatusBadge status={currentStatus} />
            </div>

            {/* ข้อความอธิบายเพิ่มเติม (Optional) */}
            <div style={{ fontSize: '14px', color: '#475569' }}>
              {currentStatus === 'REQ_LETTER_ISSUED' ? 'ดำเนินการเอกสารเรียบร้อยแล้ว' :
                currentStatus === 'APPLICATION_EDITS_REQUIRED' ? 'กรุณาแก้ไขข้อมูลตามคำแนะนำด้านล่าง' :
                  currentStatus === 'DOCS_APPROVED' ? 'เอกสารผ่านครบถ้วน รอเจ้าหน้าที่ออกหนังสือ' :
                    'ติดตามสถานะการดำเนินงานได้ที่นี่'}
            </div>

            {/* แสดงคอมเมนต์ (รองรับทั้งคอมเมนต์อาจารย์ และคอมเมนต์ T000) */}
            {(profile.coop?.teacherCheckComment || profile.coop?.t000Comment) &&
              ['APPLICATION_EDITS_REQUIRED', 'EDITS_REQUIRED', 'QUALIFICATION_FAILED', 'REJECTED'].includes(currentStatus) && (
                <div style={{
                  marginTop: '10px', fontSize: '14px', color: '#b91c1c',
                  background: 'rgba(255,255,255,0.6)', padding: '8px 12px',
                  borderRadius: '8px', border: '1px solid #fecaca'
                }}>
                  <strong>💬 สิ่งที่ต้องแก้ไข:</strong> {profile.coop?.teacherCheckComment || profile.coop?.t000Comment}
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Header & Instructions */}
      <div className="header-card">
        <h1>ขอเข้าร่วมโครงการสหกิจศึกษา</h1>
        <p>
          ระบบยื่นคำร้องสหกิจศึกษา <br />
          <span style={{ color: "#fbbf24", fontWeight: "bold" }}>⚠️ สำคัญ:</span> โปรดตรวจสอบคุณสมบัติของท่านให้ "ผ่าน" ก่อนทำการยื่นคำร้อง และแนบเอกสารให้ครบถ้วน
        </p>
      </div>

      <div className="profile-grid">
        {/* --- CARD 1: ข้อมูลผู้สมัคร --- */}
        <div className="profile-card">
          <div className="card-head">
            <h2 className="profile-title">ข้อมูลผู้สมัครและที่ปรึกษา</h2>
          </div>
          <div className="divider"></div>

          <div className="info-row">
            <span className="label">ชื่อ-นามสกุล:</span>
            <span className="value">{getThaiPrefix(profile.prefix)} {profile.firstName} {profile.lastName}</span>
          </div>
          <div className="info-row"><span className="label">รหัสนักศึกษา:</span><span className="value">{profile.studentId}</span></div>
          <div className="divider"></div>

          {(profile.mentor || profile.coop?.mentor) ? (
            <>
              <div className="card-head"><h2 className="profile-title" style={{ fontSize: '16px' }}>ข้อมูลพี่เลี้ยง (Mentor)</h2></div>
              <div style={{ marginTop: '10px' }}>
                <div className="info-row"><span className="label">ชื่อพี่เลี้ยง:</span><span className="value">{(profile.mentor || profile.coop?.mentor)?.firstName} {(profile.mentor || profile.coop?.mentor)?.lastName}</span></div>
                <div className="info-row"><span className="label">ตำแหน่ง:</span><span className="value">{(profile.mentor || profile.coop?.mentor)?.position || "-"}</span></div>
              </div>
            </>
          ) : (
            <p style={{ color: '#ef4444', fontSize: '14px' }}>* ยังไม่มีข้อมูลพี่เลี้ยง (กรุณาเลือกในหน้า Profile)</p>
          )}
        </div>

        {/* --- CARD 2: แบบฟอร์มการยื่น --- */}
        <div className="profile-card">
          <div className="card-head">
            <h2 className="profile-title">การยื่นคำร้องและเอกสาร</h2>
          </div>
          <div className="divider"></div>

          <div className="info-row">
            <span className="label">หน่วยงาน:</span>
            <span className="value">{(profile.company || profile.coop?.company)?.name || "ยังไม่ได้ระบุ"}</span>
          </div>

          <div style={{ marginTop: "12px" }}>
            <label className="label">ระบุรายละเอียดลักษณะงาน (Job Position):</label>
            <textarea
              className="input"
              rows={3}
              value={coopField}
              onChange={(e) => setCoopField(e.target.value)}
              placeholder="เช่น Programmer, System Analyst..."
              disabled={!canEdit} // ปิดถ้าอยู่ในสถานะรอตรวจ/ผ่านแล้ว
            />
          </div>

          <div style={{ marginTop: "20px" }}>
            <label className="label">อัปโหลด ใบคำร้องขอเข้าร่วมโครงการสหกิจศึกษา () :</label>

            {/* Files List */}
            {profile.documents && profile.documents.length > 0 && (
              <div style={{ marginBottom: 10, padding: 10, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: '#166534', marginBottom: 5 }}>ไฟล์ที่ส่งแล้ว:</div>
                <ul className="file-list" style={{ margin: 0 }}>
                  {profile.documents.map((doc) => (
                    <li key={doc.id} className="file-item" style={{ background: 'white' }}>
                      <span>✅ {doc.name}</span>
                      {/* ปุ่มลบไฟล์เดิม (แสดงเฉพาะตอนที่แก้ได้) */}
                      {canEdit && (
                        <button type="button" onClick={() => handleRemoveExistingFile(doc.id)} className="btn-delete">ลบ ✕</button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* New Files List */}
            {uploadedFiles.length > 0 && (
              <ul className="file-list" style={{ marginTop: 8, background: '#f0f9ff', padding: 10, borderRadius: 8, border: '1px solid #bae6fd' }}>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: '#3aa3ba', marginBottom: 5 }}>กำลังจะอัปโหลด:</div>
                {uploadedFiles.map((file, i) => (
                  <li key={i} className="file-item">
                    <span>📄 {file.name}</span>
                    <button type="button" onClick={() => handleRemoveFile(i)} className="btn-delete">ลบ ✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Upload Input */}
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            className="input"
            style={{ marginTop: '8px', fontSize: '14px' }}
            disabled={!canEdit}
          />

          <div className="action-row">
            <button className="btn btn-success" onClick={() => handleGeneratePDF("preview")}>ดูตัวอย่าง PDF</button>

            {/* ✅ ปุ่ม Submit ที่ฉลาดขึ้น */}
            <button
              className="btn btn-success"
              onClick={handleSubmitApplication}
              disabled={!canSubmit}
              style={{
                opacity: canSubmit ? 1 : 0.6,
                cursor: canSubmit ? "pointer" : "not-allowed",
                backgroundColor: !profile.isQualified ? "#94a3b8" : // สีเทาถ้าคุณสมบัติไม่ผ่าน
                  currentStatus === 'EDITS_REQUIRED' ? "#f59e0b" : // สีส้มถ้าแก้
                    "#10b981" // สีเขียวปกติ
              }}
            >
              {!profile.isQualified ? 'คุณสมบัติไม่ครบ' :
                currentStatus === 'EDITS_REQUIRED' ? 'ส่งแก้ไขคำร้อง' : 'ส่งคำร้องขอสหกิจ'}
            </button>
          </div>
        </div>
      </div>

      {/* PDF POPUP (เหมือนเดิม) */}
      {showPDFPopup && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="card-head">
              <h2 className="profile-title">ตรวจสอบเอกสาร (Preview)</h2>
              <button onClick={() => setShowPDFPopup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
            </div>
            <iframe src={pdfDataUrl} style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: "12px", marginTop: '15px' }} title="Preview" />
            <div className="action-row">
              <button className="btn-secondary" onClick={() => setShowPDFPopup(false)}>ปิด</button>
              <button className="btn" onClick={() => handleGeneratePDF("download")}>ดาวน์โหลด PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PROFILE_CSS = `
.header-card { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; border-radius: 20px; padding: 32px 40px; margin-bottom: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
.header-card h1 { margin: 0; font-size: 24px; font-weight: 800; }
.header-card p { margin: 10px 0 0; opacity: 0.9; font-size: 15px; line-height: 1.6; }
.profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
@media (max-width: 1024px) { .profile-grid { grid-template-columns: 1fr; } }
.profile-card { background: #fff; border-radius: 20px; padding: 28px 40px; box-shadow: 0 8px 24px rgba(15, 23, 42, .08); height: fit-content; }
.card-head { display: flex; justify-content: space-between; align-items: center; }
.profile-title { font-size: 18px; font-weight: 800; margin: 0; color: #1e293b; }
.divider { height: 1px; background: #e5e7eb; margin: 14px 0 18px; }
.info-row { display: grid; grid-template-columns: 140px 1fr; padding: 8px 0; border-bottom: 1px dashed #f1f5f9; }
.info-row:last-child { border-bottom: none; }
.label { color: #64748b; font-weight: 700; font-size: 14px; }
.value { font-weight: 600; color: #334155; }
.input { padding: 12px 14px; border-radius: 12px; border: 1px solid #e5e7eb; width: 100%; margin-top: 8px; box-sizing: border-box; font-family: inherit; }
.file-list { margin: 12px 0; list-style: none; padding: 0; }
.file-item { padding: 8px 12px; border-radius: 8px; margin-bottom: 6px; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
.btn-delete { background: #fee2e2; border: 1px solid #fca5a5; color: #b91c1c; border-radius: 6px; cursor: pointer; padding: 4px 10px; font-size: 12px; margin-left: 10px; font-weight: 600; }
.btn-delete:hover { background: #fca5a5; }
.btn-link { background: none; border: none; color: #2563eb; text-decoration: underline; cursor: pointer; font-size: 14px; }
.action-row { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
.btn { background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 10px; font-weight: 700; border: none; cursor: pointer; font-size: 14px; }
.btn-success { background: #10b981; color: white; }
.btn-secondary { background: #64748b; color: white; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, .6); display: flex; align-items: center; justify-content: center; z-index: 50; backdrop-filter: blur(4px); }
.modal-card { background: #fff; border-radius: 20px; padding: 28px 32px; width: 850px; max-width: 95%; height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
`;