-- CreateTable
CREATE TABLE `CoopPeriodMajor` (
    `periodId` INTEGER NOT NULL,
    `major` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `supervisionStartDate` DATETIME(3) NULL,
    `supervisionEndDate` DATETIME(3) NULL,
    `isSupervisionOpen` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CoopPeriodMajor_major_idx`(`major`),
    PRIMARY KEY (`periodId`, `major`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CoopPeriodMajor` ADD CONSTRAINT `CoopPeriodMajor_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `CoopPeriod`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CoopPeriodMajor` ADD CONSTRAINT `CoopPeriodMajor_major_fkey` FOREIGN KEY (`major`) REFERENCES `CoopCriteria`(`major`) ON DELETE CASCADE ON UPDATE CASCADE;


-- รอบเดิมทุกรอบ → ก๊อปวันรับสมัคร/สถานะเปิดปิด/ช่วงนิเทศ ให้ทุกหลักสูตร (พฤติกรรมเหมือนเดิมทุกอย่างจนกว่าจะมีคนแก้แยก)
INSERT INTO `CoopPeriodMajor` (`periodId`, `major`, `startDate`, `endDate`, `isActive`, `supervisionStartDate`, `supervisionEndDate`, `isSupervisionOpen`, `updatedAt`)
SELECT p.`id`, c.`major`, p.`startDate`, p.`endDate`, p.`isActive`, p.`supervisionStartDate`, p.`supervisionEndDate`, p.`isSupervisionOpen`, NOW(3)
FROM `CoopPeriod` p
CROSS JOIN `CoopCriteria` c;
