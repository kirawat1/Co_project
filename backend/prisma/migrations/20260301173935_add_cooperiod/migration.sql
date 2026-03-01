-- AlterTable
ALTER TABLE `studentcoop` ADD COLUMN `coopPeriodId` INTEGER NULL;

-- CreateTable
CREATE TABLE `CoopPeriod` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `academicYear` VARCHAR(191) NOT NULL,
    `semester` INTEGER NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CoopPeriod_academicYear_semester_key`(`academicYear`, `semester`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StudentCoop` ADD CONSTRAINT `StudentCoop_coopPeriodId_fkey` FOREIGN KEY (`coopPeriodId`) REFERENCES `CoopPeriod`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
