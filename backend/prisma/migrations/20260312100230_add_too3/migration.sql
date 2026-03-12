-- CreateTable
CREATE TABLE `CoopT003Form` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `reportTitleTh` TEXT NULL,
    `reportTitleEn` TEXT NULL,
    `objectives` TEXT NULL,
    `expectedOutcomes` TEXT NULL,
    `significance` TEXT NULL,
    `references` TEXT NULL,
    `methodology` TEXT NULL,
    `scope` TEXT NULL,
    `otherSuggestions` TEXT NULL,
    `workPlan` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CoopT003Form_studentId_key`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CoopT003Form` ADD CONSTRAINT `CoopT003Form_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
