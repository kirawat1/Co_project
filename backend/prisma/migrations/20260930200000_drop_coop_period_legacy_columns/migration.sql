-- คอลัมน์เดิมก่อนแยกหลักสูตร — ค่าถูกก๊อปไป CoopPeriodMajor แล้ว (migration 20260930180000_add_coop_period_major)
-- ต้องรันหลัง migration นั้นเสมอ (ลำดับชื่อโฟลเดอร์รับประกันแล้ว)
ALTER TABLE `CoopPeriod` DROP COLUMN `isActive`,
    DROP COLUMN `isSupervisionOpen`,
    DROP COLUMN `supervisionEndDate`,
    DROP COLUMN `supervisionStartDate`;
