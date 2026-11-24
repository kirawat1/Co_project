/**
 * scripts/dev/simulate_phases.js — ขั้นตอนของรอบจำลอง (เรียกจาก simulate_round.js)
 *
 * แผนต่อนักศึกษา (j = ลำดับในหลักสูตร 0–24):
 *   j0 ไม่เคยเข้าระบบ · j1 กรอกโปรไฟล์แต่ไม่ยื่น (SIMIT ไม่เลือก HR → ยื่นไม่ได้)
 *   คำร้อง: j2 ส่งกลับแก้ → ยื่นใหม่ → ผ่าน · j3 ไม่ผ่าน (ยื่นซ้ำต้องไม่ได้) · j4 พักรอเกรด → ผ่าน · j5 ค้างรอพิจารณา · ที่เหลือผ่าน
 *   T000: j6 ไม่ส่ง · j7 ส่งไม่ครบ · j8,j9 ส่งกลับแก้ → ส่งแก้ → ผ่าน · j10 ค้างรอตรวจ · ที่เหลือผ่าน (approve-all / รายไฟล์)
 *   หนังสือขอความอนุเคราะห์: ร่างรอลงนามทั้งชุด (bulk) → ออกจริง (รวมตามบริษัท / เดี่ยว) · j11 ค้างรอลงนาม
 *   ใบตอบรับ: j12 ตีกลับ → ส่งใหม่ · j13 เจ้าหน้าที่รับแทน · j14 ยังไม่ส่ง · ที่เหลือผ่าน
 *   หนังสือส่งตัว: รวม/เดี่ยว · ส่งเอง/เจ้าหน้าที่ส่ง · j15 ยังไม่กดรับ (ถ้านักศึกษานำไปเอง)
 *   T002/T003: j16 T002 ตีกลับ → ส่งใหม่ · j17 T003 ตีกลับ → ส่งใหม่ · j18 T003 ค้างรอตรวจ · j20 ส่งแค่ T002
 *   นิเทศ: บริษัทเดียวกัน + ที่ปรึกษาเดียวกัน = นิเทศรวม (confirm-group + หนังสือรวม) · เดี่ยว: อนุมัติ / ปฏิเสธแล้วเสนอใหม่ /
 *          อาจารย์ร่วมไม่ว่าง (ต้องยืนยันซ้ำ) / ออนไลน์ · ทิ้งค้าง: ยืนยันวันแล้วยังไม่มีหนังสือ · มีหนังสือแล้วยังไม่จบ
 */
const { call, get, form, signin, pool, record, check, startPhase, day } = require('./simulate_round');

