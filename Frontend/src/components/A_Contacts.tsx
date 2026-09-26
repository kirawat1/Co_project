import { useState, useEffect, useMemo } from "react";
import { IcUser } from "./icons";
import { apiFetch } from "../utils/apiFetch";
import LoadMoreFooter from "./LoadMoreFooter";
import { useLoadMore } from "../utils/useLoadMore";
import { notify, askConfirm } from "../utils/notify";
import ContactForm from "./ContactForm";
import { contactName, type CompanyContact } from "../utils/contacts";

/* =========================
   ผู้ติดต่อ (HR) ของทุกบริษัท — เจ้าหน้าที่ดู/เพิ่ม/แก้/ลบ
   นักศึกษาเลือกผู้ติดต่อในหน้าข้อมูลนักศึกษา · ใช้เป็นผู้รับหนังสือจากวิทยาลัย
========================= */
interface ContactRow extends CompanyContact {
  company: { id: string; name: string };
  _count?: { studentCoops: number };
}

interface CompanyOption { id: string; name: string }

export default function A_Contacts() {
  const [items, setItems] = useState<ContactRow[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  // null = ปิด · "new" = เพิ่ม · object = แก้ไข
  const [modal, setModal] = useState<ContactRow | "new" | null>(null);
  const [newCompanyId, setNewCompanyId] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cRes, compRes] = await Promise.all([apiFetch("/api/companies/contacts"), apiFetch("/api/companies")]);
      if (cRes.ok) setItems((await cRes.json()).contacts ?? []);
      else notify.error("โหลดรายชื่อผู้ติดต่อไม่สำเร็จ");
      if (compRes.ok) {
        const list = (await compRes.json()).data ?? [];
        setCompanies(list.map((c: CompanyOption) => ({ id: c.id, name: c.name })).sort((a: CompanyOption, b: CompanyOption) => a.name.localeCompare(b.name, "th")));
      }
    } catch {
      notify.error("โหลดรายชื่อผู้ติดต่อไม่สำเร็จ: เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (c: ContactRow) => {
    const used = c._count?.studentCoops ?? 0;
    const msg = used > 0
      ? `ลบผู้ติดต่อ "${contactName(c)}"?\nมีนักศึกษา ${used} คนเลือกผู้ติดต่อคนนี้อยู่ — จะถูกถอดออก และหนังสือจะใช้ผู้ติดต่อเดิมของบริษัทแทน`
      : `ลบผู้ติดต่อ "${contactName(c)}"?`;
    if (!(await askConfirm(msg, { confirmLabel: "ลบผู้ติดต่อ", danger: true }))) return;
    try {
      const res = await apiFetch(`/api/companies/contacts/${c.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return notify.error(data.message || "ลบผู้ติดต่อไม่สำเร็จ");
      notify.success("ลบผู้ติดต่อแล้ว");
      setItems(prev => prev.filter(x => x.id !== c.id));
    } catch {
      notify.error("ลบผู้ติดต่อไม่สำเร็จ: เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  };

  const onSaved = () => {
    setModal(null);
    setNewCompanyId("");
    fetchData();
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((c) =>
      `${contactName(c)} ${c.email ?? ""} ${c.phone ?? ""} ${c.company?.name ?? ""} ${c.position ?? ""} ${c.department ?? ""}`.toLowerCase().includes(needle));
  }, [items, q]);

  const { shown, hasMore, sentinelRef, showMore, total } = useLoadMore(filtered, q);

  if (loading) return <div style={{ padding: 28, marginLeft: 35 }}>กำลังโหลดข้อมูลผู้ติดต่อ...</div>;

  return (
    <div className="page" style={{ padding: 28, marginLeft: 35 }}>
      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>ผู้ติดต่อ (HR)</h2>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>ผู้ติดต่อของบริษัท — นักศึกษาเลือกก่อนยื่นคำร้อง และใช้เป็นผู้รับหนังสือจากวิทยาลัย</div>
          </div>
          <button className="btn" style={saveBtn} onClick={() => setModal("new")}>+ เพิ่มผู้ติดต่อ</button>
        </div>
        <input
          className="input"
          placeholder="ค้นหา: ชื่อ / บริษัท / ตำแหน่ง / อีเมล / เบอร์"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 360, maxWidth: "100%", padding: 8, borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
      </section>

      <section style={{ ...card, marginTop: 20, padding: 0, overflow: "hidden" }}>
        <table width="100%" className="responsive-table" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["ชื่อ-นามสกุล", "บริษัท", "ตำแหน่ง/ทีม", "ติดต่อ", "นักศึกษาที่เลือก", "จัดการ"].map((h) => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>ไม่พบผู้ติดต่อ</td></tr>
            ) : shown.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={td} data-label="ชื่อ-นามสกุล">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <IcUser width={16} height={16} style={{ color: "#2563eb" }} />
                    </div>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>{contactName(c) || "-"}</span>
                  </div>
                </td>
                <td style={td} data-label="บริษัท"><span style={{ fontWeight: 600, color: "#0074B7" }}>{c.company?.name}</span></td>
                <td style={td} data-label="ตำแหน่ง/ทีม">
                  <div style={{ fontSize: 13 }}>{c.position || "-"}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{c.department}</div>
                </td>
                <td style={td} data-label="ติดต่อ">
                  <div style={{ fontSize: 13 }}>{c.phone || "-"}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{c.email}</div>
                </td>
                <td style={td} data-label="นักศึกษาที่เลือก">{c._count?.studentCoops ?? 0} คน</td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn" style={ghostBtn} onClick={() => setModal(c)}>✏️ แก้ไข</button>
                    <button className="btn" style={{ ...ghostBtn, color: "#ef4444", borderColor: "#ef4444" }} onClick={() => handleDelete(c)}>🗑️ ลบ</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <LoadMoreFooter shownCount={shown.length} total={total} hasMore={hasMore} onShowMore={showMore} sentinelRef={sentinelRef} itemLabel="คน" />

      {modal && (
        <div style={overlay} onClick={() => setModal(null)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={modal === "new" ? "เพิ่มผู้ติดต่อ" : "แก้ไขผู้ติดต่อ"}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>{modal === "new" ? "เพิ่มผู้ติดต่อ" : `แก้ไขผู้ติดต่อ · ${modal.company?.name}`}</h2>
              <button onClick={() => setModal(null)} aria-label="ปิด" style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>✕</button>
            </div>
            {modal === "new" ? (
              <>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>บริษัท *</label>
                <select className="input" value={newCompanyId} onChange={(e) => setNewCompanyId(e.target.value)} style={{ width: "100%", marginBottom: 16 }} aria-label="บริษัท">
                  <option value="">-- เลือกบริษัท --</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {newCompanyId
                  ? <ContactForm companyId={newCompanyId} onSaved={onSaved} onCancel={() => setModal(null)} />
                  : <div style={{ fontSize: 13, color: "#b45309" }}>เลือกบริษัทก่อน แล้วจึงกรอกข้อมูลผู้ติดต่อ</div>}
              </>
            ) : (
              <ContactForm companyId={modal.company?.id ?? modal.companyId ?? ""} contact={modal} onSaved={onSaved} onCancel={() => setModal(null)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e5e7eb" };
const th: React.CSSProperties = { textAlign: "left", fontSize: 14, fontWeight: 700, padding: "12px 16px", color: "#475569" };
const td: React.CSSProperties = { padding: "14px 16px", fontSize: 14, color: "#334155", verticalAlign: "middle" };
const ghostBtn: React.CSSProperties = { background: "#fff", color: "#0074B7", boxShadow: "none", border: "1px solid rgba(10,132,255,.25)", height: 34, borderRadius: 8, padding: "0 12px", cursor: "pointer", fontWeight: 600, fontSize: 13 };
const saveBtn: React.CSSProperties = { background: "#0074B7", color: "#fff", boxShadow: "none", border: "1px solid rgba(10,132,255,.25)", height: 36, borderRadius: 8, padding: "0 16px", cursor: "pointer", fontWeight: 600, fontSize: 14 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)", padding: 16 };
const modalBox: React.CSSProperties = { background: "#fff", borderRadius: 20, padding: 28, width: 640, maxWidth: "100%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" };
