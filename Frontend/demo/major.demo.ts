/**
 * สาธิตเพิ่มหลักสูตรใหม่: เจ้าหน้าที่เพิ่มหลักสูตร → หน้าความพร้อมบอกสิ่งที่ยังขาด → แต่งตั้งอาจารย์ประจำวิชา
 * → ตั้งรอบและเปิดรับสมัคร → อาจารย์ประจำวิชาเข้าหน้าจัดการของหลักสูตรตัวเอง
 * หลักสูตรใหม่ชื่อขึ้นต้น DEMO (DEMOAI) — resetDemo ลบให้
 */
import { test } from "@playwright/test";
import { Demo } from "./kit";
import { ACCOUNTS, MAJOR, PASSWORD, isoDay, prisma, resetDemo, seedBase, seedOpenPeriod, seedTeacher } from "./data";

const NEW = `${MAJOR}AI`;
const NEW_NAME = "หลักสูตรสาธิต ปัญญาประดิษฐ์";

test("สาธิตเพิ่มหลักสูตรใหม่", async ({ page, context }) => {
  const demo = new Demo(context, "สาธิต — เพิ่มหลักสูตรใหม่", 5);
  await demo.init(page);
  const p = page;

  await resetDemo();
  await seedBase();
  const period = await seedOpenPeriod();
  const year = period.label.split("/")[1];
  const t2 = await seedTeacher("teacher2", "อ.", "วิไล", "ตัวอย่าง");
  const NO_FILTER = { "coop.adminMajorFilter": "" };

  await p.goto("/");
  await demo.step(0, null, "เริ่มการสาธิต",
    `วิทยาลัยเปิดหลักสูตรใหม่ "${NEW_NAME}" (${NEW})\nต้องให้หลักสูตรนี้ใช้ระบบสหกิจได้ — มีอาจารย์ประจำวิชาดูแล และเปิดรับสมัครในรอบ ${period.label}\nอาจารย์ที่จะดูแล: ${t2.name}`);
  await demo.done("ข้อมูลตัวอย่างพร้อมแล้ว", "เริ่ม ▶");

  // ═══ 1. เพิ่มหลักสูตร ═══
  await demo.step(1, "staff", "เพิ่มหลักสูตรใหม่", "ใส่รหัสหลักสูตร (ตัวย่อที่ใช้ในระบบ) และชื่อภาษาไทย");
  await demo.login("staff", ACCOUNTS.staff.email, PASSWORD, NO_FILTER);
  await demo.go("/admin/criteria");
  await demo.click(p.getByRole("button", { name: "+ เพิ่มหลักสูตร" }));
  await demo.type(p.getByPlaceholder("เช่น CS, IT, AI"), NEW);
  await demo.type(p.getByPlaceholder("เช่น วิทยาการคอมพิวเตอร์"), NEW_NAME);
  await demo.click(p.getByRole("button", { name: "บันทึก", exact: true }));
  await p.getByText(NEW_NAME).first().waitFor();
  await demo.done(`เพิ่มหลักสูตร ${NEW} แล้ว — เลือกได้ทันทีในหน้านักศึกษา อาจารย์ รอบสหกิจ และการนำเข้าไฟล์`);

  // ═══ 2. ความพร้อมของหลักสูตร ═══
  await demo.step(2, "staff", "ตรวจความพร้อมของหลักสูตร",
    "หน้า \"ตั้งค่าแยกหลักสูตร\" มีเช็กลิสต์บอกว่าหลักสูตรใหม่ยังขาดอะไร — กดแต่ละข้อเพื่อไปหน้าที่ต้องตั้ง");
  await demo.go("/admin/major-config");
  const readiness = p.locator('[data-testid="major-readiness"]');
  await readiness.waitFor();
  const card = readiness.locator("div", { hasText: NEW_NAME }).filter({ hasText: "อาจารย์ประจำวิชา" }).last();
  await demo.point(card);
  await demo.pause(`${NEW}: ✕ ยังไม่มีอาจารย์ประจำวิชา · ✕ ยังไม่ได้ตั้งรอบ ${period.label}\nข้อที่เป็น ✕ ต้องทำก่อนหลักสูตรนี้ใช้งานได้`);
  await demo.done("ต่อไปทำทีละข้อ");

  // ═══ 3. แต่งตั้งอาจารย์ประจำวิชา ═══
  await demo.step(3, "staff", "แต่งตั้งอาจารย์ประจำวิชาของหลักสูตร",
    `เปิดข้อมูล ${t2.name} → เปิดสวิตช์ "อาจารย์ประจำวิชาสหกิจ" → เลือกหลักสูตรที่ดูแล`);
  await demo.go("/admin/teachers");
  // ค้นด้วยอีเมลของอาจารย์สาธิต — ฐานที่มีข้อมูลตัวอย่างมีอาจารย์ชื่อขึ้นต้น "วิไล" คนอื่น (เช่น วิไลวรรณ) เดิมกดแก้ไขผิดคน
  await demo.type(p.getByPlaceholder("ค้นหา: ชื่อ / อีเมล / เบอร์โทร"), t2.email);
  await demo.wait(800);
  await demo.click(p.locator("tr", { hasText: "วิไล" }).filter({ hasText: "ตัวอย่าง" }).getByRole("button", { name: /แก้ไข/ }).first());
  const toggle = p.getByLabel("อาจารย์ประจำวิชาสหกิจ");
  await demo.click(toggle.locator("..")); // ช่องติ๊กซ่อน (สวิตช์) — กดที่ตัวสวิตช์
  if (!(await toggle.isChecked())) throw new Error("เปิดสวิตช์อาจารย์ประจำวิชาไม่สำเร็จ");
  await demo.wait(600);
  const pick = p.locator("label", { hasText: new RegExp(`^${NEW}$`) }).last(); // ตัวกรองบนหน้าก็มีช่องหลักสูตร — ของฟอร์มแก้ไขอยู่ท้ายสุด
  await demo.click(pick);
  // เปิดสวิตช์แล้วระบบติ๊กหลักสูตรของอาจารย์ (DEMO) ให้ก่อน — เอาออก ให้ดูแลเฉพาะหลักสูตรใหม่
  const own = p.locator("label", { hasText: new RegExp(`^${MAJOR}$`) }).last().locator('input[type="checkbox"]');
  if (await own.isChecked()) await demo.click(own.locator(".."));
  await demo.click(p.getByRole("button", { name: /บันทึกข้อมูล/ }));
  await p.getByText(/บันทึกข้อมูลเรียบร้อย/).first().waitFor();
  await prisma.coopTeacherMajor.findFirstOrThrow({ where: { teacherId: t2.pk, major: NEW } });
  await demo.done(`${t2.name} เป็นอาจารย์ประจำวิชาของ ${NEW} — ตรวจเอกสาร จัดการนักศึกษา และตั้งค่าเฉพาะหลักสูตรนี้ได้`);

  // ═══ 4. ตั้งรอบ ═══
  await demo.step(4, "staff", `ตั้งวันรับสมัครของ ${NEW} ในรอบ ${period.label} แล้วเปิดรับ`,
    "รอบเดียวกันใช้หลายหลักสูตรได้ แต่ละหลักสูตรมีช่วงรับสมัคร กำหนดส่ง และสวิตช์เปิด/ปิดของตัวเอง");
  await demo.go("/admin/coop-period");
  const round = p.locator("div", { has: p.getByText(`ปีการศึกษา ${year} เทอม 1`, { exact: true }) }).filter({ has: p.locator("table") }).last();
  const row = () => round.locator("tr", { hasText: NEW });
  await demo.click(row().getByRole("button", { name: "ตั้งวันรับสมัคร" }));
  const dlg = p.getByRole("dialog");
  const dates = dlg.locator('input[type="date"]');
  await demo.fill(dates.nth(0), isoDay(0));
  await demo.fill(dates.nth(1), isoDay(60));
  await demo.click(dlg.getByRole("button", { name: "บันทึกข้อมูล" }));
  await demo.click(row().getByRole("button", { name: "เปิดรับสมัคร" }));
  await demo.confirm();
  await row().getByText("🟢 เปิดรับสมัคร").waitFor();
  await demo.go("/admin/major-config");
  await readiness.waitFor();
  await demo.point(readiness.locator("div", { hasText: NEW_NAME }).filter({ hasText: "อาจารย์ประจำวิชา" }).last());
  await demo.done(`ข้อบังคับครบแล้ว — ${NEW} พร้อมใช้งาน นักศึกษาหลักสูตรนี้ยื่นคำร้องได้`);

  // ═══ 5. อาจารย์ประจำวิชาเข้าหน้าจัดการหลักสูตร ═══
  await demo.step(5, "teacher", "อาจารย์ประจำวิชาเข้าหน้าจัดการของหลักสูตรตัวเอง",
    `${t2.name} ล็อกอิน → มีปุ่ม "จัดการหลักสูตร ${NEW}" → เห็นเฉพาะนักศึกษาและการตั้งค่าของ ${NEW}`);
  await demo.login("teacher", t2.email, PASSWORD);
  const manage = p.getByRole("button", { name: new RegExp(`จัดการหลักสูตร ${NEW}`) });
  await demo.point(manage);
  await demo.pause("ปุ่มนี้ขึ้นเฉพาะอาจารย์ที่ได้รับแต่งตั้ง");
  await demo.click(manage);
  await p.waitForURL("**/admin/dashboard");
  await demo.wait(1500);
  await demo.end(`เพิ่มหลักสูตรใหม่ครบในไม่กี่ขั้น ไม่ต้องแก้โปรแกรม\nเจ้าหน้าที่ยังดูได้ทุกหลักสูตร · อาจารย์ประจำวิชาเห็นเฉพาะหลักสูตรที่ดูแล`);
});
