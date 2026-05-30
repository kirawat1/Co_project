const XLSX = require('xlsx');
const prisma = require('../config/prismaClient');

// StudyProgram enum values: normal | special
const STUDY_PROGRAM_MAP = {
  'ปกติ': 'normal',
  'normal': 'normal',
  'พิเศษ': 'special',
  'special': 'special',
};

exports.importStudents = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "กรุณาอัปโหลดไฟล์ Excel" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let created = 0, updated = 0, errors = 0;
    const errorRows = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const email = String(row['email นักศึกษา'] || '').trim();
      const studentId = String(row['id'] || '').trim();

      if (!email || !studentId) {
        errors++;
        errorRows.push({ row: i + 2, email, reason: 'email หรือ id ว่างเปล่า' });
        continue;
      }

      try {
        const firstName = String(row['ชื่อ'] || '').trim();
        const lastName = String(row['สกุล'] || '').trim();
        const year = String(row['ปี'] || '').trim();
        const curriculum = String(row['คณะ'] || '').trim();
        const major = String(row['สาขาวิชา'] || '').trim() || null;
        const advisorName = String(row['อาจารย์ที่ปรึกษาทั่วไป'] || '').trim() || null;
        const advisorEmail = String(row['email อาจารย์'] || '').trim() || null;
        const rawProgram = String(row['รูปแบบการศึกษา'] || '').trim();
        const studyProgram = STUDY_PROGRAM_MAP[rawProgram] ?? null;

        // 1. Find or create User
        const existingUser = await prisma.user.findFirst({ where: { email } });
        let user;
        if (existingUser) {
          user = existingUser;
          updated++;
        } else {
          user = await prisma.user.upsert({
            where: { username: studentId },
            update: { email },
            create: {
              username: studentId,
              email,
              password: null,
              role: 'student',
              provider: 'google',
            },
          });
          created++;
        }

        // 2. Find teacher by email
        let generalAdvisorId = null;
        if (advisorEmail) {
          const teacher = await prisma.teacher.findFirst({ where: { email: advisorEmail } });
          if (teacher) generalAdvisorId = teacher.id;
        }

        // 3. Upsert Student
        await prisma.student.upsert({
          where: { studentId },
          update: {
            firstName, lastName, year, curriculum, major, advisorName, studyProgram,
            ...(generalAdvisorId !== null && { generalAdvisorId }),
          },
          create: {
            studentId, firstName, lastName, year, curriculum, major,
            advisorName, generalAdvisorId, studyProgram,
            userId: user.id,
          },
        });
      } catch (rowErr) {
        console.error(`[importStudents] row ${i + 2}:`, rowErr.message);
        errors++;
        errorRows.push({ row: i + 2, email, reason: rowErr.message });
        // revert the count increment that happened before error
        if (updated > 0) updated--;
        else if (created > 0) created--;
      }
    }

    res.json({
      ok: true,
      summary: { total: rows.length, created, updated, errors },
      errorRows,
    });
  } catch (err) {
    console.error('[importStudents]', err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" });
  }
};
