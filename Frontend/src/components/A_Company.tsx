/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/A_Companies.tsx
import React, { useMemo, useState } from "react";

/* ----------------------------------------------------
   Types + LocalStorage
---------------------------------------------------- */
export interface AdminCompanyRecord {
  id: string;
  name: string;
  address: string;
  contactEmail: string;
  pastCoopYears: string; // เช่น "2568,2567,2566"
}

const K_COMPANIES = "coop.admin.companies";

function loadCompanies(): AdminCompanyRecord[] {
  try {
    return JSON.parse(localStorage.getItem(K_COMPANIES) || "[]");
  } catch {
    return [];
  }
}
function saveCompanies(list: AdminCompanyRecord[]) {
  localStorage.setItem(K_COMPANIES, JSON.stringify(list));
}
function genId() {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ปีที่ให้เลือก
const YEAR_OPTIONS = ["2568", "2567", "2566", "2565", "2564"];

type FormState = Omit<AdminCompanyRecord, "id"> & { id?: string };

/* ----------------------------------------------------
   Main Component
---------------------------------------------------- */
export default function A_Companies() {
  const [items, setItems] = useState<AdminCompanyRecord[]>(loadCompanies());
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [form, setForm] = useState<FormState>({
    name: "",
    address: "",
    contactEmail: "",
    pastCoopYears: "",
  });

  /* ค้นหา */
  const filtered = useMemo(() => {
    return items.filter((c) => {
      const s = `${c.name} ${c.address} ${c.contactEmail} ${c.pastCoopYears}`.toLowerCase();
      return s.includes(q.toLowerCase());
    });
  }, [items, q]);

  /* สร้างบริษัทใหม่ หรือเพิ่มปีให้บริษัทเดิม */
  function saveAdd(e: React.FormEvent) {
    e.preventDefault();

    const name = form.name.trim();
    const year = form.pastCoopYears.trim();

    if (!name) return alert("กรุณากรอกชื่อบริษัท");

    // ตรวจว่าบริษัทนี้มีอยู่แล้วหรือยัง
    const existed = items.find((x) => x.name === name);

    if (existed) {
      // แยกปีเดิมเป็น array
      const currentYears = existed.pastCoopYears
        ? existed.pastCoopYears.split(",")
        : [];

      // ถ้าปีใหม่ยังไม่มี → เพิ่มเข้าไป
      if (!currentYears.includes(year)) {
        const updated = [year, ...currentYears].join(",");
        existed.pastCoopYears = updated;
      }

      saveCompanies(items);
      setItems([...items]);
      setShowAdd(false);
      return;
    }

    // ถ้าเป็นบริษัทใหม่ → เพิ่มใหม่
    const newItem: AdminCompanyRecord = {
      id: genId(),
      name,
      address: form.address.trim(),
      contactEmail: form.contactEmail.trim(),
      pastCoopYears: year,
    };

    const next = [...items, newItem];
    saveCompanies(next);
    setItems(next);
    setShowAdd(false);
  }

  /* แก้ไขบริษัท */
  function saveEdit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.id) return;

    const next = items.map((x) =>
      x.id === form.id
        ? {
            ...x,
            name: form.name.trim(),
            address: form.address.trim(),
            contactEmail: form.contactEmail.trim(),
            pastCoopYears: form.pastCoopYears.trim(),
          }
        : x
    );

    saveCompanies(next);
    setItems(next);
    setShowEdit(false);
  }

  function remove(id: string) {
    if (!confirm("ลบบริษัทนี้หรือไม่?")) return;
    const next = items.filter((x) => x.id !== id);
    saveCompanies(next);
    setItems(next);
  }

  function openAdd() {
    setForm({
      name: "",
      address: "",
      contactEmail: "",
      pastCoopYears: "",
    });
    setShowAdd(true);
  }

  function openEdit(c: AdminCompanyRecord) {
    setForm({ ...c });
    setShowEdit(true);
  }

  function closeAll() {
    setShowAdd(false);
    setShowEdit(false);
  }

  /* ----------------------------------------------------
     UI
  ---------------------------------------------------- */
  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>ข้อมูลบริษัทสหกิจศึกษา</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
              รายชื่อบริษัทที่เคยรับนักศึกษาสหกิจศึกษา
            </p>
          </div>

          <button className="btn" onClick={openAdd}>
            + เพิ่มบริษัท
          </button>
        </div>

        {/* Search */}
        <div style={{ display: "flex", marginTop: 16, gap: 10 }}>
          <input
            className="input"
            placeholder="ค้นหา: ชื่อ / ที่อยู่ / อีเมล / ปี"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 280 }}
          />
          <button className="btn-secondary" type="button" onClick={() => setQ("")}>
            ล้างคำค้น
          </button>
        </div>
      </section>

      {/* Table */}
      <section className="card" style={{ padding: 24 }}>
        <table className="tbl" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>ชื่อบริษัท</th>
              <th>ที่อยู่</th>
              <th>อีเมลติดต่อ</th>
              <th>ปีที่รับ นศ.</th>
              <th style={{ width: 120, textAlign: "right" }}>การทำงาน</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 16, color: "#6b7280" }}>
                  — ไม่มีข้อมูล —
                </td>
              </tr>
            )}

            {filtered.map((c, idx) => (
              <tr key={c.id} className={idx % 2 ? "row-odd" : "row-even"}>
                <td>{c.name}</td>
                <td>{c.address}</td>
                <td>{c.contactEmail}</td>
                <td>{c.pastCoopYears}</td>

                <td style={{ textAlign: "right" }}>
                  <button className="btn-secondary small" onClick={() => openEdit(c)}>
                    แก้ไข
                  </button>
                  <button className="btn-danger small" onClick={() => remove(c.id)}>
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ---------- Modals ---------- */}
      {showAdd && (
        <Modal title="เพิ่มบริษัทใหม่" onClose={closeAll}>
          <CompanyForm
            form={form}
            setForm={setForm}
            onSubmit={saveAdd}
            submitText="เพิ่มบริษัท"
          />
        </Modal>
      )}

      {showEdit && (
        <Modal title="แก้ไขข้อมูลบริษัท" onClose={closeAll}>
          <CompanyForm
            form={form}
            setForm={setForm}
            onSubmit={saveEdit}
            submitText="บันทึกการแก้ไข"
          />
        </Modal>
      )}

      <style>{`
        .row-even { background:#ffffff; }
        .row-odd { background:#f7faff; }

        .tbl th {
          text-align:left;
          font-size:13px;
          color:#6b7280;
          padding-bottom:6px;
        }
        .tbl td {
          padding:10px 6px;
          font-size:14px;
        }

        .btn-secondary {
          border-radius:999px;
          border:1px solid #d0d7e2;
          padding:6px 12px;
          background:#fff;
          cursor:pointer;
          font-size:13px;
        }
        .btn-secondary.small { padding:4px 10px; font-size:12px; }

        .btn-danger {
          border-radius:999px;
          padding:6px 12px;
          border:1px solid #fecaca;
          background:#fee2e2;
          color:#b91c1c;
          font-size:12px;
          margin-left:6px;
        }
      `}</style>
    </div>
  );
}

