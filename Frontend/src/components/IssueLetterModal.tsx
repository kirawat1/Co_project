import React, { useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { createDispatchPDF } from "../utils/pdfDispatchGenerator";
import { createWordBlob, createPreviewBlob, buildDispatchLetterHtml, thaiPrefix } from "../utils/docGeneratorUtils";
import { FileReady, DeliveryPicker, CompanyAddressBox, MODAL_CSS } from "./LetterModalShared";
import DateInput from './DateInput';

interface Props {
    student: any;
    onClose: () => void;
    onSuccess: () => void;
}

export default function IssueLetterModal({ student, onClose, onSuccess }: Props) {
    const [docNumber, setDocNumber] = useState("660301.26.6.2/.......");
    const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
    const [loadingPdf, setLoadingPdf] = useState(false);
    const [loadingDoc, setLoadingDoc] = useState(false);
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [docBlob, setDocBlob] = useState<Blob | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [deliveryMethod, setDeliveryMethod] = useState<"STUDENT" | "STAFF">("STUDENT");
    const [signedFile, setSignedFile] = useState<File | null>(null);

    const startDate = student.coop?.actualStartDate || student.coopApplicationForm?.startDate || "";
    const endDate = student.coop?.actualEndDate || student.coopApplicationForm?.endDate || "";

    const loadCommonData = async () => {
        const [resAssets, resDean] = await Promise.all([
            fetch("/api/admin/assets"),
            apiFetch("/api/admin/config/dean-info"),
        ]);
        const assets = (await resAssets.json()).assets || [];
        const getAsset = (key: string) => {
            const f = assets.find((a: any) => a.key === key);
            return f ? `/uploads/system/${f.path}` : null;
        };
        let deanName = "รองศาสตราจารย์สิรภัทร เชี่ยวชาญวัฒนา";
        let deanPosition = "คณบดีวิทยาลัยการคอมพิวเตอร์";
        if (resDean.ok) {
            const d = await resDean.json();
            if (d.deanName) deanName = d.deanName;
            if (d.deanPosition) deanPosition = d.deanPosition;
        }
        return { getAsset, deanName, deanPosition };
    };

    const handleCreatePdf = async () => {
        if (!startDate) return alert("ไม่พบวันที่เริ่มฝึกในระบบ — นักศึกษาต้องกรอกที่หน้าเอกสารก่อน");
        setLoadingPdf(true);
        try {
            const { getAsset, deanName, deanPosition } = await loadCommonData();
            const krutUrl = getAsset("KRUT");
            const projectUrl = getAsset("PROJECT_DETAILS");
            const acceptUrl = getAsset("ACCEPTANCE_FORM");
            if (!krutUrl) return alert("⚠️ ไม่พบไฟล์ตราครุฑ (KRUT) กรุณาอัปโหลดในหน้าตั้งค่า");

            const profile = { ...student, coop: { ...student.coop, actualStartDate: startDate, actualEndDate: endDate } };
            const allDocs = (student.documents || []).filter((d: any) => d.path);
            // ตรวจสอบว่าไฟล์ยังอยู่บน server ก่อนส่ง
            const fileChecks = await Promise.all(
                allDocs.map(async (d: any) => {
                    const url = `/uploads/${d.path}`;
                    try {
                        const r = await fetch(url, { method: "HEAD" });
                        return { doc: d, url, exists: r.ok };
                    } catch {
                        return { doc: d, url, exists: false };
                    }
                })
            );
            const missing = fileChecks.filter(f => !f.exists);
            if (missing.length > 0) {
                const names = missing.map(f => f.doc.name || f.doc.path).join("\n• ");
                const proceed = window.confirm(`⚠️ พบเอกสาร ${missing.length} ไฟล์ที่ไม่พบบนเซิร์ฟเวอร์ (อาจเป็นไฟล์เก่าที่ถูกลบ):\n• ${names}\n\nสร้าง PDF ต่อโดยข้ามไฟล์ที่หายไป?`);
                if (!proceed) return;
            }
            const studentFiles = fileChecks.filter(f => f.exists).map(f => ({ type: f.doc.type, url: f.url }));
            const blob = await createDispatchPDF(
                profile, docNumber, docDate, krutUrl, "",
                projectUrl || "", acceptUrl || "",
                studentFiles, deanName, deanPosition
            );
            setPdfBlob(blob);
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
                    } catch (err) { alert("สร้าง PDF ไม่สำเร็จ: " + err); }
        finally { setLoadingPdf(false); }
    };

    const handleCreateDoc = async () => {
        if (!startDate) return alert("ไม่พบวันที่เริ่มฝึกในระบบ — นักศึกษาต้องกรอกที่หน้าเอกสารก่อน");
        setLoadingDoc(true);
        try {
            const { deanName, deanPosition } = await loadCommonData();
            const studentName = `${thaiPrefix(student.prefix)}${student.firstName} ${student.lastName}`;
            const html = buildDispatchLetterHtml({
                docNumber, docDate, studentName,
                studentId: student.studentId,
                studyProgram: student.studyProgram,
                companyName: student.coop?.company?.name || "....",
                companyContact: student.coop?.company?.contactPerson || undefined,
                startDate, endDate, deanName, deanPosition,
            });
            const blob = createWordBlob(html);
            setDocBlob(blob);
            // preview doc ใน iframe ด้วย HTML blob
            setPreviewUrl(URL.createObjectURL(createPreviewBlob(html)));
                    } catch (err) { alert("สร้าง Word ไม่สำเร็จ: " + err); }
        finally { setLoadingDoc(false); }
    };

    const download = (blob: Blob, name: string) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = name;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const handleConfirm = async () => {
        if (!signedFile) return alert("กรุณาอัปโหลดไฟล์ที่ลงนามแล้วก่อนบันทึกเข้าระบบ");
        if (!confirm("ยืนยันการบันทึกข้อมูล และอัปเดตสถานะให้นักศึกษา?")) return;
        try {
            const formData = new FormData();
            formData.append("studentId", student.id);
            formData.append("status", "REQ_LETTER_ISSUED");
            formData.append("docType", "DISPATCH_LETTER");
            const msg = deliveryMethod === "STUDENT"
                ? `เจ้าหน้าที่ออกหนังสือแล้ว ให้นักศึกษามารับเอกสารตัวจริงที่คณะ หรือดาวน์โหลดไฟล์เพื่อนำไปยื่นบริษัทด้วยตนเอง`
                : `เจ้าหน้าที่ออกหนังสือและได้จัดส่งให้บริษัททางไปรษณีย์/อีเมลเรียบร้อยแล้ว`;
            formData.append("comment", msg);
            formData.append("reqDocNumber", docNumber);
            formData.append("reqDocDate", docDate);
            formData.append("file", signedFile);
            const res = await apiFetch("/api/admin/t000/review", { method: "PUT", body: formData });
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || `Server error ${res.status}`); }
            alert("✅ บันทึกและจัดเก็บไฟล์เรียบร้อย");
            onSuccess();
        } catch (err: any) { alert(`❌ เกิดข้อผิดพลาด: ${err.message || err}`); }
    };

    return (
        <div className="modal-backdrop" style={{ zIndex: 10000 }}>
            <div className="modal-card" style={{ width: '95%', maxWidth: 1200, height: '90vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #eee', flexShrink: 0 }}>
                    <h3 style={{ margin: 0 }}>📄 ออกหนังสือขอความอนุเคราะห์</h3>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer' }}>&times;</button>
                </div>

                <div className="letter-split" style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0, paddingTop: 16 }}>
                    {/* LEFT: Preview */}
                    <div className="letter-preview" style={{ flex: 1, background: previewUrl ? '#f8fafc' : '#525659', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: previewUrl ? '1px solid #e2e8f0' : 'none' }}>
                        {previewUrl ? (
                            <iframe src={previewUrl} width="100%" height="100%" style={{ border: 'none', flex: 1, background: '#ffffff', colorScheme: 'light' }} title="Preview" />
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ccc', gap: 10 }}>
                                <div style={{ fontSize: 48 }}>📄</div>
                                <div style={{ fontSize: 14 }}>กดปุ่มสร้างเอกสารเพื่อดูตัวอย่าง</div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Controls */}
                    <div className="letter-sidebar" style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0, overflowY: 'auto' }}>
                        {!startDate && (
                            <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 8, border: '1px solid #fca5a5', fontSize: 13, color: '#991b1b', fontWeight: 600 }}>
                                ⚠️ ไม่พบวันที่ฝึกงานในระบบ — นักศึกษาต้องกรอกที่หน้าเอกสารก่อนออกหนังสือได้
                            </div>
                        )}

                        <div>
                            <div style={sec}>1. ข้อมูลหนังสือ</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                                <div><label style={lbl}>เลขที่หนังสือ</label><input className="input" value={docNumber} onChange={e => setDocNumber(e.target.value)} /></div>
                                <div><label style={lbl}>วันที่ออกหนังสือ</label><DateInput className="input" value={docDate} onChange={e => setDocDate(e.target.value)} /></div>
                            </div>
                        </div>

                        <div>
                            <div style={{ ...sec, borderColor: '#f59e0b' }}>2. สร้างเอกสาร</div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleCreatePdf} disabled={loadingPdf || loadingDoc}>
                                    {loadingPdf ? '⏳...' : '📄 PDF'}
                                </button>
                                <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleCreateDoc} disabled={loadingPdf || loadingDoc}>
                                    {loadingDoc ? '⏳...' : '📝 Word'}
                                </button>
                            </div>
                            {(pdfBlob || docBlob) && (
                                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {pdfBlob && <FileReady label="PDF" onDownload={() => download(pdfBlob, `Dispatch_${student.studentId}.pdf`)} />}
                                    {docBlob && <FileReady label="Word (.doc)" onDownload={() => download(docBlob, `Dispatch_${student.studentId}.doc`)} />}
                                </div>
                            )}
                            <p style={{ fontSize: 11, color: '#94a3b8', margin: '6px 0 0' }}>ตัวอย่างแสดงด้านซ้าย · ลงนามจริงก่อนส่ง</p>
                        </div>

                        <div>
                            <div style={{ ...sec, borderColor: '#ef4444' }}>3. แนบไฟล์ที่ลงนามแล้ว <span style={{ color: '#ef4444' }}>*</span></div>
                            <div style={{ marginTop: 8 }}>
                                <input type="file" id="signed-file-dispatch" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                                    onChange={e => setSignedFile(e.target.files?.[0] || null)} />
                                <label htmlFor="signed-file-dispatch" className="btn btn-outline" style={{ width: '100%', display: 'block', textAlign: 'center', cursor: 'pointer', boxSizing: 'border-box' }}>
                                    {signedFile ? `📎 ${signedFile.name}` : '📤 เลือกไฟล์ที่ลงนามแล้ว'}
                                </label>
                                {signedFile && (
                                    <button type="button" onClick={() => setSignedFile(null)} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, padding: 0 }}>ลบไฟล์ที่เลือก</button>
                                )}
                                <p style={{ fontSize: 11, color: '#94a3b8', margin: '6px 0 0' }}>ต้องอัปโหลดไฟล์ที่ลงนามแล้วก่อน จึงจะบันทึกเข้าระบบได้ — ไฟล์นี้จะถูกใช้แทนไฟล์ร่างด้านบนทั้งหมด</p>
                            </div>
                        </div>

                        <div>
                            <div style={{ ...sec, borderColor: '#10b981' }}>4. การจัดส่งเอกสาร</div>
                            <DeliveryPicker value={deliveryMethod} onChange={setDeliveryMethod} name="delivery-dispatch" />
                            {deliveryMethod === "STAFF" && <CompanyAddressBox company={student.coop?.company} />}
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                            <button className="btn btn-success" onClick={handleConfirm} disabled={!signedFile} style={{ width: '100%', padding: 14 }}>
                                🚀 บันทึกเข้าระบบ & แจ้งนักศึกษา
                            </button>
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
