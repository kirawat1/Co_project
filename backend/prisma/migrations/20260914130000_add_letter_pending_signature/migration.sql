-- AlterTable
ALTER TABLE `StudentCoop` ADD COLUMN `placeLetterDraftDate` DATETIME(3) NULL,
    ADD COLUMN `placeLetterDraftNumber` VARCHAR(191) NULL,
    ADD COLUMN `placeLetterPendingAt` DATETIME(3) NULL,
    ADD COLUMN `reqLetterDraftDate` DATETIME(3) NULL,
    ADD COLUMN `reqLetterDraftNumber` VARCHAR(191) NULL,
    ADD COLUMN `reqLetterPendingAt` DATETIME(3) NULL;
