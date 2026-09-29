-- CreateTable
CREATE TABLE `CoopTeacherMajor` (
    `teacherId` INTEGER NOT NULL,
    `major` VARCHAR(191) NOT NULL,

    INDEX `CoopTeacherMajor_major_idx`(`major`),
    PRIMARY KEY (`teacherId`, `major`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CoopTeacherMajor` ADD CONSTRAINT `CoopTeacherMajor_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `Teacher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CoopTeacherMajor` ADD CONSTRAINT `CoopTeacherMajor_major_fkey` FOREIGN KEY (`major`) REFERENCES `CoopCriteria`(`major`) ON DELETE CASCADE ON UPDATE CASCADE;


-- ล้างข้อมูล: บางแถวเก็บหลักสูตรเป็นชื่อไทย ("วิทยาการคอมพิวเตอร์") แทนรหัส ("CS") — แปลงเป็นรหัสตามรายชื่อหลักสูตร
UPDATE `Student` s JOIN `CoopCriteria` c ON s.`major` = c.`nameTh` SET s.`major` = c.`major`;
UPDATE `Teacher` t JOIN `CoopCriteria` c ON t.`major` = c.`nameTh` SET t.`major` = c.`major`;

-- อาจารย์ประจำวิชาเดิม → ดูแลหลักสูตรของตัวเอง (หลักสูตรที่ไม่มีในรายชื่อหลักสูตร ต้องให้เจ้าหน้าที่กำหนดเองในหน้าจัดการอาจารย์)
INSERT IGNORE INTO `CoopTeacherMajor` (`teacherId`, `major`)
SELECT t.`id`, t.`major`
FROM `Teacher` t
JOIN `CoopCriteria` c ON c.`major` = t.`major`
WHERE t.`isCoopTeacher` = 1;
