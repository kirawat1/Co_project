-- CreateTable
-- เรื่องที่ผู้ใช้แจ้งจากปุ่ม "แจ้งปัญหา" พร้อมบริบทตอนแจ้ง
CREATE TABLE `Feedback` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `message` TEXT NOT NULL,
    `pagePath` VARCHAR(300) NULL,
    `contextNote` VARCHAR(300) NULL,
    `userAgent` VARCHAR(300) NULL,
    `imagePath` VARCHAR(300) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'NEW',
    `staffReply` TEXT NULL,
    `handledById` INTEGER NULL,
    `handledName` VARCHAR(200) NULL,
    `handledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Feedback_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Feedback_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Feedback` ADD CONSTRAINT `Feedback_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
