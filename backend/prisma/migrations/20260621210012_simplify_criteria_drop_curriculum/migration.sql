-- AlterTable
ALTER TABLE `coopcriteria` DROP COLUMN `coreCourses`,
    DROP COLUMN `electiveMinCount`,
    DROP COLUMN `minActivityUnit`,
    DROP COLUMN `minCoreGpa`,
    DROP COLUMN `minGpa`,
    DROP COLUMN `prepCourseCodes`,
    DROP COLUMN `requiredCourses`;

-- AlterTable
ALTER TABLE `student` DROP COLUMN `coreGpa`,
    DROP COLUMN `curriculum`,
    DROP COLUMN `isPassPrepCourse`,
    DROP COLUMN `isQualified`;