async function run(W, ctx) {
  const { prisma, bcrypt, XLSX, PW, MAJORS, PER_MAJOR, FIRST, COMPANIES, nextDocNo, readState, writeState, freeAcademicYear } = ctx;
  const coopOf = (pk) => prisma.studentCoop.findUnique({ where: { studentId: pk } });
  const statusOf = async (pk) => (await coopOf(pk))?.status ?? null;
  const S = (mi, j) => W.students.find((s) => s.mi === mi && s.j === j);
  const staff = () => W.staff[0].token;
  const staff2 = () => W.staff[1].token;
  const M = (mi) => W.majors[MAJORS[mi].code];
  const expectStatus = async (s, want, label) => {
    const got = await statusOf(s.pk);
    return check(Array.isArray(want) ? want.includes(got) : got === want, `${label} (${s.code})`, { want, got });
  };

  // ════════════════════════════════════════════════════════════
  startPhase('1. ตั้งค่าระบบ (เจ้าหน้าที่/อาจารย์ประจำวิชา)');
  // เจ้าหน้าที่คนแรกสร้างแบบเดียวกับ scripts/create_user.js (ระบบจริงก็เริ่มแบบนี้) · คนที่สองสร้างผ่านหน้าเจ้าหน้าที่
  const u1 = await prisma.user.create({ data: { username: 'sim.staff1@kkumail.com', email: 'sim.staff1@kkumail.com', password: await bcrypt.hash(PW, 10), role: 'staff' } });
  await prisma.staffProfile.create({ data: { userId: u1.id, firstName: 'สุดา', lastName: 'จำลองงาน' } });
  W.staff.push({ email: u1.email, userId: u1.id, token: await signin(u1.email, PW, 'staff') });
  await call(staff(), 'POST', '/api/admin/staff', { username: 'sim.staff2@kkumail.com', email: 'sim.staff2@kkumail.com', password: PW, firstName: 'วิไล', lastName: 'จำลองงาน' }, { expect: [200, 201], label: 'เจ้าหน้าที่สร้างบัญชีเจ้าหน้าที่คนที่ 2' });
  W.staff.push({ email: 'sim.staff2@kkumail.com', token: await signin('sim.staff2@kkumail.com', PW, 'staff') });
  check(W.staff[1].token, 'เจ้าหน้าที่คนที่ 2 ล็อกอินได้');

  for (const m of MAJORS) await call(staff(), 'POST', '/api/admin/criteria', { major: m.code, nameTh: m.nameTh }, { label: `เพิ่มหลักสูตร ${m.code}` });
  await call(staff(), 'POST', '/api/admin/criteria', { major: 'SIMCS', nameTh: 'ซ้ำ' }, { expect: 409, label: 'เพิ่มหลักสูตรรหัสซ้ำ → 409' });

  const TPRE = ['ผศ.ดร.', 'อ.', 'รศ.', 'อ.ดร.'];
  for (const [mi, m] of MAJORS.entries()) {
    const slot = { code: m.code, advisors: [] };
    const coopEmail = `sim.coop.${m.code.toLowerCase()}@kkumail.com`;
    const r = await call(staff(), 'POST', '/api/admin/teachers', { prefix: 'ผศ.ดร.', firstName: `ประจำวิชา${mi + 1}`, lastName: 'จำลองสอน', email: coopEmail, password: PW, major: m.code, coopMajors: [m.code] }, { label: `สร้างอาจารย์ประจำวิชา ${m.code}` });
    slot.coop = { email: coopEmail, pk: r.json?.teacher?.id, token: await signin(coopEmail, PW, 'teacher') };
    for (let k = 0; k < 3; k++) {
      const email = `sim.t.${m.code.toLowerCase()}.${k + 1}@kkumail.com`;
      const first = `ที่ปรึกษา${mi + 1}${String.fromCharCode(0x0E01 + k)}`; // ที่ปรึกษา1ก / 1ข / 1ค
      const rr = await call(staff(), 'POST', '/api/admin/teachers', { prefix: TPRE[k], firstName: first, lastName: 'จำลองสอน', email, password: PW, major: m.code }, { label: `สร้างอาจารย์ที่ปรึกษา ${m.code} #${k + 1}` });
      slot.advisors.push({ email, pk: rr.json?.teacher?.id, first, name: `${TPRE[k]}${first} จำลองสอน`, token: await signin(email, PW, 'teacher') });
    }
    W.majors[m.code] = slot;
  }
  check(Object.values(W.majors).every((m) => m.coop.token && m.advisors.every((a) => a.token)), 'อาจารย์ทุกคนล็อกอินได้');

  // รอบสหกิจ: เพิ่มทีละหลักสูตร (ไม่ระบุหลักสูตร = ทุกหลักสูตรในระบบ รวมของจริง)
  const year = await freeAcademicYear();
  for (const m of MAJORS) {
    const r = await call(staff(), 'POST', '/api/admin/coop-periods', { academicYear: year, semester: 1, startDate: day(-7), endDate: day(45), major: m.code }, { label: `เปิดรอบ ${year}/1 ให้ ${m.code}` });
    W.periodId = W.periodId || r.json?.period?.id;
    if (W.periodId) { const st = readState(); if (!st.periodIds.includes(W.periodId)) st.periodIds.push(W.periodId); writeState(st); }
  }
  const pm = await prisma.coopPeriodMajor.findMany({ where: { periodId: W.periodId } });
  check(pm.length === 4 && pm.every((r) => r.major.startsWith('SIM')), 'รอบจำลองมีเฉพาะ 4 หลักสูตรทดสอบ', pm.map((r) => r.major));
  for (const r of pm.filter((x) => !x.isActive)) {
    await call(staff(), 'PATCH', `/api/admin/coop-periods/${W.periodId}/toggle`, { major: r.major, isActive: true }, { label: `เปิดรับสมัคร ${r.major}` });
  }
  // กำหนดส่ง: อาจารย์ประจำวิชาตั้งของหลักสูตรตัวเอง (2 หลักสูตร) · เจ้าหน้าที่ตั้งให้อีก 2
  const deadlines = { T000: { due: day(30), mode: 'SOFT' }, T002: { due: day(100), mode: 'SOFT' }, T003: { due: day(100), mode: 'SOFT' } };
  for (const [mi, m] of MAJORS.entries()) {
    const tok = mi < 2 ? M(mi).coop.token : staff();
    await call(tok, 'PUT', `/api/admin/coop-periods/${W.periodId}/deadlines`, { major: m.code, deadlines }, { label: `ตั้งกำหนดส่ง ${m.code} (${mi < 2 ? 'อาจารย์ประจำวิชา' : 'เจ้าหน้าที่'})` });
    await call(tok, 'POST', '/api/admin/supervision-periods', { periodId: W.periodId, major: m.code, isSupervisionOpen: true, supervisionStartDate: day(0), supervisionEndDate: day(150) }, { label: `เปิดช่วงนัดนิเทศ ${m.code}` });
  }
  await call(M(0).coop.token, 'PUT', `/api/admin/coop-periods/${W.periodId}/deadlines`, { major: 'SIMIT', deadlines }, { expect: 403, label: 'อาจารย์ประจำวิชา SIMCS ตั้งกำหนดส่ง SIMIT → 403' });
  // ค่าตั้งหลังนิเทศเฉพาะหลักสูตร (T005–T008 · แบบประเมินการนิเทศ)
  for (const m of MAJORS) {
    const lc = m.code.toLowerCase();
    const cfg = {
      EVALUATION_FORMS: { instructionText: `ส่งแบบประเมินถึงพี่เลี้ยง (${m.code})`, t005Link: `https://forms.gle/${lc}-t005`, t006Link: `https://forms.gle/${lc}-t006`, ccEmails: M(MAJORS.indexOf(m)).coop.email },
      CONFIG_T007: { instructionText: 'ประเมินสถานประกอบการ', t007Link: `https://forms.gle/${lc}-t007` },
      CONFIG_T008: { instructionText: 'ส่งเล่มรายงาน PDF', driveLink: `https://drive.google.com/drive/folders/${lc}-t008` },
      CONFIG_SUPERVISION_EVAL: { instructionText: 'ประเมินการนิเทศภายใน 7 วัน', evalLink: `https://forms.gle/${lc}-sup`, autoSend: false },
    };
    for (const [key, override] of Object.entries(cfg)) {
      await call(staff(), 'PUT', `/api/admin/major-config/${key}?major=${m.code}`, { override }, { label: `ตั้ง ${key} ของ ${m.code}` });
    }
  }
  // บริษัท + ผู้ติดต่อ (HR)
  for (const [ci, name] of COMPANIES.entries()) {
    const r = await call(staff(), 'POST', '/api/companies', { name, address: `${100 + ci} ถนนมิตรภาพ ตำบลในเมือง อำเภอเมืองขอนแก่น จังหวัดขอนแก่น 40000`, addressNo: String(100 + ci), road: 'มิตรภาพ', subDistrict: 'ในเมือง', district: 'เมืองขอนแก่น', province: 'ขอนแก่น', zipcode: '40000', phone: '043-000000' }, { label: `เพิ่มบริษัท ${name}` });
    const id = r.json?.company?.id || r.json?.data?.id || r.json?.id;
    const c = await call(staff(), 'POST', `/api/companies/${id}/contacts`, { firstName: `HR${ci + 1}`, lastName: 'จำลองบุคคล', position: 'ผู้จัดการฝ่ายบุคคล', email: `hr${ci + 1}@example.com`, phone: '043-111111' }, { label: `เพิ่ม HR ของ ${name}` });
    const contactId = c.json?.contact?.id || c.json?.data?.id || c.json?.id;
    W.companies.push({ id, name, contactId });
  }
  check(W.companies.every((c) => c.id && c.contactId), 'บริษัทและ HR ครบ 6 แห่ง', W.companies);
  // หน้า "ผู้ติดต่อ (HR)" อยู่ในเมนูของอาจารย์ประจำวิชาด้วย (เดิม API ตอบ 403 → หน้าขึ้นโหลดไม่สำเร็จ)
  await get(M(0).coop.token, '/api/companies/contacts', { label: 'อาจารย์ประจำวิชาเปิดหน้าผู้ติดต่อ (HR)' });
  await get(M(0).advisors[0].token, '/api/companies/contacts', { expect: 403, label: 'อาจารย์ทั่วไปเปิดรายชื่อผู้ติดต่อทั้งหมด → 403' });

  // ════════════════════════════════════════════════════════════
  startPhase('2. นำเข้ารายชื่อนักศึกษา (Excel)');
  for (const [mi, m] of MAJORS.entries()) {
    for (let j = 0; j < PER_MAJOR; j++) {
      const studentId = `66880${mi + 1}${String(j).padStart(3, '0')}-${j % 10}`;
      W.students.push({ mi, j, major: m.code, studentId, code: `${m.code}-${String(j).padStart(2, '0')}`, email: `sim.s${mi + 1}${String(j).padStart(2, '0')}@kkumail.com`, first: FIRST[j], last: `จำลอง${m.code.slice(3)}`, prefix: j % 2 ? 'นางสาว' : 'นาย' });
    }
  }
  const xlsxOf = (rows, majorLabel) => {
    const data = rows.map((s) => ({
      'รหัสนักศึกษา': s.studentId, 'คำนำหน้าชื่อ': s.prefix, 'ชื่อ-นามสกุล (ภาษาไทย)': `${s.first} ${s.last}`, 'ชื่อ-นามสกุล (ภาษาอังกฤษ)': `Sim${s.j} Student${s.mi + 1}`,
      'อีเมล': s.email, 'เบอร์โทรศัพท์': `08${String(10000000 + s.mi * 100 + s.j)}`, 'ชั้นปี': '4', 'สาขาวิชา': majorLabel(s), 'ภาคการศึกษา (ปกติ/พิเศษ)': s.j % 5 === 4 ? 'พิเศษ' : 'ปกติ',
      'ชื่ออาจารย์ที่ปรึกษา': `${M(s.mi).advisors[s.j % 3].first} จำลองสอน`,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'รายชื่อ');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  };
  const xfile = (buf, name) => form({}, [{ field: 'file', name, buffer: buf, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }]);
  const byMajor = (mi) => W.students.filter((s) => s.mi === mi);
  // ไฟล์ A: เจ้าหน้าที่นำเข้า SIMCS (สาขาเป็นชื่อไทย) + SIMIT (สาขาเป็นรหัส)
  const fileA = xlsxOf([...byMajor(0), ...byMajor(1)], (s) => (s.mi === 0 ? MAJORS[0].nameTh : MAJORS[1].code));
  let r = await call(staff(), 'POST', '/api/admin/students/import-preview', xfile(fileA, 'รายชื่อ SIMCS+SIMIT.xlsx'), { label: 'ดูตัวอย่างไฟล์นำเข้า (เจ้าหน้าที่ 50 คน)' });
  r = await call(staff(), 'POST', '/api/admin/students/import-excel', xfile(fileA, 'รายชื่อ SIMCS+SIMIT.xlsx'), { label: 'นำเข้า SIMCS+SIMIT (เจ้าหน้าที่)' });
  check(r.json?.summary?.created === 50, 'นำเข้าไฟล์ A สร้างครบ 50 คน', r.json?.summary || r.json);
  check((r.json?.errorRows || []).length === 0, 'นำเข้าไฟล์ A ไม่มีแถวผิดพลาด', r.json?.errorRows);
  // ไฟล์ B: อาจารย์ประจำวิชา SIMGIS นำเข้าหลักสูตรตัวเอง + แอบใส่นักศึกษา SIMAI 1 คน (ต้องไม่ผ่าน)
  const fileB = xlsxOf([...byMajor(2), byMajor(3)[0]], (s) => MAJORS[s.mi].code);
  r = await call(M(2).coop.token, 'POST', '/api/admin/students/import-excel', xfile(fileB, 'รายชื่อ GIS.xlsx'), { label: 'นำเข้า SIMGIS (อาจารย์ประจำวิชา)' });
  check(r.json?.summary?.created === 25 && r.json?.summary?.errors === 1, 'อาจารย์ประจำวิชานำเข้าได้เฉพาะหลักสูตรตัวเอง (25 ผ่าน · SIMAI 1 แถวถูกปฏิเสธ)', r.json?.summary);
  // ไฟล์ C: เจ้าหน้าที่คนที่ 2 นำเข้า SIMAI
  const fileC = xlsxOf(byMajor(3), () => MAJORS[3].nameTh);
  r = await call(staff2(), 'POST', '/api/admin/students/import-excel', xfile(fileC, 'รายชื่อ AI.xlsx'), { label: 'นำเข้า SIMAI (เจ้าหน้าที่คนที่ 2)' });
  check(r.json?.summary?.created === 25, 'นำเข้า SIMAI สร้างครบ 25 คน', r.json?.summary);
  // นำเข้าไฟล์ A ซ้ำ = อัปเดต ไม่สร้างซ้ำ
  r = await call(staff(), 'POST', '/api/admin/students/import-excel', xfile(fileA, 'รายชื่อ SIMCS+SIMIT.xlsx'), { label: 'นำเข้าไฟล์ A ซ้ำ' });
  check(r.json?.summary?.created === 0 && r.json?.summary?.updated === 50, 'นำเข้าซ้ำ = อัปเดต 50 ไม่สร้างใหม่', r.json?.summary);

  const rows = await prisma.student.findMany({ where: { studentId: { in: W.students.map((s) => s.studentId) } }, select: { id: true, studentId: true, major: true, generalAdvisorId: true, userId: true } });
  for (const s of W.students) { const row = rows.find((x) => x.studentId === s.studentId); s.pk = row?.id; s.dbMajor = row?.major; s.generalAdvisorId = row?.generalAdvisorId; }
  check(rows.length === 100, 'มีนักศึกษาในฐานข้อมูล 100 คน', rows.length);
  check(W.students.every((s) => s.dbMajor === s.major), 'ทุกคนอยู่หลักสูตรถูกต้อง (จับคู่ชื่อไทย/รหัส)', W.students.filter((s) => s.dbMajor !== s.major).map((s) => `${s.code}:${s.dbMajor}`));
  check(W.students.every((s) => s.generalAdvisorId === M(s.mi).advisors[s.j % 3].pk), 'ทุกคนได้อาจารย์ที่ปรึกษาทั่วไปจากชื่อในไฟล์', W.students.filter((s) => s.generalAdvisorId !== M(s.mi).advisors[s.j % 3].pk).map((s) => s.code));
  r = await get(M(0).coop.token, '/api/students?limit=200');
  const seen = Array.isArray(r.json) ? r.json : (r.json?.data ?? []);
  check(seen.length > 0 && seen.every((x) => x.major === 'SIMCS'), 'อาจารย์ประจำวิชา SIMCS เห็นเฉพาะนักศึกษา SIMCS', [...new Set(seen.map((x) => x.major))]);

  // ════════════════════════════════════════════════════════════
  startPhase('3. นักศึกษาเข้าระบบ + เลือกที่ปรึกษา/บริษัท');
  // บริษัทต่อกลุ่ม 3 คนติดกัน (j6–8, j9–11, …) · ที่ปรึกษาสหกิจตามกลุ่ม → บริษัทเดียวกัน + ที่ปรึกษาเดียวกัน = นิเทศรวมได้
  for (const s of W.students) {
    const g = s.j >= 6 ? Math.floor((s.j - 6) / 3) : s.j;
    s.company = W.companies[(g + s.mi) % W.companies.length];
    s.advisor = M(s.mi).advisors[s.j >= 6 ? g % 3 : s.j % 3];
  }
  await pool(W.students.filter((s) => s.j > 0), 10, async (s) => {
    s.token = await signin(s.email, s.studentId, 'student');
    if (!s.token) return;
    const me = await get(s.token, '/api/students/me', { label: null });
    if (me.status !== 200) record(false, `เปิดโปรไฟล์ ${s.code}`, me.status);
  });
  check(W.students.filter((s) => s.j > 0).every((s) => s.token), 'นักศึกษา 96 คนล็อกอินด้วยรหัสเริ่มต้น (รหัสนักศึกษา)');
  // นักศึกษา 1 คนเปลี่ยนรหัสผ่านเอง แล้วล็อกอินใหม่
  const pwS = S(0, 1);
  await call(pwS.token, 'PUT', '/api/auth/me/password', { currentPassword: pwS.studentId, newPassword: PW }, { label: 'นักศึกษาเปลี่ยนรหัสผ่านเอง' });
  pwS.token = await signin(pwS.email, PW, 'student');
  check(pwS.token, 'ล็อกอินด้วยรหัสผ่านใหม่ได้');
  await call(null, 'POST', '/api/auth/signin', { email: pwS.email, password: pwS.studentId, role: 'student' }, { expect: 401, label: 'รหัสเดิมใช้ไม่ได้แล้ว → 401' });

  // นักศึกษา 2 คนเพิ่มบริษัทของตัวเอง (ไม่มีในระบบ)
  for (const s of [S(0, 24), S(3, 24)]) {
    const c = await call(s.token, 'POST', '/api/companies', { name: `บริษัท จำลองสตาร์ทอัพ ${s.code} จำกัด`, address: 'ขอนแก่น', province: 'ขอนแก่น' }, { label: `นักศึกษาเพิ่มบริษัทเอง (${s.code})` });
    const id = c.json?.company?.id || c.json?.data?.id || c.json?.id;
    const k = await call(s.token, 'POST', `/api/companies/${id}/contacts`, { firstName: 'HRใหม่', lastName: 'จำลองบุคคล', position: 'HR', email: `hr-${s.code.toLowerCase()}@example.com` }, { label: `นักศึกษาเพิ่ม HR (${s.code})` });
    s.company = { id, name: `บริษัท จำลองสตาร์ทอัพ ${s.code} จำกัด`, contactId: k.json?.contact?.id || k.json?.data?.id || k.json?.id };
  }
  const tl = await get(S(0, 2).token, '/api/teacher', { label: 'นักศึกษาเปิดรายชื่ออาจารย์' });
  const tlist = Array.isArray(tl.json) ? tl.json : (tl.json?.data || tl.json?.teachers || []);
  check(W.students.every((s) => tlist.some((t) => t.id === s.advisor.pk)), 'รายชื่ออาจารย์มีที่ปรึกษาจำลองครบ', tlist.length);
  await pool(W.students.filter((s) => s.token), 10, async (s) => {
    const noHr = s.mi === 1 && s.j === 1;
    await call(s.token, 'PUT', '/api/students/me', { phone: `09${String(10000000 + s.mi * 100 + s.j)}`, coopAdvisorId: s.advisor.pk, companyId: s.company.id, contactIds: noHr ? [] : [s.company.contactId], jobPosition: 'Software Developer' }, { label: null });
  });
  const advOk = await prisma.student.count({ where: { id: { in: W.students.filter((s) => s.token).map((s) => s.pk) }, coopAdvisorId: { not: null } } });
  check(advOk === 96, 'บันทึกโปรไฟล์ (ที่ปรึกษาสหกิจ + บริษัท) ครบ 96 คน', advOk);
  const majorsAfter = await prisma.student.count({ where: { id: { in: W.students.map((s) => s.pk) }, major: { startsWith: 'SIM' } } });
  check(majorsAfter === 100, 'บันทึกโปรไฟล์แล้วหลักสูตรไม่หาย (บั๊กเดิม major ถูกล้าง)', majorsAfter);

  // ════════════════════════════════════════════════════════════
  startPhase('4. ยื่นคำร้อง + พิจารณาคำร้อง');
  const apply = (s, label) => call(s.token, 'POST', '/api/coop/apply', form({ jobPosition: 'Software Developer', coopPeriodId: W.periodId }, [{ field: 'files', name: `ใบแสดงผลการเรียน ${s.first}.pdf` }]), { label });
  const ap = await get(S(1, 2).token, '/api/students/coop-periods/active', { label: 'นักศึกษาเห็นรอบที่เปิด' });
  check(ap.json?.period?.id === W.periodId, 'รอบที่เปิดของนักศึกษา = รอบจำลอง', ap.json?.period?.id);
  await apply(S(1, 1), null).then((x) => check(x.status === 400, 'ยื่นคำร้องโดยไม่เลือก HR → 400', x.status));
  const applicants = W.students.filter((s) => s.j >= 2);
  await pool(applicants, 10, async (s) => { await apply(s, null).then((x) => { if (x.status !== 200) record(false, `ยื่นคำร้อง ${s.code}`, x.json?.message); }); });
  check((await prisma.studentCoop.count({ where: { studentId: { in: applicants.map((s) => s.pk) }, status: 'APPLYING' } })) === applicants.length, `ยื่นคำร้องครบ ${applicants.length} คน`);
  for (const s of applicants) s.coopId = (await coopOf(s.pk)).id;
  // รายการคำร้องของอาจารย์ประจำวิชา = เฉพาะหลักสูตรตัวเอง
  r = await get(M(1).coop.token, `/api/admin/coop-applications?coopPeriodId=${W.periodId}`, { label: 'อาจารย์ประจำวิชาเปิดหน้าคำร้อง' });
  check((r.json?.applications || []).length === 23 && r.json.applications.every((a) => a.student?.major === 'SIMIT'), 'หน้าคำร้องของอาจารย์ประจำวิชา SIMIT มี 23 คำร้อง เฉพาะ SIMIT', (r.json?.applications || []).length);
  const reviewer = (s) => (s.j % 2 ? M(s.mi).coop.token : staff());
  const decide = (s, status, comment, o = {}) => call(o.token || reviewer(s), 'PATCH', `/api/admin/coop-applications/${s.coopId}/status`, { status, comment }, { label: o.label ?? null, expect: o.expect ?? 200 });
  await decide(S(0, 2), 'APPLICATION_EDITS_REQUIRED', '', { expect: 400, label: 'ส่งกลับแก้โดยไม่มีเหตุผล → 400' });
  await decide(S(1, 7), 'QUALIFIED', '', { token: M(0).coop.token, expect: 403, label: 'อาจารย์ประจำวิชา SIMCS พิจารณาคำร้อง SIMIT → 403' });
  await decide(S(0, 7), 'QUALIFIED', '', { token: S(0, 7).advisor.token, expect: 403, label: 'อาจารย์ที่ปรึกษา (ไม่ใช่ประจำวิชา) พิจารณาคำร้อง → 403' });
  await pool(applicants, 6, async (s) => {
    if (s.j === 5) return;
    if (s.j === 2) { await decide(s, 'APPLICATION_EDITS_REQUIRED', 'แนบใบแสดงผลการเรียนฉบับล่าสุด'); return; }
    if (s.j === 3) { await decide(s, 'QUALIFICATION_FAILED', 'หน่วยกิตไม่ครบตามเกณฑ์'); return; }
    if (s.j === 4) { await decide(s, 'PENDING_GRADE', 'รอเกรดภาคปลาย'); return; }
    const x = await decide(s, 'QUALIFIED', '');
    if (x.status !== 200) record(false, `ผ่านคำร้อง ${s.code}`, x.json?.message);
  });
  for (const mi of [0, 1, 2, 3]) {
    const s2 = S(mi, 2);
    await expectStatus(s2, 'APPLICATION_EDITS_REQUIRED', 'ส่งกลับแก้');
    await apply(s2, `นักศึกษาแก้แล้วยื่นใหม่ (${s2.code})`);
    await expectStatus(s2, 'APPLYING', 'ยื่นใหม่กลับไปรอพิจารณา');
    await decide(s2, 'QUALIFIED', '');
    const s3 = S(mi, 3);
    await apply(s3, null).then((x) => check(x.status >= 400 && x.status < 500, `ไม่ผ่านแล้วยื่นซ้ำไม่ได้ (${s3.code})`, x.status));
    await expectStatus(s3, 'QUALIFICATION_FAILED', 'ผล "ไม่ผ่าน" ไม่หาย');
    await decide(S(mi, 4), 'QUALIFIED', '');
  }
  const qualified = W.students.filter((s) => s.j === 2 || s.j === 4 || s.j >= 6);
  const qn = await prisma.studentCoop.count({ where: { studentId: { in: qualified.map((s) => s.pk) }, status: 'QUALIFIED' } });
  check(qn === qualified.length, `ผ่านคำร้อง ${qualified.length} คน`, qn);
  r = await get(M(0).coop.token, '/api/notifications/pending', { label: null });
  check(r.json?.pending?.coopApplications === 1 || r.json?.pending?.applications === 1 || Object.values(r.json?.pending || {}).includes(1), 'งานค้างอาจารย์ประจำวิชา SIMCS: คำร้องรอพิจารณา 1 (j5)', r.json?.pending);

  // ════════════════════════════════════════════════════════════
  startPhase('5. เอกสารสมัคร T000');
  const reqs = await get(S(0, 6).token, '/api/students/doc-requirements', { label: 'นักศึกษาเปิดรายการเอกสาร T000' });
  const reqList = (Array.isArray(reqs.json) ? reqs.json : (reqs.json?.data || reqs.json?.requirements || [])).filter((d) => d.isRequired !== false);
  check(reqList.length > 0, 'มีหัวข้อเอกสารบังคับ', reqList.length);
  const upload = (s, docType, name, label = null) => call(s.token, 'POST', '/api/docs/upload', form({ docType }, [{ field: 'files', name }]), { label });
  const saveForm = (s) => call(s.token, 'POST', '/api/docs/save-form', {
    contactAddrNo: `${s.j + 1}/9`, contactRoad: 'มิตรภาพ', contactSubDistrict: 'ในเมือง', contactDistrict: 'เมืองขอนแก่น', contactProvince: 'ขอนแก่น', contactZipcode: '40000',
    contactPhone: '0812345678', contactEmail: s.email, emergencyName: `นางสมใจ ${s.last}`, emergencyRelation: 'มารดา', emergencyJob: 'ค้าขาย',
    emerAddrNo: '9', emerRoad: 'มิตรภาพ', emerSubDistrict: 'ในเมือง', emerDistrict: 'เมืองขอนแก่น', emerProvince: 'ขอนแก่น', emerZipcode: '40000', emergencyPhone: '0898765432',
    startDate: day(20), endDate: day(140), careerObjective1: 'พัฒนาเว็บแอปพลิเคชัน', careerObjective2: 'ทำงานเป็นทีม', careerObjective3: 'เรียนรู้งานจริง',
  }, { label: null });
  await upload(S(0, 5), reqList[0].docKey, 'ก่อนผ่านคำร้อง.pdf').then((x) => check(x.status === 409, 'ยังไม่ผ่านคำร้อง ส่ง T000 ไม่ได้ → 409', x.status));
  await pool(qualified.filter((s) => s.j !== 6), 8, async (s) => {
    const f = await saveForm(s);
    if (f.status !== 200) record(false, `บันทึกใบสมัคร ${s.code}`, f.json?.message);
    const list = s.j === 7 ? reqList.slice(0, 1) : reqList;
    for (const d of list) {
      const x = await upload(s, d.docKey, `${d.title || d.docKey} - ${s.first}.pdf`);
      if (x.status !== 200) record(false, `อัปโหลด ${d.docKey} ${s.code}`, x.json?.message);
    }
  });
  for (const mi of [0, 1, 2, 3]) { await expectStatus(S(mi, 6), 'QUALIFIED', 'ไม่ส่ง T000 ยังผ่านคำร้องอยู่'); await expectStatus(S(mi, 7), 'QUALIFIED', 'ส่งไม่ครบ ยังไม่เข้ารอตรวจ'); }
  const t000Done = qualified.filter((s) => s.j !== 6 && s.j !== 7);
  const wn = await prisma.studentCoop.count({ where: { studentId: { in: t000Done.map((s) => s.pk) }, status: 'WAITING_FOR_STAFF_CHECK' } });
  check(wn === t000Done.length, `ส่ง T000 ครบ ${t000Done.length} คน → รอตรวจ`, wn);
  // ชื่อไฟล์ภาษาไทยต้องไม่เพี้ยน
  const garbled = await prisma.document.count({ where: { studentId: { in: W.students.map((s) => s.pk) }, OR: [{ name: { contains: 'à¸' } }, { name: { contains: 'à¹' } }] } });
  check(garbled === 0, 'ชื่อไฟล์ภาษาไทยที่นักศึกษาอัปโหลดไม่เพี้ยน', garbled);
  // ตรวจ T000
  const t000Reviewer = (s) => (s.j % 2 ? M(s.mi).coop.token : staff());
  r = await get(M(3).coop.token, '/api/admin/t000/students', { label: 'อาจารย์ประจำวิชาเปิดหน้าตรวจ T000' });
  const t000Rows = Array.isArray(r.json) ? r.json : (r.json?.data || r.json?.students || []);
  check(t000Rows.length > 0 && t000Rows.every((x) => (x.major || x.student?.major) === 'SIMAI'), 'หน้าตรวจ T000 ของอาจารย์ประจำวิชา SIMAI มีเฉพาะ SIMAI', [...new Set(t000Rows.map((x) => x.major || x.student?.major))]);
  await call(M(0).coop.token, 'PUT', '/api/admin/t000/review', { studentId: S(0, 12).pk, status: 'REQ_LETTER_ISSUED' }, { expect: 403, label: 'อาจารย์ประจำวิชาออกหนังสือเอง → 403 (เจ้าหน้าที่เท่านั้น)' });
  await call(staff(), 'PUT', '/api/admin/t000/review', { studentId: S(0, 12).pk, status: 'REQ_LETTER_ISSUED' }, { expect: 400, label: 'ออกหนังสือให้คนที่ T000 ยังไม่ผ่าน → 400' });
  await call(staff(), 'PUT', '/api/admin/t000/review', { studentId: S(1, 8).pk, status: 'EDITS_REQUIRED', comment: '' }, { expect: 400, label: 'ส่งกลับแก้ T000 โดยไม่มีเหตุผล → 400' });
  for (const mi of [0, 1, 2, 3]) {
    for (const j of [8, 9]) {
      const s = S(mi, j);
      const docs = await prisma.document.findMany({ where: { studentId: s.pk, type: reqList[0].docKey } });
      await call(t000Reviewer(s), 'PUT', `/api/admin/doc/${docs[0].id}/status`, { status: 'REJECTED' }, { label: null });
      await call(t000Reviewer(s), 'PUT', '/api/admin/t000/review', { studentId: s.pk, status: 'EDITS_REQUIRED', comment: `${reqList[0].title} ไม่ได้เซ็นรับรองสำเนา` }, { label: `ส่งกลับแก้ T000 (${s.code})` });
      await expectStatus(s, 'EDITS_REQUIRED', 'สถานะส่งกลับแก้');
      await upload(s, reqList[0].docKey, `${reqList[0].title} (แก้แล้ว).pdf`, `นักศึกษาส่งไฟล์แก้ (${s.code})`);
      await expectStatus(s, 'WAITING_FOR_STAFF_CHECK', 'ส่งแก้แล้วกลับไปรอตรวจ');
    }
  }
  const approveT000 = async (s) => {
    if (s.j % 2 === 0) {
      const x = await call(staff(), 'POST', '/api/admin/t000/approve-all', { studentId: s.pk }, { label: null });
      if (x.status !== 200) record(false, `อนุมัติทั้งหมด ${s.code}`, x.json?.message);
    } else {
      const docs = await prisma.document.findMany({ where: { studentId: s.pk, type: { in: reqList.map((d) => d.docKey) } } });
      for (const d of docs) await call(M(s.mi).coop.token, 'PUT', `/api/admin/doc/${d.id}/status`, { status: 'APPROVED' }, { label: null });
      const x = await call(M(s.mi).coop.token, 'PUT', '/api/admin/t000/review', { studentId: s.pk, status: 'DOCS_APPROVED' }, { label: null });
      if (x.status !== 200) record(false, `ผ่าน T000 ${s.code}`, x.json?.message);
    }
  };
  await pool(t000Done.filter((s) => s.j !== 10), 6, approveT000);
  const approved = t000Done.filter((s) => s.j !== 10);
  const an = await prisma.studentCoop.count({ where: { studentId: { in: approved.map((s) => s.pk) }, status: 'DOCS_APPROVED' } });
  check(an === approved.length, `T000 ผ่าน ${approved.length} คน`, an);
  const apDoc = await prisma.document.findFirst({ where: { studentId: S(0, 12).pk, type: reqList[0].docKey } });
  await call(S(0, 12).token, 'DELETE', `/api/docs/delete/${apDoc.id}`, undefined, { expect: 409, label: 'นักศึกษาลบไฟล์ที่ผ่านแล้ว → 409' });

  // ════════════════════════════════════════════════════════════
  startPhase('6. หนังสือขอความอนุเคราะห์ (ร่าง → ลงนาม → ออก)');
  const groupBy = (list, keyFn) => { const m = new Map(); for (const s of list) { const k = keyFn(s); if (!m.has(k)) m.set(k, []); m.get(k).push(s); } return [...m.values()]; };
  const holdDraft = (s) => s.j === 11;
  // ร่างรอลงนามทั้งชุด: บริษัทเดียวกัน = หนังสือรวม 1 ฉบับ
  // คนที่จะค้างรอลงนามได้ร่างเดี่ยวของตัวเอง (ไม่ปนในหนังสือรวมของบริษัท)
  const reqGroups = [...groupBy(approved.filter((s) => !holdDraft(s)), (s) => s.company.id), ...approved.filter(holdDraft).map((s) => [s])];
  const letters = reqGroups.map((g) => ({ studentIds: g.map((s) => s.pk), docNumber: nextDocNo(), group: g }));
  r = await call(staff(), 'PUT', '/api/admin/t000/letter-pending-bulk', { letter: 'REQUEST', docDate: day(0), letters: letters.map(({ studentIds, docNumber }) => ({ studentIds, docNumber })) }, { label: `ร่างหนังสือขอความอนุเคราะห์ ${letters.length} ฉบับ (${approved.length} คน) รอลงนาม` });
  const pendingDrafts = await prisma.studentCoop.count({ where: { studentId: { in: approved.map((s) => s.pk) }, reqLetterPendingAt: { not: null } } });
  check(pendingDrafts === approved.length, 'ทุกคนติดป้ายรอลงนาม', pendingDrafts);
  await call(staff(), 'PUT', '/api/admin/t000/letter-pending-bulk', { letter: 'REQUEST', docDate: day(0), letters: [{ studentIds: [approved[0].pk], docNumber: letters[1].docNumber }] }, { expect: 409, label: 'ร่างด้วยเลขที่ของฉบับอื่น → 409' });
  // ออกจริง (อัปโหลดฉบับลงนาม) — หนังสือรวมต่อบริษัท / คนเดียวออกเดี่ยว · คนที่ j11 ค้างรอลงนาม
  let li = 0;
  for (const L of letters) {
    const group = L.group.filter((s) => !holdDraft(s));
    if (!group.length) continue;
    const delivery = li++ % 2 ? 'STAFF' : 'STUDENT';
    const signed = { field: 'file', name: `หนังสือขอความอนุเคราะห์ ${L.docNumber.split('/')[1]} (ลงนาม).pdf` };
    if (group.length >= 2) {
      const x = await call(staff(), 'PUT', '/api/admin/t000/letter-batch', form({ letter: 'REQUEST', studentIds: JSON.stringify(group.map((s) => s.pk)), docNumber: L.docNumber, docDate: day(0), deliveryMethod: delivery }, [signed]), { label: null });
      if (x.status !== 200) record(false, `ออกหนังสือรวม ${L.docNumber} (${group.length} คน)`, x.json?.message);
    } else {
      const x = await call(staff(), 'PUT', '/api/admin/t000/review', form({ studentId: group[0].pk, status: 'REQ_LETTER_ISSUED', docType: 'DISPATCH_LETTER', reqDocNumber: L.docNumber, reqDocDate: day(0), deliveryMethod: delivery }, [signed]), { label: null });
      if (x.status !== 200) record(false, `ออกหนังสือเดี่ยว ${L.docNumber}`, x.json?.message);
    }
    for (const s of group) s.reqDelivery = delivery;
  }
  const issued = approved.filter((s) => !holdDraft(s));
  const isn = await prisma.studentCoop.count({ where: { studentId: { in: issued.map((s) => s.pk) }, status: 'REQ_LETTER_ISSUED', reqLetterUrl: { not: null }, reqLetterPendingAt: null } });
  check(isn === issued.length, `ออกหนังสือขอความอนุเคราะห์ ${issued.length} คน (ป้ายรอลงนามหายเมื่อออกจริง)`, isn);
  for (const mi of [0, 1, 2, 3]) {
    const h = S(mi, 11); if (!approved.includes(h)) continue;
    const c = await coopOf(h.pk);
    check(c.status === 'DOCS_APPROVED' && c.reqLetterPendingAt, `ค้างรอลงนาม (${h.code})`, { status: c.status, pending: c.reqLetterPendingAt });
  }
  // เลขที่หนังสือไม่ซ้ำข้ามฉบับ
  const nums = await prisma.studentCoop.findMany({ where: { studentId: { in: issued.map((s) => s.pk) } }, select: { reqDocNumber: true, reqLetterBatch: true, companyId: true } });
  const byNum = groupBy(nums, (n) => n.reqDocNumber);
  check(byNum.every((g) => new Set(g.map((x) => x.companyId)).size === 1), 'เลขที่หนังสือเดียวกันใช้กับบริษัทเดียวกันเท่านั้น');
  const thaiLetter = await prisma.document.count({ where: { studentId: { in: issued.map((s) => s.pk) }, type: 'DISPATCH_LETTER', name: { contains: 'หนังสือขอความอนุเคราะห์' } } });
  check(thaiLetter === issued.length, 'ชื่อไฟล์หนังสือลงนาม (ชื่อไทย) ถูกต้องทุกคน', thaiLetter);
  // นักศึกษารับหนังสือ (นำไปยื่นเอง)
  await pool(issued.filter((s) => s.reqDelivery === 'STUDENT'), 8, async (s) => {
    const x = await call(s.token, 'POST', '/api/students/acknowledge-dispatch', undefined, { label: null });
    if (x.status !== 200) record(false, `นักศึกษารับหนังสือ ${s.code}`, x.json?.message);
  });
  const ackN = await prisma.studentCoop.count({ where: { studentId: { in: issued.filter((s) => s.reqDelivery === 'STUDENT').map((s) => s.pk) }, status: 'WAITING_FOR_PLACEMENT_LETTER' } });
  check(ackN === issued.filter((s) => s.reqDelivery === 'STUDENT').length, 'นักศึกษาที่นำหนังสือไปเอง กดรับแล้ว → รอใบตอบรับ', ackN);

  // ════════════════════════════════════════════════════════════
  startPhase('7. ใบตอบรับจากบริษัท');
  const accReviewer = (s) => (s.j % 2 ? M(s.mi).coop.token : staff2());
  for (const s of issued.filter((x) => x.j === 13)) {
    await call(staff(), 'POST', '/api/admin/t000/acceptance-received', form({ studentId: s.pk, note: 'บริษัทส่งทางอีเมล' }, [{ field: 'file', name: 'ใบตอบรับ (บริษัทส่งตรง).pdf' }]), { label: `เจ้าหน้าที่บันทึกใบตอบรับแทน (${s.code})` });
    await expectStatus(s, 'ACCEPTANCE_CHECKED', 'รับแทนแล้วถือว่าตรวจแล้ว');
  }
  const accUploaders = issued.filter((s) => s.j !== 13 && s.j !== 14);
  await pool(accUploaders, 8, async (s) => {
    const x = await upload(s, 'CP-ACCEPTANCE', `ใบตอบรับ ${s.company.name}.pdf`);
    if (x.status !== 200) record(false, `ส่งใบตอบรับ ${s.code}`, x.json?.message);
  });
  const wl = await prisma.studentCoop.count({ where: { studentId: { in: accUploaders.map((s) => s.pk) }, status: 'WAITING_FOR_STAFF_CHECK_LETTER' } });
  check(wl === accUploaders.length, `ส่งใบตอบรับ ${accUploaders.length} คน → รอตรวจ`, wl);
  for (const s of accUploaders.filter((x) => x.j === 12)) {
    await call(accReviewer(s), 'PUT', '/api/admin/t000/review', { studentId: s.pk, status: 'WAITING_FOR_PLACEMENT_LETTER', comment: 'ใบตอบรับไม่มีตราบริษัท' }, { label: `ตีกลับใบตอบรับ (${s.code})` });
    await expectStatus(s, 'WAITING_FOR_PLACEMENT_LETTER', 'ตีกลับแล้วรอส่งใหม่');
    await upload(s, 'CP-ACCEPTANCE', 'ใบตอบรับ (มีตราบริษัท).pdf', `ส่งใบตอบรับใหม่ (${s.code})`);
  }
  await pool(accUploaders, 6, async (s) => {
    const x = await call(accReviewer(s), 'PUT', '/api/admin/t000/review', { studentId: s.pk, status: 'ACCEPTANCE_CHECKED' }, { label: null });
    if (x.status !== 200) record(false, `ใบตอบรับผ่าน ${s.code}`, x.json?.message);
  });
  const accepted = issued.filter((s) => s.j !== 14);
  const acn = await prisma.studentCoop.count({ where: { studentId: { in: accepted.map((s) => s.pk) }, status: 'ACCEPTANCE_CHECKED' } });
  check(acn === accepted.length, `ใบตอบรับผ่าน ${accepted.length} คน`, acn);
  await upload(S(0, 14), 'T002_FORM', 'T002 ก่อนเวลา.pdf').then((x) => check(x.status === 400, 'ยังไม่เริ่มฝึกงาน ส่ง T002 ไม่ได้ → 400', x.status));

  // ════════════════════════════════════════════════════════════
  startPhase('8. หนังสือส่งตัว');
  const placeGroups = groupBy(accepted, (s) => s.company.id);
  let pi = 0;
  for (const g of placeGroups) {
    const delivery = pi++ % 2 ? 'STUDENT' : 'STAFF';
    const no = nextDocNo();
    const signed = { field: 'file', name: `หนังสือส่งตัว ${no.split('/')[1]} (ลงนาม).pdf` };
    if (g.length >= 2) {
      await call(staff(), 'PUT', '/api/admin/t000/letter-pending', { studentIds: g.map((s) => s.pk), letter: 'PLACEMENT', docNumber: no, docDate: day(0) }, { label: null });
      const x = await call(staff(), 'PUT', '/api/admin/t000/letter-batch', form({ letter: 'PLACEMENT', studentIds: JSON.stringify(g.map((s) => s.pk)), docNumber: no, docDate: day(0), deliveryMethod: delivery }, [signed]), { label: null });
      if (x.status !== 200) record(false, `ออกหนังสือส่งตัวรวม ${no} (${g.length} คน)`, x.json?.message);
    } else {
      await call(staff(), 'PUT', '/api/admin/t000/letter-pending', { studentId: g[0].pk, letter: 'PLACEMENT', docNumber: no, docDate: day(0) }, { label: null });
      const x = await call(staff(), 'PUT', '/api/admin/t000/review', form({ studentId: g[0].pk, status: 'PLACEMENT_LETTER_ISSUED', docType: 'PLACEMENT_LETTER', placeDocNumber: no, placeDocDate: day(0), actualStartDate: day(20), actualEndDate: day(140), deliveryMethod: delivery }, [signed]), { label: null });
      if (x.status !== 200) record(false, `ออกหนังสือส่งตัวเดี่ยว ${no}`, x.json?.message);
    }
    for (const s of g) s.placeDelivery = delivery;
  }
  const staffSent = accepted.filter((s) => s.placeDelivery === 'STAFF');
  const studentSent = accepted.filter((s) => s.placeDelivery === 'STUDENT');
  check((await prisma.studentCoop.count({ where: { studentId: { in: staffSent.map((s) => s.pk) }, status: 'INTERNSHIP_STARTED' } })) === staffSent.length, `เจ้าหน้าที่ส่งหนังสือให้บริษัท ${staffSent.length} คน → เริ่มฝึกงานทันที`);
  check((await prisma.studentCoop.count({ where: { studentId: { in: studentSent.map((s) => s.pk) }, status: 'PLACEMENT_LETTER_ISSUED' } })) === studentSent.length, `นักศึกษานำไปเอง ${studentSent.length} คน → รอกดรับ`);
  await pool(studentSent.filter((s) => s.j !== 15), 8, async (s) => {
    const x = await call(s.token, 'POST', '/api/students/download-placement-letter', undefined, { label: null });
    if (x.status !== 200) record(false, `รับหนังสือส่งตัว ${s.code}`, x.json?.message);
  });
  const interns = accepted.filter((s) => s.placeDelivery === 'STAFF' || s.j !== 15);
  const inN = await prisma.studentCoop.count({ where: { studentId: { in: interns.map((s) => s.pk) }, status: 'INTERNSHIP_STARTED' } });
  check(inN === interns.length, `เริ่มฝึกงาน ${interns.length} คน`, inN);
  await call(interns[0].token, 'POST', '/api/docs/upload', form({ docType: 'CP-ACCEPTANCE' }, [{ field: 'files', name: 'เปลี่ยนใบตอบรับ.pdf' }]), { expect: 400, label: 'ออกหนังสือส่งตัวแล้ว เปลี่ยนใบตอบรับไม่ได้ → 400' });
  await call(interns[0].token, 'PUT', '/api/students/me', { companyId: W.companies[5].id === interns[0].company.id ? W.companies[4].id : W.companies[5].id, contactIds: [] }, { expect: 409, label: 'ออกหนังสือแล้ว นักศึกษาเปลี่ยนบริษัทเองไม่ได้ → 409' });

  // ════════════════════════════════════════════════════════════
  startPhase('9. T002 / T003 ระหว่างฝึกงาน');
  const t002Body = (s) => ({ companyNameTh: s.company.name, addressNo: '100', road: 'มิตรภาพ', subDistrict: 'ในเมือง', district: 'เมืองขอนแก่น', province: 'ขอนแก่น', zipcode: '40000', companyPhone: '043-000000', managerName: 'นายผู้จัดการ จำลอง', managerPosition: 'CTO', supervisorName: `พี่เลี้ยง${s.j} จำลอง`, supervisorPosition: 'Senior Developer', supervisorEmail: `mentor-${s.code.toLowerCase()}@example.com`, supervisorPhone: '0811111111', jobPosition: 'Software Developer', jobDescription: 'พัฒนา REST API และหน้าเว็บ', emergencyName: `นางสมใจ ${s.last}`, emergencyPhone: '0898765432' });
  const t003Body = () => ({ reportTitleTh: 'ระบบจัดการคลังสินค้า', reportTitleEn: 'Inventory System', objectives: 'ลดเวลานับสต็อก', expectedOutcomes: 'ระบบใช้งานได้จริง', scope: 'เว็บแอป', methodology: 'Agile', workPlan: JSON.stringify([{ task: 'เก็บความต้องการ', weeks: [1, 2] }]) });
  await pool(interns, 8, async (s) => {
    let x = await call(s.token, 'POST', '/api/docs/t002-form', t002Body(s), { label: null });
    if (x.status !== 200) record(false, `บันทึก T002 ${s.code}`, x.json?.message);
    x = await upload(s, 'T002_FORM', `T002 แจ้งรายละเอียดงาน ${s.first}.pdf`);
    if (x.status !== 200) record(false, `ส่ง T002 ${s.code}`, x.json?.message);
    if (s.j === 20) return;
    x = await call(s.token, 'POST', '/api/docs/t003-form', t003Body(), { label: null });
    if (x.status !== 200) record(false, `บันทึก T003 ${s.code}`, x.json?.message);
    x = await upload(s, 'T003_FORM', `T003 โครงร่างรายงาน ${s.first}.pdf`);
    if (x.status !== 200) record(false, `ส่ง T003 ${s.code}`, x.json?.message);
  });
  const mentors = await prisma.mentor.count({ where: { email: { startsWith: 'mentor-sim' } } });
  check(mentors === interns.length, 'ส่ง T002 แล้วพี่เลี้ยงเข้าระบบครบทุกคน', mentors);
  r = await get(M(0).coop.token, '/api/notifications/pending', { label: null });
  const exp002 = interns.filter((s) => s.mi === 0).length;
  check(r.json?.pending?.t002 === exp002, `งานค้าง T002 ของอาจารย์ประจำวิชา SIMCS = ${exp002}`, r.json?.pending);
  const reviewForm = (who, s, form_, status, comment, label = null, expect = 200) =>
    call(who, 'PUT', who === M(s.mi).coop.token || who === staff() ? `/api/admin/documents/review-${form_.toLowerCase()}` : `/api/teacher/documents/review-${form_.toLowerCase()}`, { studentId: s.pk, status, comment }, { label, expect });
  const other = interns.find((x) => x.advisor.pk !== interns[0].advisor.pk);
  await reviewForm(other.advisor.token, interns[0], 'T002', 'T002_SUBMITTED', '', 'ที่ปรึกษาคนอื่นตรวจ T002 ของนักศึกษาที่ไม่ใช่ของตัวเอง → 403', 403);
  for (const s of interns) {
    const who = s.j % 3 === 0 ? M(s.mi).coop.token : s.advisor.token;
    if (s.j === 16) {
      await reviewForm(who, s, 'T002', 'T002_EDITS_REQUIRED', '', 'ตีกลับ T002 โดยไม่มีเหตุผล → 400', 400);
      await reviewForm(who, s, 'T002', 'T002_EDITS_REQUIRED', 'ระบุหน้าที่งานให้ชัดเจน', `ตีกลับ T002 (${s.code})`);
      await upload(s, 'T002_FORM', 'T002 (แก้ไข).pdf', `ส่ง T002 ใหม่ (${s.code})`);
    }
    await reviewForm(who, s, 'T002', 'T002_SUBMITTED', '', null).then((x) => { if (x.status !== 200) record(false, `T002 ผ่าน ${s.code}`, x.json?.message); });
    if (s.j === 20 || s.j === 18) continue;
    if (s.j === 17) {
      await reviewForm(who, s, 'T003', 'T003_EDITS_REQUIRED', 'ขอบเขตงานกว้างเกินไป', `ตีกลับ T003 (${s.code})`);
      await upload(s, 'T003_FORM', 'T003 (แก้ไข).pdf', `ส่ง T003 ใหม่ (${s.code})`);
    }
    await reviewForm(who, s, 'T003', 'T003_APPROVED', '', null).then((x) => { if (x.status !== 200) record(false, `T003 ผ่าน ${s.code}`, x.json?.message); });
  }
  const t002ok = await prisma.document.count({ where: { studentId: { in: interns.map((s) => s.pk) }, type: 'T002_FORM', status: 'APPROVED' } });
  check(t002ok === interns.length, `T002 ผ่าน ${interns.length} คน`, t002ok);
  const t003exp = interns.filter((s) => s.j !== 20 && s.j !== 18).length;
  const t003ok = await prisma.document.count({ where: { studentId: { in: interns.map((s) => s.pk) }, type: 'T003_FORM', status: 'APPROVED' } });
  check(t003ok === t003exp, `T003 ผ่าน ${t003exp} คน`, t003ok);
  check((await prisma.studentCoop.count({ where: { studentId: { in: interns.map((s) => s.pk) }, status: 'INTERNSHIP_STARTED' } })) === interns.length, 'ตรวจ T002/T003 แล้วสถานะหลักยังเป็น "ส่งเอกสารฝึกสหกิจ"');

  // ════════════════════════════════════════════════════════════
  startPhase('10. นัดนิเทศ (เดี่ยว · รวม · อาจารย์ร่วม · หนังสือ · จบนิเทศ)');
  // วันนิเทศไล่ต่อหลักสูตร (ไม่ซ้ำกันในหลักสูตร) — อาจารย์ร่วมเป็นที่ปรึกษาคนอื่นในหลักสูตรเดียวกัน วันชนกันระบบจะไม่ให้ยืนยัน (ถูกต้อง)
  const slotOf = new Map();
  const nextDay = (s) => { const n = (slotOf.get(s.mi) || 0) + 1; slotOf.set(s.mi, n); return 7 + n; };
  const supGroups = groupBy(interns, (s) => `${s.company.id}|${s.advisor.pk}`);
  for (const g of supGroups) {
    const d1 = nextDay(g[0]); const d2 = nextDay(g[0]);
    for (const [k, s] of g.entries()) {
      s.supGroup = g.length >= 2 ? g : null;
      s.proposed = g.length >= 2 ? [d1, d2] : [d1, d2];
      const online = g.length === 1 && s.j % 4 === 1;
      // กลุ่มบริษัทเดียวกัน: แต่ละคนดูคิวบริษัท (company-queue) แล้วเสนอวันเดียวกันคนละช่วงเวลา
      if (g.length >= 2) {
        const q = await get(s.token, '/api/coop/supervision/company-queue', { label: null });
        if (q.status !== 200) record(false, `เปิดคิวนิเทศของบริษัท ${s.code}`, q.status);
      }
      const hh = (h) => `${String(h).padStart(2, '0')}:00`;
      const slot = (i) => (g.length >= 2 ? `${hh(9 + k)}-${hh(10 + k)}` : i ? '13:00-16:00' : '09:00-12:00');
      const dates = s.proposed.map((d, i) => `${day(d)}|${slot(i)}|${online ? 'ONLINE' : 'ONSITE'}`);
      const x = await call(s.token, 'POST', '/api/coop/supervision/propose', { proposedDates: JSON.stringify(dates), supervisionType: online ? 'ONLINE' : 'ONSITE', ...(online ? { onlineLink: 'https://meet.google.com/sim-abc' } : {}) }, { label: null });
      if (x.status !== 200) record(false, `เสนอวันนิเทศ ${s.code}`, x.json?.message);
      s.apptId = (await prisma.supervisionAppointment.findUnique({ where: { studentId: s.pk } }))?.id;
      void k;
    }
  }
  check(interns.every((s) => s.apptId), `นักศึกษาเสนอวันนิเทศครบ ${interns.length} คน`, interns.filter((s) => !s.apptId).map((s) => s.code));
  await call(S(0, 14).token, 'POST', '/api/coop/supervision/propose', { proposedDates: JSON.stringify([`${day(30)}|09:00-12:00|ONSITE`]), supervisionType: 'ONSITE' }, { expect: 403, label: 'ยังไม่เริ่มฝึกงาน นัดนิเทศไม่ได้ → 403' });
  await call(interns[0].token, 'POST', '/api/coop/supervision/propose', { proposedDates: JSON.stringify([`${day(-1)}|09:00-12:00|ONSITE`]), supervisionType: 'ONSITE' }, { expect: 400, label: 'เสนอวันที่ผ่านมาแล้ว → 400' });
  r = await get(M(0).advisors[0].token, '/api/notifications/pending', { label: null });
  const expSup = interns.filter((s) => s.advisor.pk === M(0).advisors[0].pk).length;
  check(Object.values(r.json?.pending || {}).includes(expSup), `งานค้างนิเทศของที่ปรึกษา SIMCS#1 = ${expSup}`, r.json?.pending);
  // อาจารย์ร่วม: อาจารย์ประจำวิชาตั้งอาจารย์ร่วมให้นัดเดี่ยว 2 นัดแรกของแต่ละหลักสูตร
  const singles = interns.filter((s) => !s.supGroup);
  const groups = supGroups.filter((g) => g.length >= 2);
  const coPicks = [];
  for (const mi of [0, 1, 2, 3]) coPicks.push(...singles.filter((s) => s.mi === mi).slice(0, 2));
  for (const s of coPicks) {
    s.co = M(s.mi).advisors.find((a) => a.pk !== s.advisor.pk);
    await call(M(s.mi).coop.token, 'PUT', `/api/admin/supervisions/${s.apptId}/co-teachers`, { coTeacherIds: [s.co.pk] }, { label: `ตั้งอาจารย์นิเทศร่วม (${s.code})` });
  }
  await call(M(1).coop.token, 'PUT', `/api/admin/supervisions/${coPicks[0].apptId}/co-teachers`, { coTeacherIds: [M(1).advisors[0].pk] }, { expect: 403, label: 'อาจารย์ประจำวิชา SIMIT ตั้งอาจารย์ร่วมให้นัด SIMCS → 403' });
  // อาจารย์ร่วมระบุวันว่าง: คนแรกของแต่ละคู่ว่างวันแรก · คนที่สองว่างเฉพาะวันที่สอง (อาจารย์หลักจะเลือกวันแรก → ต้องเตือน)
  for (const [k, s] of coPicks.entries()) {
    const free = k % 2 === 0 ? [day(s.proposed[0])] : [day(s.proposed[1])];
    await call(s.co.token, 'PUT', `/api/teacher/supervisions/${s.apptId}/availability`, { availableDates: free }, { label: `อาจารย์ร่วมระบุวันว่าง (${s.code})` });
  }
  // อาจารย์หลักพิจารณานัดเดี่ยว
  const rejectOnce = new Set(singles.filter((s) => s.j % 5 === 2).map((s) => s.code));
  for (const [k, s] of singles.entries()) {
    const date = `${day(s.proposed[0])}T09:00:00`;
    if (rejectOnce.has(s.code)) {
      await call(s.advisor.token, 'PUT', `/api/teacher/supervisions/${s.apptId}/review`, { action: 'REJECT', rejectReason: 'ติดสอบ ขอเลื่อนเป็นสัปดาห์ถัดไป' }, { label: `ปฏิเสธวันนิเทศ (${s.code})` });
      const nd = nextDay(s);
      s.proposed = [nd];
      await call(s.token, 'POST', '/api/coop/supervision/propose', { proposedDates: JSON.stringify([`${day(nd)}|09:00-12:00|ONSITE`]), supervisionType: 'ONSITE' }, { label: `นักศึกษาเสนอวันใหม่ (${s.code})` });
      if (s.co) await call(s.co.token, 'PUT', `/api/teacher/supervisions/${s.apptId}/availability`, { availableDates: [day(nd)] }, { label: null });
    }
    const coIdx = coPicks.indexOf(s);
    const body = { action: 'APPROVE', confirmedDate: `${day(s.proposed[0])}T09:00:00` };
    let x = await call(s.advisor.token, 'PUT', `/api/teacher/supervisions/${s.apptId}/review`, body, { label: null, expect: [200, 409] });
    if (coIdx >= 0 && coIdx % 2 === 1 && !rejectOnce.has(s.code)) {
      check(x.status === 409 && x.json?.code === 'CO_TEACHER_UNAVAILABLE', `อาจารย์ร่วมไม่ว่างวันนั้น → เตือนก่อน (${s.code})`, { status: x.status, code: x.json?.code });
      x = await call(s.advisor.token, 'PUT', `/api/teacher/supervisions/${s.apptId}/review`, { ...body, acknowledgeUnavailable: true }, { label: `ยืนยันซ้ำทั้งที่อาจารย์ร่วมไม่ว่าง (${s.code})` });
    } else if (x.status !== 200) record(false, `อนุมัติวันนิเทศ ${s.code}`, x.json?.message);
    void k; void date;
  }
  await call(singles[1].advisor.token, 'PUT', `/api/teacher/supervisions/${singles[0].apptId}/review`, { action: 'APPROVE', confirmedDate: `${day(singles[0].proposed[0])}T09:00:00` }, { expect: [403, 400], label: 'อาจารย์ที่ไม่ใช่ผู้นิเทศหลักกดอนุมัติ → ปฏิเสธ' });
  // นิเทศรวม: ที่ปรึกษาเปิดหน้ารวมตามบริษัท แล้วยืนยันทั้งกลุ่มวันเดียว
  for (const g of groups) {
    const adv = g[0].advisor;
    const bc = await get(adv.token, '/api/teacher/supervisions/by-company', { label: null });
    const flat = JSON.stringify(bc.json || {});
    check(g.every((s) => flat.includes(`"id":${s.apptId}`) || flat.includes(`"appointmentId":${s.apptId}`)), `หน้านิเทศตามบริษัทแสดงกลุ่ม ${g[0].company.name.slice(0, 18)}… (${g.length} คน)`, bc.status);
    const x = await call(adv.token, 'POST', '/api/teacher/supervisions/confirm-group', { appointmentIds: g.map((s) => s.apptId), confirmedDate: `${day(g[0].proposed[0])}T09:00:00` }, { label: null });
    if (x.status !== 200) record(false, `ยืนยันนิเทศรวม ${g.map((s) => s.code).join(',')}`, x.json?.message);
  }
  const confirmed = await prisma.supervisionAppointment.findMany({ where: { id: { in: interns.map((s) => s.apptId) } }, select: { id: true, status: true, confirmedDate: true, groupId: true, teacherId: true } });
  check(confirmed.every((a) => a.status === 'DATE_CONFIRMED'), `ยืนยันวันนิเทศครบ ${interns.length} นัด`, confirmed.filter((a) => a.status !== 'DATE_CONFIRMED').length);
  for (const g of groups) {
    const rowsG = confirmed.filter((a) => g.some((s) => s.apptId === a.id));
    const times = rowsG.map((a) => new Date(a.confirmedDate).getTime());
    check(new Set(rowsG.map((a) => a.groupId)).size === 1 && rowsG[0].groupId, `นิเทศรวมได้ groupId เดียวกัน (${g.map((s) => s.code).join(',')})`, rowsG.map((a) => a.groupId));
    check(new Set(times).size === times.length, `นิเทศรวม: แต่ละคนได้ช่วงเวลาของตัวเอง ไม่ทับกัน (${g[0].code}…)`, rowsG.map((a) => a.confirmedDate));
  }
  // ชนกันเอง: อาจารย์คนเดียวต้องไม่มีสองนัดเวลาเดียวกัน
  const byTeacher = groupBy(confirmed, (a) => a.teacherId);
  check(byTeacher.every((list) => new Set(list.map((a) => new Date(a.confirmedDate).getTime())).size === list.length), 'อาจารย์ไม่มีนัดนิเทศเวลาซ้ำกัน');
  // ปฏิทิน
  r = await get(interns[0].token, '/api/coop/supervision/calendar', { label: 'นักศึกษาเปิดปฏิทินนิเทศ' });
  r = await get(staff(), '/api/admin/supervisions?coopPeriodId=' + W.periodId, { label: 'เจ้าหน้าที่เปิดหน้าจัดการนิเทศ' });
  const supRows = Array.isArray(r.json) ? r.json : (r.json?.data || r.json?.supervisions || []);
  check(interns.every((s) => supRows.some((a) => a.id === s.apptId)), 'หน้าจัดการนิเทศมีนัดจำลองครบ', supRows.length);
  // หนังสือขอนิเทศ: กลุ่ม = หนังสือรวม 1 ฉบับ · เดี่ยว = ฉบับละคน · ทิ้งไว้หลักสูตรละ 1 นัด (ยืนยันแล้ว ยังไม่ออกหนังสือ)
  const leaveNoLetter = new Set([0, 1, 2, 3].map((mi) => singles.filter((s) => s.mi === mi).slice(-1)[0]?.code).filter(Boolean));
  const letterUnits = [...groups.map((g) => g), ...singles.filter((s) => !leaveNoLetter.has(s.code)).map((s) => [s])];
  await pool(letterUnits, 4, async (unit) => {
    const no = nextDocNo();
    const ids = unit.map((s) => s.apptId);
    let x = await call(staff(), 'PUT', `/api/admin/supervisions/${ids[0]}/letter-pending`, { docNumber: no, docDate: day(0), ...(unit.length > 1 ? { appointmentIds: ids } : {}) }, { label: null });
    if (x.status !== 200) record(false, `ร่างหนังสือขอนิเทศ ${no}`, x.json?.message);
    x = await call(staff(), 'POST', `/api/admin/supervisions/${ids[0]}/upload-letter`, form({ docNumber: no, docDate: day(0), ...(unit.length > 1 ? { appointmentIds: JSON.stringify(ids) } : {}) }, [{ field: 'file', name: `หนังสือขอนิเทศ ${no.split('/')[1]} (ลงนาม).pdf` }]), { label: null });
    if (x.status !== 200) record(false, `ออกหนังสือขอนิเทศ ${no} (${unit.length} คน)`, x.json?.message);
  });
  const lettered = interns.filter((s) => !leaveNoLetter.has(s.code));
  const lu = await prisma.supervisionAppointment.findMany({ where: { id: { in: lettered.map((s) => s.apptId) } }, select: { status: true, letterDocNumber: true, groupId: true } });
  check(lu.every((a) => a.status === 'LETTER_UPLOADED'), `ออกหนังสือขอนิเทศ ${lettered.length} นัด`, lu.filter((a) => a.status !== 'LETTER_UPLOADED').length);
  check(groupBy(lu.filter((a) => a.groupId), (a) => a.groupId).every((g) => new Set(g.map((a) => a.letterDocNumber)).size === 1), 'นิเทศรวมได้เลขที่หนังสือเดียวกันทั้งกลุ่ม');
  r = await get(M(2).coop.token, '/api/notifications/pending', { label: null });
  const expMgr = interns.filter((s) => s.mi === 2 && leaveNoLetter.has(s.code)).length;
  check(r.json?.pending?.supervisionManager === undefined || r.json?.pending?.supervisionManager === expMgr, `งานค้างหน้าจัดการนิเทศ SIMGIS = ${expMgr}`, r.json?.pending);
  // จบนิเทศ: ที่ปรึกษากดเอง / อาจารย์ประจำวิชากดแทน · ทิ้งไว้หลักสูตรละ 1 นัด (มีหนังสือแล้วยังไม่จบ)
  const leaveOpen = new Set([0, 1, 2, 3].map((mi) => lettered.filter((s) => s.mi === mi && !s.supGroup).slice(-1)[0]?.code).filter(Boolean));
  const toComplete = lettered.filter((s) => !leaveOpen.has(s.code));
  await pool(toComplete, 6, async (s) => {
    const viaCoop = s.j % 4 === 0;
    const x = await call(viaCoop ? M(s.mi).coop.token : s.advisor.token, 'PUT', `/api/${viaCoop ? 'admin' : 'teacher'}/supervisions/${s.apptId}/complete`, {}, { label: null });
    if (x.status !== 200) record(false, `จบนิเทศ ${s.code}`, x.json?.message);
  });
  await call(toComplete[0].advisor.token, 'PUT', `/api/teacher/supervisions/${toComplete[0].apptId}/complete`, {}, { expect: 400, label: 'กดจบนิเทศซ้ำ → 400' });
  const done = await prisma.supervisionAppointment.count({ where: { id: { in: toComplete.map((s) => s.apptId) }, status: 'COMPLETED' } });
  check(done === toComplete.length, `จบนิเทศ ${toComplete.length} นัด`, done);
  // ส่งแบบประเมินการนิเทศให้อาจารย์
  r = await call(staff(), 'POST', '/api/admin/supervision-eval/send', { ids: toComplete.map((s) => s.apptId) }, { label: 'เจ้าหน้าที่ส่งลิงก์แบบประเมินการนิเทศ' });
  check(r.json?.sent === toComplete.length, `ส่งแบบประเมิน ${toComplete.length} นัด`, r.json?.sent);
  await call(M(0).coop.token, 'POST', '/api/admin/supervision-eval/send', { ids: [interns.find((s) => s.mi === 1 && toComplete.includes(s)).apptId] }, { expect: 403, label: 'อาจารย์ประจำวิชาส่งแบบประเมินของหลักสูตรอื่น → 403' });
  const ev = await get(toComplete[0].advisor.token, '/api/teacher/supervision-eval', { label: 'อาจารย์เปิดการ์ดแบบประเมินการนิเทศ' });
  check(JSON.stringify(ev.json || {}).includes(`forms.gle/${toComplete[0].major.toLowerCase()}-sup`), 'อาจารย์เห็นลิงก์แบบประเมินของหลักสูตรนักศึกษา', ev.json);

  // ════════════════════════════════════════════════════════════
  startPhase('11. หลังนิเทศ: T005–T008 (นักศึกษา)');
  for (const mi of [0, 1, 2, 3]) {
    const s = interns.find((x) => x.mi === mi);
    const lc = s.major.toLowerCase();
    const e = await get(s.token, '/api/coop/config/evaluation', { label: null });
    check(JSON.stringify(e.json).includes(`${lc}-t005`) && JSON.stringify(e.json).includes(`${lc}-t006`), `T005/T006 ลิงก์ของ ${s.major}`, e.json);
    const t7 = await get(s.token, '/api/coop/config/t007', { label: null });
    check(JSON.stringify(t7.json).includes(`${lc}-t007`), `T007 ลิงก์ของ ${s.major}`, t7.json);
    const t8 = await get(s.token, '/api/coop/config/t008', { label: null });
    check(JSON.stringify(t8.json).includes(`${lc}-t008`), `T008 ลิงก์ของ ${s.major}`, t8.json);
    const rd = await get(s.token, '/api/coop/round-deadlines', { label: null });
    check(rd.status === 200, `กำหนดส่งของรอบ (${s.major})`, rd.status);
  }

  // ════════════════════════════════════════════════════════════
  startPhase('12. ภาพรวม · รายงาน · ส่งออก · งานค้าง');
  for (const [label, tok, url] of [
    ['แดชบอร์ดเจ้าหน้าที่', staff(), '/api/admin/dashboard-stats'],
    ['แดชบอร์ดอาจารย์ประจำวิชา', M(1).coop.token, '/api/admin/dashboard-stats'],
    ['สรุปหนังสือขอความอนุเคราะห์', staff(), '/api/admin/letters/summary?type=REQ'], ['สรุปหนังสือส่งตัว', staff(), '/api/admin/letters/summary?type=PLACE'], ['สรุปหนังสือขอนิเทศ', staff(), '/api/admin/letters/summary?type=SUPERVISION'],
    ['ความพร้อมหลักสูตร', staff(), '/api/admin/major-readiness'],
    ['ส่งออกรายชื่อนักศึกษา (Excel)', staff(), '/api/admin/students/export'],
    ['ส่งออกตารางนิเทศ (Excel)', staff(), '/api/admin/supervisions/export'],
    ['ที่ปรึกษาส่งออกรายชื่อนักศึกษาของตัวเอง', M(0).advisors[0].token, '/api/teacher/students/export'],
    ['ที่ปรึกษาเปิดนักศึกษาของตัวเอง', M(0).advisors[0].token, '/api/teacher/my-students'],
    ['สถิติอาจารย์', M(0).advisors[0].token, '/api/teacher/stats'],
    ['บันทึกการใช้งาน', staff(), '/api/admin/logs?limit=50'],
  ]) await get(tok, url, { label });
  r = await get(M(0).advisors[0].token, '/api/teacher/my-students', { label: null });
  const mine = Array.isArray(r.json) ? r.json : (r.json?.data || r.json?.students || []);
  const expMine = W.students.filter((s) => s.token && s.advisor.pk === M(0).advisors[0].pk).length;
  check(mine.length >= expMine, `ที่ปรึกษา SIMCS#1 เห็นนักศึกษาของตัวเอง ≥ ${expMine}`, mine.length);
  // งานค้างของอาจารย์ประจำวิชาตรงกับข้อมูลจริง (ต่อหลักสูตร)
  for (const mi of [0, 1, 2, 3]) {
    const p = (await get(M(mi).coop.token, '/api/notifications/pending', { label: null })).json?.pending || {};
    const mine2 = W.students.filter((s) => s.mi === mi).map((s) => s.pk);
    const waitT000 = await prisma.studentCoop.count({ where: { studentId: { in: mine2 }, status: { in: ['WAITING_FOR_STAFF_CHECK', 'WAITING_FOR_STAFF_CHECK_LETTER'] } } });
    check(p.t000 === undefined || p.t000 === waitT000, `งานค้าง T000 ของอาจารย์ประจำวิชา ${MAJORS[mi].code} = ${waitT000}`, p);
  }
  // ภาพรวมสถานะต่อหลักสูตร
  const table = [];
  for (const [mi, m] of MAJORS.entries()) {
    const pks = W.students.filter((s) => s.mi === mi).map((s) => s.pk);
    const coops = await prisma.studentCoop.groupBy({ by: ['status'], where: { studentId: { in: pks } }, _count: true });
    const sups = await prisma.supervisionAppointment.groupBy({ by: ['status'], where: { studentId: { in: pks } }, _count: true });
    table.push({ major: m.code, coop: Object.fromEntries(coops.map((c) => [c.status, c._count])), supervision: Object.fromEntries(sups.map((c) => [c.status, c._count])) });
  }
  console.log('\nสถานะต่อหลักสูตร:');
  for (const t of table) console.log(`  ${t.major.padEnd(7)} ${Object.entries(t.coop).map(([k, v]) => `${k}:${v}`).join(' · ')}\n          นิเทศ ${Object.entries(t.supervision).map(([k, v]) => `${k}:${v}`).join(' · ')}`);
  W.table = table;
}

module.exports = { run };
