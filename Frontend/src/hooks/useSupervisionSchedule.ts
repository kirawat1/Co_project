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
 * `source` = รายการนิเทศของหน้านั้น (รูปแบบจาก /api/admin/supervisions): ใช้เป็นตัวบอกให้โหลดใหม่
 * เมื่อรายการถูกรีเฟรช, เติมลิงก์ออนไลน์ (API ปฏิทินไม่ส่งลิงก์ประชุมเพราะนักศึกษาทุกคนเรียกได้)
 * และเป็นข้อมูลสำรองถ้าโหลด API ปฏิทินไม่สำเร็จ (degraded = true) — ปฏิทินจะไม่ว่างเปล่าเงียบๆ
 */
type SupervisionLike = {
    id: number;
    onlineLink?: string | null;
    confirmedDate?: string | null;
    status?: string;
    supervisionType?: string;
    coTeacherName?: string | null;
    groupId?: string | null;
    student?: { studentId?: string; firstName?: string; lastName?: string; coop?: { company?: { name?: string } | null } | null };
    teacher?: { prefix?: string | null; firstName?: string; lastName?: string } | null;
};

const CONFIRMED = ["DATE_CONFIRMED", "LETTER_UPLOADED", "COMPLETED"];

// ข้อมูลสำรอง: ไม่มีช่วงเวลาสิ้นสุด/เช้า-บ่าย แต่ยังบอกได้ว่านิเทศใคร เมื่อไหร่ ใครนิเทศ
function toFallbackEvent(s: SupervisionLike): CalendarEvent | null {
    if (!s.confirmedDate || !CONFIRMED.includes(s.status || "")) return null;
    const t = s.teacher;
    return {
        id: s.id,
        confirmedDate: s.confirmedDate,
        studentId: s.student?.studentId,
        studentName: `${s.student?.firstName ?? ""} ${s.student?.lastName ?? ""}`.trim(),
        type: s.supervisionType === "ONLINE" ? "ONLINE" : "ONSITE",
        status: s.status,
        companyName: s.student?.coop?.company?.name ?? null,
        onlineLink: s.onlineLink ?? null,
        groupId: s.groupId ?? null,
        teacherName: t ? `${t.prefix ?? ""}${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() : undefined,
        coTeacherName: s.coTeacherName ?? null,
    };
}

export function useSupervisionSchedule<T extends SupervisionLike>(
    source: T[],
    enabled = true,
): { events: CalendarEvent[]; degraded: boolean } {
    const [events, setEvents] = useState<CalendarEvent[] | null>(null);
    const [degraded, setDegraded] = useState(false);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        apiFetch("/api/coop/supervision/calendar")
            .then(async (r) => {
                const d = await r.json().catch(() => null);
                if (cancelled) return;
                if (r.ok && d?.ok && Array.isArray(d.events)) {
                    setEvents(d.events);
                    setDegraded(false);
                } else {
                    setDegraded(true);
                }
            })
            .catch(() => { if (!cancelled) setDegraded(true); });
        return () => { cancelled = true; };
    }, [source, enabled]);

    const merged = useMemo(() => {
        if (degraded || events === null) {
            // ยังโหลดไม่เสร็จหรือโหลดไม่สำเร็จ → ใช้รายการที่หน้าโหลดมาแล้วแทน
            return source.map(toFallbackEvent).filter((e): e is CalendarEvent => e !== null);
        }
        const linkById = new Map(source.map((s) => [s.id, s.onlineLink ?? null]));
        return events.map((ev) => ({ ...ev, onlineLink: linkById.get(ev.id) ?? null }));
    }, [events, degraded, source]);

    return { events: merged, degraded };
}
