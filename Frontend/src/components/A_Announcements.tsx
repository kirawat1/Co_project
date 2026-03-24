import { useState, useEffect } from "react";
import axios from "axios";
import type { CSSProperties } from "react";

// --- Types ---
interface CoopPeriod {
  id: number;
  academicYear: string;
  semester: string;
  isActive: boolean;
}

type AnnouncementAttachment = {
  id?: string;
  type: "link" | "file" | "image";
  name: string;
  url: string;
  rawFile?: File;
};

type Announcement = {
  id: string;
  title: string;
  body?: string;
  date: string;
  year: string; // เก็บเป็น string format "semester/academicYear"
  attachments: AnnouncementAttachment[];
};

export default function A_Announcements() {
  const [periods, setPeriods] = useState<CoopPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(""); // format: "1/2569"
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attachments, setAttachments] = useState<AnnouncementAttachment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const token = localStorage.getItem("coop.token");

  /* ================= 1. LOAD PERIODS & SET ACTIVE ================= */
  const fetchPeriods = async () => {
    try {
      // ดึงรอบปีการศึกษาทั้งหมด (ใช้ Endpoint ของเจ้าหน้าที่)
      const res = await axios.get("http://localhost:5000/api/admin/supervision-periods", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.periods) {
        const periodList: CoopPeriod[] = res.data.periods;
        setPeriods(periodList);

        // 🟢 ค้นหารอบที่ isActive: true เพื่อตั้งค่าเริ่มต้น
        const active = periodList.find(p => p.isActive);
        if (active) {
          setSelectedPeriod(`${active.semester}/${active.academicYear}`);
        } else if (periodList.length > 0) {
          // ถ้าไม่มีอันไหน isActive ให้เอาอันแรกสุด
          setSelectedPeriod(`${periodList[0].semester}/${periodList[0].academicYear}`);
        }
      }
    } catch (err) {
      console.error("Failed to load periods", err);
    }
  };

  /* ================= 2. LOAD ANNOUNCEMENTS ================= */
  const fetchAnnouncements = async () => {
    if (!selectedPeriod) return;
    setLoading(true);
    try {
      // ส่ง query parameter 'year' ในรูปแบบ "1/2569"
      const res = await axios.get(`http://localhost:5000/api/announcements?year=${selectedPeriod}`);
      if (res.data.ok) {
        setItems(
          res.data.list.map((a: any) => ({
            ...a,
            attachments: [
              ...(a.files?.map((f: any) => ({
                id: f.id,
                type: f.mime?.startsWith("image/") ? "image" : "file",
                name: f.name,
                url: `http://localhost:5000/uploads/${f.path}`,
              })) || []),
              ...(a.linkUrl ? JSON.parse(a.linkUrl).map((l: string) => ({
                type: "link",
                name: l,
                url: l,
              })) : [])
            ]
          }))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  function addFile(file: File, type: "file" | "image") {
    setAttachments(prev => [
      ...prev,
      {
        type,
        name: file.name,
        url: URL.createObjectURL(file),
        rawFile: file
      }
    ]);
  }

  // 1. ฟังก์ชันสำหรับเพิ่มลิงก์
  function addLink() {
    const url = prompt("กรอก URL (เช่น https://google.com)");
    if (!url) return;
    setAttachments(prev => [...prev, { type: "link", name: url, url }]);
  }

  // 2. ฟังก์ชันสำหรับลบไฟล์แนบ (ทั้งลิงก์และไฟล์)
  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }
  // รันครั้งแรกเพื่อโหลด Periods
  useEffect(() => { fetchPeriods(); }, []);

  // เมื่อเลือกปีเปลี่ยน หรือโหลด Periods เสร็จ ให้ดึงประกาศ
  useEffect(() => {
    if (selectedPeriod) fetchAnnouncements();
  }, [selectedPeriod]);

  /* ================= ACTIONS ================= */
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert("กรุณากรอกหัวข้อประกาศ");

    const form = new FormData();
    if (editingId) form.append("id", editingId);
    form.append("title", title);
    form.append("body", body);
    form.append("date", date);
    form.append("year", selectedPeriod); // บันทึกเป็น "1/2569"

    attachments.forEach(att => {
      if ((att.type === "file" || att.type === "image") && att.rawFile) {
        form.append("attachments", att.rawFile);
      }
    });

    const links = attachments.filter(a => a.type === "link").map(a => a.url);
    if (links.length) form.append("linkUrls", JSON.stringify(links));

    const keepFileIds = attachments.filter(a => a.id).map(a => a.id!);
    if (keepFileIds.length) form.append("keepFileIds", JSON.stringify(keepFileIds));

    try {
      await axios.post("http://localhost:5000/api/announcements", form);
      resetForm();
      fetchAnnouncements();
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  const resetForm = () => {
    setTitle(""); setBody(""); setDate(new Date().toISOString().slice(0, 10));
    setAttachments([]); setEditingId(null); setModalOpen(false);
  };

  const openEditModal = (a: Announcement) => {
    setEditingId(a.id);
    setTitle(a.title);
    setBody(a.body || "");
    setDate(a.date);
    setAttachments(a.attachments || []);
    setModalOpen(true);
  };

  const remove = async (id: string) => {
    if (!confirm("ลบประกาศนี้? ข้อมูลจะไม่สามารถกู้คืนได้")) return;
    try {
      await axios.delete(`http://localhost:5000/api/announcements/${id}`);
      fetchAnnouncements();
    } catch (err) { alert("ลบไม่สำเร็จ"); }
  };

  return (
    <div style={container}>
      <style>{CUSTOM_CSS}</style>

      {/* TOP HEADER */}
      <header style={headerSection}>
        <div>
          <h1 style={titleStyle}>📢 จัดการประกาศ</h1>
          <p style={subtitleStyle}>ข้อมูลปัจจุบัน: ภาคเรียนที่ {selectedPeriod}</p>
        </div>
        <div style={headerActions}>
          {/* Dropdown เลือกปีแบบ Semester/AcademicYear */}
          <select
            style={selectYear}
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
          >
            {periods.map(p => {
              const val = `${p.semester}/${p.academicYear}`;
              return (
                <option key={p.id} value={val}>
                  เทอม {val} {p.isActive ? " ⭐ (รอบปัจจุบัน)" : ""}
                </option>
              );
            })}
          </select>
          <button style={btnPrimary} onClick={() => { resetForm(); setModalOpen(true); }}>
            + สร้างประกาศใหม่
          </button>
        </div>
      </header>

      {/* CONTENT LIST */}
      <main style={mainList}>
        {loading ? (
          <div style={emptyState}>กำลังโหลดประกาศ...</div>
        ) : items.length === 0 ? (
          <div style={emptyState}>📭 ยังไม่มีประกาศในเทอม {selectedPeriod}</div>
        ) : (
          items.map(a => (
            <article key={a.id} style={annCard} className="ann-card">
              <div style={annContent}>
                <div style={annMeta}>
                  <span style={badgeYear}>เทอม {a.year}</span>
                  <span style={textMuted}>📅 {new Date(a.date).toLocaleDateString('th-TH', { dateStyle: 'medium' })}</span>
                </div>
                <h3 style={annTitle}>{a.title}</h3>
                {a.body && <p style={annBody}>{a.body.length > 150 ? a.body.substring(0, 150) + "..." : a.body}</p>}

                {a.attachments.length > 0 && (
                  <div style={chipContainer}>
                    {a.attachments.map((at, i) => (
                      <div key={i} style={chip} onClick={() => at.type === 'image' ? setPreviewUrl(at.url) : window.open(at.url, '_blank')}>
                        {at.type === "link" ? "🔗" : at.type === "image" ? "🖼️" : "📄"}
                        <span style={chipText}>{at.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={annActions}>
                <button style={btnIconEdit} onClick={() => openEditModal(a)}>แก้ไข</button>
                <button style={btnIconDel} onClick={() => remove(a.id)}>ลบ</button>
              </div>
            </article>
          ))
        )}
      </main>

      {/* MODAL: CREATE/EDIT */}
      {modalOpen && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={modalHeader}>
              <h2 style={{ margin: 0 }}>{editingId ? "แก้ไขประกาศ" : "สร้างประกาศใหม่"}</h2>
              <button style={btnClose} onClick={() => setModalOpen(false)}>&times;</button>
            </div>

            <form onSubmit={save} style={formStyle}>
              <div style={inputGroup}>
                <label style={labelStyle}>หัวข้อประกาศ</label>
                <input className="custom-input" placeholder="หัวข้อข่าวสาร..." value={title} onChange={e => setTitle(e.target.value)} required />
              </div>

              <div style={inputGroup}>
                <label style={labelStyle}>เนื้อหารายละเอียด</label>
                <textarea className="custom-input" rows={5} placeholder="รายละเอียด..." value={body} onChange={e => setBody(e.target.value)} />
              </div>

              <div style={rowGrid}>
                <div style={inputGroup}>
                  <label style={labelStyle}>วันที่ประกาศ</label>
                  <input type="date" className="custom-input" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div style={inputGroup}>
                  <label style={labelStyle}>สำหรับปีการศึกษา</label>
                  <select className="custom-input" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
                    {periods.map(p => (
                      <option key={p.id} value={`${p.semester}/${p.academicYear}`}>
                        {p.semester}/{p.academicYear}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ส่วนจัดการไฟล์แนบเดิมคงไว้... */}
              <div style={attachmentSection}>
                <label style={labelStyle}>ไฟล์แนบและลิงก์</label>
                <div style={attachBtnRow}>
                  <button type="button" style={btnSmall} onClick={addLink}>🔗 เพิ่มลิงก์</button>
                  <label style={btnSmallLabel}>
                    📄 ไฟล์
                    <input
                      type="file"
                      hidden
                      multiple
                      onChange={e => e.target.files && Array.from(e.target.files).forEach(f => addFile(f, "file"))}
                    />
                  </label>

                  <label style={btnSmallLabel}>
                    🖼️ รูปภาพ
                    <input
                      type="file"
                      hidden
                      multiple
                      accept="image/*"
                      onChange={e => e.target.files && Array.from(e.target.files).forEach(f => addFile(f, "image"))}
                    />
                  </label>
                </div>
                {attachments.length > 0 && (
                  <div style={formAttachmentList}>
                    {attachments.map((a, i) => (
                      <div key={i} style={formAttachItem}>
                        <span style={attachItemName}>{a.type === 'link' ? '🔗' : '📄'} {a.name}</span>
                        <button type="button" style={btnRemove} onClick={() => removeAttachment(i)}>ลบ</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={modalFooter}>
                <button type="button" style={btnSecondary} onClick={() => setModalOpen(false)}>ยกเลิก</button>
                <button type="submit" style={btnPrimary}>บันทึกประกาศ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMAGE PREVIEW เผื่อดูรูปใหญ่ */}
      {previewUrl && (
        <div style={previewOverlay} onClick={() => setPreviewUrl(null)}>
          <img src={previewUrl} alt="preview" style={previewImage} />
        </div>
      )}
    </div>
  );
}

/* ================= STYLES ================= */
// ใช้ชุด Styles เดิมที่ผมปรับ UX/UI ให้คุณล่าสุดได้เลยครับ
const container: CSSProperties = { padding: "40px", marginLeft: "65px", backgroundColor: "#f8fafc", minHeight: "100vh" };
const headerSection: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" };
const titleStyle: CSSProperties = { fontSize: "28px", fontWeight: 800, color: "#1e293b", margin: 0 };
const subtitleStyle: CSSProperties = { color: "#64748b", marginTop: "4px", fontSize: "14px" };
const headerActions: CSSProperties = { display: "flex", gap: "12px", alignItems: "center" };
const selectYear: CSSProperties = { padding: "10px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", backgroundColor: "white", fontSize: "14px", fontWeight: 600, outline: "none", cursor: "pointer" };
const mainList: CSSProperties = { display: "flex", flexDirection: "column", gap: "16px" };
const annCard: CSSProperties = { backgroundColor: "white", borderRadius: "16px", padding: "24px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", transition: "0.2s" };
const annContent: CSSProperties = { flex: 1 };
const annMeta: CSSProperties = { display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" };
const badgeYear: CSSProperties = { backgroundColor: "#eff6ff", color: "#2563eb", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 };
const textMuted: CSSProperties = { color: "#64748b", fontSize: "13px" };
const annTitle: CSSProperties = { fontSize: "18px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" };
const annBody: CSSProperties = { color: "#475569", fontSize: "14px", lineHeight: "1.6", margin: "0 0 16px 0" };
const chipContainer: CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap" };
const chip: CSSProperties = { backgroundColor: "#f1f5f9", padding: "6px 12px", borderRadius: "20px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", border: "1px solid #e2e8f0" };
const chipText: CSSProperties = { fontSize: "12px", color: "#334155", fontWeight: 500 };
const annActions: CSSProperties = { display: "flex", flexDirection: "column", gap: "8px", marginLeft: "20px" };
const btnIconEdit: CSSProperties = { padding: "8px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "white", color: "#2563eb", fontWeight: 600, cursor: "pointer", fontSize: "13px" };
const btnIconDel: CSSProperties = { padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: "#fef2f2", color: "#dc2626", fontWeight: 600, cursor: "pointer", fontSize: "13px" };
const modalOverlay: CSSProperties = { position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(4px)" };
const modalCard: CSSProperties = { backgroundColor: "white", borderRadius: "20px", width: "100%", maxWidth: "650px", maxHeight: "90vh", overflowY: "auto" };
const modalHeader: CSSProperties = { padding: "24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" };
const btnClose: CSSProperties = { background: "none", border: "none", fontSize: "24px", color: "#64748b", cursor: "pointer" };
const formStyle: CSSProperties = { padding: "24px" };
const inputGroup: CSSProperties = { marginBottom: "20px" };
const labelStyle: CSSProperties = { fontSize: "14px", fontWeight: 600, color: "#334155", marginBottom: "8px", display: "block" };
const rowGrid: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" };
const attachmentSection: CSSProperties = { backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px dashed #cbd5e1", marginBottom: "24px" };
const attachBtnRow: CSSProperties = { display: "flex", gap: "10px", marginBottom: "12px" };
const btnSmall: CSSProperties = { padding: "6px 12px", fontSize: "12px", borderRadius: "6px", border: "1px solid #e2e8f0", backgroundColor: "white", cursor: "pointer", fontWeight: 600 };
const btnSmallLabel: CSSProperties = { padding: "6px 12px", fontSize: "12px", borderRadius: "6px", border: "1px solid #e2e8f0", backgroundColor: "white", cursor: "pointer", fontWeight: 600 };
const formAttachmentList: CSSProperties = { display: "flex", flexDirection: "column", gap: "6px" };
const formAttachItem: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: "white", borderRadius: "8px", border: "1px solid #e2e8f0" };
const attachItemName: CSSProperties = { fontSize: "12px", color: "#475569" };
const btnRemove: CSSProperties = { background: "none", border: "none", color: "#ef4444", fontSize: "12px", fontWeight: 600, cursor: "pointer" };
const modalFooter: CSSProperties = { display: "flex", justifyContent: "flex-end", gap: "12px" };
const btnPrimary: CSSProperties = { padding: "12px 24px", backgroundColor: "#2563eb", color: "white", borderRadius: "10px", border: "none", fontWeight: 700, cursor: "pointer", fontSize: "14px" };
const btnSecondary: CSSProperties = { padding: "12px 24px", backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: "10px", color: "#475569", fontWeight: 700, cursor: "pointer", fontSize: "14px" };
const emptyState: CSSProperties = { textAlign: "center", padding: "80px 0", color: "#94a3b8", fontSize: "16px", backgroundColor: "white", borderRadius: "16px", border: "1px dashed #e2e8f0" };
const previewOverlay: CSSProperties = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100 };
const previewImage: CSSProperties = { maxWidth: "90%", maxHeight: "80%", borderRadius: "8px" };

const CUSTOM_CSS = `
  .custom-input { width: 100%; padding: 12px 16px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 14px; outline: none; box-sizing: border-box; transition: 0.2s; }
  .custom-input:focus { border-color: #2563eb; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }
  .ann-card:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
`;