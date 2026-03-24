import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";

/* =========================
   Types
========================= */
type VisitStatus = "scheduled" | "done";

interface Visit {
  id: number;
  studentId: number;
  date: string;
  time?: string;
  location?: string;
  note?: string;
  status: VisitStatus;
}

interface StudentDocument {
  id: number;
  name: string;
  path: string;
}

interface Mentor {
  firstName?: string;
  lastName?: string;
  position?: string;
  department?: string;
  email?: string;
  phone?: string;
}

interface Company {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

interface StudentProfile {
  id: number;
  studentId: string;
  firstName?: string;
  lastName?: string;
  year?: string;
  faculty?: string;
  major?: string;
  studyProgram?: string;
  gpa?: number;
  phone?: string;
  user?: { email: string };
  nationality?: string;
  company?: Company;
  docStatus?: string;
  coop?: {
    status?: string;
    company?: Company;
    mentor?: Mentor;
  };
  documents?: StudentDocument[];
}

/* =========================
   Main Component
========================= */
export default function T_StudentDetail() {
  const { studentId = "" } = useParams();
  const token = localStorage.getItem("coop.token");

  // --- State ---
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"profile" | "company" | "docs" | "visits">("profile");

  // --- Preview State (Popup) ---
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewType, setPreviewType] = useState<"pdf" | "image" | "other">("pdf");
  const [currentDocName, setCurrentDocName] = useState("");

