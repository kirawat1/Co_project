-- CreateTable: implicit many-to-many join table for Mentor <-> StudentCoop
CREATE TABLE `_MentorToStudentCoop` (
    `A` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `B` INTEGER NOT NULL,
    UNIQUE INDEX `_MentorToStudentCoop_AB_unique`(`A`, `B`),
    INDEX `_MentorToStudentCoop_B_index`(`B`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_MentorToStudentCoop` ADD CONSTRAINT `_MentorToStudentCoop_A_fkey` FOREIGN KEY (`A`) REFERENCES `Mentor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `_MentorToStudentCoop` ADD CONSTRAINT `_MentorToStudentCoop_B_fkey` FOREIGN KEY (`B`) REFERENCES `StudentCoop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing mentorId data to join table
INSERT INTO `_MentorToStudentCoop` (`A`, `B`)
SELECT `mentorId`, `id` FROM `StudentCoop` WHERE `mentorId` IS NOT NULL;

-- DropForeignKey
ALTER TABLE `StudentCoop` DROP FOREIGN KEY `StudentCoop_mentorId_fkey`;

-- AlterTable: drop mentorId column
ALTER TABLE `StudentCoop` DROP COLUMN `mentorId`;
