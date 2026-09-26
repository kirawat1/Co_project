// ผู้ติดต่อฝั่งบริษัท (HR) — ใช้ร่วมกันทุกหน้า
export interface CompanyContact {
  id: string;
  firstName: string;
  lastName?: string;
  position?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  companyId?: string;
}

export const contactName = (c: Pick<CompanyContact, "firstName" | "lastName">) =>
  [c.firstName, c.lastName].map((s) => (s || "").trim()).filter(Boolean).join(" ");

export const contactLine = (c: CompanyContact) =>
  [contactName(c), c.position, c.department, c.phone, c.email].map((s) => (s || "").trim()).filter(Boolean).join(" · ");

// คำร้องที่ยื่นก่อนมีผู้ติดต่อ (หรือผู้ติดต่อถูกลบ) — เตือนเจ้าหน้าที่ ไม่ขวางงาน
export const missingContact = (coop?: { contacts?: unknown[] | null; companyId?: string | null } | null) =>
  !!coop?.companyId && (coop.contacts?.length ?? 0) === 0;
