-- CreateTable
CREATE TABLE `Announcement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `body` VARCHAR(191) NULL,
    `year` VARCHAR(191) NOT NULL,
    `linkUrl` VARCHAR(191) NULL,
    `attachmentData` VARCHAR(191) NULL,
    `attachmentName` VARCHAR(191) NULL,
    `attachmentMime` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
