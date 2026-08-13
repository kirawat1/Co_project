const XLSX = require('xlsx');
const prisma = require('../config/prismaClient');

const STUDY_PROGRAM_MAP = {
  'ปกติ': 'normal', 'normal': 'normal',
  'พิเศษ': 'special', 'special': 'special',
};

const PREFIX_MAP = {
  'นาย': 'MR', 'mr': 'MR', 'mr.': 'MR', 'mister': 'MR',
  'นาง': 'MS', 'นางสาว': 'MS', 'ms': 'MS', 'ms.': 'MS', 'mrs': 'MS', 'mrs.': 'MS', 'miss': 'MS',
};

function mapPrefix(raw) {
  const key = (raw || '').trim().toLowerCase();
  return PREFIX_MAP[key] ?? null;
}

// Used only for old Thai-header format where firstName+lastName are combined in one column.
function splitFullName(fullName) {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, spaceIdx).trim(),
    lastName:  trimmed.slice(spaceIdx + 1).trim(),
  };
}

// KKU's PROGRAMNAME embeds the study type, e.g. "วิทยาการคอมพิวเตอร์ ปริญญาตรี ภาคปกติ"
function extractStudyProgram(programName) {
  const s = (programName || '');
  if (s.includes('พิเศษ')) return 'special';
  if (s.includes('ปกติ'))  return 'normal';
  return null;
}

// Normalize a raw Excel row to a consistent internal shape.
// isKkuFormat = true  → KKU system export (English column headers, names pre-split)
// isKkuFormat = false → old Thai-header template (combined name columns)
function normalizeRow(row, isKkuFormat) {
  if (isKkuFormat) {
    const officerName    = String(row['OFFICERNAME']    || '').trim();
    const officerSurname = String(row['OFFICERSURNAME'] || '').trim();
    const advisorName    = [officerName, officerSurname].filter(Boolean).join(' ') || null;
    const levelName      = String(row['LEVELNAME'] || '').trim();
    const programName    = String(row['PROGRAMNAME'] || '').trim();
    // LEVELNAME (e.g. "ภาคปกติ") takes priority; fall back to parsing PROGRAMNAME
    const studyProgram   = (levelName
      ? (STUDY_PROGRAM_MAP[levelName] ?? extractStudyProgram(levelName))
      : extractStudyProgram(programName)) ?? null;
    return {
      studentId:        String(row['STUDENTCODE']       || '').trim(),
      prefix:           mapPrefix(row['PREFIXNAME']),
      firstName:        String(row['STUDENTNAME']       || '').trim(),
      lastName:         String(row['STUDENTSURNAME']    || '').trim(),
      firstNameEn:      String(row['STUDENTNAMEENG']    || '').trim(),
      lastNameEn:       String(row['STUDENTSURNAMEENG'] || '').trim(),
      email:            String(row['KKUMAIL']           || '').trim(),
      phone:            null,
      year:             null,
      gpa:              null,
      major:            programName || null,
      studyProgram,
      advisorName,
      advisorFirstName: officerName    || null,
      advisorLastName:  officerName ? (officerSurname || '') : '',
    };
  }

  // Old Thai-header template — combined name columns, split at first space
  const { firstName, lastName }                          = splitFullName(row['ชื่อ-นามสกุล (ภาษาไทย)']);
  const { firstName: firstNameEn, lastName: lastNameEn } = splitFullName(row['ชื่อ-นามสกุล (ภาษาอังกฤษ)']);
  const advisorRaw = String(row['ชื่ออาจารย์ที่ปรึกษา'] || '').trim();
  const advisorName = advisorRaw || null;
  const { firstName: advisorFirstName, lastName: advisorLastName } = splitFullName(advisorRaw);
  const rawProgram = String(row['ภาคการศึกษา (ปกติ/พิเศษ)'] || '').trim();
  const rawGpa     = String(row['เกรดเฉลี่ยสะสม (GPA)']       || '').trim();
  return {
    studentId:        String(row['รหัสนักศึกษา'] || '').trim(),
    prefix:           mapPrefix(row['คำนำหน้าชื่อ']),
    firstName,
    lastName,
    firstNameEn,
    lastNameEn,
    email:            String(row['อีเมล'] || '').trim(),
    phone:            String(row['เบอร์โทรศัพท์'] || '').trim() || null,
    year:             String(row['ชั้นปี'] || '').trim(),
    gpa:              rawGpa && !Number.isNaN(parseFloat(rawGpa)) ? parseFloat(rawGpa) : null,
    major:            String(row['สาขาวิชา/แผนกการศึกษา'] || row['สาขาวิชา'] || '').trim() || null,
    studyProgram:     STUDY_PROGRAM_MAP[rawProgram] ?? null,
    advisorName,
    advisorFirstName: advisorFirstName || null,
    advisorLastName:  advisorFirstName ? (advisorLastName || '') : '',
  };
}

