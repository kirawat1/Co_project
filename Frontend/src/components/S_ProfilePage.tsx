import { useState, useEffect } from "react";
import { IcUser, IcEdit, IcSave } from "./icons";

/* ================= TYPES ================= */
interface Mentor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position?: string;
  companyId: string;
}

interface StudentCompany {
  id: string;
  name: string;
  address?: string;
  contactPerson?: string;
  contactPosition?: string;
  phone?: string;
  mentors: Mentor[];
  mentor?: Mentor;
}

interface StudentProfile {
  studentId: string;
  prefix?: "นาย" | "นางสาว" | "MR" | "MS"; // รองรับทั้ง UI และ Prisma Enum
  firstName?: string;
  lastName?: string;
  firstNameEn?: string; // ✅ เพิ่มใหม่
  lastNameEn?: string;  // ✅ เพิ่มใหม่
  year?: string;
  major?: string;
  curriculum?: string;
  advisorName?: string; // ✅ เพิ่มใหม่
  phone?: string;
  studyProgram?: "ภาคปกติ" | "ภาคพิเศษ" | "normal" | "special";
  gpa?: number;
  coreGpa?: number;
  activityUnit?: number;
  isPassPrepCourse?: boolean;
  email?: string;
  nationality?: string;
  userEmail?: string;
  emails: { id?: number; email: string; primary: boolean }[];
  company?: StudentCompany;
  docs: any[];
  coop?: {
    company: StudentCompany;
    mentor?: Mentor;
  };
}

