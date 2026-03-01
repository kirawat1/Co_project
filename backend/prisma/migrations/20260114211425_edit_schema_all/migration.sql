/*
  Warnings:

  - You are about to drop the column `nationality` on the `student` table. All the data in the column will be lost.
  - You are about to drop the column `studyProgram` on the `student` table. All the data in the column will be lost.
  - You are about to drop the column `teacherComment` on the `studentcoop` table. All the data in the column will be lost.
  - You are about to alter the column `status` on the `studentcoop` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(2))` to `Enum(EnumId(3))`.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `username` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `studentcoop` DROP FOREIGN KEY `StudentCoop_companyId_fkey`;

-- DropIndex
DROP INDEX `User_email_key` ON `user`;

-- AlterTable
ALTER TABLE `announcement` MODIFY `body` TEXT NULL;

-- AlterTable
ALTER TABLE `company` ADD COLUMN `contactPerson` VARCHAR(191) NULL,
    ADD COLUMN `contactPosition` VARCHAR(191) NULL,
    MODIFY `address` TEXT NULL,
    MODIFY `email` VARCHAR(191) NULL,
    MODIFY `phone` VARCHAR(191) NULL,
    MODIFY `pastYears` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `mentor` MODIFY `department` VARCHAR(191) NULL,
    MODIFY `position` VARCHAR(191) NULL,
    MODIFY `email` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `student` DROP COLUMN `nationality`,
    DROP COLUMN `studyProgram`,
    ADD COLUMN `activityUnit` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `apiSyncedAt` DATETIME(3) NULL,
    ADD COLUMN `coreGpa` DOUBLE NULL DEFAULT 0.00,
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `firstNameEn` VARCHAR(191) NULL,
    ADD COLUMN `isPassPrepCourse` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isQualified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `lastNameEn` VARCHAR(191) NULL,
    MODIFY `gpa` DOUBLE NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE `studentcoop` DROP COLUMN `teacherComment`,
    ADD COLUMN `acceptanceFileUrl` VARCHAR(191) NULL,
    ADD COLUMN `actualEndDate` DATETIME(3) NULL,
    ADD COLUMN `actualStartDate` DATETIME(3) NULL,
    ADD COLUMN `jobPosition` VARCHAR(191) NULL,
    ADD COLUMN `placeDocDate` DATETIME(3) NULL,
    ADD COLUMN `placeDocNumber` VARCHAR(191) NULL,
    ADD COLUMN `placeLetterUrl` VARCHAR(191) NULL,
    ADD COLUMN `reqDocDate` DATETIME(3) NULL,
    ADD COLUMN `reqDocNumber` VARCHAR(191) NULL,
    ADD COLUMN `reqLetterUrl` VARCHAR(191) NULL,
    ADD COLUMN `staffCheckComment` TEXT NULL,
    ADD COLUMN `teacherCheckComment` TEXT NULL,
    ADD COLUMN `teacherCheckDate` DATETIME(3) NULL,
    MODIFY `companyId` VARCHAR(191) NULL,
    MODIFY `status` ENUM('APPLYING', 'QUALIFICATION_FAILED', 'QUALIFIED', 'WAITING_FOR_STAFF_CHECK', 'EDITS_REQUIRED', 'REQ_LETTER_ISSUED', 'WAITING_FOR_PLACEMENT_LETTER', 'PLACEMENT_LETTER_ISSUED', 'INTERNSHIP_STARTED') NOT NULL DEFAULT 'APPLYING';

-- AlterTable
ALTER TABLE `user` ADD COLUMN `kkuAccessToken` TEXT NULL,
    ADD COLUMN `provider` VARCHAR(191) NOT NULL DEFAULT 'credentials',
    ADD COLUMN `username` VARCHAR(191) NOT NULL,
    MODIFY `email` VARCHAR(191) NULL,
    MODIFY `password` VARCHAR(191) NULL,
    MODIFY `role` ENUM('student', 'teacher', 'staff', 'admin') NOT NULL DEFAULT 'student';

-- CreateTable
CREATE TABLE `CoopCriteria` (
    `id` VARCHAR(191) NOT NULL,
    `major` ENUM('CS', 'IT', 'GIS') NOT NULL,
    `minGpa` DOUBLE NOT NULL DEFAULT 2.00,
    `minCoreGpa` DOUBLE NOT NULL DEFAULT 2.00,
    `minActivityUnit` INTEGER NOT NULL DEFAULT 60,
    `requiredCourses` JSON NOT NULL,
    `coreCourses` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CoopCriteria_major_key`(`major`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `User_username_key` ON `User`(`username`);

-- AddForeignKey
ALTER TABLE `StudentCoop` ADD CONSTRAINT `StudentCoop_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
