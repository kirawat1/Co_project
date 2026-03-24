-- CreateTable
CREATE TABLE `SupervisionAppointment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `teacherId` INTEGER NOT NULL,
    `proposedDates` TEXT NOT NULL,
    `supervisionType` ENUM('ONLINE', 'ONSITE') NOT NULL,
    `confirmedDate` DATETIME(3) NULL,
    `rejectReason` TEXT NULL,
    `status` ENUM('PENDING_TEACHER', 'TEACHER_REJECTED', 'DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED') NOT NULL DEFAULT 'PENDING_TEACHER',
    `officialLetterPath` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SupervisionAppointment_studentId_key`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SupervisionAppointment` ADD CONSTRAINT `SupervisionAppointment_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupervisionAppointment` ADD CONSTRAINT `SupervisionAppointment_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `Teacher`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
