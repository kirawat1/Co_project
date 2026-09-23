import { useEffect, useRef } from "react";

/* ============================================================
   ConfirmDialog — แทน window.confirm()
   ใช้งาน:
   <ConfirmDialog
     open={showConfirm}
     title="ยืนยันการลบ"
     message="ต้องการลบรายการนี้ใช่หรือไม่?"
     confirmLabel="ลบ"
     confirmColor="#ef4444"
     onConfirm={() => { doDelete(); setShowConfirm(false); }}
     onCancel={() => setShowConfirm(false)}
   />
============================================================ */

interface Props {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  icon?: string;
  /** ค่าเริ่มต้น 10000 — กล่องยืนยันกลาง (askConfirm) ใช้ค่าสูงกว่าเพื่อลอยเหนือ modal อื่น */
  zIndex?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title = "ยืนยัน",
  message,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  confirmColor = "#0074B7",
  icon = "❓",
  zIndex = 10000,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // โฟกัสปุ่มยกเลิกเมื่อเปิด — กด Enter พลาดจะไม่ลบ/ส่งโดยไม่ตั้งใจ
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open, message]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex,
        background: "rgba(15,23,42,.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        style={{
          background: "var(--surface, #fff)",
          borderRadius: 20, padding: "32px 28px",
          maxWidth: 440, width: "100%",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,.3)",
          animation: "confirmIn .2s ease",
          textAlign: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
        <h3 style={{
          margin: "0 0 10px",
          fontSize: 20, fontWeight: 800,
          color: "var(--text, #0f172a)",
        }}>{title}</h3>
        <p style={{
          margin: "0 0 28px",
          fontSize: 15, lineHeight: 1.6,
          color: "var(--text-muted, #64748b)",
          whiteSpace: "pre-line", wordBreak: "break-word",
        }}>{message}</p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            ref={cancelRef}
            className="btn-secondary"
            onClick={onCancel}
            style={{ flex: 1, maxWidth: 160 }}
          >{cancelLabel}</button>
          <button
            className="btn"
            onClick={onConfirm}
            style={{ flex: 1, maxWidth: 160, background: confirmColor }}
          >{confirmLabel}</button>
        </div>
      </div>
      <style>{`@keyframes confirmIn { from { opacity:0; transform:scale(.92); } to { opacity:1; transform:scale(1); } }`}</style>
    </div>
  );
}
