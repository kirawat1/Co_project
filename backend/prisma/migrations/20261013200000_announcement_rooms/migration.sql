-- ประกาศแบบห้องเรียน: ปักหมุด · ผู้โพสต์ · ตั้งเวลาเผยแพร่ · กันแจ้งเตือนซ้ำ
-- AlterTable
ALTER TABLE `Announcement` ADD COLUMN `authorId` INTEGER NULL,
    ADD COLUMN `notifiedAt` DATETIME(3) NULL,
    ADD COLUMN `pinned` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `publishAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Announcement_year_idx` ON `Announcement`(`year`);

-- ประกาศเดิมถือว่าเผยแพร่และแจ้งไปแล้ว — ไม่ส่งแจ้งเตือนย้อนหลัง
UPDATE `Announcement` SET `notifiedAt` = `createdAt` WHERE `notifiedAt` IS NULL;
