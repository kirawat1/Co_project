import { useState, useEffect, useMemo } from "react";
import { IcEdit, IcSave, IcUser } from "./icons"; // ตรวจสอบ path icon

/* =========================
   Types
========================= */
interface Teacher {
  id: number;
  firstName: string;
  lastName: string;
  email: string; // อาจจะดึงมาจาก relation user.email
  phone: string;
  faculty: string;
  major: string; // CS, IT, GIS
  userId?: number;
}

/* =========================
   Helpers / Mappings
========================= */
const MAJOR_TH: Record<string, string> = {
  CS: "วิทยาการคอมพิวเตอร์",
  IT: "เทคโนโลยีสารสนเทศ",
  GIS: "ภูมิสารสนเทศศาสตร์",
};

const FACULTY_DEFAULT = "วิทยาลัยการคอมพิวเตอร์";

/* =========================
   Main Component: A_Teacher
========================= */
export default function A_Teacher() {
  const [items, setItems] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState("");
  const [filterMajor, setFilterMajor] = useState<string[]>([]);

  // Modal State
  const [modalData, setModalData] = useState<Teacher | null>(null);

  // --- Fetch Data (List) ---
  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("coop.token");
      // ⚠️ ต้องมี API ฝั่ง Backend: GET /api/teacher (List all teachers)
      const res = await fetch("http://localhost:5000/api/teacher", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Map ข้อมูลให้ตรงกับ Interface ถ้าจำเป็น
        const mapped = data.map((t: any) => ({
          ...t,
          email: t.user?.email || t.email || "", // ดึง email จาก user relation
          major: t.major || t.department // รองรับทั้งชื่อเก่า/ใหม่
        }));
        setItems(mapped);
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

  // --- Update Data (Admin Edit) ---
  const handleUpdate = async (updatedData: Teacher) => {
    try {
      const token = localStorage.getItem("coop.token");
      // ⚠️ ต้องมี API ฝั่ง Backend: PUT /api/teacher/:id
      const res = await fetch(`http://localhost:5000/api/teacher/${updatedData.id}`, {
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
        fetchData(); // โหลดข้อมูลใหม่
      } else {
        alert("บันทึกไม่สำเร็จ");
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาด");
    }
  };

  // --- Filter Logic ---
  const filtered = useMemo(() => {
    return items.filter((t) => {
      const text = `${t.firstName} ${t.lastName} ${t.email} ${t.phone}`.toLowerCase();
      const matchQ = text.includes(q.toLowerCase());
      const matchMajor = filterMajor.length === 0 || filterMajor.includes(t.major || "");

      return matchQ && matchMajor;
    });
  }, [items, q, filterMajor]);

  if (loading) return <div style={{ padding: 28, marginLeft: 35 }}>กำลังโหลดข้อมูลอาจารย์...</div>;

  return (
    <div style={{ padding: 28, marginLeft: 35 }}>

      {/* ================= Filters ================= */}
      <section style={card}>
        <h2 style={{ marginBottom: 16, marginTop: 0 }}>จัดการข้อมูลอาจารย์</h2>

        <div style={filterRow}>
          <input
            className="input"
            placeholder="ค้นหา: ชื่อ / อีเมล / เบอร์โทร"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 280, padding: '8px', borderRadius: 8, border: '1px solid #e5e7eb' }}
          />

          <FilterBox
            title="สาขาวิชา"
            items={MAJOR_TH}
            values={filterMajor}
            onChange={setFilterMajor}
          />

          <button className="btn" style={{ ...saveBtn, marginLeft: 'auto' }} onClick={() => { setQ(""); setFilterMajor([]); }}>
            ล้างตัวกรอง
          </button>
        </div>
      </section>

      {/* ================= Table ================= */}
      <section style={{ ...card, marginTop: 20, padding: 0, overflow: 'hidden' }}>
        <table width="100%" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {["ชื่อ-นามสกุล", "อีเมล", "เบอร์โทร", "คณะ", "สาขา", "จัดการ"].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                  ไม่พบข้อมูลอาจารย์
                </td>
              </tr>
            ) : filtered.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IcUser width={16} height={16} style={{ color: '#0074B7' }} />
                    </div>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{t.firstName} {t.lastName}</span>
                  </div>
                </td>
                <td style={td}>{t.email}</td>
                <td style={td}>{t.phone || "-"}</td>
                <td style={td}>{t.faculty || "-"}</td>
                <td style={td}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: 600,
                    background: t.major ? '#f0f9ff' : '#f1f5f9',
                    color: t.major ? '#0369a1' : '#64748b'
                  }}>
                    {MAJOR_TH[t.major] || t.major || "-"}
                  </span>
                </td>
                <td style={td}>
                  <button className="btn" style={ghostBtn} onClick={() => setModalData(t)}>
                    แก้ไข / ดูข้อมูล
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ================= Modal ================= */}
      {modalData && (
        <TeacherModal
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
function TeacherModal({ data, onClose, onSave }: { data: Teacher, onClose: () => void, onSave: (d: Teacher) => void }) {
  const [form, setForm] = useState<Teacher>(data);

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>แก้ไขข้อมูลอาจารย์</h2>
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
          <div>
            <label style={labelStyle}>อีเมล (System)</label>
            <input
              style={{ ...inputStyle, background: '#f1f5f9', color: '#94a3b8' }}
              value={form.email}
              disabled
            />
          </div>
          <div>
            <label style={labelStyle}>เบอร์โทร</label>
            <input
              style={inputStyle}
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>คณะ</label>
            <input
              style={inputStyle}
              value={form.faculty || ""}
              placeholder={FACULTY_DEFAULT}
              onChange={e => setForm({ ...form, faculty: e.target.value })}
            />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>สาขาวิชา</label>
            <select
              style={inputStyle}
              value={form.major || ""}
              onChange={e => setForm({ ...form, major: e.target.value })}
            >
              <option value="">-- เลือกสาขาวิชา --</option>
              {Object.entries(MAJOR_TH).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
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
   UI Styles & Helpers
========================= */
const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e5e7eb" };
const filterRow: React.CSSProperties = { display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" };
const th: React.CSSProperties = { textAlign: "left", fontSize: 14, fontWeight: 700, padding: "12px 16px", color: '#475569' };
const td: React.CSSProperties = { padding: "14px 16px", fontSize: 14, color: '#334155', verticalAlign: 'middle' };

const ghostBtn: React.CSSProperties = { background: "#fff", color: "#0074B7", boxShadow: "none", border: "1px solid rgba(10,132,255,.25)", height: 36, borderRadius: 8, padding: '0 16px', cursor: 'pointer' };
const saveBtn: React.CSSProperties = { background: "#0074B7", color: "#fff", border: "none", height: 38, borderRadius: 8, padding: '0 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14 };

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: 'blur(4px)' };
const modal: React.CSSProperties = { background: "#fff", borderRadius: 20, padding: 32, width: 600, maxWidth: "95%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" };
const modalFooter: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 32 };

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' };

function FilterBox({ title, items, values, onChange }: { title: string; items: Record<string, string>; values: string[]; onChange: (v: string[]) => void; }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "#475569", marginBottom: 6, fontWeight: 600 }}>{title}</div>
      <div style={{ display: 'flex', gap: 12 }}>
        {Object.entries(items).map(([k, v]) => (
          <label key={k} style={{ fontSize: 13, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center', color: '#334155' }}>
            <input
              type="checkbox"
              checked={values.includes(k)}
              onChange={(e) => onChange(e.target.checked ? [...values, k] : values.filter((x) => x !== k))}
              style={{ accentColor: '#0074B7' }}
            /> {v}
          </label>
        ))}
      </div>
    </div>
  );
}