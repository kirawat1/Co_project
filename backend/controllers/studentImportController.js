const XLSX = require('xlsx');
const prisma = require('../config/prismaClient');
const { defaultStudentPassword, hashDefaultStudentPassword } = require('../utils/studentPassword');
const { encryptPassword } = require('../utils/passwordVault');
const { normalizeEmail } = require('../utils/userEmail');
const { getMajorScope } = require('../utils/majorScope');

const ROLE_TH = { teacher: 'อาจารย์', staff: 'เจ้าหน้าที่', student: 'นักศึกษา' };

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
  // ไฟล์เก่าอาจยังมีคอลัมน์ "เกรดเฉลี่ยสะสม (GPA)" — ระบบไม่ใช้ GPA แล้ว ไม่นำเข้า
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
    major:            String(row['สาขาวิชา/แผนกการศึกษา'] || row['สาขาวิชา'] || '').trim() || null,
    studyProgram:     STUDY_PROGRAM_MAP[rawProgram] ?? null,
    advisorName,
    advisorFirstName: advisorFirstName || null,
    advisorLastName:  advisorFirstName ? (advisorLastName || '') : '',
  };
}

// ชื่อหลักสูตรในไฟล์ที่เคยจับคู่ไว้ตอนนำเข้า { "ชื่อในไฟล์": "รหัสหลักสูตร" } — ครั้งต่อไปไม่ต้องเลือกซ้ำ
const MAJOR_ALIASES_KEY = 'MAJOR_IMPORT_ALIASES';

