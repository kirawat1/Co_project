-- CreateTable
CREATE TABLE `CoopApplicationForm` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `contactAddress` TEXT NULL,
    `contactPhone` VARCHAR(191) NULL,
    `contactEmail` VARCHAR(191) NULL,
    `emergencyName` VARCHAR(191) NULL,
    `emergencyRelation` VARCHAR(191) NULL,
    `emergencyJob` VARCHAR(191) NULL,
    `emergencyWorkplace` VARCHAR(191) NULL,
    `emergencyAddress` TEXT NULL,
    `emergencyPhone` VARCHAR(191) NULL,
    `emergencyEmail` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `careerObjective1` VARCHAR(191) NULL,
    `careerObjective2` VARCHAR(191) NULL,
    `careerObjective3` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CoopApplicationForm_studentId_key`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CoopApplicationForm` ADD CONSTRAINT `CoopApplicationForm_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
