const {
  resolveSlotEnd,
  rangesOverlap,
  parseProposedEntry,
  teacherNameKeys,
  coTeacherKeys,
  findTeacherClash,
  assertNoTeacherClash,
  timeKey,
} = require('../utils/supervisionClash');

const at = (y, m, d, hh, mm) => new Date(y, m - 1, d, hh, mm, 0, 0);
const proposed = (...entries) => JSON.stringify(entries);

// tx จำลอง — คืนรายการนัดหมายที่ยืนยันวันแล้วตามที่ป้อนให้
const fakeTx = (rows) => ({
  supervisionAppointment: {
    findMany: jest.fn(async ({ where }) => {
      const excluded = where?.id?.notIn || [];
      return rows.filter((r) => !excluded.includes(r.id));
    }),
  },
});

const teacherA = { id: 1, prefix: 'ผศ. ดร.', firstName: 'ชิตสุธา', lastName: 'สุ่มเล็ก' };
const teacherB = { id: 2, prefix: 'รศ. ดร.', firstName: 'อุรฉัตร', lastName: 'โคแก้ว' };
const student = (name) => ({ studentId: 'u640001', firstName: name, lastName: 'ทดสอบ' });

describe('parseProposedEntry', () => {
  test('อ่านวัน เวลาเริ่ม-สิ้นสุด และรูปแบบนิเทศ', () => {
    expect(parseProposedEntry('2026-04-11|13:00-14:30|ONSITE')).toEqual({
      date: '2026-04-11', start: '13:00', end: '14:30', type: 'ONSITE',
    });
  });

  test('รองรับข้อมูลเก่าแบบ 2026-04-12T10:00 (ไม่มีเวลาสิ้นสุด)', () => {
    expect(parseProposedEntry('2026-04-12T10:00')).toMatchObject({ date: '2026-04-12', start: '10:00', end: null });
  });

  test('ข้อมูลพังคืน null', () => {
    expect(parseProposedEntry('')).toBeNull();
    expect(parseProposedEntry('ไม่ใช่วันที่')).toBeNull();
  });
});

describe('resolveSlotEnd', () => {
  test('ใช้ confirmedEndDate ที่บันทึกไว้ก่อน', () => {
    const start = at(2026, 4, 11, 13, 0);
    const end = resolveSlotEnd(start, { confirmedEndDate: at(2026, 4, 11, 15, 0), proposedDates: proposed('2026-04-11|13:00-14:30') });
    expect(timeKey(end)).toBe('15:00');
  });

  test('ไม่มีค่าที่บันทึก → เอาความยาวจากช่วงเวลาที่นักศึกษาเสนอ', () => {
    const start = at(2026, 4, 11, 13, 0);
    expect(timeKey(resolveSlotEnd(start, { proposedDates: proposed('2026-04-11|13:00-14:30|ONSITE') }))).toBe('14:30');
  });

  test('ข้อมูลเก่าที่ไม่มีช่วงเวลา → ถือว่ายาว 1 ชม.', () => {
    const start = at(2026, 4, 12, 10, 0);
    expect(timeKey(resolveSlotEnd(start, { proposedDates: proposed('2026-04-12T10:00') }))).toBe('11:00');
    expect(timeKey(resolveSlotEnd(start, {}))).toBe('11:00');
  });
});

describe('rangesOverlap', () => {
  const a1 = at(2026, 4, 11, 10, 0);
  const a2 = at(2026, 4, 11, 12, 0);

  test('นัดต่อกันพอดีไม่ถือว่าชน', () => {
    expect(rangesOverlap(a1, a2, a2, at(2026, 4, 11, 13, 0))).toBe(false);
  });

  test('เวลาคาบเกี่ยวกัน = ชน', () => {
    expect(rangesOverlap(a1, a2, at(2026, 4, 11, 11, 0), at(2026, 4, 11, 13, 0))).toBe(true);
  });
});

describe('ชื่ออาจารย์', () => {
  test('จับคู่ได้ทั้งแบบมีและไม่มีคำนำหน้า', () => {
    expect(teacherNameKeys(teacherA)).toEqual(['ผศดรชิตสุธาสุ่มเล็ก', 'ชิตสุธาสุ่มเล็ก']);
  });

  test('แยกอาจารย์ร่วมที่คั่นด้วยลูกน้ำ', () => {
    expect(coTeacherKeys('อ. ดร.ญานิกา คงโสรส, ผศ. ดร.สิลดา อินทรโสธรฉันท์')).toHaveLength(2);
  });
});

