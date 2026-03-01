/*
  Warnings:

  - You are about to drop the column `department` on the `teacher` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `teacher` DROP COLUMN `department`,
    ADD COLUMN `major` ENUM('CS', 'IT', 'GIS') NULL;
