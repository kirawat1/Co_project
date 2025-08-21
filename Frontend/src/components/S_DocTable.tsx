// src/components/DocTable.tsx
import React from "react";
import type { DocumentItem, DocStatus } from "./store";

type Props = {
  items: DocumentItem[];
  onChange: (next: DocumentItem[]) => void;
  /** เปิดให้แอดมินเปลี่ยนสถานะได้ (นักศึกษาควรปล่อย false) */
  allowStatusChange?: boolean;
};

const STATUS_LABEL: Record<DocStatus, string> = {
  "waiting": "รอส่งเอกสาร",
  "under-review": "รอพิจารณา",
  "approved": "ผ่าน",
  "rejected": "ไม่ผ่าน",
};

export default function DocTable({ items, onChange, allowStatusChange = false }: Props) {
  function patch(id: string, partial: Partial<DocumentItem>) {
    const next = items.map(it => (it.id === id ? { ...it, ...partial } : it));
    onChange(next);
  }

  function onStatusChange(id: string, v: DocStatus) {
    if (!allowStatusChange) return;
    patch(id, { status: v, lastUpdated: new Date().toISOString() });
  }

  // อัปไฟล์: เซ็ตชื่อ + เวลา + สถานะเป็นรอพิจารณา
  function onUploadFile(id: string, file?: File | null) {
    if (!file) return;
    patch(id, { fileName: file.name, status: "under-review", lastUpdated: new Date().toISOString() });
  }

  // ลบไฟล์: เคลียร์ชื่อ + เวลา + สถานะกลับไปรอส่งเอกสาร
  function onRemoveFile(id: string) {
    patch(id, { fileName: undefined, status: "waiting", lastUpdated: new Date().toISOString() });
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  return (
    <div className="doc-table-wrap" style={{ overflowX: "auto", marginLeft:20, width:830 }}>
      <table className="doc-table">
        {/* ล็อกความกว้างแต่ละคอลัมน์ */}
        <colgroup>
          <col style={{ width: "33%" }} /> {/* เอกสาร */}
          <col style={{ width: "23%" }} /> {/* กำหนดส่ง */}
          <col style={{ width: "24%" }} /> {/* ไฟล์ */}
          <col style={{ width: "20%" }} /> {/* สถานะ */}
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

            // สีเวลาที่เหลือ: ≤7 แดง, 8–20 เหลือง, ≥21 เขียว
            let dueClass: "due-red"|"due-yellow"|"due-green"|"expired";
            if (isExpired) dueClass = "expired";
            else if (daysLeft <= 7) dueClass = "due-red";
            else if (daysLeft <= 20) dueClass = "due-yellow";
            else dueClass = "due-green";

            const shortName = it.fileName ? truncateMiddle(it.fileName, 24) : "";

            return (
              <tr key={it.id} className="row">
                <Td strong>{it.title}</Td>

                <Td>
                  {/* แสดงเฉพาะ “เวลาที่เหลือ” เป็นสี, ไม่โชว์วันที่; ถ้าหมดเวลา แสดง “หมดเวลา” */}
                  {isExpired ? (
                    <span className={`pill ${dueClass}`}>หมดเวลา</span>
                  ) : (
                    <span className={`pill ${dueClass}`}>{daysLeft === 0 ? "วันนี้" : `อีก ${daysLeft} วัน`}</span>
                  )}
                </Td>

                <Td className="td-file">
                  {it.fileName ? (
                    <div className="file-wrap">
                      <span className="file-chip" title={it.fileName}>
                        <span className="dot" aria-hidden />{shortName}
                      </span>
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => onRemoveFile(it.id)}
                        aria-label="ลบไฟล์"
                        title="ลบไฟล์"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  ) : (
                    isExpired ? (
                      // หมดเวลา: ห้ามอัปโหลดและไม่แสดงปุ่ม
                      <span className="muted">อัปโหลดไม่ได้</span>
                    ) : (
                      <label className="btn-light">
                        แนบไฟล์
                        <input
                          type="file"
                          onChange={(e) => {
                            const f = e.currentTarget.files?.[0];
                            onUploadFile(it.id, f);
                            e.currentTarget.value = ""; // ให้อัปโหลดไฟล์เดิมซ้ำได้
                          }}
                          accept=".pdf,.doc,.docx,.zip,.rar,image/*"
                          hidden
                        />
                      </label>
                    )
                  )}
                </Td>

                <Td className="td-status">
                  {allowStatusChange ? (
                    <>
                      <select
                        className="input"
                        value={it.status}
                        onChange={(e) => onStatusChange(it.id, e.target.value as DocStatus)}
                      >
                        {(Object.keys(STATUS_LABEL) as DocStatus[]).map((k) => (
                          <option key={k} value={k}>{STATUS_LABEL[k]}</option>
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

      {/* Styles */}
      <style>{`
        .doc-table{
          width:100%;
          border-collapse:separate;
          border-spacing:0;
          table-layout: fixed; /* คุมความกว้างคอลัมน์ */
        }
        .doc-table th, .doc-table td {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(0,0,0,.06);
          vertical-align: middle;
          background:#fff;
        }
        .doc-table thead th { background:#f9fafb; font-weight:800; color:#111827; }
        .row:hover td { background:#fcfcff; }

        .meta{ font-size:12px; color:#6b7280; margin-top:4px; }

        /* ป้ายเวลาที่เหลือ */
        .pill{ padding:4px 10px; border-radius:999px; font-weight:800; display:inline-block; }
        .pill.due-green{  background:#ECFDF5; color:#065F46; border:1px solid #6EE7B7; }
        .pill.due-yellow{ background:#FFF7ED; color:#9A3412; border:1px solid #FDBA74; }
        .pill.due-red{    background:#FEF2F2; color:#B91C1C; border:1px solid #FCA5A5; }
        .pill.expired{    background:#FEF2F2; color:#B91C1C; border:1px solid #FCA5A5; }

        .muted{ color:#6b7280; font-weight:700; }

        /* ไฟล์: ให้เนื้อหาย่อ/ไม่ดันคอลัมน์ */
        .td-file { overflow: hidden; }
        .file-wrap{ display:flex; align-items:center; gap:8px; flex-wrap:nowrap; min-width:0; }
        .file-chip{
          flex: 1 1 auto;
          min-width:0;
          background:#EFF6FF; color:#1E40AF; border:1px solid #93C5FD;
          border-radius:999px; padding:4px 10px; font-weight:700;
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        .file-chip .dot{ width:8px; height:8px; background:#3B82F6; border-radius:50%; display:inline-block; margin-right:6px; }

        .btn-light {
          display:inline-flex; align-items:center; gap:6px;
          height:34px; padding:0 12px; border-radius:10px; border:1px solid #e5e7eb; background:#fff;
          cursor:pointer; font-weight:700;
        }
        .btn-light:hover { background:#f9fafb; }

        .icon-btn{
          flex: 0 0 auto;
          width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center;
          border-radius:8px; border:1px solid #e5e7eb; background:#fff; cursor:pointer;
        }
        .icon-btn:hover{ background:#f9fafb; }
        .icon-btn.danger{ color:#B91C1C; border-color:#FCA5A5; background:#FEF2F2; }
        .icon-btn.danger:hover{ background:#ffe9e9; }

        /* สถานะ */
        .td-status { overflow: hidden; }
        .chip{ padding:4px 10px; border-radius:999px; font-weight:800; display:inline-block; white-space:nowrap; }
        .chip.waiting{ background:#EFF6FF; color:#1E40AF; border:1px solid #93C5FD }
        .chip.under{   background:#FFF7ED; color:#9A3412; border:1px solid #FDBA74 }
        .chip.appr{    background:#ECFDF5; color:#065F46; border:1px solid #6EE7B7 }
        .chip.rej{     background:#FEF2F2; color:#B91C1C; border:1px solid #FCA5A5 }
      `}</style>
    </div>
  );
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
