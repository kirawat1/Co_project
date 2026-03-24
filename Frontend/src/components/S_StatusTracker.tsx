import React, { useState, useEffect } from "react";
import axios from "axios";
import StatusBadge from "./StatusBadge";

interface TrackingData {
    profile: any;
    supervision: any;
    loading: boolean;
}

export default function S_StatusTracker() {
    const [data, setData] = useState<TrackingData>({ profile: null, supervision: null, loading: true });
    const token = localStorage.getItem("coop.token");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [profileRes, supRes] = await Promise.all([
                    axios.get("http://localhost:5000/api/students/me", { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get("http://localhost:5000/api/coop/supervision/me", { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: null }))
                ]);

                setData({
                    profile: profileRes.data,
                    supervision: supRes.data?.appointment || null,
                    loading: false
                });
            } catch (err) {
                console.error(err);
                setData(prev => ({ ...prev, loading: false }));
            }
        };
        fetchData();
    }, [token]);

    if (data.loading) return <div style={{ padding: 40, textAlign: 'center' }}>กำลังโหลดข้อมูลการติดตาม...</div>;
    if (!data.profile) return <div style={{ padding: 40, textAlign: 'center' }}>ไม่พบข้อมูลนักศึกษา</div>;

    const profile = data.profile;
    const coopStatus = profile.coop?.status || "NOT_SUBMITTED";
    const documents = profile.documents || [];
    const supervision = data.supervision;

    // --- Helper Functions หาเอกสารแต่ละประเภท ---
    const getDoc = (type: string) => documents.find((d: any) => d.type === type);
    const hasDoc = (type: string) => !!getDoc(type);

    // ==========================================
    // 🧠 LOGIC: กำหนดสถานะของแต่ละขั้นตอน (Step Status)
    // สถานะ: "WAITING" (สีเทา), "IN_PROGRESS" (สีฟ้า), "WARNING" (สีส้ม/แดง), "COMPLETED" (สีเขียว)
    // ==========================================

    // Step 1: คุณสมบัติและใบสมัคร (T000)
    let step1 = { status: "WAITING", desc: "รอดำเนินการ", badge: coopStatus };
    if (coopStatus === "NOT_SUBMITTED") {
        step1 = { status: profile.isQualified ? "IN_PROGRESS" : "WARNING", desc: profile.isQualified ? "กรุณายื่นคำร้องขอสหกิจศึกษา" : "คุณสมบัติยังไม่ครบ", badge: "NOT_SUBMITTED" };
    } else if (['APPLYING', 'WAITING_FOR_STAFF_CHECK'].includes(coopStatus)) {
        step1 = { status: "IN_PROGRESS", desc: "รอการตรวจสอบจากอาจารย์และเจ้าหน้าที่", badge: coopStatus };
    } else if (['APPLICATION_EDITS_REQUIRED', 'EDITS_REQUIRED', 'QUALIFICATION_FAILED', 'REJECTED'].includes(coopStatus)) {
        step1 = { status: "WARNING", desc: "กรุณาแก้ไขเอกสารตามที่เจ้าหน้าที่/อาจารย์แจ้ง", badge: coopStatus };
    } else {
        step1 = { status: "COMPLETED", desc: "ผ่านการอนุมัติคำร้องแล้ว", badge: "DOCS_APPROVED" };
    }

    // Step 2: จัดหาที่ฝึกงาน & ใบตอบรับ
    let step2 = { status: "WAITING", desc: "รอให้ขั้นตอนที่ 1 เสร็จสิ้น", badge: "" };
    if (step1.status === "COMPLETED") {
        if (coopStatus === "REQ_LETTER_ISSUED") {
            step2 = { status: "IN_PROGRESS", desc: "เจ้าหน้าที่ออกหนังสือแล้ว ให้นำไปยื่นบริษัท", badge: "WAITING_FOR_PLACEMENT_LETTER" };
        } else if (['WAITING_FOR_PLACEMENT_LETTER', 'WAITING_FOR_STAFF_CHECK_LETTER'].includes(coopStatus)) {
            step2 = { status: "IN_PROGRESS", desc: "อัปโหลดใบตอบรับแล้ว รอเจ้าหน้าที่ตรวจสอบ", badge: coopStatus };
        } else if (coopStatus === "EDITS_REQUIRED" && hasDoc('CP-ACCEPTANCE')) {
            step2 = { status: "WARNING", desc: "ใบตอบรับไม่ถูกต้อง กรุณาแก้ไข", badge: "EDITS_REQUIRED" };
        } else if (['ACCEPTANCE_CHECKED', 'PLACEMENT_LETTER_ISSUED', 'INTERNSHIP_STARTED'].includes(coopStatus)) {
            step2 = { status: "COMPLETED", desc: "ดำเนินการเรื่องใบตอบรับเสร็จสิ้น", badge: "PLACEMENT_LETTER_ISSUED" };
        } else {
            step2 = { status: "IN_PROGRESS", desc: "รอจัดทำหนังสือขอความอนุเคราะห์", badge: "REQ_LETTER_ISSUED" };
        }
    }

    // Step 3: เอกสารขณะฝึกงาน (T002 & T003)
    let step3 = { status: "WAITING", desc: "รอออกปฏิบัติงานสหกิจศึกษา", badge: "" };
    const t002 = getDoc('CP-T002');
    const t003 = getDoc('CP-T003');

    if (coopStatus === "INTERNSHIP_STARTED" || t002 || t003) {
        if (t002?.status === 'APPROVED' && t003?.status === 'APPROVED') {
            step3 = { status: "COMPLETED", desc: "ส่ง T002 และโครงร่าง T003 เรียบร้อยแล้ว", badge: "T003_APPROVED" };
        } else if (t002?.status === 'REJECTED' || t003?.status === 'REJECTED') {
            step3 = { status: "WARNING", desc: "มีเอกสารต้องแก้ไข (T002 หรือ T003)", badge: "T002_EDITS_REQUIRED" };
        } else if (t002 || t003) {
            step3 = { status: "IN_PROGRESS", desc: "ส่งเอกสารแล้วบางส่วน กำลังรอตรวจ", badge: "T002_SUBMITTED" };
        } else {
            step3 = { status: "IN_PROGRESS", desc: "กำลังฝึกงาน: กรุณาส่ง T002 และ T003", badge: "INTERNSHIP_STARTED" };
        }
    }

    // Step 4: การนิเทศสหกิจศึกษา
    let step4 = { status: "WAITING", desc: "รอส่งเอกสารโครงร่าง (T003) ให้เรียบร้อย", badge: "" };
    if (coopStatus === "INTERNSHIP_STARTED" || supervision) {
        if (!supervision) {
            step4 = { status: "WAITING", desc: "ยังไม่ได้เสนอนัดหมายนิเทศ", badge: "WAITING" };
        } else if (supervision.status === 'PENDING_TEACHER') {
            step4 = { status: "IN_PROGRESS", desc: "เสนอวันแล้ว รออาจารย์พิจารณา", badge: supervision.status };
        } else if (supervision.status === 'TEACHER_REJECTED') {
            step4 = { status: "WARNING", desc: "อาจารย์ไม่สะดวก กรุณาเสนอวันใหม่", badge: supervision.status };
        } else if (supervision.status === 'DATE_CONFIRMED' || supervision.status === 'LETTER_UPLOADED') {
            step4 = { status: "IN_PROGRESS", desc: `นัดหมายนิเทศวันที่: ${new Date(supervision.confirmedDate).toLocaleDateString('th-TH')}`, badge: supervision.status };
        } else if (supervision.status === 'COMPLETED') {
            step4 = { status: "COMPLETED", desc: "อาจารย์ดำเนินการนิเทศเสร็จสิ้น", badge: supervision.status };
        }
    }

    // // Step 5: ประเมินและรายงานผล (T004, T005, T006)
    // let step5 = { status: "WAITING", desc: "ดำเนินการหลังการนิเทศเสร็จสิ้น", badge: "" };
    // const reportDoc = getDoc('CP-T004') || getDoc('REPORT');
    // if (step4.status === "COMPLETED") {
    //     if (reportDoc?.status === 'APPROVED') {
    //         step5 = { status: "COMPLETED", desc: "เสร็จสิ้นโครงการสหกิจศึกษา", badge: "COMPLETED" };
    //     } else if (reportDoc?.status === 'REJECTED') {
    //         step5 = { status: "WARNING", desc: "รายงานไม่ผ่านการอนุมัติ กรุณาแก้ไข", badge: "EDITS_REQUIRED" };
    //     } else if (reportDoc) {
    //         step5 = { status: "IN_PROGRESS", desc: "ส่งรายงานแล้ว รอประเมินผล", badge: "WAITING_FOR_STAFF_CHECK" };
    //     } else {
    //         step5 = { status: "IN_PROGRESS", desc: "กรุณาส่งรูปเล่มรายงานและแบบประเมิน", badge: "WAITING" };
    //     }
    // }

    // ==========================================
    // UI RENDER
    // ==========================================
    const stepsUI = [
        { title: "1. ยื่นคำร้องขอสหกิจศึกษา (T000)", ...step1 },
        { title: "2. ตอบรับเข้าทำงาน & หนังสือส่งตัว", ...step2 },
        { title: "3. ส่งรายละเอียด & โครงร่าง (T002-T003)", ...step3 },
        { title: "4. รับการนิเทศสหกิจศึกษา", ...step4 },
        // { title: "5. ส่งรายงานและประเมินผล (T004-T006)", ...step5 },
    ];

    const getIcon = (status: string) => {
        if (status === "COMPLETED") return <div className="step-icon completed">✅</div>;
        if (status === "IN_PROGRESS") return <div className="step-icon progress">🔄</div>;
        if (status === "WARNING") return <div className="step-icon warning">⚠️</div>;
        return <div className="step-icon waiting">⚪</div>;
    };

    return (
        <div className="page" style={{ padding: 4, margin: 28 }}>
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>📍 ติดตามสถานะสหกิจศึกษา (Status Tracker)</h2>
                <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>ภาพรวมขั้นตอนการดำเนินงานและเอกสารทั้งหมดของคุณ</div>
            </div>

            <div className="card" style={{ padding: 30 }}>
                <div className="timeline-container">
                    {stepsUI.map((step, index) => (
                        <div key={index} className={`timeline-item ${step.status.toLowerCase()}`}>
                            {/* เส้นเชื่อม (ยกเว้นอันสุดท้าย) */}
                            {index < stepsUI.length - 1 && <div className={`timeline-line ${step.status === 'COMPLETED' ? 'active' : ''}`}></div>}

                            {/* ไอคอน */}
                            <div className="timeline-icon-wrapper">
                                {getIcon(step.status)}
                            </div>

                            {/* เนื้อหา */}
                            <div className="timeline-content">
                                <h3 className="step-title">{step.title}</h3>
                                <p className="step-desc">{step.desc}</p>

                                {step.badge && (
                                    <div style={{ marginTop: 8 }}>
                                        <StatusBadge status={step.badge} hidePrefix={true} />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                .card { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                
                /* Timeline CSS */
                .timeline-container { position: relative; padding-left: 20px; }
                .timeline-item { position: relative; padding-bottom: 40px; display: flex; gap: 20px; }
                .timeline-item:last-child { padding-bottom: 0; }
                
                .timeline-line { position: absolute; left: 19px; top: 40px; bottom: 0; width: 2px; background-color: #e2e8f0; z-index: 1; }
                .timeline-line.active { background-color: #10b981; } /* สีเขียวถ้าผ่านแล้ว */
                
                .timeline-icon-wrapper { position: relative; z-index: 2; }
                .step-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 2px solid; background: white; }
                
                /* Colors for Icons */
                .step-icon.completed { border-color: #10b981; background: #dcfce7; }
                .step-icon.progress { border-color: #3b82f6; background: #eff6ff; }
                .step-icon.warning { border-color: #f59e0b; background: #fffbeb; }
                .step-icon.waiting { border-color: #cbd5e1; background: #f8fafc; color: #94a3b8; }
                
                .timeline-content { flex: 1; padding-top: 6px; }
                .step-title { margin: 0 0 4px 0; font-size: 16px; font-weight: 700; color: #1e293b; }
                .step-desc { margin: 0; font-size: 14px; color: #64748b; line-height: 1.5; }
                
                /* Styles for Container depending on status */
                .timeline-item.completed .step-title { color: #065f46; }
                .timeline-item.progress .step-title { color: #1e3a8a; }
                .timeline-item.warning .step-title { color: #9a3412; }
                .timeline-item.waiting .step-title { color: #94a3b8; }
                .timeline-item.waiting .step-desc { color: #cbd5e1; }
            `}</style>
        </div>
    );
}