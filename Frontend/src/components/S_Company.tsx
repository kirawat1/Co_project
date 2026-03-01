/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Frontend/src/components/S_Company.tsx
import React, { useEffect, useState, useMemo } from "react";


interface MentorRecord {
    id: string;
    firstName: string;
    lastName: string;
    department: string;
    position: string;
    email: string;
    phone?: string;
}

interface CompanyRecord {
    id: string;
    name: string;
    address: string;
    email: string;
    phone: string;
    website?: string;
    pastYears: string;
    contactPosition?: string;
    contactPerson?: string;
    createdById: number;
    mentors: MentorRecord[];
}

const YEAR_OPTIONS = ["2568", "2567", "2566", "2565", "2564"];


export default function Company({ profile }: { profile: any }) {
    const userId = profile?.userId || profile?.id || Number(localStorage.getItem("coop.userId") || 0);
    console.log("DEBUG ID:", {
        Profile_ID: profile?.id,
        Storage_ID: localStorage.getItem("coop.userId"),
        Final_UserID: userId
    });

    const token = localStorage.getItem("coop.token");

    const [items, setItems] = useState<CompanyRecord[]>([]);
    const [q, setQ] = useState("");

    const [showAdd, setShowAdd] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [viewCompany, setViewCompany] = useState<CompanyRecord | null>(null);

    const [showAddMentor, setShowAddMentor] = useState(false);
    const [editingMentor, setEditingMentor] = useState<MentorRecord | null>(null);

    const [form, setForm] = useState<any>(emptyCompany());
    const [mentorForm, setMentorForm] = useState<any>(emptyMentor());

    useEffect(() => {
        if (!token) return;
        fetch("http://localhost:5000/api/companies", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(res => res.json())
            .then(data => setItems(data))
            .catch(err => console.error(err));
    }, []);

    useEffect(() => {
        console.log(items.map(c => ({ name: c.name, createdById: c.createdById })));
    }, [items]);



    const filtered = useMemo(() => {
        return items.filter(c =>
            `${c.name} ${c.address} ${c.email} ${c.pastYears}`.toLowerCase().includes(q.toLowerCase())
        );
    }, [items, q]);

    /* ---------------- Company ---------------- */
    async function saveAdd(e: React.FormEvent) {
        e.preventDefault();
        if (!token) return alert("กรุณาเข้าสู่ระบบ");

        try {
            const res = await fetch("http://localhost:5000/api/companies", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ...form, createdBy: userId }),
            });
            const data = await res.json();
            if (!data.ok) return alert("บันทึกบริษัทไม่สำเร็จ");

            setItems(prev => [...prev, data.company]);
            setShowAdd(false);
            setForm(emptyCompany());
        } catch (err) { console.error(err); alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
    }

    async function saveEdit(e: React.FormEvent) {
        e.preventDefault();
        if (!token || !form.id) return alert("กรุณาเข้าสู่ระบบ");

        try {
            const res = await fetch(`http://localhost:5000/api/companies/${form.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            console.log("data", data);
            if (!data.ok) return alert("แก้ไขข้อมูลบริษัทสำเร็จ");

            setItems(prev => prev.map(c => c.id === form.id ? data.company : c));
            setShowEdit(false);
        } catch (err) { console.error(err); alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
    }

    async function removeCompany(id: string) {
        if (!confirm("ลบบริษัทนี้หรือไม่?")) return;
        const c = items.find(c => c.id === id);
        if (!c) return;
        console.log("userId", userId, "createdById", c.createdById);
        if (String(c.createdById) !== String(userId)) {
            return alert("ลบได้เฉพาะบริษัทที่ตัวเองเพิ่ม");
        }
        if (!token) return alert("กรุณาเข้าสู่ระบบ");

        try {
            const res = await fetch(`http://localhost:5000/api/companies/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!data.ok) return alert(data.message);

            setItems(prev => prev.filter(c => c.id !== id));
            if (viewCompany?.id === id) setViewCompany(null);
        } catch (err) { console.error(err); alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
    }

    /* ---------------- Mentor ---------------- */
    async function saveMentor(e: React.FormEvent) {
        e.preventDefault();
        if (!viewCompany) return;

        const { firstName, lastName, department, position, email, phone } = mentorForm;
        if (!firstName || !lastName || !department || !position || !email || !phone) return alert("กรุณากรอกให้ครบ");
        if (!/^\S+@\S+\.\S+$/.test(email)) return alert("รูปแบบอีเมลไม่ถูกต้อง");
        if (!/^\d{9,10}$/.test(phone)) return alert("เบอร์โทร 9–10 หลัก");

        if (!token) return alert("กรุณาเข้าสู่ระบบ");

        try {
            if (!editingMentor) {
                const res = await fetch(`http://localhost:5000/api/companies/${viewCompany.id}/mentors`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify(mentorForm)
                });
                const data = await res.json();
                if (!data.ok) return alert("เพิ่มพี่เลี้ยงไม่สำเร็จ");

                setViewCompany(prev => prev ? { ...prev, mentors: [...prev.mentors, data.mentor] } : prev);
                setItems(prev => prev.map(c => c.id === viewCompany?.id ? { ...c, mentors: [...c.mentors, data.mentor] } : c));
            } else {
                const res = await fetch(`http://localhost:5000/api/companies/mentors/${editingMentor.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify(mentorForm)
                });
                const data = await res.json();
                if (!data.ok) return alert("แก้ไขพี่เลี้ยงไม่สำเร็จ");

                setViewCompany(prev => prev ? { ...prev, mentors: prev.mentors.map(m => m.id === editingMentor.id ? data.mentor : m) } : prev);
                setItems(prev => prev.map(c => c.id === viewCompany?.id ? { ...c, mentors: c.mentors.map(m => m.id === editingMentor.id ? data.mentor : m) } : c));
            }

            setEditingMentor(null);
            setMentorForm(emptyMentor());
            setShowAddMentor(false);
        } catch (err) { console.error(err); alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
    }

    async function removeMentor(mentorId: string) {
        if (!confirm("ลบพี่เลี้ยงคนนี้หรือไม่?")) return;
        if (!token) return alert("กรุณาเข้าสู่ระบบ");

        try {
            const res = await fetch(`http://localhost:5000/api/companies/mentors/${mentorId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (!data.ok) return alert(data.message);

            setViewCompany(prev => prev ? { ...prev, mentors: prev.mentors.filter(m => m.id !== mentorId) } : prev);
            setItems(prev => prev.map(c => c.id === viewCompany?.id ? { ...c, mentors: c.mentors.filter(m => m.id !== mentorId) } : c));
        } catch (err) { console.error(err); alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
    }

    /* ---------------- UI ---------------- */
    return (
        <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
            <section className="card" style={{ padding: 24, marginBottom: 28 }}>
                <h2 style={{ margin: 0 }}>บริษัทสหกิจศึกษา</h2>
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <input className="input" placeholder="ค้นหา" value={q} onChange={e => setQ(e.target.value)} style={{ width: 280 }} />
                    <button className="btn" onClick={() => { setForm(emptyCompany()); setShowAdd(true); }}>+ เพิ่มบริษัท</button>
                </div>
            </section>

            <section className="card" style={{ padding: 24 }}>
                <table className="tbl" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr><th>ชื่อบริษัท</th><th>อีเมล</th><th>ปีที่รับ</th><th style={{ textAlign: "right" }}>การทำงาน</th></tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ?
                            <tr><td colSpan={4} style={{ textAlign: "center", padding: 16, color: "#6b7280" }}>— ไม่มีข้อมูล —</td></tr>
                            : filtered.map((c, idx) =>
                                <tr key={c.id} className={idx % 2 ? "row-odd" : "row-even"}>
                                    <td>{c.name}</td><td>{c.email}</td><td>{c.pastYears}</td>
                                    <td style={{ textAlign: "right" }}>
                                        <button className="btn-secondary small" onClick={() => setViewCompany(c)}>
                                            ดูรายละเอียด
                                        </button>
                                        <button className="btn-secondary small" onClick={() => { setForm(c); setShowEdit(true); }} style={{ marginLeft: 6 }}>
                                            แก้ไข
                                        </button>
                                        <button className="btn-danger small" onClick={() => removeCompany(c.id)} style={{ marginLeft: 6 }}>
                                            ลบ
                                        </button>
                                    </td>
                                </tr>
                            )}
                    </tbody>
                </table>
            </section>

            {showAdd && <Modal title="เพิ่มบริษัท" onClose={() => setShowAdd(false)}>
                <CompanyForm form={form} setForm={setForm} onSubmit={saveAdd} />
            </Modal>}
            {showEdit && <Modal title="แก้ไขบริษัท" onClose={() => setShowEdit(false)}>
                <CompanyForm form={form} setForm={setForm} onSubmit={saveEdit} />
            </Modal>}
            {viewCompany && <Modal title="รายละเอียดบริษัท" onClose={() => setViewCompany(null)}>
                <p><b>ชื่อ:</b> {viewCompany.name}</p>
                <p><b>ที่อยู่:</b> {viewCompany.address}</p>
                <p><b>อีเมล:</b> {viewCompany.email}</p>
                <p><b>โทร:</b> {viewCompany.phone}</p>
                <p><b>เว็บไซต์:</b> {viewCompany.website || "-"}</p>
                <p><b>ตำแหน่ง:</b> {viewCompany.contactPosition}</p>
                <p><b>ผู้ติดต่อ:</b> {viewCompany.contactPerson}</p>
                <hr style={{ margin: "16px 0" }} />
                <h4>พี่เลี้ยง</h4>
                {viewCompany.mentors.length === 0 ? <p style={{ color: "#6b7280" }}>ยังไม่มีพี่เลี้ยง</p> :
                    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, marginBottom: 16 }}>
                        <thead>
                            <tr>
                                <th style={{ padding: 6 }}>ชื่อ</th>
                                <th style={{ padding: 6 }}>นามสกุล</th>
                                <th style={{ padding: 6 }}>ตำแหน่ง</th>
                                <th style={{ padding: 6 }}>แผนก</th>
                                <th style={{ padding: 6 }}>อีเมล</th>
                                <th style={{ padding: 6 }}>โทร</th>
                                <th style={{ padding: 6, textAlign: "center" }}>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {viewCompany.mentors.map(m =>
                                <tr key={m.id}>
                                    <td style={{ padding: 6 }}>{m.firstName}</td>
                                    <td style={{ padding: 6 }}>{m.lastName}</td>
                                    <td style={{ padding: 6 }}>{m.position}</td>
                                    <td style={{ padding: 6 }}>{m.department}</td>
                                    <td style={{ padding: 6 }}>{m.email}</td>
                                    <td style={{ padding: 6 }}>{m.phone}</td>
                                    <td style={{ textAlign: "center", padding: 6 }}>
                                        <button className="btn-secondary small" onClick={() => { setEditingMentor(m); setMentorForm(m); setShowAddMentor(true) }}>แก้ไข</button>
                                        <button className="btn-danger small" onClick={() => removeMentor(m.id)}>ลบ</button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                }
                <div style={{ display: "flex", justifyContent: "right", marginTop: 12 }}>
                    <button className="btn" onClick={() => setShowAddMentor(true)}>+ เพิ่มพี่เลี้ยง</button>
                </div>
            </Modal>}

            {showAddMentor && <Modal title={editingMentor ? "แก้ไขพี่เลี้ยง" : "เพิ่มพี่เลี้ยง"} onClose={() => { setShowAddMentor(false); setEditingMentor(null) }}>
                <MentorForm form={mentorForm} setForm={setMentorForm} onSubmit={saveMentor} />
            </Modal>}

            <style>{`
        .row-even { background:#ffffff; }
        .row-odd { background:#f7faff; }
        .tbl th { text-align:left; font-size:13px; color:#6b7280; padding-bottom:6px; }
        .tbl td { padding:10px 6px; font-size:14px; }
        .btn-secondary { border-radius:999px; border:1px solid #d0d7e2; padding:6px 12px; background:#fff; cursor:pointer; font-size:13px; }
        .btn-secondary.small { padding:4px 10px; font-size:12px; }
        .btn-danger { border-radius:999px; padding:6px 12px; border:1px solid #fecaca; background:#fee2e2; color:#b91c1c; font-size:12px; margin-left:6px; }
      `}</style>
        </div>
    );
}

function emptyCompany() { return { name: "", address: "", email: "", phone: "", website: "", pastYears: "", createdBy: "", mentors: [], contactPerson: "", contactPosition: "" } }
function emptyMentor() { return { firstName: "", lastName: "", department: "", position: "", email: "", phone: "" } }

function Modal({ title, onClose, children }: any) {
    return (
        <div className="modal-backdrop">
            <div className="modal-card">
                <div style={{ display: "flex", justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>{title}</h3><button className="btn-secondary small" onClick={onClose}>ปิด</button></div>
                <div style={{ marginTop: 16 }}>{children}</div>
            </div>
            <style>{`
      .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.35); display:flex; align-items:center; justify-content:center; z-index:100; }
      .modal-card { background:white; width:min(1000px,92vw); border-radius:16px; padding:20px; padding-right:45px; box-shadow:0 18px 45px rgba(0,0,0,.25); }
    `}</style>
        </div>
    )
}

function CompanyForm({ form, setForm, onSubmit }: any) {
    return (
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <input className="input" placeholder="ชื่อบริษัท" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <textarea className="input" placeholder="ที่อยู่" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            <input className="input" type="email" placeholder="อีเมล" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input className="input" placeholder="เบอร์โทร" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <input className="input" placeholder="เว็บไซต์" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
            <input className="input" placeholder="ชื่อผู้ติดต่อ" value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} />
            <input className="input" placeholder="ตำแหน่งผู้ติดต่อ (CEO,HR,กรรมการผู้จัดการ)" value={form.contactPosition} onChange={e => setForm({ ...form, contactPosition: e.target.value })} />
            <select className="input" value={form.pastYears} onChange={e => setForm({ ...form, pastYears: e.target.value })}>
                <option value="">-- เลือกปี --</option>
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button className="btn">บันทึก</button>
        </form>
    )
}

function MentorForm({ form, setForm, onSubmit }: any) {
    return (
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
            <input className="input" placeholder="ชื่อ" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
            <input className="input" placeholder="นามสกุล" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
            <input className="input" placeholder="แผนก" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
            <input className="input" placeholder="ตำแหน่ง" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
            <input className="input" type="email" placeholder="อีเมล" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input className="input" placeholder="โทร" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <button className="btn">บันทึก</button>
        </form>
    )
}
