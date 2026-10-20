-- ปฏิทินของรอบ: กำหนดส่งต่อรอบ (ค่าวิทยาลัย) / รอบ × หลักสูตร (ค่าที่ใช้จริง) + ขยายเวลารายคน + เวลาส่งครั้งแรกของแต่ละขั้น
-- ทุกคอลัมน์ nullable — แถวเดิมไม่ต้องเติมค่า (ไม่มีค่า = ใช้ช่วงเวลาเดิมใน SystemConfig)
-- AlterTable
ALTER TABLE `CoopPeriod` ADD COLUMN `deadlines` JSON NULL;

-- AlterTable
ALTER TABLE `CoopPeriodMajor` ADD COLUMN `deadlines` JSON NULL;

-- AlterTable
ALTER TABLE `StudentCoop` ADD COLUMN `deadlineExtensions` JSON NULL,
    ADD COLUMN `submittedSteps` JSON NULL;
