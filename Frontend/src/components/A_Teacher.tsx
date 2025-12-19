import React, { useEffect, useRef, useState } from "react";
import { IcUser, IcEdit, IcSave } from "./icons";

/* =========================
   Types
========================= */
type TeacherProfile = {
  firstName: string;
  lastName: string;
  email: string; // primary key
  phone: string;
  department?: string;
};

const EMPTY: TeacherProfile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  department: "",
};

/* =========================
   Storage / API ready
========================= */
const LS_PROFILE = "coop.teacher.profile";
const LS_EMAIL = "coop.teacher.email";
const LS_DISPLAY = "coop.teacher.displayName";
const useApi = false;

function normalize(p: TeacherProfile): TeacherProfile {
  return {
    firstName: p.firstName.trim(),
    lastName: p.lastName.trim(),
    email: p.email.trim().toLowerCase(),
    phone: p.phone.replace(/\D/g, "").slice(0, 10),
    department: (p.department || "").trim(),
  };
}

async function loadProfile(): Promise<TeacherProfile> {
  if (useApi) {
    const r = await fetch("/api/teacher/me");
    return normalize(await r.json());
  }
  const raw = localStorage.getItem(LS_PROFILE);
  return raw ? normalize(JSON.parse(raw)) : { ...EMPTY };
}

async function saveProfile(p: TeacherProfile) {
  const next = normalize(p);
  if (useApi) {
    await fetch("/api/teacher/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    return;
  }
  localStorage.setItem(LS_PROFILE, JSON.stringify(next));
  localStorage.setItem(LS_EMAIL, next.email);
  localStorage.setItem(
    LS_DISPLAY,
    `${next.firstName} ${next.lastName}`.trim() || "อาจารย์"
  );
}

/* =========================
   Component
========================= */
export default function T_Profile() {
  const [profile, setProfile] = useState<TeacherProfile>(EMPTY);
  const [form, setForm] = useState<TeacherProfile>(EMPTY);
  const [isEditing, setIsEditing] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    loadProfile().then((p) => {
      setProfile(p);
      setForm(p);
    });
    return () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
  };
}, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = normalize(form);
    await saveProfile(next);
    setProfile(next);
    setIsEditing(false);
    setSavedMsg("บันทึกข้อมูลเรียบร้อยแล้ว");
    timer.current = window.setTimeout(() => setSavedMsg(""), 2500);
  }

  return (
    <div className="page" style={{ padding: 24 }}>
      <section className="card profile-card">
        {/* ===== Header ===== */}
        <div className="profile-header">
          <div className="profile-title">
            <IcUser width={26} height={26} />
            <div>
              <h2>โปรไฟล์อาจารย์นิเทศ</h2>
              <p>ใช้อีเมลเป็นตัวเชื่อมกับการจัดสรรนักศึกษา (Admin)</p>
            </div>
          </div>

          {!isEditing && (
            <button className="btn-ico" onClick={() => setIsEditing(true)}>
              <IcEdit width={18} height={18} />
            </button>
          )}
        </div>

        {savedMsg && <div className="alert-ok">{savedMsg}</div>}

        {/* ===== View ===== */}
        {!isEditing && (
          <div className="info-grid">
            <Info label="ชื่อ" value={profile.firstName} />
            <Info label="นามสกุล" value={profile.lastName} />
            <Info label="อีเมล" value={profile.email} />
            <Info label="เบอร์โทร" value={profile.phone} />
            <Info label="ภาควิชา / สาขา" value={profile.department} />
          </div>
        )}

        {/* ===== Edit ===== */}
        {isEditing && (
          <form onSubmit={submit} className="form-grid">
            <Input label="ชื่อ" value={form.firstName}
              onChange={(v) => setForm({ ...form, firstName: v })} />
            <Input label="นามสกุล" value={form.lastName}
              onChange={(v) => setForm({ ...form, lastName: v })} />
            <Input label="อีเมล (ใช้เชื่อมระบบ)" type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })} />
            <Input label="เบอร์โทร" value={form.phone}
              onChange={(v) =>
                setForm({ ...form, phone: v.replace(/\D/g, "").slice(0, 10) })
              } />
            <Input label="ภาควิชา / สาขา" value={form.department || ""}
              onChange={(v) => setForm({ ...form, department: v })} />

            <div className="actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setForm(profile);
                  setIsEditing(false);
                }}
              >
                ยกเลิก
              </button>
              <button className="btn" type="submit">
                <IcSave width={16} height={16} /> บันทึก
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ===== Styles ===== */}
      <style>{`
        .profile-card{
          max-width: 920px;
          margin: auto;
          padding: 32px;
        }
        .profile-header{
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          margin-bottom:20px;
        }
        .profile-title{
          display:flex;
          gap:12px;
          align-items:flex-start;
        }
        .profile-title h2{
          margin:0;
          font-size:22px;
          font-weight:800;
        }
        .profile-title p{
          margin:4px 0 0;
          font-size:13px;
          color:#6b7280;
        }
        .info-grid{
          display:grid;
          grid-template-columns: repeat(2, minmax(0,1fr));
          gap:16px 24px;
          margin-top:16px;
        }
        .form-grid{
          display:grid;
          grid-template-columns: repeat(2, minmax(0,1fr));
          gap:16px 24px;
          margin-top:16px;
        }
        .actions{
          grid-column:1/-1;
          display:flex;
          justify-content:center;
          gap:12px;
          margin-top:24px;
        }
        .alert-ok{
          margin-top:16px;
          padding:12px 16px;
          border-radius:12px;
          background:#ECFDF5;
          border:1px solid #6EE7B7;
          color:#065F46;
          font-weight:600;
        }
        .btn-ico{
          width:40px;height:40px;
          border-radius:12px;
          border:1px solid #e5e7eb;
          background:#fff;
        }
        @media(max-width:900px){
          .info-grid,.form-grid{ grid-template-columns:1fr; }
          .profile-card{ padding:24px; }
        }
      `}</style>
    </div>
  );
}

/* =========================
   Small UI
========================= */
function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 500 }}>
        {value || "-"}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
