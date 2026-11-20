/**
 * สาธิตงานค้างและขั้นถัดไป: ตัวเลขบนแผง "งานที่รอคุณ" และป้ายบนเมนู = งานที่ค้างอยู่จริง
 * ทำงานเสร็จแล้วตัวเลขลดเอง · นักศึกษาเห็นแถบ "ขั้นตอนถัดไป" บอกว่าต้องทำอะไรต่อ
 * นักศึกษา 4 คนค้างคนละขั้น: ยื่นคำร้อง · ส่ง T000 · รอออกหนังสือ · ส่ง T002
 */
import { test } from "@playwright/test";
import { Demo } from "./kit";
import { waitStatus, waitDoc } from "./steps";
import {
  ACCOUNTS, MAJOR, PASSWORD, prisma, putUpload, resetDemo, samplePdf, seedBase, seedOpenPeriod, seedReadyStudent,
} from "./data";

const FILTER = { "coop.adminMajorFilter": MAJOR };

test("สาธิตงานค้างและขั้นถัดไป", async ({ page, context }) => {
  const demo = new Demo(context, "สาธิต — งานค้างและขั้นถัดไป", 4);
  await demo.init(page);
  const p = page;

  await resetDemo();
  const base = await seedBase();
  const period = await seedOpenPeriod();
  const company = { id: base.companyId, contactId: base.contactId };
  // คำร้องรอตรวจคุณสมบัติ (มีไฟล์แนบคำร้อง)
  const applying = await seedReadyStudent(0, base, period.id, company, "APPLYING");
  await prisma.document.deleteMany({ where: { studentId: applying.pk } });
  await prisma.document.create({ data: {
    studentId: applying.pk, type: "APPLICATION_DOC", status: "WAITING", name: "ใบคำร้องขอเข้าร่วมโครงการสหกิจศึกษา.pdf",
    path: putUpload(await samplePdf("application", "ใบคำร้องขอเข้าร่วมโครงการสหกิจศึกษา", [`${applying.first} ${applying.last} รหัส ${applying.studentId}`]), `demo-${applying.key}-application.pdf`),
  } });
  await seedReadyStudent(1, base, period.id, company, "WAITING_FOR_STAFF_CHECK", {}, "WAITING"); // T000 รอตรวจ
  await seedReadyStudent(2, base, period.id, company, "DOCS_APPROVED"); // รอออกหนังสือ
  const intern = await seedReadyStudent(3, base, period.id, company, "INTERNSHIP_STARTED"); // T002 รอตรวจ
  await prisma.document.create({ data: {
    studentId: intern.pk, type: "T002_FORM", status: "WAITING", name: "T002 แบบแจ้งรายละเอียดงาน.pdf",
    path: putUpload(await samplePdf("t002", "T002 แบบแจ้งรายละเอียดงาน (ลงนามแล้ว)", [`${intern.first} ${intern.last}`]), `demo-${intern.key}-t002.pdf`),
  } });

  const tile = (label: string) => p.locator(".pending-tile", { hasText: label });
  const panel = p.locator("section", { has: p.locator("#pending-work-h") });

  await p.goto("/");
  await demo.step(0, null, "เริ่มการสาธิต",
    `นักศึกษา 4 คนค้างอยู่คนละขั้น:\n• ${applying.first} — ยื่นคำร้องแล้ว รอตรวจคุณสมบัติ\n• สมหญิง — ส่ง T000 แล้ว รอเจ้าหน้าที่ตรวจ\n• ปิติ — เอกสารผ่าน รอออกหนังสือ\n• ${intern.first} — ส่ง T002 แล้ว รออาจารย์ที่ปรึกษาตรวจ`);
  await demo.done("ข้อมูลตัวอย่างพร้อมแล้ว", "เริ่ม ▶");

  // ═══ 1. เจ้าหน้าที่เห็นงานที่รอ ═══
  await demo.step(1, "staff", "งานที่รอเจ้าหน้าที่",
    "หน้าแรกสรุป \"งานที่รอคุณ\" — นับจากงานที่ค้างจริง ไม่ใช่แจ้งเตือนที่ยังไม่อ่าน\nตัวเลขเดียวกันขึ้นเป็นป้ายบนเมนูด้านซ้าย");
  await demo.login("staff", ACCOUNTS.staff.email, PASSWORD, FILTER);
  await panel.waitFor();
  await tile("คำร้องรอตรวจคุณสมบัติ").locator(".n", { hasText: "1" }).waitFor();
  await demo.point(panel);
  await demo.pause("แต่ละช่องคือจำนวนงานที่รอ กดช่องไหนก็ไปหน้าที่ทำงานนั้นทันที");
  await demo.point(p.locator(".sidebar .item", { hasText: "T000" }).first());
  await demo.pause("ป้ายตัวเลขบนเมนูด้านซ้าย — เห็นงานค้างได้จากทุกหน้า");
  await demo.done("เจ้าหน้าที่รู้ทันทีว่าวันนี้มีงานอะไรรออยู่บ้าง");

  // ═══ 2. ทำงานหนึ่งอย่าง ตัวเลขลด ═══
  await demo.step(2, "staff", "ทำงานจากแผง แล้วตัวเลขลดเอง",
    "กดช่อง \"คำร้องรอตรวจคุณสมบัติ\" → ตรวจคำร้อง → ผ่านเกณฑ์ → กลับหน้าแรก ช่องนั้นเหลือ 0");
  await demo.click(tile("คำร้องรอตรวจคุณสมบัติ"));
  await p.waitForURL("**/admin/coop-applications");
  await demo.type(p.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท..."), applying.studentId);
  await demo.click(p.locator("tr", { hasText: applying.studentId }).getByRole("button", { name: "🔍 ตรวจคำร้อง" }));
  await demo.wait(1200);
  await demo.click(p.getByRole("button", { name: "✅ คำร้องผ่านเกณฑ์" }));
  await demo.click(p.getByRole("button", { name: "ยืนยัน", exact: true }));
  await waitStatus(applying.pk, "QUALIFIED");
  await demo.wait(600);
  await demo.go("/admin/dashboard");
  await tile("คำร้องรอตรวจคุณสมบัติ").locator(".n", { hasText: "0" }).waitFor();
  await demo.point(tile("คำร้องรอตรวจคุณสมบัติ"));
  await demo.done("ช่องคำร้องเหลือ 0 — ถ้าเจ้าหน้าที่อีกคนทำงานนี้ไปก่อน ตัวเลขก็ลดเหมือนกัน");

  // ═══ 3. อาจารย์เห็นงานของตัวเอง ═══
  await demo.step(3, "teacher", "งานที่รออาจารย์ที่ปรึกษา",
    "อาจารย์เห็นเฉพาะงานของนักศึกษาที่ตัวเองดูแล — ตอนนี้มี T002 รอตรวจ 1 ฉบับ");
  await demo.login("teacher", ACCOUNTS.teacher.email, PASSWORD, FILTER);
  await panel.waitFor();
  await tile("T002 รอตรวจ").locator(".n", { hasText: "1" }).waitFor();
  await demo.point(panel);
  await demo.pause("แผงงานของอาจารย์: T002 · T003 · นัดนิเทศที่รอเลือกวัน");
  await demo.click(tile("T002 รอตรวจ"));
  await p.waitForURL("**/teacher/review-t002");
  await demo.type(p.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท..."), intern.studentId);
  await demo.click(p.locator("tr", { hasText: intern.studentId }).getByRole("button", { name: /🔍 (ตรวจเอกสาร|พิจารณา)/ }));
  await demo.wait(1200);
  await demo.click(p.locator(".btn-success").last());
  await demo.confirm();
  await waitDoc(intern.pk, "T002_FORM", "APPROVED");
  await demo.wait(600);
  await demo.go("/teacher/dashboard");
  await tile("T002 รอตรวจ").locator(".n", { hasText: "0" }).waitFor();
  await demo.point(tile("T002 รอตรวจ"));
  await demo.done("ตรวจ T002 แล้ว ช่องเหลือ 0 — นักศึกษาได้รับแจ้งผลทันที");

  // ═══ 4. นักศึกษาเห็นขั้นถัดไป ═══
  await demo.step(4, "student", "นักศึกษารู้ว่าต้องทำอะไรต่อ",
    `${applying.first} เพิ่งผ่านคุณสมบัติ — หน้าแรกบอกขั้นถัดไปพร้อมปุ่มไปทำ ไม่ต้องเดาว่าต้องเข้าเมนูไหน`);
  await demo.login("student", applying.email, PASSWORD);
  const next = p.getByText("▶ ขั้นตอนถัดไป").first();
  await next.waitFor();
  await demo.point(next.locator("xpath=../.."));
  await demo.pause("แถบ \"ขั้นตอนถัดไป\" เปลี่ยนตามสถานะ — ถ้าถูกตีกลับจะเป็นแถบสีส้มพร้อมเหตุผล");
  await demo.click(p.getByRole("button", { name: "ดูทุกขั้นตอน →" }));
  await demo.wait(1000);
  await demo.pause("ขั้นตอนทั้งหมดของสหกิจ ขั้นที่ผ่านแล้วมีเครื่องหมายถูก ขั้นปัจจุบันเน้นสี");
  await demo.click(p.getByRole("button", { name: "ไปส่งเอกสาร →" }));
  await p.waitForURL("**/student/docs");
  await demo.wait(1200);
  await demo.end("กดปุ่มเดียวก็มาถึงหน้าส่งเอกสาร T000\nทุกบทบาทเห็นงานของตัวเองจากหน้าแรก — งานไม่ตกหล่น");
});
