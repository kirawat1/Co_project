import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  prefix?: "นาย" | "นางสาว" | "MR" | "MS";
  firstName?: string;
  lastName?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  year?: string;
  major?: string;
  curriculum?: string;
  advisorName?: string;
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
  isQualified?: boolean; // ✅ เอาไว้โชว์เฉยๆ ว่าเกรดถึงไหม
  coop?: {
    company: StudentCompany;
    mentor?: Mentor;
    status?: string; // สถานะจริงจะอยู่ตรงนี้ (เช่น NOT_SUBMITTED, APPLYING, QUALIFIED)
  };
}
interface StudentCompany {
  id: string;
  name: string;
  address?: string; // เก็บไว้เผื่อระบบเก่า
  addressNo?: string;
  moo?: string;
  soi?: string;
  road?: string;
  subDistrict?: string;
  district?: string;
  province?: string;
  zipcode?: string;
  contactPerson?: string;
  contactPosition?: string;
  phone?: string;
  mentors: Mentor[];
  mentor?: Mentor;
}
/* ================= PAGE ================= */
export default function S_ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [companies, setCompanies] = useState<StudentCompany[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [openStudentModal, setOpenStudentModal] = useState(false);
  const token = localStorage.getItem("coop.token");

  // Mapping Helpers
  const prefixMapToPrisma = { นาย: "MR", นางสาว: "MS", MR: "MR", MS: "MS" };
  const prefixMapToUI = { MR: "นาย", MS: "นางสาว", นาย: "นาย", นางสาว: "นางสาว" };
  const studyProgramMapToPrisma = { ภาคปกติ: "normal", ภาคพิเศษ: "special", normal: "normal", special: "special" };
  const studyProgramMapToUI = { normal: "ภาคปกติ", special: "ภาคพิเศษ", ภาคปกติ: "ภาคปกติ", ภาคพิเศษ: "ภาคพิเศษ" } as any;

  useEffect(() => {
    if (!token) return;

    // 1. ดึงข้อมูล Profile
    fetch("http://localhost:5000/api/students/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then((data: StudentProfile) => {
        const emails = data.emails?.length > 0 ? data.emails : [{ email: "", primary: false }];
        const company = data.coop ? { ...data.coop.company, mentor: data.coop.mentor } : data.company;
        setProfile({ ...data, emails, company });
      })
      .catch(err => console.error("Error fetching profile:", err));

    // 2. ดึงข้อมูลบริษัท
    fetch("http://localhost:5000/api/companies", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => setCompanies(data))
      .catch(err => console.error("Error fetching companies:", err));

    // 3. ดึงข้อมูลอาจารย์
    fetch("http://localhost:5000/api/teachers", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.teachers) setTeachers(data.teachers);
        else if (Array.isArray(data)) setTeachers(data);
      })
      .catch(err => console.error("Error fetching teachers:", err));
  }, [token]);

  if (!profile) return <div style={{ padding: 40, textAlign: 'center' }}>กำลังโหลดข้อมูล...</div>;

  /* ================= SAVE ================= */
  async function saveStudentInfo(updatedProfile: StudentProfile) {
    try {
      const res = await fetch("http://localhost:5000/api/students/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...updatedProfile,
          // ✅ ป้องกันค่าหาย ถ้า map ไม่เจอ ให้ใช้ค่าที่ผู้ใช้กรอกมาเลย
          prefix: prefixMapToPrisma[updatedProfile.prefix as keyof typeof prefixMapToPrisma] || updatedProfile.prefix,
          studyProgram: studyProgramMapToPrisma[updatedProfile.studyProgram as keyof typeof studyProgramMapToPrisma] || updatedProfile.studyProgram,
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
    } catch (err) { alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล"); }
  }

  async function saveStudentCompany() {
    if (!profile) return;
    try {
      const res = await fetch("http://localhost:5000/api/students/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          major: profile.major,
          companyId: profile.company?.id || null,
          mentorId: profile.company?.mentor?.id || null,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setProfile(prev => ({
          ...prev!,
          ...result.student,
          company: profile.company // คงค่าไว้ไม่ให้ UI กระพริบ
        }));
        alert("บันทึกข้อมูลสถานที่ฝึกเรียบร้อย");
      }
    } catch (err) { alert("เกิดข้อผิดพลาดในการบันทึกบริษัท"); }
  }

  // ฟังก์ชันประกอบร่างที่อยู่
  const getFullAddress = (c?: StudentCompany) => {
    if (!c) return "-";

    // ถ้าระบบเก่าเคยพิมพ์รวมๆ ไว้ใน address แล้วยังไม่ได้อัปเดตแยกฟิลด์ ให้โชว์ของเก่า
    if (c.address && !c.addressNo && !c.province) return c.address;

    const isBKK = c.province === "กรุงเทพมหานคร" || c.province === "กรุงเทพฯ" || c.province === "กทม.";

    const parts = [
      c.addressNo && `${c.addressNo}`,
      c.moo && `หมู่ ${c.moo}`,
      c.soi && `ซอย${c.soi}`,
      c.road && `ถนน${c.road}`,
      c.subDistrict && (isBKK ? `แขวง${c.subDistrict}` : `ต.${c.subDistrict}`),
      c.district && (isBKK ? `เขต${c.district}` : `อ.${c.district}`),
      c.province && (isBKK ? c.province : `จ.${c.province}`),
      c.zipcode
    ];

    // เอาเฉพาะส่วนที่มีข้อมูลมาต่อกันด้วยช่องว่าง
    const fullAddress = parts.filter(Boolean).join(" ");

    return fullAddress || c.address || "ไม่มีข้อมูลที่อยู่ในระบบ";
  };

  /* ================= OPTIONS FOR DROPDOWNS ================= */
  const companyOptions = [
    { id: "clear", label: "❌ ยกเลิกการเลือก (ยังไม่มีที่ฝึก)", rawData: null },
    ...companies.map(c => ({ id: c.id, label: c.name, rawData: c }))
  ];

  const mentorOptions = profile.company ? [
    { id: "clear", label: "❌ ยกเลิกการเลือก (ยังไม่มีพี่เลี้ยง)", rawData: null },
    ...(profile.company.mentors?.map(m => ({
      id: m.id,
      label: `${m.firstName} ${m.lastName} ${m.position ? `(${m.position})` : ''}`,
      rawData: m
    })) || [])
  ] : [];

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

          {/* ✅ แก้ไขกล่องแสดงสถานะการผ่านเกณฑ์ */}
          <div style={{
            padding: "12px 16px", marginBottom: "20px", borderRadius: "8px",
            background: profile.isQualified ? "#f0fdf4" : "#fee2e2",
            border: `1px solid ${profile.isQualified ? "#bbf7d0" : "#fecaca"}`,
            color: profile.isQualified ? "#166534" : "#991b1b",
            fontWeight: 700, fontSize: "14px", display: "flex", alignItems: "center", gap: "8px"
          }}>
            {profile.isQualified
              ? "✅ ผ่านเกณฑ์เบื้องต้นจากการคำนวณ (เกรด/หน่วยกิต ถึงเกณฑ์ที่กำหนด)"
              : "⚠️ คุณสมบัติยังไม่ผ่านเกณฑ์การยื่นสหกิจศึกษา"}
          </div>

          <Info label="รหัสนักศึกษา" value={profile.studentId} />
          <Info label="ชื่อ–นามสกุล (TH)" value={`${prefixMapToUI[profile.prefix as keyof typeof prefixMapToUI] || ""} ${profile.firstName ?? ""} ${profile.lastName ?? ""}`} />
          <Info label="ชื่อ–นามสกุล (EN)" value={`${profile.firstNameEn ?? "-"} ${profile.lastNameEn ?? "-"}`} />
          <Info label="ชั้นปี" value={profile.year || "-"} />
          <Info label="คณะ" value={profile.curriculum || "-"} />
          <Info label="สาขาวิชา" value={profile.major || "-"} />
          <Info label="รูปแบบการศึกษา" value={studyProgramMapToUI[profile.studyProgram as string] || profile.studyProgram || "-"} />
          <Info label="ที่ปรึกษา" value={profile.advisorName || "-"} />
          <Info label="เบอร์โทร" value={profile.phone || "-"} />
          <Info label="GPA" value={profile?.gpa != null ? profile.gpa.toFixed(2) : "-"} />
          <Info label="GPA หมวดวิชาเฉพาะ" value={profile.coreGpa?.toFixed(2) || "0.00"} />
          <Info label="หน่วยกิตสะสม" value={`${profile.activityUnit || 0} หน่วย`} />
          <Info label="วิชาสหกิจศึกษา" value={profile.isPassPrepCourse ? "ผ่านแล้ว (S)" : "ยังไม่ผ่าน"} />
          <Info label="อีเมลมหาวิทยาลัย" value={profile.userEmail || "-"} pill />
        </section>

        {/* ================= COOP (สถานที่ฝึกงาน) ================= */}
        <section className="profile-card">
          <div className="card-head">
            <div>
              <h3 className="profile-title">สถานที่ฝึกสหกิจ</h3>
              <div className="profile-sub">เลือกบริษัทและพี่เลี้ยง</div>
            </div>
          </div>
          <div className="divider" style={{ marginTop: 0 }} />

          <div style={{ marginBottom: 15 }}>
            <label className="label">บริษัท</label>
            <div style={{ marginTop: 5 }}>
              <SearchableDropdown
                options={companyOptions}
                value={profile.company?.id || ""}
                placeholder="พิมพ์ค้นหาชื่อบริษัท..."
                noOptionText="ไม่พบบริษัทที่ค้นหา"
                onAddClick={() => navigate("/student/company")}
                onChange={(id: string, rawData: any) => {
                  if (id === "clear") {
                    setProfile({ ...profile, company: undefined });
                  } else {
                    setProfile({ ...profile, company: { ...rawData, mentors: rawData.mentors, mentor: undefined } });
                  }
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 15 }}>
            <label className="label">พี่เลี้ยง</label>
            <div style={{ marginTop: 5 }}>
              <SearchableDropdown
                options={mentorOptions}
                value={profile.company?.mentor?.id || ""}
                placeholder={profile.company ? "พิมพ์ค้นหาชื่อพี่เลี้ยง..." : "กรุณาเลือกบริษัทก่อน"}
                noOptionText="ไม่พบพี่เลี้ยงในบริษัทนี้"
                onChange={(id: string, rawData: any) => {
                  if (id === "clear") {
                    setProfile({ ...profile, company: { ...profile.company!, mentor: undefined } });
                  } else {
                    setProfile({ ...profile, company: { ...profile.company!, mentor: rawData } });
                  }
                }}
              />
            </div>
          </div>

          <div className="action-row">
            <button className="btn" onClick={saveStudentCompany}>
              <IcSave width={16} height={16} style={{ marginRight: 8 }} />
              บันทึกสถานที่ฝึก
            </button>
          </div>

          {/* รายละเอียดบริษัท / พี่เลี้ยงที่ถูกเลือก */}
          {profile.company && profile.company.id && (
            <div style={{ marginTop: 20 }}>
              <div className="divider" />
              <h4 className="profile-sub">รายละเอียดบริษัท</h4>
              <Info label="ชื่อ" value={profile.company.name || "-"} />
              <Info label="ที่อยู่" value={getFullAddress(profile.company)} />
              <Info label="ผู้ติดต่อ" value={`${profile.company.contactPerson || "-"} ${profile.company.contactPosition ? `(${profile.company.contactPosition})` : ""}`} />
              <Info label="เบอร์โทร" value={profile.company.phone || "-"} />
            </div>
          )}

          {profile.company?.mentor && (
            <div style={{ marginTop: 20 }}>
              <div className="divider" />
              <h4 className="profile-sub">รายละเอียดพี่เลี้ยง</h4>
              <Info label="ชื่อพี่เลี้ยง" value={`${profile.company.mentor.firstName} ${profile.company.mentor.lastName}`} />
              <Info label="ตำแหน่ง" value={profile.company.mentor.position || "-"} />
              <Info label="เบอร์โทร" value={profile.company.mentor.phone || "-"} />
            </div>
          )}
        </section>
      </div>

      {openStudentModal && (
        <StudentModal
          profile={profile}
          teachers={teachers}
          saveStudentInfo={saveStudentInfo}
          closeModal={() => setOpenStudentModal(false)}
        />
      )}
    </div>
  );
}

