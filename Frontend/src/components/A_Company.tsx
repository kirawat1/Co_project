// src/components/A_Companies.tsx
import React, { useMemo, useState } from "react";

// --- Types & Local Storage Utilities ---
export interface AdminCompanyRecord {
    id: string; // Unique ID (for simplicity, using string)
    name: string;
    address: string;
    contactEmail: string; // อีเมลติดต่อ
    pastCoopYears: string; // ปีที่มีการส่งไป เช่น "2565, 2566"
}

const K_COMPANIES = "coop.admin.companies";

function loadCompanies(): AdminCompanyRecord[] {
    try { return JSON.parse(localStorage.getItem(K_COMPANIES) || "[]"); }
    catch { return []; }
}
function saveCompanies(list: AdminCompanyRecord[]) {
    localStorage.setItem(K_COMPANIES, JSON.stringify(list));
}
function genId() {
    return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type FormState = Omit<AdminCompanyRecord, 'id'> & { id?: string };

// --- Main Component ---
export default function A_Companies() {
    const [items, setItems] = useState<AdminCompanyRecord[]>(() => loadCompanies());
    const [q, setQ] = useState("");
    const [showAdd, setShowAdd] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [form, setForm] = useState<FormState>({
        name: "", address: "", contactEmail: "", pastCoopYears: "",
    });

    // กรองและค้นหา
    const filtered = useMemo(
        () =>
            items.filter((c) => {
                const s = `${c.name || ""} ${c.address || ""} ${c.contactEmail || ""} ${c.pastCoopYears || ""}`.toLowerCase();
                return s.includes(q.toLowerCase());
            }),
        [items, q]
    );

    function remove(id: string) {
        if (!confirm("ลบบริษัทนี้ออกจากประวัติ?")) return;
        const next = items.filter((c) => c.id !== id);
        setItems(next);
        saveCompanies(next);
    }

    function openAdd() {
        setForm({ name: "", address: "", contactEmail: "", pastCoopYears: "" });
        setShowAdd(true);
    }

    function openEdit(c: AdminCompanyRecord) {
        setForm({ ...c });
        setShowEdit(true);
    }

    function closeAll() {
        setShowAdd(false);
        setShowEdit(false);
    }

    function saveAdd(e: React.FormEvent) {
        e.preventDefault();
        const { name, address, contactEmail } = form;
        if (!name.trim() || !address.trim() || !contactEmail.trim()) {
            alert("กรุณากรอก ชื่อบริษัท / ที่อยู่ / อีเมลติดต่อ");
            return;
        }

        const newItem: AdminCompanyRecord = {
            id: genId(),
            name: name.trim(),
            address: address.trim(),
            contactEmail: contactEmail.trim(),
            pastCoopYears: (form.pastCoopYears || "").trim(),
        };
        const next = [...items, newItem];
        setItems(next);
        saveCompanies(next);
        setShowAdd(false);
    }

    function saveEdit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.id) return;
        const { name, address, contactEmail } = form;
        if (!name.trim() || !address.trim() || !contactEmail.trim()) {
            alert("กรุณากรอก ชื่อบริษัท / ที่อยู่ / อีเมลติดต่อ");
            return;
        }

        const next = items.map((x) =>
            x.id === form.id
                ? {
                    ...x,
                    name: name.trim(),
                    address: address.trim(),
                    contactEmail: contactEmail.trim(),
                    pastCoopYears: (form.pastCoopYears || "").trim(),
                }
                : x
        );
        setItems(next);
        saveCompanies(next);
        setShowEdit(false);
    }

    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
            <section className="card" style={{ padding: 24, marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <h2 style={{ marginTop: 8, marginLeft: 18 }}>ข้อมูลบริษัทสหกิจศึกษา</h2>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn" onClick={openAdd} type="button">เพิ่มบริษัท</button>
                    </div>
                </div>

                <div
                    className="tools"
                    style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginLeft: 18, marginTop: 12 }}
                >
                    <input
                        className="input"
                        placeholder="ค้นหา: ชื่อ/ที่อยู่/อีเมล/ปี"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        style={{ flex: "0 1 420px", minWidth: 260 }}
                    />
                    <button className="btn" onClick={() => setQ("")} type="button">ล้างคำค้น</button>
                </div>
            </section>

            {/* ตารางเต็มความกว้าง */}
            <section className="card" style={{ padding: 24, overflowX: "auto" }}>
                <table className="doc-table" style={{ width: "100%", tableLayout: "fixed" }}>
                    <colgroup>
                        <col style={{ width: "20ch" }} /> {/* ชื่อ */}
                        <col style={{ width: "30ch" }} /> {/* ที่อยู่ */}
                        <col style={{ width: "22ch" }} /> {/* อีเมล */}
                        <col style={{ width: "16ch" }} /> {/* ปี */}
                        <col style={{ width: "16ch" }} /> {/* การทำงาน */}
                    </colgroup>

                    <thead>
                        <tr>
                            <th align="left">ชื่อบริษัท</th>
                            <th align="left">ที่อยู่</th>
                            <th align="left">อีเมลติดต่อ</th>
                            <th align="left">ปีที่รับ นศ.</th>
                            <th style={{ textAlign: "right" }}>การทำงาน</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filtered.map((c) => (
                            <tr key={c.id} className="row">
                                <td className="cell-ellipsis" title={c.name}>{c.name}</td>
                                <td className="cell-ellipsis" title={c.address}>{c.address || "-"}</td>
                                <td className="cell-ellipsis" title={c.contactEmail}>{c.contactEmail || "-"}</td>
                                <td className="cell-ellipsis" title={c.pastCoopYears}>{c.pastCoopYears || "-"}</td>
                                <td className="cell-actions" style={{ textAlign: "right" }}>
                                    <button className="btn small" onClick={() => openEdit(c)} type="button">แก้ไข</button>
                                    <button className="btn ghost small" onClick={() => remove(c.id)} type="button">ลบ</button>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={5} style={{ color: "#6b7280" }}>— ไม่มีข้อมูล —</td></tr>
                        )}
                    </tbody>
                </table>
            </section>

            {/* ===== Modals ===== */}
            {showAdd && (
                <Modal title="เพิ่มบริษัทใหม่" onClose={closeAll}>
                    <CompanyForm form={form} setForm={setForm} onSubmit={saveAdd} submitText="เพิ่มบริษัท" />
                </Modal>
            )}
            {showEdit && (
                <Modal title="แก้ไขข้อมูลบริษัท" onClose={closeAll}>
                    <CompanyForm form={form} setForm={setForm} onSubmit={saveEdit} submitText="บันทึกการแก้ไข" />
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

/* ---------- Modal Shell (คัดลอกมาจาก A_Teacher.tsx) ---------- */
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

/* ---------- Form (คัดลอกมาจาก A_Teacher.tsx และดัดแปลง) ---------- */
function CompanyForm({
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

            <div style={{ gridColumn: "span 2", display: "grid", gap: 10 }}>
                <Field label="ชื่อบริษัท" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
                <Field label="ที่อยู่" isTextArea value={form.address} onChange={(v) => setForm({ ...form, address: v })} required />
            </div>

            <Field label="อีเมลติดต่อ" type="email" value={form.contactEmail} onChange={(v) => setForm({ ...form, contactEmail: v })} required />
            <Field label="ปีที่เคยรับ นศ. (คั่นด้วย ,)" value={form.pastCoopYears} onChange={(v) => setForm({ ...form, pastCoopYears: v })} />

            <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                <button className="btn" type="submit">{submitText}</button>
            </div>
        </form>
    );
}

function Field({
    label, value, onChange, type = "text", isTextArea = false, required
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: React.HTMLInputTypeAttribute;
    isTextArea?: boolean;
    required?: boolean;
}) {
    return (
        <div style={{ display: "grid", gap: 5 }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{label}</div>
            {isTextArea ? (
                <textarea
                    className="input"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    required={required}
                    rows={2}
                    style={{ minHeight: 60 }}
                />
            ) : (
                <input
                    className="input"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    type={type}
                    required={required}
                />
            )}
        </div>
    );
}