// กำหนดส่งเอกสาร T005–T008 — วันที่ตายตัว (YYYY-MM-DD) ตั้งแยกหลักสูตรได้

/** จำนวนวันที่เหลือถึงสิ้นวันกำหนดส่ง (เวลาไทย) — 0 = วันนี้วันสุดท้าย · ติดลบ = เลยกำหนด */
export function daysLeft(deadline: string, now = new Date()): number {
    const today = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
    return Math.round((Date.parse(deadline) - Date.parse(today)) / 86_400_000);
}
