import React, { useMemo, useState } from "react";

type MentorProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;        // ตำแหน่ง
  department?: string;   // แผนก
  companyName?: string;  // ชื่อบริษัท
};

const KEY = "coop.mentor.profile";

function loadProfile(): MentorProfile {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    const {
      firstName = "", lastName = "", email = "", phone = "",
      title = "", department = "", companyName = ""
    } = raw || {};
    return { firstName, lastName, email, phone, title, department, companyName };
  } catch {
    return { firstName: "", lastName: "", email: "" };
  }
}

function saveProfile(p: MentorProfile) {
  localStorage.setItem(KEY, JSON.stringify(p));
  const display = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "พี่เลี้ยง";
  localStorage.setItem("coop.mentor.displayName", display);
}

export default function M_Profile() {
  const initial = loadProfile();
  const [p, setP] = useState<MentorProfile>(() => ({
    firstName: "", lastName: "", email: "", phone: "",
    title: "", department: "", companyName: "",
    ...initial,
  }));

  // ถ้าไม่มีข้อมูลเดิมเลย → เข้าสู่โหมดแก้ไข, ถ้ามีแล้ว → โหมดดูอย่างเดียว
  const [editing, setEditing] = useState<boolean>(() =>
    !(initial.firstName || initial.lastName || initial.email || initial.phone || initial.title || initial.department || initial.companyName)
  );

  function up<K extends keyof MentorProfile>(k: K, v: MentorProfile[K]) {
    setP(prev => ({ ...prev, [k]: v }));
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    saveProfile(p);
    alert("บันทึกโปรไฟล์แล้ว");
    setEditing(false); // ✅ ซ่อนฟอร์ม กลับไปดูการ์ดโปรไฟล์ที่อัปเดตแล้ว
  }

  const full = useMemo(
    () => `${p.firstName || ""} ${p.lastName || ""}`.trim() || "—",
    [p.firstName, p.lastName]
  );

  const initialLetter = useMemo(() => {
    const source = (p.firstName?.trim() || p.lastName?.trim())
      ? `${p.firstName || ""} ${p.lastName || ""}`.trim()
      : (p.email || "M");
    return source.trim().charAt(0).toUpperCase() || "M";
  }, [p.firstName, p.lastName, p.email]);

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      {/* ===== การ์ดโปรไฟล์ (รวมข้อมูลที่บันทึกทั้งหมด) ===== */}
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>โปรไฟล์ของฉัน</h2>

        <div className="profile-grid" style={{ marginTop: 8, marginLeft: 18 }}>
          {/* Avatar ตัวอักษร */}
          <div role="img" aria-label={`avatar ${initialLetter}`} className="avatar">
            {initialLetter}
          </div>

          {/* รายละเอียดทั้งหมดในใบเดียว */}
          <div className="info">
            <div className="name">{full}</div>
            <div className="sub">
              {p.title || "—"} {p.department ? `· ${p.department}` : ""}
            </div>

            <div className="list">
              <div className="row"><div className="k">อีเมล</div><div className="v">{p.email || "—"}</div></div>
              <div className="row"><div className="k">เบอร์โทร</div><div className="v">{p.phone || "—"}</div></div>
              <div className="row"><div className="k">บริษัท</div><div className="v">{p.companyName || "—"}</div></div>
            </div>

            {!editing && (
              <div style={{ marginTop: 12 }}>
                <button className="btn" type="button" onClick={() => setEditing(true)}>แก้ไขข้อมูล</button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== ฟอร์มแก้ไข (โชว์เฉพาะตอน editing) ===== */}
      {editing && (
        <form onSubmit={onSave}>
          <section className="card">
            <h3 style={{ marginTop: 0 }}>แก้ไขข้อมูลส่วนตัว & บริษัท</h3>

            {/* กลุ่ม: ข้อมูลส่วนตัว */}
            <div className="form-grid">
              <div className="field">
                <label className="label">ชื่อ</label>
                <input className="input" value={p.firstName} onChange={e => up("firstName", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">นามสกุล</label>
                <input className="input" value={p.lastName} onChange={e => up("lastName", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">อีเมล</label>
                <input className="input" type="email" value={p.email} onChange={e => up("email", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">เบอร์โทร</label>
                <input
                  className="input"
                  inputMode="tel"
                  value={p.phone || ""}
                  onChange={e => up("phone", e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                />
              </div>
              <div className="field">
                <label className="label">ตำแหน่ง</label>
                <input className="input" value={p.title || ""} onChange={e => up("title", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">แผนก</label>
                <input className="input" value={p.department || ""} onChange={e => up("department", e.target.value)} />
              </div>
            </div>

            <div className="section-divider" />

            {/* กลุ่ม: บริษัท (เหลือเฉพาะชื่อบริษัท) */}
            <div className="form-grid form-grid--company">
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label className="label">ชื่อบริษัท</label>
                <input className="input" value={p.companyName || ""} onChange={e => up("companyName", e.target.value)} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button className="btn" type="submit">บันทึก</button>
              <button className="btn ghost" type="button" onClick={() => setEditing(false)}>ยกเลิก</button>
            </div>
          </section>
        </form>
      )}

      <style>{`
        /* จำกัดความกว้างช่องกรอก (เดสก์ท็อป) */
        .page{ --field-max: 340px; } /* ปรับได้ 300–420px ตามชอบ */
        .field > .input,
        .field > textarea.input{
          width: 100%;
          max-width: var(--field-max);
          align-self: flex-start;
        }

        /* ===== การ์ดโปรไฟล์ ===== */
        .profile-grid{
          display:grid;
          grid-template-columns: 160px 1fr;
          gap: 18px;
          align-items: start;
        }
        .avatar{
          width: 140px; height: 140px; border-radius: 50%;
          background: linear-gradient(135deg,#E6F0FF,#BFD7ED);
          display:flex; align-items:center; justify-content:center;
          font-size: 56px; font-weight: 900; color:#0f172a;
          border:1px solid rgba(0,0,0,.06); box-shadow:0 6px 18px rgba(0,116,183,.08);
        }
        .info .name{ font-weight:900; font-size:22px; }
        .info .sub{ color:#6b7280; margin-top:2px; }
        .list{ margin-top:10px; display:grid; gap:6px; }
        .row{ display:flex; gap:10px; }
        .k{ min-width:92px; color:#6b7280; font-weight:700; }
        .v{ color:#0f172a; }

        /* ===== ฟอร์มแก้ไข — เพิ่มระยะห่างระหว่างช่อง & ระหว่างกลุ่ม ===== */
        .form-grid{
          display:grid;
          grid-template-columns: repeat(2, minmax(280px, 1fr));
          column-gap: 22px;   /* ซ้าย-ขวา */
          row-gap: 18px;      /* บน-ล่าง */
          margin-top: 10px;
        }
        .field{ display:flex; flex-direction:column; gap: 10px; } /* ระยะ label ↔ input */

        .section-divider{
          height:1px; background:rgba(0,0,0,.08);
          margin: 24px 0;  /* ระยะห่างกลุ่ม */
          border-radius:1px;
        }
        .form-grid--company{ margin-top: 6px; } /* ดันห่างจากเส้นคั่นเล็กน้อย */

        /* iPad/จอเล็ก = 1 คอลัมน์ + ช่องเต็มกว้างเพื่อใช้งานง่าย */
        @media (max-width: 1024px){
          .profile-grid{ grid-template-columns: 1fr; }
          .avatar{ width:120px; height:120px; font-size:48px; }
          .form-grid{ grid-template-columns: 1fr; gap: 16px; }
          .page{ --field-max: 100%; }
        }

        /* ปุ่มเสริม */
        .btn.ghost{
          background:#fff; color:#0f172a; border:1px solid rgba(0,0,0,.08);
          border-radius:10px; padding:10px 14px; font-weight:700
        }
        .btn.ghost:hover{
          background:#f8fafc; border-color:#c7d2fe;
          box-shadow:0 1px 0 rgba(0,0,0,.02), 0 6px 14px rgba(0,116,183,.14)
        }
      `}</style>
    </div>
  );
}