async function loadAliases() {
  const row = await prisma.systemConfig.findUnique({ where: { key: MAJOR_ALIASES_KEY } });
  try { const v = JSON.parse(row?.value || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
}

/**
 * หลักสูตรในไฟล์ (รหัส · ชื่อไทย · ชื่อที่เคยจับคู่ไว้) → รหัสที่มีในระบบ
 * ไม่สร้างหลักสูตรใหม่ให้เอง — เดิมเจ้าหน้าที่นำเข้าแล้วได้หลักสูตรใหม่ที่ใช้ชื่อไทยเป็นรหัส
 * (สะกดต่างนิดเดียวก็แตกเป็นหลักสูตรใหม่ ไม่มีรอบ/อาจารย์ประจำวิชา/เกณฑ์ นักศึกษาค้าง)
 * @param chosen การจับคู่ที่ผู้นำเข้าเลือก (ตรวจแล้วด้วย parseChosenMap) — '' = ข้ามแถวของชื่อนั้น
 */
async function loadMajorLookup(rows, chosen = {}) {
  const names = [...new Set(rows.map((r) => r.major).filter(Boolean))];
  const criteria = await prisma.coopCriteria.findMany({ select: { major: true, nameTh: true }, orderBy: { major: 'asc' } });
  const codes = new Set(criteria.map((c) => c.major));
  const map = new Map();
  const aliases = await loadAliases();
  for (const [name, code] of Object.entries(aliases)) if (codes.has(code)) map.set(name, code);
  for (const c of criteria) { if (c.nameTh) map.set(c.nameTh, c.major); map.set(c.major, c.major); }
  const skipped = new Set();
  for (const [name, code] of Object.entries(chosen)) {
    if (code) map.set(name, code); else { map.delete(name); skipped.add(name); }
  }
  return { names, map, skipped, criteria, aliases };
}

/** body.majorMap (JSON) → { map } หรือ { error } — ต้องเป็นรหัสที่มีจริง และอยู่ในหลักสูตรที่ผู้นำเข้าดูแล */
async function parseChosenMap(raw, scope) {
  if (raw == null || raw === '') return { map: {} };
  let obj;
  try { obj = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return { error: 'majorMap ไม่ใช่ JSON' }; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { error: 'majorMap ต้องเป็น { "ชื่อในไฟล์": "รหัสหลักสูตร" }' };
  const entries = Object.entries(obj).map(([k, v]) => [String(k).trim(), v == null ? '' : String(v).trim()]).filter(([k]) => k);
  const codes = [...new Set(entries.map(([, v]) => v).filter(Boolean))];
  if (codes.length) {
    const found = await prisma.coopCriteria.findMany({ where: { major: { in: codes } }, select: { major: true } });
    const ok = new Set(found.map((c) => c.major));
    const bad = codes.filter((c) => !ok.has(c));
    if (bad.length) return { error: `ไม่พบหลักสูตร ${bad.join(', ')} ในระบบ` };
    if (!scope.all) {
      const out = codes.filter((c) => !scope.majors.includes(c));
      if (out.length) return { error: `หลักสูตร ${out.join(', ')} ไม่อยู่ในหลักสูตรที่คุณดูแล` };
    }
  }
  return { map: Object.fromEntries(entries) };
}

/** หลักสูตรของแถว — เจ้าหน้าที่: ชื่อที่ไม่รู้จักต้องจับคู่ก่อน · ไม่ระบุ = ไม่เปลี่ยน (แถวเดิม) / ว่าง (แถวใหม่) */
function staffRowMajor(rawMajor, map, skipped) {
  if (!rawMajor) return { major: null };
  if (skipped.has(rawMajor)) return { error: `ข้ามตามที่เลือก — หลักสูตร "${rawMajor}"` };
  const major = map.get(rawMajor);
  if (!major) return { error: `ไม่พบหลักสูตร "${rawMajor}" ในระบบ — เลือกหลักสูตรที่ตรงกันก่อนนำเข้า หรือเพิ่มหลักสูตรที่หน้า "จัดการหลักสูตร"` };
  return { major };
}

function rowMajor(scope, rawMajor, lookup, existingStudent) {
  if (scope.all) return staffRowMajor(rawMajor, lookup.map, lookup.skipped);
  if (rawMajor && lookup.skipped.has(rawMajor)) return { error: `ข้ามตามที่เลือก — หลักสูตร "${rawMajor}"` };
  return coopTeacherRowMajor(scope, rawMajor, lookup.map, existingStudent);
}

/**
 * ชื่อในไฟล์ที่ยังจับคู่ไม่ได้ + จำนวนแถว + หลักสูตรที่น่าจะใช่ (ไว้ให้หน้าเว็บให้เลือก — ไม่จับคู่ให้เอง)
 * ไฟล์ระบบทะเบียนเขียน PROGRAMNAME แบบ "วิทยาการคอมพิวเตอร์ ปริญญาตรี ภาคปกติ" ไม่ตรงชื่อหลักสูตรตรงๆ
 * → แนะนำหลักสูตรที่ชื่อไทยยาวที่สุดที่อยู่ในชื่อนั้น
 */
function unknownMajors(rows, lookup, allowed) {
  const count = new Map();
  for (const r of rows) {
    if (r.major && !lookup.map.has(r.major) && !lookup.skipped.has(r.major)) count.set(r.major, (count.get(r.major) || 0) + 1);
  }
  return [...count].map(([name, rowCount]) => {
    const hit = allowed
      .filter((c) => c.nameTh && name.includes(c.nameTh))
      .sort((a, b) => b.nameTh.length - a.nameTh.length)[0];
    return { name, rows: rowCount, suggestion: hit ? hit.major : null };
  });
}

/** จำการจับคู่ที่ผู้นำเข้าเลือก (เฉพาะชื่อที่ไม่ใช่รหัส/ชื่อไทยของหลักสูตรอยู่แล้ว) */
async function rememberAliases(chosen, lookup) {
  const add = Object.entries(chosen).filter(([name, code]) => code && lookup.aliases[name] !== code
    && !lookup.criteria.some((c) => c.major === name || c.nameTh === name));
  if (!add.length) return;
  const value = JSON.stringify({ ...lookup.aliases, ...Object.fromEntries(add) });
  await prisma.systemConfig.upsert({ where: { key: MAJOR_ALIASES_KEY }, update: { value }, create: { key: MAJOR_ALIASES_KEY, value } });
}

/**
 * อาจารย์ประจำวิชานำเข้าได้เฉพาะหลักสูตรที่ดูแล (เจ้าหน้าที่ไม่ผ่านฟังก์ชันนี้)
 *   หลักสูตรในไฟล์ไม่มีในระบบ → ข้าม (สร้างหลักสูตรใหม่ = เจ้าหน้าที่)
 *   ไฟล์ไม่ระบุหลักสูตร → ใช้หลักสูตรที่ดูแล ถ้าดูแลหลักสูตรเดียว
 *   นักศึกษาที่มีอยู่แล้วแต่อยู่นอกหลักสูตรที่ดูแล (รวมยังไม่ระบุหลักสูตร) → ข้าม
 * @returns {{ major?: string, error?: string }}
 */
function coopTeacherRowMajor(scope, rawMajor, map, existingStudent) {
  let major = rawMajor ? map.get(rawMajor) : null;
  if (rawMajor && !major) return { error: `ไม่พบหลักสูตร "${rawMajor}" ในระบบ — ให้เจ้าหน้าที่เพิ่มหลักสูตรก่อน` };
  if (!major) {
    if (scope.majors.length !== 1) return { error: 'ไฟล์ไม่ได้ระบุหลักสูตร (คุณดูแลหลายหลักสูตร)' };
    major = scope.majors[0];
  }
  if (!scope.majors.includes(major)) return { error: `หลักสูตร ${major} ไม่อยู่ในหลักสูตรที่คุณดูแล` };
  if (existingStudent && !scope.majors.includes(existingStudent.major)) {
    return { error: `รหัสนี้เป็นนักศึกษา${existingStudent.major ? `หลักสูตร ${existingStudent.major}` : 'ที่ยังไม่ระบุหลักสูตร'} — ติดต่อเจ้าหน้าที่` };
  }
  return { major };
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
      prisma.student.findMany({ where: { studentId: { in: allStudentIds } }, select: { studentId: true, deletedAt: true, major: true } }),
    ]);
    const scope = await getMajorScope(req, { ignoreFilter: true });
    const chosen = await parseChosenMap(req.body?.majorMap, scope);
    if (chosen.error) return res.status(400).json({ ok: false, message: chosen.error });
    const lookup = await loadMajorLookup(normalizedRows, chosen.map);
    const userByEmail        = new Map(prefetchedUsers.map(u => [normalizeEmail(u.email), u]));
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

      // หลักสูตรที่ไม่มีในระบบ → ข้าม จนกว่าจะเลือกหลักสูตรที่ตรงกัน (ไม่สร้างหลักสูตรใหม่ให้เอง)
      const r = rowMajor(scope, norm.major, lookup, existingStudent);
      if (r.error) {
        willSkip++;
        return { rowNum, studentId, name, email, major: norm.major, studyProgram, advisorName, action: 'skip', advisorStatus: 'empty', error: r.error };
      }
      const major = r.major ?? (existingStudent ? existingStudent.major : null);

      const action = userByEmail.has(normalizeEmail(email)) ? 'update' : 'create';
      if (action === 'create') willCreate++; else willUpdate++;

      let advisorStatus = 'empty';
      if (norm.advisorFirstName) {
        const key = `${norm.advisorFirstName}|${norm.advisorLastName}`;
        if (advisorAmbiguous.has(key))  { advisorStatus = 'ambiguous'; advisorWarnings++; }
        else if (advisorMap.has(key))   { advisorStatus = 'found'; }
        else                            { advisorStatus = 'notFound'; advisorWarnings++; }
      }

      return { rowNum, studentId, name, email, major, studyProgram, advisorName, action, advisorStatus };
    });

    // ตัวเลือกให้จับคู่ — อาจารย์ประจำวิชาเห็นเฉพาะหลักสูตรที่ดูแล
    const allowedMajors = lookup.criteria.filter((c) => scope.all || scope.majors.includes(c.major));
    res.json({
      ok: true,
      rows: previewRows,
      summary: { total: rows.length, willCreate, willUpdate, willSkip, advisorWarnings },
      unknownMajors: unknownMajors(normalizedRows, lookup, allowedMajors),
      majors: allowedMajors,
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
    // บัญชีนักศึกษาใช้อีเมลเป็น username (login ด้วยอีเมล + รหัสผ่านเริ่มต้น = รหัสนักศึกษา)
    // จับคู่บัญชีเดิมด้วยอีเมล และตรวจความเป็นเจ้าของด้วยรหัสนักศึกษาที่ผูกกับบัญชีนั้น
    const allEmails     = [...new Set(normalizedRows.map(r => r.email).filter(Boolean))];
    const allStudentIds = [...new Set(normalizedRows.map(r => r.studentId).filter(Boolean))];
    const [prefetchedUsers, prefetchedByUsername, prefetchedStudents] = await Promise.all([
      prisma.user.findMany({ where: { email: { in: allEmails } }, include: { student: { select: { studentId: true } } } }),
      prisma.user.findMany({ where: { username: { in: allEmails } } }),
      prisma.student.findMany({ where: { studentId: { in: allStudentIds } }, select: { studentId: true, deletedAt: true, major: true, userId: true, user: { select: { email: true } } } }),
    ]);
    const userByEmail        = new Map(prefetchedUsers.map(u => [normalizeEmail(u.email), u]));
    const userByUsername     = new Map(prefetchedByUsername.map(u => [normalizeEmail(u.username), u]));
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

    // หลักสูตรในไฟล์ → รหัสในระบบ (รหัส · ชื่อไทย · ที่เคยจับคู่ · ที่เลือกตอนนี้) — ไม่รู้จัก = ข้ามแถว ไม่สร้างหลักสูตรใหม่
    const scope = await getMajorScope(req, { ignoreFilter: true });
    const chosen = await parseChosenMap(req.body?.majorMap, scope);
    if (chosen.error) return res.status(400).json({ ok: false, message: chosen.error });
    const lookup = await loadMajorLookup(normalizedRows, chosen.map);

    for (let i = 0; i < normalizedRows.length; i++) {
      const norm = normalizedRows[i];
      const { studentId } = norm;
      const email = normalizeEmail(norm.email);

      if (!email || !studentId) {
        errors++;
        errorRows.push({ row: i + 2, email, reason: 'email หรือ id ว่างเปล่า' });
        continue;
      }

      let thisRowCountedAs = null;

      try {
        const existingUser = userByEmail.get(email);
        const existingStudentRow = studentByStudentId.get(studentId);
        const usernameOwner = userByUsername.get(email);
        let user = existingUser || null;
        // ตรวจหลักสูตรก่อนอย่างอื่น (แถวที่หลักสูตรไม่ผ่านข้ามทั้งแถว ไม่มีคำเตือนอื่นปน)
        const majorCheck = rowMajor(scope, norm.major, lookup, existingStudentRow);
        if (majorCheck.error) throw new Error(majorCheck.error);
        if (existingUser) {
          if (existingUser.role && existingUser.role !== 'student') {
            throw new Error(`อีเมล '${email}' เป็นบัญชี${ROLE_TH[existingUser.role] || existingUser.role}อยู่แล้ว`);
          }
          const linkedStudentId = existingUser.student?.studentId;
          if (linkedStudentId && linkedStudentId !== studentId) {
            throw new Error(`อีเมล '${email}' ถูกใช้โดยรหัสนักศึกษา '${linkedStudentId}' แล้ว`);
          }
          if (existingStudentRow?.userId != null && existingStudentRow.userId !== existingUser.id) {
            throw new Error(`รหัสนักศึกษา '${studentId}' ผูกกับอีเมล '${existingStudentRow.user?.email}' อยู่แล้ว`);
          }
          if (usernameOwner && usernameOwner.id !== existingUser.id) {
            throw new Error(`username '${email}' ถูกใช้โดยบัญชีอื่นแล้ว (email: ${usernameOwner.email})`);
          }
        } else {
          // รหัสนักศึกษานี้มีบัญชีอยู่แล้วแต่อีเมลในไฟล์ไม่ตรง — ไม่สร้างบัญชีซ้ำ ให้แก้อีเมลที่หน้าแก้ไขนักศึกษา
          if (existingStudentRow?.userId != null) {
            throw new Error(`รหัสนักศึกษา '${studentId}' ผูกกับอีเมล '${existingStudentRow.user?.email}' อยู่แล้ว — ถ้าอีเมลเปลี่ยน ให้แก้ที่หน้าแก้ไขข้อมูลนักศึกษา`);
          }
          if (usernameOwner) {
            throw new Error(`username '${email}' ถูกใช้โดยบัญชีอื่นแล้ว (email: ${usernameOwner.email})`);
          }
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
                year, phone, studyProgram, advisorName } = norm;
        const resolvedMajor = majorCheck.major;

        // รหัสผ่านเริ่มต้น (รหัสนักศึกษา) ให้บัญชีใหม่ และบัญชีเดิมที่ยังไม่มีรหัสผ่าน
        // บัญชีที่มีรหัสผ่านแล้ว (นักศึกษาเปลี่ยนเอง) นำเข้าซ้ำจะไม่ทับ — hash นอก transaction
        const defaultPasswordHash = (!existingUser || !existingUser.password)
          ? await hashDefaultStudentPassword(studentId)
          : null;
        const defaultPasswordEnc = defaultPasswordHash ? encryptPassword(defaultStudentPassword(studentId)) : null;

        await prisma.$transaction(async (tx) => {
          if (!existingUser) {
            user = await tx.user.upsert({
              where: { username: email },
              update: {},
              create: { username: email, email, password: defaultPasswordHash, passwordEnc: defaultPasswordEnc, role: 'student', provider: 'google' },
            });
          } else {
            // บัญชีเก่าที่ username เป็นรหัสนักศึกษา → เปลี่ยนเป็นอีเมล · ยังไม่มีรหัสผ่าน → ใส่รหัสเริ่มต้น
            const userData = {};
            if (normalizeEmail(existingUser.username) !== email) userData.username = email;
            if (defaultPasswordHash) { userData.password = defaultPasswordHash; userData.passwordEnc = defaultPasswordEnc; }
            if (Object.keys(userData).length > 0) {
              await tx.user.update({ where: { id: existingUser.id }, data: userData });
            }
          }
          await tx.student.upsert({
            where: { studentId },
            update: {
              prefix, firstName, lastName, firstNameEn, lastNameEn,
              year, phone, email, major: resolvedMajor ?? undefined, studyProgram,
              advisorName:     generalAdvisorId !== undefined ? advisorName : undefined,
              generalAdvisorId,
            },
            create: {
              studentId, prefix, firstName, lastName, firstNameEn, lastNameEn,
              year, phone, email, major: resolvedMajor ?? null,
              advisorName, generalAdvisorId: generalAdvisorId ?? null, studyProgram,
              userId: user.id,
            },
          });
        });

        if (!existingUser) {
          // จำบัญชีที่เพิ่งสร้าง — แถวซ้ำในไฟล์เดียวกันจะเป็น "อัปเดต" ไม่สร้างซ้ำ
          const createdUser = { ...user, email, username: email, role: 'student', student: { studentId } };
          userByEmail.set(email, createdUser);
          userByUsername.set(email, createdUser);
          studentByStudentId.set(studentId, { studentId, deletedAt: null, major: resolvedMajor, userId: user.id, user: { email } });
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

    if (created + updated > 0) await rememberAliases(chosen.map, lookup);

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
