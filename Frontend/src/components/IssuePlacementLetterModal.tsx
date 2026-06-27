// Frontend/src/components/IssuePlacementLetterModal.tsx
import React, { useState } from "react";
import { createPlacementPDF } from "../utils/pdfGeneratorPlacement";
import { createWordBlob, createPreviewBlob, buildPlacementLetterHtml, thaiPrefix } from "../utils/docGeneratorUtils";
import { FileReady, DeliveryPicker, MODAL_CSS } from "./LetterModalShared";

interface Props { student: any; onClose: () => void; onSuccess: () => void; }

export default function IssuePlacementLetterModal({ student, onClose, onSuccess }: Props) {
    const [placeDocNumber, setPlaceDocNumber] = useState("อว 660301.26.6.2/xxxx");
    const [placeDocDate, setPlaceDocDate] = useState(new Date().toISOString().split("T")[0]);
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
            fetch("/api/admin/config/dean-info", { headers: { Authorization: `Bearer ${localStorage.getItem("coop.token")}` } }),
        ]);
        const assets = (await resAssets.json()).assets || [];
        const getAsset = (key: string) => { const f = assets.find((a: any) => a.key === key); return f ? `/uploads/system/${f.path}` : null; };
        let deanName = "รองศาสตราจารย์สิรภัทร เชี่ยวชาญวัฒนา";
        let deanPosition = "คณบดีวิทยาลัยการคอมพิวเตอร์";
        if (resDean.ok) { const d = await resDean.json(); if (d.deanName) deanName = d.deanName; if (d.deanPosition) deanPosition = d.deanPosition; }
        return { getAsset, deanName, deanPosition };
    };

    const handleCreatePdf = async () => {
        setLoadingPdf(true);
        try {
            const { getAsset, deanName, deanPosition } = await loadCommonData();
            const krutUrl = getAsset("KRUT");
            if (!krutUrl) return alert("⚠️ ไม่พบไฟล์ตราครุฑ (KRUT) กรุณาอัปโหลดในหน้าตั้งค่า");
            const doc = await createPlacementPDF(
                student, { placeDocNumber, placeDocDate, actualStartDate: startDate, actualEndDate: endDate },
                "", krutUrl, deanName, deanPosition
            );
            const blob = doc.output("blob");
            setPdfBlob(blob);
            setPreviewUrl(URL.createObjectURL(blob));
        } catch (err) { alert("สร้าง PDF ไม่สำเร็จ: " + err); }
        finally { setLoadingPdf(false); }
    };

    const handleCreateDoc = async () => {
        setLoadingDoc(true);
        try {
            const { deanName, deanPosition } = await loadCommonData();
            const studentName = `${thaiPrefix(student.prefix)}${student.firstName} ${student.lastName}`;
            const html = buildPlacementLetterHtml({
                docNumber: placeDocNumber, docDate: placeDocDate, studentName,
                studentId: student.studentId, major: student.major || "วิทยาการคอมพิวเตอร์",
                companyName: student.coop?.company?.name || "....",
                startDate, endDate, deanName, deanPosition,
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
        if (!signedFile) return alert("กรุณาอัปโหลดไฟล์ที่ลงนามแล้วก่อนบันทึกเข้าระบบ");
        if (!confirm("ยืนยันการบันทึกข้อมูล และอัปเดตสถานะให้นักศึกษา?")) return;
        try {
            const formData = new FormData();
            formData.append("studentId", student.id);
            formData.append("status", "PLACEMENT_LETTER_ISSUED");
            formData.append("docType", "PLACEMENT_LETTER");
            const msg = deliveryMethod === "STUDENT"
                ? `เจ้าหน้าที่ออกหนังสือส่งตัวแล้ว ให้นักศึกษามารับเอกสารตัวจริงที่คณะ หรือดาวน์โหลดไปยื่นบริษัทในวันรายงานตัว`
                : `เจ้าหน้าที่ออกหนังสือส่งตัวและจัดส่งให้บริษัทล่วงหน้าเรียบร้อยแล้ว`;
            formData.append("comment", msg);
            formData.append("placeDocNumber", placeDocNumber);
            formData.append("placeDocDate", placeDocDate);
            formData.append("file", signedFile);
            const token = localStorage.getItem("coop.token");
            await fetch("/api/admin/t000/review", { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: formData });
            alert("✅ บันทึกเข้าระบบเรียบร้อย");
            onSuccess();
        } catch (err) { alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล"); }
    };

    return (
        <div className="modal-backdrop" style={{ zIndex: 10000 }}>
            <div className="modal-card" style={{ width: '95%', maxWidth: 1200, height: '90vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #eee', flexShrink: 0 }}>
                    <h3 style={{ margin: 0 }}>📄 ออกหนังสือส่งตัวฝึกสหกิจ</h3>
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
                        <div>
                            <div style={sec}>1. ข้อมูลหนังสือ</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                                <div><label style={lbl}>เลขที่หนังสือ</label><input className="input" value={placeDocNumber} onChange={e => setPlaceDocNumber(e.target.value)} /></div>
                                <div><label style={lbl}>วันที่ออกหนังสือ</label><input type="date" className="input" value={placeDocDate} onChange={e => setPlaceDocDate(e.target.value)} /></div>
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
                                    {pdfBlob && <FileReady label="PDF" onDownload={() => download(pdfBlob, `Placement_${student.studentId}.pdf`)} />}
                                    {docBlob && <FileReady label="Word (.doc)" onDownload={() => download(docBlob, `Placement_${student.studentId}.doc`)} />}
                                </div>
                            )}
                            <p style={{ fontSize: 11, color: '#94a3b8', margin: '6px 0 0' }}>ตัวอย่างแสดงด้านซ้าย · ลงนามจริงก่อนส่ง</p>
                        </div>
                        <div>
                            <div style={{ ...sec, borderColor: '#ef4444' }}>3. แนบไฟล์ที่ลงนามแล้ว <span style={{ color: '#ef4444' }}>*</span></div>
                            <div style={{ marginTop: 8 }}>
                                <input type="file" id="signed-file-placement" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                                    onChange={e => setSignedFile(e.target.files?.[0] || null)} />
                                <label htmlFor="signed-file-placement" className="btn btn-outline" style={{ width: '100%', display: 'block', textAlign: 'center', cursor: 'pointer', boxSizing: 'border-box' }}>
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
                            <DeliveryPicker value={deliveryMethod} onChange={setDeliveryMethod} name="delivery-placement" />
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
