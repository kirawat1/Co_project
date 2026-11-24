/**
 * สาธิตทั้งเส้นทาง: เจ้าหน้าที่นำเข้ารายชื่อ → เปิดรอบ → นักศึกษายื่นคำร้อง → … → นิเทศ (นักศึกษาเดินทั้งเส้นทาง 1 คน)
 * เลขขั้น demo.step(n, บทบาท, "ชื่อขั้น") — demo.js อ่านจากไฟล์นี้ไปทำตัวเลือก "เริ่มจากขั้นที่…" (เขียนเป็นข้อความตรง ห้ามเป็นตัวแปร)
 */
import { test } from "@playwright/test";
import { Demo } from "./kit";
import { waitStatus, waitDoc, waitAppt, issueLetter } from "./steps";
import {
  ACCOUNTS, COMPANY, MAJOR, MAJOR_NAME, PASSWORD, DOC_NO, STUDENTS, isoDay, prisma, resetDemo, seedBase, samplePdf, samplePhoto,
  freeAcademicYear, rememberPeriod, studentEmail, studentsXlsx, adoptImported, type Base,
} from "./data";

const FILTER = { "coop.adminMajorFilter": MAJOR };
const TOTAL = 20;

test("สาธิตทั้งเส้นทาง: เปิดรอบ → ยื่นคำร้อง → หนังสือ → ฝึกงาน → นิเทศ", async ({ page, context }) => {
  const demo = new Demo(context, "สาธิตระบบสหกิจศึกษา — ทั้งเส้นทาง", TOTAL);
  await demo.init(page);

  // ── เตรียมข้อมูล ──
  await resetDemo();
  const base: Base = await seedBase();
  const CLASS = [0, 1, 2, 3]; // รายชื่อในไฟล์ที่เจ้าหน้าที่นำเข้า — คนแรกเดินทั้งเส้นทาง
  let s = { ...STUDENTS[0], pk: 0, userId: 0, email: studentEmail(STUDENTS[0].key) };
  const year = await freeAcademicYear();
  const p = page;
  const staffLogin = () => demo.login("staff", ACCOUNTS.staff.email, PASSWORD, FILTER);
  const teacherLogin = () => demo.login("teacher", ACCOUNTS.teacher.email, PASSWORD, FILTER);
  const studentLogin = () => demo.login("student", s.email, PASSWORD);

  await p.goto("/");
  await demo.step(0, null, "เริ่มการสาธิต",
    `ผู้ใช้ในการสาธิต:\n• นักศึกษา: ${s.first} ${s.last} (${s.studentId}) — เจ้าหน้าที่นำเข้าจากไฟล์ Excel ในขั้นที่ 1\n• อาจารย์: ${ACCOUNTS.teacher.name} — อาจารย์ประจำวิชาสหกิจ และอาจารย์ที่ปรึกษา\n• เจ้าหน้าที่: ${ACCOUNTS.staff.name}`);
  await demo.done("ข้อมูลตัวอย่างพร้อมแล้ว (หลักสูตรสาธิต · บริษัทตัวอย่าง)", "เริ่ม ▶");

  // ═══ 1. เจ้าหน้าที่นำเข้ารายชื่อนักศึกษา ═══
  await demo.step(1, "staff", "นำเข้ารายชื่อนักศึกษาจากไฟล์ Excel",
    "เลือกไฟล์รายชื่อ (รหัส ชื่อ อีเมล หลักสูตร อาจารย์ที่ปรึกษา) → ดูตัวอย่างก่อนว่าแถวไหนสร้างใหม่/อัปเดต/ข้าม → ยืนยันนำเข้า");
  await staffLogin();
  await demo.go("/admin/students");
  await demo.files(p.locator('input[type="file"][accept=".xlsx,.xls"]'), studentsXlsx(CLASS), p.getByText("เลือกไฟล์ Excel", { exact: true }));
  await demo.click(p.getByRole("button", { name: "ดูตัวอย่าง", exact: true }));
  await p.getByText(`🟢 สร้างใหม่ ${CLASS.length}`).waitFor();
  await demo.pause(`ตัวอย่างก่อนนำเข้า: ${CLASS.length} แถวเป็น "สร้างใหม่"\nระบบจับคู่หลักสูตร "${MAJOR_NAME}" และอาจารย์ที่ปรึกษาจากชื่อในไฟล์ให้\nแถวที่มีปัญหา (อีเมลซ้ำ ไม่มีรหัส) จะขึ้นสีแดงพร้อมเหตุผล`);
  await demo.click(p.getByRole("button", { name: "ยืนยันนำเข้า" }));
  await p.getByText(`สร้างใหม่ ${CLASS.length} |`, { exact: false }).first().waitFor();
  for (const i of CLASS) { const st = await adoptImported(i, base); if (i === 0) s = st; }
  await demo.type(p.getByPlaceholder("ค้นหา: รหัส / ชื่อ / อีเมล"), "ตัวอย่าง");
  await demo.wait(1500);
  await demo.done(`นำเข้านักศึกษา ${CLASS.length} คนแล้ว — ทุกคนได้บัญชีเข้าระบบทันที\nยังยื่นคำร้องไม่ได้จนกว่าเจ้าหน้าที่จะเปิดรอบ (ขั้นต่อไป)`);

  // ═══ 2. เจ้าหน้าที่เปิดรอบสหกิจ + ตั้งปฏิทิน ═══
  await demo.step(2, "staff", "เปิดรอบสหกิจและตั้งปฏิทินกำหนดส่ง",
    "สร้างรอบปีการศึกษา/เทอม กำหนดช่วงรับสมัคร ตั้งกำหนดส่งเอกสารของหลักสูตร แล้วเปิดรับสมัคร");
  await demo.go("/admin/coop-period");
  await demo.click(p.getByRole("button", { name: "+ สร้างรอบใหม่" }));
  const dlg = p.getByRole("dialog");
  await demo.type(dlg.locator('input.input:not([type="date"])').first(), year);
  const dates = dlg.locator('input[type="date"]');
  await demo.fill(dates.nth(0), isoDay(0)); // เปิดรับตั้งแต่วันนี้ (นับทั้งวันตามเวลาไทย)
  await demo.fill(dates.nth(1), isoDay(60));
  await demo.click(p.getByRole("button", { name: "บันทึกข้อมูล" }));
  await p.getByText(`📆 ปฏิทินของรอบ 1/${year}`).waitFor();
  const period = await prisma.coopPeriod.findFirst({ where: { academicYear: year, semester: 1 } });
  rememberPeriod(period.id);
  await demo.click(p.getByRole("tab", { name: `หลักสูตร ${MAJOR}` }));
  for (const [label, d] of [["T000 เอกสารสมัคร", 30], ["T002 รายละเอียดงาน", 75], ["T003 โครงร่างรายงาน", 90]] as const) {
    await demo.fill(p.locator("div", { hasText: new RegExp(`^${label}`) }).locator('input[type="date"]').first(), isoDay(d));
  }
  await demo.click(p.getByRole("button", { name: `บันทึกของหลักสูตร ${MAJOR}` }));
  await p.getByText(`บันทึกกำหนดส่งของหลักสูตร ${MAJOR} แล้ว`).waitFor();
  const card = p.locator("div", { has: p.getByText(`ปีการศึกษา ${year} เทอม 1`, { exact: true }) }).filter({ has: p.locator("table") }).last();
  await demo.click(card.locator("tr", { hasText: MAJOR }).getByRole("button", { name: "เปิดรับสมัคร" }));
  await demo.confirm();
  await card.getByText("🟢 เปิดรับสมัคร").waitFor();
  // ช่วงนัดนิเทศของหลักสูตร (ตั้งที่หน้าจัดการนิเทศ) — เปิดไว้ล่วงหน้าให้ขั้นนิเทศ
  await prisma.coopPeriodMajor.updateMany({ where: { periodId: period.id, major: MAJOR }, data: { isSupervisionOpen: true, supervisionStartDate: new Date(isoDay(1)), supervisionEndDate: new Date(isoDay(120)) } });
  await demo.done(`เปิดรับสมัครรอบ 1/${year} ของหลักสูตร ${MAJOR} แล้ว\nนักศึกษาในหลักสูตรยื่นคำร้องได้ทันที`);

  // ═══ 3. นักศึกษาเลือกบริษัท + ยื่นคำร้อง ═══
  await demo.step(3, "student", "เลือกสถานประกอบการและผู้ติดต่อ",
    "นักศึกษาเลือกบริษัทจากรายชื่อในระบบ และผู้ติดต่อ (HR) ที่จะเป็นผู้รับหนังสือจากวิทยาลัย");
  await studentLogin();
  await demo.go("/student/profile");
  await demo.type(p.getByPlaceholder("พิมพ์ค้นหาชื่อบริษัท..."), "ตัวอย่างซอฟต์แวร์");
  await demo.click(p.getByText(COMPANY.name, { exact: true }).last());
  await demo.wait(800);
  await demo.type(p.getByPlaceholder("พิมพ์ค้นหาเพื่อเลือกผู้ติดต่อ..."), COMPANY.hr);
  await demo.click(p.locator("div").filter({ hasText: new RegExp(`^${COMPANY.hr}`) }).last());
  await p.locator(".contact-chip").first().waitFor();
  await demo.done("บันทึกบริษัทและผู้ติดต่ออัตโนมัติแล้ว");

  await demo.step(4, "student", "ยื่นคำร้องขอเข้าร่วมโครงการสหกิจศึกษา",
    "กรอกตำแหน่งงาน แนบลิงก์แบบฟอร์มผลการเรียน และเอกสารประกอบ แล้วส่งให้อาจารย์ประจำวิชาพิจารณา");
  await demo.go("/student/gateway");
  await demo.type(p.getByPlaceholder("เช่น Frontend Developer, System Analyst, Data Scientist..."), "Software Developer");
  const gradeLink = p.getByPlaceholder("https://docs.google.com/spreadsheets/d/...");
  if (await gradeLink.count()) await demo.type(gradeLink, "https://docs.google.com/spreadsheets/d/demo-grade");
  await demo.files(p.locator('input[type="file"]').first(), await samplePdf("application", "ใบคำร้องขอเข้าร่วมโครงการสหกิจศึกษา", [`${s.first} ${s.last} รหัส ${s.studentId}`]));
  await demo.click(p.getByRole("button", { name: "🚀 ส่งคำร้องขอสหกิจศึกษา" }));
  await p.getByText("ส่งคำร้องเรียบร้อยแล้ว").first().waitFor();
  await demo.done("ส่งคำร้องแล้ว — สถานะ: รออาจารย์ตรวจสอบคุณสมบัติ");

  // ═══ 5. อาจารย์ประจำวิชาพิจารณาคำร้อง ═══
  await demo.step(5, "teacher", "อาจารย์ประจำวิชาสหกิจพิจารณาคำร้อง",
    "อาจารย์ประจำวิชากดปุ่ม \"จัดการหลักสูตร\" เพื่อเข้าหน้าจัดการของหลักสูตรที่ดูแล แล้วเปิดคำร้องดูเอกสารประกอบ");
  await teacherLogin();
  await demo.click(p.getByRole("button", { name: new RegExp(`จัดการหลักสูตร ${MAJOR}`) }));
  await p.waitForURL("**/admin/dashboard");
  await demo.go("/admin/coop-applications");
  await demo.type(p.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท..."), s.studentId);
  await demo.click(p.locator("tr", { hasText: s.studentId }).getByRole("button", { name: "🔍 ตรวจคำร้อง" }));
  await demo.wait(1200);
  await demo.pause("เปิดคำร้อง: ซ้ายคือเอกสารประกอบที่นักศึกษาแนบ ขวาคือข้อมูลคำร้องและผลการเรียน");
  await demo.click(p.getByRole("button", { name: "✅ คำร้องผ่านเกณฑ์" }));
  await demo.click(p.getByRole("button", { name: "ยืนยัน", exact: true }));
  await waitStatus(s.pk, "QUALIFIED");
  await demo.done("คำร้องผ่านเกณฑ์ — นักศึกษาได้รับแจ้งเตือน และส่งเอกสาร T000 ต่อได้");

  // ═══ 6. นักศึกษากรอกใบสมัคร T000 + ส่งเอกสาร ═══
  await demo.step(6, "student", "กรอกใบสมัคร T000 และส่งเอกสารประกอบ",
    "ข้อมูลส่วนตัวกรอกไว้แล้ว — อัปโหลดรูปถ่าย ใส่ช่วงวันฝึกและเป้าหมาย ระบบสร้างใบสมัคร PDF (มีรูปในกรอบ) แล้วแนบเอกสารแต่ละหัวข้อ");
  await studentLogin();
  await demo.go("/student/docs");
  // รูปถ่ายสำหรับใบสมัคร — เลือกไฟล์แล้วระบบครอปเป็นสัดส่วนรูปติดบัตรและอัปโหลดให้ทันที
  await demo.files(p.locator('input[type="file"][accept="image/*"]').first(), await samplePhoto(), p.getByText("รูปถ่ายสำหรับใบสมัคร").first());
  await p.locator('img[alt="รูปถ่ายสำหรับใบสมัคร"]').waitFor({ timeout: 20_000 });
  await demo.wait(800);
  const goal = p.locator("div", { has: p.getByText("🎯 ระยะเวลาและจุดมุ่งหมาย") }).last();
  const goalDates = goal.locator('input[type="date"]');
  await demo.fill(goalDates.nth(0), isoDay(45));
  await demo.fill(goalDates.nth(1), isoDay(165));
  await demo.type(goal.getByPlaceholder("1.", { exact: true }), "นักพัฒนาซอฟต์แวร์ (Software Developer)");
  await demo.type(goal.getByPlaceholder("2.", { exact: true }), "นักทดสอบระบบ (Software Tester)");
  await demo.wait(2500); // บันทึกอัตโนมัติ
  await demo.click(p.getByRole("button", { name: "👁️ ดูตัวอย่างใบสมัคร" }));
  await p.locator("iframe").first().waitFor();
  await demo.pause("ระบบสร้างใบสมัคร T000 จากข้อมูลที่กรอก — นักศึกษาดาวน์โหลดไปเซ็นชื่อ");
  await demo.click(p.getByRole("button", { name: "ปิด", exact: true }).last());
  for (let i = 0; i < 12; i++) {
    const next = p.locator("table.doc-table tbody tr", { has: p.getByText("📤 แนบไฟล์") }).first();
    if (!(await next.count())) break;
    const title = (await next.locator("td").first().innerText()).split("\n")[0].trim();
    const row = p.locator("table.doc-table tbody tr", { hasText: title }).first(); // เลือกไฟล์แล้วคำว่า "แนบไฟล์" หาย
    await demo.files(row.locator('input[type="file"]'), await samplePdf(`t000-${i}`, title, [`${s.first} ${s.last} รหัส ${s.studentId}`]), row);
    await demo.click(row.getByRole("button", { name: "🚀 ยืนยันส่งไฟล์" }));
    await row.getByText("⏳ รอตรวจสอบ").first().waitFor();
  }
  await waitStatus(s.pk, "WAITING_FOR_STAFF_CHECK");
  await demo.done("ส่งเอกสารครบทุกหัวข้อ — สถานะ: ส่งเอกสารแล้ว รอเจ้าหน้าที่ตรวจ");

  // ═══ 7. เจ้าหน้าที่ตรวจเอกสาร T000 ═══
  await demo.step(7, "staff", "ตรวจเอกสาร T000",
    "เปิดดูเอกสารทีละฉบับ ให้ผ่าน/แก้ไข/ไม่ผ่านรายฉบับ หรือ \"อนุมัติทั้งหมด\"");
  await staffLogin();
  await demo.go("/admin/doct000");
  await demo.type(p.getByPlaceholder(/ค้นหา/).first(), s.studentId);
  const t000Row = () => p.locator("tbody tr", { hasText: s.studentId }).first();
  await demo.click(t000Row().getByRole("button", { name: "ตรวจสอบเอกสาร" }));
  const review = p.locator(".modal-backdrop").last();
  await review.waitFor();
  await demo.wait(1200);
  await demo.pause("เจ้าหน้าที่กดเลือกเอกสารเพื่อเปิดดูทางซ้าย และกดผ่าน/แก้ไข/ไม่ผ่าน ได้ทีละฉบับ");
  await demo.click(review.getByRole("button", { name: "อนุมัติทั้งหมด" }));
  await demo.confirm();
  await waitStatus(s.pk, "DOCS_APPROVED");
  await p.keyboard.press("Escape");
  await demo.done("เอกสารผ่านทั้งหมด — สถานะ: เอกสารผ่าน รอออกหนังสือ");

  // ═══ 8. เจ้าหน้าที่ออกหนังสือขอความอนุเคราะห์ ═══
  await demo.step(8, "staff", "ออกหนังสือขอความอนุเคราะห์",
    "ใส่เลขที่หนังสือ → ระบบสร้างหนังสือพร้อมเอกสารแนบเป็น PDF → โหลดร่างไปเสนอลงนาม → แนบฉบับลงนามกลับเข้าระบบ");
  await demo.go("/admin/doct000");
  await demo.type(p.getByPlaceholder(/ค้นหา/).first(), s.studentId);
  await demo.click(t000Row().getByRole("button", { name: "ออกหนังสือขอความอนุเคราะห์" }));
  await issueLetter(demo, DOC_NO(1), "signed-file-dispatch", "หนังสือขอความอนุเคราะห์");
  await waitStatus(s.pk, "REQ_LETTER_ISSUED");
  await demo.done(`ออกหนังสือเลขที่ อว ${DOC_NO(1)} แล้ว — นักศึกษาได้รับแจ้งและดาวน์โหลดหนังสือได้`);

  // ═══ 9. นักศึกษารับหนังสือ + ส่งใบตอบรับ ═══
  await demo.step(9, "student", "รับหนังสือขอความอนุเคราะห์และส่งใบตอบรับ",
    "นักศึกษาดาวน์โหลดหนังสือไปยื่นบริษัท เมื่อบริษัทตอบรับ อัปโหลดใบตอบรับเข้าระบบ");
  await studentLogin();
  await demo.go("/student/docs");
  const step4 = p.locator("div", { has: p.getByRole("heading", { name: /ขั้นตอนที่ 4/ }) }).last();
  await step4.scrollIntoViewIfNeeded();
  await demo.click(step4.getByRole("button", { name: "👁️ ดูตัวอย่าง" }).first());
  await demo.wait(1200);
  await demo.pause("หนังสือขอความอนุเคราะห์ฉบับลงนามที่เจ้าหน้าที่อัปโหลด");
  await demo.click(p.getByRole("button", { name: "ปิดหน้าต่าง" }));
  const popupReq = context.waitForEvent("page", { timeout: 5_000 }).catch(() => null);
  const dlReq = p.waitForEvent("download", { timeout: 5_000 }).catch(() => null);
  await demo.click(step4.getByRole("button", { name: "⬇️ ดาวน์โหลด" }));
  (await popupReq)?.close().catch(() => {}); await dlReq;
  await waitStatus(s.pk, "WAITING_FOR_PLACEMENT_LETTER");
  await demo.files(p.locator("#upload-acceptance"), await samplePdf("acceptance", "ใบตอบรับนักศึกษาสหกิจศึกษา", [`${COMPANY.name} ยินดีรับ ${s.first} ${s.last} เข้าปฏิบัติงานสหกิจศึกษา`]), step4.getByText("📂 เลือกไฟล์ใบตอบรับ"));
  await demo.click(step4.getByRole("button", { name: "🚀 ยืนยันส่งไฟล์" }));
  await waitStatus(s.pk, "WAITING_FOR_STAFF_CHECK_LETTER");
  await demo.done("ส่งใบตอบรับแล้ว — สถานะ: รอเจ้าหน้าที่ตรวจใบตอบรับ");

  // ═══ 10. เจ้าหน้าที่ตรวจใบตอบรับ ═══
  await demo.step(10, "staff", "ตรวจใบตอบรับจากบริษัท", "เปิดดูใบตอบรับ แล้วกดผ่าน");
  await staffLogin();
  await demo.go("/admin/doct000");
  await demo.type(p.getByPlaceholder(/ค้นหา/).first(), s.studentId);
  await demo.click(t000Row().getByRole("button", { name: "ตรวจสอบใบตอบรับ" }));
  const accModal = p.locator(".modal-backdrop").last();
  await accModal.waitFor();
  await demo.wait(1000);
  await demo.click(accModal.locator(".action-btn.pass").first());
  await demo.confirm();
  await waitStatus(s.pk, "ACCEPTANCE_CHECKED");
  await p.keyboard.press("Escape");
  await demo.done("ใบตอบรับผ่าน — สถานะ: รอออกหนังสือส่งตัว");

  // ═══ 11. เจ้าหน้าที่ออกหนังสือส่งตัว ═══
  await demo.step(11, "staff", "ออกหนังสือส่งตัว", "ขั้นตอนเดียวกับหนังสือขอความอนุเคราะห์ — ใส่เลขที่ สร้าง PDF โหลดร่าง แนบฉบับลงนาม");
  await demo.go("/admin/doct000");
  await demo.type(p.getByPlaceholder(/ค้นหา/).first(), s.studentId);
  await demo.click(t000Row().getByRole("button", { name: "ออกหนังสือส่งตัว" }));
  await issueLetter(demo, DOC_NO(2), "signed-file-placement", "หนังสือส่งตัว");
  await waitStatus(s.pk, "PLACEMENT_LETTER_ISSUED");
  await demo.done(`ออกหนังสือส่งตัวเลขที่ อว ${DOC_NO(2)} แล้ว`);

  // ═══ 12. นักศึกษารับหนังสือส่งตัว → เริ่มฝึกงาน ═══
  await demo.step(12, "student", "รับหนังสือส่งตัวและเริ่มฝึกงาน", "กดดาวน์โหลดหนังสือส่งตัว ระบบเปลี่ยนสถานะเป็นช่วงฝึกสหกิจให้อัตโนมัติ");
  await studentLogin();
  await demo.go("/student/docs");
  const placeCard = p.locator("div", { has: p.getByRole("heading", { name: /หนังสือส่งตัว \(Placement Letter\)/ }) })
    .filter({ has: p.getByRole("button", { name: /ดาวน์โหลด/ }) }).last();
  await demo.openPopupPdf(placeCard.getByRole("button", { name: /ดาวน์โหลด/ }), "หนังสือส่งตัว (ฉบับลงนาม)");
  await waitStatus(s.pk, "INTERNSHIP_STARTED");
  await demo.done("สถานะ: ส่งเอกสารฝึกสหกิจ — ส่ง T002 และ T003 ได้ (ลำดับใดก่อนก็ได้)");

  // ═══ 13. นักศึกษาส่ง T002 ═══
  await demo.step(13, "student", "ส่ง T002 แบบแจ้งรายละเอียดงาน", "กรอกลักษณะงาน ดูตัวอย่าง PDF ที่ระบบสร้าง แล้วอัปโหลดฉบับลงนาม");
  await demo.go("/student/docs-t002");
  await demo.type(p.getByPlaceholder("อธิบายลักษณะงานที่ได้รับมอบหมายพอสังเขป..."), "พัฒนาระบบเว็บแอปพลิเคชันสำหรับงานบริการลูกค้า");
  await demo.click(p.getByRole("button", { name: "👁️ ดูตัวอย่าง / โหลด PDF" }));
  await p.locator("iframe").first().waitFor();
  await demo.pause("แบบฟอร์ม T002 ที่ระบบสร้างจากข้อมูลที่กรอก");
  await demo.click(p.getByRole("button", { name: "ปิด", exact: true }).last());
  await demo.files(p.locator("#upload-t002"), await samplePdf("t002", "T002 แบบแจ้งรายละเอียดงาน (ลงนามแล้ว)", [`${s.first} ${s.last} · ${COMPANY.name}`]), p.getByText("📂 เลือกไฟล์ T002 เพื่ออัปโหลด"));
  await demo.click(p.getByRole("button", { name: "🚀 ยืนยันส่งไฟล์ T002" }));
  await waitDoc(s.pk, "T002_FORM", "WAITING");
  await demo.done("ส่ง T002 แล้ว — รออาจารย์ที่ปรึกษาตรวจ");

  // ═══ 14. นักศึกษาส่ง T003 ═══
  await demo.step(14, "student", "ส่ง T003 โครงร่างรายงาน", "อัปโหลดโครงร่างรายงานฉบับลงนาม");
  await demo.go("/student/docs-t003");
  await demo.files(p.locator("#upload-t003"), await samplePdf("t003", "T003 โครงร่างรายงานสหกิจศึกษา (ลงนามแล้ว)", [`${s.first} ${s.last}`, "หัวข้อ: ระบบบริการลูกค้าออนไลน์"]), p.getByText("📂 เลือกไฟล์ T003 เพื่ออัปโหลด"));
  await demo.click(p.getByRole("button", { name: /ยืนยันส่งไฟล์ T003/ }));
  await waitDoc(s.pk, "T003_FORM", "WAITING");
  await demo.done("ส่ง T003 แล้ว — รออาจารย์ที่ปรึกษาตรวจ");

  // ═══ 15. อาจารย์ที่ปรึกษาตรวจ T002 / T003 ═══
  await demo.step(15, "teacher", "อาจารย์ที่ปรึกษาตรวจ T002 และ T003", "เปิดเอกสารดู ให้ผ่าน หรือตีกลับพร้อมเหตุผล");
  await teacherLogin();
  for (const [path, type] of [["/teacher/review-t002", "T002_FORM"], ["/teacher/review-t003", "T003_FORM"]] as const) {
    await demo.go(path);
    await demo.type(p.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท..."), s.studentId);
    await demo.click(p.locator("tr", { hasText: s.studentId }).getByRole("button", { name: /🔍 (ตรวจเอกสาร|พิจารณา)/ }));
    await demo.wait(1200);
    await demo.click(p.locator(".btn-success").last());
    await demo.confirm();
    await waitDoc(s.pk, type, "APPROVED");
  }
  await demo.done("T002 และ T003 ผ่านแล้ว — นักศึกษาได้รับแจ้งเตือน");

  // ═══ 16. นักศึกษาเสนอวันนิเทศ ═══
  await demo.step(16, "student", "เสนอวันนิเทศ", "เลือกวันและรูปแบบ (ออนไลน์/ที่บริษัท) เสนอได้หลายตัวเลือก ส่งให้อาจารย์ที่ปรึกษาพิจารณา");
  await studentLogin();
  await demo.go("/student/supervision");
  await demo.fill(p.locator('input[type="date"]').first(), isoDay(30));
  const meet = p.getByPlaceholder("https://meet.google.com/...");
  if (await meet.count()) await demo.type(meet.first(), "https://meet.google.com/demo-coop");
  await demo.click(p.getByRole("button", { name: "🚀 ส่งข้อมูลให้อาจารย์พิจารณา" }));
  await demo.confirm();
  await waitAppt(s.pk, "PENDING_TEACHER");
  await demo.done("ส่งวันนิเทศแล้ว — รออาจารย์ยืนยัน");

  // ═══ 17. อาจารย์ยืนยันวัน → เจ้าหน้าที่ออกหนังสือขอนิเทศ ═══
  await demo.step(17, "teacher", "อาจารย์ยืนยันวันนิเทศ", "เลือกวันที่นักศึกษาเสนอ หรือปฏิเสธพร้อมเหตุผลให้เสนอใหม่");
  await teacherLogin();
  await demo.go("/teacher/review-supervision");
  await demo.type(p.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท...").first(), s.studentId);
  await demo.click(p.locator("tr", { hasText: s.studentId }).getByRole("button", { name: "พิจารณาวันนิเทศ" }));
  await demo.click(p.getByRole("button", { name: "เลือกวันนี้" }).first());
  await demo.click(p.getByRole("button", { name: "ยืนยันวันนี้", exact: true }));
  await waitAppt(s.pk, "DATE_CONFIRMED");
  await demo.pause("อาจารย์ยืนยันวันนิเทศแล้ว — ต่อไปเจ้าหน้าที่ออกหนังสือขอนิเทศถึงบริษัท", "ไปที่เจ้าหน้าที่ ▶");

  await demo.step(17, "staff", "ออกหนังสือขอนิเทศ", "ใส่เลขที่ สร้าง PDF โหลดร่าง แนบฉบับลงนาม — นักศึกษาและอาจารย์เห็นหนังสือทันที");
  await staffLogin();
  await demo.go("/admin/supervision-manager");
  await demo.type(p.getByPlaceholder("ค้นหา รหัส / ชื่อ / บริษัท / อาจารย์..."), s.studentId);
  await demo.click(p.locator(".responsive-table tr", { hasText: s.studentId }).getByRole("button", { name: "📄 ออกหนังสือ" }));
  await issueLetter(demo, DOC_NO(3), "signed-file-supervision", "หนังสือขอนิเทศ");
  await waitAppt(s.pk, "LETTER_UPLOADED");
  await demo.done("ออกหนังสือขอนิเทศแล้ว — อาจารย์ไปนิเทศที่บริษัทตามวันที่นัด");

  // ═══ 18. อาจารย์บันทึกว่านิเทศเสร็จ ═══
  await demo.step(18, "teacher", "บันทึกว่านิเทศเสร็จสิ้น",
    "หลังไปนิเทศที่บริษัทแล้ว อาจารย์กด \"จบนิเทศ\" — นักศึกษาได้แจ้งเตือนให้ทำขั้นสุดท้าย (แบบประเมินและเล่มรายงาน)");
  await teacherLogin();
  await demo.go("/teacher/review-supervision");
  await demo.click(p.locator("tr", { hasText: s.studentId }).getByRole("button", { name: "🏁 จบนิเทศ" }).first());
  await demo.confirm();
  await waitAppt(s.pk, "COMPLETED");
  await demo.wait(800);
  await demo.done("สถานะนัดนิเทศ: นิเทศเสร็จสิ้น");

  // ═══ 19. เจ้าหน้าที่ส่งแบบประเมินการนิเทศให้อาจารย์ ═══
  await demo.step(19, "staff", "ส่งลิงก์แบบประเมินการนิเทศให้อาจารย์",
    "ลิงก์แบบประเมิน (Google Form) ตั้งแยกตามหลักสูตรได้ · ส่งเองทีละรายการ/ทั้งหมด หรือตั้งให้ส่งอัตโนมัติเมื่ออาจารย์กดจบนิเทศ");
  await staffLogin();
  await demo.go("/admin/supervision-eval");
  const evalRow = p.locator("tr", { hasText: s.studentId }).first();
  await evalRow.waitFor();
  await demo.point(evalRow);
  await demo.click(evalRow.getByRole("button", { name: "ส่ง", exact: true }));
  await demo.confirm();
  await evalRow.getByText(/ส่งแล้ว/).waitFor();
  await demo.pause("ส่งแล้ว — ลิงก์ขึ้นในหน้านิเทศของอาจารย์ผู้นิเทศ (และอาจารย์นิเทศร่วม)");
  await teacherLogin();
  await demo.go("/teacher/review-supervision");
  const evalCard = p.locator("section", { hasText: "📋 แบบประเมินการนิเทศ" }).first();
  await evalCard.waitFor();
  await demo.point(evalCard);
  await demo.done("อาจารย์เห็นแบบประเมินที่ต้องทำ พร้อมรายชื่อนักศึกษาที่นิเทศ");

  // ═══ 20. นักศึกษา: แบบประเมินและเล่มรายงาน ═══
  await demo.step(20, "student", "แบบประเมิน T005–T007 และส่งเล่มรายงาน T008",
    "ขั้นสุดท้ายของนักศึกษา — คำชี้แจงและลิงก์ของแต่ละแบบฟอร์มตั้งแยกตามหลักสูตรได้");
  await studentLogin();
  await demo.go("/student/doc-t005-006");
  await demo.point(p.getByText("แบบประเมินผลการปฏิบัติงาน (T005)"));
  await demo.pause("T005/T006: ส่งลิงก์แบบประเมินให้พี่เลี้ยงที่บริษัท (CC อาจารย์ที่ปรึกษา)");
  await demo.go("/student/doc-t007");
  await demo.pause("T007: นักศึกษาประเมินสถานประกอบการ");
  await demo.go("/student/doc-t008");
  await demo.point(p.getByText("โฟลเดอร์ Google Drive (สำหรับส่งเล่มรายงาน)"));
  await demo.end(`ครบทั้งเส้นทางแล้ว 🎉 ตั้งแต่นำเข้ารายชื่อจนส่งเล่มรายงาน\nบัญชีสาธิตยังอยู่ ล็อกอินลองใช้ต่อได้ (รหัสผ่าน ${PASSWORD}):\n• ${studentEmail("s1")}\n• ${ACCOUNTS.teacher.email}\n• ${ACCOUNTS.staff.email}`);
});
