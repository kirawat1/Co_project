-- DropForeignKey
ALTER TABLE `mentor` DROP FOREIGN KEY `Mentor_companyId_fkey`;

-- AddForeignKey
ALTER TABLE `Mentor` ADD CONSTRAINT `Mentor_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
