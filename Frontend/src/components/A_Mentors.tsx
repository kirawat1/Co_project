// src/components/A_Mentors.tsx
import { useMemo, useState } from "react";

type MentorProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
  department?: string;
  companyName?: string;
};

const KM = "coop.admin.mentors";

function loadMentors(): MentorProfile[] {
  try { return JSON.parse(localStorage.getItem(KM) || "[]"); }
  catch { return []; }
}
function saveMentors(list: MentorProfile[]) {
  localStorage.setItem(KM, JSON.stringify(list));
}

export default function A_Mentors() {
  const [items, setItems] = useState<MentorProfile[]>(() => loadMentors());
  const [q, setQ] = useState("");
  const [activeEmail, setActiveEmail] = useState<string>("");

  // กรองตามชื่อ/อีเมล
  const filtered = useMemo(
    () => items.filter(m => {
      const key = `${m.firstName||""} ${m.lastName||""} ${m.email||""}`.toLowerCase();
      return key.includes(q.toLowerCase());
    }),
    [items, q]
  );

  const selected = items.find(m => m.email === activeEmail) || null;

  // รีโหลดข้อมูลทั้งหมดจาก localStorage + ล้างการค้นหา/การเลือก
  function showAll(){
    const all = loadMentors();
    setItems(all);
    setQ("");
    setActiveEmail("");
  }

  // ลบรายการ
  function remove(email: string){
    if(!confirm("ลบรายการนี้?")) return;
    const next = items.filter(m => m.email !== email);
    setItems(next);
    saveMentors(next);
    if(activeEmail === email) setActiveEmail("");
  }

  // ส่งออกเป็น PDF (ใช้หน้าพิมพ์ให้ผู้ใช้ Save as PDF)
  function exportPdf(rows: MentorProfile[]){
    const w = window.open("", "_blank");
    if(!w){ alert("ไม่สามารถเปิดหน้าพิมพ์ได้"); return; }

    const style = `
      <style>
        body{ font-family: ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans","Apple Color Emoji","Segoe UI Emoji"; padding:20px; }
        h1{ margin:0 0 12px; font-size:18px; }
        table{ width:100%; border-collapse:collapse; }
        th, td{ border:1px solid #e5e7eb; padding:8px 10px; font-size:12px; }
        th{ background:#f8fafc; text-align:left; }
        .muted{ color:#6b7280; }
      </style>
    `;

    const rowsHtml = rows.map(m => {
      const name = `${m.firstName||""} ${m.lastName||""}`.trim();
      return `<tr>
        <td>${name || "-"}</td>
        <td>${m.email || "-"}</td>
        <td>${m.phone || "-"}</td>
        <td>${m.companyName || "-"}</td>
        <td>${m.department || "-"}</td>
        <td>${m.title || "-"}</td>
      </tr>`;
    }).join("");

    const html = `
      <html><head><meta charset="utf-8" />${style}</head>
      <body>
        <h1>รายชื่อพี่เลี้ยง <span class="muted">(${rows.length} รายการ)</span></h1>
        <table>
          <thead>
            <tr>
              <th>ชื่อ-นามสกุล</th>
              <th>อีเมล</th>
              <th>เบอร์</th>
              <th>บริษัท</th>
              <th>แผนก</th>
              <th>ตำแหน่ง</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),50));</script>
      </body></html>
    `;
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>พี่เลี้ยง</h2>

        {/* Toolbar: ช่องค้นหา + ปุ่มดูทั้งหมด/ส่งออก PDF */}
        <div
          className="tools"
          style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginLeft: 18 }}
        >
          <input
            className="input"
            placeholder="ค้นหา: ชื่อ/อีเมล"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            style={{ flex: "0 1 420px", minWidth: 260 }}
          />
          <button className="btn" onClick={showAll} type="button">ดูข้อมูลทั้งหมด</button>
          <button className="btn" onClick={()=>exportPdf(filtered)} type="button">ส่งออก PDF</button>
        </div>
      </section>

      <div className="cols" style={{ display: "grid", gridTemplateColumns: ".7fr .9fr", gap: 10 }}>
        {/* ซ้าย: ตารางพี่เลี้ยง */}
        <section className="card" style={{ padding: 24, marginBottom: 28, overflowX: "auto" }}>
          <table className="doc-table" style={{ width: "100%" }}>
            {/* คุมคอลัมน์แบบเดียวกับ A_Students */}
            <colgroup>
              <col className="col-name" />
              <col className="col-email" />
              <col className="col-company" />
              <col className="col-actions" />
            </colgroup>

            <thead>
              <tr>
                <th align="left">ชื่อ-นามสกุล</th>
                <th align="left">อีเมล</th>
                <th align="left">บริษัท</th>
                <th style={{ textAlign: "right" }}>การทำงาน</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map(m => {
                const full = `${m.firstName||""} ${m.lastName||""}`.trim() || "-";
                const isActive = m.email === activeEmail;
                return (
                  <tr key={m.email || full}>
                    <td>{full}</td>

                    {/* อีเมล: แคบ + ตัดด้วย … */}
                    <td className="col-email">
                      <span className="email" title={m.email || "-"}>{m.email || "-"}</span>
                    </td>

                    {/* บริษัท: ให้ตัดด้วย … ถ้ายาว */}
                    <td className="col-company">
                      <span className="company" title={m.companyName || "-"}>{m.companyName || "-"}</span>
                    </td>

                    {/* การทำงาน: ชิดขวา, ซ่อนปุ่มดูรายละเอียดเมื่อถูกเลือก */}
                    <td className="cell-actions">
                      {!isActive && (
                        <button className="btn" type="button" onClick={()=>setActiveEmail(m.email)}>
                          ดูรายละเอียด
                        </button>
                      )}
                      <button className="btn ghost" type="button" title="ลบ" onClick={()=>remove(m.email)}>
                        ลบ
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0 && (
                <tr><td colSpan={4} style={{ color:"#6b7280" }}>— ไม่มีข้อมูล —</td></tr>
              )}
            </tbody>
          </table>
        </section>

        {/* ขวา: รายละเอียดพี่เลี้ยง + ปุ่มปิด */}
        <section className="card" aria-live="polite" style={{ padding: 24, marginBottom: 28, position:"relative" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <h3 style={{ margin:0 }}>รายละเอียด</h3>
            {selected && (
              <button
                className="icon-btn"
                aria-label="ปิดรายละเอียด"
                title="ปิดรายละเอียด"
                onClick={()=>setActiveEmail("")}
                type="button"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>

          {selected ? (
            <div style={{ display:"grid", gridTemplateColumns: ".5fr .5fr", gap:8 }}>
              <Field label="ชื่อ" value={selected.firstName||"-"} />
              <Field label="นามสกุล" value={selected.lastName||"-"} />
              <Field label="อีเมล" value={selected.email||"-"} />
              <Field label="เบอร์" value={selected.phone||"-"} />
              <Field label="ตำแหน่ง" value={selected.title||"-"} />
              <Field label="แผนก" value={selected.department||"-"} />
              <Field label="บริษัท" value={selected.companyName||"-"} />
            </div>
          ) : (
            <p style={{ color:"#6b7280" }}>— เลือกพี่เลี้ยงจากตารางด้านซ้าย —</p>
          )}
        </section>
      </div>

      <style>{`
        .btn.ghost{
          background:#fff; color:#0f172a; border:1px solid rgba(0,0,0,.08);
          border-radius:10px; padding:10px 14px; font-weight:700
        }
        .btn.ghost:hover{
          background:#f8fafc; border-color:#c7d2fe;
          box-shadow:0 1px 0 rgba(0,0,0,.02), 0 6px 14px rgba(0,116,183,.14)
        }
        .icon-btn{
          display:inline-flex; align-items:center; justify-content:center;
          width:32px; height:32px; border-radius:8px;
          border:1px solid rgba(0,0,0,.08); background:#fff; cursor:pointer;
        }
        .icon-btn:hover{ background:#f8fafc; }

        /* ตารางหลัก: ใช้ fixed layout + colgroup เช่นเดียวกับ A_Students */
        .doc-table{ table-layout: fixed; }
        .doc-table col.col-name{ width: 15ch; }     /* ชื่อ-นามสกุล */
        .doc-table col.col-email{ width: 15ch; }    /* อีเมล (ตัดด้วย …) */
        .doc-table col.col-company{ width: 12ch; }  /* บริษัท (ตัดด้วย …) */
        .doc-table col.col-actions{ width: 15ch; }  /* ปุ่มการทำงาน */
        .doc-table .col-email .email,
        .doc-table .col-company .company{
          display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }

        /* การทำงานชิดขวาเหมือนเดิม */
        .doc-table th:last-child{ text-align:right; }
        .cell-actions{
          display:flex; justify-content:flex-end; align-items:center;
          gap:8px; white-space:nowrap;
        }

        /* กันตารางล้นการ์ด */
        .card{ overflow-x: auto; }

        /* Responsive: iPad และเล็กกว่า = 1 คอลัมน์ */
        @media (max-width:1024px){
          .cols{ grid-template-columns:1fr !important }
          .tools{ margin-left: 18px !important; }
          .tools .input{ flex: 1 1 100% !important; min-width: 0 !important; }
          .doc-table col.col-email{ width: 14ch; }
          .doc-table col.col-company{ width: 12ch; }
        }
      `}</style>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }){
  const show = value === undefined || value === null || value === "" ? "-" : value;
  return (
    <div className="field card" style={{ padding:10 }}>
      <div style={{ fontSize:12, color:"#6b7280", fontWeight:700 }}>{label}</div>
      <div style={{ fontWeight:800 }}>{show}</div>
    </div>
  );
}
