// ตรรกะกำหนดส่งของขั้น (ปฏิทินของรอบ) — ฟังก์ชันล้วน ไม่แตะ DB
const {
  STEP_KEYS, MODE_STEPS, normalizeDeadlines, evaluateDeadline, evaluateLegacyWindow,
  applyCollegeChange, shiftYears,
} = require('../utils/deadlines');

const at = (iso) => new Date(iso);

describe('STEP_KEYS / MODE_STEPS', () => {
  test('ขั้นตายตัว + ขั้นที่มีโหมด', () => {
    expect(STEP_KEYS).toEqual(['T000', 'T002', 'T003', 'T005_T006', 'T007', 'T008']);
    expect(MODE_STEPS).toEqual(['T000', 'T002', 'T003']);
  });
});

describe('evaluateDeadline', () => {
  test('ไม่ตั้งค่า (null) → ส่งได้ ไม่ช้า', () => {
    expect(evaluateDeadline(null, at('2026-07-10T00:00:00Z'))).toMatchObject({
      configured: false, canSubmit: true, late: false, due: null, mode: 'HARD', closed: false,
    });
  });

  test('HARD ปิดที่ 23:59:59.999 เวลาไทยของวัน due', () => {
    const e = { due: '2026-07-03', mode: 'HARD' };
    expect(evaluateDeadline(e, at('2026-07-03T16:59:59Z'))).toMatchObject({ configured: true, canSubmit: true, late: false });
    expect(evaluateDeadline(e, at('2026-07-03T17:00:00Z'))).toMatchObject({ canSubmit: false, late: true });
  });

  test('ไม่ระบุ mode = HARD', () => {
    expect(evaluateDeadline({ due: '2026-07-03' }, at('2026-07-05T00:00:00Z'))).toMatchObject({ mode: 'HARD', canSubmit: false });
  });

  test('SOFT เลย due → ส่งได้ แต่ช้า', () => {
    expect(evaluateDeadline({ due: '2026-07-03', mode: 'SOFT' }, at('2026-07-05T00:00:00Z')))
      .toMatchObject({ canSubmit: true, late: true, mode: 'SOFT' });
  });

  test('HARD เลย due + ส่งแก้ → ส่งได้ ไม่นับว่าช้า', () => {
    expect(evaluateDeadline({ due: '2026-07-03' }, at('2026-07-05T00:00:00Z'), { resubmission: true }))
      .toMatchObject({ canSubmit: true, late: false });
  });

  test('HARD เลย due + ขยายเวลา → ส่งได้ถึงสิ้นวันขยาย (ยังนับว่าช้า) แล้วกลับไปปิด', () => {
    const e = { due: '2026-07-03' };
    const opts = { extensionUntil: '2026-07-10' };
    expect(evaluateDeadline(e, at('2026-07-08T00:00:00Z'), opts)).toMatchObject({ canSubmit: true, late: true });
    expect(evaluateDeadline(e, at('2026-07-10T16:59:59Z'), opts)).toMatchObject({ canSubmit: true });
    expect(evaluateDeadline(e, at('2026-07-11T00:00:00Z'), opts)).toMatchObject({ canSubmit: false, late: true });
  });

  test('ปิดรับชั่วคราว → ส่งครั้งแรกไม่ได้แม้มีขยายเวลาหรือยังไม่ถึง due', () => {
    const e = { due: '2026-07-03', closed: true };
    expect(evaluateDeadline(e, at('2026-07-01T00:00:00Z'))).toMatchObject({ closed: true, canSubmit: false, configured: true });
    expect(evaluateDeadline(e, at('2026-07-05T00:00:00Z'), { extensionUntil: '2026-07-10' })).toMatchObject({ canSubmit: false });
  });

  test('ปิดรับชั่วคราว + ส่งแก้ → ส่งได้', () => {
    expect(evaluateDeadline({ due: '2026-07-03', closed: true }, at('2026-07-05T00:00:00Z'), { resubmission: true }))
      .toMatchObject({ canSubmit: true });
  });

  test('ปิดรับชั่วคราวโดยไม่มี due → ถือว่าตั้งค่าแล้วและปิด', () => {
    expect(evaluateDeadline({ due: null, closed: true }, at('2026-07-05T00:00:00Z')))
      .toMatchObject({ configured: true, canSubmit: false });
  });
});

