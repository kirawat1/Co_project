// Frontend/src/components/IssuePlacementLetterModal.tsx
import { BusyLabel } from "./Spinner";
import LetterBatchNotice, { sharesDraft } from "./LetterBatchNotice";
import React, { useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { createPlacementPDF } from "../utils/pdfGeneratorPlacement";
import { createWordBlob, createPreviewBlob, buildPlacementLetterHtml, thaiPrefix, normalizeDocNumber, letterMajorName } from "../utils/docGeneratorUtils";
import { FileReady, DeliveryPicker, CompanyAddressBox, RecipientNotice, MODAL_CSS, useLetterPending, LetterPendingBanner, confirmMatchesDraft, type LetterDraft } from "./LetterModalShared";
import DateInput from './DateInput';
import { notify, askConfirm } from "../utils/notify";
import { letterRecipient, recipientText } from "../utils/letterRecipient";
import { toLetterStudent } from "../utils/letterGroup";
import { loadLetterAssets } from "../utils/letterAssets";

// group = หนังสือรวมหลายคน (บริษัทเดียวกัน วันฝึกต่างกันได้) · student = คนแรกของกลุ่ม · ไม่ส่ง = หนังสือเดี่ยว
// batchMates/onOpenBatch = หนังสือเดี่ยวของคนที่อยู่ในหนังสือรวม (ดู LetterBatchNotice)
interface Props { student: any; group?: any[]; batchMates?: any[]; onOpenBatch?: () => void; onClose: () => void; onSuccess: () => void; }

export default function IssuePlacementLetterModal({ student, group, batchMates, onOpenBatch, onClose, onSuccess }: Props) {
    const members = group && group.length > 1 ? group : null;
    const pending = useLetterPending({ record: student.coop, prefix: "placeLetter", endpoint: "/api/admin/t000/letter-pending", body: members ? { studentIds: members.map(m => m.id), letter: "PLACEMENT" } : { studentId: student.id, letter: "PLACEMENT" } });
    // เก็บเฉพาะตัวเลข — คำนำหน้า "ที่ อว" ถูกเติมในเทมเพลตหนังสือแล้ว · มีร่างที่รอลงนามอยู่ → เติมเลขที่/วันที่ของร่างนั้น
    const [placeDocNumber, setPlaceDocNumber] = useState(pending.draftNumber || "660301.26.6.2/");
    const [placeDocDate, setPlaceDocDate] = useState(pending.draftDate || new Date().toISOString().split("T")[0]);
    const [loadingPdf, setLoadingPdf] = useState(false);
    const [loadingDoc, setLoadingDoc] = useState(false);
    const [pdfDraft, setPdfDraft] = useState<LetterDraft | null>(null);
    const [docDraft, setDocDraft] = useState<LetterDraft | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    // พิมพ์ซ้ำ → ใช้วิธีจัดส่งที่เลือกไว้ครั้งก่อน
    const [deliveryMethod, setDeliveryMethod] = useState<"STUDENT" | "STAFF">(student.coop?.placeLetterDelivery === "STAFF" ? "STAFF" : "STUDENT");
    const [signedFile, setSignedFile] = useState<File | null>(null);

    const startDate = student.coop?.actualStartDate || student.coopApplicationForm?.startDate || "";
    const endDate = student.coop?.actualEndDate || student.coopApplicationForm?.endDate || "";

    const handleCreatePdf = async () => {
        setLoadingPdf(true);
        try {
            const { krutUrl, deanName, deanPosition } = await loadLetterAssets();
            if (!krutUrl) return notify.error("⚠️ ไม่พบไฟล์ตราสัญลักษณ์มหาวิทยาลัย กรุณาอัปโหลดในหน้าตั้งค่า");
            const doc = await createPlacementPDF(
                student, { placeDocNumber, placeDocDate, actualStartDate: startDate, actualEndDate: endDate },
                krutUrl, deanName, deanPosition,
                members ? members.map(toLetterStudent) : undefined
            );
            const blob = doc.output("blob");
            setPdfDraft({ blob, docNumber: placeDocNumber, docDate: placeDocDate });
            setPreviewUrl(URL.createObjectURL(blob));
        } catch (err) { notify.error("สร้าง PDF ไม่สำเร็จ: " + err); }
        finally { setLoadingPdf(false); }
    };

    const handleCreateDoc = async () => {
        setLoadingDoc(true);
        try {
            const { deanName, deanPosition, emblem } = await loadLetterAssets();
            const studentName = `${thaiPrefix(student.prefix)}${student.firstName} ${student.lastName}`;
            const html = buildPlacementLetterHtml({
                docNumber: placeDocNumber, docDate: placeDocDate, studentName,
                studentId: student.studentId, major: letterMajorName(student),
                companyName: student.coop?.company?.name || "....",
                companyRecipient: recipientText(letterRecipient(student.coop)) || undefined,
                startDate, endDate, deanName, deanPosition,
                students: members ? members.map(toLetterStudent) : undefined,
            });
            setDocDraft({ blob: createWordBlob(html, emblem), docNumber: placeDocNumber, docDate: placeDocDate });
            setPreviewUrl(URL.createObjectURL(createPreviewBlob(html, emblem)));
        } catch (err) { notify.error("สร้าง Word ไม่สำเร็จ: " + err); }
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
        const docNo = normalizeDocNumber(placeDocNumber);
        if (!docNo || /[.]{3,}|x{3,}/i.test(docNo) || !/\/\s*\S/.test(docNo)) {
            return notify.warning("กรุณากรอกเลขที่หนังสือส่งตัวให้ครบก่อนบันทึก (ใส่เลขต่อท้าย / เช่น 660301.26.6.2/1234)");
        }
        if (!signedFile) return notify.warning("กรุณาอัปโหลดไฟล์ที่ลงนามแล้วก่อนบันทึกเข้าระบบ");
        if (!(await confirmMatchesDraft(pending.draftNumber, docNo))) return;
        if (!(await askConfirm("ยืนยันการบันทึกข้อมูล และอัปเดตสถานะให้นักศึกษา?", { confirmLabel: "บันทึก" }))) return;
        try {
            const formData = new FormData();
            if (members) {
                formData.append("letter", "PLACEMENT");
                formData.append("studentIds", JSON.stringify(members.map(m => m.id)));
                formData.append("docNumber", docNo);
                formData.append("docDate", placeDocDate);
            }
            formData.append("studentId", student.id);
            formData.append("status", "PLACEMENT_LETTER_ISSUED");
            formData.append("docType", "PLACEMENT_LETTER");
            const msg = deliveryMethod === "STUDENT"
                ? `เจ้าหน้าที่ออกหนังสือส่งตัวแล้ว ให้นักศึกษามารับเอกสารตัวจริงที่คณะ หรือดาวน์โหลดไปยื่นบริษัทในวันรายงานตัว`
                : `เจ้าหน้าที่ออกหนังสือส่งตัวและจัดส่งให้บริษัทล่วงหน้าเรียบร้อยแล้ว`;
            formData.append("comment", msg);
            formData.append("deliveryMethod", deliveryMethod);
            formData.append("placeDocNumber", docNo);
            formData.append("placeDocDate", placeDocDate);
            formData.append("file", signedFile);
            const res = await apiFetch(members ? "/api/admin/t000/letter-batch" : "/api/admin/t000/review", { method: "PUT", body: formData });
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || `Server error ${res.status}`); }
            notify.success("✅ บันทึกเข้าระบบเรียบร้อย");
            onSuccess();
        } catch (err: any) { notify.error(`❌ เกิดข้อผิดพลาด: ${err.message || err}`); }
    };

    return (
        <div className="letter-modal-backdrop" style={{ zIndex: 10000 }}>
            <div className="letter-modal-card" style={{ width: '95%', maxWidth: 1200, height: '90vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #eee', flexShrink: 0 }}>
                    <h3 style={{ margin: 0 }}>📄 ออกหนังสือส่งตัวฝึกสหกิจ{members ? ` (รวม ${members.length} คน)` : ""}</h3>
                    <button onClick={onClose} className="modal-close" aria-label="ปิด">&times;</button>
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
                        {!members && batchMates && (sharesDraft(batchMates, student.coop?.placeLetterDraftNumber, "placeLetterDraftNumber")
                            ? <LetterBatchNotice mates={batchMates} docNumber={student.coop?.placeLetterDraftNumber} draft onOpenBatch={onOpenBatch} />
                            : <LetterBatchNotice mates={batchMates} docNumber={student.coop?.placeDocNumber} onOpenBatch={onOpenBatch} />)}
                        {members && (
                            <div style={{ padding: '10px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, color: '#1e3a8a' }}>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>👥 หนังสือส่งตัวรวม {members.length} คน · {student.coop?.company?.name || ""}</div>
                                {members.map((m: any) => <div key={m.id}>• {m.studentId} {m.firstName} {m.lastName}</div>)}
                                <div style={{ marginTop: 4, color: '#475569' }}>เลขที่และไฟล์ลงนามเดียวกันทุกคน · วันฝึกของแต่ละคนอยู่ท้ายชื่อในหนังสือ</div>
                            </div>
                        )}
                        <div>
                            <div style={sec}>1. ข้อมูลหนังสือ</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                                <div>
                                    <label style={lbl}>เลขที่หนังสือ</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ whiteSpace: 'nowrap', opacity: .7 }}>ที่ อว</span>
                                        <input className="input" style={{ flex: 1 }} value={placeDocNumber}
                                            onChange={e => setPlaceDocNumber(e.target.value)} placeholder="660301.26.6.2/1234" />
                                    </div>
                                </div>
                                <div><label style={lbl}>วันที่ออกหนังสือ</label><DateInput className="input" value={placeDocDate} onChange={e => setPlaceDocDate(e.target.value)} /></div>
                            </div>
                        </div>
                        <div>
                            <div style={{ ...sec, borderColor: '#f59e0b' }}>2. สร้างเอกสาร</div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <button className="btn-secondary" style={{ flex: 1 }} onClick={handleCreatePdf} disabled={loadingPdf || loadingDoc}>{loadingPdf ? <BusyLabel text="กำลังสร้าง…" /> : '📄 PDF'}</button>
                                <button className="btn-secondary" style={{ flex: 1 }} onClick={handleCreateDoc} disabled={loadingPdf || loadingDoc}>{loadingDoc ? <BusyLabel text="กำลังสร้าง…" /> : '📝 Word'}</button>
                            </div>
                            {(pdfDraft || docDraft) && (
                                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {pdfDraft && <FileReady label="PDF" onDownload={() => downloadDraft(pdfDraft, `Placement_${members ? `รวม${members.length}คน_${student.studentId}` : student.studentId}.pdf`)} />}
                                    {docDraft && <FileReady label="Word (.doc)" onDownload={() => downloadDraft(docDraft, `Placement_${members ? `รวม${members.length}คน_${student.studentId}` : student.studentId}.doc`)} />}
                                </div>
                            )}
                            <p style={{ fontSize: 11, color: '#64748b', margin: '6px 0 0' }}>ตัวอย่างแสดงด้านซ้าย · กดโหลดร่างไปเสนอลงนาม → ขึ้นสถานะ "รอลงนาม"</p>
                        </div>
                        <div>
                            <div style={{ ...sec, borderColor: '#ef4444' }}>3. แนบไฟล์ที่ลงนามแล้ว <span style={{ color: '#ef4444' }}>*</span></div>
                            <div style={{ marginTop: 8 }}>
                                <input type="file" id="signed-file-placement" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                                    onChange={e => setSignedFile(e.target.files?.[0] || null)} />
                                <label htmlFor="signed-file-placement" className="btn-secondary" style={{ width: '100%', boxSizing: 'border-box' }}>
                                    {signedFile ? `📎 ${signedFile.name}` : '📤 เลือกไฟล์ที่ลงนามแล้ว'}
                                </label>
                                {signedFile && (
                                    <button type="button" className="btn-danger-outline small" style={{ marginTop: 6 }} onClick={() => setSignedFile(null)}>🗑️ ลบไฟล์ที่เลือก</button>
                                )}
                                <p style={{ fontSize: 11, color: '#64748b', margin: '6px 0 0' }}>ต้องอัปโหลดไฟล์ที่ลงนามแล้วก่อน จึงจะบันทึกเข้าระบบได้ — ไฟล์นี้จะถูกใช้แทนไฟล์ร่างด้านบนทั้งหมด</p>
                            </div>
                        </div>
                        <div>
                            <div style={{ ...sec, borderColor: '#10b981' }}>4. การจัดส่งเอกสาร</div>
                            <RecipientNotice coop={student.coop} />
                            <DeliveryPicker value={deliveryMethod} onChange={setDeliveryMethod} name="delivery-placement" />
                            {deliveryMethod === "STAFF" && <CompanyAddressBox company={student.coop?.company} coop={student.coop} />}
                        </div>
                        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                            <button className="btn" onClick={handleConfirm} disabled={!signedFile} style={{ width: '100%' }}>🚀 บันทึกเข้าระบบ & แจ้งนักศึกษา</button>
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
