/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect } from "react";
import type { StudentProfile } from "./store";
import { loadStudents, upsertStudent } from "./store";

export default function S_ProfilePage() {
  /* ================= MOCK LOGIN ================= */
  const studentId = "6400000000";

  /* ================= LOAD DATA ================= */
  const students = loadStudents();

  const initial: StudentProfile = students.find(
    (s) => s.studentId === studentId
  ) ?? {
    studentId,
    prefix: "นาย",
    firstName: "",
    lastName: "",
    year: "",
    major: "",
    curriculum: "ภาคปกติ",
    phone: "",
    emails: [
      { email: "", primary: true },
      { email: "", primary: false },
    ],
    company: undefined,
    docs: [],
  };

  const [profile, setProfile] = useState<StudentProfile>(initial);

  /* ================= PERMISSION ================= */
  const canEditStudent =
    !profile.coopRequest || profile.coopRequest.status === "draft";

  /* ================= EDIT STATE ================= */
  const [editStudent, setEditStudent] = useState(false);
  /* FORCE LOCK: ถ้าไม่สามารถแก้ไขได้ ให้ปิดโหมดแก้ไขทันที */
  useEffect(() => {
    if (!canEditStudent && editStudent) {
      setEditStudent(false);
    }
  }, [canEditStudent, editStudent]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [editCompany, setEditCompany] = useState(false);

  /* ================= SAVE ================= */
  function saveStudent() {
    if (!canEditStudent) {
      alert("ไม่สามารถแก้ไขข้อมูลได้หลังจากยื่นคำร้องแล้ว");
      return;
    }

    upsertStudent(profile);
    setEditStudent(false);
    alert("บันทึกข้อมูลนักศึกษาเรียบร้อย");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function saveCompany() {
    upsertStudent(profile);

    if (profile.company?.name) {
      const KEY = "coop.admin.companies";
      const companies = JSON.parse(localStorage.getItem(KEY) || "[]");

      const existed = companies.find(
        (c: { name: string }) => c.name === profile.company!.name
      );

      if (!existed) {
        companies.push({
          id: `c_${Date.now()}`,
          name: profile.company.name,
          address: profile.company.address || "",
          contactEmail: profile.company.hrEmail || "",
          pastCoopYears: new Date().getFullYear() + 543 + "",
        });

        localStorage.setItem(KEY, JSON.stringify(companies));
      }
    }

    setEditCompany(false);
    alert("บันทึกข้อมูลบริษัทเรียบร้อย");
  }

  /* ================= UI ================= */
  return (
    <div style={{ padding: 24, marginLeft: 35 }}>
      <style>{PROFILE_CSS}</style>

      <div className="profile-grid">
        {/* ================= STUDENT ================= */}
        <section className="profile-card">
          <div className="card-head">
            <div>
              <h3 className="profile-title">ข้อมูลนักศึกษา</h3>
              {!canEditStudent && (
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  ไม่สามารถแก้ไขข้อมูลนักศึกษาได้หลังจากยื่นคำร้องแล้ว
                </div>
              )}
            </div>

            {!editStudent && canEditStudent && (
              <button className="btn" onClick={() => setEditStudent(true)}>
                แก้ไข
              </button>
            )}
          </div>

          {!editStudent ? (
            <>
              <Info label="รหัสนักศึกษา" value={profile.studentId} />
              <Info
                label="ชื่อ–นามสกุล"
                value={`${profile.prefix} ${profile.firstName} ${profile.lastName}`}
              />
              <Info label="ชั้นปี" value={profile.year || "-"} />
              <Info label="สาขาวิชา" value={profile.major || "-"} />
              <Info label="หลักสูตร" value={profile.curriculum || "-"} />
              <Info label="เบอร์โทร" value={profile.phone || "-"} />
              <Info
                label="อีเมลมหาวิทยาลัย"
                value={profile.emails[0]?.email || "-"}
                pill
              />
              <Info
                label="อีเมลส่วนตัว"
                value={profile.emails[1]?.email || "-"}
                pill
              />
            </>
          ) : (
            <div className="form-grid">
              <input className="input" value={profile.studentId} disabled />

              <input
                className="input"
                placeholder="ชื่อ"
                value={profile.firstName}
                onChange={(e) =>
                  setProfile({ ...profile, firstName: e.target.value })
                }
              />

              <input
                className="input"
                placeholder="นามสกุล"
                value={profile.lastName}
                onChange={(e) =>
                  setProfile({ ...profile, lastName: e.target.value })
                }
              />

              <div className="action-row form-span">
                <button
                  className="btn-secondary"
                  onClick={() => setEditStudent(false)}
                >
                  ยกเลิก
                </button>
                <button className="btn" onClick={saveStudent}>
                  บันทึก
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ================= COMPANY ================= */}
        {profile.company && (
          <section className="profile-card">
            <div className="card-head">
              <div>
                <h3 className="profile-title">ข้อมูลบริษัท</h3>
                <div className="profile-sub">
                  ข้อมูลบริษัทที่ยื่นในคำร้องสหกิจ
                </div>
              </div>
            </div>

            <Info label="ชื่อบริษัท" value={profile.company.name || "-"} />
            <Info label="ผู้ประสานงาน" value={profile.company.hrName || "-"} />
            <Info label="ตำแหน่ง" value={profile.company.hrPosition || "-"} />
            <Info label="ที่อยู่" value={profile.company.address || "-"} />
            <Info label="เบอร์โทร" value={profile.company.phone || "-"} />
            <Info label="แฟกซ์" value={profile.company.fax || "-"} />
            <Info label="อีเมล" value={profile.company.hrEmail || "-"} />
            <Info label="เว็บไซต์" value={profile.company.website || "-"} />
          </section>
        )}
      </div>
    </div>
  );
}

/* ================= Helper ================= */
function Info({
  label,
  value,
  pill,
}: {
  label: string;
  value: string;
  pill?: boolean;
}) {
  return (
    <div className="info-row">
      <div className="label">{label}</div>
      <div className={pill ? "value email-pill" : "value"}>{value}</div>
    </div>
  );
}

/* ================= CSS ================= */
const PROFILE_CSS = `
.profile-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:28px;
  align-items:flex-start;
}
@media (max-width: 1024px){
  .profile-grid{ grid-template-columns:1fr; }
}

.profile-card{
  background:#fff;
  border-radius:20px;
  padding:28px 32px;
  box-shadow:0 8px 24px rgba(15,23,42,.08);
}

.card-head{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  margin-bottom:14px;
}

.profile-title{
  font-size:18px;
  font-weight:800;
  margin:0;
}

.profile-sub{
  font-size:13px;
  color:#64748b;
  margin-top:4px;
}

.divider{
  height:1px;
  background:#e5e7eb;
  margin:14px 0 18px;
}

/* info row */
.info-row{
  display:grid;
  grid-template-columns:160px 1fr;
  gap:8px;
  padding:8px 0;
}
.label{
  color:#64748b;
  font-weight:700;
  font-size:14px;
}
.value{
  color:#0f172a;
  font-weight:600;
  line-height:1.55;
}

.email-pill{
  display:inline-block;
  padding:6px 12px;
  border-radius:999px;
  background:#eff6ff;
  border:1px solid #bfdbfe;
  color:#1e40af;
  font-weight:700;
}

/* form */
.form-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:14px 20px;
}
.form-span{ grid-column:1 / -1; }

.action-row{
  display:flex;
  justify-content:flex-end;
  gap:10px;
  margin-top:18px;
}
`;
