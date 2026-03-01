/*
  Warnings:

  - You are about to alter the column `type` on the `document` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(7))`.
  - The values [admin] on the enum `User_role` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `coopcriteria` MODIFY `minActivityUnit` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `document` ADD COLUMN `status` ENUM('WAITING', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'WAITING',
    MODIFY `type` ENUM('T000_SIGNED', 'TRANSCRIPT', 'STUDENT_CARD', 'CITIZEN_CARD', 'CV', 'OTHER') NOT NULL;

-- AlterTable
ALTER TABLE `student` ALTER COLUMN `studyProgram` DROP DEFAULT;

-- AlterTable
ALTER TABLE `user` MODIFY `role` ENUM('student', 'teacher', 'staff') NOT NULL DEFAULT 'student';

-- CreateTable
CREATE TABLE `CoopApplication` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `emergencyName` VARCHAR(191) NULL,
    `emergencyRelation` VARCHAR(191) NULL,
    `emergencyAddress` VARCHAR(191) NULL,
    `emergencyPhone` VARCHAR(191) NULL,
    `emergencyJob` VARCHAR(191) NULL,
    `jobObjectives` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CoopApplication_studentId_key`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CoopApplication` ADD CONSTRAINT `CoopApplication_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