  // --- Form State ---
  const [visitForm, setVisitForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    location: "",
    note: ""
  });

  // --- Helpers ---
  const companyData = student?.coop?.company || student?.company;
  const mentorData = student?.coop?.mentor;

  const handleViewFile = (doc: StudentDocument) => {
    const url = `http://localhost:5000/uploads/${doc.path}`;
    setPreviewUrl(url);
    setCurrentDocName(doc.name);

    const ext = doc.name.split('.').pop()?.toLowerCase() || "";
    setPreviewType(['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? "image" : "pdf");

    setShowPreviewModal(true);
  };

  const closePreview = () => {
    setShowPreviewModal(false);
    setPreviewUrl("");
  };

  // --- Fetch Data ---
  const fetchData = async () => {
    try {
      setLoading(true);
      const resStd = await fetch("http://localhost:5000/api/students", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resStd.ok) {
        const allData: StudentProfile[] = await resStd.json();
        const found = allData.find(s => s.studentId === studentId);
        setStudent(found || null);
      }

      const resVisit = await fetch(`http://localhost:5000/api/visits/student/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resVisit.ok) {
        const dataVisit = await resVisit.json();
        const mapped = dataVisit.map((v: any) => ({
          ...v,
          date: v.date.split('T')[0]
        }));
        setVisits(mapped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId && token) {
      fetchData();
    }
  }, [studentId, token]);

  // --- Actions (Visits) ---
  const addVisit = async () => {
    if (!visitForm.date) return alert("กรุณาเลือกวันที่");
    try {
      const res = await fetch("http://localhost:5000/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId: studentId, ...visitForm }),
      });
      if (res.ok) {
        alert("✅ บันทึกนัดหมายแล้ว");
        setVisitForm({ date: new Date().toISOString().slice(0, 10), time: "09:00", location: "", note: "" });
        fetchData();
      } else { alert("❌ บันทึกไม่สำเร็จ"); }
    } catch (err) { console.error(err); }
  };

  const toggleDone = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/visits/${id}/toggle`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchData();
    } catch (err) { console.error(err); }
  };

  const removeVisit = async (id: number) => {
    if (!confirm("ยืนยันลบรายการนี้?")) return;
    try {
      const res = await fetch(`http://localhost:5000/api/visits/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchData();
    } catch (err) { console.error(err); }
  };

  // --- UI ---
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>กำลังโหลดข้อมูล...</div>;
  if (!student) return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>ไม่พบข้อมูลนักศึกษา</div>;

  const fullName = `${student.firstName || ""} ${student.lastName || ""}`.trim();

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

      {/* Header */}
      <section className="card p-6 mb-6">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontWeight: 800, fontSize: 24, color: '#0f172a' }}>{fullName}</h2>
              <StatusBadge status={student.coop?.status || student.docStatus} />
            </div>
            <div style={{ color: "#64748b", fontSize: 14, display: 'flex', gap: 16, alignItems: 'center' }}>
              <span>รหัสนักศึกษา: <b style={{ color: '#0ea5e9' }}>{student.studentId}</b></span>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#cbd5e1' }} />
              <span>สาขา: <b>{student.major || "-"}</b></span>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#cbd5e1' }} />
              <span>บริษัท: <b>{companyData?.name || "-"}</b></span>
            </div>
          </div>
          <Link
            to="/teacher/students"
            style={{
              background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1',
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
              padding: '10px 20px', borderRadius: '10px', fontWeight: 700, fontSize: 14, transition: '0.2s'
            }}
          >
            ← กลับหน้ารายชื่อ
          </Link>
        </div>

        {/* 🟢 ใช้ Tab สไตล์เดียวกับ Admin */}
        <div style={{ marginTop: 24, display: "flex", gap: 8, background: '#f8fafc', padding: 6, borderRadius: 16 }}>
          <button className={`tab-btn ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>👤 ข้อมูลส่วนตัว</button>
          <button className={`tab-btn ${tab === "company" ? "active" : ""}`} onClick={() => setTab("company")}>🏢 บริษัทและพี่เลี้ยง</button>
          <button className={`tab-btn ${tab === "docs" ? "active" : ""}`} onClick={() => setTab("docs")}>📄 เอกสารนักศึกษา</button>
          <button className={`tab-btn ${tab === "visits" ? "active" : ""}`} onClick={() => setTab("visits")}>📅 บันทึกนัดนิเทศ</button>
        </div>
      </section>

      {/* Tab Content */}
      <div style={{ display: 'grid', gap: 20 }}>

        {/* Tab 1: Profile */}
        {tab === "profile" && (
          <Section title="ข้อมูลนักศึกษา">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 40px' }}>
              <InfoRow label="รหัสนักศึกษา" value={student.studentId} />
              <InfoRow label="ชื่อ–นามสกุล" value={fullName} />
              <InfoRow label="ชั้นปี" value={student.year || "-"} />
              <InfoRow label="คณะ" value={student.faculty || "วิทยาลัยการคอมพิวเตอร์"} />
              <InfoRow label="สาขาวิชา" value={student.major || "-"} />
              <InfoRow label="รูปแบบการศึกษา" value={student.studyProgram || "-"} />
              <InfoRow label="เบอร์โทรศัพท์" value={student.phone || "-"} />
              <InfoRow label="อีเมลมหาวิทยาลัย" value={student.user?.email || "-"} highlight />
              <InfoRow label="GPA" value={student.gpa?.toFixed(2) || "-"} />
              <InfoRow label="สัญชาติ" value={student.nationality || "ไทย"} />
            </div>
          </Section>
        )}

        {/* Tab 2: Company */}
        {tab === "company" && (
          <>
            <Section title="ข้อมูลสถานประกอบการ">
              {companyData ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <InfoRow label="ชื่อบริษัท" value={companyData.name} />
                  <InfoRow label="ที่อยู่" value={companyData.address || "-"} />
                  <InfoRow label="อีเมล" value={companyData.email || "-"} />
                  <InfoRow label="เบอร์โทร" value={companyData.phone || "-"} />
                  <InfoRow label="เว็บไซต์" value={companyData.website ? <a href={companyData.website} target="_blank" rel="noreferrer" style={{ color: '#0ea5e9' }}>{companyData.website}</a> : "-"} />
                </div>
              ) : (<div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>นักศึกษายังไม่ได้ระบุข้อมูลสถานประกอบการ</div>)}
            </Section>

            <Section title="ข้อมูลพี่เลี้ยง (Mentor)">
              {mentorData ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <InfoRow label="ชื่อ-นามสกุล" value={`${mentorData.firstName || ""} ${mentorData.lastName || ""}`} />
                  <InfoRow label="ตำแหน่ง" value={mentorData.position || "-"} />
                  <InfoRow label="แผนก" value={mentorData.department || "-"} />
                  <InfoRow label="อีเมล" value={mentorData.email || "-"} />
                  <InfoRow label="เบอร์โทร" value={mentorData.phone || "-"} />
                </div>
              ) : (<div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>นักศึกษายังไม่ได้ระบุข้อมูลพี่เลี้ยง</div>)}
            </Section>
          </>
        )}

        {/* Tab 3: Documents */}
        {tab === "docs" && (
          <Section title="เอกสารแนบของนักศึกษา">
            {student.documents && student.documents.length > 0 ? (
              <ul style={{ padding: 0, listStyle: 'none', display: 'grid', gap: 12, margin: 0 }}>
                {student.documents.map((doc) => (
                  <li key={doc.id} style={{ padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, background: '#eff6ff', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, fontSize: 18 }}>📄</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{doc.name}</div>
                      </div>
                    </div>
                    <button className="btn-primary" onClick={() => handleViewFile(doc)} style={{ padding: '8px 16px', fontSize: 13 }}>
                      เปิดดูไฟล์ ↗
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>ไม่มีเอกสารแนบในระบบ</div>
            )}
          </Section>
        )}

        {/* Tab 4: Visits */}
        {tab === "visits" && (
          <section className="card p-6">
            <h3 style={{ margin: '0 0 20px 0', color: '#0f172a', fontSize: 18, fontWeight: 800 }}>📅 บันทึกและจัดการนัดนิเทศ</h3>

            {/* Form เพิ่มนัด */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'end', flexWrap: 'wrap', background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div>
                <label className="input-label">วันที่นัดหมาย</label>
                <input type="date" className="input" value={visitForm.date} onChange={e => setVisitForm({ ...visitForm, date: e.target.value })} />
              </div>
              <div>
                <label className="input-label">เวลา</label>
                <input type="time" className="input" value={visitForm.time} onChange={e => setVisitForm({ ...visitForm, time: e.target.value })} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label className="input-label">บันทึกรายละเอียด / สถานที่</label>
                <input type="text" className="input" placeholder="ระบุรายละเอียด..." value={visitForm.note} onChange={e => setVisitForm({ ...visitForm, note: e.target.value })} />
              </div>
              <button className="btn-primary" style={{ height: 44, padding: '0 24px' }} onClick={addVisit}>➕ เพิ่มนัดหมาย</button>
            </div>

            {/* Table นัดหมาย */}
            <table className="student-table">
              <thead>
                <tr>
                  <th>วันเวลา</th>
                  <th>บันทึกรายละเอียด</th>
                  <th>สถานะ</th>
                  <th style={{ textAlign: 'right' }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id} className="student-row">
                    <td style={{ fontWeight: 700, color: '#1e293b' }}>
                      {new Date(v.date).toLocaleDateString('th-TH', { dateStyle: 'medium' })} <br />
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>เวลา: {v.time || "-"} น.</span>
                    </td>
                    <td>{v.note || "-"}</td>
                    <td>
                      {v.status === 'done' ?
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700 }}>✅ เรียบร้อย</span> :
                        <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700 }}>⏳ รอนิเทศ</span>
                      }
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px', marginRight: 8 }} onClick={() => toggleDone(v.id)}>
                        {v.status === 'done' ? 'ยกเลิกสถานะ' : 'มาร์คว่าเสร็จแล้ว'}
                      </button>
                      <button className="btn-danger" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => removeVisit(v.id)}>ลบ</button>
                    </td>
                  </tr>
                ))}
                {visits.length === 0 && <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>— ยังไม่มีรายการนัดหมาย —</td></tr>}
              </tbody>
            </table>
          </section>
        )}

      </div>

      {/* ============ POPUP MODAL (แสดงไฟล์เต็มจอ) ============ */}
      {showPreviewModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ width: '95%', height: '95%', maxWidth: '1400px', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>📄 {currentDocName}</h3>
                <a href={previewUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#0ea5e9', fontWeight: 600, textDecoration: 'none' }}>ดาวน์โหลด / เปิดในแท็บใหม่ ↗</a>
              </div>
              <button onClick={closePreview} style={{ background: '#f1f5f9', border: 'none', width: 36, height: 36, borderRadius: '50%', fontSize: 20, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
            </div>
            <div style={{ flex: 1, background: '#334155', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
              {previewType === 'image' ? (
                <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Full Preview" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= STYLES ================= */}
      <style>{`
        .card { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .p-6 { padding: 24px; }
        .mb-6 { margin-bottom: 24px; }
        
        .tab-btn { flex: 1; padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer; border: none; background: transparent; color: #64748b; transition: 0.2s; font-size: 14px; font-family: inherit; }
        .tab-btn.active { background: #fff; color: #0ea5e9; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .tab-btn:hover:not(.active) { background: #f1f5f9; }

        .input-label { display: block; font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 6px; }
        .input { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid #cbd5e1; font-family: inherit; font-size: 14px; box-sizing: border-box; outline: none; transition: 0.2s; }
        .input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1); }

        .btn-primary { background: #0ea5e9; color: #fff; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; transition: 0.2s; font-family: inherit; }
        .btn-primary:hover { background: #0284c7; }
        .btn-ghost { background: transparent; color: #475569; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; font-family: inherit; }
        .btn-ghost:hover { background: #f1f5f9; color: #0f172a; }
        .btn-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; font-family: inherit; }
        .btn-danger:hover { background: #fee2e2; }

        .student-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; }
        .student-table th { padding: 10px 16px; color: #64748b; font-size: 13px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
        .student-table td { background: #fff; padding: 16px; font-size: 14px; color: #334155; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .student-row:hover td { background: #f8fafc; }

        .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.7); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px); }
        .modal-card { background: #fff; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
      `}</style>
    </div>
  );
}

// --- Sub Components ---
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
      <div style={{ fontWeight: 800, marginBottom: 16, fontSize: 18, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", padding: '10px 0', borderBottom: '1px dashed #e2e8f0' }}>
      <div style={{ color: "#64748b", fontWeight: 600, fontSize: 14 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: highlight ? '#0ea5e9' : '#1e293b', wordBreak: 'break-word' }}>{value || "-"}</div>
    </div>
  );
}