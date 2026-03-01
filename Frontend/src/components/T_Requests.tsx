import React, { useMemo, useState, useEffect } from "react";
import { loadAcademicYear } from "./store";

const IOS_BLUE = "#0074B7";

// --- Interfaces ---
interface StudentDocument {
  id: number;
  name: string;
  path: string;
}

interface StudentProfile {
  id: number;
  studentId: string;
  firstName?: string;
  lastName?: string;
  company?: any;
  gpa?: number;

  // ✅ เพิ่ม isQualified เพื่อใช้เช็คเงื่อนไข
  isQualified?: boolean;

  coopRequest?: { status: string; };
  coop?: {
    company: any;
    mentor?: any;
    status?: string;
    teacherComment?: string;
  };
  documents?: StudentDocument[];
}

/* =========================
   UI helpers
========================= */
function statusChip(status?: string) {
  const v = (status || "draft").toLowerCase();
  let cls = "waiting";
  let label = "ฉบับร่าง";

  // Map status ให้ตรงกับ Backend Enum
  if (v === 'submitted' || v === 'pending' || v === 'applying') { cls = 'under'; label = 'รอพิจารณา'; }
  else if (v === 'qualified') { cls = 'appr'; label = 'ผ่านคุณสมบัติ'; } // เพิ่ม
  else if (v === 'approved') { cls = 'appr'; label = 'อนุมัติแล้ว'; }
  else if (v === 'rejected' || v === 'qualification_failed') { cls = 'rej'; label = 'ไม่ผ่าน'; }
  else if (v === 'edits_required') { cls = 'edit'; label = 'รอแก้ไข'; }

  return <span className={`chip ${cls}`}>{label}</span>;
}

