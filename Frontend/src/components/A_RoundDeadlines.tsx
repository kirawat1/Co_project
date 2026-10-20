// ปฏิทินของรอบ — กำหนดส่งของแต่ละขั้นในรอบนี้ (ฝังในหน้ารอบสหกิจ)
//   ค่าวิทยาลัย = ค่าตั้งต้น (เจ้าหน้าที่) · หลักสูตร = ค่าที่ใช้จริง (เจ้าหน้าที่ + อาจารย์ประจำวิชาที่ดูแล)
//   ขั้นที่หลักสูตรยังไม่ตั้ง → ระบบใช้ช่วงเวลาเดิม (แสดงเป็น "ใช้ค่าเดิม")
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import axios from "axios";
import DateInput from "./DateInput";
import Modal from "./Modal";
import { fmtDate } from "../utils/dateFormat";
import { notify } from "../utils/notify";
import {
    STEP_KEYS, MODE_STEPS, STEP_LABEL, deadlineStatus, differsFromCollege, suggestApplyTo, entryText, legacyText,
    type Deadlines, type DeadlineEntry, type StepKey, type Tone, type LegacyWindow, type LegacyForm,
} from "../utils/deadlines";

export interface CalendarData {
    period: { id: number; academicYear: string; semester: number };
    canEditCollege: boolean;
    college: Deadlines;
    majors: { major: string; deadlines: Deadlines; startDate: string | null }[];
    legacy: Record<string, Partial<Record<StepKey, LegacyWindow | LegacyForm>>>;
}
interface PeriodInfo { id: number; academicYear: string; semester: number }
interface PeriodRowInfo { major: string; startDate: string; endDate: string; isActive: boolean; supervisionStartDate: string | null; supervisionEndDate: string | null; configured?: boolean }

interface Props {
    period: PeriodInfo & { majors: PeriodRowInfo[] };
    periods: PeriodInfo[];
}

const COLLEGE = "";
const errMsg = (err: any, fallback: string) => err?.response?.data?.message || fallback;

// ตัดขั้นที่ไม่มีวันและไม่ได้ปิดชั่วคราวทิ้ง = "ยังไม่ตั้ง" (ระบบใช้ค่าเดิม) ไม่ใช่ "ไม่มีกำหนด"
function cleanDraft(d: Deadlines): Deadlines {
    const out: Deadlines = {};
    for (const k of STEP_KEYS) {
        const e = d[k];
        if (!e || (!e.due && !e.closed)) continue;
        out[k] = MODE_STEPS.includes(k)
            ? { due: e.due || null, mode: e.mode || "HARD", ...(e.closed ? { closed: true } : {}) }
            : { due: e.due || null };
    }
    return out;
}

