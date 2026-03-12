import React from "react";
import { useEffect } from "react";

// ================= TYPES DEFINITION =================
export type DocStatus =
  | "waiting" | "under-review" | "approved" | "rejected"
  | "WAITING" | "PENDING" | "APPROVED" | "REJECTED" | "EDITS_REQUIRED";

export interface DocumentHistory {
  at: string;
  status: DocStatus;
  by: string;
  reason?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  dueDate?: string;
  fileName?: string;
  status: DocStatus;
  lastUpdated?: string;
  rejectReason?: string;
  history?: DocumentHistory[];
}

type Props = {
  items: DocumentItem[];
  onChange?: (next: DocumentItem[]) => void;
  allowStatusChange?: boolean;
  onUploadCall?: (id: string, file: File) => void;
  onDeleteCall?: (id: string) => void;
};

// ================= CONSTANTS =================
// ✅ แยกคำแปลสถานะให้ชัดเจนระหว่าง มีไฟล์ กับ ไม่มีไฟล์
const STATUS_LABEL: Record<string, string> = {
  // 1. ยังไม่มีไฟล์
  "waiting": "รอส่งเอกสาร",

  // 2. มีไฟล์แล้ว (รอแอดมินตรวจ)
  "WAITING": "⏳ รอตรวจสอบ",
  "PENDING": "⏳ รอตรวจสอบ",
  "under-review": "⏳ รอตรวจสอบ",

  // 3. ตรวจแล้ว
  "APPROVED": "✅ เอกสารผ่าน",
  "approved": "✅ เอกสารผ่าน",
  "REJECTED": "❌ ไม่ผ่าน",
  "rejected": "❌ ไม่ผ่าน",
  "EDITS_REQUIRED": "⚠️ รอแก้ไข"
};

