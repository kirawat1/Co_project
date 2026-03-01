/*
  Warnings:

  - You are about to drop the `coopapplication` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `coopapplication` DROP FOREIGN KEY `CoopApplication_studentId_fkey`;

-- AlterTable
ALTER TABLE `document` MODIFY `status` ENUM('WAITING', 'PENDING', 'APPROVED', 'REJECTED', 'EDITS_REQUIRED') NOT NULL DEFAULT 'WAITING';

-- AlterTable
ALTER TABLE `studentcoop` MODIFY `t000Status` ENUM('WAITING', 'PENDING', 'APPROVED', 'REJECTED', 'EDITS_REQUIRED') NOT NULL DEFAULT 'WAITING';

-- DropTable
DROP TABLE `coopapplication`;