export default function A_RoundDeadlines({ period, periods }: Props) {
    const [data, setData] = useState<CalendarData | null>(null);
    const [error, setError] = useState("");
    const [tab, setTab] = useState<string>(COLLEGE);
    const [draft, setDraft] = useState<Deadlines>({});
    const [saving, setSaving] = useState(false);
    const [applyDialog, setApplyDialog] = useState<{ picks: string[] } | null>(null);
    const [copyFrom, setCopyFrom] = useState<string>("");

    const load = async () => {
        try {
            const res = await axios.get(`/api/admin/coop-periods/${period.id}/deadlines`);
            setData(res.data);
            setError("");
        } catch (err) {
            setError(errMsg(err, "โหลดปฏิทินของรอบไม่สำเร็จ"));
        }
    };
    useEffect(() => { load(); }, [period.id]);

    // แท็บเริ่มต้น: เจ้าหน้าที่ = ทั้งวิทยาลัย · อาจารย์ประจำวิชา = หลักสูตรแรกที่ดูแล
    useEffect(() => {
        if (!data) return;
        if (!data.canEditCollege && tab === COLLEGE && data.majors.length) setTab(data.majors[0].major);
    }, [data]);

    const saved: Deadlines = useMemo(() => {
        if (!data) return {};
        return tab === COLLEGE ? data.college : data.majors.find(m => m.major === tab)?.deadlines ?? {};
    }, [data, tab]);
    useEffect(() => { setDraft(saved); }, [saved]);

    const sameSemester = periods.filter(p => p.id !== period.id && Number(p.semester) === Number(period.semester))
        .sort((a, b) => Number(b.academicYear) - Number(a.academicYear));
    useEffect(() => {
        const prev = sameSemester.find(p => Number(p.academicYear) === Number(period.academicYear) - 1) ?? sameSemester[0];
        setCopyFrom(prev ? String(prev.id) : "");
    }, [period.id, periods.length]);

    if (error) return <div style={{ ...box, color: "#b91c1c" }}>⚠️ {error}</div>;
    if (!data) return <div style={{ ...box, color: "#64748b" }}>⏳ กำลังโหลดปฏิทินของรอบ...</div>;

    const readOnly = tab === COLLEGE && !data.canEditCollege;
    const dirty = JSON.stringify(cleanDraft(draft)) !== JSON.stringify(cleanDraft(saved));
    const columns = [COLLEGE, ...data.majors.map(m => m.major)];
    const rowOf = (major: string) => period.majors.find(r => r.major === major && r.configured !== false);

    const setStep = (k: StepKey, patch: Partial<DeadlineEntry>) =>
        setDraft(d => ({ ...d, [k]: { due: null, ...(d[k] || {}), ...patch } }));
    const resetToCollege = (k: StepKey) =>
        setDraft(d => { const next = { ...d }; if (data.college[k]) next[k] = { ...data.college[k]! }; else delete next[k]; return next; });

    const putDeadlines = async (body: object, okText: string) => {
        setSaving(true);
        try {
            await axios.put(`/api/admin/coop-periods/${period.id}/deadlines`, body);
            notify.success(okText);
            await load();
        } catch (err) {
            notify.error(errMsg(err, "บันทึกไม่สำเร็จ"));
        } finally {
            setSaving(false);
        }
    };

    const save = () => {
        const deadlines = cleanDraft(draft);
        if (tab !== COLLEGE) return putDeadlines({ major: tab, deadlines }, `บันทึกกำหนดส่งของหลักสูตร ${tab} แล้ว`);
        const picks = suggestApplyTo(data.college, deadlines, data.majors);
        const changedSomething = JSON.stringify(deadlines) !== JSON.stringify(cleanDraft(data.college));
        if (!data.majors.length || !changedSomething) return putDeadlines({ major: COLLEGE, deadlines, applyTo: [] }, "บันทึกค่าตั้งต้นของวิทยาลัยแล้ว");
        setApplyDialog({ picks });
    };

    const confirmApply = async () => {
        if (!applyDialog) return;
        const picks = applyDialog.picks;
        setApplyDialog(null);
        await putDeadlines({ major: COLLEGE, deadlines: cleanDraft(draft), applyTo: picks },
            picks.length ? `บันทึกค่าวิทยาลัยแล้ว · ใช้กับหลักสูตร ${picks.join(", ")}` : "บันทึกค่าวิทยาลัยแล้ว (ไม่เปลี่ยนหลักสูตรใด)");
    };

    const copy = async () => {
        if (!copyFrom) return;
        setSaving(true);
        try {
            const res = await axios.post(`/api/admin/coop-periods/${period.id}/deadlines/copy`, { fromPeriodId: Number(copyFrom) });
            const { copied = 0, kept = 0 } = res.data || {};
            notify.success(`คัดลอก ${copied} ขั้น${kept ? ` · ขั้นที่ตั้งไว้แล้ว ${kept} ขั้นไม่ถูกทับ` : ""}`);
            await load();
        } catch (err) {
            notify.error(errMsg(err, "คัดลอกไม่สำเร็จ"));
        } finally {
            setSaving(false);
        }
    };

    const cellOf = (col: string, k: StepKey) => {
        if (col === COLLEGE) return { text: entryText(data.college[k]), highlight: false, legacy: false };
        const e = data.majors.find(m => m.major === col)?.deadlines?.[k];
        if (!e) return { text: `ค่าเดิม: ${legacyText(data.legacy[col]?.[k])}`, highlight: false, legacy: true };
        return { text: entryText(e), highlight: differsFromCollege(e, data.college[k]), legacy: false };
    };

    return (
        <div style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>📆 ปฏิทินของรอบ {period.semester}/{period.academicYear}</div>
                    <div style={hint}>กำหนดส่งของขั้นที่ทำในระบบ · ช่องสีเหลือง = หลักสูตรตั้งต่างจากวิทยาลัย · "ค่าเดิม" = รอบนี้ยังไม่ตั้ง ระบบใช้ช่วงเวลาเดิม</div>
                </div>
                {sameSemester.length > 0 && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <select className="input" value={copyFrom} onChange={e => setCopyFrom(e.target.value)} style={{ width: "auto", minWidth: 0 }} aria-label="รอบต้นทาง">
                            {sameSemester.map(p => <option key={p.id} value={p.id}>จากรอบ {p.semester}/{p.academicYear}</option>)}
                        </select>
                        <button type="button" className="btn-secondary small" disabled={saving || !copyFrom} onClick={copy}
                            title="คัดลอกกำหนดส่งจากรอบเทอมเดียวกันของปีก่อน (เลื่อนปีให้) — ขั้นที่ตั้งไว้แล้วไม่ถูกทับ">
                            คัดลอกจากรอบก่อน
                        </button>
                    </div>
                )}
            </div>

            {/* ภาพรวมทั้งรอบ */}
            <div style={{ overflowX: "auto", marginTop: 12 }}>
                <table style={table}>
                    <thead>
                        <tr>
                            <th style={th}>ขั้น</th>
                            {columns.map(c => <th key={c || "college"} style={th}>{c === COLLEGE ? "ทั้งวิทยาลัย" : c}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={td}>ยื่นคำร้อง</td>
                            <td style={{ ...td, color: "#94a3b8" }}>—</td>
                            {data.majors.map(m => {
                                const r = rowOf(m.major);
                                return <td key={m.major} style={td}>{r ? `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}${r.isActive ? " · เปิด" : ""}` : "—"}</td>;
                            })}
                        </tr>
                        {STEP_KEYS.map(k => (
                            <tr key={k}>
                                <td style={td}>{STEP_LABEL[k]}</td>
                                {columns.map(c => {
                                    const cell = cellOf(c, k);
                                    return <td key={c || "college"} style={{ ...td, ...(cell.highlight ? diffCell : {}), ...(cell.legacy ? { color: "#94a3b8" } : {}) }}>{cell.text}</td>;
                                })}
                            </tr>
                        ))}
                        <tr>
                            <td style={td}>นิเทศ</td>
                            <td style={{ ...td, color: "#94a3b8" }}>—</td>
                            {data.majors.map(m => {
                                const r = rowOf(m.major);
                                const s = r?.supervisionStartDate, e = r?.supervisionEndDate;
                                return <td key={m.major} style={td}>{s || e ? `${s ? fmtDate(s) : "…"} – ${e ? fmtDate(e) : "…"}` : "ยังไม่ตั้ง"}</td>;
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style={{ ...hint, marginTop: 6 }}>ยื่นคำร้อง = ช่วงรับสมัครในตารางด้านบน · นิเทศ = ตั้งที่หน้า "จัดการนิเทศ"</div>

            {/* แก้ทีละคอลัมน์ */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16 }} role="tablist">
                {columns.map(c => (
                    <button key={c || "college"} type="button" role="tab" aria-selected={tab === c} onClick={() => setTab(c)}
                        style={{ ...tabBtn, ...(tab === c ? tabActive : {}) }}>
                        {c === COLLEGE ? "ทั้งวิทยาลัย" : `หลักสูตร ${c}`}
                    </button>
                ))}
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {readOnly && <div style={hint}>ค่าตั้งต้นของวิทยาลัยแก้ได้เฉพาะเจ้าหน้าที่ — แก้กำหนดส่งของหลักสูตรที่แท็บหลักสูตร</div>}
                {STEP_KEYS.map(k => {
                    const e = draft[k];
                    const hasMode = MODE_STEPS.includes(k);
                    const collegeE = data.college[k];
                    const differs = tab !== COLLEGE && !!e && differsFromCollege(cleanDraft({ [k]: e })[k], collegeE);
                    const status = e && (e.due || e.closed) ? deadlineStatus({ due: e.due, mode: e.mode, closed: e.closed }) : null;
                    return (
                        <div key={k} style={{ ...stepRow, ...(differs ? diffCell : {}) }}>
                            <div style={{ fontWeight: 700, color: "#0f172a", minWidth: 0 }}>
                                {STEP_LABEL[k]}
                                {status && <span style={{ ...pill, ...toneStyle[status.tone] }}>{status.text}</span>}
                                {!hasMode && <div style={hint}>ฟอร์มนอกระบบ — แสดงวันให้นักศึกษาเห็นอย่างเดียว</div>}
                                {tab !== COLLEGE && !e && <div style={hint}>ยังไม่ตั้ง — ใช้ค่าเดิม: {legacyText(data.legacy[tab]?.[k])}</div>}
                                {differs && <div style={hint}>วิทยาลัย: {entryText(collegeE)}</div>}
                            </div>
                            <div style={stepFields}>
                                <label style={fieldLabel}>
                                    กำหนดส่ง
                                    <DateInput className="input" value={e?.due || ""} disabled={readOnly}
                                        onChange={ev => setStep(k, { due: ev.target.value || null })} />
                                </label>
                                {hasMode && (
                                    <label style={fieldLabel}>
                                        เลยกำหนดแล้ว
                                        <select className="input" value={e?.mode || "HARD"} disabled={readOnly}
                                            onChange={ev => setStep(k, { mode: ev.target.value as "HARD" | "SOFT" })}>
                                            <option value="HARD">ปิดรับ (ขยายเวลารายคนได้)</option>
                                            <option value="SOFT">ส่งได้ ติดป้ายส่งช้า</option>
                                        </select>
                                    </label>
                                )}
                                {hasMode && (
                                    <label style={{ ...fieldLabel, flexDirection: "row", alignItems: "center", gap: 6 }}>
                                        <input type="checkbox" checked={!!e?.closed} disabled={readOnly}
                                            onChange={ev => setStep(k, { closed: ev.target.checked })} />
                                        ปิดรับชั่วคราว
                                    </label>
                                )}
                                {differs && !readOnly && (
                                    <button type="button" className="btn-secondary small" onClick={() => resetToCollege(k)}>ใช้ค่าวิทยาลัย</button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {!readOnly && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <button type="button" className="btn-secondary" disabled={!dirty || saving} onClick={() => setDraft(saved)}>ยกเลิกที่แก้</button>
                    <button type="button" className="btn" disabled={!dirty || saving} onClick={save}>
                        {saving ? "⏳ กำลังบันทึก..." : tab === COLLEGE ? "บันทึกค่าวิทยาลัย" : `บันทึกของหลักสูตร ${tab}`}
                    </button>
                </div>
            )}

            {applyDialog && (
                <Modal title="ใช้ค่าวิทยาลัยกับหลักสูตรไหนบ้าง" onClose={() => setApplyDialog(null)} maxWidth={520}>
                    <div style={{ display: "grid", gap: 12 }}>
                        <div style={hint}>
                            เปลี่ยนเฉพาะขั้นที่แก้ครั้งนี้ · ติ๊กไว้ให้แล้ว = หลักสูตรที่ยังใช้ค่าวิทยาลัยเดิม ·
                            ไม่ติ๊ก = หลักสูตรที่ตั้งเองไว้ (ไม่ถูกทับ)
                        </div>
                        {data.majors.map(m => (
                            <label key={m.major} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input type="checkbox" checked={applyDialog.picks.includes(m.major)}
                                    onChange={ev => setApplyDialog(d => d && ({ picks: ev.target.checked ? [...d.picks, m.major] : d.picks.filter(x => x !== m.major) }))} />
                                หลักสูตร {m.major}
                            </label>
                        ))}
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                            <button type="button" className="btn-secondary" onClick={() => setApplyDialog(null)}>ยกเลิก</button>
                            <button type="button" className="btn" onClick={confirmApply}>บันทึก</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

const box: CSSProperties = { marginTop: 12, padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", minWidth: 0 };
const hint: CSSProperties = { fontSize: 12, color: "#64748b", fontWeight: 400 };
const table: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: CSSProperties = { textAlign: "left", padding: "6px 8px", fontSize: 12, fontWeight: 700, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "8px", borderBottom: "1px solid #eef2f7", color: "#334155", whiteSpace: "nowrap" };
const diffCell: CSSProperties = { background: "#fefce8" };
const tabBtn: CSSProperties = { padding: "6px 12px", borderRadius: 999, borderWidth: 1, borderStyle: "solid", borderColor: "#cbd5e1", background: "#fff", color: "#334155", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const tabActive: CSSProperties = { background: "#2563eb", borderColor: "#2563eb", color: "#fff" };
const stepRow: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 10, padding: 12, border: "1px solid #eef2f7", borderRadius: 10, alignItems: "end" };
const stepFields: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", minWidth: 0 };
const fieldLabel: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#475569", minWidth: 0 };
const pill: CSSProperties = { marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" };
const toneStyle: Record<Tone, CSSProperties> = {
    ok: { background: "#dcfce7", color: "#166534" },
    warn: { background: "#fef3c7", color: "#92400e" },
    closed: { background: "#fee2e2", color: "#991b1b" },
    info: { background: "#f1f5f9", color: "#475569" },
};
