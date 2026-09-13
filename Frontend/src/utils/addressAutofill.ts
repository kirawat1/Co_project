import { provinceFromZipcode } from "./zipcodeProvince";

type AddressLike = { zipcode?: string | null; province?: string | null };

/**
 * อัปเดตช่องในฟอร์มที่อยู่ 1 ช่อง — ถ้าเป็นช่องรหัสไปรษณีย์ จะเติมจังหวัดให้อัตโนมัติ
 *
 * เติมเฉพาะเมื่อช่องจังหวัดยังว่าง หรือยังเป็นค่าที่ระบบเติมให้จากรหัสเดิม
 * (แก้รหัสแล้วจังหวัดเปลี่ยนตาม) แต่ไม่ทับจังหวัดที่ผู้ใช้พิมพ์เอง
 * รหัสที่ไม่แน่ใจ (ไม่ครบ 5 หลัก / ใช้ร่วมหลายจังหวัด) จะไม่แตะช่องจังหวัดเลย
 */
export function applyAddressChange<T extends AddressLike>(form: T, name: string, value: string): T {
  const next = { ...form, [name]: value } as T;
  if (name !== "zipcode") return next;

  const auto = provinceFromZipcode(value);
  if (!auto) return next;

  const current = String(form.province ?? "").trim();
  const previousAuto = provinceFromZipcode(form.zipcode);
  if (!current || current === previousAuto) next.province = auto;
  return next;
}
