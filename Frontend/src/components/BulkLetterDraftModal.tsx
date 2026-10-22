import React, { useMemo, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { notify, askConfirm } from "../utils/notify";
import DateInput from "./DateInput";
import { MODAL_CSS } from "./LetterModalShared";
import { normalizeDocNumber, thaiPrefix } from "../utils/docGeneratorUtils";
import { letterRecipient, recipientText } from "../utils/letterRecipient";
import { loadLetterAssets } from "../utils/letterAssets";
import { buildLetterFiles } from "../utils/bulkLetterFiles";
import { createZip, registerWorkbook, type RegisterRow } from "../utils/bulkLetterZip";
import {
    bulkCandidates, blockReason, docSuffix, pendingDraftOf, groupByCompany, numberSequence, duplicateNumbers,
    LETTER_FILE_LABEL, type BulkLetterType, type BulkFormat,
} from "../utils/bulkLetters";

const ESTIMATE_MB_PER_LETTER = 8;
const CONFIRM_OVER = 15;

const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 };
const smallBtn: React.CSSProperties = { fontSize: 12, padding: "2px 8px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", cursor: "pointer" };
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 800, margin: "0 0 8px", color: "#0f172a" };

const nameOf = (s: any) => `${thaiPrefix(s.prefix)}${s.firstName ?? ""} ${s.lastName ?? ""}`.trim();

