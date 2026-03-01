/*
  Warnings:

  - You are about to drop the column `filePath` on the `document` table. All the data in the column will be lost.
  - Added the required column `name` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `path` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `document` DROP COLUMN `filePath`,
    ADD COLUMN `name` VARCHAR(191) NOT NULL,
    ADD COLUMN `path` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `studentcoop` ADD COLUMN `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN `teacherComment` TEXT NULL;
