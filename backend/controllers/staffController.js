const prisma = require('../config/prismaClient');
const bcrypt = require('bcryptjs');

// GET /api/admin/staff
exports.listStaff = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'staff' },
      include: { staffProfile: true },
      orderBy: { id: 'asc' },
    });
    res.json({ ok: true, staff: users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
};

// POST /api/admin/staff
exports.createStaff = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, phone } = req.body;
    if (!username || !email || !password || !firstName || !lastName)
      return res.status(400).json({ ok: false, message: 'กรุณากรอกข้อมูลให้ครบ' });

    const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
    if (existing)
      return res.status(409).json({ ok: false, message: 'username หรือ email นี้มีอยู่ในระบบแล้ว' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { username, email, password: hashed, role: 'staff' } });
      await tx.staffProfile.create({ data: { userId: u.id, firstName, lastName, phone: phone || null } });
      return u;
    });

    const result = await prisma.user.findUnique({ where: { id: user.id }, include: { staffProfile: true } });
    res.status(201).json({ ok: true, staff: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
};

// PATCH /api/admin/staff/:id/password
exports.resetPassword = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
    const { password } = req.body;
    if (!password || password.length < 6)
      return res.status(400).json({ ok: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== 'staff')
      return res.status(404).json({ ok: false, message: 'ไม่พบเจ้าหน้าที่' });

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id }, data: { password: hashed } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
};

// DELETE /api/admin/staff/:id
exports.deleteStaff = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== 'staff')
      return res.status(404).json({ ok: false, message: 'ไม่พบเจ้าหน้าที่' });

    await prisma.user.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
};
