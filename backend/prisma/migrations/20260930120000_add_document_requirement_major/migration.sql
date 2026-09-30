-- CreateTable
CREATE TABLE `DocumentRequirementMajor` (
    `requirementId` INTEGER NOT NULL,
    `major` VARCHAR(191) NOT NULL,
    `excluded` BOOLEAN NOT NULL DEFAULT false,

    INDEX `DocumentRequirementMajor_major_idx`(`major`),
    PRIMARY KEY (`requirementId`, `major`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DocumentRequirementMajor` ADD CONSTRAINT `DocumentRequirementMajor_requirementId_fkey` FOREIGN KEY (`requirementId`) REFERENCES `DocumentRequirement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentRequirementMajor` ADD CONSTRAINT `DocumentRequirementMajor_major_fkey` FOREIGN KEY (`major`) REFERENCES `CoopCriteria`(`major`) ON DELETE CASCADE ON UPDATE CASCADE;

