import { useState, useEffect } from "react";
import axios from "axios";
import type { CSSProperties } from "react";

interface Announcement {
  id: string;
  title: string;
  body?: string;
  date: string;
  year: string;
  targetMajors: string[];
  attachments: { type: string; name: string; url: string }[];
}

export default function S_Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Announcement | null>(null);
  const token = localStorage.getItem("coop.token");

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const profileRes = await axios.get("/api/students/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const major = profileRes.data?.major || "";
        const majorParam = major ? `?major=${encodeURIComponent(major)}` : "";
        const res = await axios.get(`/api/announcements${majorParam}`);
        if (res.data.ok) {
          setItems(res.data.list.map((a: any) => ({
            ...a,
            targetMajors: a.targetMajors || [],
            attachments: a.attachments || [],
          })));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [token]);

  return (
    <div style={page}>
      <h1 style={pageTitle}>📢 ประกาศสหกิจศึกษา</h1>

      {loading ? (
        <div style={emptyBox}>กำลังโหลด...</div>
      ) : items.length === 0 ? (
        <div style={emptyBox}>ไม่มีประกาศในขณะนี้</div>
      ) : (
        <div style={stream}>
          {items.map(a => (
            <article key={a.id} style={card} onClick={() => setSelected(a)}>
              <div style={cardTop}>
                <span style={cardTitle}>{a.title}</span>
                <span style={cardDate}>
                  {new Date(a.date).toLocaleDateString("th-TH", { dateStyle: "medium" })}
                </span>
              </div>
              {a.body && (
                <p style={cardBody}>
                  {a.body.length > 180 ? a.body.slice(0, 180) + "..." : a.body}
                </p>
              )}
              {a.attachments.length > 0 && (
                <div style={chipRow}>
                  {a.attachments.map((at, i) => (
                    <span
                      key={i}
                      style={chip}
                      onClick={e => { e.stopPropagation(); window.open(at.url, "_blank"); }}
                    >
                      {at.type === "link" ? "🔗" : at.type === "image" ? "🖼️" : "📄"}{" "}
                      <span style={chipText}>{at.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {selected && (
        <div style={overlay} onClick={() => setSelected(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHead}>
              <h2 style={{ margin: 0, fontSize: 20 }}>{selected.title}</h2>
              <button style={closeBtn} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={modalBody}>
              <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>
                📅 {new Date(selected.date).toLocaleDateString("th-TH", { dateStyle: "long" })}
              </p>
              {selected.body && (
                <p style={{ color: "#334155", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 20 }}>
                  {selected.body}
                </p>
              )}
              {selected.attachments.length > 0 && (
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "#475569", marginBottom: 8 }}>ไฟล์แนบ</p>
                  <div style={chipRow}>
                    {selected.attachments.map((at, i) => (
                      <a
                        key={i}
                        href={at.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ ...chip, textDecoration: "none" }}
                      >
                        {at.type === "link" ? "🔗" : at.type === "image" ? "🖼️" : "📄"}{" "}
                        <span style={chipText}>{at.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const page: CSSProperties = { padding: "40px", marginLeft: "65px", backgroundColor: "#f8fafc", minHeight: "100vh" };
const pageTitle: CSSProperties = { fontSize: 26, fontWeight: 800, color: "#1e293b", marginBottom: 24 };
const stream: CSSProperties = { display: "flex", flexDirection: "column", gap: 16 };
const card: CSSProperties = { backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, cursor: "pointer", transition: "box-shadow .15s", boxShadow: "0 1px 3px rgba(0,0,0,.04)" };
const cardTop: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 };
const cardTitle: CSSProperties = { fontWeight: 700, fontSize: 17, color: "#0f172a", flex: 1 };
const cardDate: CSSProperties = { fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" };
const cardBody: CSSProperties = { color: "#475569", fontSize: 14, lineHeight: 1.6, margin: "0 0 12px" };
const chipRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
const chip: CSSProperties = { background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 20, padding: "5px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 };
const chipText: CSSProperties = { color: "#334155", fontWeight: 500 };
const emptyBox: CSSProperties = { textAlign: "center", padding: "80px 0", color: "#94a3b8", fontSize: 15, backgroundColor: "#fff", borderRadius: 16, border: "1px dashed #e2e8f0" };
const overlay: CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(4px)" };
const modal: CSSProperties = { background: "#fff", borderRadius: 20, width: "100%", maxWidth: 620, maxHeight: "85vh", overflowY: "auto" };
const modalHead: CSSProperties = { padding: "24px 24px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" };
const modalBody: CSSProperties = { padding: 24 };
const closeBtn: CSSProperties = { background: "none", border: "none", fontSize: 20, color: "#64748b", cursor: "pointer" };
