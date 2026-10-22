import React, { useMemo, useRef, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { notify, askConfirm } from "../utils/notify";
import { DeliveryPicker, MODAL_CSS } from "./LetterModalShared";
import { thaiPrefix, toThaiDate } from "../utils/docGeneratorUtils";
import {
    groupPending, matchFiles, signedLetterRequest, LETTER_FILE_LABEL,
    type BulkLetterType, type Delivery, type PendingLetter,
} from "../utils/bulkLetters";

// กติกาไฟล์เดียวกับ backend/middlewares/uploadMiddleware.js + utils/fileFilters.js
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 100;
const ALLOWED_EXT = /\.(pdf|jpe?g|png|gif|webp|bmp)$/i;

const smallBtn: React.CSSProperties = { fontSize: 12, padding: "2px 8px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", cursor: "pointer" };
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 800, margin: "0 0 8px", color: "#0f172a" };
const box: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#fff" };
const selectStyle: React.CSSProperties = { fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "1px solid #cbd5e1", maxWidth: "100%", minWidth: 0 };

const nameOf = (s: any) => `${thaiPrefix(s.prefix)}${s.firstName ?? ""} ${s.lastName ?? ""}`.trim();
const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

interface Item { id: string; file: File }
type Result = { ok: boolean; message?: string; fileId: string };

let seq = 0;

