import { useState, useEffect } from "react";
import { apiFetch } from "../utils/apiFetch";

export type NotifCounts = Record<string, number>;

export function useNotifCounts(): { counts: NotifCounts; markAllRead: () => Promise<void> } {
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

  const markAllRead = async () => {
    if (!token) return;
    try {
      await apiFetch("/api/notifications/mark-all-read", { method: "POST" });
      setCounts({});
    } catch { /* silent */ }
  };

  return { counts, markAllRead };
}
