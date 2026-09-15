// __tests__/majorName.test.js
const { resolveMajorNameTh } = require('../utils/majorName');

const criteria = [
  { major: 'CS', nameTh: 'วิทยาการคอมพิวเตอร์' },
  { major: 'AI', nameTh: 'ปัญญาประดิษฐ์' },
  { major: 'GIS', nameTh: null },
];

describe('resolveMajorNameTh — ชื่อหลักสูตรภาษาไทยสำหรับหนังสือราชการ', () => {
  test.each([
    ['CS', 'วิทยาการคอมพิวเตอร์'],
    ['cs', 'วิทยาการคอมพิวเตอร์'],
    [' AI ', 'ปัญญาประดิษฐ์'],
    ['วิทยาการคอมพิวเตอร์', 'วิทยาการคอมพิวเตอร์'],
    ['วิทยาการคอมพิวเตอร์ (CS)', 'วิทยาการคอมพิวเตอร์'],
    ['ปัญญาประดิษฐ์ (AI)', 'ปัญญาประดิษฐ์'],
    ['CS - วิทยาการคอมพิวเตอร์', 'วิทยาการคอมพิวเตอร์'],
    ['เทคโนโลยีสารสนเทศ (IT)', 'เทคโนโลยีสารสนเทศ'],
  ])('%p → %p', (major, expected) => {
    expect(resolveMajorNameTh(major, criteria)).toBe(expected);
  });

  test.each([[null], [''], ['GIS'], ['XYZ']])('ไม่รู้ชื่อไทย (%p) → null ให้หน้าเว็บใช้ค่าสำรอง', (major) => {
    expect(resolveMajorNameTh(major, criteria)).toBeNull();
  });

  test('ไม่มีข้อมูล criteria ก็ไม่พัง', () => {
    expect(resolveMajorNameTh('CS', undefined)).toBeNull();
    expect(resolveMajorNameTh('วิทยาการคอมพิวเตอร์ (CS)', [])).toBe('วิทยาการคอมพิวเตอร์');
  });
});
