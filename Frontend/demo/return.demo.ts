/**
 * สาธิตตีกลับเอกสารให้แก้: เจ้าหน้าที่ส่งกลับแก้ไขพร้อมเหตุผล → นักศึกษาเห็นเหตุผลและส่งไฟล์ใหม่ → เจ้าหน้าที่ตรวจซ้ำแล้วผ่าน
 * นักศึกษา 1 คน ส่งเอกสาร T000 ครบแล้ว รอเจ้าหน้าที่ตรวจ
 */
import { test } from "@playwright/test";
import { Demo } from "./kit";
import { waitStatus, waitDoc } from "./steps";
import { ACCOUNTS, COMPANY, MAJOR, PASSWORD, prisma, resetDemo, samplePdf, seedBase, seedOpenPeriod, seedReadyStudent } from "./data";

const FILTER = { "coop.adminMajorFilter": MAJOR };
const REASON = "สำเนาเอกสารไม่ชัด อ่านรายละเอียดไม่ได้ กรุณาสแกนใหม่ให้ชัดเจน";

test("สาธิตตีกลับเอกสารให้แก้ แล้วส่งใหม่", async ({ page, context }) => {
  const demo = new Demo(context, "สาธิต — ตีกลับเอกสารให้แก้ แล้วส่งใหม่", 3);
  await demo.init(page);
  const p = page;

  await resetDemo();
  const base = await seedBase();
  const period = await seedOpenPeriod();
  const company = { id: base.companyId, contactId: base.contactId };
  const s = await seedReadyStudent(0, base, period.id, company, "WAITING_FOR_STAFF_CHECK", {}, "WAITING");
  const target = (await prisma.document.findFirst({ where: { studentId: s.pk }, orderBy: { id: "asc" } }))!;
  const docTitle = target.name.replace(/\.pdf$/i, "");
  const staffLogin = () => demo.login("staff", ACCOUNTS.staff.email, PASSWORD, FILTER);

  await p.goto("/");
  await demo.step(0, null, "เริ่มการสาธิต",
    `${s.first} ${s.last} (${s.studentId}) ส่งเอกสาร T000 ครบแล้ว รอเจ้าหน้าที่ตรวจ\nบริษัท: ${COMPANY.name}\n\nเจ้าหน้าที่จะพบว่า "${docTitle}" ใช้ไม่ได้ และส่งกลับให้แก้`);
  await demo.done("ข้อมูลตัวอย่างพร้อมแล้ว", "เริ่ม ▶");

  // ═══ 1. เจ้าหน้าที่ส่งกลับแก้ไข ═══
  await demo.step(1, "staff", "ส่งเอกสารกลับให้แก้ไข พร้อมเหตุผล",
    "เปิดเอกสารทีละฉบับ ฉบับที่ใช้ไม่ได้ให้พิมพ์เหตุผลก่อน แล้วกด \"ส่งกลับแก้ไข\" — ระบบไม่ให้ตีกลับโดยไม่บอกเหตุผล");
  await staffLogin();
  await demo.go("/admin/doct000");
  await demo.type(p.getByPlaceholder(/ค้นหา/).first(), s.studentId);
  const row = () => p.locator("tbody tr", { hasText: s.studentId }).first();
  await demo.click(row().getByRole("button", { name: "ตรวจสอบเอกสาร" }));
  const review = p.locator(".modal-backdrop").last();
  await review.waitFor();
  await demo.click(review.getByText(target.name, { exact: true }));
  await demo.wait(1200);
  await demo.type(review.getByPlaceholder("ระบุเหตุผล (กรณีแก้ไข/ไม่ผ่าน)"), REASON);
  const docRow = review.locator("div", { has: p.getByText(target.name, { exact: true }) })
    .filter({ has: p.getByRole("button", { name: "ส่งกลับแก้ไข" }) }).last();
  await demo.click(docRow.getByRole("button", { name: "ส่งกลับแก้ไข" }));
  await waitStatus(s.pk, "EDITS_REQUIRED");
  await waitDoc(s.pk, target.type, "EDITS_REQUIRED");
  await demo.wait(800);
  await p.keyboard.press("Escape");
  await demo.wait(800);
  await demo.done(`ส่งกลับแก้ไขแล้ว — สถานะ: ส่งกลับแก้ไข (รอนักศึกษาดำเนินการ)\nนักศึกษาได้รับแจ้งเตือนพร้อมเหตุผล`);

  // ═══ 2. นักศึกษาเห็นเหตุผล แล้วส่งไฟล์ใหม่ ═══
  await demo.step(2, "student", "เห็นเหตุผลที่ถูกตีกลับ แล้วส่งไฟล์แก้ไข",
    "หน้าแรกของนักศึกษาขึ้นแถบสีส้ม \"ต้องดำเนินการ\" พร้อมข้อความจากเจ้าหน้าที่ กดไปแก้ไขได้ทันที");
  await demo.login("student", s.email, PASSWORD);
  await p.getByText(REASON).first().waitFor();
  await demo.point(p.getByText(REASON).first());
  await demo.pause("แถบ \"ต้องดำเนินการ\" บอกว่าต้องแก้อะไร และเหตุผลจากเจ้าหน้าที่");
  await demo.click(p.getByRole("button", { name: "ไปแก้ไข →" }));
  await p.waitForURL("**/student/docs");
  const fixRow = p.locator("table.doc-table tbody tr", { hasText: docTitle }).first();
  await fixRow.getByText("⚠️ รอแก้ไข").waitFor();
  await demo.point(fixRow);
  await demo.pause(`เอกสาร "${docTitle}" ขึ้นสถานะ "⚠️ รอแก้ไข" — ฉบับอื่นยังรอตรวจตามเดิม\nนักศึกษาเอาไฟล์เดิมออก แล้วส่งไฟล์ที่แก้แล้ว`);
  await demo.click(fixRow.locator("button.icon-btn"));
  await demo.confirm();
  const attach = fixRow.getByText(/📤 แนบไฟล์|🔄 ส่งไฟล์แก้ไข/);
  await attach.waitFor();
  await demo.files(fixRow.locator('input[type="file"]'),
    await samplePdf("t000-fixed", `${docTitle} (ฉบับแก้ไข)`, [`${s.first} ${s.last} รหัส ${s.studentId}`, "สแกนใหม่ให้ชัดเจนแล้ว"]), attach);
  await demo.click(fixRow.getByRole("button", { name: "🚀 ยืนยันส่งไฟล์" }));
  await waitStatus(s.pk, "WAITING_FOR_STAFF_CHECK");
  await demo.wait(800);
  await demo.done("ส่งไฟล์แก้ไขแล้ว — สถานะกลับเป็นรอเจ้าหน้าที่ตรวจ (ระบบจำว่าเป็นการส่งแก้)");

  // ═══ 3. เจ้าหน้าที่ตรวจซ้ำ ═══
  await demo.step(3, "staff", "ตรวจเอกสารที่ส่งแก้ แล้วอนุมัติ",
    "รายการขึ้นว่า \"ส่งแก้ไขแล้ว\" แยกจากคนที่ส่งครั้งแรก เปิดดูไฟล์ใหม่ แล้วอนุมัติ");
  await staffLogin();
  await demo.go("/admin/doct000");
  await demo.type(p.getByPlaceholder(/ค้นหา/).first(), s.studentId);
  await demo.point(row().getByText(/ส่งแก้ไขแล้ว/).first());
  await demo.pause("สถานะในรายการ: \"ส่งแก้ไขแล้ว (รอการตรวจสอบ)\"");
  await demo.click(row().getByRole("button", { name: "ตรวจสอบเอกสาร" }));
  await review.waitFor();
  const fixed = (await prisma.document.findFirst({ where: { studentId: s.pk, type: target.type }, orderBy: { id: "desc" } }))!;
  await demo.click(review.getByText(fixed.name, { exact: true }).first());
  await demo.wait(1200);
  await demo.pause("ไฟล์ฉบับแก้ไขที่นักศึกษาเพิ่งส่ง แสดงทางซ้าย");
  await demo.click(review.getByRole("button", { name: "อนุมัติทั้งหมด" }));
  await demo.confirm();
  await waitStatus(s.pk, "DOCS_APPROVED");
  await p.keyboard.press("Escape");
  await demo.end(`เอกสารผ่านทั้งหมด — สถานะ: เอกสารผ่าน รอออกหนังสือ\nทุกการตีกลับมีเหตุผลกำกับ นักศึกษารู้ว่าต้องแก้อะไร และเจ้าหน้าที่เห็นว่าใครส่งแก้มาแล้ว`);
});
