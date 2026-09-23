// __tests__/supervisionExport.test.js — ไฟล์ Excel ตารางนิเทศ
const XLSX = require('xlsx');
const { buildSupervisionScheduleWorkbook, EXPORT_HEADERS } = require('../utils/supervisionExport');

const appt = (over = {}) => ({
  id: 1,
  confirmedDate: new Date('2026-10-05T02:00:00Z'), // 09:00 เวลาไทย
  confirmedEndDate: new Date('2026-10-05T03:00:00Z'),
  proposedDates: null,
  supervisionType: 'ONLINE',
  status: 'DATE_CONFIRMED',
  coTeacherName: null,
  onlineLink: 'https://meet.google.com/abc-defg-hij',
  groupId: null,
  teacher: { prefix: 'อ.', firstName: 'สมชาย', lastName: 'ใจดี' },
  student: {
    studentId: '6430212186', prefix: 'MR', firstName: 'ดำ', lastName: 'แดง', major: 'CS',
    coopAdvisor: null,
    coop: { coopPeriodId: 2, company: { name: 'บริษัท ก', province: 'ขอนแก่น' } },
  },
  ...over,
});

function readSheet(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets['ตารางนิเทศ'];
  return { ws, rows: XLSX.utils.sheet_to_json(ws) };
}

describe('ลิงก์นิเทศในไฟล์ export', () => {
  test('มีคอลัมน์ลิงก์นิเทศ อยู่ถัดจากคอลัมน์รูปแบบ', () => {
    const i = EXPORT_HEADERS.indexOf('ลิงก์นิเทศ (ออนไลน์)');
    expect(i).toBeGreaterThan(-1);
    expect(EXPORT_HEADERS[i - 1]).toBe('รูปแบบ');
  });

  test('นิเทศออนไลน์: แสดงลิงก์ และกดเปิดได้ใน Excel', () => {
    const { ws, rows } = readSheet(buildSupervisionScheduleWorkbook([appt()]));
    expect(rows[0]['ลิงก์นิเทศ (ออนไลน์)']).toBe('https://meet.google.com/abc-defg-hij');
    const col = EXPORT_HEADERS.indexOf('ลิงก์นิเทศ (ออนไลน์)');
    const cell = ws[XLSX.utils.encode_cell({ r: 1, c: col })];
    expect(cell.l?.Target).toBe('https://meet.google.com/abc-defg-hij');
  });

  test('นิเทศออนไซต์: แสดง "-" แม้มีลิงก์ค้างจากตอนเสนอวันแบบออนไลน์', () => {
    const { rows } = readSheet(buildSupervisionScheduleWorkbook([appt({ supervisionType: 'ONSITE' })]));
    expect(rows[0]['ลิงก์นิเทศ (ออนไลน์)']).toBe('-');
  });

  test('ออนไลน์แต่ยังไม่มีลิงก์: แสดง "-" ไม่ทำเป็นลิงก์', () => {
    const { ws, rows } = readSheet(buildSupervisionScheduleWorkbook([appt({ onlineLink: null })]));
    expect(rows[0]['ลิงก์นิเทศ (ออนไลน์)']).toBe('-');
    const col = EXPORT_HEADERS.indexOf('ลิงก์นิเทศ (ออนไลน์)');
    expect(ws[XLSX.utils.encode_cell({ r: 1, c: col })].l).toBeUndefined();
  });

  test('ค่าที่ไม่ใช่ http/https ไม่ถูกทำเป็นลิงก์ให้กด', () => {
    const { ws } = readSheet(buildSupervisionScheduleWorkbook([appt({ onlineLink: 'javascript:alert(1)' })]));
    const col = EXPORT_HEADERS.indexOf('ลิงก์นิเทศ (ออนไลน์)');
    expect(ws[XLSX.utils.encode_cell({ r: 1, c: col })].l).toBeUndefined();
  });

  test('หลายแถว: ลิงก์ของแต่ละคนอยู่ถูกแถว (เรียงตามวันเวลาแล้ว)', () => {
    const later = appt({ id: 2, confirmedDate: new Date('2026-10-06T02:00:00Z'), confirmedEndDate: new Date('2026-10-06T03:00:00Z'), onlineLink: 'https://zoom.us/j/222' });
    const earlier = appt({ id: 3, onlineLink: 'https://zoom.us/j/111' });
    const { ws, rows } = readSheet(buildSupervisionScheduleWorkbook([later, earlier]));
    expect(rows.map((r) => r['ลิงก์นิเทศ (ออนไลน์)'])).toEqual(['https://zoom.us/j/111', 'https://zoom.us/j/222']);
    const col = EXPORT_HEADERS.indexOf('ลิงก์นิเทศ (ออนไลน์)');
    expect(ws[XLSX.utils.encode_cell({ r: 2, c: col })].l.Target).toBe('https://zoom.us/j/222');
  });
});
