-- AlterTable
-- สำเนารหัสผ่านแบบถอดได้ (AES-256-GCM) ให้เจ้าหน้าที่กดดูรหัสผ่านนักศึกษา/อาจารย์ — utils/passwordVault.js
ALTER TABLE `User` ADD COLUMN `passwordEnc` TEXT NULL;