export default function BulkLetterDraftModal({ students, onClose }: { students: any[]; onClose: () => void }) {
    const [letter, setLetter] = useState<BulkLetterType>("REQUEST");
    const [format, setFormat] = useState<BulkFormat>("doc");
    // ผู้ใช้ติ๊ก/เอาติ๊กออกเอง (ค่าไม่อยู่ใน map = ใช้ค่าเริ่มต้น) — ล้างเมื่อเปลี่ยนประเภท
    const [touched, setTouched] = useState<Record<number, boolean>>({});
    const [splitIds, setSplitIds] = useState<Set<number>>(new Set());
    const [start, setStart] = useState("660301.26.6.2/");
    const [docDate, setDocDate] = useState(new Date().toISOString().split("T")[0]);
    const [overrides, setOverrides] = useState<Record<string, string>>({});
    const [conflicts, setConflicts] = useState<Set<string>>(new Set());
    const [conflictMsg, setConflictMsg] = useState("");
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [phase, setPhase] = useState("");
    const [retryMsg, setRetryMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [summary, setSummary] = useState<{ count: number; missing: string[] } | null>(null);
    const busy = phase !== "";

    const candidates = useMemo(() => bulkCandidates(students, letter), [students, letter]);
    const defaultChecked = (s: any) => !blockReason(s, letter) && !pendingDraftOf(s, letter);
    const isChecked = (s: any) => !blockReason(s, letter) && (touched[s.id] ?? defaultChecked(s));
    const chosen = candidates.filter(isChecked);
    const groups = useMemo(() => groupByCompany(chosen, splitIds), [chosen.map(s => s.id).join(","), splitIds]); // eslint-disable-line react-hooks/exhaustive-deps

    const sequence = numberSequence(start, Math.max(groups.length, 1));
    const numbers = groups.map((g, i) => overrides[g.key] ?? sequence?.[i] ?? "");
    const dupes = duplicateNumbers(numbers.filter(n => n.trim()));
    const rowError = (n: string): string => {
        const norm = normalizeDocNumber(n);
        if (!norm) return "ยังไม่ได้ใส่เลขที่";
        if (docSuffix(norm) == null) return "เลขท้ายหลัง / ต้องเป็นตัวเลข";
        if (dupes.has(norm)) return "เลขที่ซ้ำกันในชุดนี้";
        if (conflicts.has(norm)) return "เลขที่ชนกับหนังสือที่ออกแล้ว/รอลงนามอยู่";
        return "";
    };
    const anyRowError = numbers.some(n => rowError(n));
    const sequenceBroken = !sequence && groups.length > 0;
    const canDownload = !busy && groups.length > 0 && !!docDate && !anyRowError;

    const filesPerLetter = letter === "REQUEST" && format === "doc" ? 2 : 1;

    const changeLetter = (l: BulkLetterType) => {
        setLetter(l); setTouched({}); setSplitIds(new Set()); setOverrides({});
        setConflicts(new Set()); setConflictMsg(""); setRetryMsg(""); setErrorMsg(""); setSummary(null);
    };
    const changeStart = (v: string) => { setStart(v); setOverrides({}); setConflicts(new Set()); setConflictMsg(""); };
    const toggleSplit = (id: number, split: boolean) => setSplitIds(prev => {
        const next = new Set(prev);
        if (split) next.add(id); else next.delete(id);
        return next;
    });

    const handleDownload = async () => {
        setErrorMsg(""); setRetryMsg(""); setConflictMsg(""); setSummary(null);
        const total = groups.length;
        if (letter === "REQUEST" && total > CONFIRM_OVER) {
            const mb = total * ESTIMATE_MB_PER_LETTER;
            const ok = await askConfirm(
                `จะสร้างหนังสือ ${total} ฉบับ ขนาดไฟล์รวมประมาณ ${mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : mb + " MB"} (ฉบับละราว ${ESTIMATE_MB_PER_LETTER} MB) ใช้เวลาและหน่วยความจำมาก\n\nดำเนินการต่อ?`,
                { title: "ชุดใหญ่", confirmLabel: "สร้างต่อ" });
            if (!ok) return;
        }
        const plan = groups.map((g, i) => ({ group: g, docNumber: normalizeDocNumber(numbers[i]) }));
        setPhase("กำลังเตรียม...");
        let reserved = false;
        try {
            const assets = await loadLetterAssets();
            if (format === "pdf" && !assets.krutUrl) { // ร่าง PDF ต้องใช้ตราครุฑ — หยุดก่อนจองเลข
                setErrorMsg("ไม่พบไฟล์ตราครุฑ (KRUT) กรุณาอัปโหลดในหน้าตั้งค่า");
                return;
            }

            setPhase("กำลังจองเลขและติดป้ายรอลงนาม...");
            const res = await apiFetch("/api/admin/t000/letter-pending-bulk", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    letter, docDate,
                    letters: plan.map(p => ({ studentIds: p.group.students.map(s => s.id), docNumber: p.docNumber })),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 409) {
                const list: { docNumber: string; message?: string }[] = Array.isArray(data.conflicts) ? data.conflicts : [];
                setConflicts(new Set(list.map(c => normalizeDocNumber(c.docNumber))));
                setConflictMsg(`${data.message || "เลขที่ชนกัน"} — ยังไม่ได้ติดป้ายรอลงนามให้ใครเลย แก้เลขในแถวสีแดงแล้วกดโหลดใหม่`);
                return;
            }
            if (!res.ok) {
                setErrorMsg(`${data.message || `จองเลขไม่สำเร็จ (${res.status})`} — ยังไม่ได้ติดป้ายรอลงนามให้ใคร`);
                return;
            }
            reserved = true;

            const zip = createZip();
            const register: RegisterRow[] = [];
            const missingAll: string[] = [];
            for (let i = 0; i < plan.length; i++) {
                const { group, docNumber } = plan[i];
                setPhase("กำลังสร้างไฟล์");
                setProgress({ done: i, total: plan.length });
                await new Promise(r => setTimeout(r, 0)); // ให้หน้าจออัปเดตก่อนงานหนัก
                const out = await buildLetterFiles({ letter, format, docNumber, docDate, students: group.students, assets });
                const names: string[] = [];
                for (const f of out.files) {
                    zip.add(f.name, new Uint8Array(await f.blob.arrayBuffer()));
                    names.push(f.name);
                }
                out.missingAttachments.forEach(m => missingAll.push(`${docNumber} (${group.companyName}): ${m}`));
                register.push({
                    docNumber, docDate, letter,
                    recipient: recipientText(letterRecipient(group.students[0].coop)) || "",
                    companyName: group.companyName,
                    students: group.students.map(s => `${s.studentId} ${nameOf(s)}`),
                    files: names,
                });
                out.files.length = 0; // ปล่อยอ้างอิง Blob ของฉบับนี้ก่อนสร้างฉบับถัดไป
            }
            setProgress({ done: plan.length, total: plan.length });
            zip.add("_รายการเลขหนังสือ.xlsx", registerWorkbook(register));
            const blob = await zip.finish();

            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `ร่าง${LETTER_FILE_LABEL[letter]}-${docDate}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 60_000);

            setSummary({ count: plan.length, missing: missingAll });
            notify.success(`✅ สร้างร่างหนังสือ ${plan.length} ฉบับแล้ว`);
        } catch (err: any) {
            console.error(err);
            if (reserved) {
                setRetryMsg(`จองเลขและติดป้ายรอลงนามแล้ว แต่สร้างไฟล์ไม่สำเร็จ — กดโหลดอีกครั้งได้ (ใช้เลขเดิม)${err?.message ? `\nสาเหตุ: ${err.message}` : ""}`);
            } else {
                setErrorMsg(err?.message || "เกิดข้อผิดพลาด");
            }
        } finally {
            setPhase(""); setProgress(null);
        }
    };

    const box: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#fff" };

    return (
        <div className="letter-modal-backdrop" style={{ zIndex: 10000 }}>
            <div className="letter-modal-card" style={{ width: "95%", maxWidth: 860, maxHeight: "92vh", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <h2 style={{ margin: 0, fontSize: 18 }}>ออกร่างหนังสือหลายคน</h2>
                    <button type="button" onClick={onClose} disabled={busy} style={{ ...smallBtn, fontSize: 14, padding: "4px 12px" }}>ปิด</button>
                </div>

                <div style={{ overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 12, paddingRight: 2 }}>
                    <details open style={{ ...box, background: "#f8fafc" }}>
                        <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 13 }}>วิธีใช้</summary>
                        <ol style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 13, lineHeight: 1.7, color: "#334155" }}>
                            <li>เลือกประเภท → ตรวจรายชื่อ (คนบริษัทเดียวกันรวมเป็นฉบับเดียว กด "แยกฉบับ" ได้) → ใส่เลขเริ่มต้นและวันที่ (ระบบไล่เลขต่อให้ แก้รายฉบับได้)</li>
                            <li>กดโหลด = <b>จองเลขและติดป้าย "รอลงนาม" ให้ทุกฉบับทันที</b> (เลขชนฉบับเดียว = ไม่จองเลย บอกว่าฉบับไหน) · ยกเลิกป้ายรายคนได้ที่หน้าต่างออกหนังสือเดิม</li>
                            <li>สิ่งที่ได้ใน zip (Word: หนังสือ + เอกสารแนบรวมเล่ม · PDF: ฉบับละไฟล์ · Excel รายการเลขหนังสือ)</li>
                            <li>ต่อจากนี้: แก้ Word ให้ตรงแบบ → พิมพ์หนังสือตามด้วยเอกสารแนบ → เสนอลงนาม → <b>สแกนทั้งชุดฉบับละไฟล์ ตั้งชื่อขึ้นต้นด้วยเลขหนังสือ</b> (ชื่อไฟล์ใน zip ใช้ได้เลย) → อัปโหลดด้วยปุ่ม "อัปโหลดฉบับลงนามหลายฉบับ"</li>
                        </ol>
                    </details>

                    <div style={box}>
                        <p style={sectionTitle}>1. ประเภทหนังสือ</p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {(["REQUEST", "PLACEMENT"] as BulkLetterType[]).map(l => (
                                <button key={l} type="button" disabled={busy} onClick={() => changeLetter(l)}
                                    style={{ ...smallBtn, fontSize: 13, padding: "6px 14px", ...(letter === l ? { background: "#0074b7", color: "#fff", border: "1px solid #0074b7" } : {}) }}>
                                    {LETTER_FILE_LABEL[l]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={box}>
                        <p style={sectionTitle}>2. รายชื่อ ({chosen.length} / {candidates.length} คน)</p>
                        {candidates.length === 0 ? (
                            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>ยังไม่มีนักศึกษาที่พร้อมออก{LETTER_FILE_LABEL[letter]}</p>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
                                {candidates.map(s => {
                                    const block = blockReason(s, letter);
                                    const pend = pendingDraftOf(s, letter);
                                    return (
                                        <label key={s.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, opacity: block ? 0.6 : 1, flexWrap: "wrap" }}>
                                            <input type="checkbox" disabled={!!block || busy} checked={isChecked(s)}
                                                onChange={e => setTouched(t => ({ ...t, [s.id]: e.target.checked }))} style={{ marginTop: 3 }} />
                                            <span style={{ flex: "1 1 200px", minWidth: 0, overflowWrap: "anywhere" }}>
                                                {s.studentId} {nameOf(s)} · {s.coop?.company?.name || "ไม่มีบริษัท"}
                                            </span>
                                            {block && <span style={{ color: "#b91c1c", fontSize: 12 }}>{block}</span>}
                                            {!block && pend && <span style={{ color: "#b45309", fontSize: 12 }}>รอลงนามอยู่{pend.number ? ` (เลข ${pend.number})` : ""}</span>}
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div style={box}>
                        <p style={sectionTitle}>3. เลขที่หนังสือและวันที่</p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                            <div>
                                <label style={lbl}>เลขเริ่มต้น</label>
                                <input className="input" value={start} disabled={busy} onChange={e => changeStart(e.target.value)} />
                            </div>
                            <div>
                                <label style={lbl}>วันที่ออกหนังสือ</label>
                                <DateInput className="input" value={docDate} onChange={e => setDocDate(e.target.value)} />
                            </div>
                        </div>
                        {sequenceBroken && (
                            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#b45309" }}>เลขเริ่มต้นต้องลงท้ายด้วยตัวเลขหลัง "/" (เช่น 660301.26.6.2/1234) จึงจะไล่เลขให้ได้ — หรือกรอกเลขรายฉบับเอง</p>
                        )}
                    </div>

                    <div style={box}>
                        <p style={sectionTitle}>4. ฉบับที่จะออก ({groups.length} ฉบับ)</p>
                        {groups.length === 0 ? (
                            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>ยังไม่ได้เลือกนักศึกษา</p>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {groups.map((g, i) => {
                                    const err = rowError(numbers[i]);
                                    return (
                                        <div key={g.key} style={{ border: `1px solid ${err ? "#ef4444" : "#e2e8f0"}`, background: err ? "#fef2f2" : "#f8fafc", borderRadius: 8, padding: 10 }}>
                                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>ฉบับที่ {i + 1}</span>
                                                <input className="input" style={{ flex: "1 1 200px", width: "auto", minWidth: 0, borderColor: err ? "#ef4444" : undefined }}
                                                    value={numbers[i]} disabled={busy} placeholder="เลขที่หนังสือ"
                                                    onChange={e => { setOverrides(o => ({ ...o, [g.key]: e.target.value })); }} />
                                            </div>
                                            {err && <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{err}</div>}
                                            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, overflowWrap: "anywhere" }}>{g.companyName || "ไม่มีชื่อบริษัท"}</div>
                                            {g.students.map(s => (
                                                <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "#475569", flexWrap: "wrap", marginTop: 2 }}>
                                                    <span style={{ flex: "1 1 160px", minWidth: 0, overflowWrap: "anywhere" }}>{s.studentId} {nameOf(s)}</span>
                                                    {g.students.length >= 2 && <button type="button" disabled={busy} style={smallBtn} onClick={() => toggleSplit(s.id, true)}>แยกฉบับ</button>}
                                                    {splitIds.has(s.id) && g.students.length === 1 && <button type="button" disabled={busy} style={smallBtn} onClick={() => toggleSplit(s.id, false)}>รวมกลับ</button>}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div style={box}>
                        <p style={sectionTitle}>5. รูปแบบไฟล์</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                            <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <input type="radio" name="bulk-format" checked={format === "doc"} disabled={busy} onChange={() => setFormat("doc")} style={{ marginTop: 3 }} />
                                <span>Word (.doc) — {letter === "REQUEST" ? "ฉบับละ 2 ไฟล์ (หนังสือ .doc + เอกสารแนบรวม PDF 1 ไฟล์)" : "ฉบับละ 1 ไฟล์"}</span>
                            </label>
                            <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <input type="radio" name="bulk-format" checked={format === "pdf"} disabled={busy} onChange={() => setFormat("pdf")} style={{ marginTop: 3 }} />
                                <span>PDF — ฉบับละ 1 ไฟล์{letter === "REQUEST" ? " (หนังสือ + เอกสารแนบทั้งชุด)" : ""}</span>
                            </label>
                        </div>
                        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                            ทั้งชุดจะได้ {groups.length * filesPerLetter} ไฟล์ + รายการเลขหนังสือ (Excel) ใน zip เดียว
                            {letter === "REQUEST" && ` · เอกสารแนบฉบับละราว ${ESTIMATE_MB_PER_LETTER} MB`}
                        </p>
                    </div>

                    {conflictMsg && <div style={{ border: "1px solid #ef4444", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 10, fontSize: 13, whiteSpace: "pre-line" }}>{conflictMsg}</div>}
                    {errorMsg && <div style={{ border: "1px solid #ef4444", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 10, fontSize: 13, whiteSpace: "pre-line" }}>{errorMsg}</div>}
                    {retryMsg && <div style={{ border: "1px solid #f59e0b", background: "#fffbeb", color: "#92400e", borderRadius: 8, padding: 10, fontSize: 13, whiteSpace: "pre-line" }}>{retryMsg}</div>}
                    {summary && (
                        <div style={{ border: "1px solid #22c55e", background: "#f0fdf4", color: "#166534", borderRadius: 8, padding: 10, fontSize: 13 }}>
                            <div>สร้างร่างหนังสือ {summary.count} ฉบับ และดาวน์โหลด zip แล้ว — นักศึกษาทุกคนในชุดถูกติดป้าย "รอลงนาม" แล้ว</div>
                            {summary.missing.length > 0 && (
                                <details style={{ marginTop: 6, color: "#92400e" }}>
                                    <summary style={{ cursor: "pointer" }}>ไฟล์แนบที่ไม่พบบนเซิร์ฟเวอร์ ({summary.missing.length} ไฟล์) — ไม่ได้ใส่ในเอกสารแนบ</summary>
                                    <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>{summary.missing.map((m, i) => <li key={m + i} style={{ overflowWrap: "anywhere" }}>{m}</li>)}</ul>
                                </details>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", marginTop: 12 }}>
                    {busy && (
                        <span style={{ fontSize: 13, color: "#475569", marginRight: "auto" }}>
                            {phase}{progress ? ` ${progress.done} / ${progress.total}` : ""}
                        </span>
                    )}
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>ปิด</button>
                    <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={!canDownload}
                        style={{ opacity: canDownload ? 1 : 0.5 }}>
                        {busy ? "กำลังทำงาน..." : summary || retryMsg ? "โหลดอีกครั้ง (ใช้เลขเดิม)" : `จองเลขและโหลด zip (${groups.length} ฉบับ)`}
                    </button>
                </div>
            </div>
            <style>{MODAL_CSS}</style>
        </div>
    );
}
