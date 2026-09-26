-- CreateTable
CREATE TABLE `CompanyContact` (
    `id` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL DEFAULT '',
    `position` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_CoopContacts` (
    `A` VARCHAR(191) NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_CoopContacts_AB_unique`(`A`, `B`),
    INDEX `_CoopContacts_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CompanyContact` ADD CONSTRAINT `CompanyContact_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyContact` ADD CONSTRAINT `CompanyContact_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_CoopContacts` ADD CONSTRAINT `_CoopContacts_A_fkey` FOREIGN KEY (`A`) REFERENCES `CompanyContact`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_CoopContacts` ADD CONSTRAINT `_CoopContacts_B_fkey` FOREIGN KEY (`B`) REFERENCES `StudentCoop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ย้ายผู้ติดต่อเดิม (Company.contactPerson เป็นข้อความชื่อเต็ม) มาเป็นผู้ติดต่อคนแรกของบริษัท
-- ชื่อเต็มเก็บในช่อง firstName ทั้งก้อน (แยกชื่อ/สกุลภาษาไทยจากข้อความเดียวไม่แม่น) · คอลัมน์เดิมยังเก็บไว้เป็นค่าสำรองของหนังสือ
INSERT INTO `CompanyContact` (`id`, `firstName`, `lastName`, `position`, `companyId`, `createdAt`, `updatedAt`)
SELECT UUID(), TRIM(`contactPerson`), '', NULLIF(TRIM(`contactPosition`), ''), `id`, NOW(3), NOW(3)
FROM `Company`
WHERE `contactPerson` IS NOT NULL AND TRIM(`contactPerson`) <> '';
