-- DropForeignKey
ALTER TABLE `annfile` DROP FOREIGN KEY `AnnFile_announcementId_fkey`;

-- AddForeignKey
ALTER TABLE `AnnFile` ADD CONSTRAINT `AnnFile_announcementId_fkey` FOREIGN KEY (`announcementId`) REFERENCES `Announcement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
