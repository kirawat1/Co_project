/**
 * สาธิตนิเทศหลายคน: นักศึกษา 3 คนบริษัทเดียวกันเสนอวันเดียวกันคนละช่วงเวลา → อาจารย์ "นัดพร้อมกัน"
 * → เจ้าหน้าที่ออกหนังสือขอนิเทศฉบับรวมของกลุ่ม
 */
import { test } from "@playwright/test";
import { Demo } from "./kit";
import { waitAppt, issueLetter } from "./steps";
import {
  ACCOUNTS, COMPANY, MAJOR, PASSWORD, DOC_NO, isoDay, prisma, resetDemo, seedBase, seedOpenPeriod, seedReadyStudent, studentEmail,
} from "./data";

const FILTER = { "coop.adminMajorFilter": MAJOR };

test("สาธิตนิเทศหลายคนพร้อมกัน", async ({ page, context }) => {
  const demo = new Demo(context, "สาธิต — นิเทศหลายคนพร้อมกัน", 4);
  await demo.init(page);
  const p = page;

  await resetDemo();
  const base = await seedBase();
  const period = await seedOpenPeriod();
  const company = { id: base.companyId, contactId: base.contactId };
  const st = [
    await seedReadyStudent(0, base, period.id, company, "INTERNSHIP_STARTED"),
    await seedReadyStudent(1, base, period.id, company, "INTERNSHIP_STARTED"),
    await seedReadyStudent(2, base, period.id, company, "INTERNSHIP_STARTED"),
  ];
  const day = isoDay(21);
  // เพื่อน 2 คนเสนอวันเดียวกันไว้แล้ว (09–10 น. และ 10–11 น. ที่บริษัท)
  for (const [i, time] of [[1, "09:00-10:00"], [2, "10:00-11:00"]] as const) {
    await prisma.supervisionAppointment.create({ data: {
      studentId: st[i].pk, teacherId: base.teacherPk, status: "PENDING_TEACHER", supervisionType: "ONSITE",
      proposedDates: JSON.stringify([`${day}|${time}|ONSITE`]),
    } });
  }
  const thaiDay = new Date(`${day}T12:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

  await p.goto("/");
  await demo.step(0, null, "เริ่มการสาธิต",
    `นักศึกษา 3 คนฝึกงานที่ ${COMPANY.name}\n• ${st[1].first} เสนอ ${thaiDay} 09.00–10.00 น.\n• ${st[2].first} เสนอ ${thaiDay} 10.00–11.00 น.\n• ${st[0].first} กำลังจะเสนอวันเดียวกัน`);
  await demo.done("ข้อมูลตัวอย่างพร้อมแล้ว", "เริ่ม ▶");

  // ═══ 1. นักศึกษาเสนอวัน (เห็นคิวของเพื่อน) ═══
  await demo.step(1, "student", "เสนอวันนิเทศ — เห็นคิวของเพื่อนบริษัทเดียวกัน",
    "หน้าเสนอวันแสดงวันที่เพื่อนบริษัทเดียวกันนัดไว้ เลือกวันเดียวกันแต่ช่วงเวลาไม่ทับ อาจารย์จะได้ไปนิเทศรอบเดียว");
  await demo.login("student", st[0].email, PASSWORD);
  await demo.go("/student/supervision");
  const friends = p.getByText(/เพื่อนที่ .* นัดไว้แล้ว/).first();
  if (await friends.count()) {
    await demo.point(friends);
    await demo.pause("ระบบแสดงวันที่เพื่อนบริษัทเดียวกันเสนอไว้ — เลือกวันเดียวกันได้ทันที");
  }
  const slot = p.locator("div").filter({ has: p.getByText("ตัวเลือก 1", { exact: true }) }).filter({ has: p.locator("select") }).last();
  await demo.fill(slot.locator('input[type="date"]').first(), day);
  const selects = slot.locator("select");
  await demo.select(selects.nth(0), "13:00");
  await demo.select(selects.nth(1), "14:00");
  await demo.select(selects.nth(2), "ONSITE");
  await demo.click(p.getByRole("button", { name: "🚀 ส่งข้อมูลให้อาจารย์พิจารณา" }));
  await demo.confirm();
  await waitAppt(st[0].pk, "PENDING_TEACHER");
  await demo.done(`เสนอ ${thaiDay} 13.00–14.00 น. ที่บริษัทแล้ว`);

  // ═══ 2. อาจารย์นัดพร้อมกัน ═══
  await demo.step(2, "teacher", "อาจารย์นัดนิเทศพร้อมกันทั้งบริษัท",
    "แท็บ \"นิเทศตามบริษัท\" รวมนักศึกษาบริษัทเดียวกัน — เลือกวัน ระบบจัดคิวตามเวลาที่แต่ละคนเสนอ ยืนยันครั้งเดียวได้ทั้งกลุ่ม");
  await demo.login("teacher", ACCOUNTS.teacher.email, PASSWORD, FILTER);
  await demo.go("/teacher/review-supervision");
  await demo.click(p.getByRole("button", { name: /🏢 นิเทศตามบริษัท/ }));
  const card = p.locator("div", { has: p.getByText(COMPANY.name, { exact: false }) }).filter({ has: p.getByRole("button", { name: /นัดพร้อมกัน/ }) }).last();
  await demo.click(card.getByText(COMPANY.name).first());
  await demo.wait(800);
  await demo.pause("วันที่นักศึกษาแต่ละคนเสนอ — ทั้ง 3 คนเสนอวันเดียวกัน");
  await demo.click(card.getByRole("button", { name: /นัดพร้อมกัน/ }));
  const modal = p.locator("div").filter({ has: p.getByText(/^นัดพร้อมกัน — /) }).filter({ has: p.locator("select") }).last();
  for (const box of await modal.locator('input[type="checkbox"]').all()) {
    if (!(await box.isChecked()) && (await box.isEnabled())) await demo.click(box);
  }
  await demo.point(modal.getByText("ลำดับคิว"));
  await demo.pause("ลำดับคิวในวันนั้น: 09.00–10.00 · 10.00–11.00 · 13.00–14.00 น. — ไม่มีช่วงไหนทับกัน");
  await demo.click(modal.getByRole("button", { name: /ยืนยัน \(3 คน\)/ }));
  await demo.confirm();
  for (const s of st) await waitAppt(s.pk, "DATE_CONFIRMED");
  await demo.done("ยืนยันวันนิเทศทั้ง 3 คนในครั้งเดียว — นักศึกษาทุกคนได้รับแจ้งเตือน");

  // ═══ 3. เจ้าหน้าที่ออกหนังสือขอนิเทศฉบับรวม ═══
  await demo.step(3, "staff", "ออกหนังสือขอนิเทศฉบับรวมของกลุ่ม",
    "นัดที่ยืนยันพร้อมกันออกหนังสือฉบับเดียว มีรายชื่อนักศึกษาทั้งกลุ่ม");
  await demo.login("staff", ACCOUNTS.staff.email, PASSWORD, FILTER);
  await demo.go("/admin/supervision-manager");
  await demo.type(p.getByPlaceholder("ค้นหา รหัส / ชื่อ / บริษัท / อาจารย์..."), st[0].studentId);
  const row = p.locator(".responsive-table tr", { hasText: st[0].studentId });
  await demo.point(row.getByRole("button", { name: "📄 ออกหนังสือ" }));
  await demo.pause("แถวที่อยู่ในกลุ่มนิเทศมีปุ่ม \"หนังสือรวมทั้งกลุ่ม\" เพิ่มจาก \"ออกหนังสือ\" รายคน");
  await demo.click(row.getByRole("button", { name: /👥 หนังสือรวมทั้งกลุ่ม \(3\)/ }));
  await issueLetter(demo, DOC_NO(31), "signed-file-supervision", "หนังสือขอนิเทศฉบับรวม");
  for (const s of st) await waitAppt(s.pk, "LETTER_UPLOADED");

  await demo.end(`นิเทศ 3 คนในวันเดียว หนังสือฉบับเดียว 🎉\nบัญชีสาธิต (รหัสผ่าน ${PASSWORD}): ${studentEmail("s1")} · ${ACCOUNTS.teacher.email} · ${ACCOUNTS.staff.email}`);
});
