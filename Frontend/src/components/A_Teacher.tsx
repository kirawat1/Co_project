// src/components/A_Teachers.tsx
import { useEffect, useMemo, useState } from "react";
import type { TeacherProfile } from "./store";
import { loadTeachers, saveTeachers } from "./store";

const KP = "coop.teacher.profile"; // auto-import on mount

function genId() {
    return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type FormState = {
    id?: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    department?: string;
    title?: string;
};

export default function A_Teachers() {
    const [items, setItems] = useState<TeacherProfile[]>(() => loadTeachers());
    const [q, setQ] = useState("");
    const [showAdd, setShowAdd] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [form, setForm] = useState<FormState>({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        department: "",
        title: "",
    });

    // ---------- auto-import from coop.teacher.profile (หนึ่งครั้งตอน mount) ----------
    useEffect(() => {
        try {
            const raw = localStorage.getItem(KP);
            if (!raw) return;
            const p = JSON.parse(raw);
            if (!p || !p.email) return;

            const exists = items.some(
                (x) => x.email.toLowerCase() === String(p.email).toLowerCase()
            );
            if (exists) return;

            const newItem: TeacherProfile = {
                id: genId(),
                firstName: String(p.firstName || ""),
                lastName: String(p.lastName || ""),
                email: String(p.email || ""),
                phone: p.phone ? String(p.phone) : "",
                department: p.department ? String(p.department) : "",
                title: p.title ? String(p.title) : "",
            };
            const next = [...items, newItem];
            setItems(next);
            saveTeachers(next);
        } catch {
            // ignore
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(
        () =>
            items.filter((t) => {
                const s = `${t.firstName || ""} ${t.lastName || ""} ${t.email || ""} ${t.phone || ""
                    } ${t.department || ""} ${t.title || ""}`.toLowerCase();
                return s.includes(q.toLowerCase());
            }),
        [items, q]
    );

    function remove(id: string) {
        if (!confirm("ลบอาจารย์คนนี้?")) return;
        const next = items.filter((t) => t.id !== id);
        setItems(next);
        saveTeachers(next);
    }

    function openAdd() {
        setForm({
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            department: "",
            title: "",
        });
        setShowAdd(true);
    }

    function openEdit(t: TeacherProfile) {
        setForm({ ...t });
        setShowEdit(true);
    }

    function closeAll() {
        setShowAdd(false);
        setShowEdit(false);
    }

    function saveAdd(e: React.FormEvent) {
        e.preventDefault();
        const firstName = form.firstName.trim();
        const lastName = form.lastName.trim();
        const email = form.email.trim();
        if (!firstName || !lastName || !email) {
            alert("กรุณากรอก ชื่อ / นามสกุล / อีเมล");
            return;
        }
        const dup = items.some((x) => x.email.toLowerCase() === email.toLowerCase());
        if (dup) {
            alert("อีเมลนี้มีอยู่แล้ว");
            return;
        }
        const newItem: TeacherProfile = {
            id: genId(),
            firstName,
            lastName,
            email,
            phone: (form.phone || "").trim(),
            department: (form.department || "").trim(),
            title: (form.title || "").trim(),
        };
        const next = [...items, newItem];
        setItems(next);
        saveTeachers(next);
        setShowAdd(false);
    }

    function saveEdit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.id) return;
        const firstName = form.firstName.trim();
        const lastName = form.lastName.trim();
        const email = form.email.trim();
        if (!firstName || !lastName || !email) {
            alert("กรุณากรอก ชื่อ / นามสกุล / อีเมล");
            return;
        }
        // ตรวจ email ซ้ำ (ยกเว้นของตัวเอง)
        const dup = items.some(
            (x) => x.id !== form.id && x.email.toLowerCase() === email.toLowerCase()
        );
        if (dup) {
            alert("อีเมลนี้มีอยู่แล้ว");
            return;
        }
        const next = items.map((x) =>
            x.id === form.id
                ? {
                    ...x,
                    firstName,
                    lastName,
                    email,
                    phone: (form.phone || "").trim(),
                    department: (form.department || "").trim(),
                    title: (form.title || "").trim(),
                }
                : x
        );
        setItems(next);
        saveTeachers(next);
        setShowEdit(false);
    }

    function exportPdf(rows: TeacherProfile[]) {
        const w = window.open("", "_blank");
        if (!w) {
            alert("ไม่สามารถเปิดหน้าพิมพ์ได้");
            return;
        }
        const style = `
      <style>
        body{ font-family: ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans","Apple Color Emoji","Segoe UI Emoji"; padding:20px; }
        h1{ margin:0 0 12px; font-size:18px; }
        table{ width:100%; border-collapse:collapse; }
        th, td{ border:1px solid #e5e7eb; padding:8px 10px; font-size:12px; }
        th{ background:#f8fafc; text-align:left; }
        .muted{ color:#6b7280; }
      </style>`;
        const rowsHtml = rows
            .map((t) => {
                const name = `${t.firstName || ""} ${t.lastName || ""}`.trim();
                return `<tr>
          <td>${name || "-"}</td>
          <td>${t.email || "-"}</td>
          <td>${t.phone || "-"}</td>
          <td>${t.department || "-"}</td>
          <td>${t.title || "-"}</td>
        </tr>`;
            })
            .join("");
        const html = `
      <html><head><meta charset="utf-8" />${style}</head>
      <body>
        <h1>รายชื่ออาจารย์ <span class="muted">(${rows.length} รายการ)</span></h1>
        <table>
          <thead><tr><th>ชื่อ-นามสกุล</th><th>อีเมล</th><th>เบอร์</th><th>หน่วยงาน</th><th>ตำแหน่ง</th></tr></thead>
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <h2 style={{ marginTop: 8, marginLeft: 18 }}>ข้อมูลอาจารย์</h2>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn" onClick={() => exportPdf(filtered)} type="button">ส่งออก PDF</button>
                        <button className="btn" onClick={openAdd} type="button">เพิ่มอาจารย์</button>
                    </div>
                </div>

                <div
                    className="tools"
                    style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginLeft: 18, marginTop: 12 }}
                >
                    <input
                        className="input"
                        placeholder="ค้นหา: ชื่อ/อีเมล/หน่วยงาน/ตำแหน่ง"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        style={{ flex: "0 1 420px", minWidth: 260 }}
                    />
                    <button className="btn" onClick={() => setQ("")} type="button">ล้างคำค้น</button>
                </div>
            </section>

            {/* ตารางเต็มความกว้าง */}
            <section className="card" style={{ padding: 24, overflowX: "auto" }}>
                <table className="doc-table" style={{ width: "100%" }}>
                    <colgroup>
                        <col style={{ width: "20ch" }} /> {/* ชื่อ */}
                        <col style={{ width: "28ch" }} /> {/* อีเมล */}
                        <col style={{ width: "16ch" }} /> {/* เบอร์ */}
                        <col style={{ width: "20ch" }} /> {/* หน่วยงาน */}
                        <col style={{ width: "16ch" }} /> {/* ตำแหน่ง */}
                        <col style={{ width: "16ch" }} /> {/* การทำงาน */}
                    </colgroup>

                    <thead>
                        <tr>
                            <th align="left">ชื่อ-นามสกุล</th>
                            <th align="left">อีเมล</th>
                            <th align="left">เบอร์</th>
                            <th align="left">หน่วยงาน</th>
                            <th align="left">ตำแหน่ง</th>
                            <th style={{ textAlign: "right" }}>การทำงาน</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filtered.map((t) => (
                            <tr key={t.id} className="row">
                                <td>{t.firstName} {t.lastName}</td>
                                <td className="cell-ellipsis" title={t.email || "-"}>{t.email || "-"}</td>
                                <td className="cell-ellipsis" title={t.phone || "-"}>{t.phone || "-"}</td>
                                <td className="cell-ellipsis" title={t.department || "-"}>{t.department || "-"}</td>
                                <td className="cell-ellipsis" title={t.title || "-"}>{t.title || "-"}</td>
                                <td className="cell-actions" style={{ textAlign: "right" }}>
                                    <button className="btn small" onClick={() => openEdit(t)} type="button">แก้ไข</button>
                                    <button className="btn ghost small" onClick={() => remove(t.id)} type="button">ลบ</button>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={6} style={{ color: "#6b7280" }}>— ไม่มีข้อมูล —</td></tr>
                        )}
                    </tbody>
                </table>
            </section>

            {/* ===== Modals ===== */}
            {showAdd && (
                <Modal title="เพิ่มอาจารย์ใหม่" onClose={closeAll}>
                    <TeacherForm form={form} setForm={setForm} onSubmit={saveAdd} submitText="เพิ่มอาจารย์" />
                </Modal>
            )}
            {showEdit && (
                <Modal title="แก้ไขข้อมูลอาจารย์" onClose={closeAll}>
                    <TeacherForm form={form} setForm={setForm} onSubmit={saveEdit} submitText="บันทึกการแก้ไข" />
                </Modal>
            )}

            <style>{`
        .btn.ghost{ background:#fff; color:#0f172a; border:1px solid rgba(0,0,0,.08); border-radius:10px; padding:10px 14px; font-weight:700 }
        .btn.ghost:hover{ background:#f8fafc; border-color:#c7d2fe; box-shadow:0 1px 0 rgba(0,0,0,.02), 0 6px 14px rgba(0,116,183,.14) }
        .btn.small { font-size: 12px; padding: 4px 8px; min-width: auto; border-radius: 6px; }
        .cell-ellipsis{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .cell-actions{ display:flex; gap:8px; justify-content:flex-end; align-items:center; white-space:nowrap; }

        /* Modal */
        .modal-wrap{ position: fixed; inset: 0; z-index: 50; }
        .modal-overlay{ position: absolute; inset: 0; background: rgba(15,23,42,.35); }
        .modal{
          position: relative;
          width: min(720px, 92vw);
          margin: 8vh auto 0;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid rgba(0,0,0,.06);
          background: #fff;
        }
      `}</style>
        </div>
    );
}

/* ---------- Modal Shell ---------- */
function Modal({
    title,
    onClose,
    children,
}: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="modal-wrap" role="dialog" aria-modal="true" aria-label={title}>
            <div className="modal-overlay" onClick={onClose} />
            <div className="modal card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
                    <button className="icon-btn" title="ปิด" aria-label="ปิด" onClick={onClose} type="button">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div style={{ marginTop: 12 }}>{children}</div>
            </div>
        </div>
    );
}

/* ---------- Form ---------- */
function TeacherForm({
    form,
    setForm,
    onSubmit,
    submitText,
}: {
    form: FormState;
    setForm: (f: FormState) => void;
    onSubmit: (e: React.FormEvent) => void;
    submitText: string;
}) {
    return (
        <form onSubmit={onSubmit}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="ชื่อ" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} required />
            <Field label="นามสกุล" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} required />
            <Field label="อีเมล" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
            <Field label="เบอร์" inputMode="tel" value={form.phone || ""} onChange={(v) => setForm({ ...form, phone: v.replace(/\D/g, "").slice(0, 10) })} />
            <Field label="หน่วยงาน" value={form.department || ""} onChange={(v) => setForm({ ...form, department: v })} />
            <Field label="ตำแหน่ง" value={form.title || ""} onChange={(v) => setForm({ ...form, title: v })} />

            <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                <button className="btn" type="submit">{submitText}</button>
            </div>
        </form>
    );
}

function Field({
    label, value, onChange, type = "text", inputMode, required
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: React.HTMLInputTypeAttribute;
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
    required?: boolean;
}) {
    return (
        <div style={{ display: "grid", gap: 5 }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{label}</div>
            <input
                className="input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                type={type}
                inputMode={inputMode}
                required={required}
            />
        </div>
    );
}
