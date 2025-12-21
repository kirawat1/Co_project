// src/components/A_Announcements.tsx
import React, { useMemo, useState, useEffect } from "react";

export type Ann = {
  id: string;
  title: string;
  date: string;
  body?: string;
  year?: string;
  linkUrl?: string;
  createdAt?: string;
  // เพิ่มส่วนนี้
  files?: {
    id: string;
    name: string;
    mime: string;
    path: string;
  }[];
};
const YEAR_KEY = "coop.admin.academicYear";

function getFileUrl(path: string) {
  const backendOrigin = "http://localhost:5000"; // backend
  const url = `${backendOrigin}/uploads/${encodeURIComponent(path)}`;
  // console.log("getFileUrl:", url);
  return url;
}




function loadYear(): string {
  const saved = localStorage.getItem(YEAR_KEY);
  if (saved) return saved;

  const now = new Date();
  const thYear = now.getFullYear() + 543;
  const month = now.getMonth() + 1;
  const term = month >= 6 && month <= 11 ? 1 : 2;
  const guess = `${thYear}/${term}`;
  localStorage.setItem(YEAR_KEY, guess);
  return guess;
}

export default function A_Announcements() {
  const [items, setItems] = useState<Ann[]>([]);
  const year = localStorage.getItem(YEAR_KEY) || loadYear();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const [preview, setPreview] = useState<{ type: "image" | "pdf"; src: string } | null>(null);

  // โหลดประกาศจาก backend
  useEffect(() => {
    const token = localStorage.getItem("coop.token");
    if (!token) return;
    fetch("/api/announcements", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) setItems(data.list || []);
      });
  }, []);

  const upcoming = useMemo(
    () =>
      [...items]
        .filter((a) => (a.year || year) === year)
        .filter((a) => a.date >= new Date().toISOString().slice(0, 10))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [items, year]
  );

  function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected) return;
    setFiles(Array.from(selected));
  }

  async function addAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    if (!title.trim()) return alert("กรุณากรอกหัวข้อ");

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("date", date);
    formData.append("year", year);
    if (body.trim()) formData.append("body", body.trim());
    if (linkUrl.trim()) formData.append("linkUrl", linkUrl.trim());
    files.forEach(f => formData.append("attachments", f));

    try {
      const token = localStorage.getItem("coop.token");
      const res = await fetch("http://localhost:5000/api/announcements", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!data.ok) return alert(data.message || "เกิดข้อผิดพลาด");

      setItems(prev => [data.announcement, ...prev]);
      setTitle(""); setBody(""); setLinkUrl(""); setFiles([]);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการส่งข้อมูล");
    } finally {
      setLoading(false);
    }
  }


  async function removeAnnouncement(id: string) {
    if (!confirm("ลบประกาศนี้?")) return;
    const token = localStorage.getItem("coop.token");
    if (!token) return alert("กรุณาเข้าสู่ระบบ");

    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setItems(prev => prev.filter(x => x.id !== id));
      } else {
        alert(data.message || "เกิดข้อผิดพลาด");
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    }
  }

  function isImageMime(mime?: string) {
    return !!mime && mime.startsWith("image/");
  }

  function isPdfMime(mime?: string) {
    return !!mime && mime === "application/pdf";
  }

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      {/* Form */}
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>เขียนประกาศสหกิจศึกษา</h2>

        <form className="grid2" onSubmit={addAnnouncement} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr", gap: 16, marginLeft: 18, marginRight: 36, alignItems: "flex-start" }}>
          {/* ซ้าย */}
          <div style={{ display: "grid", gap: 10 }}>
            <div className="field">
              <label className="label" style={{ marginLeft: 10 }}>หัวข้อประกาศ</label>
              <input className="input" placeholder="หัวข้อประกาศ" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "90%", marginRight: 30 }} />
            </div>
            <div className="field">
              <label className="label" style={{ marginLeft: 10 }}>เนื้อหาประกาศ (ไม่บังคับ)</label>
              <textarea className="input" rows={4} placeholder="รายละเอียดประกาศ / เงื่อนไข / ลิงก์เพิ่มเติม" value={body} onChange={(e) => setBody(e.target.value)} style={{ width: "90%", marginRight: 30, resize: "vertical" }} />
            </div>
            <div className="field">
              <label className="label" style={{ marginLeft: 10 }}>แนบลิงก์ (ถ้ามี)</label>
              <input className="input" placeholder="เช่น ลิงก์ Google Form / เอกสารภายนอก" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} style={{ width: "90%", marginRight: 30 }} />
            </div>
          </div>

          {/* ขวา */}
          <div style={{ display: "grid", gap: 10 }}>
            <div className="field">
              <label className="label" style={{ marginLeft: 10 }}>กำหนดวันที่</label>
              <input className="input" type="date" aria-label="กำหนดวันที่ของประกาศ" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="field">
              <label className="label" style={{ marginLeft: 10 }}>แนบไฟล์ / รูปภาพ (ไม่บังคับ)</label>
              <input className="input" type="file" multiple onChange={onFilesChange} accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.py,.c,.txt" />
              {files.length > 0 && (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>ไฟล์ที่เลือก: {files.map(f => f.name).join(", ")}</div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: 4 }}>
              <button className="btn" type="submit" disabled={loading}>{loading ? "กำลังบันทึก..." : "บันทึกประกาศ"}</button>
            </div>
          </div>
        </form>
      </section>

      {/* List */}
      <section className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>ประกาศตามปีการศึกษา {year}</h3>
          <span style={{ fontSize: 12, color: "#6b7280" }}>ทั้งหมด {upcoming.length} รายการ</span>
        </div>

        {upcoming.length === 0 ? (
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>ยังไม่มีประกาศสำหรับปีการศึกษานี้</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {upcoming.map((a) => (
              <li key={a.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8 }}>
                <div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <div style={{ fontWeight: 600 }}>{a.title}</div>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8" }}>{a.date}</span>
                    {a.year && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#fef3c7", color: "#92400e" }}>ปี {a.year}</span>}
                  </div>
                  {a.body && <p style={{ fontSize: 13, color: "#4b5563", marginTop: 6, whiteSpace: "pre-wrap" }}>{a.body}</p>}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6, alignItems: "center" }}>
                    {a.files?.map((f, i) => {
                      const url = getFileUrl(f.path);

                      if (isImageMime(f.mime)) {
                        return (
                          <img
                            key={i}
                            src={url}
                            alt={f.name}
                            style={{ maxHeight: 120 }}
                            onClick={() => {
                              console.log("Preview image:", url);
                              setPreview({ type: "image", src: url });
                            }}
                          />
                        );
                      }

                      if (isPdfMime(f.mime)) {
                        return (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => console.log("Open PDF in new tab:", url)}
                          >
                            {f.name}
                          </a>
                        );
                      }

                      return (
                        <a
                          key={i}
                          href={url}
                          download
                          onClick={() => console.log("Download file:", url)}
                        >
                          {f.name}
                        </a>
                      );
                    })}

                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, fontSize: 11, color: "#9ca3af" }}>
                  {a.createdAt && <span>เพิ่มเมื่อ {new Date(a.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</span>}
                  <button type="button" className="btn-secondary" onClick={() => removeAnnouncement(a.id)}>ลบ</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Preview Modal */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999 }}>
          {preview.type === "image" ? (
            <img src={preview.src} alt="preview" style={{ maxHeight: "90%", maxWidth: "90%", borderRadius: 8 }} />
          ) : (
            <iframe src={preview.src} style={{ width: "80vw", height: "80vh", border: "none", borderRadius: 8 }} />
          )}
        </div>
      )}


      <style>{`
        .btn-secondary{
          border-radius:999px;
          padding:6px 14px;
          border:1px solid #e5e7eb;
          background:#fff;
          font-size:12px;
          cursor:pointer;
        }
        @media (max-width:1024px){
          form.grid2{
            grid-template-columns:1fr !important;
            margin-right:18px !important;
          }
        }
      `}</style>
    </div>
  );
}
