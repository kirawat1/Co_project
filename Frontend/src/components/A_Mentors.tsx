import { useState, useEffect, useMemo } from "react";
import { IcSave, IcUser } from "./icons"; // อย่าลืมเช็ค path icons

/* =========================
   Types
========================= */
interface Mentor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  companyId: string;
  companyName?: string; // Map เพิ่มจาก Company
}

interface Company {
  id: string;
  name: string;
  mentors: Mentor[];
}

/* =========================
   Main Component: A_Mentors
========================= */
export default function A_Mentors() {
  const [items, setItems] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState("");

  // Modal State
  const [modalData, setModalData] = useState<Mentor | null>(null);

  // --- Fetch Data ---
  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("coop.token");

      const res = await fetch("http://localhost:5000/api/companies", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const companies: Company[] = await res.json();

        // Flatten Data: ดึง Mentors ออกมาจากบริษัท
        const allMentors: Mentor[] = companies.flatMap((c) =>
          c.mentors.map((m) => ({
            ...m,
            companyName: c.name,
          }))
        );

        setItems(allMentors);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Update Data (Save) ---
  const handleUpdate = async (updatedData: Mentor) => {
    try {
      const token = localStorage.getItem("coop.token");
      // ใช้ API update mentor (ต้องมี route นี้ที่ backend)
      const res = await fetch(`http://localhost:5000/api/companies/mentors/${updatedData.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updatedData),
      });

      if (res.ok) {
        alert("บันทึกข้อมูลเรียบร้อย");
        setModalData(null);
        fetchData();
      } else {
        const d = await res.json();
        alert("บันทึกไม่สำเร็จ: " + d.message);
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    }
  };

  // --- Delete Data ---
  const handleDelete = async (id: string) => {
    if (!confirm("ต้องการลบพี่เลี้ยงคนนี้ใช่หรือไม่?")) return;
    try {
      const token = localStorage.getItem("coop.token");
      const res = await fetch(`http://localhost:5000/api/companies/mentors/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        alert("ลบข้อมูลสำเร็จ");
        setItems(prev => prev.filter(m => m.id !== id));
      } else {
        alert("ลบไม่สำเร็จ");
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาด");
    }
  };

  // --- Filter Logic ---
  const filtered = useMemo(() => {
    return items.filter((m) => {
      const text = `${m.firstName} ${m.lastName} ${m.email} ${m.companyName} ${m.department} ${m.position}`.toLowerCase();
      return text.includes(q.toLowerCase());
    });
  }, [items, q]);

  if (loading) return <div style={{ padding: 28, marginLeft: 35 }}>กำลังโหลดข้อมูลพี่เลี้ยง...</div>;

  return (
    <div style={{ padding: 28, marginLeft: 35 }}>

      {/* ================= Filters ================= */}
      <section style={card}>
        <h2 style={{ marginBottom: 16, marginTop: 0 }}>จัดการข้อมูลพี่เลี้ยง</h2>

        <div style={filterRow}>
          <input
            className="input"
            placeholder="ค้นหา: ชื่อ / อีเมล / บริษัท / แผนก"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 320, padding: '8px', borderRadius: 8, border: '1px solid #e5e7eb' }}
          />

          {/* <button className="btn" style={{ ...saveBtn, marginLeft: 'auto', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }} onClick={() => setQ("")}>
            ล้างคำค้นหา
          </button> */}
        </div>
      </section>

      {/* ================= Table ================= */}
      <section style={{ ...card, marginTop: 20, padding: 0, overflow: 'hidden' }}>
        <table width="100%" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {["ชื่อ-นามสกุล", "อีเมล", "บริษัท", "แผนก/ตำแหน่ง", "เบอร์โทร", "จัดการ"].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                  ไม่พบข้อมูลพี่เลี้ยง
                </td>
              </tr>
            ) : filtered.map((m) => (
              <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {/* เปลี่ยนสีไอคอนให้ต่างจาก Teacher นิดหน่อย (สีเขียว) */}
                      <IcUser width={16} height={16} style={{ color: '#16a34a' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{m.firstName} {m.lastName}</div>
                    </div>
                  </div>
                </td>
                <td style={td}>{m.email}</td>
                <td style={td}>
                  <span style={{ fontWeight: 600, color: '#0074B7' }}>{m.companyName}</span>
                </td>
                <td style={td}>
                  <div style={{ fontSize: 13 }}>{m.department || "-"}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{m.position}</div>
                </td>
                <td style={td}>{m.phone || "-"}</td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" style={ghostBtn} onClick={() => setModalData(m)}>
                      แก้ไข
                    </button>
                    <button className="btn" style={{ ...ghostBtn, color: '#ef4444', borderColor: '#fecaca', background: '#fef2f2' }} onClick={() => handleDelete(m.id)}>
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ================= Modal ================= */}
      {modalData && (
        <MentorModal
          data={modalData}
          onClose={() => setModalData(null)}
          onSave={handleUpdate}
        />
      )}

    </div>
  );
}

/* =========================
   Modal Component
========================= */
function MentorModal({ data, onClose, onSave }: { data: Mentor, onClose: () => void, onSave: (d: Mentor) => void }) {
  const [form, setForm] = useState<Mentor>(data);

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>แก้ไขข้อมูลพี่เลี้ยง</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>ชื่อ</label>
            <input
              style={inputStyle}
              value={form.firstName}
              onChange={e => setForm({ ...form, firstName: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>นามสกุล</label>
            <input
              style={inputStyle}
              value={form.lastName}
              onChange={e => setForm({ ...form, lastName: e.target.value })}
            />
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>อีเมล</label>
            <input
              style={inputStyle}
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label style={labelStyle}>เบอร์โทร</label>
            <input
              style={inputStyle}
              value={form.phone || ""}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>บริษัท</label>
            <input
              style={{ ...inputStyle, background: '#f8fafc', color: '#64748b' }}
              value={form.companyName || ""}
              disabled
            />
          </div>

          <div>
            <label style={labelStyle}>แผนก (Department)</label>
            <input
              style={inputStyle}
              value={form.department || ""}
              onChange={e => setForm({ ...form, department: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>ตำแหน่ง (Position)</label>
            <input
              style={inputStyle}
              value={form.position || ""}
              onChange={e => setForm({ ...form, position: e.target.value })}
            />
          </div>
        </div>

        <div style={modalFooter}>
          <button style={ghostBtn} onClick={onClose}>ยกเลิก</button>
          <button style={saveBtn} onClick={() => onSave(form)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IcSave width={16} height={16} /> บันทึกข้อมูล
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   UI Styles (เหมือน A_Teacher)
========================= */
const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e5e7eb" };
const filterRow: React.CSSProperties = { display: "flex", gap: 12, alignItems: "center" };
const th: React.CSSProperties = { textAlign: "left", fontSize: 14, fontWeight: 700, padding: "12px 16px", color: '#475569' };
const td: React.CSSProperties = { padding: "14px 16px", fontSize: 14, color: '#334155', verticalAlign: 'middle' };

const ghostBtn: React.CSSProperties = { background: "#fff", color: "#0074B7", boxShadow: "none", border: "1px solid rgba(10,132,255,.25)", height: 36, borderRadius: 8, padding: '0 16px', cursor: 'pointer' };
const saveBtn: React.CSSProperties = { background: "#0074B7", color: "#fff", border: "none", height: 38, borderRadius: 8, padding: '0 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14 };

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: 'blur(4px)' };
const modal: React.CSSProperties = { background: "#fff", borderRadius: 20, padding: 32, width: 600, maxWidth: "95%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" };
const modalFooter: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 32 };

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' };