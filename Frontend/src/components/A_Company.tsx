/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useState, useEffect } from "react";
import { apiFetch } from "../utils/apiFetch";
import { applyAddressChange } from "../utils/addressAutofill";
import A_CompanyImport from "./A_CompanyImport";
import LoadMoreFooter from "./LoadMoreFooter";
import { useLoadMore, toggleSelectAllShown, allShownSelected } from "../utils/useLoadMore";
import { notify, askConfirm } from "../utils/notify";

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
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // ช่องติ๊กจะแสดงเฉพาะตอนเปิดโหมดเลือก — กันกดลบผิดแห่งตอนดูรายการตามปกติ
  const [selectMode, setSelectMode] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [viewCompany, setViewCompany] = useState<AdminCompanyRecord | null>(null);
  const [showAddMentor, setShowAddMentor] = useState(false);
  const [editingMentor, setEditingMentor] = useState<any>(null);
  const [justCreatedCompany, setJustCreatedCompany] = useState<AdminCompanyRecord | null>(null);
  const [quickAddMentor, setQuickAddMentor] = useState(false);

  const [form, setForm] = useState<any>(emptyCompany());
  const [mentorForm, setMentorForm] = useState<any>(emptyMentor());

  // State สำหรับเก็บข้อมูลปีการศึกษาจาก Backend
  const [coopPeriods, setCoopPeriods] = useState<any[]>([]);

  useEffect(() => {
    // ดึงรายชื่อบริษัท
    apiFetch("/api/companies")
      .then(async res => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Unauthorized");
        }
        return res.json();
      })
      .then(data => setItems(Array.isArray(data) ? data : (data?.data ?? [])))
      .catch(err => console.error("Error fetching companies:", err))
      .finally(() => setLoading(false));
    setSelectedIds(new Set());
  }, []);

  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        // 🟢 เรียก API ของ admin ตาม Route ที่มีอยู่: /api/admin/coop-periods/all
        const res = await apiFetch("/api/admin/coop-periods/all");
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

  // แสดงทีละ 30 แห่ง เลื่อนถึงท้ายตารางแล้วแสดงเพิ่มอีก 30 — ทำฝั่งหน้าจอ เพราะ /api/companies
  // ถูกใช้ที่อื่นด้วย (dropdown เลือกบริษัทของนักศึกษาต้องได้ครบทุกแห่ง) และหลักร้อยแห่งโหลดทีเดียวได้สบาย
  // เลือกแบบนี้แทนแบ่งหน้า เพราะแถวที่ติ๊กเลือกไว้ยังอยู่บนจอ ไม่ต้องล้างการเลือกตอนเปลี่ยนหน้า
  const { shown: shownItems, hasMore, sentinelRef, showMore, total } = useLoadMore(filtered, q);

  /* ---------------- CRUD บริษัท ---------------- */
  async function saveAdd(e: React.FormEvent) {
    e.preventDefault();

    try {
      const res = await apiFetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!data.ok || !data.company) {
        notify.error(data.message || "บันทึกบริษัทไม่สำเร็จ");
        return;
      }

      // ใส่ไว้บนสุด ให้เห็นทันที (ถ้าต่อท้ายจะอยู่ท้ายรายการที่ยังไม่ได้แสดง)
      setItems(prev => [data.company, ...prev]);
      setShowAdd(false);
      setJustCreatedCompany(data.company);

    } catch (err) {
      console.error(err);
      notify.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.id) return notify.warning("ข้อมูลไม่ครบถ้วน");

    try {
      const res = await apiFetch(`/api/companies/${form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message);

      setItems((prev) => prev.map((c) => c.id === form.id ? data.company : c));
      setShowEdit(false);
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || "อัปเดตไม่สำเร็จ");
    }
  }

  async function remove(id: string) {
    if (!(await askConfirm("ลบบริษัทนี้พร้อมพี่เลี้ยงทั้งหมดหรือไม่?", { confirmLabel: "ลบบริษัท", danger: true }))) return;

    try {
      const res = await apiFetch(`/api/companies/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) return notify.error(data.message);

      setItems(prev => prev.filter(c => c.id !== id));
      if (viewCompany?.id === id) setViewCompany(null);
    } catch (err) { notify.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
  }

  // เลือกทั้งหมด = ทุกแห่งที่แสดงอยู่บนจอ ไม่เหมารวมแห่งที่ยังไม่ได้เลื่อนลงไปแสดง
  const isAllShownSelected = allShownSelected(shownItems, selectedIds, c => c.id);
  function toggleSelectAll() {
    setSelectedIds(prev => toggleSelectAllShown(shownItems, prev, c => c.id));
  }

  function toggleSelectOne(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function handleBulkDeleteCompanies() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!(await askConfirm(`ลบบริษัทที่เลือก ${ids.length} แห่ง พร้อมพี่เลี้ยงทั้งหมดหรือไม่?`, { confirmLabel: "ลบบริษัท", danger: true }))) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        ids.map(id => apiFetch(`/api/companies/${id}`, { method: "DELETE" }).then(async r => {
          const data = await r.json().catch(() => ({}));
          if (!data.ok) throw new Error(data.message || "ลบไม่สำเร็จ");
          return id;
        }))
      );
      const succeededIds = new Set(
        results.filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled").map(r => r.value)
      );
      const failed = results.length - succeededIds.size;

      setItems(prev => prev.filter(c => !succeededIds.has(c.id)));
      if (viewCompany && succeededIds.has(viewCompany.id)) setViewCompany(null);
      exitSelectMode();

      if (failed > 0) {
        notify.warning(`ลบสำเร็จ ${succeededIds.size} แห่ง, ไม่สำเร็จ ${failed} แห่ง (อาจมีนักศึกษาอ้างอิงอยู่)`);
      }
    } finally {
      setBulkDeleting(false);
    }
  }

  /* ---------------- Mentor ---------------- */
  async function saveMentor(e: React.FormEvent) {
    e.preventDefault();
    if (!viewCompany) return;

    const { firstName, lastName, department, position, email, phone } = mentorForm;

    if (!firstName || !lastName || !department || !position || !email || !phone) {
      notify.warning("กรุณากรอกข้อมูลพี่เลี้ยงให้ครบทุกช่อง");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      notify.warning("รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }

    try {
      if (!editingMentor) {
        // ---- ADD ----
        const res = await apiFetch(`/api/companies/${viewCompany.id}/mentors`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mentorForm),
        });
        const data = await res.json();
        if (!data.ok || !data.mentor) return notify.error("เพิ่มพี่เลี้ยงไม่สำเร็จ");

        setViewCompany(prev => prev ? { ...prev, mentors: [...(prev.mentors || []), data.mentor] } : prev);
        setItems(prev => prev.map(c => c.id === viewCompany?.id ? { ...c, mentors: [...(c.mentors || []), data.mentor] } : c));

      } else {
        // ---- EDIT ----
        const res = await apiFetch(`/api/companies/mentors/${editingMentor.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mentorForm),
        });
        const data = await res.json();
        if (!data.ok || !data.mentor) return notify.error("แก้ไขพี่เลี้ยงไม่สำเร็จ");

        setViewCompany(prev => prev ? { ...prev, mentors: (prev.mentors || []).map(m => m.id === editingMentor.id ? data.mentor : m) } : prev);
        setItems(prev => prev.map(c => c.id === viewCompany?.id ? { ...c, mentors: (c.mentors || []).map(m => m.id === editingMentor.id ? data.mentor : m) } : c));
      }

      setEditingMentor(null);
      setMentorForm(emptyMentor());
      setShowAddMentor(false);

      if (quickAddMentor) {
        setViewCompany(null);
        setQuickAddMentor(false);
      }

    } catch (err) {
      console.error(err);
      notify.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  }

  async function removeMentor(mentorId: string) {
    if (!(await askConfirm("ลบพี่เลี้ยงคนนี้หรือไม่?", { confirmLabel: "ลบพี่เลี้ยง", danger: true }))) return;

    try {
      const res = await apiFetch(`/api/companies/mentors/${mentorId}`, { method: "DELETE" });

      const data = await res.json();
      if (!data.ok) return notify.error(data.message || "ลบพี่เลี้ยงไม่สำเร็จ");

      setViewCompany(prev => prev ? { ...prev, mentors: (prev.mentors || []).filter(m => m.id !== mentorId) } : prev);
      setItems(prev => prev.map(c => c.id === viewCompany?.id ? { ...c, mentors: (c.mentors || []).filter(m => m.id !== mentorId) } : c));

    } catch (err) { console.error(err); notify.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
  }

  /* ---------------- UI ---------------- */
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>กำลังโหลดข้อมูล...</div>;

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ margin: 0 }}>🏢 จัดการข้อมูลบริษัทสหกิจศึกษา</h2>

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder="ค้นหา: ชื่อ / จังหวัด / อีเมล / ปี / เลขที่"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 320, maxWidth: "100%" }}
          />
          <button className="btn" style={{ ...saveBtn, background: "#059669" }} onClick={() => setShowImport(true)}>
            📥 นำเข้า Excel
          </button>
          <button className="btn" style={saveBtn} onClick={() => { setForm(emptyCompany()); setShowAdd(true); }}>
            + เพิ่มบริษัท
          </button>
        </div>
      </section>

      {/* Bulk action bar */}
      {!selectMode ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button className="btn" style={ghostBtn} onClick={() => setSelectMode(true)}>
            ☑️ เลือกหลายแห่ง
          </button>
        </div>
      ) : (
        <div style={{
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12,
          padding: "10px 16px", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#9a3412" }}>
            เลือกแล้ว {selectedIds.size} แห่ง
          </span>
          {/* อยู่ในแถบนี้แทนหัวตาราง เพราะจอ ≤1024px ซ่อน thead ทั้งแถว (S_Theme.tsx) */}
          <button className="btn" style={ghostBtn} onClick={toggleSelectAll} disabled={bulkDeleting || shownItems.length === 0}>
            {isAllShownSelected ? "ยกเลิกเลือกทั้งหมด" : `เลือกทั้งหมด (${shownItems.length})`}
          </button>
          <button
            className="btn"
            style={{ ...ghostBtn, color: "#ef4444", borderColor: "#ef4444", opacity: bulkDeleting || selectedIds.size === 0 ? 0.6 : 1, cursor: bulkDeleting || selectedIds.size === 0 ? "not-allowed" : "pointer" }}
            onClick={handleBulkDeleteCompanies}
            disabled={bulkDeleting || selectedIds.size === 0}
          >
            🗑️ {bulkDeleting ? "กำลังลบ..." : `ลบที่เลือก (${selectedIds.size})`}
          </button>
          <button
            className="btn"
            style={{ ...ghostBtn, marginLeft: "auto" }}
            onClick={exitSelectMode}
            disabled={bulkDeleting}
          >
            ปิดโหมดเลือก
          </button>
        </div>
      )}

      {/* Table */}
      <section className="card" style={{ padding: 24 }}>
        <table className="tbl responsive-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {selectMode && (
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={isAllShownSelected}
                    ref={el => { if (el) el.indeterminate = !isAllShownSelected && shownItems.some(c => selectedIds.has(c.id)); }}
                    onChange={toggleSelectAll}
                    aria-label="เลือกทั้งหมด"
                  />
                </th>
              )}
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
                <td colSpan={selectMode ? 7 : 6} style={{ textAlign: "center", padding: 16, color: "#6b7280" }}>
                  — ไม่มีข้อมูล —
                </td>
              </tr>
            )}

            {shownItems.map((c, idx) => (
              <tr key={c.id} className={idx % 2 ? "row-odd" : "row-even"} style={selectedIds.has(c.id) ? { background: "#fff7ed" } : undefined}>
                {selectMode && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelectOne(c.id)}
                      aria-label={`เลือก ${c.name}`}
                    />
                  </td>
                )}
                <td style={{ fontWeight: 600, color: '#1e293b' }} data-label="ชื่อบริษัท">{c.name}</td>
                <td data-label="จังหวัด">{c.province || "-"}</td>
                <td data-label="อีเมล">{c.email || "-"}</td>
                <td data-label="ผู้ติดต่อ">{c.contactPerson || "-"}<br /><span style={{ fontSize: 12, color: '#64748b' }}>{c.contactPosition}</span></td>
                <td data-label="ปีที่รับ">{c.pastYears}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn" style={ghostBtn} onClick={() => setViewCompany(c)}>
                      รายละเอียด
                    </button>
                    <button className="btn" style={ghostBtn} onClick={() => { setForm(c); setShowEdit(true); }}>
                      ✏️ แก้ไข
                    </button>
                    <button className="btn" style={{ ...ghostBtn, color: '#ef4444', borderColor: '#ef4444' }} onClick={() => remove(c.id)}>
                      🗑️ ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <LoadMoreFooter shownCount={shownItems.length} total={total} hasMore={hasMore} onShowMore={showMore} sentinelRef={sentinelRef} itemLabel="แห่ง" />

      {/* ---------------- Modals ---------------- */}
      {showImport && (
        <A_CompanyImport
          onClose={() => setShowImport(false)}
          onImported={() => {
            apiFetch("/api/companies")
              .then(async (res: any) => {
                if (!res.ok) return;
                const data = await res.json();
                setItems(Array.isArray(data) ? data : (data?.data ?? []));
              })
              .catch(() => {});
          }}
        />
      )}

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
          <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 14 }}>
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
            <button className="btn" style={saveBtn} onClick={() => { setQuickAddMentor(false); setShowAddMentor(true); }}>+ เพิ่มพี่เลี้ยง</button>
          </div>

          {(viewCompany.mentors || []).length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 13, textAlign: 'center', background: '#f1f5f9', padding: 20, borderRadius: 8 }}>ยังไม่มีข้อมูลพี่เลี้ยงในระบบ</p>
          ) : (
            <table className="responsive-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
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
                    <td style={{ padding: '10px 8px' }} data-label="ชื่อ-นามสกุล"><b>{m.firstName} {m.lastName}</b></td>
                    <td style={{ padding: '10px 8px' }} data-label="ตำแหน่ง / แผนก">{m.position} <br /><span style={{ color: '#64748b', fontSize: 12 }}>{m.department}</span></td>
                    <td style={{ padding: '10px 8px' }} data-label="ติดต่อ">{m.phone} <br /><span style={{ color: '#64748b', fontSize: 12 }}>{m.email}</span></td>
                    <td style={{ textAlign: "center", padding: '10px 8px' }}>
                      <button style={{ ...ghostBtn, height: 30, fontSize: 12 }} onClick={() => { setEditingMentor(m); setMentorForm(m); setShowAddMentor(true); }}>✏️ แก้ไข</button>
                      <button style={{ ...dangerBtn, height: 30, fontSize: 12 }} onClick={() => removeMentor(m.id)}>🗑️ ลบ</button>
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

      {justCreatedCompany && (
        <Modal title="✅ เพิ่มบริษัทสำเร็จ" onClose={() => setJustCreatedCompany(null)}>
          <p style={{ fontSize: 14, color: '#475569' }}>
            เพิ่มบริษัท <b>{justCreatedCompany.name}</b> สำเร็จ! ต้องการเพิ่มข้อมูลพี่เลี้ยงตอนนี้เลยหรือไม่?
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button style={ghostBtn} onClick={() => setJustCreatedCompany(null)}>
              ข้ามไปก่อน
            </button>
            <button
              style={saveBtn}
              onClick={() => {
                setViewCompany(justCreatedCompany);
                setQuickAddMentor(true);
                setShowAddMentor(true);
                setJustCreatedCompany(null);
              }}
            >
              เพิ่มพี่เลี้ยงเลย
            </button>
          </div>
        </Modal>
      )}

      {/* ---------------- Styles ---------------- */}
      <style>{`
        .row-even { background:#ffffff; }
        .row-odd { background:#f8fafc; }
        .tbl th { text-align:left; font-size:13px; color:#475569; padding: 12px 6px; border-bottom: 2px solid #e2e8f0; }
        .tbl td { padding:12px 6px; font-size:14px; border-bottom: 1px solid #f1f5f9; }
        .btn-secondary.small { padding:4px 10px; font-size:12px; }
        .btn-danger { margin-left:6px; }
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
        @media (max-width: 600px) { .detail-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

// 🟢 2. รับค่า coopPeriods เข้ามาใช้งาน
function CompanyForm({ form, setForm, onSubmit, coopPeriods }: any) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(applyAddressChange(form, e.target.name, e.target.value));
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
        <button type="submit" className="btn" style={saveBtn}>💾 บันทึกข้อมูลบริษัท</button>
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
        <button type="submit" className="btn" style={saveBtn}>💾 บันทึกข้อมูลพี่เลี้ยง</button>
      </div>
    </form>
  );
}

const ghostBtn: React.CSSProperties = { background: "#fff", color: "#0074B7", boxShadow: "none", border: "1px solid rgba(10,132,255,.25)", height: 34, borderRadius: 8, padding: '0 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13 };
const saveBtn: React.CSSProperties = { background: "#0074B7", color: "#fff", boxShadow: "none", border: "1px solid rgba(10,132,255,.25)", height: 36, borderRadius: 8, padding: '0 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const dangerBtn: React.CSSProperties = { ...ghostBtn, color: '#ef4444', borderColor: '#ef4444' } as React.CSSProperties;
const td: React.CSSProperties = { padding: "14px 16px", fontSize: 14, color: '#334155', verticalAlign: 'middle' };
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', margin: "0 0 4px 0" };