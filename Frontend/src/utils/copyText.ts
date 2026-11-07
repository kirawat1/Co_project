/**
 * คัดลอกข้อความ — คืน true เมื่อคัดลอกได้จริง
 * navigator.clipboard ใช้ได้เฉพาะหน้า https/localhost และผู้ใช้อนุญาต · ไม่ได้ → วิธีเดิม (execCommand)
 * (เดิมหน้า T005–T008 เรียก writeText ไม่ดักผล: ไม่มีสิทธิ์/หน้า http = หน้าเว็บมี error ค้าง และขึ้น "Copied!" ทั้งที่ไม่ได้คัดลอก)
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* ไปวิธีเดิม */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
