import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "../utils/apiFetch";
import { IcSave, IcUser } from "./icons";
import { useToast } from "./Toast";
import ConfirmDialog from "./ConfirmDialog";
import Spinner from "./Spinner";
import PasswordReveal from "./PasswordReveal";
import LoadMoreFooter from "./LoadMoreFooter";
import { useLoadMore, toggleSelectAllShown, allShownSelected } from "../utils/useLoadMore";

/* =========================
   Types
========================= */
interface Teacher {
  id: number;
  prefix: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  major: string;
  userId?: number;
  isCoopTeacher: boolean;
}

const TEACHER_PREFIXES_DEFAULT = ['ผศ.', 'ผศ. ดร.', 'รศ.', 'รศ. ดร.', 'ศ.', 'ศ. ดร.', 'อ.', 'อ. ดร.', 'ดร.'];

const EMPTY_TEACHER: Omit<Teacher, "id"> = {
  prefix: '', firstName: "", lastName: "", email: "",
  phone: "", major: "",
  isCoopTeacher: false,
};

/* =========================
   Main Component
========================= */
export default function A_Teacher() {
  const toast = useToast();
  const [items, setItems] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefixOptions, setPrefixOptions] = useState<string[]>(TEACHER_PREFIXES_DEFAULT);
  const [departments, setDepartments] = useState<string[]>([]);

  // Filters
  const [q, setQ] = useState("");
  const [filterMajor, setFilterMajor] = useState<string[]>([]);

  // Modals
  const [editModal, setEditModal] = useState<Teacher | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_TEACHER);
  const [pwModal, setPwModal] = useState<Teacher | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [saving, setSaving] = useState(false);

  // ConfirmDialog
  const [confirmDel, setConfirmDel] = useState<Teacher | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  // ช่องติ๊กจะแสดงเฉพาะตอนเปิดโหมดเลือก — กันกดลบผิดคนตอนดูรายชื่อตามปกติ
  const [selectMode, setSelectMode] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDel, setConfirmBulkDel] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/teacher");
      if (res.ok) {
        const data = await res.json();
        setItems((Array.isArray(data) ? data : []).map((t: any) => ({
          ...t, email: t.user?.email || t.email || "", major: t.major || t.department,
          isCoopTeacher: t.isCoopTeacher ?? false,
        })));
        setSelectedIds(new Set());
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchPrefixes = async () => {
    try {
      const res = await apiFetch("/api/teacher/prefixes");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) setPrefixOptions(data);
      }
    } catch {}
  };

  const fetchDepartments = async () => {
    try {
      const res = await apiFetch("/api/coop/departments");
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.departments)) {
          setDepartments(data.departments.map((d: any) => d.major));
        }
      }
    } catch {}
  };

  useEffect(() => { fetchData(); fetchPrefixes(); fetchDepartments(); }, []);

  // ─── CRUD handlers ────────────────────────────────────────

  const handleCreate = async () => {
    if (!createForm.firstName || !createForm.lastName || !createForm.email || !createPassword) {
      toast.warning("กรุณากรอกชื่อ นามสกุล อีเมล และรหัสผ่าน");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...createForm, password: createPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`เพิ่มอาจารย์ ${createForm.firstName} ${createForm.lastName} สำเร็จ`);
        setCreateModal(false);
        setCreateForm(EMPTY_TEACHER);
        setCreatePassword("");
        fetchData();
      } else {
        toast.error(data.message || "เพิ่มอาจารย์ไม่สำเร็จ");
      }
    } catch { toast.error("เกิดข้อผิดพลาด"); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (updated: Teacher) => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/teachers/${updated.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("บันทึกข้อมูลเรียบร้อย");
        setEditModal(null);
        fetchData();
      } else {
        toast.error(data.message || "บันทึกไม่สำเร็จ");
      }
    } catch { toast.error("เกิดข้อผิดพลาด"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (t: Teacher) => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/teachers/${t.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`ลบ ${t.firstName} ${t.lastName} เรียบร้อย`);
        fetchData();
      } else {
        toast.error(data.message || "ลบไม่สำเร็จ");
      }
    } catch { toast.error("เกิดข้อผิดพลาด"); }
    finally { setSaving(false); setConfirmDel(null); }
  };

  // เลือกทั้งหมด = เฉพาะรายชื่อที่แสดงอยู่บนจอ ไม่เหมารวมรายชื่อที่ยังไม่ได้เลื่อนลงไปแสดง
  function toggleSelectAll() {
    setSelectedIds(prev => toggleSelectAllShown(shownItems, prev, t => t.id));
  }

  function toggleSelectOne(id: number) {
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

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        ids.map(id => apiFetch(`/api/admin/teachers/${id}`, { method: "DELETE" }).then(async r => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok || !data.ok) throw new Error(data.message || "ลบไม่สำเร็จ");
        }))
      );
      const failed = results.filter(r => r.status === "rejected");
      const ok = results.length - failed.length;
      if (failed.length > 0) {
        const reasons = failed.map(r => (r as PromiseRejectedResult).reason?.message).filter(Boolean);
        const uniqueReasons = Array.from(new Set(reasons));
        toast.warning(`ลบสำเร็จ ${ok} คน, ไม่สำเร็จ ${failed.length} คน${uniqueReasons.length ? ` — ${uniqueReasons[0]}` : ""}`);
      } else {
        toast.success(`ลบอาจารย์ ${ok} คน เรียบร้อย`);
      }
      exitSelectMode();
      fetchData();
    } finally {
      setBulkDeleting(false);
      setConfirmBulkDel(false);
    }
  };

  const handleResetPassword = async () => {
    if (!pwModal) return;
    if (!newPassword || newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[!@#$%^&*()\-_=+[\]{};:'"<>,./?\\|`~]/.test(newPassword)) {
      toast.warning("รหัสผ่านต้องมีอย่างน้อย 8 ตัว • พิมพ์ใหญ่+เล็ก+เลข+อักขระพิเศษ (!@#$%^&*)");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/teachers/${pwModal.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`รีเซ็ตรหัสผ่าน ${pwModal.firstName} ${pwModal.lastName} สำเร็จ`);
        setPwModal(null);
        setNewPassword("");
      } else {
        toast.error(data.message || "รีเซ็ตรหัสผ่านไม่สำเร็จ");
      }
    } catch { toast.error("เกิดข้อผิดพลาด"); }
    finally { setSaving(false); }
  };

  // ─── filter ───────────────────────────────────────────────
  const filtered = useMemo(() => items.filter((t) => {
    const text = `${t.firstName} ${t.lastName} ${t.email} ${t.phone}`.toLowerCase();
    return text.includes(q.toLowerCase()) &&
      (filterMajor.length === 0 || filterMajor.includes(t.major || ""));
  }), [items, q, filterMajor]);

  // แสดงทีละ 30 คน เลื่อนถึงท้ายตารางแล้วแสดงเพิ่ม แทนโหลดทั้งหมดในตารางเดียว
  const { shown: shownItems, hasMore, sentinelRef, showMore, total } = useLoadMore(filtered, `${q}|${filterMajor.join(",")}`);
  const isAllShownSelected = allShownSelected(shownItems, selectedIds, t => t.id);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>กำลังโหลดข้อมูลอาจารย์...</div>;

  return (
    <div className="page" style={{ padding: 28, marginLeft: 35 }}>

      {/* ─── Delete Confirm ─── */}
      <ConfirmDialog
        open={!!confirmDel}
        title="ยืนยันการลบอาจารย์"
        message={`ลบ "${confirmDel?.firstName} ${confirmDel?.lastName}" ออกจากระบบ? การดำเนินการนี้จะลบบัญชีผู้ใช้ด้วย`}
        icon="🗑️"
        confirmLabel="ลบ"
        confirmColor="#ef4444"
        onConfirm={() => confirmDel && handleDelete(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />

      <ConfirmDialog
        open={confirmBulkDel}
        title="ยืนยันการลบอาจารย์หลายคน"
        message={`ลบอาจารย์ที่เลือก ${selectedIds.size} คน ออกจากระบบ? การดำเนินการนี้จะลบบัญชีผู้ใช้ด้วย`}
        icon="🗑️"
        confirmLabel="ลบทั้งหมด"
        confirmColor="#ef4444"
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmBulkDel(false)}
      />

      {/* ─── Filters ─── */}
      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>จัดการข้อมูลอาจารย์</h2>
          <button style={addBtn} onClick={() => { setCreateForm(EMPTY_TEACHER); setCreatePassword(""); setCreateModal(true); }}>
            + เพิ่มอาจารย์
          </button>
        </div>

        <div style={filterRow}>
          {/* type=search + ปิด autocomplete: เดิมกด "🔑 รหัสผ่าน" แล้ว password manager ของเบราว์เซอร์
              เอาอีเมลของคนที่ login มาเติมช่องนี้ (มองว่าเป็นช่อง username) รายชื่อเลยถูกกรอง */}
          <input className="input" type="search" name="teacher-search" autoComplete="off" placeholder="ค้นหา: ชื่อ / อีเมล / เบอร์โทร"
            value={q} onChange={(e) => setQ(e.target.value)}
            style={{ width: 280, padding: "8px", borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <FilterBox title="สาขาวิชา" items={Object.fromEntries(departments.map(d => [d, d]))} values={filterMajor} onChange={setFilterMajor} />
          <button className="btn" style={{ ...saveBtn, marginLeft: "auto" }} onClick={() => { setQ(""); setFilterMajor([]); }}>
            ล้างตัวกรอง
          </button>
        </div>
      </section>

      {/* ─── Bulk action bar ─── */}
      {!selectMode ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button className="btn" style={ghostBtn} onClick={() => setSelectMode(true)}>
            ☑️ เลือกหลายคน
          </button>
        </div>
      ) : (
        <div style={{
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 20,
          padding: "10px 16px", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#9a3412" }}>
            เลือกแล้ว {selectedIds.size} คน
          </span>
          {/* อยู่ในแถบนี้แทนหัวตาราง เพราะจอ ≤1024px ซ่อน thead ทั้งแถว (S_Theme.tsx) */}
          <button className="btn" style={ghostBtn} onClick={toggleSelectAll} disabled={bulkDeleting || shownItems.length === 0}>
            {isAllShownSelected ? "ยกเลิกเลือกทั้งหมด" : `เลือกทั้งหมด (${shownItems.length})`}
          </button>
          <button
            className="btn"
            style={{ ...ghostBtn, color: "#ef4444", borderColor: "#ef4444", opacity: bulkDeleting || selectedIds.size === 0 ? 0.6 : 1, cursor: bulkDeleting || selectedIds.size === 0 ? "not-allowed" : "pointer" }}
            onClick={() => setConfirmBulkDel(true)}
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

      {/* ─── Table ─── */}
      <section style={{ ...card, marginTop: 12, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", color: "#64748b", fontSize: 13 }}>
          ทั้งหมด {total} คน
        </div>
        <table width="100%" className="responsive-table" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {selectMode && (
                <th style={{ ...th, width: 36 }}>
                  <input
                    type="checkbox"
                    checked={isAllShownSelected}
                    ref={el => { if (el) el.indeterminate = !isAllShownSelected && shownItems.some(t => selectedIds.has(t.id)); }}
                    onChange={toggleSelectAll}
                    aria-label="เลือกทั้งหมด"
                  />
                </th>
              )}
              {["ชื่อ-นามสกุล", "อีเมล (Username)", "เบอร์โทร", "สาขาวิชา", "จัดการ"].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={selectMode ? 6 : 5} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>ไม่พบข้อมูลอาจารย์</td></tr>
            ) : shownItems.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9", background: selectedIds.has(t.id) ? "#fff7ed" : undefined }}>
                {selectMode && (
                  <td style={td}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleSelectOne(t.id)}
                      aria-label={`เลือก ${t.firstName} ${t.lastName}`}
                    />
                  </td>
                )}
                <td style={td} data-label="ชื่อ-นามสกุล">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <IcUser width={16} height={16} style={{ color: "#0074B7" }} />
                    </div>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>{[t.prefix, t.firstName, t.lastName].filter(Boolean).join(' ')}</span>
                    {t.isCoopTeacher && (
                      <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginLeft: 6 }}>
                        ประจำวิชาสหกิจ
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ ...td, color: "#0369a1" }} data-label="อีเมล (Username)">{t.email}</td>
                <td style={td} data-label="เบอร์โทร">{t.phone || "-"}</td>
                <td style={td} data-label="สาขาวิชา">
                  <span style={{ padding: "4px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: t.major ? "#f0f9ff" : "#f1f5f9", color: t.major ? "#0369a1" : "#64748b" }}>
                    {t.major || "-"}
                  </span>
                </td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={ghostBtn} onClick={() => setEditModal(t)}>
                      ✏️ แก้ไข
                    </button>
                    <button style={{ ...ghostBtn, color: "#7c3aed", borderColor: "#7c3aed" }} onClick={() => { setPwModal(t); setNewPassword(""); }}>
                      🔑 รหัสผ่าน
                    </button>
                    <button style={{ ...ghostBtn, color: "#ef4444", borderColor: "#ef4444" }} onClick={() => setConfirmDel(t)}>
                      🗑️ ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <LoadMoreFooter shownCount={shownItems.length} total={total} hasMore={hasMore} onShowMore={showMore} sentinelRef={sentinelRef} itemLabel="คน" />

      {/* ─── Edit Modal ─── */}
      {editModal && (
        <TeacherFormModal
          title="แก้ไขข้อมูลอาจารย์"
          data={editModal}
          prefixOptions={prefixOptions}
          departments={departments}
          saving={saving}
          onClose={() => setEditModal(null)}
          onSave={handleUpdate}
          allowEmailEdit
        />
      )}

      {/* ─── Create Modal ─── */}
      {createModal && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>➕ เพิ่มอาจารย์ใหม่</h2>
              <button onClick={() => { setCreateModal(false); setCreatePassword(""); }} style={closeBtn}>✕</button>
            </div>
            {/* form แยก + new-password: บัญชีของอาจารย์คนใหม่ ไม่ให้ password manager เติมบัญชีของเจ้าหน้าที่ที่ login อยู่ */}
            <form autoComplete="off" onSubmit={e => { e.preventDefault(); handleCreate(); }}>
              <TeacherFields form={createForm} setForm={setCreateForm} prefixOptions={prefixOptions} departments={departments} allowEmailEdit />
              <div style={{ marginTop: 16 }}>
                <label style={labelStyle}>รหัสผ่าน <span style={{ color: "red" }}>*</span></label>
                <input
                  type="password"
                  name="new-password"
                  autoComplete="new-password"
                  style={inputStyle}
                  value={createPassword}
                  onChange={e => setCreatePassword(e.target.value)}
                  placeholder="อย่างน้อย 8 ตัว มีตัวใหญ่ ตัวเล็ก ตัวเลข อักขระพิเศษ"
                />
              </div>
              <div style={modalFooter}>
                <button type="button" style={ghostBtn} onClick={() => { setCreateModal(false); setCreatePassword(""); }}>ยกเลิก</button>
                <button type="submit" style={{ ...saveBtn, display: "flex", alignItems: "center", gap: 8 }} disabled={saving}>
                  {saving ? <><Spinner size={16} color="#fff" /> กำลังบันทึก...</> : "✅ เพิ่มอาจารย์"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Reset Password Modal ─── */}
      {pwModal && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>🔑 รีเซ็ตรหัสผ่าน</h2>
              <button onClick={() => setPwModal(null)} style={closeBtn}>✕</button>
            </div>
            <div style={{ marginBottom: 16, padding: 12, background: "#f8fafc", borderRadius: 8, fontSize: 14, color: "#475569" }}>
              อาจารย์: <strong>{pwModal.firstName} {pwModal.lastName}</strong><br />
              อีเมล: <strong>{pwModal.email}</strong><br />
              {/* อาจารย์ลืมรหัสผ่าน — ดูรหัสปัจจุบันได้ ไม่ต้องรีเซ็ต (ถูกบันทึกใน log) */}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                รหัสผ่านปัจจุบัน: <PasswordReveal key={pwModal.id} endpoint={`/api/admin/teachers/${pwModal.id}/password/reveal`} />
              </span>
            </div>
            {/* ฟอร์มเปลี่ยนรหัสผ่านของ "อีกคน": ครอบด้วย form ของตัวเอง + ช่อง username (ซ่อน) = อีเมลอาจารย์คนนี้
                + new-password — ไม่งั้น password manager มองเป็นฟอร์ม login แล้วเติมบัญชีของคนที่กดลงช่องค้นหา */}
            <form autoComplete="off" onSubmit={e => { e.preventDefault(); handleResetPassword(); }}>
              <input type="text" name="username" autoComplete="username" value={pwModal.email || ""} readOnly hidden />
              <label style={labelStyle}>รหัสผ่านใหม่ <span style={{ color: "red" }}>*</span></label>
              <input
                type="password"
                name="new-password"
                autoComplete="new-password"
                style={inputStyle}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="ขั้นต่ำ 8 ตัว มีตัวใหญ่ ตัวเล็ก ตัวเลข อักขระพิเศษ"
                autoFocus
              />
              <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
                💡 ต้องมีตัวอักษรพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และอักขระพิเศษ เช่น !@#$%
              </div>
              <div style={modalFooter}>
                <button type="button" style={ghostBtn} onClick={() => setPwModal(null)}>ยกเลิก</button>
                <button type="submit" style={{ ...saveBtn, background: "#7c3aed", display: "flex", alignItems: "center", gap: 8 }} disabled={saving}>
                  {saving ? <><Spinner size={16} color="#fff" /> กำลังบันทึก...</> : "🔑 บันทึกรหัสผ่าน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

/* =========================
   TeacherFormModal
========================= */
function TeacherFormModal({ title, data, prefixOptions, departments, saving, onClose, onSave, allowEmailEdit }: {
  title: string;
  data: Teacher;
  prefixOptions: string[];
  departments: string[];
  saving: boolean;
  onClose: () => void;
  onSave: (d: Teacher) => void;
  allowEmailEdit?: boolean;
}) {
  const [form, setForm] = useState<Teacher>(data);
  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <TeacherFields form={form} setForm={setForm} prefixOptions={prefixOptions} departments={departments} allowEmailEdit={allowEmailEdit} />
        <div style={modalFooter}>
          <button style={ghostBtn} onClick={onClose}>ยกเลิก</button>
          <button style={{ ...saveBtn, display: "flex", alignItems: "center", gap: 8 }} onClick={() => onSave(form)} disabled={saving}>
            {saving ? <><Spinner size={16} color="#fff" /> กำลังบันทึก...</> : <><IcSave width={16} height={16} /> บันทึกข้อมูล</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   TeacherFields — form fields (shared)
========================= */
function TeacherFields({ form, setForm, prefixOptions, departments, allowEmailEdit }: {
  form: any;
  setForm: (f: any) => void;
  prefixOptions: string[];
  departments: string[];
  allowEmailEdit?: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <label style={labelStyle}>ชื่อ *</label>
        <input style={inputStyle} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="ชื่อจริง" />
      </div>
      <div>
        <label style={labelStyle}>นามสกุล *</label>
        <input style={inputStyle} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="นามสกุล" />
      </div>
      <div style={{ gridColumn: "span 2" }}>
        <label style={labelStyle}>อีเมล (ใช้เป็น Username) *</label>
        <input
          style={{ ...inputStyle, ...(!allowEmailEdit ? { background: "#f1f5f9", color: "#94a3b8" } : {}) }}
          value={form.email}
          disabled={!allowEmailEdit}
          onChange={e => setForm({ ...form, email: e.target.value })}
          placeholder="example@kku.ac.th"
          type="email"
          name="teacher-email"
          autoComplete="off"
        />
      </div>
      <div>
        <label style={labelStyle}>คำนำหน้า *</label>
        <select style={{ ...inputStyle, cursor: "pointer" }} value={form.prefix ?? ""} onChange={e => setForm({ ...form, prefix: e.target.value })}>
          <option value="">-</option>
          {prefixOptions.map((p: string) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>เบอร์โทร</label>
        <input style={inputStyle} value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0XX-XXXXXXX" />
      </div>
      <div style={{ gridColumn: "span 2" }}>
        <label style={labelStyle}>สาขาวิชา</label>
        <select style={{ ...inputStyle, cursor: "pointer" }} value={form.major || ""} onChange={e => setForm({ ...form, major: e.target.value })}>
          <option value="">-- เลือกสาขาวิชา --</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      {/* อาจารย์ประจำวิชาสหกิจ */}
      <div style={{ gridColumn: "span 2", display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #f1f5f9', marginTop: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>อาจารย์ประจำวิชาสหกิจ</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>เห็นนักศึกษาทั้งหมดและจัดการนิเทศได้</div>
        </div>
        <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.isCoopTeacher ?? false}
            onChange={e => setForm({ ...form, isCoopTeacher: e.target.checked })}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span style={{
            position: 'absolute', inset: 0, borderRadius: 24,
            background: form.isCoopTeacher ? '#2563eb' : '#cbd5e1',
            transition: '0.2s',
          }}>
            <span style={{
              position: 'absolute', top: 2, left: form.isCoopTeacher ? 22 : 2,
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              transition: '0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </span>
        </label>
      </div>
    </div>
  );
}

/* =========================
   FilterBox
========================= */
function FilterBox({ title, items, values, onChange }: { title: string; items: Record<string, string>; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "#475569", marginBottom: 6, fontWeight: 600 }}>{title}</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {Object.entries(items).map(([k, v]) => (
          <label key={k} style={{ fontSize: 13, cursor: "pointer", display: "flex", gap: 6, alignItems: "center", color: "#334155" }}>
            <input type="checkbox" checked={values.includes(k)} onChange={(e) => onChange(e.target.checked ? [...values, k] : values.filter(x => x !== k))} style={{ accentColor: "#0074B7", width: 16, height: 16 }} />
            {v}
          </label>
        ))}
      </div>
    </div>
  );
}

/* =========================
   Styles
========================= */
import React from "react";
const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e5e7eb" };
const filterRow: React.CSSProperties = { display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" };
const th: React.CSSProperties = { textAlign: "left", fontSize: 14, fontWeight: 700, padding: "12px 16px", color: "#475569" };
const td: React.CSSProperties = { padding: "14px 16px", fontSize: 14, color: "#334155", verticalAlign: "middle" };
const ghostBtn: React.CSSProperties = { background: "#fff", color: "#0074B7", border: "1px solid rgba(10,132,255,.25)", height: 34, borderRadius: 8, padding: "0 12px", cursor: "pointer", fontWeight: 600, fontSize: 13 };
const saveBtn: React.CSSProperties = { background: "#0074B7", color: "#fff", border: "none", height: 38, borderRadius: 8, padding: "0 16px", cursor: "pointer", fontWeight: 600, fontSize: 14 };
const addBtn: React.CSSProperties = { background: "#10b981", color: "#fff", border: "none", height: 38, borderRadius: 10, padding: "0 20px", cursor: "pointer", fontWeight: 700, fontSize: 14 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" };
const modal: React.CSSProperties = { background: "#fff", borderRadius: 20, padding: 32, width: 600, maxWidth: "95%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" };
const modalFooter: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 28 };
const closeBtn: React.CSSProperties = { background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 15, boxSizing: "border-box", fontFamily: "inherit" };
