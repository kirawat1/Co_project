// หัวข้อเอกสาร T000 แยกตามหลักสูตร — ตรงกับ backend/utils/docRequirementScope.js
// majors ว่าง = หัวข้อกลาง (ทุกหลักสูตร) · excludedMajors = หลักสูตรที่ปิดหัวข้อกลางนี้
export interface MajorRules { majors?: string[]; excludedMajors?: string[] }

export function appliesTo(r: MajorRules, major?: string | null): boolean {
  const majors = r.majors ?? [];
  if (majors.length > 0) return !!major && majors.includes(major);
  return !major || !(r.excludedMajors ?? []).includes(major);
}
