import LetterBatchNotice, { sharesDraft } from "./LetterBatchNotice";
import Spinner, { BusyLabel } from "./Spinner";
import React, { useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { createDispatchPDF, createDispatchAttachmentsPDF, type AttachmentReport } from "../utils/pdfDispatchGenerator";
import { createWordBlob, createPreviewBlob, buildDispatchLetterHtml, thaiPrefix, normalizeDocNumber } from "../utils/docGeneratorUtils";
import { FileReady, DeliveryPicker, CompanyAddressBox, RecipientNotice, MODAL_CSS, useLetterPending, LetterPendingBanner, confirmMatchesDraft, type LetterDraft } from "./LetterModalShared";
import DateInput from './DateInput';
import { notify, askConfirm } from "../utils/notify";
import { letterRecipient, recipientText } from "../utils/letterRecipient";
import { toLetterStudent } from "../utils/letterGroup";
import { loadLetterAssets, existingAttachmentFiles } from "../utils/letterAssets";

interface Props {
    student: any;
    // หนังสือรวมหลายคน (บริษัทเดียวกัน) — student = คนแรกของกลุ่ม (ใช้บริษัท/ผู้รับ) · ไม่ส่ง = หนังสือเดี่ยว
    group?: any[];
    // หนังสือเดี่ยวของคนที่อยู่ในหนังสือรวม — เพื่อนในฉบับเดิม + เปิดหนังสือรวมทั้งฉบับ
    batchMates?: any[];
    onOpenBatch?: () => void;
    onClose: () => void;
    onSuccess: () => void;
}

export default function IssueLetterModal({ student, group, batchMates, onOpenBatch, onClose, onSuccess }: Props) {
    const members = group && group.length > 1 ? group : null;
    const pending = useLetterPending({ record: student.coop, prefix: "reqLetter", endpoint: "/api/admin/t000/letter-pending", body: members ? { studentIds: members.map(m => m.id), letter: "REQUEST" } : { studentId: student.id, letter: "REQUEST" } });
    // เก็บเฉพาะตัวเลข — คำนำหน้า "ที่ อว" ถูกเติมในเทมเพลตหนังสือแล้ว · มีร่างที่รอลงนามอยู่ → เติมเลขที่/วันที่ของร่างนั้น
    const [docNumber, setDocNumber] = useState(pending.draftNumber || "660301.26.6.2/");
    const [docDate, setDocDate] = useState(pending.draftDate || new Date().toISOString().split('T')[0]);
    const [loadingPdf, setLoadingPdf] = useState(false);
    const [loadingDoc, setLoadingDoc] = useState(false);
    const [pdfDraft, setPdfDraft] = useState<LetterDraft | null>(null);
    const [docDraft, setDocDraft] = useState<LetterDraft | null>(null);
    // แบบ Word: เอกสารแนบรวมเล่มเป็น PDF อีกไฟล์ (แบบเดียวกับออกร่างหลายคน) — เดิมโหลด Word แล้วไม่ได้เอกสารแนบ
    const [attachDraft, setAttachDraft] = useState<Blob | null>(null);
    // ข้อความกำลังทำงาน — รวมเอกสารแนบใช้เวลาหลายวินาที (ตัวอย่างขึ้นก่อน) ผู้ใช้ต้องรู้ว่ายังไม่เสร็จ อย่าเพิ่งปิด
    const [busyMsg, setBusyMsg] = useState("");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    // พิมพ์ซ้ำ → ใช้วิธีจัดส่งที่เลือกไว้ครั้งก่อน
    const [deliveryMethod, setDeliveryMethod] = useState<"STUDENT" | "STAFF">(student.coop?.reqLetterDelivery === "STAFF" ? "STAFF" : "STUDENT");
    const [signedFile, setSignedFile] = useState<File | null>(null);

    const startDate = student.coop?.actualStartDate || student.coopApplicationForm?.startDate || "";
    const endDate = student.coop?.actualEndDate || student.coopApplicationForm?.endDate || "";
    // หนังสือรวม: ทุกคนต้องมีวันฝึก (วันต่างกันได้ — ใส่ท้ายชื่อแต่ละคน)
    const missingDates = (members || [student]).filter(m => !(m.coop?.actualStartDate || m.coopApplicationForm?.startDate));
    const missingDatesMsg = missingDates.length ? `ไม่พบวันที่เริ่มฝึกของ ${missingDates.map(m => m.studentId).join(", ")} — นักศึกษาต้องกรอกที่หน้าเอกสารก่อน` : "";

    const handleCreatePdf = async () => {
        if (missingDatesMsg) return notify.warning(missingDatesMsg);
        setLoadingPdf(true);
        setBusyMsg("กำลังสร้าง PDF พร้อมเอกสารแนบทั้งเล่ม — อาจใช้เวลาหลายวินาที อย่าเพิ่งปิดหน้าต่าง");
        try {
            const { krutUrl, projectUrl, acceptUrl, deanName, deanPosition } = await loadLetterAssets();
            if (!krutUrl) return notify.error("⚠️ ไม่พบไฟล์ตราสัญลักษณ์มหาวิทยาลัย กรุณาอัปโหลดในหน้าตั้งค่า");

            const profile = { ...student, coop: { ...student.coop, actualStartDate: startDate, actualEndDate: endDate } };
            // หนังสือรวม: แนบเอกสารของทุกคนเรียงตามรายชื่อ · ไม่แนบเอกสารจากขั้นหลัง (ดู letterAttachmentDocs)
            const { files: studentFiles, missing } = await existingAttachmentFiles(members || [student]);
            if (missing.length > 0) {
                const names = missing.join("\n• ");
                const proceed = (await askConfirm(`⚠️ พบเอกสาร ${missing.length} ไฟล์ที่ไม่พบบนเซิร์ฟเวอร์ (อาจเป็นไฟล์เก่าที่ถูกลบ):\n• ${names}\n\nสร้าง PDF ต่อโดยข้ามไฟล์ที่หายไป?`, { title: "ไฟล์แนบบางไฟล์หายไป", confirmLabel: "สร้าง PDF ต่อ" }));
                if (!proceed) return;
            }
            const blob = await createDispatchPDF(
                profile, docNumber, docDate, krutUrl,
                projectUrl || "", acceptUrl || "",
                studentFiles, deanName, deanPosition,
                members ? members.map(toLetterStudent) : undefined
            );
            setPdfDraft({ blob, docNumber, docDate });
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
                    } catch (err) { notify.error("สร้าง PDF ไม่สำเร็จ: " + err); }
        finally { setLoadingPdf(false); setBusyMsg(""); }
    };

    const handleCreateDoc = async () => {
        if (missingDatesMsg) return notify.warning(missingDatesMsg);
        setLoadingDoc(true);
        setBusyMsg("กำลังสร้าง Word…");
        try {
            const { deanName, deanPosition, emblem, projectUrl, acceptUrl } = await loadLetterAssets();
            const studentName = `${thaiPrefix(student.prefix)}${student.firstName} ${student.lastName}`;
            const html = buildDispatchLetterHtml({
                docNumber, docDate, studentName,
                studentId: student.studentId,
                studyProgram: student.studyProgram,
                major: student.major,
                majorNameTh: student.majorNameTh,
                companyName: student.coop?.company?.name || "....",
                companyContact: recipientText(letterRecipient(student.coop)) || undefined,
                startDate, endDate, deanName, deanPosition,
                students: members ? members.map(toLetterStudent) : undefined,
            });
            setDocDraft({ blob: createWordBlob(html, emblem), docNumber, docDate });
            // preview doc ใน iframe ด้วย HTML blob
            setPreviewUrl(URL.createObjectURL(createPreviewBlob(html, emblem)));

            // เอกสารแนบ: รายละเอียดโครงการ → เอกสารนักศึกษา → แบบฟอร์มตอบรับ (ตัวรวมเดียวกับ PDF/ออกร่างหลายคน)
            setAttachDraft(null);
            setBusyMsg("สร้าง Word เสร็จแล้ว · กำลังรวมเอกสารแนบ (PDF) — อาจใช้เวลาหลายวินาที อย่าเพิ่งปิดหน้าต่าง");
            const attach = await existingAttachmentFiles(members || [student]);
            const report: AttachmentReport = { skipped: [], pages: 0 };
            const attachments = await createDispatchAttachmentsPDF(projectUrl || "", acceptUrl || "", attach.files, report);
            const lost = [...attach.missing, ...report.skipped];
            if (report.pages > 0) setAttachDraft(attachments);
            if (report.pages === 0) notify.warning("ไม่มีเอกสารแนบที่รวมได้เลย — ไม่ได้สร้างไฟล์เอกสารแนบ");
            else if (lost.length) notify.warning(`เอกสารแนบขาด ${lost.length} ไฟล์ (ไม่พบหรือเปิดไม่ได้): ${lost.join(", ")}`);
                    } catch (err) { notify.error("สร้าง Word ไม่สำเร็จ: " + err); }
        finally { setLoadingDoc(false); setBusyMsg(""); }
    };

    // ปิดหน้าต่างระหว่างสร้างไฟล์ = ไฟล์ที่กำลังสร้างหาย → ถามก่อน
    const handleClose = async () => {
        if (loadingPdf || loadingDoc) {
            const ok = await askConfirm("ระบบกำลังสร้างไฟล์อยู่ ถ้าปิดตอนนี้จะไม่ได้ไฟล์ที่กำลังสร้าง ปิดหน้าต่างเลยไหม?", { title: "ยังสร้างไฟล์ไม่เสร็จ", confirmLabel: "ปิดเลย", cancelLabel: "รอให้เสร็จ", danger: true });
            if (!ok) return;
        }
        onClose();
    };

    const download = (blob: Blob, name: string) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = name;
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
            return notify.warning("กรุณากรอกเลขที่หนังสือให้ครบก่อนบันทึก (ใส่เลขต่อท้าย / เช่น 660301.26.6.2/1234)");
        }
        if (!signedFile) return notify.warning("กรุณาอัปโหลดไฟล์ที่ลงนามแล้วก่อนบันทึกเข้าระบบ");
        if (!(await confirmMatchesDraft(pending.draftNumber, docNo))) return;
        if (!(await askConfirm("ยืนยันการบันทึกข้อมูล และอัปเดตสถานะให้นักศึกษา?", { confirmLabel: "บันทึก" }))) return;
        try {
            const formData = new FormData();
            if (members) {
                formData.append("letter", "REQUEST");
                formData.append("studentIds", JSON.stringify(members.map(m => m.id)));
                formData.append("docNumber", docNo);
                formData.append("docDate", docDate);
            }
            formData.append("studentId", student.id);
            formData.append("status", "REQ_LETTER_ISSUED");
            formData.append("docType", "DISPATCH_LETTER");
            const msg = deliveryMethod === "STUDENT"
                ? `เจ้าหน้าที่ออกหนังสือแล้ว ให้นักศึกษามารับเอกสารตัวจริงที่คณะ หรือดาวน์โหลดไฟล์เพื่อนำไปยื่นบริษัทด้วยตนเอง`
                : `เจ้าหน้าที่ออกหนังสือและได้จัดส่งให้บริษัททางไปรษณีย์/อีเมลเรียบร้อยแล้ว`;
            formData.append("comment", msg);
            formData.append("deliveryMethod", deliveryMethod);
            formData.append("reqDocNumber", docNo);
            formData.append("reqDocDate", docDate);
            formData.append("file", signedFile);
            const res = await apiFetch(members ? "/api/admin/t000/letter-batch" : "/api/admin/t000/review", { method: "PUT", body: formData });
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || `Server error ${res.status}`); }
            notify.success("✅ บันทึกและจัดเก็บไฟล์เรียบร้อย");
            onSuccess();
        } catch (err: any) { notify.error(`❌ เกิดข้อผิดพลาด: ${err.message || err}`); }
    };

    return (
        <div className="letter-modal-backdrop" style={{ zIndex: 10000 }}>
            <div className="letter-modal-card" style={{ width: '95%', maxWidth: 1200, height: '90vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #eee', flexShrink: 0 }}>
                    <h3 style={{ margin: 0 }}>📄 ออกหนังสือขอความอนุเคราะห์{members ? ` (รวม ${members.length} คน)` : ""}</h3>
                    <button onClick={handleClose} className="modal-close" aria-label="ปิด">&times;</button>
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
                        <LetterPendingBanner {...pending} onCancel={pending.cancelPending} />
                        {!members && batchMates && (sharesDraft(batchMates, student.coop?.reqLetterDraftNumber, "reqLetterDraftNumber")
                            ? <LetterBatchNotice mates={batchMates} docNumber={student.coop?.reqLetterDraftNumber} draft onOpenBatch={onOpenBatch} />
                            : <LetterBatchNotice mates={batchMates} docNumber={student.coop?.reqDocNumber} onOpenBatch={onOpenBatch} />)}
                        {members && (
                            <div style={{ padding: '10px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, color: '#1e3a8a' }}>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>👥 หนังสือขอความอนุเคราะห์รวม {members.length} คน · {student.coop?.company?.name || ""}</div>
                                {members.map((m: any) => <div key={m.id}>• {m.studentId} {m.firstName} {m.lastName}</div>)}
                                <div style={{ marginTop: 4, color: '#475569' }}>เลขที่และไฟล์ลงนามเดียวกันทุกคน</div>
                            </div>
                        )}
                        {missingDatesMsg && (
                            <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 8, border: '1px solid #fca5a5', fontSize: 13, color: '#991b1b', fontWeight: 600 }}>
                                ⚠️ {missingDatesMsg}
                            </div>
                        )}

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
                            <div style={{ fontSize: 11, color: '#475569', marginTop: 6, lineHeight: 1.6 }}>
                                📄 <b>PDF</b> = หนังสือ + เอกสารแนบรวมเป็นไฟล์เดียว พร้อมพิมพ์<br />
                                📝 <b>Word</b> = หนังสือ (แก้ไขได้) + เอกสารแนบ (PDF) อีกไฟล์ — พิมพ์หนังสือแล้วตามด้วยเอกสารแนบ
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleCreatePdf} disabled={loadingPdf || loadingDoc}>
                                    {loadingPdf ? <BusyLabel text="กำลังสร้าง…" /> : '📄 PDF'}
                                </button>
                                <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleCreateDoc} disabled={loadingPdf || loadingDoc}>
                                    {loadingDoc ? <BusyLabel text="กำลังสร้าง…" /> : '📝 Word'}
                                </button>
                            </div>
                            {(pdfDraft || docDraft) && (
                                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {pdfDraft && <FileReady label="PDF" onDownload={() => downloadDraft(pdfDraft, `Dispatch_${members ? `รวม${members.length}คน_${student.studentId}` : student.studentId}.pdf`)} />}
                                    {docDraft && <FileReady label="Word (.doc)" onDownload={() => downloadDraft(docDraft, `Dispatch_${members ? `รวม${members.length}คน_${student.studentId}` : student.studentId}.doc`)} />}
                                    {docDraft && attachDraft && <FileReady label="เอกสารแนบ (PDF)" onDownload={() => download(attachDraft, `Dispatch_${members ? `รวม${members.length}คน_${student.studentId}` : student.studentId}-เอกสารแนบ.pdf`)} />}
                                </div>
                            )}
                            {busyMsg && (
                                <div role="status" aria-live="polite" style={{ marginTop: 8, padding: '8px 10px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 12, color: '#92400e', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                    <span style={{ paddingTop: 2 }}><Spinner size={14} /></span>
                                    <span>{busyMsg}</span>
                                </div>
                            )}
                            <p style={{ fontSize: 11, color: '#64748b', margin: '6px 0 0' }}>ตัวอย่างแสดงด้านซ้าย · กดโหลดร่างไปเสนอลงนาม → ขึ้นสถานะ "รอลงนาม"</p>
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
                                <p style={{ fontSize: 11, color: '#64748b', margin: '6px 0 0' }}>ต้องอัปโหลดไฟล์ที่ลงนามแล้วก่อน จึงจะบันทึกเข้าระบบได้ — ไฟล์นี้จะถูกใช้แทนไฟล์ร่างด้านบนทั้งหมด</p>
                            </div>
                        </div>

                        <div>
                            <div style={{ ...sec, borderColor: '#10b981' }}>4. การจัดส่งเอกสาร</div>
                            <RecipientNotice coop={student.coop} />
                            <DeliveryPicker value={deliveryMethod} onChange={setDeliveryMethod} name="delivery-dispatch" />
                            {deliveryMethod === "STAFF" && <CompanyAddressBox company={student.coop?.company} coop={student.coop} />}
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
