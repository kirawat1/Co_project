// ออกจากระบบ / token ใช้ไม่ได้แล้ว: ลบ token และล้าง cookie เปิดไฟล์ (/uploads) ที่ backend ตั้งไว้
// เดิมลบแค่ token — cookie (httpOnly, JavaScript ลบเองไม่ได้) จะค้างให้คนถัดไปบนเครื่องเดียวกันเปิดไฟล์ของคนก่อนได้
export function clearSession() {
  localStorage.removeItem("coop.token");
  fetch("/api/auth/logout", { method: "POST", keepalive: true }).catch(() => {});
}
