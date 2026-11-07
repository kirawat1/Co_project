// __tests__/schedulers.test.js — งานตั้งเวลาเริ่มทำงานจริงตามรอบเวลา (นาฬิกาจำลอง)
// เดิมเทสต์แค่ "ทำอะไร" (เลือกคน/ประกาศถูก) ไม่เคยเช็กว่าตัวตั้งเวลาเรียกงานตามเวลาจริง หรือ server เปิดตัวตั้งเวลาครบ
const fs = require('fs');
const path = require('path');

jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('../config/prismaClient');

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  prisma.announcement.findMany.mockResolvedValue([]);
  prisma.studentCoop.findMany.mockResolvedValue([]);
  prisma.notification.deleteMany.mockResolvedValue({ count: 0 });
  prisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

test('server เปิดตัวตั้งเวลาครบทั้ง 4 งาน', () => {
  const src = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  for (const call of ['startLogRetentionJob()', 'startAnnouncementScheduler()', 'startRetentionJob()', 'startDeadlineReminderJob()']) {
    expect(src).toContain(call);
  }
});

test('ประกาศตั้งเวลา: ตรวจทันทีตอนเริ่ม แล้วทุก 1 นาที', async () => {
  const { startAnnouncementScheduler } = require('../utils/announcementAudience');
  const timer = startAnnouncementScheduler();
  await flush();
  expect(prisma.announcement.findMany).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(MIN - 1);
  await flush();
  expect(prisma.announcement.findMany).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1);
  await flush();
  expect(prisma.announcement.findMany).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(5 * MIN);
  await flush();
  expect(prisma.announcement.findMany).toHaveBeenCalledTimes(7);
  clearInterval(timer);
});

test('เตือนใกล้ปิดรับ: ครั้งแรก 90 วินาทีหลัง server ขึ้น แล้ววันละครั้ง (ทุกขั้น T000/T002/T003)', async () => {
  const { startDeadlineReminderJob } = require('../utils/deadlineReminders');
  startDeadlineReminderJob();
  jest.advanceTimersByTime(89_999);
  await flush();
  expect(prisma.studentCoop.findMany).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  await flush();
  expect(prisma.studentCoop.findMany).toHaveBeenCalledTimes(3);
  jest.advanceTimersByTime(DAY);
  await flush();
  expect(prisma.studentCoop.findMany).toHaveBeenCalledTimes(6);
});

test('ล้างการแจ้งเตือนที่อ่านแล้ว: 1 นาทีหลัง server ขึ้น แล้ววันละครั้ง · ล้างบันทึกการใช้งานเก่า: ทันที แล้ววันละครั้ง', async () => {
  const { startRetentionJob } = require('../utils/retention');
  const { startLogRetentionJob } = require('../middlewares/auditLogger');
  startRetentionJob();
  const logTimer = startLogRetentionJob();
  await flush();
  expect(prisma.auditLog.deleteMany).toHaveBeenCalledTimes(1);
  expect(prisma.notification.deleteMany).not.toHaveBeenCalled();
  jest.advanceTimersByTime(MIN);
  await flush();
  expect(prisma.notification.deleteMany).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(DAY);
  await flush();
  expect(prisma.notification.deleteMany).toHaveBeenCalledTimes(2);
  expect(prisma.auditLog.deleteMany).toHaveBeenCalledTimes(2);
  clearInterval(logTimer);
});

test('งานพังรอบหนึ่ง ไม่หยุดรอบถัดไป (ไม่ทำ server ล่ม)', async () => {
  const { startAnnouncementScheduler } = require('../utils/announcementAudience');
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  prisma.announcement.findMany.mockRejectedValueOnce(new Error('db down'));
  const timer = startAnnouncementScheduler();
  await flush();
  jest.advanceTimersByTime(MIN);
  await flush();
  expect(prisma.announcement.findMany).toHaveBeenCalledTimes(2);
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
  clearInterval(timer);
});
