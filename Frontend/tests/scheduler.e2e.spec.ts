/**
 * tests/scheduler.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * งานตั้งเวลาของ server ที่รันอยู่จริง — ประกาศตั้งเวลา: ไม่เรียกอะไรเอง รอให้ตัวตั้งเวลา (ทุก 1 นาที) แจ้งนักศึกษาเมื่อถึงเวลา
 * (การเตือนใกล้ปิดรับ/ล้างข้อมูลเริ่มหลัง server ขึ้นแล้ววันละครั้ง — ตรวจจังหวะด้วยนาฬิกาจำลองใน backend/__tests__/schedulers.test.js)
 */
import { test, expect } from "@playwright/test";
import { api } from "./helpers/letterWorld";
import { WorldKit, prisma, type KStudent, type KUser } from "./helpers/worldKit";

const k = new WorldKit("ZJ");
let staff: KUser, stu: KStudent, label = "";

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน");
  staff = await k.staff();
  const X = await k.major("X");
  const p = await k.period(1, { [X]: {} });
  label = `1/${k.prefix}${k.tail}`;
  stu = await k.student("s", 1, { major: X, periodId: p });
});
test.afterAll(async () => { await k.cleanup(); await k.disconnect(); });

test("ประกาศตั้งเวลา: ก่อนถึงเวลานักศึกษาไม่เห็น/ไม่ได้แจ้ง → ตัวตั้งเวลาของ server แจ้งเองภายใน ~1 นาทีหลังถึงเวลา (ครั้งเดียว)", async () => {
  test.setTimeout(200_000);
  const title = `${k.prefix}${k.tail} ตั้งเวลา`;
  const fd = new FormData();
  for (const [key, v] of Object.entries({ title, date: "2026-11-07", year: label, publishAt: new Date(Date.now() + 15_000).toISOString() })) fd.append(key, v);
  const r = await api(staff.token, "POST", "/api/announcements", fd);
  expect(r.status, JSON.stringify(r.body)).toBe(200);

  const seen = async () => ((await api(stu.token, "GET", "/api/announcements")).body.list as { title: string }[]).some((a) => a.title === title);
  const notes = () => prisma.notification.count({ where: { userId: stu.userId, type: "ANNOUNCEMENT", message: title } });
  expect([await seen(), await notes()]).toEqual([false, 0]);

  await expect.poll(notes, { timeout: 150_000, intervals: [5_000] }).toBe(1);
  expect(await seen()).toBe(true);
  expect((await prisma.announcement.findFirst({ where: { title } })).notifiedAt).not.toBeNull();
  await new Promise((res) => setTimeout(res, 65_000));          // รอบถัดไปของตัวตั้งเวลาต้องไม่แจ้งซ้ำ
  expect(await notes()).toBe(1);
});
