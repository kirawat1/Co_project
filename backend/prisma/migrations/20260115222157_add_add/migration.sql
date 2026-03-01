-- AlterTable
ALTER TABLE `studentcoop` ADD COLUMN `t000Comment` TEXT NULL,
    ADD COLUMN `t000Status` ENUM('WAITING', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'WAITING';

-- CreateTable
CREATE TABLE `SystemConfig` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
