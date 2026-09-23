/**
 * formPhotoController.js — รูปถ่ายนักศึกษาในใบสมัคร T000
 *
 * ใบสมัครมีกรอบ "รูปถ่าย" มุมขวาบน เดิมต้องพิมพ์ออกไปแปะรูปเอง
 * ตอนนี้อัปโหลดเก็บไว้กับใบสมัคร แล้วตัวสร้าง PDF วาดลงกรอบให้เลย
 * หน้าเว็บย่อ/ครอปเป็นสัดส่วนรูปติดบัตรมาก่อน (ไฟล์เล็ก PDF ไม่บวม) — ฝั่งนี้ตรวจชนิดและขนาดซ้ำ
 */
const fs = require('fs');
const path = require('path');
const prisma = require('../config/prismaClient');

const UPLOAD_DIR = path.join(__dirname, '../uploads');

async function studentIdOf(userId) {
  const student = await prisma.student.findUnique({ where: { userId }, select: { id: true, deletedAt: true } });
  if (!student || student.deletedAt) return null;
  return student.id;
}

// ลบไฟล์เก่า — เฉพาะชื่อไฟล์ในโฟลเดอร์ uploads เท่านั้น กันถูกหลอกให้ลบไฟล์อื่น
function removeUploadFile(fileName) {
  if (!fileName) return;
  const safe = path.basename(String(fileName));
  const full = path.join(UPLOAD_DIR, safe);
  if (!full.startsWith(UPLOAD_DIR)) return;
  try { fs.unlinkSync(full); } catch (_) { /* ไม่มีไฟล์แล้วก็ไม่เป็นไร */ }
}

// POST /api/docs/form-photo — อัปโหลด/เปลี่ยนรูปถ่าย
exports.uploadFormPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: 'กรุณาเลือกรูปถ่าย (JPG หรือ PNG)' });

    const studentId = await studentIdOf(req.user.id);
    if (!studentId) {
      removeUploadFile(req.file.filename);
      return res.status(404).json({ ok: false, message: 'ไม่พบข้อมูลนักศึกษา' });
    }

    const current = await prisma.coopApplicationForm.findUnique({ where: { studentId }, select: { photoPath: true } });
    const form = await prisma.coopApplicationForm.upsert({
      where: { studentId },
      update: { photoPath: req.file.filename },
      create: { studentId, photoPath: req.file.filename },
      select: { photoPath: true },
    });
    // เปลี่ยนรูป → ลบรูปเก่าทิ้ง ไม่ให้ไฟล์ค้าง
    if (current?.photoPath && current.photoPath !== form.photoPath) removeUploadFile(current.photoPath);

    res.json({ ok: true, message: 'อัปโหลดรูปถ่ายเรียบร้อย', data: { photoPath: form.photoPath } });
  } catch (err) {
    if (req.file) removeUploadFile(req.file.filename);
    console.error('uploadFormPhoto error:', err);
    res.status(500).json({ ok: false, message: 'อัปโหลดรูปถ่ายไม่สำเร็จ' });
  }
};

// DELETE /api/docs/form-photo — ลบรูปถ่าย
exports.deleteFormPhoto = async (req, res) => {
  try {
    const studentId = await studentIdOf(req.user.id);
    if (!studentId) return res.status(404).json({ ok: false, message: 'ไม่พบข้อมูลนักศึกษา' });

    const current = await prisma.coopApplicationForm.findUnique({ where: { studentId }, select: { photoPath: true } });
    if (!current?.photoPath) return res.json({ ok: true, message: 'ไม่มีรูปถ่ายให้ลบ' });

    await prisma.coopApplicationForm.update({ where: { studentId }, data: { photoPath: null } });
    removeUploadFile(current.photoPath);
    res.json({ ok: true, message: 'ลบรูปถ่ายเรียบร้อย' });
  } catch (err) {
    console.error('deleteFormPhoto error:', err);
    res.status(500).json({ ok: false, message: 'ลบรูปถ่ายไม่สำเร็จ' });
  }
};
