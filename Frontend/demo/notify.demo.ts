/**
 * สาธิตขยายเวลาส่งและประกาศ: T000 เลยกำหนดแบบปิดรับ → นักศึกษาส่งไม่ได้ → เจ้าหน้าที่ขยายเวลาให้รายคนพร้อมเหตุผล
 * → นักศึกษาส่งได้ → เจ้าหน้าที่ประกาศถึงห้องของหลักสูตร → นักศึกษาเห็นประกาศ
 */
import { test } from "@playwright/test";
import { Demo } from "./kit";
import { ACCOUNTS, MAJOR, PASSWORD, isoDay, prisma, resetDemo, samplePdf, seedBase, seedOpenPeriod, seedStudent } from "./data";

const FILTER = { "coop.adminMajorFilter": MAJOR };
const REASON = "ป่วย มีใบรับรองแพทย์ (แจ้งอาจารย์ที่ปรึกษาแล้ว)";
const ANN_TITLE = "เตือนกำหนดส่ง T002 แบบแจ้งรายละเอียดงาน";

test("สาธิตขยายเวลาส่งและประกาศ", async ({ page, context }) => {
  const demo = new Demo(context, "สาธิต — ขยายเวลาส่งและประกาศ", 5);
  await demo.init(page);
  const p = page;

  await resetDemo();
  const base = await seedBase();
  const period = await seedOpenPeriod();
  // T000 ของหลักสูตรสาธิต: ปิดรับเมื่อเลยกำหนด (HARD) และเลยมาแล้ว 3 วัน
  await prisma.coopPeriodMajor.updateMany({ where: { periodId: period.id, major: MAJOR }, data: { deadlines: { T000: { due: isoDay(-3), mode: "HARD" } } } });
  const s = await seedStudent(0, base, { company: true, coop: { status: "QUALIFIED", coopPeriodId: period.id, jobPosition: "Software Developer" } });
  const until = isoDay(5);

  await p.goto("/");
  await demo.step(0, null, "เริ่มการสาธิต",
    `${s.first} ${s.last} ผ่านคุณสมบัติแล้ว แต่ยังไม่ได้ส่งเอกสาร T000\nกำหนดส่ง T000 ของหลักสูตร ${MAJOR} ผ่านมาแล้ว 3 วัน และตั้งเป็นแบบ "ปิดรับเมื่อเลยกำหนด"`);
  await demo.done("ข้อมูลตัวอย่างพร้อมแล้ว", "เริ่ม ▶");

  // ═══ 1. นักศึกษาส่งไม่ได้ ═══
  await demo.step(1, "student", "เลยกำหนดส่ง — ระบบปิดรับ", "หลักสูตรตั้งกำหนดส่งได้ 2 แบบ: ปิดรับเมื่อเลยกำหนด หรือส่งได้แต่ติดป้าย \"ส่งช้า\"");
  await demo.login("student", s.email, PASSWORD);
  await demo.go("/student/docs");
  const closed = p.getByText(/ปิดรับเอกสาร/).first();
  await closed.waitFor();
  await demo.point(closed);
  await demo.done("นักศึกษาส่งเอกสาร T000 ไม่ได้แล้ว — ต้องติดต่อเจ้าหน้าที่");

  // ═══ 2. เจ้าหน้าที่ขยายเวลา ═══
  await demo.step(2, "staff", "ขยายเวลาส่งให้รายคน พร้อมเหตุผล",
    "ขยายให้เฉพาะคนที่มีเหตุจำเป็น คนอื่นยังใช้กำหนดเดิม · เหตุผลเก็บในบันทึกการใช้งาน");
  await demo.login("staff", ACCOUNTS.staff.email, PASSWORD, FILTER);
  await demo.go("/admin/doct000");
  await demo.type(p.getByPlaceholder(/ค้นหา/).first(), s.studentId);
  const row = () => p.locator("tbody tr", { hasText: s.studentId }).first();
  await demo.click(row().getByRole("button", { name: "ขยายเวลา" }));
  const dlg = p.getByRole("dialog").last();
  await demo.fill(dlg.locator('input[type="date"]').first(), until);
  await demo.type(dlg.getByPlaceholder(/เช่น/), REASON);
  await demo.click(dlg.getByRole("button", { name: "บันทึก", exact: true }));
  await row().getByRole("button", { name: "ขยายเวลาแล้ว" }).waitFor();
  await demo.point(row().getByRole("button", { name: "ขยายเวลาแล้ว" }));
  await demo.done(`ขยายเวลาส่ง T000 ของ ${s.first} ถึงสิ้นวันที่กำหนดแล้ว`);

  // ═══ 3. นักศึกษาส่งได้ ═══
  await demo.step(3, "student", "นักศึกษาส่งเอกสารได้อีกครั้ง", "หน้าเอกสารกลับมาเปิดรับ พร้อมนับเวลาถึงวันที่ขยายให้");
  await demo.login("student", s.email, PASSWORD);
  await demo.go("/student/docs");
  const first = p.locator("table.doc-table tbody tr", { has: p.getByText("📤 แนบไฟล์") }).first();
  await first.waitFor();
  const title = (await first.locator("td").first().innerText()).split("\n")[0].replace(/\*/g, "").trim();
  const fileRow = p.locator("table.doc-table tbody tr", { hasText: title }).first();
  await demo.files(fileRow.locator('input[type="file"]'), await samplePdf("late-doc", title, [`${s.first} ${s.last} รหัส ${s.studentId}`]), fileRow.getByText("📤 แนบไฟล์"));
  await demo.click(fileRow.getByRole("button", { name: "🚀 ยืนยันส่งไฟล์" }));
  await fileRow.getByText("⏳ รอตรวจสอบ").first().waitFor();
  await demo.done(`ส่ง "${title}" ได้แล้ว — ฉบับอื่นส่งต่อได้จนถึงวันที่ขยายให้`);

  // ═══ 4. เจ้าหน้าที่ประกาศ ═══
  await demo.step(4, "staff", "ประกาศถึงนักศึกษาของหลักสูตร",
    "ประกาศแยกห้องตามหลักสูตรและรอบ (หรือส่วนกลางถึงทุกหลักสูตร) · ปักหมุด แนบไฟล์/ลิงก์ ตั้งเวลาเผยแพร่ได้ · นักศึกษาได้แจ้งเตือนทันที");
  await demo.login("staff", ACCOUNTS.staff.email, PASSWORD, FILTER);
  await demo.go("/admin/announcements");
  await demo.select(p.getByLabel("เลือกรอบ"), period.label);
  await demo.click(p.getByRole("button", { name: new RegExp(`หลักสูตร ${MAJOR}`) }).first());
  await demo.click(p.getByRole("button", { name: /ประกาศอะไรให้/ }));
  const editor = p.getByRole("dialog").last();
  await demo.type(editor.getByPlaceholder("เช่น กำหนดส่งเอกสาร T002"), ANN_TITLE);
  await demo.type(editor.getByPlaceholder("รายละเอียดประกาศ..."), "นักศึกษาที่เริ่มฝึกงานแล้ว ส่ง T002 ภายใน 2 สัปดาห์หลังเริ่มงาน\nติดปัญหาให้แจ้งอาจารย์ที่ปรึกษาก่อนครบกำหนด");
  await demo.click(editor.getByText("📌 ปักหมุด"));
  await demo.click(editor.getByRole("button", { name: "📢 ประกาศ" }));
  await p.getByText(ANN_TITLE).first().waitFor();
  await demo.point(p.getByText(ANN_TITLE).first());
  await demo.done(`ประกาศขึ้นในห้องหลักสูตร ${MAJOR} รอบ ${period.label} (ปักหมุดไว้บนสุด)`);

  // ═══ 5. นักศึกษาเห็นประกาศ ═══
  await demo.step(5, "student", "นักศึกษาเห็นประกาศ", "ประกาศใหม่ขึ้นป้ายบนเมนู \"ประกาศ\" และอยู่ในแจ้งเตือน");
  await demo.login("student", s.email, PASSWORD);
  await demo.point(p.locator(".sidebar .item", { hasText: "ประกาศ" }).first());
  await demo.go("/student/announcements");
  await p.getByText(ANN_TITLE).first().waitFor();
  await demo.point(p.getByText(ANN_TITLE).first());
  await demo.end("ขยายเวลาให้รายคนโดยไม่ต้องเปิดรับทั้งหลักสูตร และแจ้งข่าวถึงนักศึกษาเฉพาะกลุ่มได้จากระบบเดียว");
});
