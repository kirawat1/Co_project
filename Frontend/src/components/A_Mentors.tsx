import { useMemo, useState } from "react";
import { loadMentors, saveMentors } from "./store";

type MentorProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
  department?: string;
  companyName?: string;
};

export default function A_Mentors() {
  const [items, setItems] = useState<MentorProfile[]>(() => loadMentors());
  const [q, setQ] = useState("");
  const [activeEmail, setActiveEmail] = useState<string>("");

  const filtered = useMemo(
    () =>
      items.filter((m) => {
        const key = `${m.firstName} ${m.lastName} ${m.email} ${m.companyName} ${m.department}`.toLowerCase();
        return key.includes(q.toLowerCase());
      }),
    [items, q]
  );

  const selected = items.find((m) => m.email === activeEmail) || null;

  function remove(email: string) {
    if (!confirm("ลบพี่เลี้ยงคนนี้?")) return;
    const next = items.filter((m) => m.email !== email);
    setItems(next);
    saveMentors(next);
    if (activeEmail === email) setActiveEmail("");
  }

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      {/* Header + Toolbar */}
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>ข้อมูลพี่เลี้ยง</h2>
        <div
          className="tools"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginLeft: 18,
            marginTop: 8,
          }}
        >
          <input
            className="input"
            placeholder="ค้นหา: ชื่อ/อีเมล/บริษัท"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: "0 1 420px", minWidth: 260 }}
          />
        </div>
      </section>

      <div className="cols" style={{ display: "grid", gridTemplateColumns: ".7fr .9fr", gap: 10 }}>
        {/* ตารางรายชื่อ */}
        <section className="card" style={{ padding: 24, overflowX: "auto" }}>
          <table className="doc-table" style={{ width: "100%" }}>
            <colgroup>
              <col className="col-name" />
              <col className="col-email" />
              <col className="col-company" />
              <col className="col-dept" />
              <col className="col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th align="left">ชื่อ-นามสกุล</th>
                <th align="left">อีเมล</th>
                <th align="left">บริษัท</th>
                <th align="left">แผนก</th>
                <th style={{ textAlign: "right" }}>การทำงาน</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const full = `${m.firstName} ${m.lastName}`.trim();
                const isActive = m.email === activeEmail;
                return (
                  <tr key={m.email}>
                    <td>{full || "-"}</td>
                    <td className="col-email">
                      <span className="email" title={m.email}>
                        {m.email || "-"}
                      </span>
                    </td>
                    <td className="col-company">
                      <span className="company" title={m.companyName}>
                        {m.companyName || "-"}
                      </span>
                    </td>
                    <td>{m.department || "-"}</td>
                    <td className="cell-actions">
                      {!isActive && (
                        <button className="btn small" onClick={() => setActiveEmail(m.email)}>
                          รายละเอียด
                        </button>
                      )}
                      <button className="btn ghost small" onClick={() => remove(m.email)}>
                        ลบ
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: "#6b7280" }}>
                    — ไม่มีข้อมูล —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* รายละเอียด */}
        <section
          className="card"
          aria-live="polite"
          style={{ padding: 24, marginBottom: 28, position: "relative" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>รายละเอียด</h3>
            {selected && (
              <button
                className="icon-btn"
                aria-label="ปิดรายละเอียด"
                onClick={() => setActiveEmail("")}
                type="button"
              >
                ✕
              </button>
            )}
          </div>
          {selected ? (
            <div style={{ display: "grid", gridTemplateColumns: ".5fr .5fr", gap: 8 }}>
              <Field label="ชื่อ" value={selected.firstName} />
              <Field label="นามสกุล" value={selected.lastName} />
              <Field label="อีเมล" value={selected.email} />
              <Field label="เบอร์โทร" value={selected.phone} />
              <Field label="ตำแหน่ง" value={selected.title} />
              <Field label="แผนก" value={selected.department} />
              <Field label="บริษัท" value={selected.companyName} />
            </div>
          ) : (
            <p style={{ color: "#6b7280" }}>— เลือกพี่เลี้ยงจากตารางด้านซ้าย —</p>
          )}
        </section>
      </div>

      <style>{`
        .btn.ghost {
          background:#fff; color:#0f172a;
          border:1px solid rgba(0,0,0,.08);
          border-radius:10px; padding:6px 12px;
          font-weight:600;
        }
        .btn.ghost:hover {
          background:#f8fafc; border-color:#c7d2fe;
          box-shadow:0 1px 0 rgba(0,0,0,.02),0 6px 14px rgba(0,116,183,.14);
        }
        .btn.small {
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 6px;
          min-width:auto;
        }
        .icon-btn {
          width:32px; height:32px;
          border-radius:8px; border:1px solid rgba(0,0,0,.08);
          background:#fff; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
        }
        .icon-btn:hover{ background:#f8fafc; }

        /* ตาราง */
        .doc-table{ table-layout: fixed; }
        .doc-table col.col-name{ width: 14ch; }
        .doc-table col.col-email{ width: 16ch; }
        .doc-table col.col-company{ width: 6ch; }
        .doc-table col.col-dept{ width: 6ch; }
        .doc-table col.col-actions{ width: 15ch; }
        .doc-table .col-email .email,
        .doc-table .col-company .company {
          display:block; overflow:hidden;
          text-overflow:ellipsis; white-space:nowrap;
        }
        .cell-actions {
          display:flex; justify-content:flex-end; gap:8px;
        }

        @media(max-width:1024px){
          .cols{ grid-template-columns:1fr !important }
          .tools{ margin-left:18px !important }
          .tools .input{ flex:1 1 100% !important; min-width:0 !important }
        }
      `}</style>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="field card" style={{ padding: 10 }}>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{label}</div>
      <div style={{ fontWeight: 800 }}>{value || "-"}</div>
    </div>
  );
}
