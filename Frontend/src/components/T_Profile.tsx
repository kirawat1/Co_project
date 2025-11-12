// src/components/T_Profile.tsx
import React, { useState, useEffect } from "react";

/* ===== เก็บ/โหลดโปรไฟล์อาจารย์จาก localStorage ===== */
type TeacherProfile = {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    title?: string;       // เผื่ออนาคต
    department?: string;  // เผื่ออนาคต
};

const TK = "coop.teacher.profile";

function loadTeacher(): TeacherProfile {
    try {
        const raw = localStorage.getItem(TK);
        if (raw) return JSON.parse(raw) as TeacherProfile;
    } catch { }
    return { firstName: "", lastName: "", email: "", phone: "" };
}

function saveTeacher(p: TeacherProfile) {
    localStorage.setItem(TK, JSON.stringify(p));
}

/* ---------- ไอคอนดินสอ ---------- */
function PencilIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 13.5-11.5Z" />
        </svg>
    );
}

export default function T_Profile() {
    const [profile, setProfile] = useState<TeacherProfile>(() => loadTeacher());
    const [isEditing, setIsEditing] = useState(false);
    const [savedMsg, setSavedMsg] = useState("");

    // sync เมื่อมีการเปิดหน้า (กันกรณีแท็บอื่นแก้)
    useEffect(() => setProfile(loadTeacher()), []);

    // ฟอร์มแก้ไข
    const [form, setForm] = useState<TeacherProfile>(profile);

    function enterEdit() {
        setForm(loadTeacher());
        setIsEditing(true);
        setSavedMsg("");
    }
    function cancelEdit() {
        setIsEditing(false);
        setSavedMsg("");
    }
    function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        // ทำความสะอาดเบอร์: เลข 10 หลัก
        const cleanPhone = form.phone.replace(/\D/g, "").slice(0, 10);
        const next: TeacherProfile = { ...form, phone: cleanPhone };
        setProfile(next);
        saveTeacher(next);
        setIsEditing(false);
        setSavedMsg("บันทึกข้อมูลเรียบร้อยแล้ว");
        window.setTimeout(() => setSavedMsg(""), 2500);
    }

    return (
        <div className="page" style={{ padding: 4, margin: 36, marginLeft: 55 }}>
            <section className="card" style={{ padding: 24, marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "start", gap: 12 }}>
                    <h2 style={{ margin: 0, marginLeft: 8 }}>โปรไฟล์อาจารย์</h2>
                    {!isEditing && (
                        <button
                            className="btn-ico"
                            onClick={enterEdit}
                            aria-label="แก้ไขข้อมูลโปรไฟล์"
                            title="แก้ไขข้อมูล"
                            type="button"
                        >
                            <PencilIcon />
                        </button>
                    )}
                </div>

                {/* แจ้งบันทึกสำเร็จ */}
                {savedMsg && <div className="alert ok" style={{ marginTop: 12 }}>{savedMsg}</div>}

                {/* โหมดดู */}
                {!isEditing && (
                    <div className="info-grid" style={{ marginLeft: 8, marginTop: 20 }}>
                        <ViewRow label="ชื่อ" value={profile.firstName} />
                        <ViewRow label="นามสกุล" value={profile.lastName} />
                        <ViewRow label="อีเมล" value={profile.email} />
                        <ViewRow label="เบอร์โทร" value={profile.phone} />
                    </div>
                )}

                {/* โหมดแก้ไข */}
                {isEditing && (
                    <form
                        onSubmit={onSubmit}
                        className="grid2"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            columnGap: 40,
                            rowGap: 12,
                            width: "100%",
                            maxWidth: 560,
                            marginTop: 15,
                            marginLeft: 8,
                        }}
                    >
                        <FieldEdit
                            label="ชื่อ"
                            value={form.firstName}
                            onChange={v => setForm({ ...form, firstName: v })}
                            required
                        />
                        <FieldEdit
                            label="นามสกุล"
                            value={form.lastName}
                            onChange={v => setForm({ ...form, lastName: v })}
                            required
                        />
                        <FieldEdit
                            label="อีเมล"
                            type="email"
                            inputMode="email"
                            value={form.email}
                            onChange={v => setForm({ ...form, email: v.trim() })}
                            required
                        />
                        <FieldEdit
                            label="เบอร์โทร"
                            inputMode="tel"
                            value={form.phone}
                            onChange={v => setForm({ ...form, phone: v.replace(/\D/g, "").slice(0, 10) })}
                            hint="10 หลัก (ตัวเลขเท่านั้น)"
                            required
                        />

                        <div style={{ gridColumn: "span 2", marginRight: -18, marginTop: 16, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button className="btn ghost" type="button" onClick={cancelEdit}>ยกเลิก</button>
                            <button className="btn" type="submit">บันทึกโปรไฟล์</button>
                        </div>
                    </form>
                )}
            </section>

            {/* สไตล์ย่อย */}
            <style>{`
        .page .input{
          height: 46px;
          padding: 0 14px;
        }
        .page .label{ font-weight: 700; }
        .page .btn.ghost{
          background:#fff; color:#0f172a; border:1px solid rgba(0,0,0,.08);
          border-radius:10px; padding:10px 14px; font-weight:700;
        }
        .page .btn.ghost:hover{
          background:#f8fafc; border-color:#c7d2fe;
          box-shadow:0 1px 0 rgba(0,0,0,.02), 0 6px 14px rgba(0,116,183,.14);
        }
        .page .alert.ok{
          color:#065F46; background:#ECFDF5; border:1px solid #6EE7B7;
          padding:10px 12px; border-radius:12px; font-size:14px;
        }

        .info-grid{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap:12px;
          width: 100%;
        }
        .info-row{
          display:grid;
          grid-template-columns: 100px 1fr;
          align-items:center;
          gap:2px;
          padding:4px 2px;
        }
        .info-row .lbl{ color:#6b7280; font-size:13px; font-weight:700; }
        .info-row .val{ font-weight:500; color:#0f172a; word-break:break-word; }

        .btn-ico{
          width:38px; height:38px; display:inline-flex; align-items:center; justify-content:center;
          border-radius:10px; border:1px solid rgba(0,0,0,.08);
          background:#fff; color:#0f172a; cursor:pointer;
          transition: background .12s ease, border-color .12s ease, box-shadow .12s ease, color .12s ease;
        }
        .btn-ico:hover{
          background:#f8fafc; border-color:#c7d2fe; color:#0074B7;
          box-shadow:0 1px 0 rgba(0,0,0,.02), 0 6px 14px rgba(0,116,183,.14);
        }
        .btn-ico svg{ width:20px; height:20px; display:block; }

        @media (max-width: 1024px){
          .info-grid{ grid-template-columns: 1fr; }
          .info-row{ grid-template-columns: 1fr; align-items:start; }
        }
      `}</style>
        </div>
    );
}

/* ----- แถวดูค่า ----- */
function ViewRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="info-row">
            <div className="lbl">{label}</div>
            <div className="val">{value || "-"}</div>
        </div>
    );
}

/* ----- ช่องฟอร์มแก้ไข ----- */
function FieldEdit(props: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: React.HTMLInputTypeAttribute;
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
    hint?: string;
    required?: boolean;
}) {
    const { label, value, onChange, type = "text", inputMode, hint, required } = props;
    return (
        <div style={{ display: "grid", gap: 5 }}>
            <label className="label">{label}</label>
            <input
                className="input"
                type={type}
                inputMode={inputMode}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
            />
            {hint && <div style={{ fontSize: 12, color: "#6b7280" }}>{hint}</div>}
        </div>
    );
}
