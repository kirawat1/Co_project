/*
  Warnings:

  - You are about to alter the column `major` on the `coopcriteria` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `VarChar(191)`.
  - You are about to alter the column `major` on the `student` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(3))` to `VarChar(191)`.
  - You are about to alter the column `major` on the `teacher` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(7))` to `VarChar(191)`.

*/
-- AlterTable
ALTER TABLE `coopcriteria` MODIFY `major` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `student` MODIFY `major` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `teacher` MODIFY `major` VARCHAR(191) NULL;
