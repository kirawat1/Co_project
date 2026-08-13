function validatePassword(password) {
  if (!password || password.length < 8)
    return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
  if (!/[A-Z]/.test(password))
    return 'รหัสผ่านต้องมีตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว (A-Z)';
  if (!/[a-z]/.test(password))
    return 'รหัสผ่านต้องมีตัวอักษรพิมพ์เล็กอย่างน้อย 1 ตัว (a-z)';
  if (!/\d/.test(password))
    return 'รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว (0-9)';
  if (!/[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/.test(password))
    return 'รหัสผ่านต้องมีอักขระพิเศษอย่างน้อย 1 ตัว เช่น !@#$%^&*';
  return null;
}

module.exports = { validatePassword };
