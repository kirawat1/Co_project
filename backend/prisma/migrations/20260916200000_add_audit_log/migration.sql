-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NULL,
    `role` VARCHAR(20) NULL,
    `actorName` VARCHAR(200) NULL,
    `action` VARCHAR(200) NOT NULL,
    `method` VARCHAR(10) NOT NULL,
    `path` VARCHAR(300) NOT NULL,
    `targetType` VARCHAR(50) NULL,
    `targetId` VARCHAR(50) NULL,
    `statusCode` INTEGER NOT NULL,
    `ip` VARCHAR(64) NULL,
    `detail` TEXT NULL,

    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    INDEX `AuditLog_userId_idx`(`userId`),
    INDEX `AuditLog_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