export default function T_Requests() {
  const year = loadAcademicYear();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  // Modal State
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewType, setPreviewType] = useState<"pdf" | "image" | "other">("pdf");
  const [teacherComment, setTeacherComment] = useState("");

  const fetchStudents = async () => {
    const token = localStorage.getItem("coop.token");
    try {
      setLoading(true);
      const res = await fetch("http://localhost:5000/api/students", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchStudents(); }, []);

  const list = useMemo(() => {
    const txt = q.toLowerCase();
    return students
      .filter((s) => {
        const st = s.coop?.status || "DRAFT";
        return st !== "DRAFT" && st !== "NOT_SUBMITTED";
      })
      .filter((s) => {
        const t = `${s.studentId} ${s.firstName} ${s.lastName} ${s.company?.name || s.coop?.company?.name}`.toLowerCase();
        if (!t.includes(txt)) return false;

        let st = (s.coop?.status || "draft").toLowerCase();
        if (st === 'pending' || st === 'applying') st = 'submitted';

        if (statusFilter.length > 0 && !statusFilter.includes(st)) return false;
        return true;
      });
  }, [students, q, statusFilter]);

  // ✅ หาจำนวนคนที่ "รอพิจารณา" และ "ผ่านเกณฑ์ (isQualified)" แล้ว
  const qualifiedPendingList = useMemo(() => {
    return students.filter(s => {
      const status = (s.coop?.status || "").toLowerCase();
      // เช็คว่าเป็นสถานะรอตรวจ และ ผ่านเกณฑ์ isQualified
      return (status === 'applying' || status === 'pending') && s.isQualified === true;
    });
  }, [students]);

  // ✅ ฟังก์ชันอนุมัติทีเดียว (Bulk Approve)
  const handleBulkApprove = async () => {
    const count = qualifiedPendingList.length;
    if (count === 0) return;

    if (!confirm(`ยืนยันการอนุมัติอัตโนมัติ?\n\nระบบจะอนุมัติเฉพาะนักศึกษาที่ "ผ่านคุณสมบัติ (Qualified)" แล้วจำนวน ${count} คน\n\n(ผู้ที่ไม่ผ่านคุณสมบัติ จะไม่ถูกอนุมัติ)`)) return;

    setLoading(true);
    const token = localStorage.getItem("coop.token");

    try {
      // ใช้ Promise.all เพื่อยิง Request พร้อมกัน (หรือจะสร้าง API bulk-approve ใหม่ที่ backend ก็ได้)
      const results = await Promise.all(qualifiedPendingList.map(s =>
        fetch("http://localhost:5000/api/coop/status", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            studentId: s.id, // ใช้ id (int) หรือ studentId (string) ตาม API ของคุณ
            status: "APPROVED", // หรือ QUALIFIED ตาม Flow ใหม่
            comment: "อนุมัติโดยระบบ (ผ่านคุณสมบัติครบถ้วน)"
          })
        })
      ));

      alert(`ดำเนินการเสร็จสิ้น! อนุมัติสำเร็จ ${results.filter(r => r.ok).length} คน`);
      fetchStudents();
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
      setLoading(false);
    }
  };

  // ... (handleSelectFile, handleViewRequest, handleCloseModal, handleUpdateStatus เหมือนเดิม) ...
  const handleSelectFile = (doc: StudentDocument) => {
    const url = `http://localhost:5000/uploads/${doc.path}`;
    setPreviewUrl(url);
    const ext = doc.name.split('.').pop()?.toLowerCase() || "";
    setPreviewType(['jpg', 'jpeg', 'png'].includes(ext) ? "image" : "pdf");
  };

  const handleViewRequest = (student: StudentProfile) => {
    setSelectedStudent(student);
    setTeacherComment(student.coop?.teacherComment || "");
    if (student.documents?.[0]) handleSelectFile(student.documents[0]);
    else setPreviewUrl("");
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedStudent(null);
    setPreviewUrl("");
    setTeacherComment("");
  };

  const handleUpdateStatus = async (status: "APPROVED" | "REJECTED" | "EDITS_REQUIRED") => {
    if (!selectedStudent) return;
    if (status !== "APPROVED" && !teacherComment.trim()) {
      alert("กรุณาระบุเหตุผลในช่องความเห็นอาจารย์");
      return;
    }
    const mapMsg = { APPROVED: "อนุมัติ", REJECTED: "ไม่ผ่าน", EDITS_REQUIRED: "ส่งกลับแก้ไข" };
    if (!confirm(`ยืนยันสถานะ "${mapMsg[status]}" ใช่หรือไม่?`)) return;

    try {
      const token = localStorage.getItem("coop.token");
      const res = await fetch("http://localhost:5000/api/coop/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          status: status,
          comment: teacherComment
        }),
      });
      const data = await res.json();
      if (data.ok) {
        alert("บันทึกสถานะเรียบร้อยแล้ว");
        handleCloseModal();
        fetchStudents();
      } else { alert("Error: " + data.message); }
    } catch (err) { alert("Connect Error"); }
  };

  if (loading) return <div style={{ padding: 20 }}>กำลังโหลด...</div>;

  return (
    <div style={{ display: "grid", gap: 16, marginLeft: 35, marginTop: 28 }}>
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 1000, fontSize: 20 }}>รายการคำร้องรอพิจารณา</div>
            <div style={{ color: "#6b7280", marginTop: 4 }}>ปีการศึกษา <b>{year}</b></div>
          </div>

          {/* ✅ ปุ่ม Bulk Approve */}
          <div style={{ textAlign: 'right' }}>
            <button
              className="btn"
              style={{
                background: qualifiedPendingList.length > 0 ? '#10b981' : '#e5e7eb',
                color: qualifiedPendingList.length > 0 ? 'white' : '#9ca3af',
                cursor: qualifiedPendingList.length > 0 ? 'pointer' : 'not-allowed',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
              }}
              disabled={qualifiedPendingList.length === 0}
              onClick={handleBulkApprove}
            >
              ⚡ อนุมัติผู้ผ่านคุณสมบัติทั้งหมด ({qualifiedPendingList.length})
            </button>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 5 }}>
              * เฉพาะผู้ที่สถานะ "รอพิจารณา" และ "Qualified=True"
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <input className="input" placeholder="ค้นหา..." value={q} onChange={e => setQ(e.target.value)} style={{ flex: "1 1 280px" }} />
          <div style={{ display: "flex", gap: 14 }}>
            {[
              ["submitted", "รอพิจารณา"],
              ["edits_required", "รอแก้ไข"],
              ["approved", "ผ่าน"],
              ["rejected", "ไม่ผ่าน"]
            ].map(([k, label]) => (
              <label key={k} style={{ fontSize: 14, display: "flex", gap: 6 }}>
                <input type="checkbox" checked={statusFilter.includes(k)}
                  onChange={e => setStatusFilter(p => e.target.checked ? [...p, k] : p.filter(x => x !== k))} />
                {label}
              </label>
            ))}
            <button className="btn ghost" onClick={() => { setQ(""); setStatusFilter([]); }}>ล้าง</button>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", padding: 14 }}>
            <thead><tr>{["รหัส", "ชื่อ-นามสกุล", "คุณสมบัติ", "สถานะ", "การทำงาน"].map(h => <th key={h} style={{ textAlign: "left", padding: 8 }}>{h}</th>)}</tr></thead>
            <tbody>
              {list.map(s => (
                <tr key={s.studentId} style={{ background: "#fff" }}>
                  <td style={td()}>{s.studentId}</td>
                  <td style={td()}>{s.firstName} {s.lastName}</td>
                  {/* ✅ แสดงสถานะ Qualified */}
                  <td style={td()}>
                    {s.isQualified ?
                      <span style={{ color: '#166534', fontWeight: 'bold', fontSize: 12, background: '#dcfce7', padding: '2px 8px', borderRadius: 4 }}>✅ ครบถ้วน</span> :
                      <span style={{ color: '#991b1b', fontWeight: 'bold', fontSize: 12, background: '#fee2e2', padding: '2px 8px', borderRadius: 4 }}>❌ ไม่ผ่าน</span>
                    }
                  </td>
                  <td style={td()}>{statusChip(s.coop?.status)}</td>
                  <td style={td()}><button className="btn" style={{ background: IOS_BLUE }} onClick={() => handleViewRequest(s)}>พิจารณา</button></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#999' }}>ไม่พบข้อมูล</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL (คงเดิม) */}
      {showModal && selectedStudent && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ width: "1000px", height: "90vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>พิจารณาคำร้อง: {selectedStudent.studentId} {selectedStudent.firstName}</h2>
              <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', gap: 20, flex: 1, overflow: 'hidden' }}>
              <div style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 12, overflow: 'hidden', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {previewUrl ? (
                  previewType === 'image' ? <img src={previewUrl} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                    : <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} />
                ) : <div style={{ color: '#94a3b8' }}>เลือกไฟล์เพื่อดูตัวอย่าง</div>}
              </div>

              <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>

                {/* ✅ แสดงคุณสมบัติใน Modal ด้วย */}
                <div className="box-section" style={{
                  display: 'flex', flexDirection: 'column', padding: '16px', gap: 8,
                  background: selectedStudent.isQualified ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${selectedStudent.isQualified ? '#bbf7d0' : '#fecaca'}`
                }}>
                  <div style={{ fontWeight: 700, color: selectedStudent.isQualified ? '#166534' : '#991b1b' }}>
                    {selectedStudent.isQualified ? "✅ คุณสมบัติผ่านเกณฑ์" : "❌ คุณสมบัติไม่ผ่าน"}
                  </div>
                  <div style={{ fontSize: 13 }}>GPA: <b>{selectedStudent.gpa?.toFixed(2)}</b></div>
                </div>

                <div className="box-section" style={{ padding: 16 }}>
                  <h4 style={{ margin: '0 0 10px 0' }}>📄 เอกสารแนบ</h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                    {selectedStudent.documents?.map((doc, idx) => (
                      <li key={idx} onClick={() => handleSelectFile(doc)}
                        style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', background: previewUrl.includes(doc.path) ? '#e0f2fe' : 'white' }}>
                        📎 {doc.name}
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginTop: 'auto' }}>
                  <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>ผลการพิจารณา</div>
                  <textarea className="input" placeholder="ความเห็นอาจารย์..." rows={3} style={{ marginBottom: 10, width: '100%' }}
                    value={teacherComment} onChange={e => setTeacherComment(e.target.value)} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button className="btn" style={{ background: '#ef4444', color: 'white', gridColumn: '1 / -1' }} onClick={() => handleUpdateStatus("REJECTED")}>
                      ไม่ผ่าน
                    </button>
                    <button className="btn" style={{ background: '#f59e0b', color: 'white' }} onClick={() => handleUpdateStatus("EDITS_REQUIRED")}>
                      ส่งกลับแก้ไข
                    </button>
                    <button className="btn" style={{ background: '#22c55e', color: 'white' }} onClick={() => handleUpdateStatus("APPROVED")}>
                      อนุมัติ
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <style>{`
            .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 50; }
            .modal-card { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,.2); }
            .box-section { background: white; border-radius: 8px; border: 1px solid #e2e8f0; }
            .input { padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: inherit; box-sizing: border-box; }
            .chip { padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; }
            .chip.under { background: #fef3c7; color: #b45309; }
            .chip.appr { background: #dcfce7; color: #15803d; }
            .chip.rej { background: #fee2e2; color: #b91c1c; }
            .chip.edit { background: #ffedd5; color: #c2410c; }
            .chip.waiting { background: #f1f5f9; color: #64748b; }
          `}</style>
        </div>
      )}
    </div>
  );
}
function td(): React.CSSProperties { return { padding: "12px 10px", borderTop: "1px solid #eee", borderBottom: "1px solid #eee" }; }