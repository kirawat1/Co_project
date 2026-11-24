/**
 * สาธิตนิเทศที่มีอาจารย์ร่วม: นักศึกษาเสนอวัน → อาจารย์ประจำวิชามอบหมายอาจารย์ร่วม → อาจารย์ร่วมไม่ว่าง
 * → อาจารย์หลักเลือกวันนั้น ระบบเตือนก่อน → ปฏิเสธพร้อมเหตุผล → นักศึกษาเห็นเหตุผลแล้วเสนอวันใหม่ → อาจารย์ร่วมว่าง → ยืนยันวัน
 * เลขขั้น demo.step(n, บทบาท, "ชื่อขั้น") — demo.js อ่านจากไฟล์นี้ (เขียนเป็นข้อความตรง ห้ามเป็นตัวแปร)
 */
import { test, type Page } from "@playwright/test";
import { Demo } from "./kit";
import { waitAppt } from "./steps";
import { ACCOUNTS, MAJOR, PASSWORD, isoDay, prisma, resetDemo, seedBase, seedOpenPeriod, seedReadyStudent, seedTeacher, studentEmail } from "./data";

const FILTER = { "coop.adminMajorFilter": MAJOR };
const REASON = "อาจารย์นิเทศร่วมไม่ว่างวันนั้น รบกวนเสนอวันในสัปดาห์ถัดไป";

