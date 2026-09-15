-- AlterTable
ALTER TABLE `SupervisionAppointment` ADD COLUMN `letterDocDate` DATETIME(3) NULL,
    ADD COLUMN `letterDocNumber` VARCHAR(191) NULL,
    ADD COLUMN `letterDraftDate` DATETIME(3) NULL,
    ADD COLUMN `letterDraftNumber` VARCHAR(191) NULL,
    ADD COLUMN `letterPendingAt` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `SupervisionAppointment_letterDocNumber_key` ON `SupervisionAppointment`(`letterDocNumber`);
