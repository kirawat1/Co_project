import React from "react";
import type { DocumentItem, DocStatus, DocumentHistory } from "./store";

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

const MAX_REVISION = 3;

export default function DocTable({
  items,
  onChange,
  allowStatusChange = false,
}: Props) {
  function patch(id: string, partial: Partial<DocumentItem>) {
    const next = items.map((it) =>
      it.id === id ? { ...it, ...partial } : it
    );
    onChange(next);
  }

  function onStatusChange(id: string, v: DocStatus) {
    if (!allowStatusChange) return;
    patch(id, { status: v, lastUpdated: new Date().toISOString() });
  }

  // ⭐ ส่งใหม่ได้ (waiting / rejected) + จำกัดจำนวนครั้ง
  function onUploadFile(id: string, file?: File | null) {
    if (!file) return;

    const it = items.find((x) => x.id === id);
    if (!it) return;

    if (revisionCount(it) >= MAX_REVISION) {
      alert("คุณแก้ไขเอกสารครบ 3 ครั้งแล้ว กรุณาติดต่ออาจารย์ผู้ดูแล");
      return;
    }

    patch(id, {
      fileName: file.name,
      status: "under-review",
      rejectReason: undefined,
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="doc-table-wrap" style={{ overflowX: "auto" }}>
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
            // ===== Guard: dueDate อาจไม่มี =====
            const due = it.dueDate ? new Date(it.dueDate + "T00:00:00") : null;
            const daysLeft =
              due ? Math.ceil((+due - +today) / 86400000) : null;
            const expired = daysLeft !== null && daysLeft < 0;

            const dueClass =
              daysLeft === null
                ? ""
                : expired
                ? "expired"
                : daysLeft <= 7
                ? "due-red"
                : daysLeft <= 20
                ? "due-yellow"
                : "due-green";

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

                <Td>
                  {daysLeft === null ? (
                    <span className="muted">-</span>
                  ) : (
                    <span className={`pill ${dueClass}`}>
                      {expired
                        ? "หมดเวลา"
                        : daysLeft === 0
                        ? "วันนี้"
                        : `อีก ${daysLeft} วัน`}
                    </span>
                  )}
                </Td>

                <Td className="td-file">
                  {expired ? (
                    <span className="muted">หมดเวลา</span>
                  ) : it.fileName ? (
                    <UploadedFile it={it} onRemove={onRemoveFile} />
                  ) : (
                    <label className="btn-light">
                      {it.status === "rejected"
                        ? "ส่งไฟล์แก้ไข"
                        : "แนบไฟล์"}
                      <input
                        type="file"
                        hidden
                        accept=".pdf,.doc,.docx,.zip,.rar,image/*"
                        onChange={(e) => {
                          const f = e.currentTarget.files?.[0];
                          onUploadFile(it.id, f);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  )}
                </Td>

                <Td className="td-status">
                  {allowStatusChange ? (
                    <>
                      <select
                        className="input"
                        value={it.status}
                        onChange={(e) =>
                          onStatusChange(
                            it.id,
                            e.target.value as DocStatus
                          )
                        }
                      >
                        {(Object.keys(STATUS_LABEL) as DocStatus[]).map(
                          (k) => (
                            <option key={k} value={k}>
                              {STATUS_LABEL[k]}
                            </option>
                          )
                        )}
                      </select>

                      {it.lastUpdated && (
                        <div className="meta">
                          อัปเดตล่าสุด:{" "}
                          {new Date(it.lastUpdated).toLocaleString()}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <span className={`chip ${chipClass(it.status)}`}>
                        {STATUS_LABEL[it.status]}
                      </span>

                      {/* เหตุผลไม่ผ่าน */}
                      {it.status === "rejected" && it.rejectReason && (
                        <div className="meta" style={{ color: "#b91c1c" }}>
                          เหตุผล: {it.rejectReason}
                        </div>
                      )}

                      {it.lastUpdated && (
                        <div className="meta">
                          อัปเดตล่าสุด:{" "}
                          {new Date(it.lastUpdated).toLocaleString()}
                        </div>
                      )}

                      {/* Timeline */}
                      {it.history && it.history.length > 0 && (
                        <details style={{ marginTop: 6 }}>
                          <summary
                            style={{
                              cursor: "pointer",
                              fontSize: 12,
                              color: "#2563eb",
                              fontWeight: 700,
                            }}
                          >
                            ดูประวัติการพิจารณา
                          </summary>
                          <ul style={{ fontSize: 12, marginTop: 6 }}>
                            {it.history.map((h, i) => (
                              <li key={i}>
                                {new Date(h.at).toLocaleString()} –{" "}
                                {STATUS_LABEL[h.status]} ({h.by})
                                {h.reason && ` : ${h.reason}`}
                              </li>
                            ))}
                          </ul>
                        </details>
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
        .doc-table{width:100%;border-collapse:separate;border-spacing:0}
        .doc-table th,.doc-table td{padding:10px 12px;border-bottom:1px solid rgba(0,0,0,.06);background:#fff}
        thead th{background:#f9fafb;font-weight:800}
        .row:hover td{background:#fcfcff}
        .meta{font-size:12px;color:#6b7280;margin-top:4px}
        .pill{padding:4px 10px;border-radius:999px;font-weight:800}
        .due-green{background:#ECFDF5;color:#065F46;border:1px solid #6EE7B7}
        .due-yellow{background:#FFF7ED;color:#9A3412;border:1px solid #FDBA74}
        .due-red,.expired{background:#FEF2F2;color:#B91C1C;border:1px solid #FCA5A5}
        .btn-light{height:34px;padding:0 12px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;cursor:pointer;font-weight:700}
        .file-wrap{display:flex;align-items:center;gap:8px}
        .file-chip{background:#EFF6FF;color:#1E40AF;border:1px solid #93C5FD;border-radius:999px;padding:4px 10px;font-weight:700}
        .icon-btn{width:30px;height:30px;border-radius:8px;border:1px solid #FCA5A5;background:#FEF2F2;color:#B91C1C;cursor:pointer}
        .chip.waiting{background:#EFF6FF;color:#1E40AF;border:1px solid #93C5FD}
        .chip.under{background:#FFF7ED;color:#9A3412;border:1px solid #FDBA74}
        .chip.appr{background:#ECFDF5;color:#065F46;border:1px solid #6EE7B7}
        .chip.rej{background:#FEF2F2;color:#B91C1C;border:1px solid #FCA5A5}
        .muted{color:#6b7280;font-weight:700}
      `}</style>
    </div>
  );
}

function revisionCount(it: DocumentItem) {
  return (it.history || []).filter(
    (h: DocumentHistory) => h.status === "rejected"
  ).length;
}

function UploadedFile({
  it,
  onRemove,
}: {
  it: DocumentItem;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="file-wrap">
      <span className="file-chip">{truncateMiddle(it.fileName!, 24)}</span>
      <button className="icon-btn" onClick={() => onRemove(it.id)}>
        ✕
      </button>
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

function Th({ children }: React.PropsWithChildren) {
  return <th style={{ textAlign: "left" }}>{children}</th>;
}
function Td({
  children,
  strong,
  className,
}: React.PropsWithChildren<{
  strong?: boolean;
  className?: string;
}>) {
  return (
    <td
      className={className}
      style={{ fontWeight: strong ? 700 : 500 }}
    >
      {children}
    </td>
  );
}
