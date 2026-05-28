-- AlterTable
ALTER TABLE `coopcriteria` ADD COLUMN `electiveMinCount` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `prepCourseCodes` JSON NOT NULL;
