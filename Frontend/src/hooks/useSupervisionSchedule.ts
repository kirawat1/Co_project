import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import type { CalendarEvent } from "../components/SupervisionCalendar";

/**
 * ข้อมูลปฏิทิน/ตารางนิเทศจากแหล่งเดียว (GET /api/coop/supervision/calendar) — มีชื่ออาจารย์ผู้นิเทศ,
 * อาจารย์ร่วม, ช่วงเวลาเริ่ม-สิ้นสุด, เช้า/บ่าย ที่ backend คำนวณให้
 *
 * เดิมหน้าเจ้าหน้าที่/อาจารย์สร้าง event เองจาก /api/admin/supervisions ซึ่งไม่มีฟิลด์เหล่านี้
 * ตารางนิเทศเลยแสดงเวลาและผู้นิเทศเป็น "-"
 *
 * `source` = รายการนิเทศของหน้านั้น: ใช้เป็นตัวบอกให้โหลดใหม่เมื่อรายการถูกรีเฟรช (แก้วัน/ออกหนังสือ ฯลฯ)
 * และเติมลิงก์ออนไลน์ (API ปฏิทินไม่ส่งลิงก์ประชุม เพราะนักศึกษาทุกคนเรียกได้)
 */
export function useSupervisionSchedule<T extends { id: number; onlineLink?: string | null }>(
    source: T[],
    enabled = true,
): CalendarEvent[] {
    const [events, setEvents] = useState<CalendarEvent[]>([]);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        apiFetch("/api/coop/supervision/calendar")
            .then((r) => r.json())
            .then((d) => { if (!cancelled && d?.ok && Array.isArray(d.events)) setEvents(d.events); })
            .catch(() => { /* ปฏิทินโหลดไม่ได้ ไม่ให้หน้าอื่นพัง */ });
        return () => { cancelled = true; };
    }, [source, enabled]);

    return useMemo(() => {
        const linkById = new Map(source.map((s) => [s.id, s.onlineLink ?? null]));
        return events.map((ev) => ({ ...ev, onlineLink: linkById.get(ev.id) ?? null }));
    }, [events, source]);
}