/* ================= PAGE ================= */
export default function S_ProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [companies, setCompanies] = useState<StudentCompany[]>([]);
  const [openStudentModal, setOpenStudentModal] = useState(false);
  const token = localStorage.getItem("coop.token");

  // Mapping Helpers
  const prefixMapToPrisma = { นาย: "MR", นางสาว: "MS", MR: "MR", MS: "MS" };
  const prefixMapToUI = { MR: "นาย", MS: "นางสาว", นาย: "นาย", นางสาว: "นางสาว" };
  const majorMapToUI = { CS: "วิทยาการคอมพิวเตอร์", IT: "เทคโนโลยีสารสนเทศ", GIS: "ภูมิสารสนเทศศาสตร์" } as any;
  const studyProgramMapToPrisma = { ภาคปกติ: "normal", ภาคพิเศษ: "special", normal: "normal", special: "special" };
  const studyProgramMapToUI = { normal: "ภาคปกติ", special: "ภาคพิเศษ", ภาคปกติ: "ภาคปกติ", ภาคพิเศษ: "ภาคพิเศษ" } as any;

  useEffect(() => {
    if (!token) return;

    fetch("http://localhost:5000/api/students/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then((data: StudentProfile) => {
        // console.log("Data from DB:", data);
        const emails = data.emails?.length > 0
          ? data.emails
          : [{ email: "", primary: false }];

        const company = data.coop ? { ...data.coop.company, mentor: data.coop.mentor } : data.company;

        setProfile({
          ...data,
          emails,
          company,
        });
      })
      .catch(err => console.error("Error fetching profile:", err));

    fetch("http://localhost:5000/api/companies", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => setCompanies(data))
      .catch(err => console.error("Error fetching companies:", err));
  }, [token]);

  if (!profile) return <div style={{ padding: 40, textAlign: 'center' }}>กำลังโหลดข้อมูล...</div>;

  /* ================= SAVE ================= */
  async function saveStudentInfo(updatedProfile: StudentProfile) {
    try {
      const res = await fetch("http://localhost:5000/api/students/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...updatedProfile,
          prefix: prefixMapToPrisma[updatedProfile.prefix as keyof typeof prefixMapToPrisma],
          studyProgram: studyProgramMapToPrisma[updatedProfile.studyProgram as keyof typeof studyProgramMapToPrisma],
          // ✅ มั่นใจว่าตัวเลขเป็น Number
          gpa: updatedProfile.gpa ? Number(updatedProfile.gpa) : 0,
          coreGpa: updatedProfile.coreGpa ? Number(updatedProfile.coreGpa) : 0,
          activityUnit: updatedProfile.activityUnit ? Number(updatedProfile.activityUnit) : 0,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setProfile(prev => ({ ...prev!, ...result.student, emails: result.emails }));
        alert("บันทึกข้อมูลเรียบร้อย");
        setOpenStudentModal(false);
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  }

  async function saveStudentCompany(updatedProfile?: StudentProfile) {
    if (!updatedProfile) return;
    try {
      const res = await fetch("http://localhost:5000/api/students/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          major: updatedProfile.major,
          companyId: updatedProfile.company?.id,
          mentorId: updatedProfile.company?.mentor?.id,

        }),
      });
      if (res.ok) {
        const result = await res.json();
        // ✅ อัปเดตข้อมูลในหน้าเว็บเพื่อให้สถานะ Qualification เปลี่ยนทันที (ถ้ามี)
        setProfile(prev => ({ ...prev!, ...result.student }));
        alert("บันทึกข้อมูลบริษัทเรียบร้อย");
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการบันทึกบริษัท");
    }
  }

  return (
    <div style={{ padding: 24, marginLeft: 35 }}>
      <style>{PROFILE_CSS}</style>

      <div className="profile-grid">
        {/* ================= STUDENT ================= */}
        <section className="profile-card">
          <div className="card-head">
            <h3 className="profile-title">ข้อมูลนักศึกษา</h3>
            <button className="btn-edit" onClick={() => setOpenStudentModal(true)} style={editBtnStyle}>
              <IcEdit width={16} height={16} /> แก้ไขข้อมูล
            </button>
          </div>

          <Info label="รหัสนักศึกษา" value={profile.studentId} />
          <Info
            label="ชื่อ–นามสกุล (TH)"
            value={`${prefixMapToUI[profile.prefix as keyof typeof prefixMapToUI] || ""} ${profile.firstName ?? ""} ${profile.lastName ?? ""}`}
          />
          {/* ✅ แสดงชื่อภาษาอังกฤษที่เพิ่มมา */}
          <Info
            label="ชื่อ–นามสกุล (EN)"
            value={`${profile.firstNameEn ?? "-"} ${profile.lastNameEn ?? "-"}`}
          />
          <Info label="ชั้นปี" value={profile.year || "-"} />
          <Info label="คณะ" value={profile.curriculum || "-"} />
          <Info
            label="สาขาวิชา"
            value={majorMapToUI[profile.major as string] || profile.major || "-"}
          />
          <Info
            label="รูปแบบการศึกษา"
            value={studyProgramMapToUI[profile.studyProgram as string] || profile.studyProgram || "-"}
          />
          <Info label="ที่ปรึกษา" value={profile.advisorName || "-"} />
          <Info label="เบอร์โทร" value={profile.phone || "-"} />
          <Info label="GPA" value={profile?.gpa != null ? profile.gpa.toFixed(2) : "-"} />
          <Info label="GPA หมวดวิชาเฉพาะ" value={profile.coreGpa?.toFixed(2) || "0.00"} />
          <Info label="หน่วยกิจสะสม" value={`${profile.activityUnit || 0} หน่วย`} />
          <Info
            label="วิชาสหกิจศึกษาทางวิทยาการคอมพิวเตอร์"
            value={profile.isPassPrepCourse ? "ผ่านแล้ว (S)" : "ยังไม่ผ่าน"}
          />
          <Info label="อีเมลมหาวิทยาลัย" value={profile.userEmail || "-"} pill />
          <Info label="อีเมลติดต่อหลัก" value={profile.email || "-"} pill />
        </section>

        {/* ================= COOP ================= */}
        <section className="profile-card">
          <h3 className="profile-title">สถานที่ฝึกสหกิจ</h3>
          <div className="profile-sub">เลือกบริษัทและพี่เลี้ยง</div>
          <div className="divider" />

          <div style={{ marginBottom: 15 }}>
            <label className="label">บริษัท</label>
            <select
              className="input"
              style={{ marginTop: 5 }}
              value={profile.company?.id || ""}
              onChange={(e) => {
                const company = companies.find(c => c.id === e.target.value);
                if (!company) return;
                setProfile({ ...profile, company: { ...company, mentors: company.mentors, mentor: undefined } });
              }}
            >
              <option value="">เลือกบริษัท</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 15 }}>
            <label className="label">พี่เลี้ยง</label>
            <select
              className="input"
              style={{ marginTop: 5 }}
              disabled={!profile.company}
              value={profile.company?.mentor?.id || ""}
              onChange={(e) => {
                const mentor = profile.company?.mentors?.find(m => m.id === e.target.value);
                if (!mentor || !profile.company) return;
                setProfile({ ...profile, company: { ...profile.company, mentor } });
              }}
            >
              <option value="">เลือกพี่เลี้ยง</option>
              {profile.company?.mentors?.map(m => (
                <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
              ))}
            </select>
          </div>

          <div className="action-row">
            <button className="btn" onClick={() => saveStudentCompany(profile)}>
              <IcSave width={16} height={16} style={{ marginRight: 8 }} />
              บันทึกสถานที่ฝึก
            </button>
          </div>

          {profile.company && (
            <div style={{ marginTop: 20 }}>
              <div className="divider" />
              <h4 className="profile-sub">รายละเอียดบริษัท</h4>
              <Info label="ชื่อ" value={profile.company.name || "-"} />
              <Info label="ที่อยู่" value={profile.company.address || "-"} pill />
              <Info label="เบอร์โทร" value={profile.company.phone || "-"} />
              <Info label="ตำแหน่งผู้ติดต่อ" value={profile.company.contactPosition || "-"} />
              <Info label="ผู้ติดต่อ" value={profile.company.contactPerson || "-"} />

            </div>
          )}

          {profile.company?.mentor && (
            <div style={{ marginTop: 20 }}>
              <div className="divider" />
              <h4 className="profile-sub">รายละเอียดพี่เลี้ยง</h4>
              <Info label="ตำแหน่ง" value={profile.company.mentor.position || "-"} />
              <Info label="อีเมล" value={profile.company.mentor.email || "-"} pill />
              <Info label="เบอร์โทร" value={profile.company.mentor.phone || "-"} />
            </div>
          )}
        </section>
      </div>

      {openStudentModal && (
        <StudentModal
          profile={profile}
          saveStudentInfo={saveStudentInfo}
          closeModal={() => setOpenStudentModal(false)}
        />
      )}
    </div>
  );
}

