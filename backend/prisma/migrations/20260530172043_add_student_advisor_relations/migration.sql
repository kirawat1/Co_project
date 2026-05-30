-- AlterTable
ALTER TABLE `student` ADD COLUMN `coopAdvisorId` INTEGER NULL,
    ADD COLUMN `generalAdvisorId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Student` ADD CONSTRAINT `Student_generalAdvisorId_fkey` FOREIGN KEY (`generalAdvisorId`) REFERENCES `Teacher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Student` ADD CONSTRAINT `Student_coopAdvisorId_fkey` FOREIGN KEY (`coopAdvisorId`) REFERENCES `Teacher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