/* ================= MODAL COMPONENT ================= */
/* ================= MODAL COMPONENT ================= */
function StudentModal({ profile, teachers, saveStudentInfo, closeModal }: any) {
  // ✅ สร้าง Map สำหรับแปลงค่าจาก Database มาเป็นตัวเลือกใน UI ให้ตรงกัน
  const prefixMapToUI = { MR: "นาย", MS: "นางสาว", นาย: "นาย", นางสาว: "นางสาว" } as any;
  const studyProgramMapToUI = { normal: "ภาคปกติ", special: "ภาคพิเศษ", ภาคปกติ: "ภาคปกติ", ภาคพิเศษ: "ภาคพิเศษ" } as any;

  // ✅ แปลงค่าก่อนนำไปตั้งเป็น State และกำหนดค่าเริ่มต้นคณะ
  const [form, setForm] = useState<StudentProfile>(() => ({
    ...profile,
    prefix: prefixMapToUI[profile.prefix] || profile.prefix || "",
    studyProgram: studyProgramMapToUI[profile.studyProgram] || profile.studyProgram || "",
    curriculum: profile.curriculum || "วิทยาลัยการคอมพิวเตอร์" // ✅ ตั้งค่าเริ่มต้น แต่ยังลบแก้ได้
  }));

  const [majorOptions, setMajorOptions] = useState<string[]>([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/admin/majors")
      .then(res => res.json())
      .then(data => { if (data.ok) setMajorOptions(data.majors); })
      .catch(err => console.error("Failed to load majors", err));
  }, []);

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3 className="profile-title">แก้ไขข้อมูลนักศึกษา</h3>
        <div className="form-grid" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 10 }}>

          <div><label className="label">คำนำหน้า</label>
            <select className="input" value={form.prefix ?? ""} onChange={(e) => setForm({ ...form, prefix: e.target.value as any })}>
              <option value="">เลือก</option><option value="นาย">นาย</option><option value="นางสาว">นางสาว</option>
            </select>
          </div>
          <div><label className="label">รหัสนักศึกษา</label><input className="input" value={form.studentId} maxLength={15} onChange={(e) => setForm({ ...form, studentId: e.target.value })} /></div>
          <div><label className="label">ชื่อ (ภาษาไทย)</label><input className="input" value={form.firstName ?? ""} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
          <div><label className="label">นามสกุล (ภาษาไทย)</label><input className="input" value={form.lastName ?? ""} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
          <div><label className="label">First Name (EN)</label><input className="input" value={form.firstNameEn ?? ""} onChange={(e) => setForm({ ...form, firstNameEn: e.target.value })} /></div>
          <div><label className="label">Last Name (EN)</label><input className="input" value={form.lastNameEn ?? ""} onChange={(e) => setForm({ ...form, lastNameEn: e.target.value })} /></div>

          <div>
            <label className="label">สาขาวิชา</label>
            <select className="input" value={form.major || ""} onChange={(e) => setForm({ ...form, major: e.target.value })}>
              <option value="">-- เลือกสาขาวิชา --</option>
              {majorOptions.map((major) => (<option key={major} value={major}>{major}</option>))}
            </select>
          </div>

          <div>
            <label className="label">รูปแบบการศึกษา</label>
            <select className="input" value={form.studyProgram || ""} onChange={(e) => setForm({ ...form, studyProgram: e.target.value as any })}>
              <option value="">เลือกรูปแบบ</option><option value="ภาคปกติ">ภาคปกติ</option><option value="ภาคพิเศษ">ภาคพิเศษ</option>
            </select>
          </div>

          <div>
            <label className="label">ที่ปรึกษา</label>
            <select className="input" value={form.advisorName ?? ""} onChange={(e) => setForm({ ...form, advisorName: e.target.value })}>
              <option value="">-- เลือกที่ปรึกษา --</option>
              {teachers.map((t: any) => {
                const fullName = `${t.prefix || ""}${t.firstName} ${t.lastName}`;
                return <option key={t.id} value={fullName}>{fullName}</option>;
              })}
            </select>
          </div>

          <div><label className="label">ชั้นปี</label><input className="input" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
          <div><label className="label">GPA</label><input className="input" type="number" step="0.01" value={form.gpa ?? ""} onChange={(e) => setForm({ ...form, gpa: parseFloat(e.target.value) })} /></div>
          <div><label className="label">เกรดเฉลี่ยวิชาแกน (Core GPA)</label><input className="input" type="number" step="0.01" value={form.coreGpa ?? ""} onChange={(e) => setForm({ ...form, coreGpa: e.target.value === "" ? 0 : Number(e.target.value) })} /></div>
          <div><label className="label">หน่วยกิตสะสม (หน่วย)</label><input className="input" type="number" value={form.activityUnit ?? ""} onChange={(e) => setForm({ ...form, activityUnit: e.target.value === "" ? 0 : Number(e.target.value) })} /></div>

          <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            <input type="checkbox" id="prepCourse" style={{ width: '20px', height: '20px', cursor: 'pointer' }} checked={form.isPassPrepCourse || false} onChange={(e) => setForm({ ...form, isPassPrepCourse: e.target.checked })} />
            <label htmlFor="prepCourse" className="label" style={{ margin: 0, cursor: 'pointer' }}>ผ่านรายวิชาเตรียมความพร้อมสหกิจศึกษา (CP002001/SC002001)</label>
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label className="label">คณะ / หลักสูตร</label>
            <input className="input" value={form.curriculum ?? ""} onChange={(e) => setForm({ ...form, curriculum: e.target.value })} />
          </div>
          <div><label className="label">เบอร์โทรศัพท์</label><input className="input" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="label">อีเมลติดต่อหลัก</label><input className="input" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>

        <div className="action-row">
          <button className="btn-secondary" onClick={closeModal}>ยกเลิก</button>
          <button className="btn" onClick={() => saveStudentInfo(form)}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}

