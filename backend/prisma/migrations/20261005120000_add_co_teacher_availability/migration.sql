-- วันที่อาจารย์นิเทศร่วมว่าง (เลือกจากวันที่นักศึกษาเสนอ) — อาจารย์หลักเห็นก่อนเลือกวัน
ALTER TABLE `SupervisionCoTeacher` ADD COLUMN `availableDates` TEXT NULL,
    ADD COLUMN `respondedAt` DATETIME(3) NULL;
