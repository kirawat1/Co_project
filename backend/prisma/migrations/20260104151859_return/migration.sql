/*
  Warnings:

  - You are about to drop the column `fileName` on the `document` table. All the data in the column will be lost.
  - You are about to drop the column `studentCoopId` on the `document` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `studentcoop` table. All the data in the column will be lost.
  - You are about to drop the column `jobDescription` on the `studentcoop` table. All the data in the column will be lost.
  - You are about to drop the column `rejectReason` on the `studentcoop` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `studentcoop` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `studentcoop` table. All the data in the column will be lost.
  - Made the column `pastYears` on table `company` required. This step will fail if there are existing NULL values in that column.
  - Made the column `department` on table `mentor` required. This step will fail if there are existing NULL values in that column.
  - Made the column `position` on table `mentor` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `document` DROP FOREIGN KEY `Document_studentCoopId_fkey`;

-- AlterTable
ALTER TABLE `company` MODIFY `pastYears` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `document` DROP COLUMN `fileName`,
    DROP COLUMN `studentCoopId`;

-- AlterTable
ALTER TABLE `mentor` MODIFY `department` VARCHAR(191) NOT NULL,
    MODIFY `position` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `studentcoop` DROP COLUMN `endDate`,
    DROP COLUMN `jobDescription`,
    DROP COLUMN `rejectReason`,
    DROP COLUMN `startDate`,
    DROP COLUMN `status`;
