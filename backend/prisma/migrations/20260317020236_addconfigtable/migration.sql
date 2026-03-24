/*
  Warnings:

  - The primary key for the `systemconfig` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[key]` on the table `SystemConfig` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id` to the `SystemConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `SystemConfig` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `supervisionappointment` ADD COLUMN `coTeacherName` TEXT NULL,
    ADD COLUMN `onlineLink` TEXT NULL;

-- AlterTable
ALTER TABLE `systemconfig` DROP PRIMARY KEY,
    ADD COLUMN `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- CreateIndex
CREATE UNIQUE INDEX `SystemConfig_key_key` ON `SystemConfig`(`key`);
