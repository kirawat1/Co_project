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

// สาขาวิชา: ไฟล์ Excel จากทะเบียนมักใส่ชื่อเต็มภาษาไทย แต่ทั้งระบบ (CoopCriteria, ตัวกรอง,
// dashboard) ใช้รหัสย่อ (CS/IT/GIS/CYB/AI) — ถ้าเก็บชื่อเต็มดิบๆ จะไม่เชื่อมกับสาขาที่มีอยู่
const MAJOR_NAME_TO_CODE = {
  'วิทยาการคอมพิวเตอร์': 'CS',
  'เทคโนโลยีสารสนเทศ': 'IT',
  'ภูมิสารสนเทศศาสตร์': 'GIS',
  'ความมั่นคงปลอดภัยไซเบอร์': 'CYB',
  'ปัญญาประดิษฐ์': 'AI',
  'วิทยาการข้อมูลและปัญญาประดิษฐ์': 'AI',
};
const KNOWN_MAJOR_CODES = new Set(['CS', 'IT', 'GIS', 'CYB', 'AI']);

// คืน { code, unrecognized } — code คือค่าที่จะบันทึก (แปลงเป็นรหัสถ้าทำได้ ไม่งั้นคงค่าดิบไว้
// แล้วปล่อยให้ caller แจ้งเตือนใน errorRows แทนการบล็อกทั้งแถว
function mapMajor(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { code: null, unrecognized: false };
  if (MAJOR_NAME_TO_CODE[trimmed]) return { code: MAJOR_NAME_TO_CODE[trimmed], unrecognized: false };
  const upper = trimmed.toUpperCase();
  if (KNOWN_MAJOR_CODES.has(upper)) return { code: upper, unrecognized: false };
  return { code: trimmed, unrecognized: true };
}

// คอลัมน์ "ชื่อ-นามสกุล" เป็นช่องเดียว — แยกเป็น firstName/lastName โดยตัดที่เว้นวรรคแรก
// (ถูกสำหรับชื่อไทย: ชื่อตัวคำเดียว + นามสกุลที่อาจมีหลายคำ — แต่ชื่อกลางภาษาอังกฤษ เช่น
// "Mary Jane Smith" จะถูกตัดเป็น first="Mary", last="Jane Smith" ซึ่งไม่มีกฎตัดที่ถูกต้องกว่านี้
// ได้โดยไม่มีข้อมูลเพิ่ม เพราะคอลัมน์ต้นทางรวมชื่อมาในช่องเดียว)
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
    // ถ้ามีอาจารย์ชื่อซ้ำกันหลายคน ห้ามเดาว่าเป็นคนไหน — ทำเครื่องหมายไว้ว่า "กำกวม" แทนการสุ่มเลือก
    const advisorMap = new Map();
    const advisorAmbiguous = new Set();
    for (const t of advisorTeachers) {
      const key = `${t.firstName}|${t.lastName}`;
      if (advisorMap.has(key)) {
        advisorAmbiguous.add(key);
      } else {
        advisorMap.set(key, t.id);
      }
    }

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
        const { code: major, unrecognized: majorUnrecognized } = mapMajor(row['สาขาวิชา / แผนกการศึกษา']);
        if (majorUnrecognized) {
          errorRows.push({ row: i + 2, email, reason: `ไม่รู้จักสาขาวิชา "${major}" — บันทึกค่าดิบไว้ตามที่กรอก กรุณาตรวจสอบ/แก้ไขในหน้าแก้ไขนักศึกษา` });
        }
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

        // 2. Resolve generalAdvisorId by matching advisor name against pre-fetched teachers.
        // ไม่ได้กรอกชื่ออาจารย์ → null (ล้างค่า). กรอกชื่อแต่หาไม่เจอ/ชื่อซ้ำกันหลายคน →
        // undefined (ไม่แก้ค่าเดิม — กันไม่ให้พิมพ์ชื่อผิด/เว้นวรรคต่างไปลบอาจารย์ที่ตั้งไว้แล้วโดยไม่ตั้งใจ)
        const advisorNameParts = splitFullName(advisorName);
        let generalAdvisorId;
        if (!advisorNameParts.firstName) {
          generalAdvisorId = null;
        } else {
          const advisorKey = `${advisorNameParts.firstName}|${advisorNameParts.lastName}`;
          if (advisorAmbiguous.has(advisorKey)) {
            generalAdvisorId = undefined;
            errorRows.push({ row: i + 2, email, reason: `ชื่ออาจารย์ที่ปรึกษา "${advisorName}" ซ้ำกันหลายคนในระบบ — ไม่ได้แก้ไขอาจารย์ที่ปรึกษาเดิม` });
          } else if (advisorMap.has(advisorKey)) {
            generalAdvisorId = advisorMap.get(advisorKey);
          } else {
            generalAdvisorId = undefined;
            errorRows.push({ row: i + 2, email, reason: `ไม่พบอาจารย์ที่ปรึกษา "${advisorName}" ในระบบ — ไม่ได้แก้ไขอาจารย์ที่ปรึกษาเดิม` });
          }
        }

        // 3. ถ้า studentId นี้ถูก soft-delete (อยู่ในถังขยะ) อยู่ ห้ามอัปเดตทับเงียบๆ —
        // จะทำให้ข้อมูลถูกแก้แต่ยังหายไปจากรายชื่อหลัก (deletedAt ไม่ถูกล้าง) staff ต้องกู้คืนจากถังขยะก่อน
        const existingStudent = await prisma.student.findUnique({
          where: { studentId },
          select: { deletedAt: true },
        });
        if (existingStudent?.deletedAt) {
          throw new Error(`นักศึกษารหัส ${studentId} อยู่ในถังขยะ — กรุณากู้คืนก่อนนำเข้าข้อมูลใหม่`);
        }

        // 4. Upsert Student. generalAdvisorId: null = clear, undefined = leave existing value untouched (Prisma ignores undefined fields).
        await prisma.student.upsert({
          where: { studentId },
          update: {
            prefix, firstName, lastName, firstNameEn, lastNameEn,
            year, major, phone, email, gpa, advisorName, studyProgram,
            generalAdvisorId,
          },
          create: {
            studentId, prefix, firstName, lastName, firstNameEn, lastNameEn,
            year, major, phone, email, gpa,
            advisorName, generalAdvisorId: generalAdvisorId ?? null, studyProgram,
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