/* ================= MODAL COMPONENT ================= */
function StudentModal({ profile, saveStudentInfo, closeModal }: any) {
  const [form, setForm] = useState<StudentProfile>({ ...profile });

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3 className="profile-title">แก้ไขข้อมูลนักศึกษา</h3>
        <div className="form-grid" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 10 }}>

          <div>
            <label className="label">คำนำหน้า</label>
            <select
              className="input"
              value={form.prefix ?? ""}
              onChange={(e) => setForm({ ...form, prefix: e.target.value as any })}
            >
              <option value="">เลือก</option>
              <option value="นาย">นาย</option>
              <option value="นางสาว">นางสาว</option>
            </select>
          </div>

          <div>
            <label className="label">รหัสนักศึกษา</label>
            <input
              className="input"
              value={form.studentId}
              maxLength={15}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
            />
          </div>

          <div>
            <label className="label">ชื่อ (ภาษาไทย)</label>
            <input
              className="input"
              value={form.firstName ?? ""}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </div>

          <div>
            <label className="label">นามสกุล (ภาษาไทย)</label>
            <input
              className="input"
              value={form.lastName ?? ""}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>

          {/* ✅ เพิ่มฟิลด์ภาษาอังกฤษใน Modal */}
          <div>
            <label className="label">First Name (EN)</label>
            <input
              className="input"
              value={form.firstNameEn ?? ""}
              onChange={(e) => setForm({ ...form, firstNameEn: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Last Name (EN)</label>
            <input
              className="input"
              value={form.lastNameEn ?? ""}
              onChange={(e) => setForm({ ...form, lastNameEn: e.target.value })}
            />
          </div>

          <div>
            <label className="label">สาขาวิชา</label>
            <select
              className="input"
              value={form.major || ""}
              onChange={(e) => setForm({ ...form, major: e.target.value })}
            >
              <option value="">-- เลือกสาขาวิชา --</option>
              <option value="CS">วิทยาการคอมพิวเตอร์</option>
              <option value="IT">เทคโนโลยีสารสนเทศ</option>
              <option value="GIS">ภูมิสารสนเทศศาสตร์</option>
            </select>
          </div>

          <div>
            <label className="label">รูปแบบการศึกษา</label>
            <select
              className="input"
              value={form.studyProgram || ""}
              onChange={(e) => setForm({ ...form, studyProgram: e.target.value as any })}
            >
              <option value="">เลือกรูปแบบ</option>
              <option value="ภาคปกติ">ภาคปกติ</option>
              <option value="ภาคพิเศษ">ภาคพิเศษ</option>
            </select>
          </div>

          <div>
            <label className="label">ที่ปรึกษา</label>
            <input className="input" value={form.advisorName ?? ""} onChange={(e) => setForm({ ...form, advisorName: e.target.value })} />
          </div>

          <div>
            <label className="label">ชั้นปี</label>
            <input className="input" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          </div>

          <div>
            <label className="label">GPA</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={form.gpa ?? ""}
              onChange={(e) => setForm({ ...form, gpa: parseFloat(e.target.value) })}
            />
          </div>

          <div>
            <label className="label">เกรดเฉลี่ยวิชาแกน (Core GPA)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.coreGpa ?? ""}
              onChange={(e) => setForm({ ...form, coreGpa: e.target.value === "" ? 0 : Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="label">หน่วยกิจสะสม (หน่วย)</label>
            <input
              className="input"
              type="number"
              placeholder="60"
              value={form.activityUnit ?? ""}
              onChange={(e) => setForm({ ...form, activityUnit: e.target.value === "" ? 0 : Number(e.target.value) })}
            />
          </div>

          <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            <input
              type="checkbox"
              id="prepCourse"
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              checked={form.isPassPrepCourse || false}
              onChange={(e) => setForm({ ...form, isPassPrepCourse: e.target.checked })}
            />
            <label htmlFor="prepCourse" className="label" style={{ margin: 0, cursor: 'pointer' }}>
              ผ่านรายวิชาเตรียมความพร้อมสหกิจศึกษา (CP002001/SC002001)
            </label>
          </div>


          <div style={{ gridColumn: 'span 2' }}>
            <label className="label">คณะ / หลักสูตร</label>
            <input className="input" value={form.curriculum ?? ""} onChange={(e) => setForm({ ...form, curriculum: e.target.value })} />
          </div>

          <div>
            <label className="label">เบอร์โทรศัพท์</label>
            <input className="input" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>

          <div>
            <label className="label">อีเมลติดต่อหลัก</label>
            <input className="input" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>

        <div className="action-row">
          <button className="btn-secondary" onClick={closeModal}>ยกเลิก</button>
          <button className="btn" onClick={() => saveStudentInfo(form)}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, pill }: { label: string; value: string; pill?: boolean }) {
  return (
    <div className="info-row">
      <div className="label">{label}</div>
      <div className={pill ? "value email-pill" : "value"}>{value}</div>
    </div>
  );
}

const editBtnStyle = {
  background: "#2563eb",
  border: "none",
  padding: "6px 12px",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  color: "#fff",
};

const PROFILE_CSS = `
.profile-grid{ display:grid; grid-template-columns:1fr 1fr; gap:28px; }
@media (max-width: 1024px){ .profile-grid{ grid-template-columns:1fr; } }
.profile-card{ background:#fff; border-radius:20px; padding:28px 40px; box-shadow:0 8px 24px rgba(15,23,42,.08); }
.card-head{ display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; }
.profile-title{ font-size:18px; font-weight:800; margin:0; }
.profile-sub{ font-size:13px; color:#64748b; margin-top:4px; font-weight: 600; }
.divider{ height:1px; background:#e5e7eb; margin:14px 0 18px; }
.info-row{ display:grid; grid-template-columns:160px 1fr; padding:10px 0; border-bottom: 1px solid #f8fafc; }
.info-row:last-child { border-bottom: none; }
.label{ color:#64748b; font-weight:700; font-size: 14px; }
.value{ font-weight:600; color: #1e293b; }
.email-pill{ display:inline-block; padding:4px 12px; border-radius:999px; background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; font-size: 13px; }
.input { padding:10px 14px; border-radius:10px; border:1px solid #e5e7eb; font-weight:600; width:100%; box-sizing:border-box; font-family: inherit; }
.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:15px 20px; }
.action-row { display:flex; justify-content:flex-end; gap:10px; margin-top:25px; }
.btn { background:#2563eb; color:#fff; padding:10px 20px; border-radius:10px; font-weight:700; border: none; cursor: pointer; display: flex; align-items: center; }
.btn-secondary { background:#f1f5f9; color:#475569; padding:10px 20px; border-radius:10px; font-weight:700; border: none; cursor: pointer; }
.modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.45); display:flex; align-items:center; justify-content:center; z-index:50; backdrop-filter: blur(4px); }
.modal-card { background:#fff; border-radius:24px; padding:35px; width:750px; max-width:95%; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1); }
`;