/* ----------------------------------------------------
   Modal Component
---------------------------------------------------- */
function Modal({ title, onClose, children }: any) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn-secondary small" onClick={onClose}>
            ปิด
          </button>
        </div>

        <div style={{ marginTop: 16 }}>{children}</div>
      </div>

      <style>{`
        .modal-backdrop {
          position:fixed;
          inset:0;
          background:rgba(15,23,42,.35);
          display:flex;
          align-items:center;
          justify-content:center;
          z-index:100;
        }
        .modal-card {
          background:white;
          width:min(600px, 92vw);
          border-radius:16px;
          padding:20px;
          box-shadow:0 18px 45px rgba(0,0,0,.25);
        }
      `}</style>
    </div>
  );
}

/* ----------------------------------------------------
   Company Form (Select ปี + UI แบบ iOS)
---------------------------------------------------- */
function CompanyForm({ form, setForm, onSubmit, submitText }: any) {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
      }}
    >
      {/* ชื่อบริษัท */}
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="label" style={{marginLeft: 10,}}>ชื่อบริษัท</label>
        <input
          className="input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          style={{ width: "95%"}}
        />
      </div>

      {/* ที่อยู่ */}
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="label" style={{marginLeft: 10,}}>ที่อยู่</label>
        <textarea
          className="input"
          rows={3}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          required
          style={{ width: "95%"}}
        />
      </div>

      {/* อีเมล */}
      <div>
        <label className="label" style={{marginLeft: 10,}}>อีเมลติดต่อ</label>
        <input
          className="input"
          type="email"
          value={form.contactEmail}
          onChange={(e) =>
            setForm({ ...form, contactEmail: e.target.value })
          }
          required
          style={{ width: "95%", }}
        />
      </div>

      {/* ปีที่รับ นศ. */}
      <div>
        <label className="label" style={{marginLeft: 40,}}>ปีที่รับนักศึกษา</label>
        <select
          className="input"
          value={form.pastCoopYears}
          onChange={(e) =>
            setForm({ ...form, pastCoopYears: e.target.value })
          }
          required
          style={{ width: "90%", marginLeft: 30,}}
        >
          <option value="">-- เลือกปี --</option>
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* ปุ่มบันทึก */}
      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 8,
        }}
      >
        <button className="btn" type="submit">
          {submitText}
        </button>
      </div>
    </form>
  );
}
