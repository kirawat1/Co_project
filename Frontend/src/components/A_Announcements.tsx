// src/components/A_Announcements.tsx
import React, { useMemo, useState } from "react";

export type Ann = {
  id: string;
  title: string;
  date: string;
  body?: string;
  year?: string;
  linkUrl?: string;
  attachmentData?: string; // base64 dataURL
  attachmentName?: string;
  attachmentMime?: string;
  createdAt?: string;
};

const KA = "coop.shared.announcements";
const YEAR_KEY = "coop.admin.academicYear";

function load(): Ann[] {
  try {
    return JSON.parse(localStorage.getItem(KA) || "[]");
  } catch {
    return [];
  }
}

function save(list: Ann[]) {
  localStorage.setItem(KA, JSON.stringify(list));
}

// ใช้ถ้า YEAR_KEY ยังไม่มีค่า (เช่น ยังไม่เคยเข้า Settings)
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
  const [items, setItems] = useState<Ann[]>(() => load());

  // ปีการศึกษาปัจจุบัน ใช้จาก Global Settings
  const year = localStorage.getItem(YEAR_KEY) || loadYear();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileMime, setFileMime] = useState("");

  const upcoming = useMemo(
    () =>
      [...items]
        .filter((a) => (a.year || year) === year)
        .filter((a) => a.date >= new Date().toISOString().slice(0, 10))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [items, year]
  );

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setFileData(null);
      setFileName("");
      setFileMime("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileData(reader.result as string);
      setFileName(file.name);
      setFileMime(file.type || "application/octet-stream");
    };
    reader.readAsDataURL(file);
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      alert("กรุณากรอกหัวข้อ");
      return;
    }
    const it: Ann = {
      id: crypto.randomUUID(),
      title: t,
      date,
      body: body.trim() || undefined,
      year, // ผูกประกาศกับปีการศึกษาปัจจุบันของแอดมิน
      linkUrl: linkUrl.trim() || undefined,
      attachmentData: fileData || undefined,
      attachmentName: fileName || undefined,
      attachmentMime: fileMime || undefined,
      createdAt: new Date().toISOString(),
    };

    const next = [it, ...items];
    setItems(next);
    save(next);

    setTitle("");
    setBody("");
    setLinkUrl("");
    setFileData(null);
    setFileName("");
    setFileMime("");
  }

  function remove(id: string) {
    if (!confirm("ลบประกาศนี้?")) return;
    const next = items.filter((x) => x.id !== id);
    setItems(next);
    save(next);
  }

  function isImageMime(mime?: string): boolean {
    return !!mime && mime.startsWith("image/");
  }

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      {/* Form */}
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>เขียนประกาศสหกิจศึกษา</h2>

        <form
          className="grid2"
          onSubmit={add}
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.2fr",
            gap: 16,
            marginLeft: 18,
            marginRight: 36,
            alignItems: "flex-start",
          }}
        >
          {/* ซ้าย: เนื้อหาประกาศ */}
          <div style={{ display: "grid", gap: 10 }}>
            <div className="field">
              <label className="label" style={{ marginLeft: 10 }}>
                หัวข้อประกาศ
              </label>
              <input
                className="input"
                placeholder="หัวข้อประกาศ"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: "90%", marginRight: 30, }}
              />
            </div>

            <div className="field">
              <label className="label" style={{ marginLeft: 10 }}>
                เนื้อหาประกาศ (ไม่บังคับ)
              </label>
              <textarea
                className="input"
                rows={4}
                placeholder="รายละเอียดประกาศ / เงื่อนไข / ลิงก์เพิ่มเติม"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                style={{ width: "90%",  marginRight: 30, resize: "vertical" }}
              />
            </div>

            <div className="field">
              <label className="label" style={{ marginLeft: 10 }}>
                แนบลิงก์ (ถ้ามี)
              </label>
              <input
                className="input"
                placeholder="เช่น ลิงก์ Google Form / เอกสารภายนอก"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                style={{ width: "90%", marginRight: 30, }}
              />
            </div>
          </div>

          {/* ขวา: วันหมดเขต + ไฟล์แนบ + ปุ่มบันทึก */}
          <div style={{ display: "grid", gap: 10 }}>
            <div className="field">
              <label className="label" style={{ marginLeft: 10 }}>
                กำหนดวันที่
              </label>
              <input
                className="input"
                type="date"
                aria-label="กำหนดวันที่ของประกาศ"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="label" style={{ marginLeft: 10 }}>
                แนบไฟล์ / รูปภาพ (ไม่บังคับ)
              </label>
              <input
                className="input"
                type="file"
                onChange={onFileChange}
                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />
              {fileName && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                    marginTop: 4,
                    wordBreak: "break-all",
                  }}
                >
                  ไฟล์ที่เลือก: {fileName}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <button className="btn" type="submit">
                บันทึกประกาศ
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* List */}
      <section className="card" style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <h3 style={{ margin: 0 }}>ประกาศตามปีการศึกษา {year}</h3>
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            ทั้งหมด {upcoming.length} รายการ
          </span>
        </div>

        {upcoming.length === 0 ? (
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
            ยังไม่มีประกาศสำหรับปีการศึกษานี้
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 12,
            }}
          >
            {upcoming.map((a) => (
              <li
                key={a.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto",
                  gap: 8,
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{a.title}</div>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                      }}
                    >
                      {a.date}
                    </span>
                    {a.year && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "#fef3c7",
                          color: "#92400e",
                        }}
                      >
                        ปี {a.year}
                      </span>
                    )}
                  </div>

                  {a.body && (
                    <p
                      style={{
                        fontSize: 13,
                        color: "#4b5563",
                        marginTop: 6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {a.body}
                    </p>
                  )}

                  {/* Attachments */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      marginTop: 6,
                      alignItems: "center",
                    }}
                  >
                    {a.linkUrl && (
                      <a
                        href={a.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: 12,
                          textDecoration: "underline",
                          color: "#1d4ed8",
                        }}
                      >
                        เปิดลิงก์ที่แนบ
                      </a>
                    )}

                    {a.attachmentData && (
                      <>
                        {isImageMime(a.attachmentMime) ? (
                          <div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#6b7280",
                                marginBottom: 4,
                              }}
                            >
                              รูปภาพที่แนบ:
                            </div>
                            <img
                              src={a.attachmentData}
                              alt={a.attachmentName || "แนบรูปภาพ"}
                              style={{
                                maxWidth: 220,
                                maxHeight: 150,
                                borderRadius: 8,
                                border: "1px solid #e5e7eb",
                                objectFit: "cover",
                              }}
                            />
                          </div>
                        ) : (
                          <a
                            href={a.attachmentData}
                            download={a.attachmentName || "attachment"}
                            style={{
                              fontSize: 12,
                              textDecoration: "underline",
                              color: "#1d4ed8",
                            }}
                          >
                            ดาวน์โหลดไฟล์แนบ ({a.attachmentName || "ไฟล์"})
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 8,
                    fontSize: 11,
                    color: "#9ca3af",
                  }}
                >
                  {a.createdAt && (
                    <span>
                      เพิ่มเมื่อ{" "}
                      {new Date(a.createdAt).toLocaleString("th-TH", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => remove(a.id)}
                  >
                    ลบ
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

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
