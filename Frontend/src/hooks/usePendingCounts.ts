import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { apiFetch } from "../utils/apiFetch";

// ป้ายตัวเลขบนเมนู/แผงงานที่รอของเจ้าหน้าที่และอาจารย์ = งานที่รออยู่จริง (backend นับตามขอบเขตหลักสูตร เงื่อนไขเดียวกับหน้ารายการ)
// เดิมนับแจ้งเตือนที่ยังไม่อ่าน: กดเมนูครั้งเดียวหายทั้งที่งานยังค้าง · คนอื่นทำไปแล้วตัวเลขไม่ลด
export type PendingKey =
  | "coopApplications" | "t000" | "t002" | "t003" | "supervisionManager" | "feedback"
  | "teacherRequests" | "teacherSupervision";
export type PendingCounts = Partial<Record<PendingKey, number>>;

export function usePendingCounts(): PendingCounts {
  const [pending, setPending] = useState<PendingCounts>({});
  const { pathname } = useLocation();

  // โหลดใหม่ทุกครั้งที่เปลี่ยนหน้า — ทำงานเสร็จแล้วไปหน้าอื่น ตัวเลขลดทันที (ไม่ต้องรอรอบ 1 นาที)
  useEffect(() => {
    if (!localStorage.getItem("coop.token")) return;
    let alive = true;
    const load = () =>
      apiFetch("/api/notifications/pending")
        .then(r => r.json())
        .then(d => { if (alive && d?.ok) setPending(d.pending ?? {}); })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, [pathname]);

  return pending;
}
