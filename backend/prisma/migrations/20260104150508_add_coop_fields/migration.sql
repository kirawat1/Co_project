/*
  Warnings:

  - Added the required column `endDate` to the `StudentCoop` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jobDescription` to the `StudentCoop` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `StudentCoop` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `company` MODIFY `pastYears` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `document` ADD COLUMN `fileName` VARCHAR(191) NULL,
    ADD COLUMN `studentCoopId` INTEGER NULL;

-- AlterTable
ALTER TABLE `mentor` MODIFY `department` VARCHAR(191) NULL,
    MODIFY `position` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `studentcoop` ADD COLUMN `endDate` DATETIME(3) NOT NULL,
    ADD COLUMN `jobDescription` TEXT NOT NULL,
    ADD COLUMN `rejectReason` TEXT NULL,
    ADD COLUMN `startDate` DATETIME(3) NOT NULL,
    ADD COLUMN `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED') NOT NULL DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_studentCoopId_fkey` FOREIGN KEY (`studentCoopId`) REFERENCES `StudentCoop`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
