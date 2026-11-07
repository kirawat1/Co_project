/**
 * tests/docsamples.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * สร้างเอกสารทุกแบบจากข้อมูลจริงในระบบ ด้วยตัวสร้างเดียวกับที่หน้าเว็บใช้ (เรียกในเบราว์เซอร์ผ่าน Vite)
 *   นักศึกษา: ใบสมัคร T000 · หนังสือยินยอมผู้ปกครอง · T002 · T003
 *   เจ้าหน้าที่: หนังสือขอความอนุเคราะห์ / ส่งตัว (PDF + Word · เดี่ยว + รวม 2 คน) · หนังสือขอนิเทศ (PDF + Word)
 * ตรวจ: สร้างได้ไม่พัง · PDF จริง (%PDF) มีจำนวนหน้า · Word มีเนื้อหา
 * ไฟล์ทั้งหมดเก็บที่ test-results/doc-samples/ ไว้เปิดดูด้วยตา (ไม่ commit)
 */
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import { WorldKit, prisma, day, type KStudent, type KUser } from "./helpers/worldKit";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../test-results/doc-samples");
const k = new WorldKit("ZD");
test.describe.configure({ mode: "serial" });
let staff: KUser, s1: KStudent, s2: KStudent, P = 0;

const addr = (p: string) => ({ [`${p}AddrNo`]: "123/4", [`${p}Moo`]: "5", [`${p}Soi`]: "มิตรภาพ 8", [`${p}Road`]: "มิตรภาพ", [`${p}SubDistrict`]: "ในเมือง", [`${p}District`]: "เมืองขอนแก่น", [`${p}Province`]: "ขอนแก่น", [`${p}Zipcode`]: "40000" });

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน");
  fs.mkdirSync(OUT, { recursive: true });
  staff = await k.staff();
  P = await k.period(1, { CS: {} });
  const sup = await k.teacher("นิเทศ", { major: "CS" });
  const c = await k.company(`บริษัท ทดสอบเอกสาร ${k.tail} จำกัด`, ["สมศรี"]);
  const common = { major: "CS", periodId: P, companyId: c.id, contactIds: c.contactIds, advisor: sup.pk, phone: "0812345678" };
  s1 = await k.student("one", 1, { ...common, status: "INTERNSHIP_STARTED" });
  s2 = await k.student("two", 2, { ...common, status: "INTERNSHIP_STARTED" });
  for (const [st, first, last] of [[s1, "สมชาย", "ใจดี"], [s2, "สมหญิง", "รักเรียน"]] as const) {
    await prisma.student.update({ where: { id: st.pk }, data: { firstName: first, lastName: last, firstNameEn: "Somchai", lastNameEn: "Jaidee", studentId: st === s1 ? "663380001-1" : "663380002-9" } });
    await prisma.coopApplicationForm.create({ data: {
      studentId: st.pk, contactPhone: "0812345678", contactEmail: "student@kkumail.com", ...addr("contact"),
      emergencyName: "นางมาลี ใจดี", emergencyRelation: "มารดา", emergencyJob: "ค้าขาย", emergencyWorkplace: "ตลาดบางลำภู", emergencyPhone: "0898765432", ...addr("emer"),
      startDate: new Date(`${day(10)}T00:00:00+07:00`), endDate: new Date(`${day(130)}T00:00:00+07:00`),
      careerObjective1: "นักพัฒนาซอฟต์แวร์", careerObjective2: "นักวิเคราะห์ข้อมูล", careerObjective3: "วิศวกรระบบ",
    } });
    await prisma.studentCoop.update({ where: { studentId: st.pk }, data: {
      jobPosition: "นักพัฒนาซอฟต์แวร์ฝึกหัด", actualStartDate: new Date(`${day(10)}T00:00:00+07:00`), actualEndDate: new Date(`${day(130)}T00:00:00+07:00`),
    } });
  }
  await prisma.coopT002Form.create({ data: {
    studentId: s1.pk, companyNameTh: `บริษัท ทดสอบเอกสาร ${k.tail} จำกัด`, companyNameEn: "Doc Test Co., Ltd.", addressNo: "99", road: "ศรีจันทร์", subDistrict: "ในเมือง", district: "เมืองขอนแก่น", province: "ขอนแก่น", zipcode: "40000",
    companyPhone: "043123456", companyEmail: "hr@doctest.co.th", managerName: "นายผู้จัดการ ใหญ่", managerPosition: "กรรมการผู้จัดการ", managerPhone: "043123457", managerEmail: "md@doctest.co.th",
    coordinatorType: "OTHER", coordName: "นางสาวประสาน งาน", coordPosition: "เจ้าหน้าที่บุคคล", coordDept: "ฝ่ายบุคคล", coordPhone: "043123458", coordEmail: "coordinator.longname@doctest-company.co.th",
    supervisorName: "นายพี่เลี้ยง ดูแล", supervisorPosition: "หัวหน้าทีมพัฒนา", supervisorDept: "ฝ่ายไอที", supervisorPhone: "043123459", supervisorEmail: "mentor@doctest.co.th",
    jobPosition: "นักพัฒนาซอฟต์แวร์ฝึกหัด", jobDescription: "พัฒนาเว็บแอปพลิเคชันด้วย React และ Node.js ทดสอบระบบ และเขียนเอกสารประกอบ",
    accomAddrNo: "45", accomRoad: "กลางเมือง", accomSubDistrict: "ในเมือง", accomDistrict: "เมืองขอนแก่น", accomProvince: "ขอนแก่น", accomZipcode: "40000", accommodationPhone: "0811111111",
    emergencyName: "นางมาลี ใจดี", emergencyPhone: "0898765432", ...addr("emer"),
  } });
  await prisma.coopT003Form.create({ data: {
    studentId: s1.pk, reportTitleTh: "ระบบติดตามงานซ่อมบำรุงสำหรับโรงงานขนาดกลาง", reportTitleEn: "Maintenance Tracking System for Medium-sized Factories",
    objectives: "1. ลดเวลาการติดตามงานซ่อม\n2. เก็บประวัติเครื่องจักร", expectedOutcomes: "ระบบที่ใช้งานได้จริงในโรงงาน", significance: "งานซ่อมล่าช้าทำให้สายการผลิตหยุด",
    references: "Pressman, R. Software Engineering.", methodology: "Agile 2 สัปดาห์ต่อรอบ", scope: "เว็บแอปพลิเคชันสำหรับฝ่ายซ่อมบำรุง", otherSuggestions: "-",
    workPlan: [{ task: "ศึกษาระบบเดิม", weeks: [1, 2] }, { task: "ออกแบบฐานข้อมูล", weeks: [3, 4] }, { task: "พัฒนาระบบ", weeks: [5, 6, 7, 8, 9, 10] }, { task: "ทดสอบและส่งมอบ", weeks: [11, 12] }],
  } });
  await prisma.supervisionAppointment.create({ data: {
    studentId: s1.pk, teacherId: sup.pk, proposedDates: "[]", supervisionType: "ONSITE", status: "DATE_CONFIRMED",
    confirmedDate: new Date(`${day(40)}T10:00:00+07:00`), coTeacherName: null,
  } });
});
test.afterAll(async () => { await k.cleanup(); await k.disconnect(); });

