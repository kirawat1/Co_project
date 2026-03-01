/*
  Warnings:

  - You are about to alter the column `major` on the `student` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(2))`.

*/
-- AlterTable
ALTER TABLE `student` MODIFY `major` ENUM('CS', 'IT', 'GIS') NULL;
