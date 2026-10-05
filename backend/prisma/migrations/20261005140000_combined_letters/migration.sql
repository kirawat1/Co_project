-- หนังสือรวมหลายคน (ขอความอนุเคราะห์ / ส่งตัว / ขอนิเทศ): เลขที่เดียวกันใช้ได้หลายคนในฉบับเดียวกัน
-- เลิก unique ระดับ DB → ตรวจห้ามซ้ำข้ามฉบับใน controller (เทียบ batch / groupId) · คง index ไว้ให้ค้นเร็ว
-- DropIndex
DROP INDEX `StudentCoop_placeDocNumber_key` ON `StudentCoop`;

-- DropIndex
DROP INDEX `StudentCoop_reqDocNumber_key` ON `StudentCoop`;

-- DropIndex
DROP INDEX `SupervisionAppointment_letterDocNumber_key` ON `SupervisionAppointment`;

-- AlterTable
ALTER TABLE `StudentCoop` ADD COLUMN `placeLetterBatch` VARCHAR(191) NULL,
    ADD COLUMN `reqLetterBatch` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `StudentCoop_reqDocNumber_idx` ON `StudentCoop`(`reqDocNumber`);

-- CreateIndex
CREATE INDEX `StudentCoop_placeDocNumber_idx` ON `StudentCoop`(`placeDocNumber`);

-- CreateIndex
CREATE INDEX `SupervisionAppointment_letterDocNumber_idx` ON `SupervisionAppointment`(`letterDocNumber`);

