/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useState, useEffect } from "react";

/* ----------------------------------------------------
   Types
---------------------------------------------------- */
export interface AdminCompanyRecord {
  id: string;
  name: string;
  nameEn?: string;
  address?: string;
  addressNo?: string;
  moo?: string;
  soi?: string;
  road?: string;
  subDistrict?: string;
  district?: string;
  province?: string;
  zipcode?: string;
  fax?: string;
  email: string;
  phone: string;
  website?: string;
  contactPosition?: string;
  contactPerson?: string;
  pastYears: string;
  mentors: MentorRecord[];
}

interface MentorRecord {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  position: string;
  email: string;
  phone?: string;
}

/* ----------------------------------------------------
   Main Component
---------------------------------------------------- */
export default function A_Companies() {
  const [items, setItems] = useState<AdminCompanyRecord[]>([]);
  const [q, setQ] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [viewCompany, setViewCompany] = useState<AdminCompanyRecord | null>(null);
  const [showAddMentor, setShowAddMentor] = useState(false);
  const [editingMentor, setEditingMentor] = useState<any>(null);

  const [form, setForm] = useState<any>(emptyCompany());
  const [mentorForm, setMentorForm] = useState<any>(emptyMentor());

  // State สำหรับเก็บข้อมูลปีการศึกษาจาก Backend
  const [coopPeriods, setCoopPeriods] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("coop.token");

    // ดึงรายชื่อบริษัท
    fetch("http://localhost:5000/api/companies", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async res => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Unauthorized");
        }
        return res.json();
      })
      .then(data => setItems(data))
      .catch(err => console.error("Error fetching companies:", err));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("coop.token");
    const fetchPeriods = async () => {
      try {
        // 🟢 เรียก API ของ admin ตาม Route ที่มีอยู่: /api/admin/coop-periods/all
        const res = await fetch("http://localhost:5000/api/admin/coop-periods/all", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.ok && data.periods) {
          setCoopPeriods(data.periods);
        }
      } catch (err) {
        console.error("Failed to fetch periods:", err);
      }
    };

    fetchPeriods();
  }, []);

  function emptyCompany() {
    return {
      name: "", nameEn: "",
      addressNo: "", moo: "", soi: "", road: "",
      subDistrict: "", district: "", province: "", zipcode: "",
      email: "", phone: "", fax: "", website: "", pastYears: "",
      contactPerson: "", contactPosition: "",
    };
  }

  function emptyMentor() {
    return {
      firstName: "", lastName: "", department: "",
      position: "", email: "", phone: "",
    };
  }

  const filtered = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.filter((c) =>
      `${c.name} ${c.nameEn} ${c.province} ${c.email} ${c.pastYears} ${c.addressNo || ''}`
        .toLowerCase()
        .includes(q.toLowerCase())
    );
  }, [items, q]);

  /* ---------------- CRUD บริษัท ---------------- */
  async function saveAdd(e: React.FormEvent) {
    e.preventDefault();

    const token = localStorage.getItem("coop.token");
    if (!token) return alert("กรุณาเข้าสู่ระบบ");

    try {
      const res = await fetch("http://localhost:5000/api/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!data.ok || !data.company) {
        alert("บันทึกบริษัทไม่สำเร็จ");
        return;
      }

      setItems(prev => [...prev, data.company]);
      setShowAdd(false);

    } catch (err) {
      console.error(err);
      alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem("coop.token");
    if (!token || !form.id) return alert("ข้อมูลไม่ครบถ้วน");

    try {
      const res = await fetch(`http://localhost:5000/api/companies/${form.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message);

      setItems((prev) => prev.map((c) => c.id === form.id ? data.company : c));
      setShowEdit(false);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "อัปเดตไม่สำเร็จ");
    }
  }

  async function remove(id: string) {
    if (!confirm("ลบบริษัทนี้พร้อมพี่เลี้ยงทั้งหมดหรือไม่?")) return;

    const token = localStorage.getItem("coop.token");

    const res = await fetch(`http://localhost:5000/api/companies/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!data.ok) return alert(data.message);

    setItems(prev => prev.filter(c => c.id !== id));
    if (viewCompany?.id === id) setViewCompany(null);
  }

  /* ---------------- Mentor ---------------- */
  async function saveMentor(e: React.FormEvent) {
    e.preventDefault();
    if (!viewCompany) return;

    const { firstName, lastName, department, position, email, phone } = mentorForm;

    if (!firstName || !lastName || !department || !position || !email || !phone) {
      alert("กรุณากรอกข้อมูลพี่เลี้ยงให้ครบทุกช่อง");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      alert("รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }

    const token = localStorage.getItem("coop.token");
    if (!token) return alert("กรุณาเข้าสู่ระบบ");

    try {
      if (!editingMentor) {
        // ---- ADD ----
        const res = await fetch(`http://localhost:5000/api/companies/${viewCompany.id}/mentors`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(mentorForm),
        });
        const data = await res.json();
        if (!data.ok || !data.mentor) return alert("เพิ่มพี่เลี้ยงไม่สำเร็จ");

        setViewCompany(prev => prev ? { ...prev, mentors: [...prev.mentors, data.mentor] } : prev);
        setItems(prev => prev.map(c => c.id === viewCompany?.id ? { ...c, mentors: [...c.mentors, data.mentor] } : c));

      } else {
        // ---- EDIT ----
        const res = await fetch(`http://localhost:5000/api/companies/mentors/${editingMentor.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(mentorForm),
        });
        const data = await res.json();
        if (!data.ok || !data.mentor) return alert("แก้ไขพี่เลี้ยงสำเร็จ");

        setViewCompany(prev => prev ? { ...prev, mentors: prev.mentors.map(m => m.id === editingMentor.id ? data.mentor : m) } : prev);
        setItems(prev => prev.map(c => c.id === viewCompany?.id ? { ...c, mentors: c.mentors.map(m => m.id === editingMentor.id ? data.mentor : m) } : c));
      }

      setEditingMentor(null);
      setMentorForm(emptyMentor());
      setShowAddMentor(false);

    } catch (err) {
      console.error(err);
      alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  }

  async function removeMentor(mentorId: string) {
    if (!confirm("ลบพี่เลี้ยงคนนี้หรือไม่?")) return;
    const token = localStorage.getItem("coop.token");

    try {
      const res = await fetch(`http://localhost:5000/api/companies/mentors/${mentorId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!data.ok) return alert(data.message || "ลบพี่เลี้ยงไม่สำเร็จ");

      setViewCompany(prev => prev ? { ...prev, mentors: prev.mentors.filter(m => m.id !== mentorId) } : prev);
      setItems(prev => prev.map(c => c.id === viewCompany?.id ? { ...c, mentors: c.mentors.filter(m => m.id !== mentorId) } : c));

    } catch (err) { console.error(err); alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ margin: 0 }}>🏢 จัดการข้อมูลบริษัทสหกิจศึกษา</h2>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <input
            className="input"
            placeholder="ค้นหา: ชื่อ / จังหวัด / อีเมล / ปี / เลขที่"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 320 }}
          />
          <button className="btn" style={{ background: '#0369a1' }} onClick={() => { setForm(emptyCompany()); setShowAdd(true); }}>
            + เพิ่มบริษัท
          </button>
        </div>
      </section>

      {/* Table */}
      <section className="card" style={{ padding: 24 }}>
        <table className="tbl" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>ชื่อบริษัท</th>
              <th>จังหวัด</th>
              <th>อีเมล</th>
              <th>ผู้ติดต่อ</th>
              <th>ปีที่รับ</th>
              <th style={{ ...td, textAlign: 'right' }}>การทำงาน</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 16, color: "#6b7280" }}>
                  — ไม่มีข้อมูล —
                </td>
              </tr>
            )}

            {filtered.map((c, idx) => (
              <tr key={c.id} className={idx % 2 ? "row-odd" : "row-even"}>
                <td style={{ fontWeight: 600, color: '#1e293b' }}>{c.name}</td>
                <td>{c.province || "-"}</td>
                <td>{c.email || "-"}</td>
                <td>{c.contactPerson || "-"}<br /><span style={{ fontSize: 12, color: '#64748b' }}>{c.contactPosition}</span></td>
                <td>{c.pastYears}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn" style={ghostBtn} onClick={() => setViewCompany(c)}>
                      รายละเอียด
                    </button>
                    <button className="btn" style={{ ...ghostBtn, color: '#c2410c', borderColor: '#c2410c', background: '#fff7ed' }} onClick={() => { setForm(c); setShowEdit(true); }}>
                      แก้ไข
                    </button>
                    <button className="btn" style={{ ...ghostBtn, color: '#ef4444', borderColor: '#fecaca', background: '#fef2f2' }} onClick={() => remove(c.id)}>
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ---------------- Modals ---------------- */}
      {showAdd && (
        <Modal title="✨ เพิ่มบริษัทสถานประกอบการใหม่" onClose={() => setShowAdd(false)}>
          {/* 🟢 ส่ง coopPeriods ลงไปให้แบบฟอร์มด้วย */}
          <CompanyForm form={form} setForm={setForm} onSubmit={saveAdd} coopPeriods={coopPeriods} />
        </Modal>
      )}

      {showEdit && (
        <Modal title="✏️ แก้ไขข้อมูลบริษัท" onClose={() => setShowEdit(false)}>
          {/* 🟢 ส่ง coopPeriods ลงไปให้แบบฟอร์มด้วย */}
          <CompanyForm form={form} setForm={setForm} onSubmit={saveEdit} coopPeriods={coopPeriods} />
        </Modal>
      )}

      {viewCompany && (
        <Modal title="🏢 รายละเอียดสถานประกอบการ" onClose={() => setViewCompany(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 14 }}>
            <div><b>ชื่อ (ไทย):</b> {viewCompany.name}</div>
            <div><b>ชื่อ (อังกฤษ):</b> {viewCompany.nameEn || "-"}</div>

            <div style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#334155' }}>ที่อยู่:</div>
              {viewCompany.addressNo ? (
                <span>
                  เลขที่ {viewCompany.addressNo} ม.{viewCompany.moo || "-"} ซ.{viewCompany.soi || "-"} ถ.{viewCompany.road || "-"} <br />
                  ต.{viewCompany.subDistrict || "-"} อ.{viewCompany.district || "-"} จ.{viewCompany.province || "-"} {viewCompany.zipcode || ""}
                </span>
              ) : (
                <span>{viewCompany.address || "-"}</span>
              )}
            </div>

            <div><b>อีเมล:</b> {viewCompany.email || "-"}</div>
            <div><b>เว็บไซต์:</b> {viewCompany.website || "-"}</div>
            <div><b>โทรศัพท์:</b> {viewCompany.phone || "-"}</div>
            <div><b>โทรสาร (Fax):</b> {viewCompany.fax || "-"}</div>

            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #eee', paddingTop: 10 }}>
              <b>ผู้ติดต่อ:</b> {viewCompany.contactPerson || "-"} ({viewCompany.contactPosition || "-"})
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 12 }}>
            <h4 style={{ margin: 0, color: '#4c1d95' }}>👥 ข้อมูลพี่เลี้ยง (Mentors)</h4>
            <button className="btn" style={{ background: '#0284c7', padding: '6px 12px', fontSize: 13 }} onClick={() => setShowAddMentor(true)}>+ เพิ่มพี่เลี้ยง</button>
          </div>

          {(viewCompany.mentors || []).length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 13, textAlign: 'center', background: '#f1f5f9', padding: 20, borderRadius: 8 }}>ยังไม่มีข้อมูลพี่เลี้ยงในระบบ</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", padding: '10px 8px', color: '#475569' }}>ชื่อ-นามสกุล</th>
                  <th style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", padding: '10px 8px', color: '#475569' }}>ตำแหน่ง / แผนก</th>
                  <th style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", padding: '10px 8px', color: '#475569' }}>ติดต่อ</th>
                  <th style={{ borderBottom: "2px solid #e2e8f0", textAlign: "center", padding: '10px 8px', color: '#475569' }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {(viewCompany.mentors || []).map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 8px' }}><b>{m.firstName} {m.lastName}</b></td>
                    <td style={{ padding: '10px 8px' }}>{m.position} <br /><span style={{ color: '#64748b', fontSize: 12 }}>{m.department}</span></td>
                    <td style={{ padding: '10px 8px' }}>{m.phone} <br /><span style={{ color: '#64748b', fontSize: 12 }}>{m.email}</span></td>
                    <td style={{ textAlign: "center", padding: '10px 8px' }}>
                      <button className="btn-secondary small" onClick={() => { setEditingMentor(m); setMentorForm(m); setShowAddMentor(true); }}>แก้ไข</button>
                      <button className="btn-danger small" onClick={() => removeMentor(m.id)}>ลบ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}

      {showAddMentor && (
        <Modal title={editingMentor ? "✏️ แก้ไขพี่เลี้ยง" : "➕ เพิ่มพี่เลี้ยง"} onClose={() => { setShowAddMentor(false); setEditingMentor(null); }}>
          <MentorForm form={mentorForm} setForm={setMentorForm} onSubmit={saveMentor} />
        </Modal>
      )}

      {/* ---------------- Styles ---------------- */}
      <style>{`
        .row-even { background:#ffffff; }
        .row-odd { background:#f8fafc; }
        .tbl th { text-align:left; font-size:13px; color:#475569; padding: 12px 6px; border-bottom: 2px solid #e2e8f0; }
        .tbl td { padding:12px 6px; font-size:14px; border-bottom: 1px solid #f1f5f9; }
        .btn { border-radius: 8px; border: none; font-weight: 600; color: white; background: #6366f1; cursor: pointer; padding: 10px 16px; transition: 0.2s; }
        .btn:hover { opacity: 0.9; }
        .btn-secondary { border-radius: 6px; border:1px solid #cbd5e1; padding:6px 12px; background:#fff; cursor:pointer; font-size:13px; font-weight: 600; color: #475569; }
        .btn-secondary:hover { background: #f8fafc; }
        .btn-secondary.small { padding:4px 10px; font-size:12px; }
        .btn-danger { border-radius: 6px; padding:6px 12px; border:1px solid #fecaca; background:#fef2f2; color:#b91c1c; font-size:12px; font-weight: 600; margin-left:6px; }
        .btn-danger:hover { background: #fee2e2; }
        .input { padding: 10px 14px; border-radius: 6px; border: 1px solid #cbd5e1; outline: none; font-family: inherit; font-size: 14px; width: 100%; box-sizing: border-box; }
        .input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }
      `}</style>
    </div>
  );
}

