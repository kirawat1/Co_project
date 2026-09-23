/**
 * ที่อยู่แบบแยกช่อง — ใช้ร่วมกันทั้งใบสมัคร T000 และแบบฟอร์ม T002
 * รูปแบบข้อความรวมตรงกับ backend/utils/addressFormat.js (กรุงเทพฯ ใช้ แขวง/เขต)
 */
export interface AddressParts {
    addrNo?: string | null;
    moo?: string | null;
    soi?: string | null;
    road?: string | null;
    subDistrict?: string | null;
    district?: string | null;
    province?: string | null;
    zipcode?: string | null;
}

export const ADDRESS_FIELDS: { key: keyof AddressParts; label: string; required?: boolean; width?: string }[] = [
    { key: "addrNo", label: "บ้านเลขที่", required: true },
    { key: "moo", label: "หมู่" },
    { key: "soi", label: "ซอย" },
    { key: "road", label: "ถนน" },
    { key: "subDistrict", label: "ตำบล / แขวง", required: true },
    { key: "district", label: "อำเภอ / เขต", required: true },
    { key: "province", label: "จังหวัด", required: true },
    { key: "zipcode", label: "รหัสไปรษณีย์", required: true },
];

const BANGKOK = new Set(["กรุงเทพมหานคร", "กรุงเทพฯ", "กทม.", "กรุงเทพ"]);
const clean = (v: unknown) => String(v ?? "").trim();

export function composeAddress(parts: AddressParts = {}): string {
    const isBangkok = BANGKOK.has(clean(parts.province));
    const pieces = [
        clean(parts.addrNo),
        clean(parts.moo) && `หมู่ ${clean(parts.moo)}`,
        clean(parts.soi) && `ซอย${clean(parts.soi)}`,
        clean(parts.road) && `ถนน${clean(parts.road)}`,
        clean(parts.subDistrict) && (isBangkok ? `แขวง${clean(parts.subDistrict)}` : `ต.${clean(parts.subDistrict)}`),
        clean(parts.district) && (isBangkok ? `เขต${clean(parts.district)}` : `อ.${clean(parts.district)}`),
        clean(parts.province) && (isBangkok ? clean(parts.province) : `จ.${clean(parts.province)}`),
        clean(parts.zipcode),
    ];
    return pieces.filter(Boolean).join(" ");
}

export const hasAddressParts = (parts: AddressParts = {}) =>
    ADDRESS_FIELDS.some((f) => clean(parts[f.key]));

// อ่านช่องย่อยออกจาก object ของฟอร์ม เช่น prefix "contact" → contactAddrNo, contactMoo, ...
export function readAddressParts(form: Record<string, unknown>, prefix: string): AddressParts {
    const out: AddressParts = {};
    for (const f of ADDRESS_FIELDS) {
        const field = `${prefix}${String(f.key).charAt(0).toUpperCase()}${String(f.key).slice(1)}`;
        out[f.key] = (form[field] as string) ?? "";
    }
    return out;
}

export const addressFieldName = (prefix: string, key: keyof AddressParts) =>
    `${prefix}${String(key).charAt(0).toUpperCase()}${String(key).slice(1)}`;
