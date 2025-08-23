import React, { useRef, useState, useMemo } from "react";
import type { StudentProfile, CompanyInfo, MentorInfo } from "./store";

// ขยาย CompanyInfo ให้รองรับช่วงวัน (เริ่ม/สิ้นสุด)
type CompanyWithPeriod = CompanyInfo & { startDate?: string; endDate?: string };

// defaults
const emptyCompany: CompanyInfo = {
  id: "", // ใส่ค่า default
  name: "",
  address: "",
  hrName: "",
  hrEmail: ""
};
const emptyMentor: MentorInfo = {
  id: "",
  firstName: "",
  lastName: "",
  email: "",
  title: "",
  phone: "",
  companyId: ""
};

export default function CoopPage({
  profile,
  setProfile,
}: {
  profile: StudentProfile;
  setProfile: (p: StudentProfile) => void;
}) {
  // state ฟอร์ม
  const [company, setCompany] = useState<CompanyWithPeriod>(
    (profile.company as CompanyWithPeriod) || { ...emptyCompany }
  );
  const [mentor, setMentor] = useState<MentorInfo>(profile.mentor || { ...emptyMentor });

  // flags
  const hasCompany = useMemo(() => {
    const c = profile.company as CompanyWithPeriod | undefined;
    return !!(c && (c.name?.trim() || c.address?.trim() || c.hrName?.trim() || c.hrEmail?.trim() || c.startDate || c.endDate));
  }, [profile.company]);

  const hasMentor = useMemo(() => {
    const m = profile.mentor;
    return !!(m && (m.firstName?.trim() || m.lastName?.trim() || m.email?.trim() || m.title?.trim()));
  }, [profile.mentor]);

  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [showMentorForm, setShowMentorForm] = useState(false);
  const [banner, setBanner] = useState("");
  const [showEditMenu, setShowEditMenu] = useState(false);

  // refs
  const companyFormRef = useRef<HTMLFormElement | null>(null);
  const mentorFormRef = useRef<HTMLFormElement | null>(null);
  const companyFirstRef = useRef<HTMLInputElement | null>(null);
  const mentorFirstRef = useRef<HTMLInputElement | null>(null);


  // ระยะเวลาในสรุป
  const companyDurationText = useMemo(() => {
    const c = profile.company as CompanyWithPeriod | undefined;
    if (!c?.startDate || !c?.endDate) return "";
    const s = new Date(c.startDate);
    const e = new Date(c.endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return "";
    const MS = 24 * 60 * 60 * 1000;
    const days = Math.round((e.getTime() - s.getTime()) / MS) + 1;
    const weeks = (days / 7).toFixed(days % 7 === 0 ? 0 : 1);
    return `${days} วัน (~${weeks} สัปดาห์)`;
  }, [profile.company]);

  // ระยะเวลาขณะกรอก
  const draftDurationText = useMemo(() => {
    if (!company.startDate || !company.endDate) return "";
    const s = new Date(company.startDate);
    const e = new Date(company.endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return "";
    const MS = 24 * 60 * 60 * 1000;
    const days = Math.round((e.getTime() - s.getTime()) / MS) + 1;
    const weeks = (days / 7).toFixed(days % 7 === 0 ? 0 : 1);
    return `ระยะเวลา: ${days} วัน (~${weeks} สัปดาห์)`;
  }, [company.startDate, company.endDate]);

  // ===== Actions =====
  function handleAddCompany() {
    setCompany(profile.company ? (profile.company as CompanyWithPeriod) : { ...emptyCompany });
    setShowCompanyForm(true);
    setTimeout(() => {
      companyFormRef.current?.scrollIntoView({ behavior: "smooth" });
      companyFirstRef.current?.focus();
    }, 50);
  }

  function handleAddMentor() {
    if (!hasCompany) {
      setBanner("กรุณาเพิ่มข้อมูลบริษัทก่อนจึงจะเพิ่มข้อมูลพี่เลี้ยงได้");
      setTimeout(() => setBanner(""), 2200);
      companyFormRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setMentor(profile.mentor ?? { ...emptyMentor });
    setShowMentorForm(true);
    setTimeout(() => {
      mentorFormRef.current?.scrollIntoView({ behavior: "smooth" });
      mentorFirstRef.current?.focus();
    }, 50);
  }

  function handleEditCompany() {
    setCompany((profile.company as CompanyWithPeriod) || { ...emptyCompany });
    setShowCompanyForm(true);
  }
  function handleEditMentor() {
    setMentor(profile.mentor ?? { ...emptyMentor });
    setShowMentorForm(true);
  }

  function onSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    setProfile({ ...profile, company });
    setShowCompanyForm(false);
    setBanner("บันทึกข้อมูลบริษัทเรียบร้อยแล้ว");
    setTimeout(() => setBanner(""), 2000);
  }
  function onSaveMentor(e: React.FormEvent) {
    e.preventDefault();
    setProfile({ ...profile, mentor });
    setShowMentorForm(false);
    setBanner("บันทึกข้อมูลพี่เลี้ยงเรียบร้อยแล้ว");
    setTimeout(() => setBanner(""), 2000);
  }

  // ❗ ลบทุกอย่างพร้อมกัน
  function handleDeleteAll() {
    if (!window.confirm("ยืนยันลบข้อมูลบริษัทและพี่เลี้ยงทั้งหมด?")) return;
    setProfile({ ...profile, company: undefined, mentor: undefined });
    setCompany({ ...emptyCompany });
    setMentor({ ...emptyMentor });
    setShowCompanyForm(false);
    setShowMentorForm(false);
    setBanner("ลบข้อมูลบริษัทและพี่เลี้ยงเรียบร้อยแล้ว");
    setTimeout(() => setBanner(""), 2500);
  }

  const showMentorSide = hasCompany || hasMentor || showMentorForm;

  return (
    <div className="page co-wrapper" style={{ padding: 4, margin: 36, marginLeft: 60 }}>
      {banner && <div className="banner ok">{banner}</div>}

      {!hasCompany && !showCompanyForm && (
        <div className="top-actions">
          <button className="btn" type="button" onClick={handleAddCompany}>+ เพิ่มข้อมูลบริษัท</button>
        </div>
      )}

      {/* การ์ดสรุป (บริษัทอยู่บน, พี่เลี้ยงอยู่ล่าง) + ปุ่มลบรวม */}
      {(hasCompany || hasMentor) && (
        <section className="card summary-card" style={{ marginBottom: 16, padding: 24, marginTop: 8 }}>
          <div className="summary-titlebar">
            <h2 style={{ margin: 0, paddingLeft: 8, marginTop: 0 }}>ข้อมูลฝึกสหกิจศึกษา</h2>
            <div className="summary-actions">
              {/* ปุ่มแก้ไข (เมนูเลือกว่าจะแก้ไขอะไร) */}
              <div className="menu-wrap">
                <button
                  type="button"
                  className="icon-btn"
                  aria-haspopup="menu"
                  aria-expanded={showEditMenu}
                  onClick={() => setShowEditMenu(v => !v)}
                  title="แก้ไข"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
                {showEditMenu && (
                  <div className="menu" role="menu">
                    <button role="menuitem" onClick={() => { handleEditCompany(); setShowEditMenu(false); }} disabled={!hasCompany}>
                      แก้ไขข้อมูลบริษัท
                    </button>
                    <button role="menuitem" onClick={() => { handleEditMentor(); setShowEditMenu(false); }} disabled={!hasMentor}>
                      แก้ไขข้อมูลพี่เลี้ยง
                    </button>
                  </div>
                )}
              </div>

              {/* ปุ่มลบเดียว — ลบทั้งบริษัทและพี่เลี้ยง */}
              <button
                type="button"
                className="icon-btn danger"
                onClick={handleDeleteAll}
                title="ลบทั้งหมด"
                aria-label="ลบข้อมูลบริษัทและพี่เลี้ยงทั้งหมด"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>

          {/* สรุปแนวตั้ง: บริษัท (บน) → พี่เลี้ยง (ล่าง) */}
          <div className="summary-vertical">
            <div className="summary-block">
              <h3 className="summary-subtitle" style={{ paddingLeft: 24 }}>ข้อมูลบริษัท</h3>
              {hasCompany && profile.company ? (
                <ul className="summary-list" style={{ fontWeight: 350 }}>
                  <li><b>ชื่อบริษัท:</b> {(profile.company as CompanyWithPeriod).name}</li>
                  <li><b>ที่อยู่:</b> {(profile.company as CompanyWithPeriod).address}</li>
                  <li><b>ชื่อ HR:</b> {(profile.company as CompanyWithPeriod).hrName}</li>
                  <li><b>อีเมล HR:</b> {(profile.company as CompanyWithPeriod).hrEmail}</li>
                  {(profile.company as CompanyWithPeriod).startDate && (profile.company as CompanyWithPeriod).endDate && (
                    <>
                      <li><b>ช่วงฝึกสหกิจ:</b> {(profile.company as CompanyWithPeriod).startDate} — {(profile.company as CompanyWithPeriod).endDate}</li>
                      {companyDurationText && <li><b>ระยะเวลา:</b> {companyDurationText}</li>}
                    </>
                  )}
                </ul>
              ) : (
                <div className="summary-empty">ยังไม่มีข้อมูลบริษัท</div>
              )}
            </div>

            <div className="summary-block">
              <h3 className="summary-subtitle" style={{ paddingLeft: 24 }}>ข้อมูลพี่เลี้ยง</h3>
              {hasMentor && profile.mentor ? (
                <ul className="summary-list" style={{ fontWeight: 350 }}>
                  <li><b>ชื่อ-นามสกุล:</b> {profile.mentor.firstName} {profile.mentor.lastName}</li>
                  <li><b>ตำแหน่ง:</b> {profile.mentor.title}</li>
                  <li><b>Email:</b> {profile.mentor.email}</li>
                </ul>
              ) : (
                <div className="summary-empty" style={{ marginLeft: 18, paddingLeft: 24, width: 150 }}>
                  ยังไม่มีข้อมูลพี่เลี้ยง
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* โซนคอลัมน์ (ฟอร์ม) */}
      <div className={`two-col ${!showMentorSide ? "two-col--single" : ""}`}>
        {/* บริษัท */}
        {showCompanyForm ? (
          <form ref={companyFormRef} className="card" onSubmit={onSaveCompany} style={{ padding: 24, margin: 0 }}>
            <h2 style={{ marginTop: 0 }}>ข้อมูลบริษัท</h2>
            <div className="form-grid">
              <div className="field">
                <label className="label">ชื่อบริษัท</label>
                <input
                  ref={companyFirstRef}
                  className="input"
                  value={company.name}
                  onChange={(e) => setCompany({ ...company, name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label className="label">ที่อยู่บริษัท</label>
                <textarea
                  className="input"
                  rows={2}
                  value={company.address}
                  onChange={(e) => setCompany({ ...company, address: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label className="label">ชื่อ HR</label>
                <input
                  className="input"
                  value={company.hrName}
                  onChange={(e) => setCompany({ ...company, hrName: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label className="label">อีเมล HR</label>
                <input
                  type="email"
                  className="input"
                  value={company.hrEmail}
                  onChange={(e) => setCompany({ ...company, hrEmail: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label className="label">ระยะเวลาฝึกสหกิจศึกษา</label>
                <div className="date-row">
                  <div className="date-item">
                    <span className="sub">วันที่เริ่ม</span>
                    <input
                      type="date"
                      className="input"
                      value={company.startDate || ""}
                      onChange={(e) => setCompany({ ...company, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="date-item">
                    <span className="sub">วันที่สิ้นสุด</span>
                    <input
                      type="date"
                      className="input"
                      value={company.endDate || ""}
                      min={company.startDate || undefined}
                      onChange={(e) => setCompany({ ...company, endDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
                {draftDurationText && <div className="duration-hint">{draftDurationText}</div>}
              </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
              <button className="btn" type="submit">บันทึกข้อมูลบริษัท</button>
              <button type="button" className="btn secondary" onClick={() => setShowCompanyForm(false)}>
                ยกเลิก
              </button>
            </div>
          </form>
        ) : hasCompany ? (
          null
        ) : (
          <section className="card empty-card">
            <div className="empty-title">ยังไม่มีข้อมูลบริษัท</div>
            <div className="empty-desc">คลิก “เพิ่มข้อมูลบริษัท” ด้านบนเพื่อเริ่มกรอก</div>
          </section>
        )}

        {/* พี่เลี้ยง */}
        {(hasCompany || hasMentor || showMentorForm) && (
          showMentorForm ? (
            <form ref={mentorFormRef} className="card" onSubmit={onSaveMentor} style={{ padding: 24, margin: 0 }}>
              <h2 style={{ marginTop: 0 }}>ข้อมูลพี่เลี้ยง</h2>
              <div className="form-grid">
                <div className="field">
                  <label className="label">ชื่อ</label>
                  <input
                    ref={mentorFirstRef}
                    className="input"
                    value={mentor.firstName}
                    onChange={(e) => setMentor({ ...mentor, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label className="label">นามสกุล</label>
                  <input
                    className="input"
                    value={mentor.lastName}
                    onChange={(e) => setMentor({ ...mentor, lastName: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label className="label">ตำแหน่งงาน</label>
                  <input
                    className="input"
                    value={mentor.title}
                    onChange={(e) => setMentor({ ...mentor, title: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label className="label">อีเมล</label>
                  <input
                    type="email"
                    className="input"
                    value={mentor.email}
                    onChange={(e) => setMentor({ ...mentor, email: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
                <button className="btn" type="submit">บันทึกข้อมูลพี่เลี้ยง</button>
                <button type="button" className="btn secondary" onClick={() => setShowMentorForm(false)}>
                  ยกเลิก
                </button>
              </div>
            </form>
          ) : hasMentor ? (
            <section className="card empty-card">
              <div className="empty-title">มีข้อมูลพี่เลี้ยงแล้ว</div>
              <div className="empty-desc">คุณสามารถแก้ไขจากส่วน “ข้อมูลฝึกสหกิจศึกษา” ด้านบนได้</div>
            </section>
          ) : (
            <section className="card empty-card">
              <div className="empty-title">ยังไม่มีข้อมูลพี่เลี้ยง</div>
              <div className="empty-desc">เพิ่มข้อมูลบริษัทให้เรียบร้อยก่อน จากนั้นจึงเพิ่มข้อมูลพี่เลี้ยงได้</div>
              {hasCompany && (
                <button className="btn" type="button" onClick={handleAddMentor}>+ เพิ่มข้อมูลพี่เลี้ยง</button>
              )}
            </section>
          )
        )}
      </div>

      {/* ---- Styles ---- */}
      <style>{`
        /* ปุ่มบนสุด */
        .co-wrapper .top-actions{
          display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 12px;
        }

        /* การ์ดสรุป */
        .co-wrapper .summary-card{ position: relative; }
        .co-wrapper .summary-titlebar{
          display:flex; align-items:center; justify-content: space-between; gap:12px; margin-bottom: 10px;
        }
        .co-wrapper .summary-actions{ display:flex; gap:8px; position: relative; }
        .co-wrapper .menu-wrap{ position: relative; }
        .co-wrapper .menu{
          position: absolute; right: 0; top: 40px;
          background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
          box-shadow: 0 6px 24px rgba(0,0,0,0.08);
          padding: 6px; min-width: 180px; z-index: 10;
        }
        .co-wrapper .menu button{
          width: 100%; text-align: left; padding: 8px 10px; border-radius: 8px;
          background: transparent; border: none; cursor: pointer; font-size: 14px;
        }
        .co-wrapper .menu button:hover{ background: #f5f7fb; }
        .co-wrapper .menu button:disabled{ color:#9aa5b1; cursor: not-allowed; }

        /* สรุปแนวตั้ง: บริษัทบน → พี่เลี้ยงล่าง */
        .co-wrapper .summary-vertical{ display: grid; gap: 16px; }
        .co-wrapper .summary-block{ display: grid; gap: 8px; }
        .co-wrapper .summary-subtitle{ margin: 4px 0 0 0; font-size: 16px; }
        .co-wrapper .summary-list{ margin: 6px 0 0 16px; }
        .co-wrapper .summary-empty{
          font-size: 14px; color:#64748b; border: 1px dashed #e2e8f0; padding: 10px 12px; border-radius: 8px;
        }
        .co-wrapper .link-btn{
          background: none; border: none; color: #0b62d6; cursor: pointer; padding: 0; text-decoration: underline;
        }

        /* เลย์เอาท์ฟอร์ม: เดสก์ท็อป 2 คอลัมน์ / จอเล็ก 1 คอลัมน์ */
        .co-wrapper .two-col{
          display:grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start;
        }
        .co-wrapper .two-col.two-col--single{ grid-template-columns: 1fr; }
        @media (max-width: 1199px){
          .co-wrapper .two-col{ grid-template-columns: 1fr; }
        }

        /* Banner (ฟอนต์บาง) */
        .co-wrapper .banner.ok{
          margin-bottom: 12px; padding: 10px 14px; border: 1px solid #cfe7cf;
          background: #f0fff0; color: #0a5c2d; border-radius: 8px; font-weight: 400;
        }

        /* การ์ดว่าง */
        .co-wrapper .empty-card{
          padding: 24px; display: grid; gap: 10px; border: 1px dashed #cfd8e3; align-content: start;
        }
        .co-wrapper .empty-title{ font-weight: 600; }
        .co-wrapper .empty-desc{ font-size: 14px; color: #5b6b7a; }

        /* ฟอร์มแนวตั้ง + ช่องกรอกเล็ก */
        .co-wrapper .form-grid{
          display:grid; grid-template-columns: 1fr; row-gap: 14px;
        }
        .co-wrapper .field{ display:grid; gap:6px; }
        .co-wrapper .label{ font-size: 13px; }

        .co-wrapper .input,
        .co-wrapper input.input,
        .co-wrapper select.input{
          font-size: 14px; line-height: 1.2; padding: 6px 10px; height: 36px; box-sizing: border-box;
        }
        .co-wrapper textarea.input{
          font-size: 14px; line-height: 1.35; padding: 8px 10px; min-height: 64px; height: auto; resize: vertical;
        }

        /* แถววันที่ */
        .co-wrapper .date-row{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 1199px){ .co-wrapper .date-row{ grid-template-columns: 1fr; } }
        .co-wrapper .date-item{ display: grid; gap: 6px; }
        .co-wrapper .date-item .sub{ font-size: 12px; color:#5b6b7a; }
        .co-wrapper .duration-hint{ margin-top: 8px; font-size: 13px; color:#0a5c2d; }

        /* ปุ่มไอคอน */
        .icon-btn{
          width: 32px; height: 32px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 8px;
          border: 1px solid #d9e1ec;
          background: #fff;
          color: #334155;
          cursor: pointer;
        }
        .icon-btn:hover{ background: #f5f7fb; }
        .icon-btn svg{ width: 18px; height: 18px; }
        .icon-btn.danger{ border-color: #ffb3b3; color: #b00020; }
        .icon-btn.danger:hover{ background: #ffe8e8; }

        /* ปุ่มเล็ก (สำรอง) */
        .btn.btn-sm{ font-size: 12px; padding: 4px 10px; height: 28px; }
        .btn.secondary{ background:#eef2f7; color:#111; border:1px solid #d9e1ec; }
        .btn.secondary:hover{ background:#e6edf7; }
        .btn.danger{ background:#ffe8e8; color:#b00020; border:1px solid #ffb3b3; }
        .btn.danger:hover{ background:#ffdcdc; }
      `}</style>
    </div>
  );
}
