/*
  Warnings:

  - Added the required column `updatedAt` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `studentcoop` DROP FOREIGN KEY `StudentCoop_mentorId_fkey`;

-- AlterTable
ALTER TABLE `student` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `studentcoop` MODIFY `mentorId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `StudentCoop` ADD CONSTRAINT `StudentCoop_mentorId_fkey` FOREIGN KEY (`mentorId`) REFERENCES `Mentor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
