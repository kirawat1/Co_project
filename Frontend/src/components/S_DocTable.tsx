// src/components/DocTable.tsx
import React from "react";
import type { DocumentItem, DocStatus } from "./store";

type Props = {
  items: DocumentItem[];
  onChange: (next: DocumentItem[]) => void;
  allowStatusChange?: boolean;
};

const STATUS_LABEL: Record<DocStatus, string> = {
  waiting: "รอส่งเอกสาร",
  "under-review": "รอพิจารณา",
  approved: "ผ่าน",
  rejected: "ไม่ผ่าน",
};

export default function DocTable({ items, onChange, allowStatusChange = false }: Props) {
  function patch(id: string, partial: Partial<DocumentItem>) {
    const next = items.map((it) => (it.id === id ? { ...it, ...partial } : it));
    onChange(next);
  }

  function onStatusChange(id: string, v: DocStatus) {
    if (!allowStatusChange) return;
    patch(id, { status: v, lastUpdated: new Date().toISOString() });
  }

  function onUploadFile(id: string, file?: File | null) {
    if (!file) return;
    patch(id, {
      fileName: file.name,
      status: "under-review",
      lastUpdated: new Date().toISOString(),
    });
  }

  function onRemoveFile(id: string) {
    patch(id, {
      fileName: undefined,
      status: "waiting",
      lastUpdated: new Date().toISOString(),
    });
  }

  // ⭐ เปิดหน้าแบบฟอร์ม
  function openForm(docId: string) {
    window.location.href = `/student/forms/${docId}`;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div
      className="doc-table-wrap"
      style={{
        overflowX: "auto",
        width: "100%",
        maxWidth: "100%",
        marginLeft: 0,
      }}
    >
      <table className="doc-table">
        <colgroup>
          <col style={{ width: "33%" }} />
          <col style={{ width: "23%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "20%" }} />
        </colgroup>

        <thead>
          <tr>
            <Th>เอกสาร</Th>
            <Th>กำหนดส่ง</Th>
            <Th>ไฟล์</Th>
            <Th>สถานะ</Th>
          </tr>
        </thead>

        <tbody>
          {items.map((it) => {
            const due = new Date(it.dueDate + "T00:00:00");
            const daysLeft = Math.ceil((+due - +today) / 86400000);
            const isExpired = daysLeft < 0;

            let dueClass: "due-red" | "due-yellow" | "due-green" | "expired";
            if (isExpired) dueClass = "expired";
            else if (daysLeft <= 7) dueClass = "due-red";
            else if (daysLeft <= 20) dueClass = "due-yellow";
            else dueClass = "due-green";

            return (
              <tr key={it.id} className="row">
                <Td strong>{it.title}</Td>

                <Td>
                  {isExpired ? (
                    <span className={`pill ${dueClass}`}>หมดเวลา</span>
                  ) : (
                    <span className={`pill ${dueClass}`}>
                      {daysLeft === 0 ? "วันนี้" : `อีก ${daysLeft} วัน`}
                    </span>
                  )}
                </Td>

                <Td className="td-file">{renderActions(it, isExpired)}</Td>

                <Td className="td-status">
                  {allowStatusChange ? (
                    <>
                      <select
                        className="input"
                        value={it.status}
                        onChange={(e) => onStatusChange(it.id, e.target.value as DocStatus)}
                      >
                        {(Object.keys(STATUS_LABEL) as DocStatus[]).map((k) => (
                          <option key={k} value={k}>
                            {STATUS_LABEL[k]}
                          </option>
                        ))}
                      </select>
                      {it.lastUpdated && (
                        <div className="meta">อัปเดตล่าสุด: {new Date(it.lastUpdated).toLocaleString()}</div>
                      )}
                    </>
                  ) : (
                    <>
                      <span className={`chip ${chipClass(it.status)}`}>{STATUS_LABEL[it.status]}</span>
                      {it.lastUpdated && (
                        <div className="meta">อัปเดตล่าสุด: {new Date(it.lastUpdated).toLocaleString()}</div>
                      )}
                    </>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* STYLE: ใช้ได้กับทุกหน้าจอ */}
      <style>{`
        .doc-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: fixed;
        }
        .doc-table th, .doc-table td {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(0,0,0,.06);
          background:#fff;
          vertical-align: middle;
        }
        .doc-table thead th { background:#f9fafb; font-weight:800; color:#111827; }
        .row:hover td { background:#fcfcff; }

        .meta{ font-size:12px; color:#6b7280; margin-top:4px; }

        .pill { padding:4px 10px; border-radius:999px; font-weight:800; display:inline-block; }
        .pill.due-green{  background:#ECFDF5; color:#065F46; border:1px solid #6EE7B7; }
        .pill.due-yellow{ background:#FFF7ED; color:#9A3412; border:1px solid #FDBA74; }
        .pill.due-red{    background:#FEF2F2; color:#B91C1C; border:1px solid #FCA5A5; }
        .pill.expired{    background:#FEF2F2; color:#B91C1C; border:1px solid #FCA5A5; }

        .muted{ color:#6b7280; font-weight:700; }

        .td-file { overflow: hidden; }
        .file-wrap{ display:flex; align-items:center; gap:8px; min-width:0; }
        .file-chip{
          flex: 1;
          background:#EFF6FF; color:#1E40AF; border:1px solid #93C5FD;
          border-radius:999px; padding:4px 10px; font-weight:700;
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }

        .btn-light {
          display:inline-flex; align-items:center; gap:6px;
          height:34px; padding:0 12px; border-radius:10px;
          border:1px solid #e5e7eb; background:#fff;
          cursor:pointer; font-weight:700;
        }

        .icon-btn{
          width:30px; height:30px; display:flex; align-items:center; justify-content:center;
          border-radius:8px; border:1px solid #e5e7eb; background:#fff; cursor:pointer;
        }
        .icon-btn.danger{ color:#B91C1C; border-color:#FCA5A5; background:#FEF2F2; }

        .td-status { overflow:hidden; }
        .chip{ padding:4px 10px; border-radius:999px; font-weight:800; }
        .chip.waiting{ background:#EFF6FF; color:#1E40AF; border:1px solid #93C5FD }
        .chip.under{   background:#FFF7ED; color:#9A3412; border:1px solid #FDBA74 }
        .chip.appr{    background:#ECFDF5; color:#065F46; border:1px solid #6EE7B7 }
        .chip.rej{     background:#FEF2F2; color:#B91C1C; border:1px solid #FCA5A5 }
      `}</style>
    </div>
  );

  // ===========================
  // ⭐ ปุ่มฟอร์ม / ดาวน์โหลด / อัปโหลด
  // ===========================
  function renderActions(it: DocumentItem, expired: boolean) {
    if (expired) return <span className="muted">หมดเวลา</span>;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

        {/* ⭐ กรอกฟอร์ม (แทนปุ่มอัปโหลด) */}
        {it.needForm && (
          <button className="btn-light" onClick={() => openForm(it.id)}>
            กรอกฟอร์ม
          </button>
        )}

        {/* ⭐ ถ้ามีไฟล์ต้นฉบับให้ดาวน์โหลด */}
        {it.needDownload && (
          <a className="btn-light" href={`/forms/${it.id}.pdf`} download>
            ดาวน์โหลดต้นฉบับ
          </a>
        )}

        {/* ⭐ อัปโหลดเฉพาะเอกสารที่ไม่ใช่ฟอร์ม */}
        {!it.needForm && it.needUpload && (
          it.fileName ? (
            <UploadedFile it={it} />
          ) : (
            <label className="btn-light">
              แนบไฟล์
              <input
                type="file"
                hidden
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  onUploadFile(it.id, f);
                  e.currentTarget.value = "";
                }}
                accept=".pdf,.doc,.docx,.zip,.rar,image/*"
              />
            </label>
          )
        )}
      </div>
    );
  }

  function UploadedFile({ it }: { it: DocumentItem }) {
    return (
      <div className="file-wrap">
        <span className="file-chip">{truncateMiddle(it.fileName!, 24)}</span>
        <button className="icon-btn danger" onClick={() => onRemoveFile(it.id)}>
          ✕
        </button>
      </div>
    );
  }
}

function truncateMiddle(name: string, max = 24) {
  if (name.length <= max) return name;
  const keep = Math.floor((max - 3) / 2);
  return name.slice(0, keep) + "..." + name.slice(-keep);
}

function chipClass(s: DocStatus) {
  if (s === "waiting") return "waiting";
  if (s === "under-review") return "under";
  if (s === "approved") return "appr";
  return "rej";
}

function Th({ children, style }: React.PropsWithChildren<{ style?: React.CSSProperties }>) {
  return <th style={{ textAlign: "left", ...style }}>{children}</th>;
}

function Td({ children, strong = false, className }: React.PropsWithChildren<{ strong?: boolean; className?: string }>) {
  return <td className={className} style={{ fontWeight: strong ? 700 : 500 }}>{children}</td>;
}
