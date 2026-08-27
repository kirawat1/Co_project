import { useState, useEffect, useRef } from "react";
import { fmtDate } from '../utils/dateFormat';

interface Department {
  id: string;
  major: string;
  nameTh: string | null;
  updatedAt: string;
}

const card: React.CSSProperties = {
  background: "var(--card-bg)",
  borderRadius: 16,
  padding: 32,
  border: "1px solid var(--border)",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
};

const btn = (color: string, bg: string, border = "transparent"): React.CSSProperties => ({
  padding: "6px 14px",
  borderRadius: 8,
  border: `1px solid ${border}`,
  background: bg,
  color,
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  transition: "opacity .15s",
});

const input: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  background: "var(--card-bg)",
  color: "var(--text)",
};

export default function A_CriteriaPage() {
  const token = localStorage.getItem("coop.token");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNameTh, setNewNameTh] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNameTh, setEditNameTh] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchDepartments = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/criteria", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) setDepartments(data.criteria);
      else setError(data.message || "โหลดข้อมูลล้มเหลว");
    } catch {
      setError("เชื่อมต่อ server ไม่ได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDepartments(); }, []);

  useEffect(() => {
    if (showAddForm) setTimeout(() => addInputRef.current?.focus(), 50);
  }, [showAddForm]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAddSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/criteria", {
        method: "POST",
        headers,
        body: JSON.stringify({ major: newName.trim(), nameTh: newNameTh.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewName("");
        setNewNameTh("");
        setShowAddForm(false);
        fetchDepartments();
      } else {
        setError(data.message || "เพิ่มสาขาวิชาล้มเหลว");
      }
    } catch {
      setError("เกิดข้อผิดพลาด");
    } finally {
      setAddSaving(false);
    }
  };

  const startEdit = (dept: Department) => {
    setEditId(dept.id);
    setEditName(dept.major);
    setEditNameTh(dept.nameTh ?? "");
    setError("");
  };

  const handleEdit = async () => {
    if (!editId || !editName.trim()) return;
    setEditSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/criteria/${editId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ major: editName.trim(), nameTh: editNameTh.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setEditId(null);
        setEditName("");
        setEditNameTh("");
        fetchDepartments();
      } else {
        setError(data.message || "แก้ไขล้มเหลว");
      }
    } catch {
      setError("เกิดข้อผิดพลาด");
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = (dept: Department) => {
    setDeleteId(dept.id);
    setDeleteConfirmName(dept.major);
    setError("");
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/admin/criteria/${deleteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setDeleteId(null);
        setDeleteConfirmName("");
        fetchDepartments();
      } else {
        setError(data.message || "ลบล้มเหลว");
      }
    } catch {
      setError("เกิดข้อผิดพลาด");
    }
  };

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <div style={card}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text)" }}>
              🏛️ จัดการสาขาวิชา
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              เพิ่ม แก้ไข หรือลบสาขาวิชา · <strong>รหัสสาขา</strong> = ตัวย่อในระบบ (cs, ai) · <strong>ชื่อภาษาไทย</strong> = ชื่อเต็ม
            </p>
          </div>
          {!showAddForm && (
            <button style={btn("#fff", "#0ea5e9")} onClick={() => setShowAddForm(true)}>
              + เพิ่มสาขาวิชา
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.25)", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Add Form */}
        {showAddForm && (
          <div style={{ marginBottom: 20, padding: 18, background: "var(--surface2)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ minWidth: 140 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", marginBottom: 4 }}>รหัสสาขา</div>
                <input
                  ref={addInputRef}
                  style={input}
                  placeholder="เช่น CS, IT, AI"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Escape") { setShowAddForm(false); setNewName(""); setNewNameTh(""); } }}
                  disabled={addSaving}
                />
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", marginBottom: 4 }}>ชื่อภาษาไทย</div>
                <input
                  style={input}
                  placeholder="เช่น วิทยาการคอมพิวเตอร์"
                  value={newNameTh}
                  onChange={e => setNewNameTh(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setShowAddForm(false); setNewName(""); setNewNameTh(""); } }}
                  disabled={addSaving}
                />
              </div>
              <button
                style={btn("#fff", addSaving ? "#94a3b8" : "#22c55e")}
                onClick={handleAdd}
                disabled={addSaving || !newName.trim()}
              >
                {addSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button
                style={btn("#64748b", "#f1f5f9", "#e2e8f0")}
                onClick={() => { setShowAddForm(false); setNewName(""); setNewNameTh(""); setError(""); }}
                disabled={addSaving}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* Department Cards */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>กำลังโหลด...</div>
        ) : departments.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
            ยังไม่มีสาขาวิชา — กดปุ่ม "+ เพิ่มสาขาวิชา" เพื่อเพิ่ม
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {departments.map(dept => {
              const noCode = dept.major === dept.nameTh || !dept.nameTh;
              return (
              <div key={dept.id} style={{
                background: editId === dept.id ? "var(--surface2)" : "var(--surface2)",
                border: `1px solid ${editId === dept.id ? "rgba(14,165,233,.4)" : "var(--border)"}`,
                borderRadius: 14,
                padding: "20px 22px",
                minWidth: 180,
                flex: "1 1 180px",
                maxWidth: 260,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                transition: "box-shadow .15s",
              }}>
                {editId === dept.id ? (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 3 }}>ชื่อภาษาไทย (เต็ม)</div>
                        <input
                          style={input}
                          value={editNameTh}
                          onChange={e => setEditNameTh(e.target.value)}
                          onKeyDown={e => { if (e.key === "Escape") { setEditId(null); setError(""); } }}
                          autoFocus
                          disabled={editSaving}
                          placeholder="วิทยาการคอมพิวเตอร์"
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 3 }}>รหัสสาขา (ตัวย่อ)</div>
                        <input
                          style={{ ...input, fontWeight: 700 }}
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleEdit(); if (e.key === "Escape") { setEditId(null); setError(""); } }}
                          disabled={editSaving}
                          placeholder="cs"
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ ...btn("#fff", editSaving ? "#94a3b8" : "#22c55e"), flex: 1 }} onClick={handleEdit} disabled={editSaving || !editName.trim()}>
                        {editSaving ? "..." : "บันทึก"}
                      </button>
                      <button style={btn("var(--text-muted)", "var(--border)", "var(--border)")} onClick={() => { setEditId(null); setEditNameTh(""); setError(""); }} disabled={editSaving}>
                        ยกเลิก
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      {noCode && (
                        <div style={{ fontSize: 11, color: "#b45309", background: "rgba(234,179,8,.12)", border: "1px solid rgba(234,179,8,.3)", borderRadius: 6, padding: "3px 8px", marginBottom: 8, display: "inline-block" }}>
                          ⚠️ ยังไม่มีรหัส — แก้ไขเพื่อตั้งรหัสสาขา
                        </div>
                      )}
                      <div style={{ fontSize: dept.nameTh ? 15 : 22, fontWeight: 800, color: "var(--text)", lineHeight: 1.3 }}>
                        {dept.nameTh || dept.major}
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <span style={{
                          display: "inline-block", fontSize: 11, fontWeight: 700,
                          background: noCode ? "rgba(234,179,8,.12)" : "rgba(14,165,233,.12)",
                          color: noCode ? "#b45309" : "#0369a1",
                          border: `1px solid ${noCode ? "rgba(234,179,8,.3)" : "rgba(14,165,233,.3)"}`,
                          borderRadius: 6, padding: "2px 8px", letterSpacing: 0.5,
                        }}>
                          {dept.major}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 6 }}>
                        อัปเดต {fmtDate(dept.updatedAt)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ ...btn("#0369a1", "rgba(14,165,233,.1)"), flex: 1 }} onClick={() => startEdit(dept)}>แก้ไข</button>
                      <button style={{ ...btn("#dc2626", "rgba(220,38,38,.08)"), flex: 1 }} onClick={() => confirmDelete(dept)}>ลบ</button>
                    </div>
                  </>
                )}
              </div>
            );})}
          </div>
        )}

        {/* Curriculum note */}
        <div style={{ marginTop: 28, padding: 16, background: "var(--surface2)", borderRadius: 12, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            📋 หลักสูตรการศึกษา
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[{ code: "normal", label: "ภาคปกติ" }, { code: "special", label: "ภาคพิเศษ" }].map(({ code, label }) => (
              <div key={code} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 20px", minWidth: 140 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#0ea5e9", textTransform: "uppercase", letterSpacing: 1 }}>หลักสูตร</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text)", marginTop: 2 }}>{label}</div>
                <div style={{ fontSize: 11, color: "var(--text-sub)", marginTop: 1 }}>รหัส: {code}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
          onClick={e => { if (e.target === e.currentTarget) { setDeleteId(null); setError(""); } }}>
          <div style={{ background: "var(--card-bg)", borderRadius: 16, padding: 28, maxWidth: 380, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 20, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: "var(--text)" }}>ยืนยันการลบสาขาวิชา</h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--text-muted)" }}>
              ต้องการลบสาขาวิชา <strong style={{ color: "#dc2626" }}>"{deleteConfirmName}"</strong> ออกจากระบบ?
              <br />นักศึกษาที่เลือกสาขานี้ไว้จะยังคงข้อมูลเดิม แต่จะไม่สามารถเลือกสาขานี้ใหม่ได้
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={btn("#64748b", "#f1f5f9", "#e2e8f0")} onClick={() => { setDeleteId(null); setError(""); }}>ยกเลิก</button>
              <button style={btn("#fff", "#dc2626")} onClick={handleDelete}>ยืนยันลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
