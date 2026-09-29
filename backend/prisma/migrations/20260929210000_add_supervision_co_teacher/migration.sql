-- CreateTable
CREATE TABLE `SupervisionCoTeacher` (
    `appointmentId` INTEGER NOT NULL,
    `teacherId` INTEGER NOT NULL,

    INDEX `SupervisionCoTeacher_teacherId_idx`(`teacherId`),
    PRIMARY KEY (`appointmentId`, `teacherId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SupervisionCoTeacher` ADD CONSTRAINT `SupervisionCoTeacher_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `SupervisionAppointment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupervisionCoTeacher` ADD CONSTRAINT `SupervisionCoTeacher_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `Teacher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: coTeacherName เดิมเก็บเป็นชื่อต่อกันด้วยลูกน้ำ ("คำนำหน้า+ชื่อ สกุล, ...") — จับคู่กลับเป็นบัญชีอาจารย์
-- เทียบแบบตัดช่องว่างทิ้งทั้งหมด (รูปแบบเดียวกับที่หน้าเลือกอาจารย์ร่วมบันทึก) · ชื่อที่ไม่ตรงบัญชีใดคงเป็นข้อความแสดงผลอย่างเดียว
INSERT IGNORE INTO `SupervisionCoTeacher` (`appointmentId`, `teacherId`)
SELECT a.`id`, t.`id`
FROM `SupervisionAppointment` a
JOIN `Teacher` t
  ON t.`id` <> a.`teacherId`
 AND FIND_IN_SET(
       REPLACE(CONCAT(IFNULL(t.`prefix`, ''), t.`firstName`, t.`lastName`), ' ', ''),
       REPLACE(a.`coTeacherName`, ' ', '')
     ) > 0
WHERE a.`coTeacherName` IS NOT NULL AND a.`coTeacherName` <> '';
