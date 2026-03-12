import React, { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import axios from "axios";

// --- Types ---
type Document = {
    id: number;
    type: string;
    path: string;
    name: string;
};

type Student = {
    id: number;
    studentId: string;
    firstName: string;
    lastName: string;
    docStatus: string;
    coop: {
        company: {
            name: string;
        }
    };
    documents: Document[];
};

export default function A_T002Review() {
    const [students, setStudents] = useState<Student[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [comment, setComment] = useState(""); // สำหรับพิมพ์ข้อความตีกลับหรือแนะนำเพิ่มเติม
    const [loading, setLoading] = useState(false);

    // 1. ดึงรายชื่อนักศึกษาและกรองเอาเฉพาะคนที่ส่ง T002_FORM
    const fetchStudents = async () => {
        try {
            const token = localStorage.getItem("coop.token");

            // ⚠️ เปลี่ยน URL ตรงนี้ให้ตรงกับ API ที่คุณใช้ดึงรายชื่อนักศึกษาในหน้า Admin ปกติ 
            // (เช่นหน้าตรวจ T000 หรือหน้าอนุมัติใบสมัคร)
            const res = await axios.get("http://localhost:5000/api/admin/students", {
                headers: { Authorization: `Bearer ${token}` }
            });

            // จัดการข้อมูล กรณี Backend คืนค่ามาเป็น Array ตรงๆ หรืออยู่ใน Key เช่น { data: [...] }
            let allStudents = [];
            if (Array.isArray(res.data)) {
                allStudents = res.data;
            } else if (res.data?.data) {
                allStudents = res.data.data;
            } else if (res.data?.students) {
                allStudents = res.data.students;
            }

            // ✅ กรอง (Filter) เฉพาะนักศึกษาที่ต้องตรวจ T002
            const t002Students = allStudents.filter((student: any) => {
                // เงื่อนไขที่ 1: เช็คจากตาราง Document ว่ามี T002_FORM สถานะ WAITING ไหม (ตามที่คุณแนบรูป DB มา)
                const hasPendingDoc = student.documents?.some((doc: any) =>
                    doc.type === 'T002_FORM' && doc.status === 'WAITING'
                );

                // เงื่อนไขที่ 2: เช็คจากสถานะนักศึกษา
                const isStatusMatch = student.coop?.status === 'T002_SUBMITTED' || student.docStatus === 'T002_SUBMITTED';

                return hasPendingDoc || isStatusMatch;
            });

            setStudents(t002Students);
        } catch (err) {
            console.error("Fetch students error:", err);
        }
    };

    useEffect(() => { fetchStudents(); }, []);

    // 2. เปิด Modal ตรวจเอกสาร
    const openReviewModal = (student: Student) => {
        setSelectedStudent(student);
        setComment("");
        setModalOpen(true);
    };

    // 3. ฟังก์ชันดึง URL ของไฟล์ T002
    const getT002FileUrl = (docs: Document[]) => {
        const file = docs.find(d => d.type === "T002_FORM");
        return file ? `http://localhost:5000/uploads/${file.path}` : null;
    };

    // 4. บันทึกผลการตรวจ (ผ่าน / ตีกลับ)
    const submitReview = async (action: 'APPROVE' | 'REJECT') => {
        if (action === 'REJECT' && !comment.trim()) {
            return alert("กรุณาระบุเหตุผลที่ตีกลับ เพื่อให้นักศึกษาแก้ไข");
        }
        if (!confirm(`ยืนยันการ ${action === 'APPROVE' ? 'อนุมัติ' : 'ตีกลับ'} เอกสาร T002?`)) return;

        setLoading(true);
        try {
            const token = localStorage.getItem("coop.token");

            // ✅ ถ้าผ่าน = INTERNSHIP_STARTED, ถ้าตีกลับ = T002_EDITS_REQUIRED
            const newStatus = action === 'APPROVE' ? 'INTERNSHIP_STARTED' : 'T002_EDITS_REQUIRED';

            // ⚠️ เรียกใช้ API ของ Backend
            await axios.put(`http://localhost:5000/api/admin/documents/review-t002`, {
                studentId: selectedStudent?.id,
                status: newStatus,
                comment: action === 'REJECT' ? comment : null // ส่งคอมเมนต์ไปเฉพาะตอนตีกลับ
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert(`บันทึกผลเรียบร้อย (${action === 'APPROVE' ? 'อนุมัติ' : 'ตีกลับ'})`);
            setModalOpen(false);
            fetchStudents(); // รีโหลดข้อมูลใหม่
        } catch (err) {
            console.error(err);
            alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

            {/* HEADER */}
            <section style={{ ...card, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>📝 ตรวจสอบแบบฟอร์ม T002</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>รายชื่อนักศึกษาที่รอการตรวจสอบแบบแจ้งรายละเอียดงานและที่พัก (ระหว่างฝึกงาน)</div>
                </div>
                <div style={{ background: '#ecfdf5', color: '#047857', padding: '8px 16px', borderRadius: 8, fontWeight: 700 }}>
                    รอตรวจทั้งหมด: {students.length} รายการ
                </div>
            </section>

            {/* TABLE */}
            <section style={card}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13 }}>รหัสนักศึกษา</th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13 }}>ชื่อ-นามสกุล</th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13 }}>สถานที่ฝึกงาน</th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13 }}>สถานะ</th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13, textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>🎉 ไม่มีเอกสาร T002 รอตรวจ</td></tr>
                        ) : students.map(s => (
                            <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#0369a1' }}>
                                    {s.studentId}
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: 14, color: '#1e293b', fontWeight: 600 }}>
                                    {s.firstName} {s.lastName}
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: 14, color: '#475569' }}>
                                    {s.coop?.company?.name || "-"}
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: 13 }}>
                                    <span style={{ background: '#ccfbf1', color: '#0d9488', padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>
                                        📄 ส่ง T002 แล้ว
                                    </span>
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                    <button className="btn" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => openReviewModal(s)}>
                                        🔍 ตรวจเอกสาร
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            {/* MODAL ตรวจเอกสาร */}
            {modalOpen && selectedStudent && (
                <div style={modalOverlay}>
                    <div style={modalContentLarge}>
                        {/* Modal Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 15, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, color: '#0f172a', fontSize: 20 }}>
                                🔍 ตรวจสอบ T002: {selectedStudent.firstName} {selectedStudent.lastName}
                            </h3>
                            <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>&times;</button>
                        </div>

                        <div style={{ display: 'flex', gap: 24, height: '70vh' }}>
                            {/* ฝั่งซ้าย: ดู PDF */}
                            <div style={{ flex: 1, background: '#525659', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                {getT002FileUrl(selectedStudent.documents) ? (
                                    <iframe
                                        src={getT002FileUrl(selectedStudent.documents) as string}
                                        width="100%" height="100%" style={{ border: 'none' }} title="PDF Preview"
                                    />
                                ) : (
                                    <div style={{ color: 'white', margin: 'auto' }}>⚠️ ไม่พบไฟล์ T002 ในระบบ</div>
                                )}
                            </div>

                            {/* ฝั่งขวา: เครื่องมือประเมิน */}
                            <div style={{ width: 350, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>ข้อมูลนักศึกษา</h4>
                                    <div style={{ fontSize: 13, color: '#475569', lineHeight: '1.6' }}>
                                        <b>รหัส:</b> {selectedStudent.studentId} <br />
                                        <b>สถานประกอบการ:</b> {selectedStudent.coop?.company?.name || "-"}
                                    </div>
                                </div>

                                <div>
                                    <label style={label}>ข้อความแจ้งนักศึกษา / เหตุผลที่ตีกลับ</label>
                                    <textarea
                                        className="input"
                                        rows={5}
                                        placeholder="เช่น ลายเซ็นไม่ครบ, โปรดระบุเบอร์โทรฉุกเฉิน..."
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        style={{ resize: 'none' }}
                                    />
                                </div>

                                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <button
                                        className="btn-ghost"
                                        style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5', padding: 14 }}
                                        onClick={() => submitReview('REJECT')}
                                        disabled={loading}
                                    >
                                        ❌ ตีกลับให้แก้ไข
                                    </button>
                                    <button
                                        className="btn"
                                        style={{ background: '#10b981', padding: 14 }}
                                        onClick={() => submitReview('APPROVE')}
                                        disabled={loading}
                                    >
                                        ✅ อนุมัติเอกสาร T002
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CSS แบบดั้งเดิมจากหน้า A_DocRequirements */}
            <style>{`
        .btn { border-radius: 8px; border: none; font-weight: 700; color: white; background: #0ea5e9; cursor: pointer; transition: 0.2s; }
        .btn:hover { background: #0284c7; }
        .btn-ghost { border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; background: #fff; cursor: pointer; transition: 0.2s; }
        .btn-ghost:hover { background: #f1f5f9; }
        .input { padding: 12px 14px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-family: inherit; font-size: 14px; width: 100%; box-sizing: border-box; }
        .input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15); }
      `}</style>
        </div>
    );
}

// --- Styles ---
const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: '1px solid #f1f5f9' };
const label: CSSProperties = { fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 };
const modalOverlay: CSSProperties = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, backdropFilter: 'blur(3px)' };
// ปรับขนาด Modal ให้ใหญ่ขึ้นสำหรับแสดง PDF
const modalContentLarge: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, width: "95%", maxWidth: 1200, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" };