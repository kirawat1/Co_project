-- AlterTable
ALTER TABLE `coopperiod` ADD COLUMN `isSupervisionOpen` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `supervisionEndDate` DATETIME(3) NULL,
    ADD COLUMN `supervisionStartDate` DATETIME(3) NULL;
