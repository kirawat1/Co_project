// ดาวน์โหลดหนังสือที่ออกแล้ว (ฉบับลงนาม) หลายฉบับเป็น zip
// ขั้นตอน: summary (หน้าต่างยืนยัน — กี่ฉบับ ขนาดเท่าไร ใครบ้าง) → ขอลิงก์ → เบราว์เซอร์ดาวน์โหลดเอง
// (เดิม fetch แล้วรอ res.blob() — ไฟล์สแกนฉบับละ 10–30 MB รวมหลายร้อย MB ค้างที่ "กำลังเตรียมไฟล์" ไม่เห็นความคืบหน้า)
import { apiFetch } from "./apiFetch";

export type LetterType = "REQ" | "PLACE" | "SUPERVISION";

export const LETTER_LABEL: Record<LetterType, string> = {
    REQ: "หนังสือขอความอนุเคราะห์",
    PLACE: "หนังสือส่งตัว",
    SUPERVISION: "หนังสือขอนิเทศ",
};

export interface LetterZipFilter {
    type: LetterType;
    periodId: string;   // "all" หรือ id รอบ
    major: string;      // "" = ทุกหลักสูตร (ในขอบเขตสิทธิ์) · "__none__" = ยังไม่ระบุหลักสูตร
}

export interface LetterZipSummary {
    label: string;
    fileName: string;
    count: number;
    totalBytes: number;
    students: { studentId: string; name: string; major: string | null; size: number }[];
    missing: { studentId: string; name: string }[];
}

const params = (f: LetterZipFilter) => ({ type: f.type, coopPeriodId: f.periodId || "all", major: f.major });

export async function fetchLetterZipSummary(f: LetterZipFilter): Promise<LetterZipSummary> {
    const res = await apiFetch(`/api/admin/letters/summary?${new URLSearchParams(params(f))}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.message || "โหลดรายการหนังสือไม่สำเร็จ");
    return data;
}

/** ขอลิงก์ (อายุ 5 นาที) แล้วให้เบราว์เซอร์ดาวน์โหลดเอง — แสดงความคืบหน้าที่แถบดาวน์โหลด ไม่ต้องโหลดทั้งก้อนเข้าหน่วยความจำ */
export async function startLetterZipDownload(f: LetterZipFilter): Promise<void> {
    const res = await apiFetch("/api/admin/letters/download-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params(f)),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.url) throw new Error(data?.message || "ดาวน์โหลดไม่สำเร็จ");
    const a = document.createElement("a");
    a.href = data.url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export function formatBytes(n: number): string {
    if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
    if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
    return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
