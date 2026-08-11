-- DropForeignKey
ALTER TABLE `company` DROP FOREIGN KEY `Company_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `mentor` DROP FOREIGN KEY `Mentor_createdById_fkey`;

-- AlterTable
ALTER TABLE `company` MODIFY `createdById` INTEGER NULL;

-- AlterTable
ALTER TABLE `mentor` MODIFY `createdById` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Company` ADD CONSTRAINT `Company_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mentor` ADD CONSTRAINT `Mentor_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
