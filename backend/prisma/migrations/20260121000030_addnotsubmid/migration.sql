/*
  Warnings:

  - You are about to drop the column `nameContact` on the `company` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `company` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `company` DROP COLUMN `nameContact`,
    DROP COLUMN `role`;

-- AlterTable
ALTER TABLE `studentcoop` MODIFY `status` ENUM('NOT_SUBMITTED', 'APPLYING', 'QUALIFICATION_FAILED', 'APPLICATION_EDITS_REQUIRED', 'QUALIFIED', 'WAITING_FOR_STAFF_CHECK', 'EDITS_REQUIRED', 'DOCS_APPROVED', 'REQ_LETTER_ISSUED', 'WAITING_FOR_PLACEMENT_LETTER', 'WAITING_FOR_STAFF_CHECK_LETTER', 'ACCEPTANCE_CHECKED', 'PLACEMENT_LETTER_ISSUED', 'INTERNSHIP_STARTED') NOT NULL DEFAULT 'APPLYING';
