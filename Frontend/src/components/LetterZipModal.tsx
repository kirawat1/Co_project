// หน้าต่างดาวน์โหลดหนังสือที่ออกแล้วเป็น zip — เลือกประเภท/รอบ/หลักสูตร เห็นจำนวน ขนาด รายชื่อ ก่อนกดยืนยัน
import { BusyLabel, LoadingBlock } from "./Spinner";
import { useEffect, useState, type CSSProperties } from "react";
import Modal from "./Modal";
import { apiFetch } from "../utils/apiFetch";
import { notify } from "../utils/notify";
import { getMajorFilter, NO_MAJOR } from "../utils/majorFilter";
import {
    LETTER_LABEL, fetchLetterZipSummary, startLetterZipDownload, formatBytes,
    type LetterType, type LetterZipSummary,
} from "../utils/letterZip";

interface Props {
    types: LetterType[];                 // ประเภทที่เลือกได้ (หน้าเดียวมีประเภทเดียว = ไม่แสดงตัวเลือก)
    periods: { id: number | string; semester: number | string; academicYear: string }[];
    defaultPeriodId: string;             // รอบที่เลือกอยู่ในหน้า
    onClose: () => void;
}

const BIG_BYTES = 300 * 1024 * 1024; // ใหญ่กว่านี้เตือนให้เลือกแคบลง

