-- เพิกถอน session ได้: เพิ่มเวอร์ชัน token ต่อบัญชี (token เดิมไม่มีเวอร์ชัน = 0 ใช้ต่อได้จนกว่าจะเปลี่ยนรหัสผ่าน)
-- AlterTable
ALTER TABLE `User` ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0;

