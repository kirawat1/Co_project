// src/components/T_Students.tsx
import { useMemo, useState } from "react";
import type { StudentProfile, DocumentItem, DocStatus } from "./store";

const KS = "coop.student.profile.v1";

// โหลดรายชื่อนักศึกษาทั้งหมด (Teacher: read-only)
function loadStudents(): StudentProfile[] {
    try { return JSON.parse(localStorage.getItem(KS) || "[]"); }
    catch { return []; }
}

export default function T_Students() {
    const [items] = useState<StudentProfile[]>(() => loadStudents()); // ❗ อ่านอย่างเดียว
    const [q, setQ] = useState("");
    const [activeId, setActiveId] = useState<string>("");

    const filtered = useMemo(
        () =>
            items.filter((s) => {
                const name = `${s.firstName || ""} ${s.lastName || ""} ${s.studentId || ""}`.toLowerCase();
                return name.includes(q.toLowerCase());
            }),
        [items, q]
    );

    const selected = items.find((s) => s.studentId === activeId) || null;

    function exportPdf(rows: StudentProfile[]) {
        const w = window.open("", "_blank");
        if (!w) { alert("ไม่สามารถเปิดหน้าพิมพ์ได้"); return; }

        const style = `
      <style>
        body{ font-family: ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans","Apple Color Emoji","Segoe UI Emoji"; padding:20px; }
        h1{ margin:0 0 12px; font-size:18px; }
        table{ width:100%; border-collapse:collapse; }
        th, td{ border:1px solid #e5e7eb; padding:8px 10px; font-size:12px; }
        th{ background:#f8fafc; text-align:left; }
        .muted{ color:#6b7280; }
      </style>`;
        const rowsHtml = rows.map((s) => {
            const name = `${s.firstName || ""} ${s.lastName || ""}`.trim();
            return `<tr>
        <td>${s.studentId || "-"}</td>
        <td>${name || "-"}</td>
        <td>${s.email || "-"}</td>
        <td>${s.phone || "-"}</td>
        <td>${s.major || s.curriculum || "-"}</td>
      </tr>`;
        }).join("");

        const html = `
      <html><head><meta charset="utf-8" />${style}</head>
      <body>
        <h1>รายชื่อนักศึกษา (Teacher) <span class="muted">(${rows.length} รายการ)</span></h1>
        <table>
          <thead><tr><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>อีเมล</th><th>เบอร์</th><th>สาขา/หลักสูตร</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),50));</script>
      </body></html>`;
        w.document.write(html);
        w.document.close();
    }

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
            <section className="card" style={{ padding: 24, marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                    <h2 style={{ marginTop: 8, marginLeft: 18 }}>นักศึกษาทั้งหมด</h2>
                </div>

                <div
                    className="tools"
                    style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginLeft: 18 }}
                >
                    <input
                        className="input"
                        placeholder="ค้นหา: ชื่อ/รหัส"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        style={{ flex: "0 1 420px", minWidth: 260 }}
                    />
                    <button className="btn" onClick={() => exportPdf(filtered)} type="button">ส่งออก PDF</button>
                </div>
            </section>

            <div className="cols" style={{ display: "grid", gridTemplateColumns: ".7fr .9fr", gap: 10 }}>
                {/* ซ้าย: ตารางรายชื่อนักศึกษา (ไม่มีปุ่มลบ/เพิ่ม) */}
                <section className="card" style={{ padding: 24, marginBottom: 28, overflowX: "auto" }}>
                    <table className="doc-table" style={{ width: "100%" }}>
                        <colgroup>
                            <col className="col-id" />
                            <col className="col-name" />
                            <col className="col-email" />
                            <col className="col-actions" />
                        </colgroup>

                        <thead>
                            <tr>
                                <th align="left">รหัส</th>
                                <th align="left">ชื่อ-นามสกุล</th>
                                <th align="left">อีเมล</th>
                                <th style={{ textAlign: "right" }}>การทำงาน</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filtered.map((s) => {
                                const isActive = s.studentId === activeId;
                                return (
                                    <tr key={s.studentId} className="row">
                                        <td>{s.studentId || "-"}</td>
                                        <td>{s.firstName} {s.lastName}</td>
                                        <td className="col-email">
                                            <span className="email" title={s.email || "-"}>{s.email || "-"}</span>
                                        </td>
                                        <td className="cell-actions">
                                            {!isActive && (
                                                <button className="btn small" onClick={() => setActiveId(s.studentId!)} type="button">
                                                    ดูรายละเอียด
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr><td colSpan={4} style={{ color: "#6b7280" }}>— ไม่มีข้อมูล —</td></tr>
                            )}
                        </tbody>
                    </table>
                </section>

                {/* ขวา: รายละเอียด + เอกสาร (อ่านอย่างเดียว) */}
                <section className="card" aria-live="polite" style={{ padding: 24, marginBottom: 28, position: "relative" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <h3 style={{ margin: 0 }}>รายละเอียด</h3>
                        {selected && (
                            <button
                                className="icon-btn"
                                aria-label="ปิดรายละเอียด"
                                title="ปิดรายละเอียด"
                                onClick={() => setActiveId("")}
                                type="button"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                    strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        )}
                    </div>

                    {selected ? (
                        <>
                            <div style={{ display: "grid", gridTemplateColumns: ".5fr .5fr", gap: 8, marginBottom: 12 }}>
                                <Field label="ชื่อ" value={selected.firstName} />
                                <Field label="นามสกุล" value={selected.lastName} />
                                <Field label="รหัสนักศึกษา" value={selected.studentId || "-"} />
                                <Field label="อีเมล" value={selected.email || "-"} />
                                <Field label="เบอร์" value={selected.phone || "-"} />
                                <Field label="GPA" value={selected.gpa ?? "-"} />
                                <Field label="สาขา" value={selected.major || "-"} />
                                <Field label="หลักสูตร" value={selected.curriculum || "-"} />
                            </div>

                            <h3>เอกสารของนักศึกษา</h3>
                            <div className="std-docs">
                                <StudentDocs items={selected.docs || []} />
                            </div>
                        </>
                    ) : (
                        <p style={{ color: "#6b7280" }}>— เลือกนักศึกษาจากตารางด้านซ้าย —</p>
                    )}
                </section>
            </div>

            <style>{`
         /* สถานะ */
        .td-status { overflow: hidden; }
        .td-status .status-meta{
        font-size: 12px;
        color: #6b7280;
        margin-top: 6px;
        }
        .chip{
        padding:4px 10px;
        border-radius:999px;
        font-weight:800;
        display:inline-block;
        white-space:nowrap;
        border:1px solid transparent;
        }
        .chip.waiting{ background:#EFF6FF; color:#1E40AF; border-color:#93C5FD; }
        .chip.under{   background:#FFF7ED; color:#9A3412; border-color:#FDBA74; }
        .chip.appr{    background:#ECFDF5; color:#065F46; border-color:#6EE7B7; }
        .chip.rej{     background:#FEF2F2; color:#B91C1C; border-color:#FCA5A5; }
   
        .btn.small { font-size: 12px; padding: 4px 8px; min-width: auto; border-radius: 6px; }
        .icon-btn{ display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:8px; border:1px solid rgba(0,0,0,.08); background:#fff; cursor:pointer; }
        .icon-btn:hover{ background:#f8fafc; }

        .doc-table{ table-layout: fixed; }
        .doc-table col.col-id{ width: 10ch; }
        .doc-table col.col-email{ width: 12ch; }
        .doc-table col.col-actions{ width: 16ch; }
        .doc-table col.col-name{ width: 12ch; }
        .doc-table .col-email .email{ display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .doc-table th:last-child{ text-align:right; }
        .cell-actions{ display:flex; justify-content:flex-end; align-items:center; gap:8px; white-space:nowrap; }
        .card{ overflow-x: auto; }

        .std-docs .doc-table{ table-layout: fixed; width:100%; }
        .std-docs .doc-table th:nth-child(2),
        .std-docs .doc-table td:nth-child(2){ width: 12ch; }
        .std-docs .doc-table td:nth-child(2){ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

        @media (max-width:1024px){
          .cols{ grid-template-columns:1fr !important }
          .tools{ margin-left: 18px !important; }
          .tools .input{ flex: 1 1 100% !important; min-width: 0 !important; }
          .doc-table col.col-email{ width: 14ch; }
          .std-docs .doc-table th:nth-child(2),
          .std-docs .doc-table td:nth-child(2){ width: 10ch; }
        }
      `}</style>
        </div>
    );
}

/* ===== เอกสารของนักศึกษา (อ่านอย่างเดียว) ===== */
function StudentDocs({ items }: { items: DocumentItem[] }) {
    const getDue = (d: any): Date | null => {
        const raw = d?.dueAt || d?.dueDate || d?.deadline || null;
        if (!raw) return null;
        const dt = new Date(raw);
        return isNaN(+dt) ? null : dt;
    };
    const isOverdue = (d: any): boolean => {
        const due = getDue(d);
        if (!due) return false;
        const end = new Date(due); end.setHours(23, 59, 59, 999);
        return Date.now() > +end;
    };

    const getFileUrl = (d: any): string | null =>
        (typeof d?.fileData === "string" && d.fileData) ||
        (typeof d?.fileUrl === "string" && d.fileUrl) ||
        (typeof d?.url === "string" && d.url) || null;

    const getName = (d: any): string => d?.title || d?.name || d?.docName || "เอกสาร";
    const getStatus = (d: any): string => d?.status || "waiting";

    const openDoc = (d: any) => {
        const url = getFileUrl(d);
        if (!url) return;
        const w = window.open(url, "_blank");
        if (!w) alert("เบราว์เซอร์บล็อกหน้าต่างใหม่");
    };

    return (
        <table className="doc-table" style={{ width: "100%", marginTop: 6 }}>
            <colgroup>
                <col style={{ width: "auto" }} />         {/* เอกสาร */}
                <col style={{ width: "120px" }} />        {/* ไฟล์ */}
                <col style={{ width: "170px" }} />        {/* สถานะ */}
            </colgroup>
            <thead>
                <tr>
                    <th align="left">เอกสาร</th>
                    <th align="right">ไฟล์</th>     {/* ✅ ชิดขวา */}
                    <th align="right">สถานะ</th>    {/* ✅ ชิดขวา */}
                </tr>
            </thead>
            <tbody>
                {(items || []).map((d, i) => {
                    const url = getFileUrl(d);
                    const hasFile = !!url;
                    const overdue = isOverdue(d);
                    return (
                        <tr key={i}>
                            <td>
                                {getName(d)}{" "}
                                {overdue && (
                                    <span
                                        style={{
                                            marginLeft: 8,
                                            padding: "2px 8px",
                                            borderRadius: 999,
                                            background: "rgba(239,68,68,.10)",
                                            color: "#ef4444",
                                            fontSize: 12,
                                            fontWeight: 800,
                                        }}
                                    >
                                        เกินกำหนด
                                    </span>
                                )}
                            </td>

                            {/* ✅ ไฟล์ชิดขวา */}
                            <td align="right">
                                {hasFile ? (
                                    <button className="btn" type="button" onClick={() => openDoc(d)}>
                                        ดูเอกสาร
                                    </button>
                                ) : (
                                    <span style={{ color: "#6b7280" }}>— ไม่มีไฟล์ —</span>
                                )}
                            </td>

                            {/* ✅ สถานะชิดขวา */}
                            <td align="right">
                                <StatusCell status={getStatus(d) as DocStatus} lastUpdated={d.lastUpdated} />
                            </td>
                        </tr>
                    );
                })}
                {(!items || items.length === 0) && (
                    <tr>
                        <td colSpan={3} style={{ color: "#6b7280", textAlign: "center" }}>
                            — ไม่มีเอกสาร —
                        </td>
                    </tr>
                )}
            </tbody>
        </table>

    );
}

function Field({ label, value }: { label: string; value: any }) {
    const show = value === undefined || value === null || value === "" ? "-" : value;
    return (
        <div className="field card" style={{ padding: 10 }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{label}</div>
            <div style={{ fontWeight: 800 }}>{show}</div>
        </div>
    );
}

function StatusCell({
    status
}: {
    status: DocStatus;
    lastUpdated?: string;
}) {
    const label =
        status === "waiting" ? "รอส่งเอกสาร" :
            status === "under-review" ? "รอพิจารณา" :
                status === "approved" ? "ผ่าน" : "ไม่ผ่าน";

    const cls =
        status === "waiting" ? "chip waiting" :
            status === "under-review" ? "chip under" :
                status === "approved" ? "chip appr" : "chip rej";
    return (
        <div className="td-status">
            <span className={cls}>{label}</span>
        </div>
    );
}