exports.previewStudents = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "กรุณาอัปโหลดไฟล์ Excel" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    let headerRowIndex = rawRows.findIndex(r => r.some(cell => String(cell).trim() === 'STUDENTCODE'));
    const isKkuFormat = headerRowIndex !== -1;
    if (!isKkuFormat) {
      headerRowIndex = rawRows.findIndex(r => r.some(cell => String(cell).trim() === 'รหัสนักศึกษา'));
    }
    if (headerRowIndex === -1) {
      return res.status(400).json({ ok: false, message: 'ไม่พบหัวคอลัมน์ "STUDENTCODE" หรือ "รหัสนักศึกษา" ในไฟล์ Excel' });
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex, defval: '' });
    const normalizedRows = rows.map(r => normalizeRow(r, isKkuFormat));

    const allEmails     = [...new Set(normalizedRows.map(r => r.email).filter(Boolean))];
    const allStudentIds = [...new Set(normalizedRows.map(r => r.studentId).filter(Boolean))];
    const [prefetchedUsers, prefetchedStudents] = await Promise.all([
      prisma.user.findMany({ where: { email: { in: allEmails } } }),
      prisma.student.findMany({ where: { studentId: { in: allStudentIds } }, select: { studentId: true, deletedAt: true } }),
    ]);
    const userByEmail        = new Map(prefetchedUsers.map(u => [u.email, u]));
    const studentByStudentId = new Map(prefetchedStudents.map(s => [s.studentId, s]));

    const uniqueAdvisorPairs = [...new Map(
      normalizedRows
        .filter(r => r.advisorFirstName)
        .map(r => [`${r.advisorFirstName}|${r.advisorLastName}`, { firstName: r.advisorFirstName, lastName: r.advisorLastName }])
    ).values()];

    const advisorTeachers = uniqueAdvisorPairs.length > 0
      ? await prisma.teacher.findMany({
          where: { OR: uniqueAdvisorPairs.map(p => ({ firstName: p.firstName, lastName: p.lastName })) },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];

    const advisorMap       = new Map();
    const advisorAmbiguous = new Set();
    for (const t of advisorTeachers) {
      const key = `${t.firstName}|${t.lastName}`;
      if (advisorMap.has(key)) advisorAmbiguous.add(key);
      else advisorMap.set(key, t.id);
    }

    let willCreate = 0, willUpdate = 0, willSkip = 0, advisorWarnings = 0;

    const previewRows = normalizedRows.map((norm, i) => {
      const { email, studentId, firstName, lastName, studyProgram, advisorName } = norm;
      const rowNum = i + 2;
      const name = [firstName, lastName].filter(Boolean).join(' ') || '-';

      if (!email || !studentId) {
        willSkip++;
        return { rowNum, studentId: studentId || '-', name, email: email || '-', major: norm.major, studyProgram, advisorName, action: 'skip', advisorStatus: 'empty', error: 'email หรือรหัสนักศึกษาว่างเปล่า' };
      }

      const existingStudent = studentByStudentId.get(studentId);
      if (existingStudent?.deletedAt) {
        willSkip++;
        return { rowNum, studentId, name, email, major: norm.major, studyProgram, advisorName, action: 'skip', advisorStatus: 'empty', error: `รหัส ${studentId} อยู่ในถังขยะ — กรุณากู้คืนก่อน` };
      }

      const action = userByEmail.has(email) ? 'update' : 'create';
      if (action === 'create') willCreate++; else willUpdate++;

      let advisorStatus = 'empty';
      if (norm.advisorFirstName) {
        const key = `${norm.advisorFirstName}|${norm.advisorLastName}`;
        if (advisorAmbiguous.has(key))  { advisorStatus = 'ambiguous'; advisorWarnings++; }
        else if (advisorMap.has(key))   { advisorStatus = 'found'; }
        else                            { advisorStatus = 'notFound'; advisorWarnings++; }
      }

      return { rowNum, studentId, name, email, major: norm.major, studyProgram, advisorName, action, advisorStatus };
    });

    res.json({
      ok: true,
      rows: previewRows,
      summary: { total: rows.length, willCreate, willUpdate, willSkip, advisorWarnings },
    });
  } catch (err) {
    console.error('[previewStudents]', err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการอ่านไฟล์" });
  }
};

