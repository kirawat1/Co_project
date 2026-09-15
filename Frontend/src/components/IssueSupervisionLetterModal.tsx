import React, { useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { createSupervisionLetterPDF } from "../utils/pdfSupervisionLetterGenerator";
import { createWordBlob, createPreviewBlob, buildSupervisionLetterHtml, thaiPrefix, supervisionSupervisorNames, supervisionTimeText, normalizeDocNumber } from "../utils/docGeneratorUtils";
import { FileReady, DeliveryPicker, CompanyAddressBox, MODAL_CSS, useLetterPending, LetterPendingBanner, confirmMatchesDraft, type LetterDraft } from "./LetterModalShared";
import DateInput from './DateInput';

interface Props { supervision: any; onClose: () => void; onSuccess: () => void; }

export default function IssueSupervisionLetterModal({ supervision, onClose, onSuccess }: Props) {
    const pending = useLetterPending({ record: supervision, prefix: "letter", endpoint: `/api/admin/supervisions/${supervision.id}/letter-pending` });
    // เก็บเฉพาะตัวเลข (ชุดเดียวกับหนังสือขอความอนุเคราะห์/ส่งตัว) — เจ้าหน้าที่ต่อเลขท้าย "/" เอง · มีร่างรอลงนาม → เติมเลขที่/วันที่ของร่าง
    const [docNumber, setDocNumber] = useState(pending.draftNumber || "660301.26.6.2/");
    const [docDate, setDocDate] = useState(pending.draftDate || new Date().toISOString().split('T')[0]);
    const [loadingPdf, setLoadingPdf] = useState(false);
    const [loadingDoc, setLoadingDoc] = useState(false);
    const [pdfDraft, setPdfDraft] = useState<LetterDraft | null>(null);
    const [docDraft, setDocDraft] = useState<LetterDraft | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [deliveryMethod, setDeliveryMethod] = useState<"STUDENT" | "STAFF">("STUDENT");
    const [signedFile, setSignedFile] = useState<File | null>(null);

    const student = supervision.student || {};

    const loadCommonData = async () => {
        const [resAssets, resDean] = await Promise.all([
            fetch("/api/admin/assets"),
            apiFetch("/api/admin/config/dean-info"),
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
        return {
            getAsset, deanName, deanPosition, studentName,
            // อาจารย์หลัก + อาจารย์นิเทศร่วม (เดิมอ่าน supervision.coTeacher ซึ่งไม่มีในข้อมูล อาจารย์ร่วมเลยไม่ขึ้น)
            supervisorNames: supervisionSupervisorNames(supervision),
            companyName: student.coop?.company?.name || supervision.companyName || "....",
            visitDate: supervision.confirmedDate || docDate,
            // เวลาอยู่ใน confirmedDate (เดิมอ่าน supervision.visitTime ซึ่งไม่มี เลยขึ้น 13.30 น. ทุกฉบับ)
            visitTime: supervisionTimeText(supervision.confirmedDate),
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
            setPdfDraft({ blob, docNumber, docDate });
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
            setDocDraft({ blob: createWordBlob(html), docNumber, docDate });
            setPreviewUrl(URL.createObjectURL(createPreviewBlob(html)));
        } catch (err) { alert("สร้าง Word ไม่สำเร็จ: " + err); }
        finally { setLoadingDoc(false); }
    };

    const download = (blob: Blob, name: string) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob); link.download = name;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    // ดาวน์โหลดร่างไปเสนอลงนาม → ขึ้นป้าย "รอลงนาม" ก่อน (เลขที่ซ้ำกับคนอื่นจะไม่ให้ดาวน์โหลด)
    const downloadDraft = async (draft: LetterDraft, name: string) => {
        if (await pending.markPending(draft)) download(draft.blob, name);
    };

    const handleConfirm = async () => {
        // เลขที่หนังสือราชการห้ามซ้ำ — เทมเพลตที่ยังไม่กรอกเลขท้าย "/" จะกลายเป็นเลขซ้ำทันที
        const docNo = normalizeDocNumber(docNumber);
        if (!docNo || /[.]{3,}|x{3,}/i.test(docNo) || !/\/\s*\S/.test(docNo)) {
            return alert("กรุณากรอกเลขที่หนังสือให้ครบก่อนบันทึก (ใส่เลขต่อท้าย / เช่น 660301.26.6.2/1234)");
        }
        if (!signedFile) return alert("กรุณาอัปโหลดไฟล์ที่ลงนามแล้วก่อนบันทึกเข้าระบบ");
        if (!confirmMatchesDraft(pending.draftNumber, docNo)) return;
        if (!confirm("ยืนยันการบันทึกข้อมูล และอัปเดตสถานะการนิเทศให้นักศึกษา?")) return;
        setLoadingPdf(true);
        try {
            const formData = new FormData();
            formData.append("docNumber", docNo);
            formData.append("docDate", docDate);
            formData.append("file", signedFile);
            formData.append("deliveryMethod", deliveryMethod);
            const res = await apiFetch(`/api/admin/supervisions/${supervision.id}/upload-letter`, {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || `Server error ${res.status}`); }
            alert("✅ บันทึกและจัดเก็บไฟล์หนังสือนิเทศเรียบร้อยแล้ว");
            onSuccess();
        } catch (err: any) { alert(`❌ เกิดข้อผิดพลาด: ${err.message || err}`); }
        finally { setLoadingPdf(false); }
    };

    return (
        <div className="modal-backdrop" style={{ zIndex: 10000 }}>
            <div className="modal-card" style={{ width: '95%', maxWidth: 1200, height: '90vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #eee', flexShrink: 0 }}>
                    <h3 style={{ margin: 0 }}>📄 ออกหนังสือขอนิเทศสหกิจศึกษา</h3>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer' }}>&times;</button>
                </div>
                <div className="letter-split" style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0, paddingTop: 16 }}>
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
                    <div className="letter-sidebar" style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0, overflowY: 'auto' }}>
                        <LetterPendingBanner {...pending} onCancel={pending.cancelPending} />
                        <div>
                            <div style={sec}>1. ข้อมูลหนังสือ</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                                <div>
                                    <label style={lbl}>เลขที่หนังสือ</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ whiteSpace: 'nowrap', opacity: .7 }}>ที่ อว</span>
                                        <input className="input" style={{ flex: 1 }} value={docNumber}
                                            onChange={e => setDocNumber(e.target.value)} placeholder="660301.26.6.2/1234" />
                                    </div>
                                </div>
                                <div><label style={lbl}>วันที่ออกหนังสือ</label><DateInput className="input" value={docDate} onChange={e => setDocDate(e.target.value)} /></div>
                            </div>
                        </div>
                        <div>
                            <div style={{ ...sec, borderColor: '#f59e0b' }}>2. สร้างเอกสาร</div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleCreatePdf} disabled={loadingPdf || loadingDoc}>{loadingPdf ? '⏳...' : '📄 PDF'}</button>
                                <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleCreateDoc} disabled={loadingPdf || loadingDoc}>{loadingDoc ? '⏳...' : '📝 Word'}</button>
                            </div>
                            {(pdfDraft || docDraft) && (
                                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {pdfDraft && <FileReady label="PDF" onDownload={() => downloadDraft(pdfDraft, `Supervision_${student.studentId || "letter"}.pdf`)} />}
                                    {docDraft && <FileReady label="Word (.doc)" onDownload={() => downloadDraft(docDraft, `Supervision_${student.studentId || "letter"}.doc`)} />}
                                </div>
                            )}
                            <p style={{ fontSize: 11, color: '#94a3b8', margin: '6px 0 0' }}>ตัวอย่างแสดงด้านซ้าย · กดโหลดร่างไปเสนอลงนาม → ขึ้นสถานะ "รอลงนาม"</p>
                        </div>
                        <div>
                            <div style={{ ...sec, borderColor: '#ef4444' }}>3. แนบไฟล์ที่ลงนามแล้ว <span style={{ color: '#ef4444' }}>*</span></div>
                            <div style={{ marginTop: 8 }}>
                                <input type="file" id="signed-file-supervision" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                                    onChange={e => setSignedFile(e.target.files?.[0] || null)} />
                                <label htmlFor="signed-file-supervision" className="btn btn-outline" style={{ width: '100%', display: 'block', textAlign: 'center', cursor: 'pointer', boxSizing: 'border-box' }}>
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
                            <DeliveryPicker value={deliveryMethod} onChange={setDeliveryMethod} name="delivery-supervision" />
                            {deliveryMethod === "STAFF" && <CompanyAddressBox company={student.coop?.company} />}
                        </div>
                        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                            <button className="btn btn-success" onClick={handleConfirm} disabled={!signedFile} style={{ width: '100%', padding: 14 }}>🚀 บันทึกเข้าระบบ & แจ้งนักศึกษา</button>
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
