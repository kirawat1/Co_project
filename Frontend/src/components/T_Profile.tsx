import React, { useEffect, useRef, useState } from "react";
import { IcUser, IcEdit, IcSave } from "./icons";

/* =========================
   Types (Model)
========================= */
export type TeacherProfile = {
  firstName: string;
  lastName: string;
  email: string; // PRIMARY KEY
  phone: string;
  department?: string;
};

/* =========================
   Data Service (API-ready)
========================= */

/**
 * โหมดในอนาคต:
 * - เปลี่ยน useApi = true
 * - ต่อ endpoint มหาวิทยาลัยได้ทันที
 */
const useApi = false;

const API_BASE = "/api/teacher"; // placeholder
const LS_PROFILE = "coop.teacher.profile";
const LS_EMAIL = "coop.teacher.email";
const LS_DISPLAY = "coop.teacher.displayName";

const EMPTY: TeacherProfile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  department: "",
};

function normalize(p: TeacherProfile): TeacherProfile {
  return {
    firstName: p.firstName.trim(),
    lastName: p.lastName.trim(),
    email: p.email.trim().toLowerCase(),
    phone: p.phone.replace(/\D/g, "").slice(0, 10),
    department: (p.department || "").trim(),
  };
}

/* ---------- Service ---------- */
const TeacherService = {
  async getProfile(): Promise<TeacherProfile> {
    if (useApi) {
      const res = await fetch(`${API_BASE}/me`);
      if (!res.ok) throw new Error("โหลดข้อมูลอาจารย์ไม่สำเร็จ");
      return normalize(await res.json());
    }

    // localStorage (current)
    try {
      const raw = localStorage.getItem(LS_PROFILE);
      if (!raw) return { ...EMPTY };
      return normalize({ ...EMPTY, ...(JSON.parse(raw) as TeacherProfile) });
    } catch {
      return { ...EMPTY };
    }
  },

  async saveProfile(profile: TeacherProfile): Promise<void> {
    const next = normalize(profile);

    if (useApi) {
      const res = await fetch(`${API_BASE}/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("บันทึกข้อมูลไม่สำเร็จ");
      return;
    }

    // localStorage (current)
    localStorage.setItem(LS_PROFILE, JSON.stringify(next));
    localStorage.setItem(LS_EMAIL, next.email);
    localStorage.setItem(
      LS_DISPLAY,
      `${next.firstName} ${next.lastName}`.trim() || "อาจารย์"
    );
  },
};

/* =========================
   Component
========================= */
export default function T_Profile() {
  const [profile, setProfile] = useState<TeacherProfile>({ ...EMPTY });
  const [form, setForm] = useState<TeacherProfile>({ ...EMPTY });
  const [isEditing, setIsEditing] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const timerRef = useRef<number | null>(null);

  /* ---------- load ---------- */
  useEffect(() => {
    TeacherService.getProfile().then(setProfile);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  function startEdit() {
    setForm(profile);
    setIsEditing(true);
    setSavedMsg("");
  }

  function cancelEdit() {
    setIsEditing(false);
    setSavedMsg("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = normalize(form);

    await TeacherService.saveProfile(next);
    setProfile(next);
    setIsEditing(false);
    setSavedMsg("บันทึกข้อมูลเรียบร้อยแล้ว");

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setSavedMsg(""), 2500);
  }

  return (
    <div className="page" style={{ padding: 4, margin: 28 }}>
      <section className="card" style={{ padding: 24 }}>
        {/* ---------- Header ---------- */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IcUser width={28} height={28} />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0 }}>โปรไฟล์อาจารย์นิเทศ</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
              ใช้ <b>อีเมล</b> เป็นตัวเชื่อมกับการจัดสรรนักศึกษา (Admin)
            </p>
          </div>

          {!isEditing && (
            <button className="btn-ico" onClick={startEdit} title="แก้ไข">
              <IcEdit width={18} height={18} />
            </button>
          )}
        </div>

        {savedMsg && (
          <div className="alert ok" style={{ marginTop: 12 }}>
            {savedMsg}
          </div>
        )}

        {/* ---------- View Mode ---------- */}
        {!isEditing && (
          <div className="info-grid" style={{ marginTop: 20 }}>
            <ViewRow label="ชื่อ" value={profile.firstName || "-"} />
            <ViewRow label="นามสกุล" value={profile.lastName || "-"} />
            <ViewRow label="อีเมล (ตัวเชื่อมระบบ)" value={profile.email || "-"} />
            <ViewRow label="เบอร์โทร" value={profile.phone || "-"} />
            <ViewRow label="ภาควิชา / สาขา" value={profile.department || "-"} />
          </div>
        )}

        {/* ---------- Edit Mode ---------- */}
        {isEditing && (
          <form
            onSubmit={submit}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              maxWidth: 720,
              marginTop: 16,
            }}
          >
            <FieldEdit
              label="ชื่อ"
              value={form.firstName}
              onChange={(v) => setForm({ ...form, firstName: v })}
              required
            />
            <FieldEdit
              label="นามสกุล"
              value={form.lastName}
              onChange={(v) => setForm({ ...form, lastName: v })}
              required
            />

            <FieldEdit
              label="อีเมล (ใช้เชื่อมระบบ)"
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              hint="ต้องตรงกับอีเมลที่ Admin เพิ่มอาจารย์"
              required
            />

            <FieldEdit
              label="เบอร์โทร"
              inputMode="tel"
              value={form.phone}
              onChange={(v) =>
                setForm({ ...form, phone: v.replace(/\D/g, "").slice(0, 10) })
              }
              hint="ตัวเลข 10 หลัก"
              required
            />

            <FieldEdit
              label="ภาควิชา / สาขา"
              value={form.department || ""}
              onChange={(v) => setForm({ ...form, department: v })}
            />

            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 8,
              }}
            >
              <button
                type="button"
                className="btn ghost"
                onClick={cancelEdit}
              >
                ยกเลิก
              </button>
              <button type="submit" className="btn">
                <IcSave width={16} height={16} style={{ marginRight: 6 }} />
                บันทึก
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ---------- styles ---------- */}
      <style>{`
        .alert.ok{
          color:#065F46; background:#ECFDF5;
          border:1px solid #6EE7B7;
          padding:10px 12px; border-radius:12px;
          font-size:14px; font-weight:800;
        }
        .info-grid{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap:12px;
        }
        .info-row{
          display:grid;
          grid-template-columns: 140px 1fr;
          gap:8px;
        }
        .lbl{ color:#6b7280; font-size:13px; font-weight:800 }
        .val{ font-weight:600; color:#0f172a }
        .btn-ico{
          width:36px; height:36px;
          border-radius:10px;
          border:1px solid rgba(0,0,0,.08);
          background:#fff;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
        }
        .btn-ico:hover{ color:#0074B7 }
        @media (max-width:1024px){
          .info-grid{ grid-template-columns: 1fr }
          form{ grid-template-columns: 1fr !important }
          .info-row{ grid-template-columns: 1fr }
        }
      `}</style>
    </div>
  );
}

/* =========================
   Small UI Parts
========================= */
function ViewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <div className="lbl">{label}</div>
      <div className="val">{value}</div>
    </div>
  );
}

function FieldEdit(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: React.HTMLInputTypeAttribute;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  hint?: string;
  required?: boolean;
}) {
  const { label, value, onChange, type = "text", inputMode, hint, required } =
    props;

  return (
    <div style={{ display: "grid", gap: 6 }}>
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
