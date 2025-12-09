// src/components/T_Docs.tsx
import { useMemo, useState } from "react";
import type { StudentProfile, DocumentItem, DocStatus } from "./store";

const KS = "coop.student.profile.v1";
function loadStudents(): StudentProfile[] {
    try { return JSON.parse(localStorage.getItem(KS) || "[]"); }
    catch { return []; }
}
function saveStudents(list: StudentProfile[]) {
    localStorage.setItem(KS, JSON.stringify(list));
}


export default function T_Docs() {
    const [students, setStudents] = useState<StudentProfile[]>(() => loadStudents());
    const [st, setSt] = useState<"all" | DocStatus>("all");
    const [q, setQ] = useState("");
    const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]); // ✅ เลือกหลายเอกสารได้

    // รวมเอกสารทั้งหมดจากทุกคน -> [{id,title}]
    const allDocDefs = useMemo(() => {
        const map = new Map<string, string>();
        for (const s of students) for (const d of (s.docs || [])) {
            if (!map.has(d.id)) map.set(d.id, d.title || d.id);
        }
        return Array.from(map.entries())
            .map(([id, title]) => ({ id, title }))
            .sort((a, b) => a.title.localeCompare(b.title, "th"));
    }, [students]);

    // ฟังก์ชันย่อชื่อ: T01, T02… ถ้าย่อไม่ได้ -> ใช้ชื่อเต็ม
    function shortName(doc: { id: string; title: string }): string {
        const mId = /T(\d{1,3})/.exec(doc.id);
        if (mId) {
            const n = parseInt(mId[1], 10);
            if (!Number.isNaN(n)) return `T${n.toString().padStart(2, "0")}`;
        }
        const mTitle = /T(\d{1,3})/.exec(doc.title);
        if (mTitle) {
            const n = parseInt(mTitle[1], 10);
            if (!Number.isNaN(n)) return `T${n.toString().padStart(2, "0")}`;
        }
        return doc.title || doc.id;
    }

    const rows = useMemo(() => {
        const out: { studentId: string; name: string; item: DocumentItem }[] = [];
        students.forEach(s => (s.docs || []).forEach(d => out.push({
            studentId: s.studentId || "-",
            name: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
            item: d
        })));

        return out.filter(r => {
            const hitStatus = (st === "all" || r.item.status === st);
            const hitDoc = (selectedDocIds.length === 0 || selectedDocIds.includes(r.item.id)); // ✅ หลายตัวเลือก
            const hitQuery = `${r.studentId} ${r.name} ${r.item.title}`.toLowerCase().includes(q.toLowerCase());
            return hitStatus && hitDoc && hitQuery;
        });
    }, [students, st, q, selectedDocIds]);

    function attachFile(studentId: string, docId: string, file: File) {
        const r = new FileReader();
        r.onload = () => {
            const fileData = String(r.result);
            const next = students.map(s => {
                if (s.studentId !== studentId) return s;
                const docs = (s.docs || []).map(d => d.id === docId
                    ? ({ ...d, fileName: file.name, fileData, lastUpdated: new Date().toISOString() })
                    : d
                );
                return { ...s, docs };
            });
            setStudents(next);
            saveStudents(next);
        };
        r.readAsDataURL(file);
    }

    function updateStatus(studentId: string, docId: string, v: DocStatus) {
        const next = students.map(s =>
            s.studentId === studentId
                ? ({
                    ...s, docs: (s.docs || []).map(d =>
                        d.id === docId ? { ...d, status: v, lastUpdated: new Date().toISOString() } : d
                    )
                })
                : s
        );
        setStudents(next);
        saveStudents(next);
    }


    // toggle เอกสารแต่ละตัว
    function toggleDoc(id: string) {
        setSelectedDocIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    }
    function selectAllDocs() {
        setSelectedDocIds(allDocDefs.map(d => d.id));
    }
    function clearAllDocs() {
        setSelectedDocIds([]);
    }

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
            <section className="card" style={{ padding: 24, marginBottom: 18 }}>
                <h2 style={{ marginTop: 8, marginLeft: 18 }}>เอกสารทั้งหมด </h2>

                <div
                    className="tools"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        marginLeft: 18
                    }}
                >
                    <input
                        className="input"
                        placeholder="ค้นหา: ชื่อ/รหัส/ชื่อเอกสาร"
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        style={{ flex: "1 1 420px", minWidth: 240 }}
                    />

                    {/* กรองสถานะ */}
                    <select
                        className="input"
                        value={st}
                        onChange={e => setSt(e.target.value as any)}
                        style={{ flex: "0 0 180px" }}
                        title="กรองตามสถานะเอกสาร"
                    >
                        <option value="all">ทุกสถานะ</option>
                        <option value="waiting">รอส่ง</option>
                        <option value="under-review">รอพิจารณา</option>
                        <option value="approved">ผ่าน</option>
                        <option value="rejected">ไม่ผ่าน</option>
                    </select>

                    {/* ✅ กรองเอกสารแบบติ๊กได้หลายอัน */}
                    <div
                        className="doc-chip-group"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                            padding: "6px 8px",
                            borderRadius: 12,
                            border: "1px solid rgba(0,0,0,.08)",
                            background: "#fff",
                            maxWidth: "100%",
                        }}
                        title="ติ๊กเลือกเอกสารที่ต้องการแสดง (ไม่เลือก = ทุกเอกสาร)"
                    >
                        <span style={{ fontWeight: 800, color: "#374151" }}>เอกสาร:</span>
                        {allDocDefs.map(d => {
                            const label = shortName(d);
                            const checked = selectedDocIds.includes(d.id);
                            return (
                                <label
                                    key={d.id}
                                    className={`chip ${checked ? "chip-on" : ""}`}
                                    title={d.title}
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "6px 10px",
                                        borderRadius: 999,
                                        border: checked ? "1px solid rgba(0,116,183,.45)" : "1px solid rgba(0,0,0,.10)",
                                        background: checked ? "rgba(0,116,183,.08)" : "#fff",
                                        cursor: "pointer",
                                        userSelect: "none",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleDoc(d.id)}
                                        style={{ width: 14, height: 14 }}
                                    />
                                    <span style={{ fontSize: 12, fontWeight: 800 }}>{label}</span>
                                </label>
                            );
                        })}

                        {/* ปุ่มลัดทั้งหมด/ล้าง */}
                        <button className="btn ghost" type="button" onClick={selectAllDocs}>ทั้งหมด</button>
                        <button className="btn ghost" type="button" onClick={clearAllDocs}>ล้าง</button>
                    </div>

                    <Export rows={rows} />
                </div>
            </section>

            <section className="card" style={{ paddingBottom: 12 }}>
                <table className="doc-table" style={{ width: "100%", marginTop: 8, marginLeft: 18, marginBottom: 15 }}>
                    <colgroup>
                        <col style={{ width: "10ch" }} />
                        <col style={{ width: "14ch" }} />
                        <col className="col-title" />
                        <col className="col-file" />
                        <col style={{ width: "16ch" }} />
                        <col style={{ width: "18ch" }} />
                        <col style={{ width: "18ch" }} />
                    </colgroup>

                    <thead>
                        <tr>
                            <th align="left">รหัส</th>
                            <th align="left">ชื่อ</th>
                            <th align="left">เอกสาร</th>
                            <th align="left">ไฟล์</th>
                            <th align="left">สถานะ</th>
                            <th align="left">อัปเดตล่าสุด</th>
                            <th align="left">อัปโหลด</th>
                        </tr>
                    </thead>

                    <tbody>
                        {rows.map(r => (
                            <tr key={`${r.studentId}.${r.item.id}`} className="row">
                                <td>{r.studentId}</td>
                                <td className="cell-ellipsis" title={r.name}>{r.name || "-"}</td>
                                <td className="cell-ellipsis" title={r.item.title}>{r.item.title}</td>
                                <td className="cell-ellipsis" title={r.item.fileName || "-"}>{r.item.fileName || "-"}</td>
                                <td>
                                    <select
                                        className="input"
                                        value={r.item.status}
                                        onChange={e => updateStatus(r.studentId, r.item.id, e.target.value as DocStatus)}
                                        style={{ minWidth: 140, maxWidth: 180 }}
                                        aria-label={`เปลี่ยนสถานะ: ${r.item.title} ของ ${r.name}`}
                                        title="แก้ไขสถานะเอกสาร"
                                    >
                                        <option value="waiting">รอส่ง</option>
                                        <option value="under-review">รอพิจารณา</option>
                                        <option value="approved">ผ่าน</option>
                                        <option value="rejected">ไม่ผ่าน</option>
                                    </select>
                                </td>
                                <td>{r.item.lastUpdated ? new Date(r.item.lastUpdated).toLocaleString() : "-"}</td>
                                <td>
                                    <label className="btn" style={{ cursor: "pointer" }}>
                                        แนบไฟล์
                                        <input
                                            hidden
                                            type="file"
                                            accept="application/pdf"
                                            onChange={(e) => {
                                                const f = e.currentTarget.files?.[0];
                                                if (f) attachFile(r.studentId, r.item.id, f);
                                                e.currentTarget.value = "";
                                            }}
                                        />
                                    </label>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan={7} style={{ color: "#6b7280" }}>— ไม่มีข้อมูล —</td></tr>}
                    </tbody>
                </table>
            </section>

            <style>{`
        .doc-table{ table-layout: fixed; }
        .col-title{ width: 28ch; }
        .col-file{ width: 20ch; }
        .cell-ellipsis{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

        .btn.ghost{ background:#fff; color:#0f172a; border:1px solid rgba(0,0,0,.08); border-radius:10px; padding:10px 14px; font-weight:700 }
        .btn.ghost:hover{ background:#f8fafc; border-color:#c7d2fe; box-shadow:0 1px 0 rgba(0,0,0,.02), 0 6px 14px rgba(0,116,183,.14) }

        /* Status badge */
        .status-badge{
          display:inline-flex; align-items:center; gap:8px;
          padding: 4px 10px; border-radius: 999px; font-weight: 800; font-size: 12px;
        }
        .st-waiting{ background: #F3F4F6; color: #374151; }
        .st-under-review{ background: rgba(0,116,183,.10); color: #0074B7; }
        .st-approved{ background: rgba(16,185,129,.12); color: #059669; }
        .st-rejected{ background: rgba(239,68,68,.12); color: #DC2626; }

        @media (max-width:1024px){
          .tools{ margin-left: 18px !important; }
          .tools .input{ flex: 1 1 100% !important; min-width: 0 !important; }
          .tools select{ flex-basis: 100% !important; }
          .tools .btn{ flex-basis: 100% !important; }

          .col-title{ width: 22ch; }
          .col-file{ width: 16ch; }
        }
      `}</style>
        </div>
    );
}

function StatusBadge({ status }: { status: DocStatus }) {
    const label =
        status === "waiting" ? "รอส่ง" :
            status === "under-review" ? "รอพิจารณา" :
                status === "approved" ? "ผ่าน" : "ไม่ผ่าน";
    const cls =
        status === "waiting" ? "st-waiting" :
            status === "under-review" ? "st-under-review" :
                status === "approved" ? "st-approved" : "st-rejected";
    return <span className={`status-badge ${cls}`}>{label}</span>;
}

function Export({ rows }: { rows: { studentId: string; name: string; item: DocumentItem }[] }) {
    function onClick() {
        const data = rows.map(r => ({
            studentId: r.studentId,
            name: r.name,
            title: r.item.title,
            status: r.item.status,
            file: r.item.fileName || "",
            lastUpdated: r.item.lastUpdated || ""
        }));
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "docs_export.json";
        a.click();
        URL.revokeObjectURL(a.href);
    }
    return (
        <button className="btn" onClick={onClick} type="button" style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}>
            ส่งออกผลรวม (JSON)
        </button>
    );
}
