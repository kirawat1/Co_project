import { useState } from "react";
import type { Announcement, AnnouncementAttachment } from "./store";
import {
  loadAnnouncements,
  saveAnnouncements,
  loadAcademicYear,
} from "./store";

export default function A_Announcements() {
  const year = loadAcademicYear();
  const [items, setItems] = useState<Announcement[]>(loadAnnouncements());

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [attachments, setAttachments] =
    useState<AnnouncementAttachment[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);

  /* ================= ATTACHMENTS ================= */

  function addLink() {
    const url = prompt("กรอก URL");
    if (!url) return;
    setAttachments((a) => [...a, { type: "link", name: url, url }]);
  }

  function addFile(file: File, type: "file" | "image") {
    const reader = new FileReader();
    reader.onload = () => {
      setAttachments((a) => [
        ...a,
        { type, name: file.name, url: reader.result as string },
      ]);
    };
    reader.readAsDataURL(file);
  }

  /* ================= SAVE ================= */

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return alert("กรุณากรอกหัวข้อประกาศ");

    let next: Announcement[];

    if (editingId) {
      // UPDATE
      next = items.map((a) =>
        a.id === editingId
          ? { ...a, title, body, date, attachments }
          : a
      );
    } else {
      // ➕ CREATE
      const ann: Announcement = {
        id: crypto.randomUUID(),
        title: title.trim(),
        body: body.trim() || undefined,
        date,
        year,
        attachments,
      };
      next = [ann, ...items];
    }

    setItems(next);
    saveAnnouncements(next);

    // reset
    setTitle("");
    setBody("");
    setDate(new Date().toISOString().slice(0, 10));
    setAttachments([]);
    setEditingId(null);
  }

  function edit(a: Announcement) {
    setEditingId(a.id);
    setTitle(a.title);
    setBody(a.body || "");
    setDate(a.date);
    setAttachments(a.attachments || []);
  }

  function remove(id: string) {
    if (!confirm("ลบประกาศนี้?")) return;
    const next = items.filter((a) => a.id !== id);
    setItems(next);
    saveAnnouncements(next);
  }

  return (
    <div style={{ padding: 28 }}>
      {/* HEADER */}
      <section style={{ ...card, marginLeft: 35 }}>
        <h2>จัดการประกาศสหกิจ</h2>
        <div style={{ color: "#64748b", fontSize: 14 }}>
          ปีการศึกษา {year}
        </div>
      </section>

      {/* FORM */}
      <section style={{ ...card, marginTop: 20, marginLeft: 35 }}>
        <form onSubmit={save} style={formGrid}>
          <div style={ field}>
            <label style={label}>หัวข้อประกาศ</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div style={field}>
            <label style={label}>เนื้อหาประกาศ</label>
            <textarea
              className="input"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div style={fieldRow}>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div style={attachRow}>
            <button type="button" className="btn" onClick={addLink}>
              🔗 แนบลิงก์
            </button>

            <label style={attachLabel}>
              📄 แนบไฟล์
              <input
                type="file"
                hidden
                onChange={(e) =>
                  e.target.files &&
                  addFile(e.target.files[0], "file")
                }
              />
            </label>

            <label style={attachLabel}>
              🖼 แนบรูป
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) =>
                  e.target.files &&
                  addFile(e.target.files[0], "image")
                }
              />
            </label>
          </div>

          {attachments.length > 0 && (
            <ul style={attachList}>
              {attachments.map((a, i) => (
                <li key={i}>
                  {a.type === "link" ? "🔗" : a.type === "image" ? "🖼" : "📄"}{" "}
                  {a.name}
                </li>
              ))}
            </ul>
          )}

          <button className="btn" type="submit">
            {editingId ? "บันทึกการแก้ไข" : "บันทึกประกาศ"}
          </button>
        </form>
      </section>

      {/* LIST */}
      <section style={{ marginTop: 28, marginLeft: 35 }}>
        <h3>ประกาศปีการศึกษา {year}</h3>

        {items.map((a) => (
          <div key={a.id} style={listItem}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{a.title}</div>
              <div style={meta}>{a.date}</div>

              {a.body && (
                <div style={{ marginTop: 6 }}>{a.body}</div>
              )}

              {a.attachments && a.attachments.length > 0 && (
                <ul style={{ marginTop: 6 }}>
                  {a.attachments.map((at, i) => (
                    <li key={i}>
                      {at.type === "link" ? (
                        <a href={at.url} target="_blank">
                          🔗 {at.name}
                        </a>
                      ) : (
                        <span>
                          {at.type === "image" ? "🖼" : "📄"} {at.name}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => edit(a)} style={ghostBtn}>
                แก้ไข
              </button>
              <button
                className="btn"
                style={delBtn}
                onClick={() => remove(a.id)}
              >
                ลบ
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ================= STYLES ================= */

const card = {
  background: "#fff",
  borderRadius: 14,
  padding: 20,
  border: "1px solid #e5e7eb",
};

const formGrid = { display: "grid", gap: 16 };
const field = { display: "flex", flexDirection: "column", gap: 6 , width: "98%"};
const fieldRow = { width: "20%" };
const label = { fontSize: 13 };
const attachRow = { display: "flex", gap: 10 };
const attachLabel = {
  padding: "8px 12px",
  border: "1px dashed #cbd5e1",
  cursor: "pointer",
};
const attachList = { fontSize: 13 };
const listItem = {
  display: "flex",
  gap: 12,
  padding: 14,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  marginBottom: 12,
};
const meta = { fontSize: 13, color: "#64748b" };
const ghostBtn: React.CSSProperties = {
  background: "#fff",
  color: "var(--ios-blue)",
  boxShadow: "none",
  border: "1px solid rgba(10,132,255,.25)",
  height: 36,
};
const delBtn: React.CSSProperties = {
  background: "#fff",
  color: "#dc2626",
  boxShadow: "none",
  border: "1px solid rgba(10,132,255,.25)",
  height: 36,
};