/* ----------------------------------------------------
   Sub Components
---------------------------------------------------- */
function Modal({ title, onClose, children }: any) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: 15 }}>
          <h3 style={{ margin: 0, color: '#1e293b' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b' }}>&times;</button>
        </div>
        <div style={{ marginTop: 20, maxHeight: '75vh', overflowY: 'auto', paddingRight: 5 }}>{children}</div>
      </div>
      <style>{`
        .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.5); display:flex; align-items:center; justify-content:center; z-index:100; backdrop-filter: blur(2px); }
        .modal-card { background:white; width:min(850px, 95vw); border-radius:16px; padding:24px; box-shadow:0 20px 25px -5px rgba(0,0,0,.1); }
      `}</style>
    </div>
  );
}

// 🟢 2. รับค่า coopPeriods เข้ามาใช้งาน
function CompanyForm({ form, setForm, onSubmit, coopPeriods }: any) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 1. ข้อมูลทั่วไป */}
      <div>
        <h4 style={{ margin: '0 0 10px 0', color: '#475569' }}>1. ข้อมูลทั่วไป</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={lbl}>ชื่อบริษัท (ไทย) <span style={{ color: 'red' }}>*</span></label><input required className="input" name="name" value={form.name || ""} onChange={handleChange} /></div>
          <div><label style={lbl}>ชื่อบริษัท (อังกฤษ)</label><input className="input" name="nameEn" value={form.nameEn || ""} onChange={handleChange} /></div>
        </div>
      </div>

      {/* 2. ที่อยู่สถานประกอบการ */}
      <div style={{ background: '#f8fafc', padding: 15, borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#475569' }}>2. ที่อยู่สถานประกอบการ</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <div><label style={lbl}>เลขที่ <span style={{ color: 'red' }}>*</span></label><input required className="input" name="addressNo" value={form.addressNo || ""} onChange={handleChange} /></div>
          <div><label style={lbl}>หมู่</label><input className="input" name="moo" value={form.moo || ""} onChange={handleChange} /></div>
          <div><label style={lbl}>ซอย</label><input className="input" name="soi" value={form.soi || ""} onChange={handleChange} /></div>
          <div><label style={lbl}>ถนน</label><input className="input" name="road" value={form.road || ""} onChange={handleChange} /></div>

          <div><label style={lbl}>ตำบล/แขวง <span style={{ color: 'red' }}>*</span></label><input required className="input" name="subDistrict" value={form.subDistrict || ""} onChange={handleChange} /></div>
          <div><label style={lbl}>อำเภอ/เขต <span style={{ color: 'red' }}>*</span></label><input required className="input" name="district" value={form.district || ""} onChange={handleChange} /></div>
          <div><label style={lbl}>จังหวัด <span style={{ color: 'red' }}>*</span></label><input required className="input" name="province" value={form.province || ""} onChange={handleChange} /></div>
          <div><label style={lbl}>รหัสไปรษณีย์ <span style={{ color: 'red' }}>*</span></label><input required className="input" name="zipcode" value={form.zipcode || ""} onChange={handleChange} /></div>
        </div>
      </div>

      {/* 3. ข้อมูลติดต่อ */}
      <div>
        <h4 style={{ margin: '0 0 10px 0', color: '#475569' }}>3. ข้อมูลการติดต่อ</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div><label style={lbl}>เบอร์โทรศัพท์ <span style={{ color: 'red' }}>*</span></label><input required className="input" name="phone" value={form.phone || ""} onChange={handleChange} /></div>
          <div><label style={lbl}>เบอร์โทรสาร (Fax)</label><input className="input" name="fax" value={form.fax || ""} onChange={handleChange} /></div>
          <div><label style={lbl}>อีเมล</label><input className="input" type="email" name="email" value={form.email || ""} onChange={handleChange} /></div>

          <div style={{ gridColumn: "1 / span 2" }}><label style={lbl}>เว็บไซต์</label><input className="input" name="website" value={form.website || ""} onChange={handleChange} /></div>

          {/* 🟢 3. เปลี่ยนจาก YEAR_OPTIONS เป็นการวนลูป coopPeriods */}
          <div><label style={lbl}>ปีแรกที่รับสหกิจ</label>
            <select className="input" name="pastYears" value={form.pastYears || ""} onChange={handleChange}>
              <option value="">-- เลือกเทอม/ปีการศึกษา --</option>
              {coopPeriods && coopPeriods.map((period: any) => (
                <option
                  key={period.id}
                  value={`เทอม ${period.semester}/${period.academicYear}`}
                >
                  เทอม {period.semester} / ปีการศึกษา {period.academicYear}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. บุคคลติดต่อ */}
      <div>
        <h4 style={{ margin: '0 0 10px 0', color: '#475569' }}>4. ผู้จัดการ / ผู้ประสานงาน</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={lbl}>ชื่อ-สกุล ผู้ติดต่อ</label><input className="input" name="contactPerson" value={form.contactPerson || ""} onChange={handleChange} /></div>
          <div><label style={lbl}>ตำแหน่งผู้ติดต่อ</label><input className="input" name="contactPosition" value={form.contactPosition || ""} onChange={handleChange} placeholder="เช่น HR, CEO" /></div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
        <button type="submit" className="btn" style={{ background: '#0284c7', padding: '12px 24px', fontSize: 15 }}>💾 บันทึกข้อมูลบริษัท</button>
      </div>
    </form>
  );
}

function MentorForm({ form, setForm, onSubmit }: any) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={lbl}>ชื่อ <span style={{ color: 'red' }}>*</span></label><input required className="input" name="firstName" value={form.firstName || ""} onChange={handleChange} /></div>
        <div><label style={lbl}>นามสกุล <span style={{ color: 'red' }}>*</span></label><input required className="input" name="lastName" value={form.lastName || ""} onChange={handleChange} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={lbl}>ตำแหน่ง <span style={{ color: 'red' }}>*</span></label><input required className="input" name="position" value={form.position || ""} onChange={handleChange} /></div>
        <div><label style={lbl}>แผนก <span style={{ color: 'red' }}>*</span></label><input required className="input" name="department" value={form.department || ""} onChange={handleChange} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={lbl}>อีเมล <span style={{ color: 'red' }}>*</span></label><input required type="email" className="input" name="email" value={form.email || ""} onChange={handleChange} /></div>
        <div><label style={lbl}>เบอร์โทร <span style={{ color: 'red' }}>*</span></label><input required className="input" name="phone" value={form.phone || ""} onChange={handleChange} /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button type="submit" className="btn" style={{ background: '#059669' }}>💾 บันทึกข้อมูลพี่เลี้ยง</button>
      </div>
    </form>
  );
}

const ghostBtn: React.CSSProperties = { background: "#fff", color: "#0074B7", boxShadow: "none", border: "1px solid rgba(10,132,255,.25)", height: 36, borderRadius: 8, padding: '0 16px', cursor: 'pointer' };
const td: React.CSSProperties = { padding: "14px 16px", fontSize: 14, color: '#334155', verticalAlign: 'middle' };
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', margin: "0 0 4px 0" };