/** วันธรรมดาวันแรกที่ห่างจากวันนี้อย่างน้อย n วัน */
function weekday(n: number) {
  for (let d = n; d < n + 7; d++) {
    const w = new Date(`${isoDay(d)}T12:00:00+07:00`).getUTCDay();
    if (w !== 0 && w !== 6) return isoDay(d);
  }
  return isoDay(n);
}
const thai = (iso: string) => new Date(`${iso}T12:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

test("สาธิตนิเทศที่มีอาจารย์ร่วม", async ({ page, context }) => {
  const demo = new Demo(context, "สาธิต — นิเทศที่มีอาจารย์ร่วม", 7);
  await demo.init(page);
  const p: Page = page;

  await resetDemo();
  const base = await seedBase();
  const period = await seedOpenPeriod();
  const s = await seedReadyStudent(0, base, period.id, { id: base.companyId, contactId: base.contactId }, "INTERNSHIP_STARTED");
  const co = await seedTeacher("coteacher", "อ.", "ปรีชา", "ตัวอย่าง");
  const D1 = weekday(21), D2 = weekday(28);
  const appt = () => prisma.supervisionAppointment.findFirst({ where: { studentId: s.pk }, orderBy: { id: "desc" }, include: { coTeachers: true } });

  const teacher = () => demo.login("teacher", ACCOUNTS.teacher.email, PASSWORD, FILTER);
  const coTeacher = () => demo.login("teacher", co.email, PASSWORD);
  const student = () => demo.login("student", s.email, PASSWORD);
  // กล่องยืนยันของระบบ (ต่างจากหน้าต่างพิจารณาวันที่เป็น dialog เหมือนกัน — กล่องยืนยันมี animation confirmIn)
  const confirmBox = () => p.locator('[role="dialog"][aria-modal="true"]:has(> div[style*="confirmIn"])').last();
  const propose = async (day: string) => {
    await demo.go("/student/supervision");
    const slot = p.locator("div").filter({ has: p.getByText("ตัวเลือก 1", { exact: true }) }).filter({ has: p.locator("select") }).last();
    await demo.fill(slot.locator('input[type="date"]').first(), day);
    const sel = slot.locator("select");
    await demo.select(sel.nth(0), "13:00");
    await demo.select(sel.nth(1), "14:00");
    await demo.select(sel.nth(2), "ONSITE");
    await demo.click(p.getByRole("button", { name: "🚀 ส่งข้อมูลให้อาจารย์พิจารณา" }));
    await demo.confirm();
    await waitAppt(s.pk, "PENDING_TEACHER");
  };
  // อาจารย์ที่ไม่ได้เป็นอาจารย์ประจำวิชา: ตัวเลือกรอบเริ่มที่รอบที่เปิดรับสมัคร — นัดอยู่รอบอื่นระบบขึ้นแถบเตือนพร้อมปุ่มดูทุกปีการศึกษา
  const showOtherRounds = async () => {
    const warn = p.getByText(/มีนัดนิเทศรอคุณในรอบอื่น/);
    await warn.first().waitFor({ timeout: 3_000 }).catch(() => {});
    if (await warn.count()) await demo.click(p.getByRole("button", { name: "ดูทุกปีการศึกษา" }));
  };
  const openReview = async () => {
    await demo.go("/teacher/review-supervision");
    await demo.type(p.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท...").first(), s.studentId);
    await demo.click(p.locator("tr", { hasText: s.studentId }).getByRole("button", { name: "พิจารณาวันนิเทศ" }));
    await demo.wait(800);
  };

  await p.goto("/");
  await demo.step(0, null, "เริ่มการสาธิต",
    `${s.first} ${s.last} (${s.studentId}) ฝึกงานอยู่ ถึงช่วงนัดนิเทศ\n• อาจารย์ผู้นิเทศหลัก: ${ACCOUNTS.teacher.name} (เป็นอาจารย์ประจำวิชาด้วย)\n• อาจารย์ที่จะเป็นอาจารย์ร่วม: ${co.name}`);
  await demo.done("ข้อมูลตัวอย่างพร้อมแล้ว", "เริ่ม ▶");

  // ═══ 1. นักศึกษาเสนอวัน ═══
  await demo.step(1, "student", "เสนอวันนิเทศ", `เลือกวัน ${thai(D1)} 13.00–14.00 น. ที่บริษัท แล้วส่งให้อาจารย์พิจารณา`);
  await student();
  await propose(D1);
  await demo.done(`เสนอ ${thai(D1)} แล้ว — รออาจารย์พิจารณา`);

  // ═══ 2. อาจารย์ประจำวิชามอบหมายอาจารย์ร่วม ═══
  await demo.step(2, "teacher", "มอบหมายอาจารย์นิเทศร่วม",
    "แท็บ \"ทั้งหมด\" ของอาจารย์ประจำวิชา เห็นนัดของทุกคนในหลักสูตร — เลือกอาจารย์ร่วมได้หลายคน");
  await teacher();
  await demo.go("/teacher/review-supervision");
  await demo.click(p.getByRole("button", { name: /🗂️ ทั้งหมด/ }));
  await demo.type(p.getByPlaceholder("ค้นหา รหัส / ชื่อ / บริษัท / อาจารย์...").first(), s.studentId);
  await demo.click(p.locator("tr", { hasText: s.studentId }).getByRole("button", { name: /มอบหมายอาจารย์ร่วม|อาจารย์ร่วม/ }).first());
  await demo.click(p.locator("label", { hasText: co.name }).locator('input[type="checkbox"]'));
  await demo.click(p.getByRole("button", { name: "💾 บันทึก" }));
  for (let i = 0; i < 40 && !(await appt())?.coTeachers.length; i++) await p.waitForTimeout(250);
  await demo.done(`${co.name} เป็นอาจารย์นิเทศร่วมแล้ว — ตัวเลขงานค้างบนเมนูของอาจารย์ร่วมขึ้นทันที`);

  // ═══ 3. อาจารย์ร่วมระบุว่าไม่ว่าง ═══
  await demo.step(3, "teacher", "อาจารย์ร่วมระบุวันว่าง — ไม่ว่าง",
    "อาจารย์ร่วมติ๊กวันที่ตัวเองว่างจากวันที่นักศึกษาเสนอ อาจารย์หลักจะเห็นก่อนเลือกวัน");
  await coTeacher();
  await demo.go("/teacher/review-supervision");
  await showOtherRounds();
  await demo.click(p.locator("tr", { hasText: s.studentId }).getByRole("button", { name: /ระบุวันว่าง/ }));
  await demo.pause(`วันที่นักศึกษาเสนอ: ${thai(D1)} — อาจารย์ร่วมไม่ว่างวันนี้ จึงไม่ติ๊ก`);
  await demo.click(p.getByRole("button", { name: /บันทึก — ไม่ว่างทุกวันที่เสนอ/ }));
  for (let i = 0; i < 40 && (await appt())?.coTeachers[0]?.availableDates == null; i++) await p.waitForTimeout(250);
  await demo.done("บันทึกว่าไม่ว่างแล้ว — แจ้งอาจารย์ผู้นิเทศหลัก");

  // ═══ 4. อาจารย์หลัก: ระบบเตือนก่อนเลือกวันที่อาจารย์ร่วมไม่ว่าง → ปฏิเสธพร้อมเหตุผล ═══
  await demo.step(4, "teacher", "อาจารย์หลักเห็นว่าอาจารย์ร่วมไม่ว่าง แล้วปฏิเสธพร้อมเหตุผล",
    "วันที่เสนอขึ้นป้าย ✗ ชื่ออาจารย์ร่วม · ถ้ากดเลือกวันนี้ ระบบถามซ้ำก่อนยืนยัน · ปฏิเสธต้องใส่เหตุผลเสมอ");
  await teacher();
  await openReview();
  await demo.point(p.getByText(new RegExp(`✗ ${co.name}`)).first());
  await demo.pause(`ป้าย ✗ ${co.name} — อาจารย์ร่วมแจ้งว่าไม่ว่างวันนี้`);
  await demo.click(p.getByRole("button", { name: "เลือกวันนี้" }).first());
  await demo.click(confirmBox().getByRole("button", { name: /ยืนยันวันนี้/ }));
  const warn = confirmBox().filter({ hasText: "อาจารย์นิเทศร่วมอาจไม่สะดวก" });
  await warn.waitFor();
  await demo.pause("ระบบเตือน: อาจารย์นิเทศร่วมไม่ว่างวันนี้ — ยืนยันต่อได้ หรือยกเลิกแล้วให้นักศึกษาเสนอวันใหม่");
  await demo.click(warn.getByRole("button", { name: /ยกเลิก/ }));
  await demo.type(p.getByPlaceholder("เช่น ขอเลื่อนเป็นสัปดาห์หน้า..."), REASON);
  await demo.click(p.getByRole("button", { name: "ปฏิเสธให้เลือกวันใหม่" }));
  await demo.click(confirmBox().locator("button").last());
  await waitAppt(s.pk, "TEACHER_REJECTED");
  await demo.done("ปฏิเสธวันแล้ว — นักศึกษาได้รับแจ้งพร้อมเหตุผล");

  // ═══ 5. นักศึกษาเห็นเหตุผล แล้วเสนอวันใหม่ ═══
  await demo.step(5, "student", "เห็นเหตุผลแล้วเสนอวันใหม่",
    `หน้าแรกบอกขั้นถัดไป "เสนอวันใหม่" · เลือก ${thai(D2)} 13.00–14.00 น.`);
  await student();
  const next = p.getByText(/เสนอวันใหม่/).first();
  await next.waitFor().catch(() => {});
  await demo.point(next);
  await demo.pause("แถบขั้นตอนถัดไปบนหน้าแรก: อาจารย์ขอให้เสนอวันใหม่");
  await demo.go("/student/supervision");
  await demo.point(p.getByText(REASON).first());
  await demo.pause(`เหตุผลจากอาจารย์: "${REASON}"`);
  await propose(D2);
  await demo.done(`เสนอ ${thai(D2)} แล้ว — อาจารย์ร่วมยังอยู่ในนัดเดิม ไม่ต้องมอบหมายใหม่`);

  // ═══ 6. อาจารย์ร่วมว่างวันใหม่ ═══
  await demo.step(6, "teacher", "อาจารย์ร่วมระบุวันว่าง — ว่าง", `ติ๊ก ${thai(D2)} ว่าวันนี้ว่าง`);
  await coTeacher();
  await demo.go("/teacher/review-supervision");
  await showOtherRounds();
  await demo.click(p.locator("tr", { hasText: s.studentId }).getByRole("button", { name: /ระบุวันว่าง|แก้วันว่าง/ }));
  await demo.click(p.locator('label:has(input[type="checkbox"])').first().locator('input[type="checkbox"]'));
  await demo.click(p.getByRole("button", { name: /บันทึกวันว่าง \(1 วัน\)/ }));
  for (let i = 0; i < 40 && !String((await appt())?.coTeachers[0]?.availableDates ?? "").includes(D2); i++) await p.waitForTimeout(250);
  await demo.done("บันทึกวันว่างแล้ว");

  // ═══ 7. อาจารย์หลักยืนยันวัน ═══
  await demo.step(7, "teacher", "อาจารย์หลักยืนยันวันนิเทศ", "วันที่เสนอขึ้นป้าย ✓ ชื่ออาจารย์ร่วม — ยืนยันได้ทันที ไม่มีคำเตือน");
  await teacher();
  await openReview();
  await demo.point(p.getByText(new RegExp(`✓ ${co.name}`)).first());
  await demo.pause(`ป้าย ✓ ${co.name} — อาจารย์ร่วมว่างวันนี้`);
  await demo.click(p.getByRole("button", { name: "เลือกวันนี้" }).first());
  await demo.click(confirmBox().getByRole("button", { name: /ยืนยันวันนี้/ }));
  await waitAppt(s.pk, "DATE_CONFIRMED");
  await demo.end(`ยืนยันวันนิเทศ ${thai(D2)} แล้ว 🎉 อาจารย์หลักและอาจารย์ร่วมไปนิเทศพร้อมกัน\nต่อไปเจ้าหน้าที่ออกหนังสือขอนิเทศ (ดูชุด "นิเทศหลายคนพร้อมกัน")\nบัญชีสาธิต (รหัสผ่าน ${PASSWORD}): ${studentEmail("s1")} · ${ACCOUNTS.teacher.email} · ${co.email}`);
});
