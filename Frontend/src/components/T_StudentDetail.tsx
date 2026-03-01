import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

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
  coop?: {
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
  const [showPreviewModal, setShowPreviewModal] = useState(false); // ✅ ควบคุมการเปิด Popup
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

  // ✅ ฟังก์ชันเปิด Popup ดูไฟล์
  const handleViewFile = (doc: StudentDocument) => {
    const url = `http://localhost:5000/uploads/${doc.path}`;
    setPreviewUrl(url);
    setCurrentDocName(doc.name);

    const ext = doc.name.split('.').pop()?.toLowerCase() || "";
    setPreviewType(['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? "image" : "pdf");

    setShowPreviewModal(true); // เปิด Popup
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
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>กำลังโหลดข้อมูล...</div>;
  if (!student) return <div style={{ padding: 40, textAlign: 'center' }}>ไม่พบข้อมูลนักศึกษา</div>;

  const fullName = `${student.firstName || ""} ${student.lastName || ""}`.trim();

  return (
    <div style={{ display: "grid", gap: 16, marginLeft: 35, marginTop: 28 }}>

      {/* Header */}
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 1000, fontSize: 20 }}>{fullName}</div>
            <div style={{ color: "#6b7280" }}>
              รหัส: <b>{student.studentId}</b> • สาขา: <b>{student.major || "-"}</b> • บริษัท: <b>{companyData?.name || "-"}</b>
            </div>
          </div>
          <Link
            className="btn"
            to="/teacher/students"
            style={{
              background: '#0074B7',
              color: 'white',
              height: 40,
              // ✅ ส่วนที่เพิ่มเพื่อความสวยงาม
              textDecoration: 'none',    // เอาขีดเส้นใต้ออก
              display: 'inline-flex',    // ใช้ flex เพื่อจัดตำแหน่งลูกภายใน
              alignItems: 'center',      // กึ่งกลางแนวตั้ง
              justifyContent: 'center',  // กึ่งกลางแนวนอน
              padding: '0 20px',         // เพิ่มระยะห่างซ้ายขวาให้ปุ่มดูสมดุล
              borderRadius: '8px'        // เพิ่มความมน (ถ้าต้องการ)
            }}
          >
            ← กลับ
          </Link>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <Tab label="ข้อมูลส่วนตัว" active={tab === "profile"} onClick={() => setTab("profile")} />
          <Tab label="บริษัทและพี่เลี้ยง" active={tab === "company"} onClick={() => setTab("company")} />
          <Tab label="เอกสาร" active={tab === "docs"} onClick={() => setTab("docs")} />
          <Tab label="นัดนิเทศ" active={tab === "visits"} onClick={() => setTab("visits")} />
        </div>
      </section>

      {/* Tab 1: Profile */}
      {tab === "profile" && (
        <section className="card">
          <h3 style={{ marginTop: 0, marginBottom: 20, borderBottom: '1px solid #eee', paddingBottom: 10 }}>ข้อมูลนักศึกษา</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px 40px' }}>
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
        </section>
      )}

      {/* Tab 2: Company */}
      {tab === "company" && (
        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card">
            <h3 style={{ marginTop: 0, marginBottom: 15, color: '#0074B7' }}>🏢 ข้อมูลสถานประกอบการ</h3>
            {companyData ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <InfoRow label="ชื่อบริษัท" value={companyData.name} />
                <InfoRow label="ที่อยู่" value={companyData.address || "-"} />
                <InfoRow label="อีเมล" value={companyData.email || "-"} />
                <InfoRow label="เบอร์โทร" value={companyData.phone || "-"} />
                <InfoRow label="เว็บไซต์" value={companyData.website ? <a href={companyData.website} target="_blank" rel="noreferrer">{companyData.website}</a> : "-"} />
              </div>
            ) : (<div style={{ color: '#64748b' }}>ยังไม่มีข้อมูลสถานประกอบการ</div>)}
          </section>

          <section className="card">
            <h3 style={{ marginTop: 0, marginBottom: 15, color: '#0074B7' }}>🧑‍💼 ข้อมูลพี่เลี้ยง</h3>
            {mentorData ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <InfoRow label="ชื่อ-นามสกุล" value={`${mentorData.firstName || ""} ${mentorData.lastName || ""}`} />
                <InfoRow label="ตำแหน่ง" value={mentorData.position || "-"} />
                <InfoRow label="แผนก" value={mentorData.department || "-"} />
                <InfoRow label="อีเมล" value={mentorData.email || "-"} />
                <InfoRow label="เบอร์โทร" value={mentorData.phone || "-"} />
              </div>
            ) : (<div style={{ color: '#64748b' }}>ยังไม่มีข้อมูลพี่เลี้ยง</div>)}
          </section>
        </div>
      )}

      {/* ============ Tab 3: Documents (แก้ไขเป็นแบบ Popup) ============ */}
      {tab === "docs" && (
        <section className="card">
          <h3 style={{ marginTop: 0 }}>📄 รายการเอกสาร</h3>
          {student.documents && student.documents.length > 0 ? (
            <ul style={{ padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
              {student.documents.map((doc) => (
                <li
                  key={doc.id}
                  style={{
                    padding: '16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 24 }}>📄</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16, color: '#1e293b' }}>{doc.name}</div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>คลิกปุ่มด้านขวาเพื่อเปิดดูเอกสาร</div>
                    </div>
                  </div>

                  {/* ปุ่มเปิด Popup */}
                  <button
                    className="btn"
                    style={{ background: '#0074B7', color: 'white', padding: '8px 16px' }}
                    onClick={() => handleViewFile(doc)}
                  >
                    เปิดดูไฟล์ ↗
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: '#64748b', fontStyle: 'italic' }}>ไม่มีเอกสารแนบ</div>
          )}
        </section>
      )}

      {/* Tab 4: Visits */}
      {tab === "visits" && (
        <section className="card">
          <div style={{ fontWeight: 1000, marginBottom: 15, fontSize: 18 }}>จัดการนัดนิเทศ</div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'end', flexWrap: 'wrap', background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 'bold', color: '#475569' }}>วันที่</label><br />
              <input type="date" className="input" value={visitForm.date} onChange={e => setVisitForm({ ...visitForm, date: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 'bold', color: '#475569' }}>เวลา</label><br />
              <input type="time" className="input" value={visitForm.time} onChange={e => setVisitForm({ ...visitForm, time: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 'bold', color: '#475569' }}>บันทึก</label><br />
              <input type="text" className="input" style={{ width: '100%' }} placeholder="รายละเอียด..." value={visitForm.note} onChange={e => setVisitForm({ ...visitForm, note: e.target.value })} />
            </div>
            <button className="btn" style={{ background: '#0074B7', color: 'white', height: 42 }} onClick={addVisit}>+ เพิ่มนัด</button>
          </div>
          {/* Table ... (เหมือนเดิม) */}
          <table style={{ width: "100%", borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#f1f5f9', color: '#475569', fontSize: 14 }}>
                <th style={{ padding: 12 }}>วันเวลา</th>
                <th style={{ padding: 12 }}>บันทึก</th>
                <th style={{ padding: 12 }}>สถานะ</th>
                <th style={{ padding: 12 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 12 }}>{v.date} {v.time}</td>
                  <td style={{ padding: 12 }}>{v.note || "-"}</td>
                  <td style={{ padding: 12 }}><span className={`chip ${v.status === 'done' ? 'appr' : 'under'}`}>{v.status === 'done' ? 'เรียบร้อย' : 'รอนิเทศ'}</span></td>
                  <td style={{ padding: 12 }}>
                    <button className="btn ghost" style={{ fontSize: 12, marginRight: 5 }} onClick={() => toggleDone(v.id)}>เปลี่ยนสถานะ</button>
                    <button className="btn-delete" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => removeVisit(v.id)}>ลบ</button>
                  </td>
                </tr>
              ))}
              {visits.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>— ไม่มีนัดหมาย —</td></tr>}
            </tbody>
          </table>
        </section>
      )}

      {/* ============ POPUP MODAL (แสดงไฟล์เต็มจอ) ============ */}
      {showPreviewModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ width: '90%', height: '90%', maxWidth: '1200px', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* Header Modal */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>{currentDocName}</h3>
                <a href={previewUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#0074B7' }}>ดาวน์โหลด / เปิดในหน้าต่างใหม่</a>
              </div>
              <button onClick={closePreview} style={{ background: 'none', border: 'none', fontSize: 28, cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>

            {/* Body Modal (Preview) */}
            <div style={{ flex: 1, background: '#f1f5f9', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
              {previewType === 'image' ? (
                <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Full Preview" />
              )}
            </div>

          </div>

          <style>{`
             .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(2px); }
             .modal-card { background: #fff; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
           `}</style>
        </div>
      )}

    </div>
  );
}

// --- Sub Components ---
function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="btn" style={{
      background: active ? "#0074B7" : "#fff", color: active ? "#fff" : "#0f172a", border: active ? "none" : "1px solid #e2e8f0", fontWeight: active ? 700 : 500
    }}>
      {label}
    </button>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 500, color: highlight ? '#0074B7' : '#1e293b' }}>{value}</span>
    </div>
  );
}