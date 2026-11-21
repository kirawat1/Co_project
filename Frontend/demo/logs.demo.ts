/**
 * สาธิตบันทึกการใช้งาน: อาจารย์และเจ้าหน้าที่ทำงานจริง 2 อย่าง → เจ้าหน้าที่เปิดบันทึกเห็นว่าใครทำอะไร เมื่อไร กับใคร
 * → กรองตามบทบาท → ส่งออก Excel
 */
import { test } from "@playwright/test";
import { Demo } from "./kit";
import { waitStatus } from "./steps";
import { ACCOUNTS, MAJOR, PASSWORD, resetDemo, seedBase, seedOpenPeriod, seedReadyStudent, xlsxToHtml } from "./data";

const FILTER = { "coop.adminMajorFilter": MAJOR };

test("สาธิตบันทึกการใช้งาน", async ({ page, context }) => {
  const demo = new Demo(context, "สาธิต — บันทึกการใช้งาน", 3);
  await demo.init(page);
  const p = page;

  await resetDemo();
  const base = await seedBase();
  const period = await seedOpenPeriod();
  const company = { id: base.companyId, contactId: base.contactId };
  const applying = await seedReadyStudent(0, base, period.id, company, "APPLYING");
  const waiting = await seedReadyStudent(1, base, period.id, company, "WAITING_FOR_STAFF_CHECK", {}, "WAITING");

  await p.goto("/");
  await demo.step(0, null, "เริ่มการสาธิต",
    `อาจารย์และเจ้าหน้าที่จะทำงานคนละอย่าง แล้วดูว่าระบบบันทึกไว้อย่างไร\n• ${applying.first} ยื่นคำร้องรอพิจารณา\n• ${waiting.first} ส่งเอกสาร T000 รอตรวจ`);
  await demo.done("ข้อมูลตัวอย่างพร้อมแล้ว", "เริ่ม ▶");

  // ═══ 1. ทำงานจริง 2 อย่าง ═══
  await demo.step(1, "teacher", "อาจารย์ประจำวิชาให้คำร้องผ่านเกณฑ์",
    "ทุกการเปลี่ยนแปลงข้อมูล (และการเข้าสู่ระบบ) ถูกบันทึกอัตโนมัติ — ไม่ต้องทำอะไรเพิ่ม");
  await demo.login("teacher", ACCOUNTS.teacher.email, PASSWORD, FILTER);
  await demo.click(p.getByRole("button", { name: new RegExp(`จัดการหลักสูตร ${MAJOR}`) }));
  await p.waitForURL("**/admin/dashboard");
  await demo.go("/admin/coop-applications");
  await demo.type(p.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท..."), applying.studentId);
  await demo.click(p.locator("tr", { hasText: applying.studentId }).getByRole("button", { name: "🔍 ตรวจคำร้อง" }));
  await demo.wait(1000);
  await demo.click(p.getByRole("button", { name: "✅ คำร้องผ่านเกณฑ์" }));
  await demo.click(p.getByRole("button", { name: "ยืนยัน", exact: true }));
  await waitStatus(applying.pk, "QUALIFIED");
  await demo.pause(`คำร้องของ ${applying.first} ผ่านเกณฑ์แล้ว`, "ไปที่เจ้าหน้าที่ ▶");

  await demo.step(1, "staff", "เจ้าหน้าที่อนุมัติเอกสาร T000", `เปิดเอกสารของ ${waiting.first} แล้วกด "อนุมัติทั้งหมด"`);
  await demo.login("staff", ACCOUNTS.staff.email, PASSWORD, FILTER);
  await demo.go("/admin/doct000");
  await demo.type(p.getByPlaceholder(/ค้นหา/).first(), waiting.studentId);
  await demo.click(p.locator("tbody tr", { hasText: waiting.studentId }).first().getByRole("button", { name: "ตรวจสอบเอกสาร" }));
  const review = p.locator(".modal-backdrop").last();
  await review.waitFor();
  await demo.wait(800);
  await demo.click(review.getByRole("button", { name: "อนุมัติทั้งหมด" }));
  await demo.confirm();
  await waitStatus(waiting.pk, "DOCS_APPROVED");
  await p.keyboard.press("Escape");
  await demo.done("ทำงานไป 2 อย่างโดยคนละบทบาท");

  // ═══ 2. เปิดบันทึก ═══
  await demo.step(2, "staff", "ดูบันทึกการใช้งาน",
    "เห็นเวลา · ผู้ทำ · การกระทำ · ทำกับนักศึกษาคนไหน · สำเร็จหรือไม่ — ค้นหา/กรองตามคน วันที่ หรือบทบาทได้");
  await demo.go("/admin/logs");
  await demo.type(p.getByPlaceholder(/ค้นหา ผู้ทำ/), "ตัวอย่าง");
  await demo.wait(1500);
  await demo.point(p.locator("table tbody tr").first());
  await demo.pause("ทั้งการอนุมัติเอกสาร การให้คำร้องผ่านเกณฑ์ และการเข้าสู่ระบบของทุกคน อยู่ในที่เดียว");
  await demo.click(p.getByRole("tab", { name: /อาจารย์/ }));
  await demo.wait(1200);
  await demo.done("แท็บแยกตามบทบาท — ดูเฉพาะสิ่งที่อาจารย์ทำ");

  // ═══ 3. ส่งออก ═══
  await demo.step(3, "staff", "ส่งออกบันทึกเป็น Excel", "ส่งออกตามตัวกรองที่เลือกอยู่ — ใช้ตรวจสอบย้อนหลังหรือแนบรายงาน");
  await demo.click(p.getByRole("tab", { name: /ทั้งหมด/ }));
  await demo.wait(800);
  const file = await demo.download(p.getByRole("button", { name: /Export Excel/ }), test.info().outputPath("logs.xlsx"));
  await demo.showSheet(xlsxToHtml(file), "บันทึกการใช้งาน");
  await demo.end("ตอบได้ทุกครั้งว่า \"ใครทำ ทำอะไร เมื่อไร\" — บันทึกแก้ไขไม่ได้ ลบไม่ได้จากหน้าจอ");
});
