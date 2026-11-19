/**
 * สาธิตออกหนังสือหลายฉบับพร้อมกัน: ออกร่างทีละชุด (zip) → อัปโหลดฉบับลงนามทีละหลายไฟล์ → นักศึกษาเห็นหนังสือรวม
 * นักศึกษา 3 คน: 2 คนบริษัทเดียวกัน (ระบบรวมเป็นหนังสือฉบับเดียว) · 1 คนอีกบริษัท
 */
import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { Demo } from "./kit";
import { waitStatus } from "./steps";
import {
  ACCOUNTS, COMPANY, MAJOR, PASSWORD, DOC_NO, resetDemo, seedBase, seedOpenPeriod, seedCompany, seedReadyStudent, studentEmail,
} from "./data";

const FILTER = { "coop.adminMajorFilter": MAJOR };

test("สาธิตออกหนังสือหลายฉบับพร้อมกัน", async ({ page, context }) => {
  const demo = new Demo(context, "สาธิต — ออกหนังสือหลายฉบับพร้อมกัน", 4);
  await demo.init(page);
  const p = page;

  await resetDemo();
  const base = await seedBase();
  const period = await seedOpenPeriod();
  const companyA = { id: base.companyId, contactId: base.contactId, name: COMPANY.name };
  const companyB = await seedCompany("บริษัท ตัวอย่างดิจิทัล จำกัด", "สมศรี", base.staffUserId);
  const st = [
    await seedReadyStudent(0, base, period.id, companyA, "DOCS_APPROVED"),
    await seedReadyStudent(1, base, period.id, companyA, "DOCS_APPROVED"),
    await seedReadyStudent(2, base, period.id, companyB, "DOCS_APPROVED"),
  ];

  await p.goto("/");
  await demo.step(0, null, "เริ่มการสาธิต",
    `นักศึกษา 3 คนเอกสารผ่านแล้ว รอออกหนังสือขอความอนุเคราะห์:\n• ${st[0].first} และ ${st[1].first} — ${companyA.name}\n• ${st[2].first} — ${companyB.name}`);
  await demo.done("ข้อมูลตัวอย่างพร้อมแล้ว", "เริ่ม ▶");

  // ═══ 1. ออกร่างหลายฉบับพร้อมกัน ═══
  await demo.step(1, "staff", "ออกร่างหนังสือหลายฉบับพร้อมกัน",
    "เลือกนักศึกษาที่พร้อม ใส่เลขเริ่มต้น ระบบไล่เลขให้ทุกฉบับ — นักศึกษาบริษัทเดียวกันรวมเป็นหนังสือฉบับเดียว");
  await demo.login("staff", ACCOUNTS.staff.email, PASSWORD, FILTER);
  await demo.go("/admin/doct000");
  await demo.click(p.getByRole("button", { name: "ออกร่างหลายฉบับพร้อมกัน" }));
  const draft = p.locator(".letter-modal-backdrop").last();
  await draft.getByText(`2. รายชื่อ (3 / 3 คน)`).waitFor();
  await demo.type(draft.locator("div", { has: p.getByText("เลขเริ่มต้น", { exact: true }) }).locator("input.input").first(), DOC_NO(11));
  await demo.click(draft.getByText(/^PDF — ฉบับละ 1 ไฟล์/));
  await demo.point(draft.getByText(/4\. ฉบับที่จะออก/));
  await demo.pause(`ฉบับที่ 1 เลข ${DOC_NO(11)} — ${companyA.name} (2 คน รวมฉบับเดียว)\nฉบับที่ 2 เลข ${DOC_NO(12)} — ${companyB.name}\nกด "แยกฉบับ" ได้ถ้าต้องการแยกคน`);
  const dl = p.waitForEvent("download", { timeout: 180_000 });
  await demo.click(draft.getByRole("button", { name: /จองเลขและโหลด zip/ }));
  const zipPath = test.info().outputPath("ร่างหนังสือ.zip");
  await (await dl).saveAs(zipPath);
  await draft.getByText(/สร้างร่างหนังสือ 2 ฉบับ/).waitFor({ timeout: 180_000 });
  // แตก zip ในเครื่อง — ไฟล์ในนี้คือที่เจ้าหน้าที่นำไปพิมพ์และเสนอลงนาม
  const outDir = test.info().outputPath("ร่าง");
  fs.mkdirSync(outDir, { recursive: true });
  const pdfs: string[] = [];
  for (const [name, data] of Object.entries(unzipSync(fs.readFileSync(zipPath)))) {
    if (!name.toLowerCase().endsWith(".pdf")) continue;
    const f = path.join(outDir, path.basename(name));
    fs.writeFileSync(f, data);
    pdfs.push(f);
  }
  pdfs.sort();
  await demo.pause(`ได้ไฟล์ zip: ร่างหนังสือ ${pdfs.length} ฉบับ + รายการเลขหนังสือ (Excel)\nนักศึกษาทั้ง 3 คนถูกติดป้าย "รอลงนาม"`);
  if (pdfs[0]) await demo.showLocalPdf(pdfs[0], `ร่างฉบับรวม — ${companyA.name} (ชื่อไฟล์ขึ้นต้นด้วยเลขหนังสือ)`);
  await demo.click(draft.locator("button.btn-secondary", { hasText: /^ปิด$/ }));
  await demo.done("ร่างพร้อมพิมพ์และเสนอลงนามทั้งชุด");

  // ═══ 2. อัปโหลดฉบับลงนามหลายฉบับ ═══
  await demo.step(2, "staff", "อัปโหลดฉบับลงนามหลายฉบับในครั้งเดียว",
    "สแกนฉบับลงนามฉบับละไฟล์ ตั้งชื่อขึ้นต้นด้วยเลขหนังสือ แล้ววางพร้อมกันทีเดียว — ระบบจับคู่ไฟล์กับหนังสือให้เอง");
  await demo.click(p.getByRole("button", { name: "อัปโหลดฉบับลงนามหลายฉบับ" }));
  const signed = p.locator(".letter-modal-backdrop").last();
  await signed.getByText(/3\. หนังสือรอลงนาม \(2 ฉบับ/).waitFor();
  await demo.files(signed.locator('input[type="file"][multiple]'), pdfs, signed.getByRole("button", { name: "เลือกไฟล์" }));
  await signed.getByText(/มีไฟล์ 2/).waitFor();
  await demo.point(signed.locator('[data-testid="pending-letter"]').first());
  await demo.pause("ระบบจับคู่ไฟล์กับหนังสือจากเลขที่ในชื่อไฟล์แล้วทั้ง 2 ฉบับ — เลือกวิธีจัดส่งรายฉบับได้");
  await demo.click(signed.getByRole("button", { name: /^บันทึก 2 ฉบับ/ }));
  await demo.confirm();
  for (const s of st) await waitStatus(s.pk, "REQ_LETTER_ISSUED");
  await signed.getByText(/สำเร็จ 2/).waitFor();
  await demo.click(signed.locator("button.btn-secondary", { hasText: /^ปิด$/ }));
  await demo.done("บันทึกครบ 2 ฉบับ — นักศึกษาทั้ง 3 คนได้รับแจ้งเตือน สถานะ: ออกหนังสือขอความอนุเคราะห์แล้ว");

  // ═══ 3. นักศึกษาเห็นหนังสือรวม ═══
  await demo.step(3, "student", "นักศึกษาเห็นหนังสือฉบับรวม", `${st[1].first} (บริษัทเดียวกับ ${st[0].first}) เปิดดูหนังสือ — มีชื่อทั้งสองคนในฉบับเดียว`);
  await demo.login("student", st[1].email, PASSWORD);
  await demo.go("/student/docs");
  const step4 = p.locator("div", { has: p.getByRole("heading", { name: /ขั้นตอนที่ 4/ }) }).last();
  await step4.scrollIntoViewIfNeeded();
  await demo.click(step4.getByRole("button", { name: "👁️ ดูตัวอย่าง" }).first());
  await demo.wait(1500);
  await demo.pause("หนังสือขอความอนุเคราะห์ฉบับรวม (ฉบับลงนามที่เจ้าหน้าที่อัปโหลด)");
  await demo.click(p.getByRole("button", { name: "ปิดหน้าต่าง" }));

  await demo.end(`ออกหนังสือ 2 ฉบับให้นักศึกษา 3 คนเสร็จในรอบเดียว 🎉\nบัญชีสาธิต (รหัสผ่าน ${PASSWORD}): ${studentEmail("s1")} · ${ACCOUNTS.staff.email}`);
});
