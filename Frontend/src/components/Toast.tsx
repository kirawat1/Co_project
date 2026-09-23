import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { registerToastSink, registerConfirmSink, cleanMessage, type ConfirmRequest } from "../utils/notify";

/* ============================================================
   Toast Notification System
   ใช้งาน: const toast = useToast(); toast.success("บันทึกสำเร็จ");
   หรือจากที่ไหนก็ได้: import { notify } from "../utils/notify"; notify.success("…")
   ข้อความผิดพลาดค้างนานกว่า (อ่านทัน) · ข้อความซ้ำกันไม่ซ้อน · แสดงพร้อมกันไม่เกิน 3 อัน
============================================================ */

type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  warning: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, string> = {
  success: "✅",
  error: "❌",
  info: "ℹ️",
  warning: "⚠️",
};

const COLORS: Record<ToastType, { bg: string; border: string; text: string }> = {
  success: { bg: "#f0fdf4", border: "#22c55e", text: "#166534" },
  error:   { bg: "#fef2f2", border: "#ef4444", text: "#991b1b" },
  info:    { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" },
  warning: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" },
};

const DARK_COLORS: Record<ToastType, { bg: string; border: string; text: string }> = {
  success: { bg: "rgba(22,163,74,.2)",   border: "#22c55e", text: "#86efac" },
  error:   { bg: "rgba(239,68,68,.2)",   border: "#ef4444", text: "#fca5a5" },
  info:    { bg: "rgba(59,130,246,.2)",  border: "#3b82f6", text: "#93c5fd" },
  warning: { bg: "rgba(245,158,11,.2)",  border: "#f59e0b", text: "#fcd34d" },
};

// เวลาที่ค้างบนจอ — ผิดพลาด/คำเตือนต้องอ่านสาเหตุและวิธีแก้ จึงค้างนานกว่า
const DURATION: Record<ToastType, number> = {
  success: 4000,
  info: 5000,
  warning: 6000,
  error: 8000,
};
const MAX_VISIBLE = 3;

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const add = useCallback((type: ToastType, raw: string) => {
    const message = cleanMessage(raw);
    if (!message) return 0;
    const id = ++idCounter;
    setToasts((prev) => {
      // ข้อความเดิมยังค้างอยู่ (เช่นกดปุ่มซ้ำ) — แทนที่อันเดิม ไม่ซ้อนหลายอัน
      const rest = prev.filter((t) => {
        if (t.type === type && t.message === message) {
          clearTimeout(timers.current[t.id]);
          delete timers.current[t.id];
          return false;
        }
        return true;
      });
      const next = [...rest, { id, type, message }];
      for (const old of next.slice(0, Math.max(0, next.length - MAX_VISIBLE))) {
        clearTimeout(timers.current[old.id]);
        delete timers.current[old.id];
      }
      return next.slice(-MAX_VISIBLE);
    });
    timers.current[id] = setTimeout(() => remove(id), DURATION[type]);
    return id;
  }, [remove]);

  // กล่องยืนยัน (askConfirm) — ต่อคิวทีละกล่อง
  const [confirms, setConfirms] = useState<ConfirmRequest[]>([]);
  const current = confirms[0];
  const answer = useCallback((ok: boolean) => {
    setConfirms((q) => {
      q[0]?.resolve(ok);
      return q.slice(1);
    });
  }, []);

  useEffect(() => {
    registerToastSink(add);
    registerConfirmSink((req) => setConfirms((q) => [...q, req]));
    return () => {
      registerToastSink(null);
      registerConfirmSink(null);
    };
  }, [add]);

  const ctx: ToastContextValue = {
    success: (m) => add("success", m),
    error:   (m) => add("error",   m),
    info:    (m) => add("info",    m),
    warning: (m) => add("warning", m),
  };

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";

  return (
    <ToastContext.Provider value={ctx}>
      {children}

      <ConfirmDialog
        open={!!current}
        title={current?.title ?? (current?.danger ? "ยืนยันการลบ" : "ยืนยัน")}
        message={current?.message ?? ""}
        confirmLabel={current?.confirmLabel ?? "ยืนยัน"}
        cancelLabel={current?.cancelLabel ?? "ยกเลิก"}
        confirmColor={current?.danger ? "#dc2626" : undefined}
        icon={current?.icon ?? (current?.danger ? "🗑️" : "❓")}
        zIndex={100001}
        onConfirm={() => answer(true)}
        onCancel={() => answer(false)}
      />

      {/* Toast container */}
      <div role="status" aria-live="polite" style={{
        // เหนือ modal ทุกตัว (modal ในระบบใช้ 10000) — ไม่งั้นข้อความจากในหน้าต่างถูกบัง
        position: "fixed", top: 20, right: 20, zIndex: 100002,
        display: "flex", flexDirection: "column", gap: 10,
        maxWidth: 380, width: "calc(100vw - 40px)",
        pointerEvents: "none",
      }}>
        {toasts.map((t) => {
          const c = isDark ? DARK_COLORS[t.type] : COLORS[t.type];
          return (
            <div
              key={t.id}
              style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                background: c.bg, border: `1.5px solid ${c.border}`,
                borderRadius: 12, padding: "12px 16px",
                boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                animation: "toastIn .25s ease",
                pointerEvents: "all", cursor: "pointer",
              }}
              role={t.type === "error" ? "alert" : undefined}
              data-toast-type={t.type}
              onClick={() => remove(t.id)}
            >
              <span style={{ fontSize: 18, lineHeight: 1.3, flexShrink: 0 }}>{ICONS[t.type]}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: c.text, lineHeight: 1.45, whiteSpace: "pre-line", wordBreak: "break-word" }}>
                {t.message}
              </span>
              <button
                className="toast-close"
                aria-label="ปิดข้อความ"
                onClick={(e) => { e.stopPropagation(); remove(t.id); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: c.text, fontSize: 18, lineHeight: 1,
                  padding: 0, flexShrink: 0,
                }}
              >×</button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .toast-close { opacity: .6; transition: opacity .15s; }
        .toast-close:hover { opacity: 1; }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
