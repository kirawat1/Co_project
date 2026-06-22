const XLSX = require('xlsx');
const prisma = require('../config/prismaClient');

// StudyProgram enum values: normal | special
const STUDY_PROGRAM_MAP = {
  'ปกติ': 'normal',
  'normal': 'normal',
  'พิเศษ': 'special',
  'special': 'special',
};

// Prefix enum values: MR | MS
const PREFIX_MAP = {
  'นาย': 'MR', 'mr': 'MR', 'mr.': 'MR', 'mister': 'MR',
  'นาง': 'MS', 'นางสาว': 'MS', 'ms': 'MS', 'ms.': 'MS', 'mrs': 'MS', 'mrs.': 'MS', 'miss': 'MS',
};

function mapPrefix(raw) {
  const key = (raw || '').trim().toLowerCase();
  return PREFIX_MAP[key] ?? null;
}

// คอลัมน์ "ชื่อ-นามสกุล" เป็นช่องเดียว — แยกเป็น firstName/lastName โดยตัดที่เว้นวรรคแรก
function splitFullName(fullName) {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, spaceIdx).trim(),
    lastName: trimmed.slice(spaceIdx + 1).trim(),
  };
}

exports.importStudents = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "กรุณาอัปโหลดไฟล์ Excel" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // ไฟล์จริงมีแถวหัวข้อ/ว่าง อยู่เหนือแถวหัวคอลัมน์ → หาแถวหัวคอลัมน์จริงก่อน แทนการสมมติว่าเป็นแถวแรก
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const headerRowIndex = rawRows.findIndex(r => r.some(cell => String(cell).trim() === 'รหัสนักศึกษา'));
    if (headerRowIndex === -1) {
      return res.status(400).json({ ok: false, message: 'ไม่พบหัวคอลัมน์ "รหัสนักศึกษา" ในไฟล์ Excel' });
    }
    const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex, defval: '' });

    let created = 0, updated = 0, errors = 0;
    const errorRows = [];

    // Pre-fetch all candidate advisor teachers by (firstName, lastName) to avoid N+1 queries
    const advisorNamePairs = rows
      .map(r => splitFullName(String(r['ชื่ออาจารย์ที่ปรึกษา'] || '').trim()))
      .filter(p => p.firstName);
    const advisorTeachers = advisorNamePairs.length > 0
      ? await prisma.teacher.findMany({
          where: { OR: advisorNamePairs.map(p => ({ firstName: p.firstName, lastName: p.lastName })) },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const advisorMap = new Map(advisorTeachers.map(t => [`${t.firstName}|${t.lastName}`, t.id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const email = String(row['อีเมล'] || '').trim();
      const studentId = String(row['รหัสนักศึกษา'] || '').trim();

      if (!email || !studentId) {
        errors++;
        errorRows.push({ row: i + 2, email, reason: 'email หรือ id ว่างเปล่า' });
        continue;
      }

      // per-row flag so counter rollback targets the right counter
      let thisRowCountedAs = null;

      try {
        const prefix = mapPrefix(row['คำนำหน้าชื่อ']);
        const { firstName, lastName } = splitFullName(row['ชื่อ-นามสกุล (ภาษาไทย)']);
        const { firstName: firstNameEn, lastName: lastNameEn } = splitFullName(row['ชื่อ-นามสกุล (ภาษาอังกฤษ)']);
        const year = String(row['ชั้นปี'] || '').trim();
        const major = String(row['สาขาวิชา / แผนกการศึกษา'] || '').trim() || null;
        const phone = String(row['เบอร์โทรศัพท์'] || '').trim() || null;
        const advisorName = String(row['ชื่ออาจารย์ที่ปรึกษา'] || '').trim() || null;
        const rawProgram = String(row['ภาคการศึกษา (ปกติ/พิเศษ)'] || '').trim();
        const studyProgram = STUDY_PROGRAM_MAP[rawProgram] ?? null;
        const rawGpa = String(row['เกรดเฉลี่ยสะสม (GPA)'] || '').trim();
        const gpa = rawGpa && !Number.isNaN(parseFloat(rawGpa)) ? parseFloat(rawGpa) : null;

        // 1. Find or create User (safe username collision check)
        const existingUser = await prisma.user.findFirst({ where: { email } });
        let user;
        if (existingUser) {
          user = existingUser;
          updated++;
          thisRowCountedAs = 'updated';
        } else {
          // Check if username is already taken by a different user (different role/email)
          const existingByUsername = await prisma.user.findFirst({ where: { username: studentId } });
          if (existingByUsername && existingByUsername.email !== email) {
            // Username collision with a different account — skip, report as error
            throw new Error(`username '${studentId}' ถูกใช้โดยบัญชีอื่นแล้ว (email: ${existingByUsername.email})`);
          }
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
          thisRowCountedAs = 'created';
        }

        // 2. Resolve generalAdvisorId by matching advisor name against pre-fetched teachers
        const advisorNameParts = splitFullName(advisorName);
        const generalAdvisorId = advisorNameParts.firstName
          ? (advisorMap.get(`${advisorNameParts.firstName}|${advisorNameParts.lastName}`) ?? null)
          : null;

        // 3. Upsert Student (always include generalAdvisorId to allow clearing)
        await prisma.student.upsert({
          where: { studentId },
          update: {
            prefix, firstName, lastName, firstNameEn, lastNameEn,
            year, major, phone, email, gpa, advisorName, studyProgram,
            generalAdvisorId,  // null = clear advisor; non-null = set advisor
          },
          create: {
            studentId, prefix, firstName, lastName, firstNameEn, lastNameEn,
            year, major, phone, email, gpa,
            advisorName, generalAdvisorId, studyProgram,
            userId: user.id,
          },
        });
      } catch (rowErr) {
        console.error(`[importStudents] row ${i + 2}:`, rowErr.message);
        errors++;
        errorRows.push({ row: i + 2, email, reason: rowErr.message });
        // revert only the counter that this row incremented
        if (thisRowCountedAs === 'updated' && updated > 0) updated--;
        else if (thisRowCountedAs === 'created' && created > 0) created--;
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
