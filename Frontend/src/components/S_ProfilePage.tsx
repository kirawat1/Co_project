import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IcEdit, IcSave } from "./icons";
import { useToast } from "./Toast";
import Spinner from "./Spinner";

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
  generalAdvisor?: { firstName: string; lastName: string; email: string } | null;
  coopAdvisor?: { firstName: string; lastName: string; email: string } | null;
  phone?: string;
  studyProgram?: "ภาคปกติ" | "ภาคพิเศษ" | "normal" | "special";
  email?: string;
  nationality?: string;
  userEmail?: string;
  emails: { id?: number; email: string; primary: boolean }[];
  company?: StudentCompany;
  docs: any[];
  isQualified?: boolean; // ✅ เอาไว้โชว์เฉยๆ ว่าเกรดถึงไหม
  coopAdvisorId?: number | null;
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
/* ================= ADVISOR ROW ================= */
function AdvisorRow({
  label,
  advisor,
  fallback,
}: {
  label: string;
  advisor?: { firstName: string; lastName: string; email: string } | null;
  fallback?: string | null;
}) {
  const name = advisor
    ? `${advisor.firstName} ${advisor.lastName}`
    : (fallback || null);

  if (!name) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
          อาจารย์ {name}
        </div>
        {advisor?.email && (
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{advisor.email}</div>
        )}
      </div>
      {advisor?.email && (
        <a
          href={`mailto:${advisor.email}`}
          style={{ padding: '6px 14px', background: '#eff6ff', color: '#2563eb', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none', border: '1px solid #bfdbfe' }}
        >
          ติดต่อ
        </a>
      )}
    </div>
  );
}

/* ================= PAGE ================= */
export default function S_ProfilePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [companies, setCompanies] = useState<StudentCompany[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [openStudentModal, setOpenStudentModal] = useState(false);
  const token = localStorage.getItem("coop.token");

  // ── KKU REG Sync ──────────────────────────────
  const [kkuModalOpen, setKkuModalOpen] = useState(false);
  const [kkuUser, setKkuUser] = useState("");
  const [kkuPass, setKkuPass] = useState("");
  const [kkuSyncing, setKkuSyncing] = useState(false);
  const [kkuAvailable, setKkuAvailable] = useState<boolean | null>(null); // null = ยังไม่ตรวจ

  // ตรวจสอบว่า KKU REG API พร้อมใช้ไหม
  useEffect(() => {
    fetch("/api/students/reg-status", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setKkuAvailable(d.configured); })
      .catch(() => setKkuAvailable(false));
  }, []);

  const handleSyncFromKKU = async () => {
    if (!kkuUser.trim() || !kkuPass.trim()) {
      toast.warning("กรุณากรอก KKU Username และ Password");
      return;
    }
    setKkuSyncing(true);
    try {
      const res = await fetch("/api/students/sync-from-reg", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kkuUsername: kkuUser.trim(), kkuPassword: kkuPass }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success(data.message || "ซิงค์ข้อมูลจาก KKU สำเร็จ");
        setKkuModalOpen(false);
        setKkuUser(""); setKkuPass("");
        // รีโหลดข้อมูล Profile
        fetch("/api/students/me", { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json()).then(d => setProfile(d)).catch(() => {});
      } else {
        toast.error(data.message || "ซิงค์ไม่สำเร็จ");
      }
    } catch {
      toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setKkuSyncing(false);
    }
  };

  // Mapping Helpers
  const prefixMapToPrisma = { นาย: "MR", นางสาว: "MS", MR: "MR", MS: "MS" };
  const prefixMapToUI = { MR: "นาย", MS: "นางสาว", นาย: "นาย", นางสาว: "นางสาว" };
  const studyProgramMapToPrisma = { ภาคปกติ: "normal", ภาคพิเศษ: "special", normal: "normal", special: "special" };
  const studyProgramMapToUI = { normal: "ภาคปกติ", special: "ภาคพิเศษ", ภาคปกติ: "ภาคปกติ", ภาคพิเศษ: "ภาคพิเศษ" } as any;

  useEffect(() => {
    if (!token) return;

    // 1. ดึงข้อมูล Profile
    fetch("/api/students/me", {
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
    fetch("/api/companies", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => setCompanies(data))
      .catch(err => console.error("Error fetching companies:", err));

    // 3. ดึงข้อมูลอาจารย์
    fetch("/api/teachers", {
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
      const res = await fetch("/api/students/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...updatedProfile,
          prefix: prefixMapToPrisma[updatedProfile.prefix as keyof typeof prefixMapToPrisma] || updatedProfile.prefix,
          studyProgram: studyProgramMapToPrisma[updatedProfile.studyProgram as keyof typeof studyProgramMapToPrisma] || updatedProfile.studyProgram,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่");
        return;
      }

      // re-fetch เต็มหลัง save เพื่อให้ได้ข้อมูลครบ (firstNameEn, curriculum, coop, ฯลฯ)
      const fresh = await fetch("/api/students/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (fresh.ok) {
        const data = await fresh.json();
        const emails = data.emails?.length > 0 ? data.emails : [{ email: "", primary: false }];
        const company = data.coop ? { ...data.coop.company, mentor: data.coop.mentor } : data.company;
        setProfile({ ...data, emails, company });
      }

      alert("บันทึกข้อมูลเรียบร้อย");
      setOpenStudentModal(false);
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  }

  async function saveStudentCompany() {
    if (!profile) return;
    try {
      const res = await fetch("/api/students/me", {
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
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* ปุ่ม KKU Sync — แสดงเฉพาะเมื่อ API พร้อม หรือยังไม่ทราบสถานะ */}
              {kkuAvailable !== false && (
                <button
                  onClick={() => setKkuModalOpen(true)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    border: "1px solid #bfdbfe", cursor: "pointer",
                    background: kkuAvailable ? "#eff6ff" : "#f8fafc",
                    color: kkuAvailable ? "#1d4ed8" : "#94a3b8",
                  }}
                  title={kkuAvailable ? "ดึงข้อมูลจาก KKU สำนักทะเบียน" : "รอการตั้งค่า KKU API"}
                >
                  🏫 {kkuAvailable ? "ดึงข้อมูลจาก KKU" : "KKU Sync (เร็วๆ นี้)"}
                </button>
              )}
              <button className="btn-edit" onClick={() => setOpenStudentModal(true)} style={editBtnStyle}>
                <IcEdit width={16} height={16} /> แก้ไขข้อมูล
              </button>
            </div>
          </div>

          {/* ── KKU Sync Modal ── */}
          {kkuModalOpen && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)" }}>
              <div style={{ background: "var(--surface,#fff)", borderRadius: 20, padding: 32, width: 420, maxWidth: "95%", boxShadow: "0 20px 40px rgba(0,0,0,.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>🏫 ดึงข้อมูลจาก KKU</h3>
                  <button onClick={() => setKkuModalOpen(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" }}>✕</button>
                </div>
                <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
                  ระบบจะดึงข้อมูล ชื่อ-นามสกุล, สาขา, คณะ, ชั้นปี, GPA และอาจารย์ที่ปรึกษา จากสำนักทะเบียน มข. มาเติมให้อัตโนมัติ
                </p>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>KKU Username (อีเมล @kkumail.com)</label>
                  <input
                    type="email" value={kkuUser}
                    onChange={e => setKkuUser(e.target.value)}
                    placeholder="xxxxxxxxxx@kkumail.com"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>KKU Password (รหัสผ่าน KKU)</label>
                  <input
                    type="password" value={kkuPass}
                    onChange={e => setKkuPass(e.target.value)}
                    placeholder="รหัสผ่าน KKU ของคุณ"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, boxSizing: "border-box" }}
                    onKeyDown={e => e.key === "Enter" && handleSyncFromKKU()}
                  />
                </div>
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#92400e" }}>
                  🔒 รหัสผ่านของคุณจะถูกส่งไปยังเซิร์ฟเวอร์สำนักทะเบียนโดยตรง ไม่ถูกบันทึกในระบบนี้
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => setKkuModalOpen(false)} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontWeight: 700 }}>ยกเลิก</button>
                  <button
                    onClick={handleSyncFromKKU}
                    disabled={kkuSyncing}
                    style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#1d4ed8", color: "#fff", cursor: "pointer", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}
                  >
                    {kkuSyncing ? <><Spinner size={16} color="#fff" /> กำลังดึงข้อมูล...</> : "🏫 ดึงข้อมูลจาก KKU"}
                  </button>
                </div>
              </div>
            </div>
          )}

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
          {/* อาจารย์ที่ปรึกษา */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#334155', marginBottom: 10 }}>
              อาจารย์ที่ปรึกษา
            </div>
            <AdvisorRow
              label="ที่ปรึกษาทั่วไป"
              advisor={profile.generalAdvisor}
              fallback={profile.advisorName}
            />
            <AdvisorRow
              label="ที่ปรึกษาโปรเจ็ค"
              advisor={profile.coopAdvisor}
            />
          </div>
          <Info label="เบอร์โทร" value={profile.phone || "-"} />
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
    // normalize studentId: เก็บเฉพาะตัวเลข ≤ 10 หลัก ตั้งแต่โหลดครั้งแรก
    studentId: (profile.studentId ?? "").replace(/\D/g, "").slice(0, 10),
    prefix: prefixMapToUI[profile.prefix] || profile.prefix || "",
    studyProgram: studyProgramMapToUI[profile.studyProgram] || profile.studyProgram || "",
    curriculum: profile.curriculum || "วิทยาลัยการคอมพิวเตอร์"
  }));

  const [majorOptions, setMajorOptions] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/admin/majors")
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
          <div>
            <label className="label">รหัสนักศึกษา</label>
            <input
              className="input"
              value={form.studentId}
              maxLength={10}
              inputMode="numeric"
              pattern="\d*"
              placeholder="ตัวเลข 1–10 หลัก"
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                setForm({ ...form, studentId: val });
              }}
            />
            {form.studentId && form.studentId.length > 10 && (
              <span style={{ color: "#dc2626", fontSize: 12 }}>รหัสนักศึกษาต้องไม่เกิน 10 หลัก</span>
            )}
          </div>
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

          <div>
            <label className="label">อาจารย์ที่ปรึกษาโครงงานสหกิจ</label>
            <select
              className="input"
              value={form.coopAdvisorId ?? ""}
              onChange={(e) => setForm({ ...form, coopAdvisorId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">-- ยังไม่ได้เลือก --</option>
              {teachers.map((t: any) => {
                const fullName = `${t.prefix || ""}${t.firstName} ${t.lastName}`;
                return (
                  <option key={t.id} value={t.id}>
                    {fullName}{t.email ? ` (${t.email})` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div><label className="label">ชั้นปี</label><input className="input" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>

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