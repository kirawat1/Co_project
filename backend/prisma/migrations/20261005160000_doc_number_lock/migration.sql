-- ล็อกเลขที่หนังสือระหว่างออกหนังสือ — กันเลขเดียวกันถูกบันทึกพร้อมกันเป็น 2 ฉบับ (หลังเลิก unique ที่ช่องเลขที่)
-- CreateTable
CREATE TABLE `DocNumberLock` (
    `kind` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`kind`, `number`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

