/*
  Warnings:

  - You are about to drop the column `student_id` on the `student` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `student` table. All the data in the column will be lost.
  - You are about to alter the column `role` on the `user` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `Enum(EnumId(0))`.
  - You are about to drop the `announcement` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[studentId]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `studentId` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `student` DROP FOREIGN KEY `Student_user_id_fkey`;

-- DropIndex
DROP INDEX `Student_student_id_key` ON `student`;

-- AlterTable
ALTER TABLE `student` DROP COLUMN `student_id`,
    DROP COLUMN `user_id`,
    ADD COLUMN `studentId` VARCHAR(191) NOT NULL,
    ADD COLUMN `userId` INTEGER NOT NULL,
    MODIFY `phone` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` MODIFY `role` ENUM('student', 'teacher', 'staff') NOT NULL DEFAULT 'student';

-- DropTable
DROP TABLE `announcement`;

-- CreateIndex
CREATE UNIQUE INDEX `Student_studentId_key` ON `Student`(`studentId`);

-- CreateIndex
CREATE UNIQUE INDEX `Student_userId_key` ON `Student`(`userId`);

-- AddForeignKey
ALTER TABLE `Student` ADD CONSTRAINT `Student_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
