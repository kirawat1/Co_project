import React, { useState } from "react";
import axios from "axios";
import { createSupervisionLetterPDF } from "../utils/pdfSupervisionLetterGenerator";
import { createWordBlob, createPreviewBlob, buildSupervisionLetterHtml, thaiPrefix } from "../utils/docGeneratorUtils";
import { FileReady, DeliveryPicker, MODAL_CSS } from "./LetterModalShared";

interface Props { supervision: any; onClose: () => void; onSuccess: () => void; }

export default function IssueSupervisionLetterModal({ supervision, onClose, onSuccess }: Props) {
    const [docNumber, setDocNumber] = useState("6602.26.6.2/.......");
    const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
    const [loadingPdf, setLoadingPdf] = useState(false);
    const [loadingDoc, setLoadingDoc] = useState(false);
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [docBlob, setDocBlob] = useState<Blob | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [deliveryMethod, setDeliveryMethod] = useState<"STUDENT" | "STAFF">("STUDENT");

    const student = supervision.student || {};
    const teacher = supervision.teacher || supervision.coTeacher || {};

    const loadCommonData = async () => {
        const [resAssets, resDean] = await Promise.all([
            fetch("/api/admin/assets"),
            fetch("/api/admin/config/dean-info", { headers: { Authorization: `Bearer ${localStorage.getItem("coop.token")}` } }),
        ]);
        const assets = (await resAssets.json()).assets || [];
        const getAsset = (key: string) => { const f = assets.find((a: any) => a.key === key); return f ? `/uploads/system/${f.path}` : null; };
        let deanName = "รองศาสตราจารย์สิรภัทร เชี่ยวชาญวัฒนา";
        let deanPosition = "คณบดีวิทยาลัยการคอมพิวเตอร์";
        if (resDean.ok) { const d = await resDean.json(); if (d.deanName) deanName = d.deanName; if (d.deanPosition) deanPosition = d.deanPosition; }
        return { getAsset, deanName, deanPosition };
    };

    const getDocData = async () => {
        const { getAsset, deanName, deanPosition } = await loadCommonData();
        const studentName = `${thaiPrefix(student.prefix)}${student.firstName || ""} ${student.lastName || ""}`.trim();
        const supervisorNames: string[] = [];
        if (teacher.firstName) supervisorNames.push(`${thaiPrefix(teacher.prefix)}${teacher.firstName} ${teacher.lastName}`);
        if (supervision.coTeacher?.firstName) supervisorNames.push(`อาจารย์${supervision.coTeacher.firstName} ${supervision.coTeacher.lastName}`);
        if (supervisorNames.length === 0) supervisorNames.push("อาจารย์นิเทศ");
        return {
            getAsset, deanName, deanPosition, studentName, supervisorNames,
            companyName: student.coop?.company?.name || supervision.companyName || "....",
            visitDate: supervision.proposedDate || supervision.confirmedDate || docDate,
            visitTime: supervision.visitTime || "13.30 น.",
            visitMode: supervision.supervisionType === "ONLINE" ? "รูปแบบออนไลน์" : "ณ สถานประกอบการ",
        };
    };

    const handleCreatePdf = async () => {
        setLoadingPdf(true);
        try {
            const { getAsset, deanName, deanPosition } = await loadCommonData();
            const krutUrl = getAsset("KRUT");
            if (!krutUrl) return alert("⚠️ ไม่พบไฟล์ตราครุฑ (KRUT) กรุณาอัปโหลดในหน้าตั้งค่า");
            const blob = await createSupervisionLetterPDF(supervision, docNumber, docDate, krutUrl, "", deanName, deanPosition);
            setPdfBlob(blob);
            setPreviewUrl(URL.createObjectURL(blob));
        } catch (err) { alert("สร้าง PDF ไม่สำเร็จ: " + err); }
        finally { setLoadingPdf(false); }
    };

    const handleCreateDoc = async () => {
        setLoadingDoc(true);
        try {
            const { deanName, deanPosition, studentName, supervisorNames, companyName, visitDate, visitTime, visitMode } = await getDocData();
            const html = buildSupervisionLetterHtml({
                docNumber, docDate, studentName,
                studentId: student.studentId || "",
                companyName, supervisorNames, visitDate, visitTime, visitMode, deanName, deanPosition,
            });
            setDocBlob(createWordBlob(html));
            setPreviewUrl(URL.createObjectURL(createPreviewBlob(html)));
        } catch (err) { alert("สร้าง Word ไม่สำเร็จ: " + err); }
        finally { setLoadingDoc(false); }
    };

    const download = (blob: Blob, name: string) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob); link.download = name;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const handleConfirm = async () => {
        const fileBlob = docBlob || pdfBlob;
        if (!fileBlob) return alert("กรุณาสร้างเอกสาร PDF หรือ Word ก่อน");
        if (!confirm("ยืนยันการบันทึกข้อมูล และอัปเดตสถานะการนิเทศให้นักศึกษา?")) return;
        setLoadingPdf(true);
        try {
            const ext = docBlob ? "doc" : "pdf";
            const mime = docBlob ? "application/msword" : "application/pdf";
            const file = new File([fileBlob], `supervision_${student.studentId || "letter"}.${ext}`, { type: mime });
            const formData = new FormData();
            formData.append("file", file);
            formData.append("deliveryMethod", deliveryMethod);
            const token = localStorage.getItem("coop.token");
            await axios.post(`/api/admin/supervisions/${supervision.id}/upload-letter`, formData, {
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
            });
            alert("✅ บันทึกและจัดเก็บไฟล์หนังสือนิเทศเรียบร้อยแล้ว");
            onSuccess();
        } catch (err) { alert("เกิดข้อผิดพลาดในการอัปเดตข้อมูล"); }
        finally { setLoadingPdf(false); }
    };

    return (
        <div className="modal-backdrop" style={{ zIndex: 10000 }}>
            <div className="modal-card" style={{ width: '95%', maxWidth: 1200, height: '90vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #eee', flexShrink: 0 }}>
                    <h3 style={{ margin: 0 }}>📄 ออกหนังสือขอนิเทศสหกิจศึกษา</h3>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer' }}>&times;</button>
                </div>
                <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0, paddingTop: 16 }}>
                    <div style={{ flex: 1, background: previewUrl ? '#f8fafc' : '#525659', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: previewUrl ? '1px solid #e2e8f0' : 'none' }}>
                        {previewUrl ? (
                            <iframe src={previewUrl} width="100%" height="100%" style={{ border: 'none', flex: 1, background: '#ffffff', colorScheme: 'light' }} title="Preview" />
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ccc', gap: 10 }}>
                                <div style={{ fontSize: 48 }}>📄</div>
                                <div style={{ fontSize: 14 }}>กดปุ่มสร้างเอกสารเพื่อดูตัวอย่าง</div>
                            </div>
                        )}
                    </div>
                    <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0, overflowY: 'auto' }}>
                        <div>
                            <div style={sec}>1. ข้อมูลหนังสือ</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                                <div><label style={lbl}>เลขที่หนังสือ</label><input className="input" value={docNumber} onChange={e => setDocNumber(e.target.value)} /></div>
                                <div><label style={lbl}>วันที่ออกหนังสือ</label><input type="date" className="input" value={docDate} onChange={e => setDocDate(e.target.value)} /></div>
                            </div>
                        </div>
                        <div>
                            <div style={{ ...sec, borderColor: '#f59e0b' }}>2. สร้างเอกสาร</div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleCreatePdf} disabled={loadingPdf || loadingDoc}>{loadingPdf ? '⏳...' : '📄 PDF'}</button>
                                <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleCreateDoc} disabled={loadingPdf || loadingDoc}>{loadingDoc ? '⏳...' : '📝 Word'}</button>
                            </div>
                            {(pdfBlob || docBlob) && (
                                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {pdfBlob && <FileReady label="PDF" onDownload={() => download(pdfBlob, `Supervision_${student.studentId || "letter"}.pdf`)} />}
                                    {docBlob && <FileReady label="Word (.doc)" onDownload={() => download(docBlob, `Supervision_${student.studentId || "letter"}.doc`)} />}
                                </div>
                            )}
                            <p style={{ fontSize: 11, color: '#94a3b8', margin: '6px 0 0' }}>ตัวอย่างแสดงด้านซ้าย · ลงนามจริงก่อนส่ง</p>
                        </div>
                        <div>
                            <div style={{ ...sec, borderColor: '#10b981' }}>3. การจัดส่งเอกสาร</div>
                            <DeliveryPicker value={deliveryMethod} onChange={setDeliveryMethod} name="delivery-supervision" />
                        </div>
                        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                            <button className="btn btn-success" onClick={handleConfirm} disabled={!pdfBlob && !docBlob} style={{ width: '100%', padding: 14 }}>🚀 บันทึกเข้าระบบ & แจ้งนักศึกษา</button>
                        </div>
                    </div>
                </div>
            </div>
            <style>{MODAL_CSS}</style>
        </div>
    );
}

const sec: React.CSSProperties = { fontSize: 13, fontWeight: 'bold', color: '#334155', borderBottom: '2px solid #3b82f6', paddingBottom: 4 };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4, display: 'block' };
