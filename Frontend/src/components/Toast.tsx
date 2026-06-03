import { createContext, useContext, useState, useCallback, useRef } from "react";

/* ============================================================
   Toast Notification System
   ใช้งาน: const toast = useToast(); toast.success("บันทึกสำเร็จ");
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

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const add = useCallback((type: ToastType, message: string) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
    timers.current[id] = setTimeout(() => remove(id), 4000);
    return id;
  }, [remove]);

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

      {/* Toast container */}
      <div style={{
        position: "fixed", top: 20, right: 20, zIndex: 9999,
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
              onClick={() => remove(t.id)}
            >
              <span style={{ fontSize: 18, lineHeight: 1.3, flexShrink: 0 }}>{ICONS[t.type]}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: c.text, lineHeight: 1.45 }}>
                {t.message}
              </span>
              <button
                onClick={() => remove(t.id)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: c.text, fontSize: 18, lineHeight: 1, opacity: 0.6,
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
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
