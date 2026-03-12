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

export default function A_DocT003Review() {
    const [students, setStudents] = useState<Student[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [comment, setComment] = useState(""); // สำหรับพิมพ์ข้อความตีกลับ
    const [loading, setLoading] = useState(false);

    // 1. ดึงรายชื่อนักศึกษาและกรองเอาเฉพาะคนที่ส่ง T003_FORM มาแล้ว
    const fetchStudents = async () => {
        try {
            const token = localStorage.getItem("coop.token");

            // ⚠️ ปรับใช้ API กลางที่ดึงนักศึกษาทั้งหมด (ตัวเดียวกับ T002)
            const res = await axios.get("http://localhost:5000/api/admin/students", {
                headers: { Authorization: `Bearer ${token}` }
            });

            let allStudents = [];
            if (Array.isArray(res.data)) {
                allStudents = res.data;
            } else if (res.data?.data) {
                allStudents = res.data.data;
            } else if (res.data?.students) {
                allStudents = res.data.students;
            }

            // ✅ กรอง (Filter) เฉพาะนักศึกษาที่มี T003 ให้ตรวจ
            const t003Students = allStudents.filter((student: any) => {
                const hasPendingDoc = student.documents?.some((doc: any) =>
                    doc.type === 'T003_FORM' && doc.status === 'WAITING'
                );
                const isStatusMatch = student.coop?.status === 'T003_SUBMITTED' || student.docStatus === 'T003_SUBMITTED';

                return hasPendingDoc || isStatusMatch;
            });

            setStudents(t003Students);
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

    // 3. ฟังก์ชันดึง URL ของไฟล์ T003
    const getT003FileUrl = (docs: Document[]) => {
        const file = docs.find(d => d.type === "T003_FORM");
        return file ? `http://localhost:5000/uploads/${file.path}` : null;
    };

    // 4. บันทึกผลการตรวจ (ผ่าน / ตีกลับ)
    const submitReview = async (action: 'APPROVE' | 'REJECT') => {
        if (action === 'REJECT' && !comment.trim()) {
            return alert("กรุณาระบุเหตุผลที่ตีกลับ เพื่อให้นักศึกษาแก้ไข (เช่น แก้ไขหัวข้อ, แผนงานไม่ชัดเจน ฯลฯ)");
        }
        if (!confirm(`ยืนยันการ ${action === 'APPROVE' ? 'อนุมัติ' : 'ตีกลับ'} โครงร่างรายงาน (T003) ?`)) return;

        setLoading(true);
        try {
            const token = localStorage.getItem("coop.token");

            // ✅ ถ้าผ่าน = T003_APPROVED, ถ้าตีกลับ = T003_EDITS_REQUIRED
            // ⚠️ คุณอาจต้องไปเพิ่มสถานะ T003_APPROVED ใน Enum ของ schema.prisma ด้วย
            const newStatus = action === 'APPROVE' ? 'T003_APPROVED' : 'T003_EDITS_REQUIRED';

            // ⚠️ เรียกใช้ API ของ Backend 
            // (ต้องไปสร้างฟังก์ชันรับ API /review-t003 คล้ายๆ ของ T002 ใน adminController ด้วยนะ)
            await axios.put(`http://localhost:5000/api/admin/documents/review-t003`, {
                studentId: selectedStudent?.id,
                status: newStatus,
                comment: action === 'REJECT' ? comment : null
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert(`บันทึกผลเรียบร้อย (${action === 'APPROVE' ? 'อนุมัติ' : 'ตีกลับ'})`);
            setModalOpen(false);
            fetchStudents(); // รีโหลดข้อมูลใหม่
        } catch (err) {
            console.error(err);
            alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล โปรดตรวจสอบ API Endpoint");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

            {/* HEADER */}
            <section style={{ ...card, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e3a8a' }}>📘 ตรวจสอบแบบฟอร์ม T003 (Proposal)</h2>
                    <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>รายชื่อนักศึกษาที่รอการพิจารณาโครงร่างรายงานและแผนปฏิบัติงาน</div>
                </div>
                <div style={{ background: '#dbeafe', color: '#1d4ed8', padding: '8px 16px', borderRadius: 8, fontWeight: 700 }}>
                    รอพิจารณา: {students.length} รายการ
                </div>
            </section>

            {/* TABLE */}
            <section style={card}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13 }}>รหัสนักศึกษา</th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13 }}>ชื่อ-นามสกุล</th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13 }}>สถานที่ปฏิบัติงาน</th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13 }}>สถานะ</th>
                            <th style={{ padding: '14px 16px', color: '#64748b', fontSize: 13, textAlign: 'right' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>🎉 ไม่มีโครงร่างรายงาน (T003) รอพิจารณา</td></tr>
                        ) : students.map(s => (
                            <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#2563eb' }}>
                                    {s.studentId}
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: 14, color: '#1e293b', fontWeight: 600 }}>
                                    {s.firstName} {s.lastName}
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: 14, color: '#475569' }}>
                                    {s.coop?.company?.name || "-"}
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: 13 }}>
                                    <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>
                                        📄 ส่ง T003 แล้ว
                                    </span>
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                    <button className="btn" style={{ padding: '8px 16px', fontSize: 13, background: '#2563eb' }} onClick={() => openReviewModal(s)}>
                                        🔍 พิจารณา
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
                            <h3 style={{ margin: 0, color: '#1e3a8a', fontSize: 20 }}>
                                🔍 พิจารณาโครงร่าง (T003): {selectedStudent.firstName} {selectedStudent.lastName}
                            </h3>
                            <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>&times;</button>
                        </div>

                        <div style={{ display: 'flex', gap: 24, height: '75vh' }}>
                            {/* ฝั่งซ้าย: ดู PDF */}
                            <div style={{ flex: 1, background: '#525659', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                {getT003FileUrl(selectedStudent.documents) ? (
                                    <iframe
                                        src={getT003FileUrl(selectedStudent.documents) as string}
                                        width="100%" height="100%" style={{ border: 'none' }} title="PDF Preview"
                                    />
                                ) : (
                                    <div style={{ color: 'white', margin: 'auto' }}>⚠️ ไม่พบไฟล์ T003 ในระบบ</div>
                                )}
                            </div>

                            {/* ฝั่งขวา: เครื่องมือประเมิน */}
                            <div style={{ width: 350, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>ข้อมูลนักศึกษา</h4>
                                    <div style={{ fontSize: 13, color: '#475569', lineHeight: '1.6' }}>
                                        <b>รหัส:</b> {selectedStudent.studentId} <br />
                                        <b>สถานที่ปฏิบัติงาน:</b> {selectedStudent.coop?.company?.name || "-"}
                                    </div>
                                </div>

                                <div>
                                    <label style={label}>ข้อเสนอแนะ / เหตุผลที่ให้แก้ไข</label>
                                    <textarea
                                        className="input"
                                        rows={6}
                                        placeholder="เช่น หัวข้อยังกว้างเกินไป, กรุณาเพิ่มรายละเอียดในสัปดาห์ที่ 2..."
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        style={{ resize: 'none' }}
                                    />
                                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                                        * หากอนุมัติ ไม่จำเป็นต้องกรอกข้อความ
                                    </div>
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
                                        style={{ background: '#2563eb', padding: 14 }}
                                        onClick={() => submitReview('APPROVE')}
                                        disabled={loading}
                                    >
                                        ✅ อนุมัติโครงร่างรายงาน
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CSS */}
            <style>{`
                .btn { border-radius: 8px; border: none; font-weight: 700; color: white; cursor: pointer; transition: 0.2s; }
                .btn:hover { opacity: 0.9; }
                .btn-ghost { border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; background: #fff; cursor: pointer; transition: 0.2s; }
                .btn-ghost:hover { background: #f1f5f9; }
                .input { padding: 12px 14px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-family: inherit; font-size: 14px; width: 100%; box-sizing: border-box; }
                .input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); }
            `}</style>
        </div>
    );
}

// --- Styles ---
const card: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: '1px solid #f1f5f9' };
const label: CSSProperties = { fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 };
const modalOverlay: CSSProperties = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, backdropFilter: 'blur(3px)' };
const modalContentLarge: CSSProperties = { background: "#fff", borderRadius: 16, padding: 24, width: "95%", maxWidth: 1200, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" };