describe('findTeacherClash', () => {
  const booked = (over) => ({
    id: 99,
    confirmedDate: at(2026, 4, 11, 10, 0),
    confirmedEndDate: at(2026, 4, 11, 12, 0),
    proposedDates: proposed('2026-04-11|10:00-12:00|ONSITE'),
    teacherId: teacherA.id,
    coTeacherName: null,
    teacher: teacherA,
    student: student('ไอรินทร์'),
    ...over,
  });

  test('อาจารย์คนเดียวกัน เวลาทับกัน → ชน พร้อมบอกชื่อและเวลา', async () => {
    const clash = await findTeacherClash(fakeTx([booked()]), {
      start: at(2026, 4, 11, 11, 0),
      end: at(2026, 4, 11, 13, 0),
      teacher: teacherA,
    });
    expect(clash).not.toBeNull();
    expect(clash.appointmentId).toBe(99);
    expect(clash.message).toContain('ชิตสุธา');
    expect(clash.message).toContain('ไอรินทร์');
    expect(clash.message).toContain('10:00-12:00');
  });

  test('นัดต่อกันพอดี (12:00-13:00) → ไม่ชน', async () => {
    const clash = await findTeacherClash(fakeTx([booked()]), {
      start: at(2026, 4, 11, 12, 0),
      end: at(2026, 4, 11, 13, 0),
      teacher: teacherA,
    });
    expect(clash).toBeNull();
  });

  test('คนละอาจารย์ เวลาทับกันได้', async () => {
    const clash = await findTeacherClash(fakeTx([booked()]), {
      start: at(2026, 4, 11, 10, 0),
      end: at(2026, 4, 11, 12, 0),
      teacher: teacherB,
    });
    expect(clash).toBeNull();
  });

  test('บริษัทเดียวกันก็ต้องไล่คิว — เวลาทับกันยังชน', async () => {
    const clash = await findTeacherClash(fakeTx([booked()]), {
      start: at(2026, 4, 11, 10, 0),
      end: at(2026, 4, 11, 12, 0),
      teacher: teacherA,
    });
    expect(clash).not.toBeNull();
  });

  test('อาจารย์ร่วมของรายการอื่นก็นับเป็นคิวที่ไม่ว่าง', async () => {
    const rows = [booked({ teacherId: teacherB.id, teacher: teacherB, coTeacherName: 'ผศ. ดร.ชิตสุธา สุ่มเล็ก' })];
    const clash = await findTeacherClash(fakeTx(rows), {
      start: at(2026, 4, 11, 11, 0),
      end: at(2026, 4, 11, 13, 0),
      teacher: teacherA,
    });
    expect(clash).not.toBeNull();
    expect(clash.message).toContain('ชิตสุธา');
  });

  test('เพิ่มอาจารย์ร่วมที่ติดนิเทศของตัวเองเวลานั้น → ชน (ไม่ต้องส่งอาจารย์หลัก)', async () => {
    const clash = await findTeacherClash(fakeTx([booked()]), {
      start: at(2026, 4, 11, 11, 0),
      end: at(2026, 4, 11, 13, 0),
      teacher: null,
      coTeacherName: 'ผศ. ดร.ชิตสุธา สุ่มเล็ก',
    });
    expect(clash).not.toBeNull();
  });

  test('ไม่นับรายการที่อยู่ใน excludeIds (ตัวเอง / กลุ่มที่กำลังบันทึก)', async () => {
    const clash = await findTeacherClash(fakeTx([booked()]), {
      start: at(2026, 4, 11, 10, 0),
      end: at(2026, 4, 11, 12, 0),
      teacher: teacherA,
      excludeIds: [99],
    });
    expect(clash).toBeNull();
  });

  test('ข้อมูลเก่าที่ไม่มีเวลาสิ้นสุด ถือว่ายาว 1 ชม.', async () => {
    const rows = [booked({ confirmedEndDate: null, proposedDates: proposed('2026-04-11T10:00') })];
    const overlap = await findTeacherClash(fakeTx(rows), {
      start: at(2026, 4, 11, 10, 30), end: at(2026, 4, 11, 11, 30), teacher: teacherA,
    });
    const after = await findTeacherClash(fakeTx(rows), {
      start: at(2026, 4, 11, 11, 0), end: at(2026, 4, 11, 12, 0), teacher: teacherA,
    });
    expect(overlap).not.toBeNull();
    expect(after).toBeNull();
  });
});

describe('assertNoTeacherClash', () => {
  test('โยน error 409 พร้อมข้อความเมื่อชน', async () => {
    const rows = [{
      id: 5,
      confirmedDate: at(2026, 4, 11, 10, 0),
      confirmedEndDate: at(2026, 4, 11, 12, 0),
      proposedDates: null,
      teacherId: teacherA.id,
      coTeacherName: null,
      teacher: teacherA,
      student: student('ธนธรณ์'),
    }];
    await expect(assertNoTeacherClash(fakeTx(rows), {
      start: at(2026, 4, 11, 11, 0), end: at(2026, 4, 11, 12, 30), teacher: teacherA,
    })).rejects.toMatchObject({ is409: true });
  });

  test('ไม่ชน = ผ่าน', async () => {
    await expect(assertNoTeacherClash(fakeTx([]), {
      start: at(2026, 4, 11, 11, 0), end: at(2026, 4, 11, 12, 0), teacher: teacherA,
    })).resolves.toBeUndefined();
  });
});
