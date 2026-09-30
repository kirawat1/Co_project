// ดาวน์โหลดหนังสือที่ออกแล้ว (ฉบับลงนาม) หลายฉบับพร้อมกันเป็น zip — ตามรอบที่เลือก + ตัวกรองหลักสูตรด้านบน
import { apiFetch } from "./apiFetch";
import { notify } from "./notify";

export type LetterType = "REQ" | "PLACE" | "SUPERVISION";

export const LETTER_LABEL: Record<LetterType, string> = {
    REQ: "หนังสือขอความอนุเคราะห์",
    PLACE: "หนังสือส่งตัว",
    SUPERVISION: "หนังสือขอนิเทศ",
};

/** @param periodId "all" หรือ id ของรอบสหกิจ */
export async function downloadLetterZip(type: LetterType, periodId: string | number = "all"): Promise<void> {
    const params = new URLSearchParams({ type, coopPeriodId: String(periodId || "all") });
    const res = await apiFetch(`/api/admin/letters/download?${params}`);
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        notify.warning(data?.message || "ดาวน์โหลดไม่สำเร็จ");
        return;
    }
    const count = Number(res.headers.get("X-Letter-Count") || 0);
    const missing = Number(res.headers.get("X-Letter-Missing") || 0);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${LETTER_LABEL[type]}_${periodId === "all" ? "ทุกรอบ" : `รอบ${periodId}`}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    if (missing) notify.warning(`ดาวน์โหลด ${count} ฉบับ · ไม่พบไฟล์ ${missing} คน (รายชื่ออยู่ในไฟล์ _ไม่พบไฟล์.txt ใน zip)`);
    else notify.success(`ดาวน์โหลด${LETTER_LABEL[type]} ${count} ฉบับ`);
}
