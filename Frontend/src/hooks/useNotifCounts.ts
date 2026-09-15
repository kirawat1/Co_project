import { useState, useEffect } from "react";
import { apiFetch } from "../utils/apiFetch";

export type NotifCounts = Record<string, number>;

export function useNotifCounts(): {
  counts: NotifCounts;
  markRead: (types: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  sum: (types: string[]) => number;
} {
  const [counts, setCounts] = useState<NotifCounts>({});
  const token = localStorage.getItem("coop.token");

  useEffect(() => {
    if (!token) return;
    const fetchCounts = () =>
      apiFetch("/api/notifications/counts")
        .then(r => r.json())
        .then(d => setCounts(d.counts ?? {}))
        .catch(() => {});
    fetchCounts();
    const id = setInterval(fetchCounts, 60_000);
    return () => clearInterval(id);
  }, [token]);

  // กดเมนูไหน อ่านเฉพาะแจ้งเตือนชนิดของเมนูนั้น (เดิมอ่านทั้งหมด ป้ายเมนูอื่นหายไปด้วย)
  const markRead = async (types: string[]) => {
    if (!token || !types.some(t => counts[t])) return;
    setCounts(prev => {
      const next = { ...prev };
      for (const t of types) delete next[t];
      return next;
    });
    try {
      await apiFetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ types }),
      });
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    if (!token) return;
    try {
      await apiFetch("/api/notifications/mark-all-read", { method: "POST" });
      setCounts({});
    } catch { /* silent */ }
  };

  const sum = (types: string[]) => types.reduce((n, t) => n + (counts[t] ?? 0), 0);

  return { counts, markRead, markAllRead, sum };
}
