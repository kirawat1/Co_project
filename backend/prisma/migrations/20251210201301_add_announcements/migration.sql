/*
  Warnings:

  - The primary key for the `announcement` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `attachmentData` on the `announcement` table. All the data in the column will be lost.
  - You are about to drop the column `attachmentMime` on the `announcement` table. All the data in the column will be lost.
  - You are about to drop the column `attachmentName` on the `announcement` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `announcement` DROP PRIMARY KEY,
    DROP COLUMN `attachmentData`,
    DROP COLUMN `attachmentMime`,
    DROP COLUMN `attachmentName`,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- CreateTable
CREATE TABLE `AnnFile` (
    `id` VARCHAR(191) NOT NULL,
    `announcementId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AnnFile` ADD CONSTRAINT `AnnFile_announcementId_fkey` FOREIGN KEY (`announcementId`) REFERENCES `Announcement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
