import React, { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import axios from "axios";

type Document = { id: number; type: string; path: string; name: string; status: string; };
type Student = { id: number; studentId: string; firstName: string; lastName: string; docStatus: string; coop: { company: { name: string; } }; documents: Document[]; };

export default function T_T003Review() {
    const [students, setStudents] = useState<Student[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);

    const fetchStudents = async () => {
        try {
            const token = localStorage.getItem("coop.token");
            // ⚠️ เปลี่ยน API เป็นของฝั่งอาจารย์
            const res = await axios.get("http://localhost:5000/api/admin/students", {
                headers: { Authorization: `Bearer ${token}` }
            });

            let allStudents = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.students || []);

            const t003Students = allStudents.filter((student: any) => {
                const hasPendingDoc = student.documents?.some((doc: any) => doc.type === 'T003_FORM' && doc.status === 'WAITING');
                const isStatusMatch = student.coop?.status === 'T003_SUBMITTED' || student.docStatus === 'T003_SUBMITTED';
                return hasPendingDoc || isStatusMatch;
            });

            setStudents(t003Students);
        } catch (err) { console.error(err); }
    };

    useEffect(() => { fetchStudents(); }, []);

    const openReviewModal = (student: Student) => { setSelectedStudent(student); setComment(""); setModalOpen(true); };

    const getT003FileUrl = (docs: Document[]) => {
        const file = docs.find(d => d.type === "T003_FORM");
        return file ? `http://localhost:5000/uploads/${file.path}` : null;
    };

    const submitReview = async (action: 'APPROVE' | 'REJECT') => {
        if (action === 'REJECT' && !comment.trim()) return alert("กรุณาระบุข้อเสนอแนะในการแก้โครงร่าง");
        if (!confirm(`ยืนยันการ ${action === 'APPROVE' ? 'อนุมัติ' : 'ตีกลับ'} โครงร่างรายงาน T003?`)) return;

        setLoading(true);
        try {
            const token = localStorage.getItem("coop.token");
            const newStatus = action === 'APPROVE' ? 'T003_APPROVED' : 'T003_EDITS_REQUIRED';

            // ⚠️ เปลี่ยน Endpoint เป็น API ของอาจารย์
            await axios.put(`http://localhost:5000/api/teacher/documents/review-t003`, {
                studentId: selectedStudent?.id,
                status: newStatus,
                comment: action === 'REJECT' ? comment : null
            }, { headers: { Authorization: `Bearer ${token}` } });

            alert(`บันทึกผลเรียบร้อย`);
            setModalOpen(false);
            fetchStudents();
        } catch (err) { alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล"); }
        finally { setLoading(false); }
    };

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
            <section style={{ ...card, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e3a8a' }}>📘 ตรวจสอบ T003 (สำหรับอาจารย์นิเทศ)</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>รายชื่อนักศึกษาที่รอพิจารณาโครงร่างรายงาน (Proposal)</div>
                </div>
                <div style={{ background: '#dbeafe', color: '#1d4ed8', padding: '8px 16px', borderRadius: 8, fontWeight: 700 }}>รอตรวจ: {students.length} รายการ</div>
            </section>

            <section style={card}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13 }}>รหัสนักศึกษา</th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13 }}>ชื่อ-นามสกุล</th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13 }}>สถานที่ฝึกงาน</th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13, textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>🎉 ไม่มีเอกสาร T003 รอตรวจ</td></tr>
                        ) : students.map(s => (
                            <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '14px 16px', fontWeight: 600, color: '#2563eb' }}>{s.studentId}</td>
                                <td style={{ padding: '14px 16px', fontWeight: 600 }}>{s.firstName} {s.lastName}</td>
                                <td style={{ padding: '14px 16px', color: '#475569' }}>{s.coop?.company?.name || "-"}</td>
                                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                    <button className="btn" style={{ padding: '8px 16px', fontSize: 13, background: '#2563eb' }} onClick={() => openReviewModal(s)}>🔍 พิจารณา</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            {modalOpen && selectedStudent && (
                <div style={modalOverlay}>
                    <div style={modalContentLarge}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 15, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, fontSize: 20 }}>🔍 พิจารณา T003: {selectedStudent.firstName}</h3>
                            <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>&times;</button>
                        </div>
                        <div style={{ display: 'flex', gap: 24, height: '70vh' }}>
                            <div style={{ flex: 1, background: '#525659', borderRadius: 8, overflow: 'hidden' }}>
                                {getT003FileUrl(selectedStudent.documents) ? (
                                    <iframe src={getT003FileUrl(selectedStudent.documents) as string} width="100%" height="100%" style={{ border: 'none' }} title="PDF Preview" />
                                ) : <div style={{ color: 'white', padding: 20 }}>⚠️ ไม่พบไฟล์ T003</div>}
                            </div>
                            <div style={{ width: 350, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label style={label}>ข้อเสนอแนะในการปรับแก้โครงร่าง</label>
                                    <textarea className="input" rows={6} value={comment} onChange={(e) => setComment(e.target.value)} />
                                </div>
                                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <button className="btn-ghost" style={{ background: '#fef2f2', color: '#dc2626', padding: 14 }} onClick={() => submitReview('REJECT')} disabled={loading}>❌ ตีกลับให้แก้ไข</button>
                                    <button className="btn" style={{ background: '#2563eb', padding: 14 }} onClick={() => submitReview('APPROVE')} disabled={loading}>✅ อนุมัติโครงร่างรายงาน</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <style>{` .btn { border-radius: 8px; border: none; font-weight: 700; color: white; cursor: pointer; } .btn-ghost { border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; cursor: pointer; } .input { padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box; } `}</style>
        </div>
    );
}

const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: '1px solid #f1f5f9' };
const label: CSSProperties = { fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 };
const modalOverlay: CSSProperties = { position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999 };
const modalContentLarge: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, width: "95%", maxWidth: 1200 };