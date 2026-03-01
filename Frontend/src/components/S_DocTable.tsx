import React from "react";
import { useEffect } from "react";

// ================= TYPES DEFINITION =================
// ✅ รองรับทั้งแบบ Frontend (ตัวเล็ก) และ Backend (ตัวใหญ่)
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
// ✅ Mapping ข้อความให้ครอบคลุมทุกค่าที่อาจส่งมา
const STATUS_LABEL: Record<string, string> = {
  // แบบเดิม (Frontend State)
  "waiting": "รอส่งเอกสาร",
  "under-review": "รอตรวจเอกสาร",
  "approved": "เอกสารผ่าน",
  "rejected": "ไม่ผ่าน",

  // แบบใหม่ (Backend/Database Enum)
  "WAITING": "รอส่งเอกสาร",
  "PENDING": "รอตรวจสอบ",
  "APPROVED": "✅ เอกสารผ่าน",
  "REJECTED": "❌ ไม่ผ่าน",
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
    console.log("DOC ITEMS", items);
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

  // ✅ ฟังก์ชันอัปโหลด (เอาเงื่อนไขจำกัดจำนวนออกแล้ว)
  function onUploadFile(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. เคลียร์ค่า input ทันที (เพื่อให้เลือกไฟล์เดิมซ้ำได้ กรณีเลือกผิดแล้วเลือกใหม่)
    e.target.value = "";

    const it = items.find((x: DocumentItem) => x.id === id);
    if (!it) return;

    // ลบเงื่อนไขเช็คจำนวนครั้งออกแล้ว (Revision Check Removed)
    // if ((it.history?.length || 0) >= 30) { return alert(...) }

    // 2. ส่งไฟล์
    if (onUploadCall) {
      onUploadCall(id, file);
    } else {
      // Fallback update local state
      patch(id, {
        fileName: file.name,
        status: "PENDING",
        rejectReason: undefined,
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  // Handle Remove
  function onRemoveFile(id: string) {
    if (!window.confirm("ต้องการลบไฟล์นี้ใช่หรือไม่?")) return;

    // 1. แจ้ง Backend
    if (onDeleteCall) {
      onDeleteCall(id);
      console.log("Called onDeleteCall for doc id:", id);
    }

    // 2. รีเซ็ตหน้าจอทันที
    patch(id, {
      fileName: undefined,
      status: "WAITING",
      lastUpdated: new Date().toISOString(),
      rejectReason: undefined
    });

    console.log("Removed file for doc id:", id);
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
            // Normalize status check (case insensitive)
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
                          // ✅ ส่ง event ไปด้วย เพื่อเคลียร์ value
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
                      {/* ✅ ใช้ helper ที่ปรับปรุงแล้ว */}
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
        
        /* ✅ CSS Status Colors */
        .chip.waiting { background: #f1f5f9; color: #475569; }
        .chip.under { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
        .chip.appr { background: #ecfdf5; color: #047857; border: 1px solid #6ee7b7; }
        .chip.rej { background: #fef2f2; color: #b91c1c; border: 1px solid #fca5a5; }
        .chip.edit { background: #fffbeb; color: #b45309; border: 1px solid #fcd34d; } /* สีเหลืองสำหรับแก้ไข */
      `}</style>
    </div>
  );
}

// ================= HELPERS =================

function revisionCount(it: DocumentItem) {
  if (!it.history) return 0;
  // เช็คแบบ case-insensitive
  return it.history.filter((h: DocumentHistory) => (h.status || "").toUpperCase() === "REJECTED").length;
}

// ✅ ปรับปรุง Helper ให้รองรับค่าจาก DB (ตัวพิมพ์ใหญ่)
function chipClass(status: DocStatus) {
  const s = (status || "").toLowerCase(); // แปลงเป็นตัวเล็กเพื่อเทียบง่ายๆ

  if (s === "waiting") return "waiting";
  if (s === "under-review" || s === "pending") return "under";
  if (s === "approved") return "appr";
  if (s === "edits_required") return "edit"; // สีเหลือง

  return "rej"; // rejected หรืออื่นๆ เป็นสีแดง
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

function truncateMiddle(name: string, max = 24) {
  if (name.length <= max) return name;
  const keep = Math.floor((max - 3) / 2);
  return name.slice(0, keep) + "..." + name.slice(-keep);
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