exports.importStudents = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "กรุณาอัปโหลดไฟล์ Excel" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Detect format: KKU system export uses 'STUDENTCODE'; old template uses 'รหัสนักศึกษา'
    let headerRowIndex = rawRows.findIndex(r => r.some(cell => String(cell).trim() === 'STUDENTCODE'));
    const isKkuFormat = headerRowIndex !== -1;
    if (!isKkuFormat) {
      headerRowIndex = rawRows.findIndex(r => r.some(cell => String(cell).trim() === 'รหัสนักศึกษา'));
    }
    if (headerRowIndex === -1) {
      return res.status(400).json({ ok: false, message: 'ไม่พบหัวคอลัมน์ "STUDENTCODE" หรือ "รหัสนักศึกษา" ในไฟล์ Excel' });
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex, defval: '' });
    const normalizedRows = rows.map(r => normalizeRow(r, isKkuFormat));

    let created = 0, updated = 0, errors = 0;
    const errorRows = [];

    // Pre-fetch users + students to avoid N+1 queries per row
    const allEmails     = [...new Set(normalizedRows.map(r => r.email).filter(Boolean))];
    const allStudentIds = [...new Set(normalizedRows.map(r => r.studentId).filter(Boolean))];
    const [prefetchedUsers, prefetchedByUsername, prefetchedStudents] = await Promise.all([
      prisma.user.findMany({ where: { email: { in: allEmails } } }),
      prisma.user.findMany({ where: { username: { in: allStudentIds } } }),
      prisma.student.findMany({ where: { studentId: { in: allStudentIds } }, select: { studentId: true, deletedAt: true } }),
    ]);
    const userByEmail        = new Map(prefetchedUsers.map(u => [u.email, u]));
    const userByUsername     = new Map(prefetchedByUsername.map(u => [u.username, u]));
    const studentByStudentId = new Map(prefetchedStudents.map(s => [s.studentId, s]));

    // Pre-fetch all candidate advisor teachers (deduplicated) to avoid N+1
    const uniqueAdvisorPairs = [...new Map(
      normalizedRows
        .filter(r => r.advisorFirstName)
        .map(r => [`${r.advisorFirstName}|${r.advisorLastName}`, { firstName: r.advisorFirstName, lastName: r.advisorLastName }])
    ).values()];

    const advisorTeachers = uniqueAdvisorPairs.length > 0
      ? await prisma.teacher.findMany({
          where: { OR: uniqueAdvisorPairs.map(p => ({ firstName: p.firstName, lastName: p.lastName })) },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];

    // If multiple teachers share the same firstName+lastName, refuse to guess — mark as ambiguous
    const advisorMap       = new Map();
    const advisorAmbiguous = new Set();
    for (const t of advisorTeachers) {
      const key = `${t.firstName}|${t.lastName}`;
      if (advisorMap.has(key)) {
        advisorAmbiguous.add(key);
      } else {
        advisorMap.set(key, t.id);
      }
    }

    // Resolve Thai major names → codes via CoopCriteria.nameTh lookup
    const uniqueThaiMajors = [...new Set(normalizedRows.map(r => r.major).filter(Boolean))];
    let autoCreatedMajors = 0;
    // nameThToCode: thaiName → major code (for lookup during student upsert)
    const nameThToCode = new Map();
    if (uniqueThaiMajors.length > 0) {
      const existing = await prisma.coopCriteria.findMany({
        where: { OR: [{ major: { in: uniqueThaiMajors } }, { nameTh: { in: uniqueThaiMajors } }] },
        select: { major: true, nameTh: true },
      });
      for (const c of existing) {
        // map code → code (identity, for rows where major already is a code)
        nameThToCode.set(c.major, c.major);
        // map Thai name → code
        if (c.nameTh) nameThToCode.set(c.nameTh, c.major);
      }
      const toCreate = uniqueThaiMajors.filter(m => !nameThToCode.has(m));
      if (toCreate.length > 0) {
        await prisma.coopCriteria.createMany({
          data: toCreate.map(m => ({ major: m, nameTh: m })),
          skipDuplicates: true,
        });
        for (const m of toCreate) nameThToCode.set(m, m);
        autoCreatedMajors = toCreate.length;
      }
    }

    for (let i = 0; i < normalizedRows.length; i++) {
      const norm = normalizedRows[i];
      const { email, studentId } = norm;

      if (!email || !studentId) {
        errors++;
        errorRows.push({ row: i + 2, email, reason: 'email หรือ id ว่างเปล่า' });
        continue;
      }

      let thisRowCountedAs = null;

      try {
        const existingUser = userByEmail.get(email);
        let user = existingUser || null;
        if (!existingUser) {
          const existingByUsername = userByUsername.get(studentId);
          if (existingByUsername && existingByUsername.email !== email) {
            throw new Error(`username '${studentId}' ถูกใช้โดยบัญชีอื่นแล้ว (email: ${existingByUsername.email})`);
          }
        } else if (existingUser.username !== studentId) {
          throw new Error(`อีเมล '${email}' ถูกใช้โดยรหัสนักศึกษา '${existingUser.username}' แล้ว`);
        }

        // Resolve generalAdvisorId:
        // - no advisor name given → null (clear field)
        // - name given but ambiguous / not found → undefined (keep existing value)
        // - name given and found → teacher id
        let generalAdvisorId;
        if (!norm.advisorFirstName) {
          generalAdvisorId = null;
        } else {
          const advisorKey = `${norm.advisorFirstName}|${norm.advisorLastName}`;
          if (advisorAmbiguous.has(advisorKey)) {
            generalAdvisorId = undefined;
            errorRows.push({ row: i + 2, email, reason: `ชื่ออาจารย์ที่ปรึกษา "${norm.advisorName}" ซ้ำกันหลายคนในระบบ — ไม่ได้แก้ไขอาจารย์ที่ปรึกษาเดิม` });
          } else if (advisorMap.has(advisorKey)) {
            generalAdvisorId = advisorMap.get(advisorKey);
          } else {
            generalAdvisorId = undefined;
            errorRows.push({ row: i + 2, email, reason: `ไม่พบอาจารย์ที่ปรึกษา "${norm.advisorName}" ในระบบ — ไม่ได้แก้ไขอาจารย์ที่ปรึกษาเดิม` });
          }
        }

        const existingStudent = studentByStudentId.get(studentId);
        if (existingStudent?.deletedAt) {
          throw new Error(`นักศึกษารหัส ${studentId} อยู่ในถังขยะ — กรุณากู้คืนก่อนนำเข้าข้อมูลใหม่`);
        }

        const { prefix, firstName, lastName, firstNameEn, lastNameEn,
                year, phone, gpa, major, studyProgram, advisorName } = norm;

        // Resolve Thai major name → code (e.g. "วิทยาการคอมพิวเตอร์" → "cs")
        const resolvedMajor = major ? (nameThToCode.get(major) ?? major) : null;

        await prisma.$transaction(async (tx) => {
          if (!existingUser) {
            user = await tx.user.upsert({
              where: { username: studentId },
              update: { email },
              create: { username: studentId, email, password: null, role: 'student', provider: 'google' },
            });
          }
          await tx.student.upsert({
            where: { studentId },
            update: {
              prefix, firstName, lastName, firstNameEn, lastNameEn,
              year, phone, email, gpa, major: resolvedMajor ?? undefined, studyProgram,
              advisorName:     generalAdvisorId !== undefined ? advisorName : undefined,
              generalAdvisorId,
            },
            create: {
              studentId, prefix, firstName, lastName, firstNameEn, lastNameEn,
              year, phone, email, gpa, major: resolvedMajor ?? null,
              advisorName, generalAdvisorId: generalAdvisorId ?? null, studyProgram,
              userId: user.id,
            },
          });
        });

        if (!existingUser) {
          userByEmail.set(email, user);
          userByUsername.set(studentId, user);
          created++;
          thisRowCountedAs = 'created';
        } else {
          updated++;
          thisRowCountedAs = 'updated';
        }
      } catch (rowErr) {
        console.error(`[importStudents] row ${i + 2}:`, rowErr);
        errors++;
        const reason = rowErr.code
          ? `เกิดข้อผิดพลาดในการบันทึกข้อมูล (${rowErr.code}) กรุณาติดต่อผู้ดูแลระบบ`
          : rowErr.message;
        errorRows.push({ row: i + 2, email, reason });
        if (thisRowCountedAs === 'updated' && updated > 0) updated--;
        else if (thisRowCountedAs === 'created' && created > 0) created--;
      }
    }

    res.json({
      ok: true,
      summary: { total: rows.length, created, updated, errors, autoCreatedMajors },
      errorRows,
    });
  } catch (err) {
    console.error('[importStudents]', err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" });
  }
};