/** เรียกตัวสร้างเอกสารในเบราว์เซอร์ → คืนไฟล์เป็น base64 */
async function asUser(page: Page, u: KUser) {
  await page.goto("/");
  await page.evaluate(([tk, uid]) => { localStorage.setItem("coop.token", tk); localStorage.setItem("coop.userId", uid); }, [u.token, String(u.userId)]);
}
function save(name: string, b64: string) {
  const buf = Buffer.from(b64, "base64");
  fs.writeFileSync(path.join(OUT, name), buf);
  return buf;
}
const pdfPages = async (buf: Buffer) => (await PDFDocument.load(buf)).getPageCount();   // pdf-lib บีบรายการหน้า — นับด้วย regex ไม่ได้

test("เอกสารฝั่งนักศึกษา: ใบคำร้อง · ใบสมัคร T000 · หนังสือยินยอมผู้ปกครอง · T002 · T003", async ({ page }) => {
  await asUser(page, s1);
  const out = await page.evaluate(async () => {
    const toB64 = async (blob: Blob) => { const a = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s); };
    const h = { Authorization: `Bearer ${localStorage.getItem("coop.token")}` };
    const profile = await (await fetch("/api/students/me", { headers: h })).json();
    const form = (await (await fetch("/api/docs/my-application", { headers: h })).json());
    const formData = form.data || form.form || form;
    const { createCoopPDF } = await import("/src/utils/pdfGenerator.ts");
    const { createT000PDF } = await import("/src/utils/pdfGeneratorT000.ts");
    const { createParentalConsentPDF } = await import("/src/utils/pdfGeneratorParentalConsent.ts");
    const { createT002PDF } = await import("/src/utils/pdfGeneratorT002.ts");
    const { createT003PDF } = await import("/src/utils/pdfGeneratorT003.ts");
    return {
      request: await toB64((await createCoopPDF(profile, profile.coop?.jobPosition || "นักพัฒนาซอฟต์แวร์")).output("blob")),
      t000: await toB64((await createT000PDF(profile, formData)).output("blob")),
      consent: await toB64((await createParentalConsentPDF(profile, formData)).output("blob")),
      t002: await toB64((await createT002PDF(profile, { ...profile.t002Form })).output("blob")),
      t003: await toB64((await createT003PDF(profile, { ...profile.t003Form, workPlan: profile.t003Form?.workPlan || [] })).output("blob")),
    };
  });
  for (const [name, b64] of Object.entries(out)) {
    const buf = save(`student-${name}.pdf`, b64);
    expect(buf.subarray(0, 4).toString(), name).toBe("%PDF");
    expect(await pdfPages(buf), name).toBeGreaterThan(0);
  }
});