describe('evaluateLegacyWindow (ตรรกะเดิมของ checkSystemOpen)', () => {
  const now = at('2026-07-05T05:00:00Z'); // 12:00 เวลาไทย 5 ก.ค.

  test('ไม่มี config → เปิด', () => {
    expect(evaluateLegacyWindow(null, now)).toMatchObject({ configured: false, canSubmit: true, late: false });
  });

  test('isOpen=false → ปิด', () => {
    expect(evaluateLegacyWindow({ isOpen: false, startDate: null, endDate: null }, now)).toMatchObject({ configured: true, canSubmit: false });
  });

  test('ยังไม่ถึงวันเริ่ม → ปิด (ไม่นับว่าช้า)', () => {
    expect(evaluateLegacyWindow({ isOpen: true, startDate: '2026-07-06', endDate: '2026-07-20' }, now))
      .toMatchObject({ canSubmit: false, late: false });
  });

  test('อยู่ในช่วง → เปิด · due = endDate', () => {
    expect(evaluateLegacyWindow({ isOpen: true, startDate: '2026-07-01', endDate: '2026-07-20' }, now))
      .toMatchObject({ canSubmit: true, due: '2026-07-20', mode: 'HARD' });
  });

  test('วันสิ้นสุดเปิดถึงสิ้นวันเวลาไทย แล้วปิด', () => {
    const cfg = { isOpen: true, startDate: '', endDate: '2026-07-05' };
    expect(evaluateLegacyWindow(cfg, at('2026-07-05T16:59:59Z'))).toMatchObject({ canSubmit: true });
    expect(evaluateLegacyWindow(cfg, at('2026-07-05T17:00:00Z'))).toMatchObject({ canSubmit: false, late: true });
  });

  test('วันว่าง ("") = ไม่จำกัด', () => {
    expect(evaluateLegacyWindow({ isOpen: true, startDate: '', endDate: '' }, now)).toMatchObject({ canSubmit: true, due: null });
  });

  test('ส่งแก้ → ผ่านทุกกรณี (isOpen=false / ยังไม่ถึง / เลยวัน)', () => {
    const opts = { resubmission: true };
    expect(evaluateLegacyWindow({ isOpen: false }, now, opts).canSubmit).toBe(true);
    expect(evaluateLegacyWindow({ isOpen: true, startDate: '2026-08-01' }, now, opts).canSubmit).toBe(true);
    expect(evaluateLegacyWindow({ isOpen: true, endDate: '2026-07-01' }, now, opts)).toMatchObject({ canSubmit: true, late: false });
  });
});