// ================= COMPONENT =================
export default function DocTable({
  items,
  onChange,
  allowStatusChange = false,
  onUploadCall,
  onDeleteCall
}: Props) {

  useEffect(() => {
    // console.log("DOC ITEMS", items);
  }, [items]);

  function patch(id: string, partial: Partial<DocumentItem>) {
    if (!onChange) return;
    const next = items.map((it) =>
      it.id === id ? { ...it, ...partial } : it
    );
    onChange(next);
  }

  function onStatusChange(id: string, v: DocStatus) {
    if (!allowStatusChange) return;
    patch(id, { status: v, lastUpdated: new Date().toISOString() });
  }

  function onUploadFile(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // เคลียร์ค่า input ทันที
    e.target.value = "";

    const it = items.find((x: DocumentItem) => x.id === id);
    if (!it) return;

    if (onUploadCall) {
      onUploadCall(id, file);
    } else {
      patch(id, {
        fileName: file.name,
        status: "WAITING", // ถ้าทำ Local Update ให้โชว์รอตรวจสอบ
        rejectReason: undefined,
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  function onRemoveFile(id: string) {
    if (!window.confirm("ต้องการลบไฟล์นี้ใช่หรือไม่?")) return;

    if (onDeleteCall) {
      onDeleteCall(id);
    }

    patch(id, {
      fileName: undefined,
      status: "waiting", // กลับไปเป็นตัวเล็ก (รอส่งเอกสาร)
      lastUpdated: new Date().toISOString(),
      rejectReason: undefined
    });
  }

  return (
    <div className="doc-table-wrap" style={{ overflowX: "auto" }}>
      <table className="doc-table">
        <colgroup>
          <col style={{ width: "45%" }} />
          <col style={{ width: "35%" }} />
          <col style={{ width: "20%" }} />
        </colgroup>

        <thead>
          <tr>
            <Th>รายการเอกสาร</Th>
            <Th>ไฟล์แนบ</Th>
            <Th>สถานะเอกสาร</Th>
          </tr>
        </thead>

        <tbody>
          {items.map((it) => {
            const st = (it.status || "").toUpperCase();
            const isApproved = st === 'APPROVED';

            const hasFile = !!it.fileName;
            const canUpload = !isApproved && (!hasFile || st === 'REJECTED' || st === 'EDITS_REQUIRED');

            return (
              <tr key={it.id} className="row">
                <Td strong>
                  {it.title}
                  {revisionCount(it) > 0 && (
                    <div className="meta">
                      แก้ไขครั้งที่ {revisionCount(it)}
                    </div>
                  )}
                </Td>

                <Td className="td-file">
                  {hasFile ? (
                    <UploadedFile
                      it={it}
                      onRemove={() => onRemoveFile(it.id)}
                      isApproved={isApproved}
                    />
                  ) : (
                    <div className="upload-wrap">
                      <label className="btn-light" style={{ cursor: 'pointer' }}>
                        {st === "REJECTED" || st === "EDITS_REQUIRED" ? "🔄 ส่งไฟล์แก้ไข" : "📤 แนบไฟล์"}
                        <input
                          type="file"
                          hidden
                          accept=".pdf,.doc,.docx,.jpg,.png"
                          onChange={(e) => onUploadFile(it.id, e)}
                        />
                      </label>
                    </div>
                  )}
                </Td>

                <Td className="td-status">
                  {allowStatusChange ? (
                    <select
                      className="input"
                      value={it.status}
                      onChange={(e) => onStatusChange(it.id, e.target.value as DocStatus)}
                    >
                      {Object.keys(STATUS_LABEL).map((k) => (
                        <option key={k} value={k}>
                          {STATUS_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      {/* ✅ แสดงสถานะพร้อมสีที่ถูกต้อง */}
                      <span className={`chip ${chipClass(it.status)}`}>
                        {STATUS_LABEL[it.status] || it.status || "Unknown"}
                      </span>

                      {(st === "REJECTED" || st === "EDITS_REQUIRED") && it.rejectReason && (
                        <div className="meta" style={{ color: "#b91c1c", marginTop: 4, background: '#fee2e2', padding: '4px 8px', borderRadius: 4 }}>
                          <b>เหตุผล:</b> {it.rejectReason}
                        </div>
                      )}

                      {it.lastUpdated && (
                        <div className="meta">
                          {new Date(it.lastUpdated).toLocaleDateString('th-TH')}
                        </div>
                      )}
                    </>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <style>{`
        .doc-table { width: 100%; border-collapse: separate; border-spacing: 0; }
        .doc-table th, .doc-table td { padding: 12px 16px; border-bottom: 1px solid rgba(0,0,0,.06); background: #fff; vertical-align: top; }
        thead th { background: #f8fafc; font-weight: 700; color: #475569; text-align: left; text-transform: uppercase; font-size: 13px; letter-spacing: 0.5px; }
        .row:hover td { background: #fcfcff; }
        .meta { font-size: 12px; color: #6b7280; margin-top: 4px; }
        .upload-wrap {width: 100%;}
        .btn-light { 
          height: 36px; padding: 0 16px; border-radius: 8px; 
          border: 1px dashed #cbd5e1; background: #f8fafc; 
          cursor: pointer; font-weight: 600; display: inline-flex; 
          align-items: center; justify-content: center; font-size: 13px; color: #334155; 
          transition: all 0.2s; width: 50%; box-sizing: border-box;
        }
        .btn-light:hover { background: #f1f5f9; border-color: #94a3b8; color: #0f172a; }

        .file-wrap { 
          display: flex; align-items: center; justify-content: space-between; 
          background: #eff6ff; border: 1px solid #bfdbfe; 
          border-radius: 8px; padding: 6px 12px;
          width: 50%; box-sizing: border-box;
        }
        .file-name { 
          font-size: 13px; font-weight: 600; color: #1e40af; 
          display: flex; align-items: center; gap: 6px; 
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .file-wrap.approved { background: #f0fdf4; border-color: #bbf7d0; }
        .file-wrap.approved .file-name { color: #166534; }
        .file-wrap {position: relative;z-index: 1; }
        .icon-btn { 
          width: 24px; height: 24px; border-radius: 4px; 
          border: none; background: transparent; 
          color: #ef4444; cursor: pointer; display: flex; 
          align-items: center; justify-content: center; 
          font-size: 16px; transition: 0.2s; flex-shrink: 0;
        }
        .icon-btn:hover { background: #fee2e2; }

        .chip { padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; display: inline-block; white-space: nowrap; }
        
        /* ✅ CSS Status Colors (ปรับให้สีฟ้าสำหรับรอตรวจสอบ) */
        .chip.waiting { background: #f1f5f9; color: #475569; border: 1px solid transparent; }
        .chip.under { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .chip.appr { background: #ecfdf5; color: #047857; border: 1px solid #6ee7b7; }
        .chip.rej { background: #fef2f2; color: #b91c1c; border: 1px solid #fca5a5; }
        .chip.edit { background: #fffbeb; color: #b45309; border: 1px solid #fcd34d; }
      `}</style>
    </div>
  );
}

// ================= HELPERS =================
function revisionCount(it: DocumentItem) {
  if (!it.history) return 0;
  return it.history.filter((h: DocumentHistory) => (h.status || "").toUpperCase() === "REJECTED").length;
}

// ✅ อัปเดตการใส่สี: แยกตัวเล็ก/ตัวใหญ่ให้สีต่างกัน
function chipClass(status: DocStatus) {
  if (status === "waiting") return "waiting"; // สีเทา (ยังไม่มีไฟล์)

  // สีฟ้า (ส่งไฟล์แล้ว รอแอดมินตรวจ)
  if (status === "WAITING" || status === "PENDING" || status === "under-review") return "under";

  if (status === "APPROVED" || status === "approved") return "appr";
  if (status === "EDITS_REQUIRED") return "edit";

  return "rej"; // นอกนั้นตีเป็นสีแดง
}

function UploadedFile({ it, onRemove, isApproved }: any) {
  return (
    <div className={`file-wrap ${isApproved ? 'approved' : ''}`} style={{ background: isApproved ? '#f0fdf4' : '#eff6ff', borderColor: isApproved ? '#bbf7d0' : '#bfdbfe' }}>
      <span className="file-name" title={it.fileName}>📄 {it.fileName}</span>
      {!isApproved && (
        <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); onRemove(); }}>&times;</button>
      )}
      {isApproved && <span>✅</span>}
    </div>
  );
}

function Th({ children }: React.PropsWithChildren) {
  return <th style={{ textAlign: "left" }}>{children}</th>;
}

function Td({ children, strong, className }: React.PropsWithChildren<{ strong?: boolean; className?: string; }>) {
  return (
    <td className={className} style={{ fontWeight: strong ? 600 : 400, color: strong ? '#1e293b' : '#334155' }}>
      {children}
    </td>
  );
}