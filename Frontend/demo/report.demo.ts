/**
 * สาธิตรายงานและส่งออก Excel: Dashboard ภาพรวมของรอบ → ส่งออกรายชื่อนักศึกษา → ส่งออกตารางนิเทศ
 * ไฟล์ที่ดาวน์โหลดเปิดให้ดูบนจอเป็นตาราง (ไม่ต้องมี Excel ในเครื่อง)
 * นักศึกษา 4 คนอยู่คนละขั้น + นัดนิเทศ 2 นัด
 */
import { test } from "@playwright/test";
import { Demo } from "./kit";
import {
  ACCOUNTS, MAJOR, PASSWORD, isoDay, prisma, resetDemo, seedBase, seedCompany, seedOpenPeriod, seedReadyStudent, xlsxToHtml,
} from "./data";

const FILTER = { "coop.adminMajorFilter": MAJOR };

test("สาธิตรายงานและส่งออก Excel", async ({ page, context }) => {
  const demo = new Demo(context, "สาธิต — รายงานและส่งออก Excel", 3);
  await demo.init(page);
  const p = page;

  await resetDemo();
  const base = await seedBase();
  const period = await seedOpenPeriod();
  const companyA = { id: base.companyId, contactId: base.contactId };
  const companyB = await seedCompany("บริษัท ตัวอย่างดิจิทัล จำกัด", "สมศรี", base.staffUserId);
  await seedReadyStudent(0, base, period.id, companyA, "APPLYING");
  await seedReadyStudent(1, base, period.id, companyB, "DOCS_APPROVED");
  const interns = [
    await seedReadyStudent(2, base, period.id, companyA, "INTERNSHIP_STARTED"),
    await seedReadyStudent(3, base, period.id, companyB, "INTERNSHIP_STARTED"),
  ];
  for (const [i, st] of interns.entries()) {
    const day = isoDay(10 + i * 4);
    await prisma.supervisionAppointment.create({ data: {
      studentId: st.pk, teacherId: base.teacherPk, supervisionType: i ? "ONLINE" : "ONSITE",
      status: i ? "DATE_CONFIRMED" : "LETTER_UPLOADED", proposedDates: JSON.stringify([`${day}|09:00-10:00|${i ? "ONLINE" : "ONSITE"}`]),
      confirmedDate: new Date(`${day}T09:00:00+07:00`), confirmedEndDate: new Date(`${day}T10:00:00+07:00`),
      ...(i ? { onlineLink: "https://meet.google.com/demo-coop" } : {}),
    } });
  }
  const out = (name: string) => test.info().outputPath(name);

  await p.goto("/");
  await demo.step(0, null, "เริ่มการสาธิต",
    `รอบ ${period.label} หลักสูตร ${MAJOR} มีนักศึกษา 4 คนอยู่คนละขั้น\n• ยื่นคำร้อง 1 คน · รอออกหนังสือ 1 คน · ฝึกงาน 2 คน\n• นัดนิเทศแล้ว 2 นัด (ที่บริษัท 1 · ออนไลน์ 1)`);
  await demo.done("ข้อมูลตัวอย่างพร้อมแล้ว", "เริ่ม ▶");

  // ═══ 1. ภาพรวมของรอบ ═══
  await demo.step(1, "staff", "ภาพรวมของรอบบนหน้า Dashboard",
    "เลือกรอบปีการศึกษา ตัวเลขและกราฟทั้งหน้าเปลี่ยนตามรอบ — เห็นว่านักศึกษาแต่ละขั้นมีกี่คน");
  await demo.login("staff", ACCOUNTS.staff.email, PASSWORD, FILTER);
  await demo.select(p.locator("select").filter({ has: p.locator('option[value="all"]') }).first(), period.label);
  await demo.wait(1500);
  const overview = p.getByRole("heading", { name: /ภาพรวมระบบ/ });
  await demo.point(overview);
  await demo.pause(`ภาพรวมของรอบ ${period.label} (ตัวกรองหลักสูตรบนแถบบนเป็น ${MAJOR})`);
  await p.mouse.wheel(0, 700);
  await demo.wait(1200);
  await demo.done("ข้อมูลบนหน้า Dashboard นับจากสถานะจริงของนักศึกษา ไม่ต้องกรอกสรุปเอง");

  // ═══ 2. ส่งออกรายชื่อนักศึกษา ═══
  await demo.step(2, "staff", "ส่งออกรายชื่อนักศึกษาเป็น Excel",
    "กด \"Export Excel\" ได้ไฟล์ของรอบที่เลือก — รหัส ชื่อ บริษัท สถานะ อาจารย์ที่ปรึกษา ใช้ทำรายงานต่อได้ทันที");
  await p.mouse.wheel(0, -2000);
  const students = await demo.download(p.getByRole("button", { name: /Export Excel/ }).first(), out("students.xlsx"));
  await demo.showSheet(xlsxToHtml(students), `รายชื่อนักศึกษา รอบ ${period.label}`);
  await demo.done("ไฟล์ .xlsx เปิดด้วย Excel / Google Sheets ได้ทันที");

  // ═══ 3. ส่งออกตารางนิเทศ ═══
  await demo.step(3, "staff", "ส่งออกตารางนิเทศเป็น Excel",
    "หน้าจัดการนิเทศมีปฏิทินและตารางนัดที่ยืนยันแล้ว — ส่งออกไปวางแผนรถ/ตารางอาจารย์ได้");
  await demo.go("/admin/supervision-manager");
  const exportBtn = p.getByRole("button", { name: /Export Excel/ }).first();
  await demo.point(exportBtn);
  const schedule = await demo.download(exportBtn, out("schedule.xlsx"));
  await demo.showSheet(xlsxToHtml(schedule), "ตารางนิเทศ");
  await demo.end("รายงานที่ใช้บ่อยส่งออกได้จากหน้าที่เกี่ยวข้องโดยตรง\nบันทึกการใช้งานและบันทึกประจำวันก็ส่งออก Excel ได้แบบเดียวกัน");
});