describe('normalizeDeadlines', () => {
  test('null → {}', () => {
    expect(normalizeDeadlines(null)).toEqual({});
  });

  test('รูปถูก → คืนค่าที่ตัดช่องว่าง · due ว่าง = null', () => {
    expect(normalizeDeadlines({
      T000: { due: '2026-05-08', mode: 'HARD', closed: false },
      T002: { due: '', mode: 'SOFT' },
      T007: { due: '2026-10-23' },
    })).toEqual({
      T000: { due: '2026-05-08', mode: 'HARD', closed: false },
      T002: { due: null, mode: 'SOFT' },
      T007: { due: '2026-10-23' },
    });
  });

  test.each([
    ['ขั้นที่ไม่มีโหมดใส่ mode', { T007: { due: '2026-10-23', mode: 'HARD' } }],
    ['ขั้นที่ไม่มีโหมดใส่ closed', { T008: { due: null, closed: true } }],
    ['key แปลก', { X: {} }],
    ['เดือน 13', { T000: { due: '2026-13-01' } }],
    ['31 ก.พ.', { T000: { due: '2026-02-31' } }],
    ['รูปวันผิด', { T000: { due: '8/5/2026' } }],
    ['mode แปลก', { T000: { due: null, mode: 'LATE' } }],
    ['closed ไม่ใช่ boolean', { T000: { due: null, closed: 'yes' } }],
    ['ช่องแปลกในขั้น', { T000: { due: null, foo: 1 } }],
    ['ค่าของขั้นไม่ใช่ object', { T000: '2026-05-08' }],
    ['ไม่ใช่ object', ['T000']],
  ])('%s → 400', (_name, input) => {
    expect(() => normalizeDeadlines(input)).toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe('applyCollegeChange', () => {
  const oldCollege = { T000: { due: '2026-05-08' }, T002: { due: '2026-07-03' } };
  const newCollege = { T000: { due: '2026-05-08' }, T002: { due: '2026-07-10' } };
  const rows = [
    { major: 'CS', deadlines: { T000: { due: '2026-05-08' }, T002: { due: '2026-07-03' } } },
    { major: 'AI', deadlines: { T000: { due: '2026-05-01' }, T002: { due: '2026-07-03' } } },
  ];

  test('เปลี่ยนเฉพาะหลักสูตรที่ติ๊ก', () => {
    const out = applyCollegeChange(oldCollege, newCollege, rows, ['CS']);
    expect(out).toEqual([{ major: 'CS', deadlines: { T000: { due: '2026-05-08' }, T002: { due: '2026-07-10' } } }]);
  });

  test('ขั้นที่ค่าวิทยาลัยไม่เปลี่ยน → ไม่แตะ แม้หลักสูตรอยู่ใน applyTo', () => {
    const out = applyCollegeChange(oldCollege, newCollege, rows, ['AI']);
    expect(out).toEqual([{ major: 'AI', deadlines: { T000: { due: '2026-05-01' }, T002: { due: '2026-07-10' } } }]);
  });

  test('ขั้นที่ถูกลบจากค่าวิทยาลัย → ลบจากหลักสูตรที่ติ๊ก', () => {
    const out = applyCollegeChange(oldCollege, { T000: { due: '2026-05-08' } }, rows, ['CS']);
    expect(out[0].deadlines).toEqual({ T000: { due: '2026-05-08' } });
  });

  test('แถวที่ยังไม่มี deadlines (null) → ได้ค่าใหม่', () => {
    const out = applyCollegeChange({}, { T003: { due: '2026-07-17', mode: 'SOFT' } }, [{ major: 'DS', deadlines: null }], ['DS']);
    expect(out).toEqual([{ major: 'DS', deadlines: { T003: { due: '2026-07-17', mode: 'SOFT' } } }]);
  });

  test('ไม่แก้ object เดิม', () => {
    const copy = JSON.parse(JSON.stringify(rows));
    applyCollegeChange(oldCollege, newCollege, rows, ['CS', 'AI']);
    expect(rows).toEqual(copy);
  });
});

describe('shiftYears', () => {
  test('เลื่อนปีทุกขั้น คง mode/closed', () => {
    expect(shiftYears({ T000: { due: '2026-05-08', mode: 'SOFT', closed: true }, T007: { due: '2026-10-23' } }, 1))
      .toEqual({ T000: { due: '2027-05-08', mode: 'SOFT', closed: true }, T007: { due: '2027-10-23' } });
  });

  test('29 ก.พ. → 28 ก.พ. เมื่อปีปลายทางไม่ใช่ปีอธิกสุรทิน', () => {
    expect(shiftYears({ T000: { due: '2028-02-29' } }, 1)).toEqual({ T000: { due: '2029-02-28' } });
  });

  test('due ว่างคงว่าง · null → {}', () => {
    expect(shiftYears({ T002: { due: null, mode: 'HARD' } }, 1)).toEqual({ T002: { due: null, mode: 'HARD' } });
    expect(shiftYears(null, 1)).toEqual({});
  });
});