export default function BulkSignedUploadModal({ students, onClose }: { students: any[]; onClose: () => void }) {
    const [letter, setLetter] = useState<BulkLetterType>("REQUEST");
    const [delivery, setDelivery] = useState<Delivery>("STUDENT");
    const [rowDelivery, setRowDelivery] = useState<Record<string, Delivery>>({});
    const [items, setItems] = useState<Item[]>([]);
    // เลือกเอง: `${letter}|${fileId}` -> letterKey (ผูกเอง) | null (ถอดออกจากฉบับ)
    const [manual, setManual] = useState<Record<string, string | null>>({});
    const [rejected, setRejected] = useState<string[]>([]);
    const [results, setResults] = useState<Record<string, Result>>({}); // `${letter}|${letterKey}`
    const [busy, setBusy] = useState(false);
    const [summary, setSummary] = useState<{ ok: number; fail: number } | null>(null);
    const [dragging, setDragging] = useState(false);
    const savingRef = useRef(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const rk = (key: string) => `${letter}|${key}`;
    const allLetters = useMemo(() => groupPending(students, letter), [students, letter]);
    const isDone = (key: string) => !!results[rk(key)]?.ok;
    // ไฟล์ที่ใช้ไปแล้ว (บันทึกสำเร็จ) ไม่เข้าไปจับคู่อีก
    const consumed = new Set(Object.values(results).filter(r => r.ok).map(r => r.fileId));
    const pool = items.filter(i => !consumed.has(i.id));
    const openLetters = allLetters.filter(l => !isDone(l.key));
    const matches = useMemo(() => matchFiles(pool.map(i => i.file), openLetters), [pool.map(i => i.id).join(","), letter, allLetters, results]); // eslint-disable-line react-hooks/exhaustive-deps

    // ผูกเอง > ผูกอัตโนมัติ · หนึ่งฉบับหนึ่งไฟล์
    const { assign, fileState } = useMemo(() => {
        const assign: Record<string, string> = {}; // letterKey -> fileId
        const fileState: Record<string, { letterKey: string | null; reason: string | null }> = {};
        const validKeys = new Set(openLetters.filter(l => l.docNumber != null).map(l => l.key));
        pool.forEach(i => {
            const m = manual[`${letter}|${i.id}`];
            if (m && validKeys.has(m) && !assign[m]) { assign[m] = i.id; fileState[i.id] = { letterKey: m, reason: null }; }
        });
        pool.forEach((i, idx) => {
            if (fileState[i.id]) return;
            const key = `${letter}|${i.id}`;
            const auto = matches[idx];
            if (key in manual && manual[key] === null) fileState[i.id] = { letterKey: null, reason: "ถอดออกจากฉบับแล้ว — เลือกฉบับเอง" };
            else if (auto?.letterKey && !assign[auto.letterKey]) { assign[auto.letterKey] = i.id; fileState[i.id] = { letterKey: auto.letterKey, reason: null }; }
            else if (auto?.letterKey) fileState[i.id] = { letterKey: null, reason: "ฉบับนี้ถูกเลือกไฟล์อื่นไว้แล้ว" };
            else fileState[i.id] = { letterKey: null, reason: auto?.reason ?? "ยังไม่ได้ผูก" };
        });
        return { assign, fileState };
    }, [pool.map(i => i.id).join(","), matches, manual, letter, allLetters, results]); // eslint-disable-line react-hooks/exhaustive-deps

    const itemById = (id: string) => items.find(i => i.id === id);
    const unassigned = pool.filter(i => !fileState[i.id]?.letterKey);
    const toSave = openLetters.filter(l => l.docNumber != null && assign[l.key]);
    const doneCount = allLetters.filter(l => isDone(l.key)).length;
    const deliveryOf = (key: string) => rowDelivery[`${letter}|${key}`] ?? delivery;

    const addFiles = (list: FileList | File[]) => {
        const incoming = Array.from(list);
        if (!incoming.length) return;
        const rej: string[] = [];
        const have = new Set(items.map(i => fileKey(i.file)));
        const next: Item[] = [];
        let room = MAX_FILES - items.length;
        for (const f of incoming.slice(0, MAX_FILES + 200)) {
            if (!ALLOWED_EXT.test(f.name)) { rej.push(`${f.name} — ชนิดไฟล์ไม่รองรับ (รับ PDF และรูปภาพเท่านั้น)`); continue; }
            if (f.size > MAX_BYTES) { rej.push(`${f.name} — ไฟล์ใหญ่เกิน 50 MB`); continue; }
            if (f.size === 0) { rej.push(`${f.name} — ไฟล์ว่าง`); continue; }
            if (have.has(fileKey(f))) continue; // วางซ้ำไฟล์เดิม — ข้าม
            if (room <= 0) { rej.push(`${f.name} — เกิน ${MAX_FILES} ไฟล์ต่อครั้ง`); continue; }
            have.add(fileKey(f)); room--;
            next.push({ id: `f${++seq}`, file: f });
        }
        setRejected(rej);
        setSummary(null);
        if (next.length) setItems(prev => [...prev, ...next]);
    };

    const removeFile = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

    const setLetterFile = (letterKey: string, fileId: string) => {
        setSummary(null);
        setManual(m => {
            const next = { ...m };
            const cur = assign[letterKey];
            if (cur) next[`${letter}|${cur}`] = null;
            if (fileId) next[`${letter}|${fileId}`] = letterKey;
            return next;
        });
    };

    const changeLetter = (l: BulkLetterType) => { setLetter(l); setSummary(null); };

    const handleSave = async () => {
        if (savingRef.current || !toSave.length) return;
        const ok = await askConfirm(`บันทึก ${toSave.length} ฉบับ? นักศึกษาจะได้รับแจ้งเตือน`, { title: "บันทึกฉบับลงนาม", confirmLabel: "บันทึก" });
        if (!ok || savingRef.current) return;
        savingRef.current = true;
        setBusy(true); setSummary(null);
        const type = letter;
        let okN = 0, failN = 0;
        for (const l of toSave) {
            const fid = assign[l.key];
            const item = itemById(fid);
            if (!item || l.docNumber == null) continue;
            const { url, body } = signedLetterRequest(type, l, deliveryOf(l.key), item.file);
            let r: Result;
            try {
                const res = await apiFetch(url, { method: "PUT", body });
                const data = await res.json().catch(() => ({}));
                r = res.ok ? { ok: true, fileId: fid } : { ok: false, fileId: fid, message: data?.message || `บันทึกไม่สำเร็จ (${res.status})` };
            } catch (err: any) {
                r = { ok: false, fileId: fid, message: err?.message || "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" };
            }
            if (r.ok) okN++; else failN++;
            setResults(prev => ({ ...prev, [`${type}|${l.key}`]: r }));
        }
        savingRef.current = false;
        setBusy(false);
        setSummary({ ok: okN, fail: failN });
        if (failN === 0) notify.success(`✅ บันทึก ${okN} ฉบับแล้ว`);
    };

    const canSave = !busy && toSave.length > 0;

    const studentLines = (l: PendingLetter<any>) => l.students.map(s => (
        <div key={s.id} style={{ fontSize: 12, color: "#475569", overflowWrap: "anywhere" }}>
            {s.studentId} {nameOf(s)}{s.outsidePeriod ? " (นอกรอบที่เลือก)" : ""}
        </div>
    ));

    return (
        <div className="letter-modal-backdrop" style={{ zIndex: 10000 }}>
            <div className="letter-modal-card" style={{ width: "95%", maxWidth: 900, maxHeight: "92vh", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <h2 style={{ margin: 0, fontSize: 18 }}>อัปโหลดฉบับลงนามหลายฉบับ</h2>
                    <button type="button" onClick={onClose} disabled={busy} style={{ ...smallBtn, fontSize: 14, padding: "4px 12px" }}>ปิด</button>
                </div>

                <div style={{ overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 12, paddingRight: 2 }}>
                    <details open style={{ ...box, background: "#f8fafc" }}>
                        <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 13 }}>วิธีใช้</summary>
                        <ol style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 13, lineHeight: 1.7, color: "#334155" }}>
                            <li>ตั้งชื่อไฟล์สแกนให้ <b>ขึ้นต้นด้วยเลขหนังสือ</b> ระบบจะจับคู่ให้เอง
                                <div style={{ fontSize: 12 }}>
                                    <div>✓ <code>811-บริษัท….pdf</code></div>
                                    <div>✓ <code>660301.26.6.2-811….pdf</code></div>
                                    <div>✗ <code>scan001.pdf</code> — ต้องเลือกฉบับเอง</div>
                                </div>
                            </li>
                            <li>วิธีจัดส่ง: <b>นักศึกษาดาวน์โหลด</b> = นักศึกษาโหลดไฟล์ไปยื่นบริษัทเอง · <b>เจ้าหน้าที่จัดส่งให้บริษัท</b> = เจ้าหน้าที่ส่งให้บริษัทแล้ว (เลือกครั้งเดียวทั้งชุด เปลี่ยนรายฉบับได้)</li>
                            <li>กดบันทึกแล้ว: หนังสือเข้าระบบ · สถานะนักศึกษาเปลี่ยน · ป้าย "รอลงนาม" หาย · <b>นักศึกษาได้รับแจ้งเตือน</b> · ฉบับที่ไม่สำเร็จค้างไว้ให้ลองใหม่</li>
                        </ol>
                    </details>

                    <div style={box}>
                        <p style={sectionTitle}>1. ประเภทหนังสือ</p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {(["REQUEST", "PLACEMENT"] as BulkLetterType[]).map(l => (
                                <button key={l} type="button" disabled={busy} onClick={() => changeLetter(l)}
                                    style={{ ...smallBtn, fontSize: 13, padding: "6px 14px", ...(letter === l ? { background: "#0074b7", color: "#fff", borderColor: "#0074b7" } : {}) }}>
                                    {LETTER_FILE_LABEL[l]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={box}>
                        <p style={sectionTitle}>2. วางไฟล์สแกนฉบับลงนาม</p>
                        <div
                            onDragOver={e => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={e => { e.preventDefault(); setDragging(false); if (!busy) addFiles(e.dataTransfer.files); }}
                            style={{ border: `2px dashed ${dragging ? "#0074b7" : "#cbd5e1"}`, background: dragging ? "#eff6ff" : "#f8fafc", borderRadius: 10, padding: 16, textAlign: "center", fontSize: 13, color: "#475569" }}>
                            <div>ลากไฟล์มาวางที่นี่ (สูงสุด {MAX_FILES} ไฟล์ · PDF/รูป · ไฟล์ละไม่เกิน 50 MB)</div>
                            <button type="button" className="btn btn-secondary" disabled={busy} style={{ marginTop: 8 }} onClick={() => inputRef.current?.click()}>เลือกไฟล์</button>
                            <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp" style={{ display: "none" }}
                                onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
                        </div>
                        {rejected.length > 0 && (
                            <div style={{ marginTop: 8, border: "1px solid #ef4444", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 8, fontSize: 12 }}>
                                <div style={{ fontWeight: 700 }}>ไม่รับ {rejected.length} ไฟล์</div>
                                {rejected.map((r, i) => <div key={i} style={{ overflowWrap: "anywhere" }}>{r}</div>)}
                            </div>
                        )}
                        <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>วิธีจัดส่ง (ใช้กับทุกฉบับ)</div>
                            <DeliveryPicker value={delivery} onChange={setDelivery} name="bulk-signed-delivery" />
                        </div>
                    </div>

                    {unassigned.length > 0 && (
                        <div style={{ ...box, borderColor: "#f59e0b", background: "#fffbeb" }}>
                            <p style={sectionTitle}>ไฟล์ที่ยังไม่ผูกกับฉบับไหน ({unassigned.length})</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {unassigned.map(i => (
                                    <div key={i.id} data-testid="unmatched-file" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                                        <span style={{ flex: "1 1 220px", minWidth: 0, overflowWrap: "anywhere" }}>
                                            <b>{i.file.name}</b>
                                            <span style={{ display: "block", fontSize: 12, color: "#92400e" }}>{fileState[i.id]?.reason}</span>
                                        </span>
                                        <select style={{ ...selectStyle, flex: "1 1 220px" }} value="" disabled={busy}
                                            onChange={e => e.target.value && setLetterFile(e.target.value, i.id)}>
                                            <option value="">เลือกฉบับ…</option>
                                            {openLetters.filter(l => l.docNumber != null && !assign[l.key]).map(l => (
                                                <option key={l.key} value={l.key}>{l.docNumber} · {l.companyName || "ไม่มีบริษัท"}</option>
                                            ))}
                                        </select>
                                        <button type="button" style={smallBtn} disabled={busy} onClick={() => removeFile(i.id)}>เอาไฟล์ออก</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={box}>
                        <p style={sectionTitle}>3. หนังสือรอลงนาม ({allLetters.length} ฉบับ · มีไฟล์ {toSave.length} · บันทึกแล้ว {doneCount})</p>
                        {allLetters.length === 0 ? (
                            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>ไม่มี{LETTER_FILE_LABEL[letter]}ที่รอลงนาม</p>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {allLetters.map(l => {
                                    const res = results[rk(l.key)];
                                    const done = !!res?.ok;
                                    const noNumber = l.docNumber == null;
                                    const fid = done ? res.fileId : assign[l.key];
                                    const cur = fid ? itemById(fid) : undefined;
                                    const border = done ? "#22c55e" : res ? "#ef4444" : "#e2e8f0";
                                    return (
                                        <div key={l.key} data-testid="pending-letter" style={{ border: `1px solid ${border}`, background: done ? "#f0fdf4" : res ? "#fef2f2" : "#f8fafc", borderRadius: 8, padding: 10, opacity: noNumber ? 0.85 : 1 }}>
                                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                                <span style={{ fontSize: 13, fontWeight: 800, overflowWrap: "anywhere" }}>{l.docNumber ?? "ไม่มีเลขร่าง"}</span>
                                                <span style={{ fontSize: 12, color: "#64748b" }}>{l.docDate ? toThaiDate(l.docDate) : ""}</span>
                                                {done && <span style={{ marginLeft: "auto", color: "#166534", fontSize: 12, fontWeight: 700 }}>✓ บันทึกแล้ว</span>}
                                            </div>
                                            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, overflowWrap: "anywhere" }}>{l.companyName || "ไม่มีชื่อบริษัท"}</div>
                                            {studentLines(l)}
                                            {noNumber ? (
                                                <div style={{ marginTop: 6, fontSize: 12, color: "#b45309" }}>ไม่มีเลขร่าง — อัปโหลดทีละคนที่หน้าต่างเดิม</div>
                                            ) : done ? (
                                                <div style={{ marginTop: 6, fontSize: 12, color: "#166534", overflowWrap: "anywhere" }}>ไฟล์: {cur?.file.name}</div>
                                            ) : (
                                                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
                                                    <select aria-label={`ไฟล์ของ ${l.docNumber}`} style={{ ...selectStyle, flex: "1 1 220px" }} value={cur?.id ?? ""} disabled={busy}
                                                        onChange={e => setLetterFile(l.key, e.target.value)}>
                                                        <option value="">— ยังไม่มีไฟล์ —</option>
                                                        {cur && <option value={cur.id}>{cur.file.name}</option>}
                                                        {unassigned.map(i => <option key={i.id} value={i.id}>{i.file.name}</option>)}
                                                    </select>
                                                    <select aria-label={`วิธีจัดส่ง ${l.docNumber}`} style={selectStyle} value={deliveryOf(l.key)} disabled={busy}
                                                        onChange={e => setRowDelivery(d => ({ ...d, [rk(l.key)]: e.target.value as Delivery }))}>
                                                        <option value="STUDENT">นักศึกษาดาวน์โหลด</option>
                                                        <option value="STAFF">เจ้าหน้าที่จัดส่งให้บริษัท</option>
                                                    </select>
                                                </div>
                                            )}
                                            {res && !res.ok && <div style={{ marginTop: 6, color: "#991b1b", fontSize: 12, overflowWrap: "anywhere" }}>✗ {res.message}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {summary && (
                        <div style={{ border: `1px solid ${summary.fail ? "#f59e0b" : "#22c55e"}`, background: summary.fail ? "#fffbeb" : "#f0fdf4", color: summary.fail ? "#92400e" : "#166534", borderRadius: 8, padding: 10, fontSize: 13 }}>
                            สำเร็จ {summary.ok} · ไม่สำเร็จ {summary.fail}{summary.fail ? " — ฉบับที่ไม่สำเร็จแก้ไฟล์แล้วกดบันทึกใหม่ได้" : ""}
                        </div>
                    )}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", marginTop: 12 }}>
                    {busy && <span style={{ fontSize: 13, color: "#475569", marginRight: "auto" }}>กำลังบันทึกทีละฉบับ...</span>}
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>ปิด</button>
                    <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!canSave} style={{ opacity: canSave ? 1 : 0.5 }}>
                        {busy ? "กำลังบันทึก..." : `บันทึก ${toSave.length} ฉบับ`}
                    </button>
                </div>
            </div>
            <style>{MODAL_CSS}</style>
        </div>
    );
}
