// ตัวกรองหลักสูตรบนแถบบนของหน้าจัดการ (/admin) — ส่งเป็น header X-Major-Filter ให้ backend กรองรายการ (ใช้ "ดู" เท่านั้น)
// จำค่าไว้ต่อเบราว์เซอร์ · ส่งเฉพาะตอนอยู่หน้า /admin (หน้าอาจารย์/นักศึกษาไม่โดนกรอง)
const KEY = "coop.adminMajorFilter";
export const NO_MAJOR = "__none__";

export function getMajorFilter(): string {
  try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
}

export function setMajorFilter(value: string) {
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

export function majorFilterHeader(): Record<string, string> {
  if (!window.location.pathname.startsWith("/admin")) return {};
  const v = getMajorFilter();
  return v ? { "X-Major-Filter": v } : {};
}
