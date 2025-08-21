import React, { useState } from "react";
import type { StudentProfile, DocumentItem } from "./store";
import DocTable from "./DocTable";

/* ---------- ฟอร์มฝั่งซ้าย (เอาศาสนาออกแล้ว) ---------- */
type FormState = {
  firstName: string;
  lastName: string;
  phone: string;
  gpa: string;
  major: string;
  curriculum: string;
  nationality: string;
};

/* ฟิลด์แก้ไขได้/อ่านอย่างเดียว + type guard */
type EditableField = {
  label: string;
  key: keyof FormState;
  type?: React.HTMLInputTypeAttribute;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  step?: string;
  min?: number;
  max?: number;
};
type ReadonlyField = {
  label: string;
  key: "studentId" | "email";
  value: string;
  disabled: true;
};
type Field = EditableField | ReadonlyField;
function isReadonlyField(field: Field): field is ReadonlyField {
  return "disabled" in field && field.disabled === true;
}

/* ---------- ไอคอนดินสอ (minimal stroke) ---------- */
function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 13.5-11.5Z" />
    </svg>
  );
}

export default function ProfilePage({
  profile,
  setProfile,
}: {
  profile: StudentProfile;
  setProfile: (p: StudentProfile) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const [form, setForm] = useState<FormState>({
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    gpa: profile.gpa,
    major: profile.major,
    curriculum: profile.curriculum,
    nationality: profile.nationality,
  });

  function enterEdit() {
    setForm({
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      gpa: profile.gpa,
      major: profile.major,
      curriculum: profile.curriculum,
      nationality: profile.nationality,
    });
    setSavedMsg("");
    setIsEditing(true);
  }
  function cancelEdit() {
    setIsEditing(false);
    setSavedMsg("");
  }
  function savePersonal(e: React.FormEvent) {
    e.preventDefault();
    setProfile({ ...profile, ...form });
    setIsEditing(false);
    setSavedMsg("บันทึกข้อมูลเรียบร้อยแล้ว");
    window.setTimeout(() => setSavedMsg(""), 2500);
  }
  function updateDocs(next: DocumentItem[]) {
    setProfile({ ...profile, docs: next });
  }

  const fields: Field[] = [
    { label: "ชื่อ", key: "firstName" },
    { label: "นามสกุล", key: "lastName" },
    { label: "รหัสนักศึกษา", key: "studentId", value: profile.studentId, disabled: true },
    { label: "อีเมล", key: "email", value: profile.email, disabled: true },
    { label: "เบอร์โทร", key: "phone", inputMode: "tel" },
    { label: "เกรด (GPA)", key: "gpa", type: "number", step: "0.01", min: 0, max: 4 },
    { label: "สาขาวิชา", key: "major" },
    { label: "หลักสูตร", key: "curriculum" },
    { label: "สัญชาติ", key: "nationality" },
  ];

  return (
    <div className="page" style={{ padding: 4, margin: 36, marginLeft: 55 }}>
      <div className="cols">
        <div>
          <section className="card" style={{ padding: 24, marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "start", gap: 12 }}>
              <h2 style={{ margin: 0, marginLeft: 8 }}>ข้อมูลนักศึกษา</h2>
              {!isEditing && (
                <button
                  className="btn-ico"
                  onClick={enterEdit}
                  aria-label="แก้ไขข้อมูลนักศึกษา"
                  title="แก้ไขข้อมูล"
                  type="button"
                >
                  <PencilIcon />
                </button>
              )}
            </div>

            {/* แจ้งบันทึกสำเร็จ */}
            {savedMsg && <div className="alert ok" style={{ marginTop: 12 }}>{savedMsg}</div>}

            {/* โหมดดู: ไม่มีกรอบครอบข้อมูล ใช้แถวมินิมอล */}
            {!isEditing && (
              <div className="info-grid" style={{ marginLeft: 8, marginTop: 20 }}>
                <ViewRow label="ชื่อ" value={profile.firstName} />
                <ViewRow label="นามสกุล" value={profile.lastName} />
                <ViewRow label="รหัสนักศึกษา" value={profile.studentId} />
                <ViewRow label="อีเมล" value={profile.email} />
                <ViewRow label="เบอร์โทร" value={profile.phone} />
                <ViewRow label="เกรด (GPA)" value={profile.gpa} />
                <ViewRow label="สาขาวิชา" value={profile.major} />
                <ViewRow label="หลักสูตร" value={profile.curriculum} />
                <ViewRow label="สัญชาติ" value={profile.nationality} />
              </div>
            )}

            {/* โหมดแก้ไข: มีช่องกรอก */}
            {isEditing && (
              <form
                className="grid2"
                onSubmit={savePersonal}
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
                {fields.map((f, idx) => {
                  if (isReadonlyField(f)) {
                    return (
                      <div key={idx} style={{ display: "grid", gap: 5 }}>
                        <label className="label">{f.label}</label>
                        <input className="input" value={f.value} disabled readOnly />
                      </div>
                    );
                  }

                  const key: keyof FormState = f.key;
                  const value: string = form[key] ?? "";
                  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                    const raw = e.target.value;
                    const v = key === "phone" ? raw.replace(/\D/g, "").slice(0, 10) : raw;
                    setForm({ ...form, [key]: v });
                  };

                  return (
                    <div key={idx} style={{ display: "grid", gap: 5 }}>
                      <label className="label">{f.label}</label>
                      <input
                        className="input"
                        type={f.type ?? "text"}
                        inputMode={f.inputMode}
                        step={f.step}
                        min={f.min}
                        max={f.max}
                        value={value}
                        onChange={onChange}
                        required
                      />
                    </div>
                  );
                })}

                <div style={{ gridColumn: "span 2", marginRight: -18, marginTop: 16, display: "flex", gap: 5, justifyContent: "flex-end" }}>
                  <button className="btn ghost" type="button" onClick={cancelEdit}>ยกเลิก</button>
                  <button className="btn" type="submit">บันทึกข้อมูลส่วนตัว</button>
                </div>
              </form>
            )}
          </section>

          {profile.company && (
            <section className="card" style={{ padding: 24, marginBottom: 28 }}>
              <h2 style={{ marginTop: 0, marginBottom: 16 }}>ข้อมูลบริษัท</h2>
              {/* จัดเรียงเหมือน "ข้อมูลนักศึกษา" */}
              <div className="info-grid">
                <Row label="ชื่อบริษัท" value={profile.company.name} />
                <Row label="ที่อยู่" value={profile.company.address} wide />
                <Row label="ชื่อ HR" value={profile.company.hrName} />
                <Row label="อีเมล HR" value={profile.company.hrEmail} />
              </div>
            </section>
          )}

          {profile.mentor && (
            <section className="card" style={{ padding: 24 }}>
              <h2 style={{ marginTop: 0, marginBottom: 16 }}>ข้อมูลพี่เลี้ยง</h2>
              {/* จัดเรียงเหมือน "ข้อมูลนักศึกษา" */}
              <div className="info-grid">
                <Row label="ชื่อ-นามสกุล" value={`${profile.mentor.firstName} ${profile.mentor.lastName}`} />
                <Row label="ตำแหน่งงาน" value={profile.mentor.title} />
                <Row label="เบอร์โทร" value={profile.mentor.phone} />
                <Row label="อีเมล" value={profile.mentor.email} />
              </div>
            </section>
          )}
        </div>

        <div>
          <section className="card" style={{ padding: 24, marginRight: -20 }}>
            <h2 style={{ marginTop: 0, marginBottom: 12, paddingLeft: 8 }}>ตารางการส่งเอกสาร</h2>
            <DocTable items={profile.docs} onChange={updateDocs} />
          </section>
        </div>
      </div>

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

        /* เลย์เอาต์หลัก: iPad/จอเล็ก = 1 คอลัมน์, เดสก์ท็อปใหญ่ (≥1440px) = 2 คอลัมน์ */
        .cols{
          display:grid;
          gap:32px;
          grid-template-columns: 1fr; /* เริ่มต้น: 1 คอลัมน์ */
        }
        @media (min-width: 1440px){
          .cols{ grid-template-columns: 1.2fr 1fr; }
        }

        /* แถวข้อมูลแบบมินิมอล (ไม่มีกรอบครอบข้อมูล) */
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

        /* ปุ่มไอคอนมินิมอล */
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

        /* iPad และเล็กกว่านั้น: ให้ทุก info-grid เป็น 1 คอลัมน์ */
        @media (max-width: 1024px){
          .info-grid{ grid-template-columns: 1fr; }
          .info-row{ grid-template-columns: 1fr; align-items:start; }
        }

        /* มือถือเล็กมาก */
        @media (max-width: 560px){
          .info-grid{ grid-template-columns: 1fr; }
          .info-row{ grid-template-columns: 1fr; align-items:start; }
        }
      `}</style>
    </div>
  );
}

/* ----- แถวสำหรับโหมดดู (ข้อมูลนักศึกษา) ----- */
function ViewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <div className="lbl">{label}</div>
      <div className="val">{value || "-"}</div>
    </div>
  );
}

/* ----- แถวสำหรับบริษัท/พี่เลี้ยง (เหมือน ViewRow แต่มี wide ได้) ----- */
function Row({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className="info-row" style={{ gridColumn: wide ? "span 2" as const : undefined }}>
      <div className="lbl">{label}</div>
      <div className="val">{value || "-"}</div>
    </div>
  );
}
