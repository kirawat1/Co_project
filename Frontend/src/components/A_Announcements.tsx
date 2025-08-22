// src/components/A_Announcements.tsx
import React, { useMemo, useState } from "react";

export type Ann = { id:string; title:string; date:string; body?:string };
const KA = "coop.shared.announcements";

function load(): Ann[]{ try{ return JSON.parse(localStorage.getItem(KA)||"[]"); }catch{return []} }
function save(list: Ann[]){ localStorage.setItem(KA, JSON.stringify(list)); }

export default function A_Announcements(){
  const [items, setItems] = useState<Ann[]>(()=> load());
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [body, setBody] = useState("");

  const upcoming = useMemo(
    ()=> [...items]
      .filter(a=>a.date>=new Date().toISOString().slice(0,10))
      .sort((a,b)=> a.date.localeCompare(b.date)),
    [items]
  );

  function add(e: React.FormEvent){
    e.preventDefault();
    const it:Ann = { id: crypto.randomUUID(), title: title.trim(), date, body: body.trim() };
    if(!it.title){ alert("กรุณากรอกหัวข้อ"); return; }
    const next = [it, ...items];
    setItems(next); save(next);
    setTitle(""); setBody("");
  }
  function remove(id:string){
    if(!confirm("ลบประกาศนี้?")) return;
    const next = items.filter(x=>x.id!==id);
    setItems(next); save(next);
  }

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>เขียนประกาศสหกิจศึกษา</h2>

        {/* form: คุมความกว้างให้พอดีกรอบ + ใส่ label ชัดเจน */}
        <form
          className="grid2"
          onSubmit={add}
          style={{
            display:"grid",
            gridTemplateColumns:"1fr 240px",
            gap:12,
            marginLeft:18,
            marginRight:50
          }}
        >
          <div className="field">
            <label className="label" style={{marginLeft:10}}>หัวข้อประกาศ</label>
            <input
              className="input"
              placeholder="หัวข้อประกาศ"
              value={title}
              onChange={e=>setTitle(e.target.value)}
              style={{ width:"95%" }}
            />
          </div>

          <div className="field">
            <label className="label" style={{marginLeft:10}}>กำหนดวันที่</label>
            <input
              className="input"
              type="date"
              aria-label="กำหนดวันที่ของประกาศ"
              value={date}
              onChange={e=>setDate(e.target.value)}
              style={{ width:"100%" }}
            />
          </div>

          <div className="field" style={{ gridColumn:"1 / -1" }}>
            <label className="label" style={{marginLeft:10}}>รายละเอียด (ถ้ามี)</label>
            <textarea
              className="input"
              rows={3}
              placeholder="รายละเอียด (ถ้ามี)"
              value={body}
              onChange={e=>setBody(e.target.value)}
              style={{ width:"100%" }}
            />
          </div>

          <div>
            <button className="btn" type="submit">เพิ่มประกาศ</button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>รายการประกาศ</h2>
        <ul style={{ margin: 5, padding: 5, listStyle: "none" }}>
          {upcoming.map(a => (
            <li
              key={a.id}
              style={{
                padding:"10px 0",
                borderBottom:"1px dashed #e5e7eb",
                display:"grid",
                gridTemplateColumns:"1fr auto",
                gap:8,
                marginLeft:18,
                marginRight:18
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{a.title}</div>
                <div style={{ color: "#6b7280", fontSize: 14 }}>
                  {new Date(a.date + "T00:00:00").toLocaleDateString()} · {a.body || "-"}
                </div>
              </div>
              <div>
                <button className="btn ghost" onClick={()=>remove(a.id)} type="button">ลบ</button>
              </div>
            </li>
          ))}
          {upcoming.length===0 && <li style={{color:"#6b7280", marginLeft:18}}>— ไม่มีประกาศ —</li>}
        </ul>
      </section>

      <style>{`
        .field{ display:flex; flex-direction:column; gap:8px; }
        .label{ font-size:12px; font-weight:700; color:#6b7280; }
        .btn.ghost{
          background:#fff; color:#0f172a; border:1px solid rgba(0,0,0,.08);
          border-radius:10px; padding:10px 14px; font-weight:700
        }
        .btn.ghost:hover{
          background:#f8fafc; border-color:#c7d2fe;
          box-shadow:0 1px 0 rgba(0,0,0,.02), 0 6px 14px rgba(0,116,183,.14)
        }
        /* จอเล็ก: แปลงเป็น 1 คอลัมน์ และให้ช่องเต็มกว้าง */
        @media (max-width:1024px){
          .grid2{ grid-template-columns:1fr !important; margin-right:18px; }
        }
      `}</style>
    </div>
  );
}
