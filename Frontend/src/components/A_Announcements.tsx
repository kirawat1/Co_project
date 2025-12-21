/* ============================ */
import { useState, useEffect } from "react";
import axios from "axios";
import type { CSSProperties } from "react";

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
  year: string;
  attachments: AnnouncementAttachment[];
};

export default function A_Announcements() {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [items, setItems] = useState<Announcement[]>([]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attachments, setAttachments] = useState<AnnouncementAttachment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // preview รูป

  /* ================= LOAD DATA ================= */
  const fetchAnnouncements = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/announcements?year=${year}`);
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
    }
  };

  useEffect(() => { fetchAnnouncements(); }, [year]);

  /* ================= ATTACHMENTS ================= */
  function addLink() {
    const url = prompt("กรอก URL");
    if (!url) return;
    setAttachments(prev => [...prev, { type: "link", name: url, url }]);
  }

  function addFile(file: File, type: "file" | "image") {
    setAttachments(prev => [...prev, { type, name: file.name, url: URL.createObjectURL(file), rawFile: file }]);
  }

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  function openAttachment(at: AnnouncementAttachment) {
    if (at.type === "image") {
      setPreviewUrl(at.url);
    } else {
      window.open(at.url, "_blank");
    }
  }

  /* ================= SAVE ================= */
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert("กรุณากรอกหัวข้อประกาศ");

    const form = new FormData();
    if (editingId) form.append("id", editingId);
    form.append("title", title);
    form.append("body", body);
    form.append("date", date);
    form.append("year", year);

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
      await axios.post("http://localhost:5000/api/announcements", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setTitle(""); setBody(""); setDate(new Date().toISOString().slice(0, 10));
      setAttachments([]); setEditingId(null); setModalOpen(false);
      fetchAnnouncements();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    }
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
    if (!confirm("ลบประกาศนี้?")) return;
    try { await axios.delete(`http://localhost:5000/api/announcements/${id}`); fetchAnnouncements(); }
    catch (err) { console.error(err); alert("ลบไม่สำเร็จ"); }
  };

  /* ================= RENDER ================= */
  return (
    <div style={{ padding: 28 }}>
      {/* HEADER */}
      <section style={{ ...card, marginLeft: 35 }}>
        <h2>จัดการประกาศสหกิจ</h2>
        <div style={{ color: "#64748b", fontSize: 14 }}>ปีการศึกษา {year}</div>
      </section>

      {/* ADD NEW */}
      <section style={{ ...card, marginTop: 20, marginLeft: 35 }}>
        <form onSubmit={save} style={formGrid}>
          <div style={field}>
            <label style={label}>หัวข้อประกาศ</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div style={field}>
            <label style={label}>เนื้อหาประกาศ</label>
            <textarea className="input" rows={4} value={body} onChange={e => setBody(e.target.value)} />
          </div>
          <div style={fieldRow}>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div style={attachRow}>
            <button type="button" className="btn" onClick={addLink}>🔗 แนบลิงก์</button>
            <label style={attachLabel}>📄 แนบไฟล์
              <input type="file" hidden multiple onChange={e => e.target.files && Array.from(e.target.files).forEach(f => addFile(f, "file"))} />
            </label>
            <label style={attachLabel}>🖼 แนบรูป
              <input type="file" hidden multiple accept="image/*" onChange={e => e.target.files && Array.from(e.target.files).forEach(f => addFile(f, "image"))} />
            </label>
          </div>
          {attachments.length > 0 && (
            <ul style={attachList}>
              {attachments.map((a, i) => (
                <li key={i}>
                  <span style={{ cursor: "pointer", color: a.type !== "link" ? "blue" : undefined }} onClick={() => openAttachment(a)}>
                    {a.type === "link" ? "🔗" : a.type === "image" ? "🖼" : "📄"} {a.name}
                  </span>
                  <button type="button" style={delBtn} onClick={() => removeAttachment(i)}>ลบ</button>
                </li>
              ))}
            </ul>
          )}
          <button className="btn" type="submit">{editingId ? "บันทึกการแก้ไข" : "บันทึกประกาศ"}</button>
        </form>
      </section>

      {/* LIST */}
      <section style={{ marginTop: 28, marginLeft: 35 }}>
        <h3>ประกาศปีการศึกษา {year}</h3>
        {items.map(a => (
          <div key={a.id} style={listItem}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{a.title}</div>
              <div style={meta}>{a.date}</div>
              {a.body && <div style={{ marginTop: 6 }}>{a.body}</div>}
              {a.attachments.length > 0 && (
                <ul style={{ marginTop: 6 }}>
                  {a.attachments.map((at, i) => (
                    <li key={i}>
                      <span style={{ cursor: at.type !== "link" ? "pointer" : undefined, color: at.type !== "link" ? "blue" : undefined }} onClick={() => openAttachment(at)}>
                        {at.type === "link" ? "🔗" : at.type === "image" ? "🖼" : "📄"} {at.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" style={ghostBtn} onClick={() => openEditModal(a)}>แก้ไข</button>
              <button className="btn" style={delBtn} onClick={() => remove(a.id)}>ลบ</button>
            </div>
          </div>
        ))}
      </section>

      {/* MODAL */}
      {modalOpen && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3>แก้ไขประกาศ</h3>
            <form onSubmit={save} style={formGrid}>
              <div style={field}>
                <label style={label}>หัวข้อประกาศ</label>
                <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div style={field}>
                <label style={label}>เนื้อหาประกาศ</label>
                <textarea className="input" rows={4} value={body} onChange={e => setBody(e.target.value)} />
              </div>
              <div style={fieldRow}>
                <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div style={attachRow}>
                <button type="button" className="btn" onClick={addLink}>🔗 แนบลิงก์</button>
                <label style={attachLabel}>📄 แนบไฟล์
                  <input type="file" hidden multiple onChange={e => e.target.files && Array.from(e.target.files).forEach(f => addFile(f, "file"))} />
                </label>
                <label style={attachLabel}>🖼 แนบรูป
                  <input type="file" hidden multiple accept="image/*" onChange={e => e.target.files && Array.from(e.target.files).forEach(f => addFile(f, "image"))} />
                </label>
              </div>
              {attachments.length > 0 && (
                <ul style={attachList}>
                  {attachments.map((a, i) => (
                    <li key={i}>
                      <span style={{ cursor: a.type !== "link" ? "pointer" : undefined, color: a.type !== "link" ? "blue" : undefined }} onClick={() => openAttachment(a)}>
                        {a.type === "link" ? "🔗" : a.type === "image" ? "🖼" : "📄"} {a.name}
                      </span>
                      <button type="button" style={delBtn} onClick={() => removeAttachment(i)}>ลบ</button>
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" type="submit">บันทึกการแก้ไข</button>
                <button type="button" className="btn" style={delBtn} onClick={() => setModalOpen(false)}>ปิด</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMAGE PREVIEW POPUP */}
      {previewUrl && (
        <div style={previewOverlay} onClick={() => setPreviewUrl(null)}>
          <img src={previewUrl} alt="preview" style={previewImage} />
        </div>
      )}
    </div>
  );
}

/* ================= STYLES ================= */
const card = { background: "#fff", borderRadius: 14, padding: 30, border: "1px solid #e5e7eb" };
const formGrid = { display: "grid", gap: 16 };
const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, width: "98%" };
const fieldRow = { width: "20%" };
const label = { fontSize: 13 };
const attachRow = { display: "flex", gap: 10 };
const attachLabel: CSSProperties = { padding: "8px 12px", border: "1px dashed #cbd5e1", cursor: "pointer" };
const attachList = { fontSize: 13 };
const listItem: CSSProperties = { display: "flex", gap: 12, padding: 14, border: "1px solid #e5e7eb", borderRadius: 12, marginBottom: 12 };
const meta = { fontSize: 13, color: "#64748b" };
const ghostBtn: CSSProperties = { background: "#fff", color: "var(--ios-blue)", boxShadow: "none", border: "1px solid rgba(10,132,255,.25)", height: 36 };
const delBtn: CSSProperties = { background: "#fff", color: "#dc2626", boxShadow: "none", border: "1px solid rgba(10,132,255,.25)", height: 24, padding: "0 6px", cursor: "pointer" };
const modalOverlay: CSSProperties = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.3)", display: "flex", justifyContent: "center", alignItems: "center" };
const modalContent: CSSProperties = { background: "#fff", borderRadius: 14, padding: 20, width: 700, maxHeight: "90%", overflowY: "auto" };
const previewOverlay: CSSProperties = { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999 };
const previewImage: CSSProperties = { maxWidth: "90%", maxHeight: "90%" };
