import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createCoopPDF } from "../utils/pdfGenerator";
import StatusBadge from "../components/StatusBadge";
import S_StatusTracker from "./S_StatusTracker";
import { useToast } from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";
import Spinner from "../components/Spinner";

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
  contactPerson?: string;
  contactPosition?: string;
}

interface CoopInfo {
  company: Company;
  mentor?: Mentor;
  status?: string;
  teacherCheckComment?: string;
  t000Comment?: string;
  jobPosition?: string;
}

interface StudentDocument {
  id: number;
  name: string;
  path: string;
  type?: string;
}

interface StudentProfile {
  studentId: string;
  userEmail?: string;
  email?: string;
  phone?: string;
  prefix?: string;
  firstName?: string;
  lastName?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  year?: string;
  major?: string;
  curriculum?: string;
  studyProgram?: string;
  advisorName?: string;

  company?: Company;
  mentor?: Mentor;
  coop?: CoopInfo;
  documents?: StudentDocument[];
}

export default function CoopRequestPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [coopField, setCoopField] = useState("");
  const [showPDFPopup, setShowPDFPopup] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState("");
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [gradeSheetUrl, setGradeSheetUrl] = useState("");

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
      // 1. ดึงข้อมูลนักศึกษา
      const res = await fetch("/api/students/me", {
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
        });

        if (data.coop?.jobPosition) {
          setCoopField(data.coop.jobPosition);
        }
      }

      // 2. ดึงรอบรับสมัครที่เปิดอยู่ (Active Period)
      const periodRes = await fetch("/api/students/coop-periods/active", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (periodRes.ok) {
        const pData = await periodRes.json();
        if (pData.ok && pData.period) {
          setActivePeriod(pData.period);
        } else {
          setActivePeriod(null);
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
    setConfirmDelete(docId);
  };

  const doRemoveFile = async (docId: number) => {
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/coop/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setProfile((prev) => {
          if (!prev) return null;
          return { ...prev, documents: prev.documents?.filter((d) => d.id !== docId) };
        });
        toast.success("ลบไฟล์เรียบร้อย");
      } else toast.error("ลบไม่สำเร็จ: " + data.message);
    } catch { toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // กรองเฉพาะไฟล์ที่เป็นประเภท APPLICATION_DOC
  const gatewayDocs = profile?.documents?.filter(doc =>
    doc.type === 'APPLICATION_DOC'
  ) || [];

  // ฟังก์ชันตรวจสอบเวลาของรอบรับสมัคร
  const isTimeValid = () => {
    if (!activePeriod || !activePeriod.isActive) return false;
    const now = new Date().getTime();
    const start = new Date(activePeriod.startDate).getTime();
    const end = new Date(activePeriod.endDate).setHours(23, 59, 59, 999);
    return now >= start && now <= end;
  };

  const handleSubmitApplication = async () => {
    if (!activePeriod || !isTimeValid()) {
      toast.error("ไม่สามารถยื่นคำร้องได้ เนื่องจากขณะนี้ไม่มีรอบการรับสมัครที่เปิดอยู่ หรือนอกช่วงเวลา");
      return;
    }
    const hasCompany = profile?.coop?.company || profile?.company;
    if (!hasCompany) {
      toast.warning("กรุณาเลือกบริษัทและพี่เลี้ยงก่อนยื่นคำร้อง");
      return;
    }
    const hasExistingDocs = gatewayDocs.length > 0;
    const hasNewDocs = uploadedFiles.length > 0;
    if (!hasExistingDocs && !hasNewDocs) {
      toast.warning("กรุณาอัปโหลดเอกสารประกอบอย่างน้อย 1 ไฟล์");
      return;
    }

    // Validate gradeSheetUrl — ต้องเป็น Google Sheets URL เท่านั้น
    const trimmedUrl = gradeSheetUrl.trim();
    if (trimmedUrl) {
      try {
        const u = new URL(trimmedUrl);
        if (!["https:", "http:"].includes(u.protocol)) {
          toast.warning("ลิงก์แบบฟอร์มต้องเป็น URL ที่ถูกต้อง (https://...)");
          return;
        }
      } catch {
        toast.warning("ลิงก์แบบฟอร์มตรวจสอบการสำเร็จการศึกษาไม่ถูกต้อง");
        return;
      }
    }

    const formData = new FormData();
    formData.append("jobPosition", coopField);
    formData.append("coopPeriodId", activePeriod.id.toString());
    if (trimmedUrl) formData.append("gradeSheetUrl", trimmedUrl);
    uploadedFiles.forEach((file) => formData.append("files", file));

    setSubmitting(true);
    try {
      const res = await fetch("/api/coop/apply", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("ส่งคำร้องเรียบร้อยแล้ว สถานะ: รออาจารย์ตรวจสอบ");
        setUploadedFiles([]);
        fetchData();
      } else {
        toast.error("เกิดข้อผิดพลาด: " + data.message);
      }
    } catch { toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้"); }
    finally { setSubmitting(false); }
  };

  const handleGeneratePDF = async (mode: "preview" | "download") => {
    if (!profile) return;
    try {
      const doc = await createCoopPDF(profile, coopField);
      if (mode === "download") {
        doc.save(`KKU_Coop_${profile.studentId}.pdf`);
      } else {
        const pdfBlobUrl = doc.output("bloburl");
        setPdfDataUrl(pdfBlobUrl.toString());
        setShowPDFPopup(true);
      }
    } catch {
      toast.error("ไม่สามารถสร้าง PDF ได้ กรุณาลองใหม่อีกครั้ง");
    }
  };

  if (!profile) return <div style={{ padding: 40, textAlign: 'center' }}>กำลังโหลดข้อมูล...</div>;

  const currentStatus = profile.coop?.status || "NOT_SUBMITTED";
  const canEdit = currentStatus === "NOT_SUBMITTED" || currentStatus === "APPLICATION_EDITS_REQUIRED" || currentStatus === "EDITS_REQUIRED";
  const canSubmit = canEdit && isTimeValid();

  const displayCompany = profile.coop?.company || profile.company;
  const displayMentor = profile.coop?.mentor || profile.mentor;
  const hasCompany = !!displayCompany;

  // Step Indicator logic
  const STEPS = [
    { label: "ตรวจสอบคุณสมบัติ", statuses: ["NOT_SUBMITTED", "APPLYING", "QUALIFICATION_FAILED", "APPLICATION_EDITS_REQUIRED", "QUALIFIED"] },
    { label: "ส่งเอกสาร T000", statuses: ["WAITING_FOR_STAFF_CHECK", "EDITS_REQUIRED", "DOCS_APPROVED"] },
    { label: "รอหนังสือ & ตอบรับ", statuses: ["REQ_LETTER_ISSUED", "WAITING_FOR_PLACEMENT_LETTER", "WAITING_FOR_STAFF_CHECK_LETTER", "ACCEPTANCE_CHECKED", "PLACEMENT_LETTER_ISSUED"] },
    { label: "ออกฝึกสหกิจ", statuses: ["INTERNSHIP_STARTED", "T002_SUBMITTED", "T002_EDITS_REQUIRED", "T003_SUBMITTED", "T003_EDITS_REQUIRED", "PENDING_TEACHER", "TEACHER_REJECTED", "DATE_CONFIRMED", "LETTER_UPLOADED", "COMPLETED"] },
  ];
  const currentStep = STEPS.findIndex((s) => s.statuses.includes(currentStatus));
  const activeStep = currentStep === -1 ? 0 : currentStep;

  return (
    <div className="page" style={{ padding: "40px 20px", maxWidth: "1200px", margin: "0 auto" }}>
      <style>{PROFILE_CSS}</style>

      {/* ================= STEP INDICATOR ================= */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 28, gap: 0, overflowX: "auto", paddingBottom: 4 }}>
        {STEPS.map((step, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 120 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 15,
                  background: done ? "#22c55e" : active ? "#0074B7" : "rgba(100,116,139,.15)",
                  color: done || active ? "#fff" : "#94a3b8",
                  border: active ? "3px solid #bfdbfe" : "2px solid transparent",
                  transition: ".2s", flexShrink: 0,
                }}>
                  {done ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: active ? "#0074B7" : done ? "#16a34a" : "#94a3b8", textAlign: "center", lineHeight: 1.3, whiteSpace: "nowrap" }}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 3, margin: "0 4px", marginBottom: 20, background: done ? "#22c55e" : "rgba(100,116,139,.15)", transition: ".3s", borderRadius: 2 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* ConfirmDialog for file delete */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="ยืนยันการลบไฟล์"
        message="ต้องการลบไฟล์นี้ออกจากระบบใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้"
        icon="🗑️"
        confirmLabel="ลบไฟล์"
        confirmColor="#ef4444"
        onConfirm={() => confirmDelete !== null && doRemoveFile(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* ================= ป้ายแจ้งเตือนรอบการรับสมัคร ================= */}
      {!isTimeValid() ? (
        <div style={{
          padding: "16px 24px", marginBottom: "24px", borderRadius: "12px",
          background: "#fee2e2", border: "1px solid #fecaca", color: "#b91c1c",
          display: "flex", gap: "15px", alignItems: "center"
        }}>
          <div style={{ fontSize: "32px" }}>🚫</div>
          <div>
            <strong style={{ fontSize: '18px' }}>ระบบปิดรับสมัคร หรือ นอกช่วงเวลาการยื่นคำร้อง</strong>
            <div style={{ marginTop: 4, fontSize: 14 }}>
              {activePeriod
                ? `รอบการรับสมัครที่ตั้งไว้: เทอม ${activePeriod.semester}/${activePeriod.academicYear} (เปิดรับ: ${new Date(activePeriod.startDate).toLocaleDateString('th-TH')} - ${new Date(activePeriod.endDate).toLocaleDateString('th-TH')}) แต่สถานะระบบปิดใช้งาน หรือหมดเขตแล้ว`
                : "ขณะนี้ยังไม่มีการเปิดรอบรับสมัครสหกิจศึกษาในระบบ กรุณาติดต่อเจ้าหน้าที่"}
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          padding: "16px 24px", marginBottom: "24px", borderRadius: "12px",
          background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a",
          display: "flex", gap: "15px", alignItems: "center"
        }}>
          <div style={{ fontSize: "32px" }}>📅</div>
          <div>
            <strong style={{ fontSize: '16px' }}>กำลังเปิดรับสมัครคำร้องสหกิจศึกษา</strong>
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: "bold" }}>
              รอบการรับสมัคร: เทอม {activePeriod.semester} / ปีการศึกษา {activePeriod.academicYear}
            </div>
            <div style={{ fontSize: 13, color: "#3b82f6" }}>
              (เปิดรับตั้งแต่: {new Date(activePeriod.startDate).toLocaleDateString('th-TH')} ถึง {new Date(activePeriod.endDate).toLocaleDateString('th-TH')})
            </div>
          </div>
        </div>
      )}

      {/* ================= STATUS TRACKER ================= */}
      {currentStatus !== "NOT_SUBMITTED" && (
        <S_StatusTracker status={currentStatus} lastComment={profile?.coop?.teacherCheckComment || profile?.coop?.t000Comment} />
      )}

      {/* ================= SECTION 1: สถานะคำร้อง ================= */}
      <div style={{
        padding: "20px", marginBottom: "20px", borderRadius: "16px",
        backgroundColor:
          ['QUALIFIED', 'DOCS_APPROVED', 'REQ_LETTER_ISSUED', 'PLACEMENT_LETTER_ISSUED'].includes(currentStatus) ? '#dcfce7' :
            ['APPLICATION_EDITS_REQUIRED', 'EDITS_REQUIRED'].includes(currentStatus) ? '#ffedd5' :
              ['QUALIFICATION_FAILED', 'REJECTED'].includes(currentStatus) ? '#fee2e2' :
                ['APPLYING'].includes(currentStatus) ? '#fef9c3' :
                  ['WAITING_FOR_STAFF_CHECK', 'WAITING_FOR_PLACEMENT_LETTER'].includes(currentStatus) ? '#eff6ff' :
                    ['ACCEPTANCE_CHECKED'].includes(currentStatus) ? '#d1fae5' : '#f1f5f9',
        border: '1px solid rgba(0,0,0,0.1)', color: '#1e293b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>สถานะปัจจุบัน:</h3>
              <StatusBadge status={currentStatus} />
            </div>
            {(profile.coop?.teacherCheckComment || profile.coop?.t000Comment) &&
              ['APPLICATION_EDITS_REQUIRED', 'EDITS_REQUIRED', 'QUALIFICATION_FAILED', 'REJECTED'].includes(currentStatus) && (
                <div style={{ marginTop: '10px', fontSize: '14px', color: '#b91c1c', background: 'rgba(255,255,255,0.6)', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <strong>💬 สิ่งที่ต้องแก้ไข:</strong> {profile.coop?.teacherCheckComment || profile.coop?.t000Comment}
                </div>
              )}
          </div>
        </div>
      </div>

      <div className="header-card">
        <h1>ขอเข้าร่วมโครงการสหกิจศึกษา</h1>
        <p>ยื่นคำร้องขอเข้าร่วมโครงการ โปรดตรวจสอบข้อมูลให้ถูกต้องก่อนกดส่งคำร้อง</p>
      </div>

      {/* ================= SECTION 2: ข้อมูลผู้สมัคร และ หน่วยงาน ================= */}
      <div className="profile-grid">
        <div className="profile-card">
          <div className="card-head">
            <h2 className="profile-title">ข้อมูลผู้สมัคร</h2>
            <button className="btn-link" onClick={() => navigate('/student/profile')} style={{ fontSize: 13 }}>แก้ไขข้อมูล ↗</button>
          </div>
          <div className="divider"></div>

          <div className="info-row"><span className="label">ชื่อ-นามสกุล (TH):</span><span className="value">{getThaiPrefix(profile.prefix)} {profile.firstName} {profile.lastName}</span></div>
          <div className="info-row"><span className="label">ชื่อ-นามสกุล (EN):</span><span className="value">{profile.firstNameEn || "-"} {profile.lastNameEn || "-"}</span></div>
          <div className="info-row"><span className="label">รหัสนักศึกษา:</span><span className="value">{profile.studentId}</span></div>
          <div className="info-row"><span className="label">สาขาวิชา:</span><span className="value">{profile.major || "-"} (ปี {profile.year || "-"})</span></div>
          <div className="info-row"><span className="label">คณะ:</span><span className="value">{profile.curriculum || "-"}</span></div>
          <div className="info-row"><span className="label">ที่ปรึกษา:</span><span className="value">{profile.advisorName || "-"}</span></div>
          <div className="info-row"><span className="label">เบอร์โทรศัพท์:</span><span className="value">{profile.phone || "-"}</span></div>
          <div className="info-row"><span className="label">อีเมลติดต่อ:</span><span className="value">{profile.email || "-"}</span></div>
        </div>

        <div className="profile-card">
          <div className="card-head">
            <h2 className="profile-title">ข้อมูลหน่วยงานและพี่เลี้ยง</h2>
          </div>
          <div className="divider"></div>

          {hasCompany ? (
            <>
              <h4 style={{ margin: '0 0 10px 0', color: '#1e293b', fontSize: 15 }}>🏢 ข้อมูลบริษัท</h4>
              <div className="info-row"><span className="label">ชื่อหน่วยงาน:</span><span className="value">{displayCompany.name}</span></div>
              <div className="info-row"><span className="label">ที่อยู่:</span><span className="value">{displayCompany.address || "-"}</span></div>
              <div className="info-row"><span className="label">ผู้ติดต่อ (HR):</span><span className="value">{displayCompany.contactPerson || "-"}</span></div>
              <div className="info-row"><span className="label">เบอร์โทรศัพท์:</span><span className="value">{displayCompany.phone || "-"}</span></div>

              <div className="divider" style={{ margin: '15px 0' }}></div>
              <h4 style={{ margin: '0 0 10px 0', color: '#1e293b', fontSize: 15 }}>👤 ข้อมูลพี่เลี้ยง (Mentor)</h4>

              {displayMentor ? (
                <>
                  <div className="info-row"><span className="label">ชื่อพี่เลี้ยง:</span><span className="value">{displayMentor.firstName} {displayMentor.lastName}</span></div>
                  <div className="info-row"><span className="label">ตำแหน่ง:</span><span className="value">{displayMentor.position || "-"}</span></div>
                  <div className="info-row"><span className="label">เบอร์โทรศัพท์:</span><span className="value">{displayMentor.phone || "-"}</span></div>
                  <div className="info-row"><span className="label">อีเมล:</span><span className="value">{displayMentor.email || "-"}</span></div>
                </>
              ) : (
                <div style={{ padding: '10px', background: '#fff7ed', borderRadius: '8px', color: '#9a3412', fontSize: 14 }}>
                  ⚠️ ยังไม่ได้ระบุพี่เลี้ยง กรุณาเพิ่มที่หน้าข้อมูลนักศึกษา
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 10px', background: '#fee2e2', borderRadius: '12px', border: '1px dashed #fca5a5' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏢</div>
              <p style={{ color: '#b91c1c', fontWeight: 'bold', fontSize: 16, margin: '0 0 15px 0' }}>ท่านยังไม่ได้เลือกบริษัทหรือพี่เลี้ยงฝึกงาน</p>
              <button className="btn" style={{ background: '#dc2626', margin: '0 auto' }} onClick={() => navigate('/student/profile')}>
                ไปหน้าโปรไฟล์ เพื่อเลือกหน่วยงาน
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================= SECTION 3: การยื่นคำร้องและเอกสาร ================= */}
      <div className="profile-card" style={{ marginTop: '28px' }}>
        <div className="card-head">
          <h2 className="profile-title">ฟอร์มยื่นคำร้องและอัปโหลดเอกสาร</h2>
        </div>
        <div className="divider"></div>

        <div>
          <label className="label" style={{ fontSize: 15 }}>ระบุลักษณะงาน (Job Position) <span style={{ color: 'red' }}>*</span></label>
          <textarea
            className="input"
            rows={2}
            value={coopField}
            onChange={(e) => setCoopField(e.target.value)}
            placeholder="เช่น Frontend Developer, System Analyst, Data Scientist..."
            disabled={!canEdit}
          />
        </div>

        {/* ================= แบบฟอร์มตรวจสอบการสำเร็จการศึกษา ================= */}
        <div style={{ marginTop: 24, padding: '16px 20px', background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1e40af', marginBottom: 6 }}>
            📊 แบบฟอร์มตรวจสอบการสำเร็จการศึกษา
          </div>
          <p style={{ fontSize: 13, color: '#3b82f6', margin: '0 0 12px' }}>
            กรุณา Make a Copy แบบฟอร์มด้านล่าง กรอกข้อมูลให้ครบ แล้วนำลิงก์ที่แชร์มาใส่ในช่องด้านล่าง
          </p>
          <a
            href="https://docs.google.com/spreadsheets/d/1HGWTsoScRc3XU0abUn6J9TgyFksAoi1V/copy"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none', marginBottom: 14 }}
          >
            📋 Make a Copy แบบฟอร์ม
          </a>
          <div>
            <label className="label" style={{ fontSize: 14 }}>ลิงก์แบบฟอร์มที่กรอกแล้ว (Google Sheets) <span style={{ color: 'red' }}>*</span></label>
            <input
              className="input"
              type="url"
              value={gradeSheetUrl}
              onChange={e => setGradeSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              disabled={!canEdit}
            />
            <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>วางลิงก์ Google Sheets ที่แชร์ได้ (Share → Anyone with the link)</p>
          </div>
        </div>

        <div style={{ marginTop: "24px" }}>
          <label className="label" style={{ fontSize: 15 }}>อัปโหลดเอกสารประกอบ <span style={{ color: 'red' }}>*</span></label>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 10px 0' }}>เช่น ใบคำร้อง, ทรานสคริปต์, หนังสือรับรอง ฯลฯ (รองรับ PDF, รูปภาพ)</p>

          {/* ไฟล์ที่อยู่ในระบบแล้ว */}
          {gatewayDocs.length > 0 && (
            <div style={{ marginBottom: 15, padding: 15, background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: '#166534', marginBottom: 8 }}>✅ ไฟล์ที่อยู่ในระบบแล้ว:</div>
              <ul className="file-list" style={{ margin: 0 }}>
                {gatewayDocs.map((doc) => (
                  <li key={doc.id} className="file-item" style={{ background: 'white' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>📄 {doc.name}</span>
                    {canEdit && (
                      <button type="button" onClick={() => handleRemoveExistingFile(doc.id)} className="btn-delete">ลบไฟล์ ✕</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ไฟล์ใหม่ที่เตรียมจะอัปโหลด */}
          {uploadedFiles.length > 0 && (
            <ul className="file-list" style={{ marginTop: 8, background: '#f0f9ff', padding: 15, borderRadius: 10, border: '1px solid #bae6fd' }}>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: '#0284c7', marginBottom: 8 }}>⏳ ไฟล์ใหม่ที่กำลังจะอัปโหลด:</div>
              {uploadedFiles.map((file, i) => (
                <li key={i} className="file-item" style={{ background: 'white' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>📄 {file.name}</span>
                  <button type="button" onClick={() => handleRemoveFile(i)} className="btn-delete">ลบไฟล์ ✕</button>
                </li>
              ))}
            </ul>
          )}

          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            className="input"
            style={{ marginTop: '10px', fontSize: '15px', padding: '10px', background: '#f8fafc', borderStyle: 'dashed' }}
            disabled={!canEdit}
          />
        </div>

        <div className="action-row" style={{ marginTop: 30, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
          <button className="btn btn-secondary" onClick={() => handleGeneratePDF("preview")}>👁️ ดูตัวอย่างใบคำร้อง (PDF)</button>

          <button
            className="btn btn-success"
            onClick={handleSubmitApplication}
            disabled={!canSubmit || submitting}
            style={{
              padding: '12px 30px', fontSize: '16px',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              opacity: canSubmit && !submitting ? 1 : 0.5,
              cursor: canSubmit && !submitting ? "pointer" : "not-allowed",
              backgroundColor: !isTimeValid() ? "#94a3b8" :
                currentStatus === 'EDITS_REQUIRED' ? "#f59e0b" : "#10b981"
            }}
          >
            {submitting
              ? <><Spinner size={18} color="#fff" /> กำลังส่ง...</>
              : !isTimeValid() ? '🚫 นอกช่วงเวลาการยื่นคำร้อง'
              : currentStatus === 'EDITS_REQUIRED' ? '📤 ส่งแก้ไขคำร้อง'
              : '🚀 ส่งคำร้องขอสหกิจศึกษา'}
          </button>
        </div>
      </div>

      {/* PDF POPUP */}
      {showPDFPopup && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="card-head">
              <h2 className="profile-title">ตรวจสอบเอกสาร (Preview)</h2>
              <button onClick={() => setShowPDFPopup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '28px' }}>&times;</button>
            </div>
            <iframe src={pdfDataUrl} style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: "12px", marginTop: '15px' }} title="Preview" />
            <div className="action-row" style={{ marginTop: 20 }}>
              <button className="btn-secondary" onClick={() => setShowPDFPopup(false)}>ปิดหน้าต่าง</button>
              <button className="btn" style={{ background: '#2563eb' }} onClick={() => handleGeneratePDF("download")}>ดาวน์โหลด PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const PROFILE_CSS = `
.header-card { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; border-radius: 20px; padding: 32px 40px; margin-bottom: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
.header-card h1 { margin: 0; font-size: 26px; font-weight: 800; }
.header-card p { margin: 10px 0 0; opacity: 0.9; font-size: 16px; line-height: 1.6; }
.profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
@media (max-width: 1024px) { .profile-grid { grid-template-columns: 1fr; } }
.profile-card { background: #fff; border-radius: 20px; padding: 28px 40px; box-shadow: 0 8px 24px rgba(15, 23, 42, .05); border: 1px solid #f1f5f9; height: fit-content; }
.card-head { display: flex; justify-content: space-between; align-items: center; }
.profile-title { font-size: 18px; font-weight: 800; margin: 0; color: #0f172a; }
.divider { height: 1px; background: #e2e8f0; margin: 14px 0 18px; }

/* 🟢 ปรับ CSS ให้เส้นคั่น, ระยะห่าง และฟอนต์ เหมือนหน้า Profile 100% */
.info-row { display: grid; grid-template-columns: 160px 1fr; padding: 10px 0; border-bottom: 1px solid #f8fafc; align-items: start; }
.info-row:last-child { border-bottom: none; }
.label { color: #64748b; font-weight: 700; font-size: 14px; }
.value { font-weight: 600; color: #1e293b; font-size: 14px; }

.input { padding: 12px 16px; border-radius: 10px; border: 1px solid #cbd5e1; width: 100%; margin-top: 8px; box-sizing: border-box; font-family: inherit; font-size: 14px; transition: 0.2s; font-weight: 600; }
.input:focus { border-color: #3b82f6; outline: none; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.file-list { margin: 12px 0; list-style: none; padding: 0; }
.file-item { padding: 12px 16px; border-radius: 10px; margin-bottom: 8px; font-size: 14px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e2e8f0; }
.btn-delete { background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; border-radius: 8px; cursor: pointer; padding: 6px 12px; font-size: 13px; margin-left: 10px; font-weight: 700; transition: 0.2s; }
.btn-delete:hover { background: #fecaca; }
.btn-link { background: none; border: none; color: #2563eb; font-weight: 700; cursor: pointer; padding: 0; display: inline-block; transition: 0.2s; }
.btn-link:hover { color: #1d4ed8; text-decoration: underline; }
.action-row { display: flex; justify-content: flex-end; gap: 12px; }
.btn { display: inline-flex; justify-content: center; align-items: center; color: #fff; padding: 12px 24px; border-radius: 10px; font-weight: 700; border: none; cursor: pointer; font-size: 14px; transition: 0.2s; font-family: inherit; }
.btn-success { background: #10b981; }
.btn-success:hover:not(:disabled) { background: #059669; }
.btn-secondary { background: #f1f5f9; color: #475569; padding: 12px 24px; border-radius: 10px; font-weight: 700; border: none; cursor: pointer; font-size: 14px; transition: 0.2s; font-family: inherit; }
.btn-secondary:hover { background: #e2e8f0; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, .6); display: flex; align-items: center; justify-content: center; z-index: 50; backdrop-filter: blur(4px); }
.modal-card { background: #fff; border-radius: 20px; padding: 32px; width: 900px; max-width: 95%; height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
`;