/* ================= CUSTOM SEARCHABLE DROPDOWN ================= */
function SearchableDropdown({ options, value, onChange, placeholder, noOptionText, onAddClick }: any) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel = options.find((o: any) => o.id === value)?.label || "";
  const filtered = options.filter((o: any) => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ position: "relative" }}>
      <input
        className="input"
        placeholder={placeholder}
        value={isOpen ? search : selectedLabel}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => { setIsOpen(true); setSearch(""); }}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
      />
      {isOpen && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "#fff", border: "1px solid #cbd5e1", zIndex: 50,
          maxHeight: 250, overflowY: "auto", borderRadius: 10,
          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", marginTop: 4
        }}>
          {filtered.length > 0 ? (
            filtered.map((o: any) => (
              <div
                key={o.id}
                style={{
                  padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9",
                  fontSize: 14, color: o.id === "clear" ? "#dc2626" : "#1e293b",
                  fontWeight: o.id === "clear" ? "bold" : "normal"
                }}
                onMouseDown={() => { onChange(o.id, o.rawData); setSearch(o.label); setIsOpen(false); }}
                onMouseEnter={(e) => e.currentTarget.style.background = o.id === "clear" ? "#fee2e2" : "#f8fafc"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                {o.label}
              </div>
            ))
          ) : (
            <div style={{ padding: "14px", textAlign: "center", color: "#64748b", fontSize: 14 }}>
              {noOptionText}
              {onAddClick && (
                <button type="button" className="btn" style={{ width: "100%", marginTop: 10, justifyContent: "center", padding: "8px" }} onMouseDown={(e) => { e.preventDefault(); onAddClick(); }}>
                  + เพิ่มบริษัทใหม่
                </button>
              )}
            </div>
          )}
        </div>
      )}
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

const editBtnStyle = { background: "#2563eb", border: "none", padding: "6px 12px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", color: "#fff" };

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
.input { padding:10px 14px; border-radius:10px; border:1px solid #e5e7eb; font-weight:600; width:100%; box-sizing:border-box; font-family: inherit; transition: 0.2s; }
.input:focus { border-color: #3b82f6; outline: none; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:15px 20px; }
.action-row { display:flex; justify-content:flex-end; gap:10px; margin-top:25px; }
.btn { background:#2563eb; color:#fff; padding:10px 20px; border-radius:10px; font-weight:700; border: none; cursor: pointer; display: flex; align-items: center; transition: 0.2s; }
.btn:hover { background: #1d4ed8; }
.btn-secondary { background:#f1f5f9; color:#475569; padding:10px 20px; border-radius:10px; font-weight:700; border: none; cursor: pointer; }
.btn-secondary:hover { background:#e2e8f0; }
.modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.45); display:flex; align-items:center; justify-content:center; z-index:50; backdrop-filter: blur(4px); }
.modal-card { background:#fff; border-radius:24px; padding:35px; width:750px; max-width:95%; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1); }
`;