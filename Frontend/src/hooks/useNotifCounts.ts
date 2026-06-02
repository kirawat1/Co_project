import { useState, useEffect } from "react";

export type NotifCounts = Record<string, number>;

export function useNotifCounts(): { counts: NotifCounts; markAllRead: () => Promise<void> } {
  const [counts, setCounts] = useState<NotifCounts>({});
  const token = localStorage.getItem("coop.token");

  useEffect(() => {
    if (!token) return;
    fetch("/api/notifications/counts", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setCounts(d.counts ?? {}))
      .catch(() => {});
  }, [token]);

  const markAllRead = async () => {
    if (!token) return;
    try {
      await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setCounts({});
    } catch { /* silent */ }
  };

  return { counts, markAllRead };
}