test("หนังสือของเจ้าหน้าที่: ขอความอนุเคราะห์ · ส่งตัว (PDF/Word · เดี่ยว/รวม 2 คน) · ขอนิเทศ (PDF/Word)", async ({ page }) => {
  test.setTimeout(120_000);
  await asUser(page, staff);
  const out = await page.evaluate(async ([periodId, ids]) => {
    const toB64 = async (blob: Blob) => { const a = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s); };
    const h = { Authorization: `Bearer ${localStorage.getItem("coop.token")}` };
    const rows = await (await fetch(`/api/admin/t000/students?coopPeriodId=${periodId}`, { headers: h })).json();
    const list = (Array.isArray(rows) ? rows : rows.data || rows.students || []).filter((r: { id: number }) => ids.includes(r.id));
    list.sort((a: { studentId: string }, b: { studentId: string }) => a.studentId.localeCompare(b.studentId));
    const { buildLetterFiles } = await import("/src/utils/bulkLetterFiles.ts");
    const { loadLetterAssets } = await import("/src/utils/letterAssets.ts");
    const assets = await loadLetterAssets();
    const files: Record<string, string> = {};
    const docDate = new Date().toISOString().slice(0, 10);
    for (const letter of ["REQUEST", "PLACEMENT"] as const) {
      for (const format of ["pdf", "doc"] as const) {
        for (const [tag, students] of [["single", [list[0]]], ["group", list]] as const) {
          const r = await buildLetterFiles({ letter, format, docNumber: "อว 660301.26.6.2/1234", docDate, students, assets });
          for (const [i, f] of r.files.entries()) files[`${letter.toLowerCase()}-${format}-${tag}${i ? "-attach" : ""}.${f.name.split(".").pop()}`] = await toB64(f.blob);
        }
      }
    }
    const sup = await (await fetch(`/api/admin/supervisions?coopPeriodId=${periodId}`, { headers: h })).json();
    const appt = (sup.supervisions || []).find((x: { student?: { id: number }; studentId?: number }) => ids.includes(x.student?.id ?? x.studentId ?? -1));
    const { createSupervisionLetterPDF } = await import("/src/utils/pdfSupervisionLetterGenerator.ts");
    const pdf = await createSupervisionLetterPDF(appt, "อว 660301.26.6.2/5678", docDate, assets.krutUrl, assets.deanName, assets.deanPosition);
    files["supervision-pdf.pdf"] = await toB64(pdf instanceof Blob ? pdf : (pdf as unknown as { output: (t: string) => Blob }).output("blob"));
    return { files, found: list.length, hasAppt: !!appt };
  }, [P, [s1.pk, s2.pk]] as const);
  expect([out.found, out.hasAppt]).toEqual([2, true]);
  for (const [name, b64] of Object.entries(out.files)) {
    const buf = save(`letter-${name}`, b64);
    if (name.endsWith(".pdf")) {
      expect(buf.subarray(0, 4).toString(), name).toBe("%PDF");
      expect(await pdfPages(buf), name).toBeGreaterThan(0);
    } else {
      // Word = MHTML: ส่วน HTML เข้ารหัส base64 — ถอดแล้วต้องมีชื่อ/รหัสนักศึกษา · เก็บ .html ไว้เปิดดู
      const raw = buf.toString("utf8");
      const b64 = raw.split("Content-Location: file:///C:/letter.htm")[1]?.split("------=_NextPart")[0] || "";
      const html = Buffer.from(b64.replace(/\s+/g, ""), "base64").toString("utf8");
      fs.writeFileSync(path.join(OUT, `letter-${name}.html`), html);
      expect(raw.startsWith("MIME-Version: 1.0"), name).toBe(true);
      expect(html, name).toMatch(/663380001-1/);
      expect(html, name).toMatch(/สมชาย/);
      if (name.includes("group")) expect(html, name).toMatch(/663380002-9/);
    }
  }
  expect(Object.keys(out.files).length).toBeGreaterThanOrEqual(9);
});