export default function LetterZipModal({ types, periods, defaultPeriodId, onClose }: Props) {
    const [type, setType] = useState<LetterType>(types[0]);
    // รอบที่หน้าเลือกอยู่ — ค่าที่หน้าต่างนี้ไม่มีให้เลือก (เช่น "none" = ยังไม่เลือกรอบ) → ทุกรอบ (API รับแค่ตัวเลข/all)
    const [periodId, setPeriodId] = useState(
        defaultPeriodId && periods.some((p) => String(p.id) === String(defaultPeriodId)) ? defaultPeriodId : "all");
    const [major, setMajor] = useState(getMajorFilter()); // ค่าเริ่มต้น = ตัวกรองหลักสูตรบนแถบบน
    const [majors, setMajors] = useState<string[]>([]);
    const [isStaff, setIsStaff] = useState(false);
    const [summary, setSummary] = useState<LetterZipSummary | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);

    // หลักสูตรที่เลือกได้: เจ้าหน้าที่ = ทุกหลักสูตร · อาจารย์ประจำวิชา = หลักสูตรที่ดูแล
    useEffect(() => {
        apiFetch("/api/admin/my-scope").then((r) => r.json()).then(async (s) => {
            if (s?.all) {
                setIsStaff(true);
                const d = await apiFetch("/api/admin/majors").then((r) => r.json()).catch(() => null);
                setMajors(d?.majors ?? []);
            } else {
                setMajors(s?.majors ?? []);
            }
        }).catch(() => {});
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError("");
        fetchLetterZipSummary({ type, periodId, major })
            .then((s) => { if (!cancelled) setSummary(s); })
            .catch((e) => { if (!cancelled) { setSummary(null); setError(e.message); } })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [type, periodId, major]);

    const periodLabel = periodId === "all" ? "ทุกรอบ" : (() => {
        const p = periods.find((x) => String(x.id) === String(periodId));
        return p ? `เทอม ${p.semester}/${p.academicYear}` : `รอบ ${periodId}`;
    })();
    const majorLabel = major === NO_MAJOR ? "ยังไม่ระบุหลักสูตร" : major ? `หลักสูตร ${major}` : isStaff ? "ทุกหลักสูตร" : "ทุกหลักสูตรที่ดูแล";
    const count = summary?.count ?? 0;

    const confirm = async () => {
        setStarting(true);
        try {
            await startLetterZipDownload({ type, periodId, major });
            notify.success(`เริ่มดาวน์โหลด${LETTER_LABEL[type]} ${count} ฉบับแล้ว — ดูความคืบหน้าที่แถบดาวน์โหลดของเบราว์เซอร์`);
            onClose();
        } catch (e: any) {
            notify.error(e.message || "ดาวน์โหลดไม่สำเร็จ");
        } finally {
            setStarting(false);
        }
    };

    return (
        <Modal title="📦 ดาวน์โหลดหนังสือที่ออกแล้ว" onClose={onClose} maxWidth={620}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {types.length > 1 && (
                    <div>
                        <div style={labelStyle}>ประเภทหนังสือ</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {types.map((t) => (
                                <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t}
                                    style={{ ...segStyle, ...(type === t ? segActive : null) }}>
                                    {LETTER_LABEL[t]}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12 }}>
                    <label>
                        <div style={labelStyle}>รอบสหกิจ</div>
                        <select className="input" value={periodId} onChange={(e) => setPeriodId(e.target.value)} style={{ width: "100%" }}>
                            <option value="all">ทุกรอบ</option>
                            {periods.map((p) => <option key={p.id} value={String(p.id)}>เทอม {p.semester} / {p.academicYear}</option>)}
                        </select>
                    </label>
                    <label>
                        <div style={labelStyle}>หลักสูตร</div>
                        <select className="input" value={major} onChange={(e) => setMajor(e.target.value)} style={{ width: "100%" }}>
                            <option value="">{isStaff ? "ทุกหลักสูตร" : "ทุกหลักสูตรที่ดูแล"}</option>
                            {majors.map((m) => <option key={m} value={m}>หลักสูตร {m}</option>)}
                            {isStaff && <option value={NO_MAJOR}>ยังไม่ระบุหลักสูตร</option>}
                        </select>
                    </label>
                </div>

                {/* สรุปสิ่งที่จะได้ */}
                <div style={summaryBox}>
                    {loading ? (
                        <LoadingBlock text="กำลังตรวจรายการหนังสือ…" style={{ color: "#64748b" }} />
                    ) : error ? (
                        <div style={{ color: "#b91c1c" }}>⚠️ {error}</div>
                    ) : count === 0 ? (
                        <div style={{ color: "#64748b" }}>ยังไม่มี{LETTER_LABEL[type]}ที่ออกแล้วใน {periodLabel} · {majorLabel}</div>
                    ) : (
                        <>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                                {LETTER_LABEL[type]} <span style={{ color: "#2563eb" }}>{count} ฉบับ</span>
                                <span style={{ fontWeight: 500, color: "#475569" }}> · ขนาดรวมประมาณ {formatBytes(summary!.totalBytes)}</span>
                            </div>
                            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                                {periodLabel} · {majorLabel} · ได้ไฟล์ <b>{summary!.fileName}</b> · ในไฟล์ตั้งชื่อ รหัส_ชื่อ_นามสกุล
                            </div>
                            {summary!.totalBytes > BIG_BYTES && (
                                <div style={{ ...noteStyle, background: "#fffbeb", borderColor: "#fcd34d", color: "#92400e" }}>
                                    ไฟล์ใหญ่ อาจใช้เวลาดาวน์โหลดนาน — ถ้าเน็ตช้าแนะนำเลือกรอบหรือหลักสูตรให้แคบลง
                                </div>
                            )}
                        </>
                    )}
                    {!loading && !!summary?.missing.length && (
                        <div style={{ ...noteStyle, background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}>
                            ไม่พบไฟล์ในเครื่อง {summary.missing.length} คน (มีข้อมูลว่าออกแล้ว) — จะไม่อยู่ใน zip แต่มีรายชื่อในไฟล์ _ไม่พบไฟล์.txt:{" "}
                            {summary.missing.slice(0, 5).map((m) => m.studentId).join(", ")}{summary.missing.length > 5 ? " …" : ""}
                        </div>
                    )}
                </div>

                {!loading && count > 0 && (
                    <div>
                        <div style={labelStyle}>รายชื่อในไฟล์ ({count})</div>
                        <div style={listBox}>
                            {summary!.students.map((s) => (
                                <div key={s.studentId} style={listRow}>
                                    <span style={{ fontFamily: "monospace", color: "#334155" }}>{s.studentId}</span>
                                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                                    {s.major && <span style={majorChip}>{s.major}</span>}
                                    <span style={{ color: "#64748b", fontSize: 12, width: 64, textAlign: "right" }}>{formatBytes(s.size)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                    <button type="button" className="btn-secondary" onClick={onClose}>ยกเลิก</button>
                    <button type="button" className="btn" disabled={loading || starting || count === 0} onClick={confirm}>
                        {starting ? <BusyLabel text="กำลังเริ่มดาวน์โหลด…" /> : count ? `⬇️ ดาวน์โหลด ${count} ฉบับ` : "⬇️ ดาวน์โหลด"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

/** ปุ่มเปิดหน้าต่างดาวน์โหลด — ใช้หน้าตาเดียวกันทุกหน้า */
export function LetterZipButton({ onClick, label = "ดาวน์โหลดหนังสือ (zip)" }: { onClick: () => void; label?: string }) {
    return (
        <button type="button" className="btn-secondary" onClick={onClick} title="ดาวน์โหลดหนังสือที่ออกแล้ว (ฉบับลงนาม) หลายฉบับเป็นไฟล์ zip">
            {label}
        </button>
    );
}

const labelStyle: CSSProperties = { fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 };
const segStyle: CSSProperties = { padding: "8px 14px", borderRadius: 999, borderWidth: 1, borderStyle: "solid", borderColor: "#cbd5e1", background: "#fff", color: "#334155", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const segActive: CSSProperties = { background: "#2563eb", borderColor: "#2563eb", color: "#fff" };
const summaryBox: CSSProperties = { padding: "14px 16px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 8 };
const noteStyle: CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid", fontSize: 13 };
const listBox: CSSProperties = { maxHeight: 220, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 };
const listRow: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 13 };
const majorChip: CSSProperties = { fontSize: 11, fontWeight: 700, color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 999, padding: "1px 8px" };
