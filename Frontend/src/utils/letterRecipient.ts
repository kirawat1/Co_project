import { contactName, type CompanyContact } from "./contacts";

/** "ชื่อ ตำแหน่ง" สำหรับบรรทัด "เรียน" — ว่างถ้าไม่มีผู้รับ */
export const recipientText = (r: { name: string; position: string }) => [r.name, r.position].filter(Boolean).join(" ");

// ผู้รับหนังสือ ("เรียน …") — ผู้ติดต่อคนแรกของคำร้อง → ผู้ติดต่อเดิมของบริษัท (Company.contactPerson) → ว่าง
// เดิมหนังสือแต่ละฉบับอ่านเองและอ่านชื่อช่องผิด (contactPersonName / contactPersonPosition ไม่มีอยู่จริง) — ตำแหน่งไม่เคยขึ้น
export function letterRecipient(coop?: {
  contacts?: CompanyContact[] | null;
  company?: { contactPerson?: string | null; contactPosition?: string | null } | null;
} | null): { name: string; position: string } {
  const first = (coop?.contacts || []).find((c) => contactName(c));
  if (first) return { name: contactName(first), position: (first.position || "").trim() };
  return {
    name: (coop?.company?.contactPerson || "").trim(),
    position: (coop?.company?.contactPosition || "").trim(),
  };
}
