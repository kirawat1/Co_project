// เปลี่ยนอีเมลของบัญชีนักศึกษา/อาจารย์ — username ต้องเป็นอีเมลเดียวกันเสมอ
// login ด้วยอีเมล + รหัสผ่าน (อาจารย์ไม่ได้เข้าผ่าน SSO, นักศึกษาที่นำเข้า Excel ก็ใช้อีเมลเป็น username)
// ถ้าแก้อีเมลแล้ว username ค้างเป็นอีเมลเก่า อีเมลเก่านั้นจะถูกจองไว้ใช้ซ้ำไม่ได้ และข้อมูลบัญชีไม่ตรงกัน
// (เจ้าหน้าที่ตั้ง username เองได้ในหน้าจัดการเจ้าหน้าที่ และยังไม่มีหน้าแก้อีเมล — ไม่ได้ใช้ฟังก์ชันนี้)

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

/**
 * @param tx       prisma client หรือ transaction client
 * @param userId   id ของ User
 * @param rawEmail อีเมลใหม่ (ว่าง = ไม่เปลี่ยน)
 * @returns {{ changed: boolean, email?: string, oldEmail?: string }}
 * @throws  Error ที่มี is409 เมื่ออีเมลใหม่ชนกับอีเมลหรือ username ของบัญชีอื่น, is404 เมื่อไม่พบบัญชี
 */
async function changeUserEmail(tx, userId, rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (!email) return { changed: false };

  const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, username: true } });
  if (!user) throw Object.assign(new Error('ไม่พบบัญชีผู้ใช้'), { is404: true });
  if (normalizeEmail(user.email) === email) return { changed: false };

  const conflict = await tx.user.findFirst({
    where: { OR: [{ email }, { username: email }], NOT: { id: userId } },
    select: { id: true },
  });
  if (conflict) throw Object.assign(new Error(`อีเมล ${email} มีในระบบแล้ว`), { is409: true });

  await tx.user.update({ where: { id: userId }, data: { email, username: email } });
  return { changed: true, email, oldEmail: user.email };
}

module.exports = { changeUserEmail, normalizeEmail };
