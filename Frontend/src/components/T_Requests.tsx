import React, { useMemo, useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { loadAcademicYear } from "./store";
import StatusBadge from "./StatusBadge";
import axios from "axios";

// ================= TYPES =================
interface StudentDocument { id: number; name: string; path: string; type?: string; }
interface StudentProfile {
  id: number; studentId: string; prefix?: string; firstName: string; lastName: string;
  major?: string; year?: string; curriculum?: string; phone?: string; email?: string;
  gpa: number; isQualified?: boolean;
  coop?: {
    company: { name: string; address?: string; phone?: string; contactPerson?: string; };
    mentor?: { firstName: string; lastName: string; position?: string; phone?: string; };
    status?: string; teacherComment?: string; jobPosition?: string;
  };
  documents: StudentDocument[];
}

export default function T_Requests() {
  const year = loadAcademicYear();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Modal & Preview State
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [teacherComment, setTeacherComment] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'pdf' | 'image' | null>(null);

  const token = localStorage.getItem("coop.token");

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://localhost:5000/api/students", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStudents(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchStudents(); }, []);

  // ✅ Logic: หาคนที่สถานะรอตรวจ และ ผ่านคุณสมบัติ (Bulk Approve)
  const qualifiedPendingList = useMemo(() => {
    return students.filter(s => {
      const isPending = ["APPLYING", "WAITING_FOR_STAFF_CHECK", "SUBMITTED"].includes(s.coop?.status?.toUpperCase() || "");
      return isPending && s.isQualified === true;
    });
  }, [students]);

  const handleBulkApprove = async () => {
    const count = qualifiedPendingList.length;
    if (count === 0) return;
    if (!confirm(`⚡ ยืนยันการอนุมัติอัตโนมัติ ${count} รายการ?`)) return;

    setLoading(true);
    try {
      await Promise.all(qualifiedPendingList.map(s =>
        axios.put("http://localhost:5000/api/coop/status", {
          studentId: s.id,
          status: "APPROVED",
          comment: "อนุมัติโดยระบบ (ผ่านคุณสมบัติครบถ้วน)"
        }, { headers: { Authorization: `Bearer ${token}` } })
      ));
      alert("ดำเนินการสำเร็จ!");
      fetchStudents();
    } catch (err) { alert("เกิดข้อผิดพลาด"); }
    finally { setLoading(false); }
  };

  const handleViewRequest = (student: StudentProfile) => {
    setSelectedStudent(student);
    setTeacherComment(student.coop?.teacherComment || "");

    const gatewayDocs = student.documents.filter(d => d.type === 'APPLICATION_DOC');
    if (gatewayDocs.length > 0) handlePreview(gatewayDocs[0]);
    else { setPreviewUrl(null); setPreviewType(null); }
  };

  const handlePreview = (doc: StudentDocument) => {
    const url = `http://localhost:5000/uploads/${doc.path}`;
    setPreviewUrl(url);
    setPreviewType(doc.path.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
  };

  const updateStatus = async (status: string) => {
    if (!selectedStudent) return;
    if (status !== "APPROVED" && !teacherComment.trim()) return alert("กรุณาระบุเหตุผล");
    if (!confirm(`ยืนยันการเปลี่ยนสถานะ?`)) return;

    try {
      await axios.put("http://localhost:5000/api/coop/status", {
        studentId: selectedStudent.id,
        status,
        comment: teacherComment
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert("บันทึกเรียบร้อย");
      closeModal();
      fetchStudents();
    } catch (err) { alert("เกิดข้อผิดพลาด"); }
  };

  const closeModal = () => {
    setSelectedStudent(null);
    setPreviewUrl(null);
    setTeacherComment("");
  };

  const filteredList = students.filter(s => {
    const status = s.coop?.status || "NOT_SUBMITTED";
    if (status === "DRAFT" || status === "NOT_SUBMITTED") return false;

    const matchSearch = `${s.studentId} ${s.firstName} ${s.lastName} ${s.coop?.company?.name || ""}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "ALL" || status === filterStatus;
    if (filterStatus === "PENDING") return matchSearch && ["APPLYING", "WAITING_FOR_STAFF_CHECK", "SUBMITTED"].includes(status.toUpperCase());

    return matchSearch && matchStatus;
  });

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

      {/* HEADER */}
      <section style={{ ...card, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>📝 พิจารณาคำร้องขอสหกิจศึกษา</h2>
          <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>ปีการศึกษา <b>{year}</b> | ตรวจสอบคำร้องและเอกสารจาก S_Gateway</div>
        </div>
        <button
          className="btn-success"
          onClick={handleBulkApprove}
          disabled={qualifiedPendingList.length === 0 || loading}
        >
          ⚡ อนุมัติผู้ผ่านเกณฑ์ทั้งหมด ({qualifiedPendingList.length})
        </button>
      </section>

      {/* FILTER & TABLE */}
      <section style={card}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <input className="input" placeholder="🔍 ค้นหารหัสนักศึกษา, ชื่อ, หรือบริษัท..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: 1 }} />
          <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 250 }}>
            <option value="ALL">ทุกสถานะ</option>
            <option value="PENDING">รอดำเนินการ</option>
            <option value="APPROVED">ผ่านเกณฑ์แล้ว</option>
            <option value="EDITS_REQUIRED">ส่งกลับแก้ไข</option>
          </select>
        </div>

        <table style={tableStyle}>
          <thead>
            <tr style={thRow}>
              <th style={th}>รหัสนักศึกษา / ชื่อ-สกุล</th>
              <th style={th}>คุณสมบัติ</th>
              <th style={th}>หน่วยงาน / ตำแหน่ง</th>
              <th style={th}>สถานะ</th>
              <th style={{ ...th, textAlign: 'right' }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map(s => (
              <tr key={s.id} style={trStyle}>
                <td style={td}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{s.studentId}</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>{s.firstName} {s.lastName}</div>
                </td>
                <td style={td}>
                  {s.isQualified ?
                    <span style={{ color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>✅ ครบ</span> :
                    <span style={{ color: '#991b1b', background: '#fee2e2', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>❌ ไม่ผ่าน</span>
                  }
                </td>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{s.coop?.company?.name || "-"}</div>
                  <div style={{ fontSize: 12, color: '#0ea5e9' }}>{s.coop?.jobPosition || "-"}</div>
                </td>
                <td style={td}><StatusBadge status={s.coop?.status} /></td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button className="btn" style={{ padding: '6px 16px' }} onClick={() => handleViewRequest(s)}>พิจารณา</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* MODAL: SPLIT SCREEN */}
      {selectedStudent && (
        <div className="modal-backdrop">
          <div className="modal-card-split">

            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>ตรวจสอบคำร้อง: {selectedStudent.studentId}</h3>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  {selectedStudent.firstName} {selectedStudent.lastName} | <StatusBadge status={selectedStudent.coop?.status} />
                </div>
              </div>
              <button onClick={closeModal} style={{ border: 'none', background: '#fee2e2', color: '#dc2626', width: 32, height: 32, borderRadius: '50%', fontSize: 18, cursor: 'pointer' }}>&times;</button>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* LEFT: PREVIEW (60%) */}
              <div style={{ flex: '0 0 60%', background: '#334155' }}>
                {previewUrl ? (
                  previewType === 'pdf' ? <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="p" />
                    : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><img src={previewUrl} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="p" /></div>
                ) : <div style={{ color: 'white', textAlign: 'center', marginTop: '20%' }}>ไม่มีเอกสาร Gateway ให้แสดง</div>}
              </div>

              {/* RIGHT: CONTROL PANEL (40%) */}
              <div style={{ flex: 1, padding: 20, overflowY: 'auto', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>

                {/* 1. Gateway Documents */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>📄 เอกสารประกอบ (Gateway Only)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedStudent.documents.filter(d => d.type === 'APPLICATION_DOC').map(doc => (
                      <div key={doc.id} onClick={() => handlePreview(doc)}
                        style={{
                          padding: '10px 14px', background: previewUrl?.includes(doc.path) ? '#e0f2fe' : '#fff',
                          border: '1px solid', borderColor: previewUrl?.includes(doc.path) ? '#7dd3fc' : '#e2e8f0',
                          borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#0ea5e9', fontWeight: 600
                        }}>
                        📄 {doc.name}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Student Info */}
                <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, borderBottom: '1px solid #f1f5f9', paddingBottom: 8, marginBottom: 12 }}>👤 ข้อมูลผู้สมัคร</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '6px 8px', fontSize: 13 }}>
                    <span style={{ fontWeight: 700, color: '#64748b' }}>ชื่อ-สกุล:</span> <span>{selectedStudent.prefix}{selectedStudent.firstName} {selectedStudent.lastName}</span>
                    <span style={{ fontWeight: 700, color: '#64748b' }}>GPA:</span> <span style={{ fontWeight: 700 }}>{selectedStudent.gpa.toFixed(2)}</span>
                    <span style={{ fontWeight: 700, color: '#64748b' }}>คุณสมบัติ:</span> <span>{selectedStudent.isQualified ? "✅ ผ่าน" : "❌ ไม่ผ่าน"}</span>
                  </div>
                </div>

                {/* 3. Actions */}
                <div style={{ marginTop: 'auto' }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, display: 'block' }}>ข้อความแจ้งนักศึกษา:</label>
                  <textarea className="input" rows={2} style={{ width: '100%', marginBottom: 12, fontSize: 13 }}
                    placeholder="ระบุสิ่งที่ต้องแก้ไข..." value={teacherComment} onChange={e => setTeacherComment(e.target.value)} />

                  <button className="btn" style={{ width: '100%', background: '#10b981', padding: 12, marginBottom: 8 }} onClick={() => updateStatus("APPROVED")}>✅ อนุมัติผ่านเกณฑ์</button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" style={{ flex: 1, background: '#f59e0b' }} onClick={() => updateStatus("EDITS_REQUIRED")}>⚠️ ส่งกลับแก้ไข</button>
                    <button className="btn" style={{ flex: 1, background: '#ef4444' }} onClick={() => updateStatus("REJECTED")}>❌ ไม่ผ่าน</button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      <style>{STYLES}</style>
    </div>
  );
}

const STYLES = `
    .btn { border-radius: 8px; border: none; font-weight: 700; color: white; background: #0ea5e9; cursor: pointer; transition: 0.2s; padding: 10px; }
    .btn:hover { opacity: 0.8; }
    .btn-success { background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; }
    .btn-ghost { padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; background: #fff; cursor: pointer; }
    .input { padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-size: 14px; box-sizing: border-box; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, .6); display: flex; align-items: center; justify-content: center; z-index: 999; backdrop-filter: blur(3px); }
    .modal-card-split { background: #fff; border-radius: 16px; width: 95vw; max-width: 1400px; height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
`;

const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: '1px solid #f1f5f9' };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thRow: CSSProperties = { background: "#f8fafc", borderBottom: "2px solid #e2e8f0" };
const th: CSSProperties = { padding: "14px 16px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "#64748b" };
const trStyle: CSSProperties = { borderBottom: "1px solid #f1f5f9" };
const td: CSSProperties = { padding: "14px 16px", verticalAlign: "middle", fontSize: 14 };