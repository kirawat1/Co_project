/**
 * จำลองกดมือทุกเส้นทาง — เปิด Chrome จริง กดปุ่ม/พิมพ์/เลือกไฟล์ผ่านหน้าเว็บเหมือนคนใช้ (ไม่ยิง API ตรง)
 *
 *   นักศึกษา 5 คน (หลักสูตร DEMO) เดินคนละเส้นทาง:
 *     s1 ผ่าน → T000 ส่งกลับแก้ → แก้แล้วผ่าน → หนังสือรวมกับ s2 → ใบตอบรับถูกตีกลับ → ส่งใหม่ → T002 ถูกตีกลับ → ส่งใหม่ → นิเทศรวม
 *     s2 คำร้องส่งกลับแก้ → ส่งแก้ → ผ่าน → T000 (ลองไฟล์ปลอม/ไฟล์ใหญ่/กดซ้ำ) → หนังสือรวม → นิเทศรวม
 *     s3 คำร้องไม่ผ่าน
 *     s4 รอพิจารณาเกรด → ผ่าน → T000 ไม่ผ่านหนึ่งฉบับ → แก้ → หนังสือเดี่ยว → เจ้าหน้าที่บันทึกใบตอบรับแทน
 *        → นิเทศเดี่ยว + อาจารย์ร่วม (ไม่ว่าง → อาจารย์ปฏิเสธ → เสนอใหม่ → ว่าง → ยืนยัน)
 *     s5 ไม่ยื่นคำร้องเลย
 *   + เรื่องที่เกิดจากการกดมือ: กดซ้ำสองครั้ง · ไม่ใส่เหตุผล · ไฟล์ผิดประเภท/ใหญ่เกิน · รีเฟรช · ย้อนกลับ · สองแท็บ · จอมือถือ
 *
 *   ทุกการกด: เก็บ API ที่ตอบ 4xx/5xx · error ในหน้า · ข้อความแจ้งเตือน (toast) → test-results/uisim-report.json
 *   รัน (ที่ Frontend/): DEMO_AUTO=1 DEMO_HEADLESS=1 npx playwright test --config=playwright.demo.config.ts uisim.demo.ts
 *   ไม่ใส่ DEMO_HEADLESS = เปิดหน้าต่างให้ดูได้ · ข้อมูลเป็นชุด demo.* (ล้างด้วยปุ่มล้างข้อมูลใน node demo.js)
 */
import { test, type Page, type Locator } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { Demo } from "./kit";
import { waitStatus, waitDoc, waitAppt, issueLetter } from "./steps";
import {
  ACCOUNTS, COMPANY, MAJOR, PASSWORD, DOC_NO, isoDay, prisma, resetDemo, seedBase, seedCompany, seedTeacher, samplePdf,
  freeAcademicYear, rememberPeriod, studentsXlsx, adoptImported, type Base,
} from "./data";

const FILTER = { "coop.adminMajorFilter": MAJOR };
const REPORT = path.resolve("test-results/uisim-report.json");

// ═════════════ บันทึกผล ═════════════
interface Check { phase: string; name: string; ok: boolean; detail: string }
interface ApiHit { phase: string; status: number; method: string; url: string; expected: boolean; body?: string }
const R = {
  checks: [] as Check[], api: [] as ApiHit[], pageErrors: [] as string[], consoleErrors: [] as string[],
  toasts: [] as { phase: string; type: string; text: string }[], notes: [] as string[], clicks: 0,
};
let phase = "เริ่ม";
let expecting = false; // ช่วงที่ตั้งใจทำผิด (คาดว่า API ตอบ 4xx)
const check = (name: string, ok: boolean, detail = "") => {
  R.checks.push({ phase, name, ok, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const note = (s: string) => { R.notes.push(`[${phase}] ${s}`); console.log(`  ℹ ${s}`); };
const startPhase = (s: string) => { phase = s; console.log(`\n▶ ${s}`); };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function poll<T>(read: () => Promise<T>, ok: (v: T) => boolean, ms = 20_000) {
  const end = Date.now() + ms;
  let v = await read();
  while (!ok(v) && Date.now() < end) { await sleep(400); v = await read(); }
  return v;
}
const coopOf = (pk: number) => prisma.studentCoop.findUnique({ where: { studentId: pk } });
const statusOf = async (pk: number) => (await coopOf(pk))?.status as string | undefined;
const latestDoc = (pk: number, type: string) => prisma.document.findFirst({ where: { studentId: pk, type }, orderBy: { id: "desc" } });
const notiCount = (userId: number) => prisma.notification.count({ where: { userId } });

/** ข้อความแจ้งเตือนใหม่ตั้งแต่ลำดับ from (รอได้ถึง ms) */
async function waitToast(from: number, types: string[], ms = 8_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const t = R.toasts.slice(from).find((x) => types.includes(x.type));
    if (t) return t;
    await sleep(200);
  }
  return null;
}

/** จับตาทุกหน้าในเบราว์เซอร์: API ที่ตอบ 4xx/5xx · error ในหน้า · console error · toast */
async function watch(page: Page) {
  const ctx = page.context();
  await ctx.exposeBinding("__uisimToast", (_src, type: string, text: string) => {
    R.toasts.push({ phase, type, text });
    if (type === "error" || type === "warning") console.log(`    💬 [${type}] ${text}`);
  });
  await ctx.addInitScript(`(() => {
    if (window.__uisimObs) return; window.__uisimObs = true;
    const seen = new WeakSet();
    const scan = () => document.querySelectorAll('[data-toast-type]').forEach((el) => {
      if (seen.has(el)) return; seen.add(el);
      window.__uisimToast && window.__uisimToast(el.getAttribute('data-toast-type'), (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 240));
    });
    new MutationObserver(scan).observe(document, { childList: true, subtree: true });
  })();`);
  const hook = (p: Page) => {
    p.on("pageerror", (e) => { R.pageErrors.push(`[${phase}] ${p.url()} ${e.message}`); console.log(`    ‼ pageerror ${e.message}`); });
    p.on("console", (m) => {
      if (m.type() !== "error") return;
      const t = m.text();
      // Failed to fetch = คำขอค้างถูกยกเลิกเพราะสคริปต์เปลี่ยนหน้า/สลับบัญชีกลางทาง (คนกดไม่เร็วขนาดนั้น)
      if (/GSI_LOGGER|accounts\.google|Failed to load resource|Failed to fetch/i.test(t)) return; // Google ปุ่มล็อกอินบน localhost · 4xx ที่จับจาก response แล้ว
      R.consoleErrors.push(`[${phase}] ${t.slice(0, 300)}`);
    });
    p.on("response", async (res) => {
      const u = res.url();
      if (!u.includes("/api/") || res.status() < 400) return;
      let body = "";
      try { body = (await res.text()).slice(0, 200); } catch { /* ไม่มี body */ }
      const hit = { phase, status: res.status(), method: res.request().method(), url: u.replace(/^https?:\/\/[^/]+/, ""), expected: expecting, body };
      R.api.push(hit);
      if (!expecting || hit.status >= 500) console.log(`    ${hit.status >= 500 ? "‼" : "·"} ${hit.status} ${hit.method} ${hit.url} ${body.slice(0, 100)}`);
    });
  };
  hook(page);
  ctx.on("page", hook);
}

/** กล่องยืนยันของระบบ (ถ้าขึ้น) — กดปุ่มขวาสุด หรือปุ่มที่ชื่อตรง */
async function confirmIf(page: Page, ms = 2_500, name?: RegExp) {
  // กล่องยืนยัน (ConfirmDialog) ต่างจากหน้าต่าง Modal ที่กล่องข้างในมี animation confirmIn
  const dlg = page.locator('[role="dialog"][aria-modal="true"]:has(> div[style*="confirmIn"])').last();
  try { await dlg.waitFor({ state: "visible", timeout: ms }); } catch { return false; }
  const btn = name ? dlg.getByRole("button", { name }) : dlg.locator("button").last();
  await btn.click();
  await page.waitForTimeout(300);
  return true;
}

/** ตั้งใจทำผิด (เช่น ไม่ใส่เหตุผล) — ต้องมีข้อความเตือน และข้อมูลไม่เปลี่ยน */
async function expectBlocked(name: string, act: () => Promise<void>, unchanged: () => Promise<boolean>) {
  const from = R.toasts.length;
  expecting = true;
  try { await act(); } finally { /* ปิดหลังอ่านผล */ }
  const t = await waitToast(from, ["error", "warning"]);
  await sleep(600);
  expecting = false;
  const same = await unchanged();
  check(name, !!t && same, `${t ? `ระบบแจ้ง "${t.text}"` : "ไม่มีข้อความแจ้งเตือน"}${same ? "" : " · ข้อมูลเปลี่ยนไปแล้ว!"}`);
}

/** วันธรรมดา (จันทร์–ศุกร์) วันแรกที่ห่างจากวันนี้อย่างน้อย n วัน */
function weekday(n: number) {
  for (let d = n; d < n + 7; d++) {
    const iso = isoDay(d);
    const w = new Date(`${iso}T12:00:00+07:00`).getUTCDay();
    if (w !== 0 && w !== 6) return iso;
  }
  return isoDay(n);
}

/** ไฟล์ทดสอบที่ผิด: ข้อความธรรมดาแต่ตั้งชื่อ .pdf · PDF ใหญ่เกิน 50 MB */
function badFiles(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  const fake = path.join(dir, "ใบแสดงผลการเรียน.pdf");
  fs.writeFileSync(fake, "นี่ไม่ใช่ไฟล์ PDF จริง แค่เปลี่ยนนามสกุล\n".repeat(50));
  const big = path.join(dir, "สแกนความละเอียดสูง.pdf");
  if (!fs.existsSync(big)) {
    const head = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1");
    fs.writeFileSync(big, Buffer.concat([head, Buffer.alloc(52 * 1024 * 1024, 0x20), Buffer.from("\n%%EOF\n")]));
  }
  return { fake, big };
}

test("จำลองกดมือทุกเส้นทาง", async ({ page, context }) => {
  test.setTimeout(0);
  const demo = new Demo(context, "จำลองกดมือทุกเส้นทาง", 16);
  await demo.init(page);
  await watch(page);
  const p = page;

  // ═══ 0. เตรียม: บัญชีเจ้าหน้าที่/อาจารย์ + บริษัท (นักศึกษามาจากการนำเข้า Excel ในขั้นที่ 1) ═══
  startPhase("0. เตรียมบัญชีและบริษัท");
  await resetDemo();
  const base: Base = await seedBase();
  const companyA = { id: base.companyId, contactId: base.contactId, name: COMPANY.name };
  const companyB = await seedCompany("บริษัท ตัวอย่างดิจิทัล จำกัด", "สมศรี", base.staffUserId);
  const t2 = await seedTeacher("t2", "อ.", "วิชัย", "ทดสอบร่วม");
  const t2User = (await prisma.user.findUnique({ where: { username: "demo.t2" } }))!;
  const year = await freeAcademicYear();
  const others = await prisma.student.count({ where: { NOT: { major: MAJOR } } });
  note(`นักศึกษาหลักสูตรอื่นในฐานข้อมูล ${others} คน (ข้อมูลจำลอง 100 คนช่วยให้รายการยาวเหมือนจริง)`);
  const bad = badFiles(test.info().outputPath("ไฟล์ผิด"));

  const staff = () => demo.login("staff", ACCOUNTS.staff.email, PASSWORD, FILTER);
  const teacher = () => demo.login("teacher", ACCOUNTS.teacher.email, PASSWORD, FILTER);
  const coTeacher = () => demo.login("teacher", t2.email, PASSWORD);

  // ═══ 1. เจ้าหน้าที่นำเข้ารายชื่อ ═══
  startPhase("1. เจ้าหน้าที่นำเข้ารายชื่อนักศึกษา (Excel)");
  const CLASS = [0, 1, 2, 3, 4];
  await staff();
  await demo.go("/admin/students");
  await demo.files(p.locator('input[type="file"][accept=".xlsx,.xls"]'), studentsXlsx(CLASS));
  await demo.click(p.getByRole("button", { name: "ดูตัวอย่าง", exact: true }));
  await p.getByText(`🟢 สร้างใหม่ ${CLASS.length}`).waitFor();
  await demo.click(p.getByRole("button", { name: "ยืนยันนำเข้า" }));
  await p.getByText(`สร้างใหม่ ${CLASS.length} |`, { exact: false }).first().waitFor();
  const S = [] as Awaited<ReturnType<typeof adoptImported>>[];
  for (const i of CLASS) S.push(await adoptImported(i, base));
  const [s1, s2, s3, s4] = S; // s5 = ไม่ยื่นคำร้อง (ตรวจในสถานะสุดท้าย)
  check("นำเข้า 5 คน ได้บัญชีครบ", S.length === 5);
  // นำเข้าไฟล์เดิมซ้ำ (คนกดซ้ำ) → ต้องเป็น "ข้าม/อัปเดต" ไม่สร้างคนซ้ำ
  await demo.go("/admin/students");
  await demo.files(p.locator('input[type="file"][accept=".xlsx,.xls"]'), studentsXlsx(CLASS));
  await demo.click(p.getByRole("button", { name: "ดูตัวอย่าง", exact: true }));
  await p.waitForTimeout(1500);
  const dupNew = await p.getByText(`🟢 สร้างใหม่ ${CLASS.length}`).count();
  check("นำเข้าไฟล์เดิมซ้ำ ตัวอย่างไม่เป็น \"สร้างใหม่\"", dupNew === 0);
  await p.keyboard.press("Escape");

  // ═══ 2. เปิดรอบ + กำหนดส่ง ═══
  startPhase("2. เจ้าหน้าที่เปิดรอบและตั้งกำหนดส่ง");
  await demo.go("/admin/coop-period");
  await demo.click(p.getByRole("button", { name: "+ สร้างรอบใหม่" }));
  const dlg = p.getByRole("dialog");
  await demo.type(dlg.locator('input.input:not([type="date"])').first(), year);
  const dates = dlg.locator('input[type="date"]');
  await demo.fill(dates.nth(0), isoDay(0));
  await demo.fill(dates.nth(1), isoDay(60));
  await demo.click(p.getByRole("button", { name: "บันทึกข้อมูล" }));
  await p.getByText(`📆 ปฏิทินของรอบ 1/${year}`).waitFor();
  const period = (await prisma.coopPeriod.findFirst({ where: { academicYear: year, semester: 1 } }))!;
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
  const pm = await prisma.coopPeriodMajor.findFirst({ where: { periodId: period.id, major: MAJOR } });
  check("รอบของหลักสูตร DEMO เปิดรับสมัคร", !!pm?.isActive);
  const otherOpened = await prisma.coopPeriodMajor.count({ where: { periodId: period.id, NOT: { major: MAJOR }, isActive: true } });
  check("เปิดรับสมัครหลักสูตร DEMO ไม่เปิดหลักสูตรอื่นตามไปด้วย", otherOpened === 0, `หลักสูตรอื่นที่เปิด ${otherOpened}`);
  // ช่วงนัดนิเทศ (ตั้งตรง — หน้าตั้งช่วงนิเทศมีเทสต์ของตัวเองแล้ว)
  await prisma.coopPeriodMajor.updateMany({ where: { periodId: period.id, major: MAJOR }, data: { isSupervisionOpen: true, supervisionStartDate: new Date(isoDay(1)), supervisionEndDate: new Date(isoDay(120)) } });

  // ═══ 3. นักศึกษาเลือกบริษัท ═══
  startPhase("3. นักศึกษาเลือกบริษัทและผู้ติดต่อ");
  const pickCompany = async (s: typeof s1, search: string, name: string, hr: string) => {
    await demo.login("student", s.email, PASSWORD);
    await demo.go("/student/profile");
    await demo.type(p.getByPlaceholder("พิมพ์ค้นหาชื่อบริษัท..."), search);
    await demo.click(p.getByText(name, { exact: true }).last());
    await demo.wait(800);
    await demo.type(p.getByPlaceholder("พิมพ์ค้นหาเพื่อเลือกผู้ติดต่อ..."), hr);
    await demo.click(p.locator("div").filter({ hasText: new RegExp(`^${hr}`) }).last());
    await p.locator(".contact-chip").first().waitFor();
  };
  await pickCompany(s1, "ตัวอย่างซอฟต์แวร์", companyA.name, COMPANY.hr);
  // รีเฟรชหน้า → บริษัทที่เลือกต้องยังอยู่ (บันทึกอัตโนมัติจริง)
  await p.reload({ waitUntil: "networkidle" });
  check("s1 รีเฟรชหน้าโปรไฟล์ ผู้ติดต่อที่เลือกยังอยู่", (await p.locator(".contact-chip").count()) > 0);
  check("s1 บริษัทในฐานข้อมูลถูกต้อง", (await coopOf(s1.pk))?.companyId === companyA.id);
  await pickCompany(s2, "ตัวอย่างซอฟต์แวร์", companyA.name, COMPANY.hr);
  await pickCompany(s3, "ตัวอย่างซอฟต์แวร์", companyA.name, COMPANY.hr);
  await pickCompany(s4, "ตัวอย่างดิจิทัล", companyB.name, "สมศรี");
  check("s4 เลือกบริษัทที่สอง", (await coopOf(s4.pk))?.companyId === companyB.id);

  // ═══ 4. ยื่นคำร้อง ═══
  startPhase("4. นักศึกษายื่นคำร้อง");
  const fillGateway = async (pg: Page, s: typeof s1) => {
    await pg.getByPlaceholder("เช่น Frontend Developer, System Analyst, Data Scientist...").fill("Software Developer");
    const grade = pg.getByPlaceholder("https://docs.google.com/spreadsheets/d/...");
    if (await grade.count()) await grade.fill("https://docs.google.com/spreadsheets/d/uisim-grade");
    await pg.locator('input[type="file"]').first().setInputFiles(await samplePdf("application", "ใบคำร้องขอเข้าร่วมโครงการสหกิจศึกษา", [`${s.first} ${s.last} รหัส ${s.studentId}`]));
  };
  const SUBMIT = "🚀 ส่งคำร้องขอสหกิจศึกษา";

  // s1: เปิดสองแท็บ กรอกทั้งสองแท็บ ส่งแท็บแรก แล้วส่งแท็บที่สองซ้ำ
  await demo.login("student", s1.email, PASSWORD);
  await demo.go("/student/gateway");
  const tabB = await context.newPage();
  await tabB.goto("/student/gateway", { waitUntil: "networkidle" });
  await fillGateway(p, s1);
  await fillGateway(tabB, s1);
  await demo.click(p.getByRole("button", { name: SUBMIT }));
  await p.getByText("ส่งคำร้องเรียบร้อยแล้ว").first().waitFor();
  check("s1 ส่งคำร้องแล้ว", (await poll(() => statusOf(s1.pk), (v) => v === "APPLYING")) === "APPLYING");
  const appsBefore = await prisma.auditLog.count({ where: { userId: s1.userId } });
  {
    const from = R.toasts.length;
    expecting = true;
    const btnB = tabB.getByRole("button", { name: SUBMIT });
    if (await btnB.isEnabled()) await btnB.click();
    const t = await waitToast(from, ["error", "warning", "success"], 6_000);
    expecting = false;
    const st = await statusOf(s1.pk);
    const appsAfter = await prisma.auditLog.count({ where: { userId: s1.userId } });
    check("s1 แท็บที่สองส่งซ้ำ: ระบบไม่รับซ้ำ สถานะไม่เพี้ยน", st === "APPLYING" && t?.type !== "success",
      `ระบบแจ้ง "${t?.text ?? "-"}" (${t?.type ?? "ไม่มี"}) · บันทึกการใช้งานเพิ่ม ${appsAfter - appsBefore}`);
  }
  await tabB.close();
  // ย้อนกลับ/ไปหน้า แล้วกลับมา — หน้าต้องแสดงสถานะล่าสุด ไม่ขึ้นฟอร์มให้ส่งอีก
  await p.goBack({ waitUntil: "networkidle" }).catch(() => {});
  await p.goForward({ waitUntil: "networkidle" }).catch(() => {});
  await demo.go("/student/gateway");
  const submitBtn = p.getByRole("button", { name: SUBMIT });
  check("s1 กลับมาหน้าคำร้อง ปุ่มส่งปิดอยู่ (ส่งไปแล้ว)", !(await submitBtn.count()) || !(await submitBtn.isEnabled()));

  for (const s of [s2, s3]) {
    await demo.login("student", s.email, PASSWORD);
    await demo.go("/student/gateway");
    await fillGateway(p, s);
    await demo.click(p.getByRole("button", { name: SUBMIT }));
    await p.getByText("ส่งคำร้องเรียบร้อยแล้ว").first().waitFor();
    await waitStatus(s.pk, "APPLYING");
  }
  // s4: ดับเบิลคลิกปุ่มส่ง
  await demo.login("student", s4.email, PASSWORD);
  await demo.go("/student/gateway");
  await fillGateway(p, s4);
  {
    const posts: string[] = [];
    const onReq = (r: import("@playwright/test").Request) => { if (r.method() === "POST" && r.url().includes("/api/")) posts.push(r.url().replace(/^https?:\/\/[^/]+/, "")); };
    p.on("request", onReq);
    const from = R.toasts.length;
    expecting = true;
    await p.getByRole("button", { name: SUBMIT }).dblclick();
    await p.getByText("ส่งคำร้องเรียบร้อยแล้ว").first().waitFor();
    await sleep(1500);
    expecting = false;
    p.off("request", onReq);
    const errs = R.toasts.slice(from).filter((t) => t.type === "error");
    const applyPosts = posts.filter((u) => !/save-form|upload/.test(u));
    check("s4 ดับเบิลคลิกส่งคำร้อง: ส่งครั้งเดียว ไม่มีข้อความผิดพลาด", errs.length === 0 && (await statusOf(s4.pk)) === "APPLYING",
      `POST ${posts.length} ครั้ง (${posts.join(", ")}) · error ${errs.map((e) => e.text).join(" / ") || "ไม่มี"}`);
    if (applyPosts.length > 1) note(`ดับเบิลคลิกแล้ว POST คำร้องซ้ำ ${applyPosts.length} ครั้ง`);
  }
  // s5 ไม่ยื่น

  // ═══ 5. อาจารย์ประจำวิชาพิจารณาคำร้อง ═══
  startPhase("5. อาจารย์ประจำวิชาพิจารณาคำร้อง");
  const REASON_APP = "แนบผลการเรียนไม่ครบทุกภาคการศึกษา กรุณาแนบใหม่ให้ครบ";
  const REASON_FAIL = "หน่วยกิตสะสมยังไม่ถึงเกณฑ์ของหลักสูตร";
  await teacher();
  await demo.click(p.getByRole("button", { name: new RegExp(`จัดการหลักสูตร ${MAJOR}`) }));
  await p.waitForURL("**/admin/dashboard");
  const openApp = async (s: typeof s1) => {
    await demo.go("/admin/coop-applications");
    await demo.type(p.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท..."), s.studentId);
    await demo.click(p.locator("tr", { hasText: s.studentId }).getByRole("button", { name: /ตรวจคำร้อง|ดูคำร้อง|🔍/ }).first());
    await p.getByRole("button", { name: "✅ คำร้องผ่านเกณฑ์" }).waitFor();
  };
  // หลักสูตรอื่นต้องไม่โผล่ในหน้าคำร้องของอาจารย์ประจำวิชา DEMO
  await demo.go("/admin/coop-applications");
  await demo.type(p.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท..."), "6688");
  await p.waitForTimeout(1200);
  check("อาจารย์ประจำวิชา DEMO ไม่เห็นคำร้องของหลักสูตรอื่น (ค้น 6688)", (await p.locator("tbody tr", { hasText: "6688" }).count()) === 0);

  await openApp(s1);
  await demo.click(p.getByRole("button", { name: "✅ คำร้องผ่านเกณฑ์" }));
  await demo.click(p.getByRole("button", { name: "ยืนยัน", exact: true }));
  await waitStatus(s1.pk, "QUALIFIED");
  check("s1 คำร้องผ่าน", true);

  await openApp(s2);
  await expectBlocked("s2 กดส่งกลับแก้โดยไม่ใส่เหตุผล → ระบบไม่ยอม",
    async () => { await p.getByRole("button", { name: "⚠️ ส่งกลับให้แก้ไข" }).click(); await confirmIf(p); },
    async () => (await statusOf(s2.pk)) === "APPLYING");
  // ปิดหน้าต่างกลางทาง (พิมพ์เหตุผลแล้วกด Esc) → ไม่มีอะไรเปลี่ยน
  await p.getByPlaceholder(/ความเห็น\/เหตุผล/).fill("ร่าง… ยังไม่ส่ง");
  await p.keyboard.press("Escape");
  await sleep(800);
  check("s2 พิมพ์เหตุผลแล้วปิดหน้าต่าง สถานะไม่เปลี่ยน", (await statusOf(s2.pk)) === "APPLYING");
  await openApp(s2);
  const commentBox = p.getByPlaceholder(/ความเห็น\/เหตุผล/);
  check("s2 เปิดคำร้องใหม่ ช่องเหตุผลไม่ค้างข้อความที่ยังไม่ได้ส่ง", (await commentBox.inputValue()).trim() === "", `ค่าในช่อง: "${await commentBox.inputValue()}"`);
  await demo.type(commentBox, REASON_APP);
  await demo.click(p.getByRole("button", { name: "⚠️ ส่งกลับให้แก้ไข" }));
  await confirmIf(p);
  await waitStatus(s2.pk, "APPLICATION_EDITS_REQUIRED");
  check("s2 คำร้องส่งกลับแก้", true);

  await openApp(s3);
  await demo.type(p.getByPlaceholder(/ความเห็น\/เหตุผล/), REASON_FAIL);
  await demo.click(p.getByRole("button", { name: "❌ ไม่ผ่าน" }));
  await confirmIf(p);
  await waitStatus(s3.pk, "QUALIFICATION_FAILED");
  check("s3 คำร้องไม่ผ่าน", true);

  await openApp(s4);
  await demo.click(p.getByRole("button", { name: "📊 รอพิจารณาเกรด" }));
  await confirmIf(p);
  await waitStatus(s4.pk, "PENDING_GRADE");
  check("s4 รอพิจารณาเกรด", true);

  // ═══ 6. นักศึกษาเห็นผล + ส่งแก้คำร้อง ═══
  startPhase("6. นักศึกษาเห็นผลคำร้อง · ส่งแก้");
  await demo.login("student", s2.email, PASSWORD);
  await demo.go("/student/gateway");
  check("s2 เห็นเหตุผลที่ให้แก้ในหน้าคำร้อง", (await p.getByText(REASON_APP).count()) > 0);
  await demo.type(p.getByPlaceholder("เช่น Frontend Developer, System Analyst, Data Scientist..."), "Full-stack Developer");
  await demo.click(p.getByRole("button", { name: "📤 ส่งแก้ไขคำร้อง" }));
  await waitStatus(s2.pk, "APPLYING");
  check("s2 ส่งแก้คำร้องแล้ว", (await coopOf(s2.pk))?.jobPosition === "Full-stack Developer", `ตำแหน่ง ${(await coopOf(s2.pk))?.jobPosition}`);

  await demo.login("student", s3.email, PASSWORD);
  await p.waitForTimeout(800);
  const failSeen = (await p.getByText(REASON_FAIL).count()) > 0 || (await (async () => { await demo.go("/student/gateway"); return (await p.getByText(REASON_FAIL).count()) > 0; })());
  check("s3 เห็นว่าไม่ผ่านพร้อมเหตุผล", failSeen);
  await demo.go("/student/docs");
  const t000Upload = await p.locator("table.doc-table tbody tr", { has: p.getByText("📤 แนบไฟล์") }).count();
  check("s3 (ไม่ผ่าน) ส่งเอกสาร T000 ไม่ได้", t000Upload === 0, `แถวที่แนบไฟล์ได้ ${t000Upload}`);

  await teacher();
  for (const s of [s2, s4]) {
    await openApp(s);
    await demo.click(p.getByRole("button", { name: "✅ คำร้องผ่านเกณฑ์" }));
    await demo.click(p.getByRole("button", { name: "ยืนยัน", exact: true }));
    await waitStatus(s.pk, "QUALIFIED");
  }
  check("s2 (หลังแก้) และ s4 (หลังรอเกรด) คำร้องผ่าน", true);

  // ═══ 7. นักศึกษาส่ง T000 ═══
  startPhase("7. นักศึกษากรอกใบสมัครและส่งเอกสาร T000");
  const fillGoal = async () => {
    const goal = p.locator("div", { has: p.getByText("🎯 ระยะเวลาและจุดมุ่งหมาย") }).last();
    const gd = goal.locator('input[type="date"]');
    await demo.fill(gd.nth(0), isoDay(45));
    await demo.fill(gd.nth(1), isoDay(165));
    await demo.type(goal.getByPlaceholder("1.", { exact: true }), "นักพัฒนาซอฟต์แวร์");
    await demo.type(goal.getByPlaceholder("2.", { exact: true }), "นักทดสอบระบบ");
    await sleep(3500); // รอบันทึกอัตโนมัติจริง (demo.wait ถูกเร่งในโหมดอัตโนมัติ)
    return goal;
  };
  const rowsToAttach = () => p.locator("table.doc-table tbody tr", { has: p.getByText("📤 แนบไฟล์") });
  const uploadAll = async (s: typeof s1, tag: string) => {
    for (let i = 0; i < 14; i++) {
      const next = rowsToAttach().first();
      if (!(await next.count())) break;
      const title = (await next.locator("td").first().innerText()).split("\n")[0].trim();
      const row = p.locator("table.doc-table tbody tr", { hasText: title }).first();
      await demo.files(row.locator('input[type="file"]'), await samplePdf(`${tag}-${i}`, title, [`${s.first} ${s.last} รหัส ${s.studentId}`]));
      await demo.click(row.getByRole("button", { name: "🚀 ยืนยันส่งไฟล์" }));
      await row.getByText("⏳ รอตรวจสอบ").first().waitFor();
    }
  };

  // s1: กรอกแล้วรีเฟรช — ข้อมูลที่บันทึกอัตโนมัติต้องอยู่
  await demo.login("student", s1.email, PASSWORD);
  await demo.go("/student/docs");
  await fillGoal();
  await p.reload({ waitUntil: "networkidle" });
  const goal1 = p.locator("div", { has: p.getByText("🎯 ระยะเวลาและจุดมุ่งหมาย") }).last().getByPlaceholder("1.", { exact: true });
  await goal1.waitFor();
  check("s1 รีเฟรชหน้า T000 เป้าหมายที่พิมพ์ยังอยู่ (บันทึกอัตโนมัติ)", (await goal1.inputValue()) === "นักพัฒนาซอฟต์แวร์", `ค่าในช่อง "${await goal1.inputValue()}"`);
  await uploadAll(s1, "s1-t000");
  await waitStatus(s1.pk, "WAITING_FOR_STAFF_CHECK");
  check("s1 ส่ง T000 ครบ", true);

  // s2: ไฟล์ปลอม · ไฟล์ใหญ่เกิน · ดับเบิลคลิก ที่แถวแรก แล้วส่งที่เหลือปกติ
  await demo.login("student", s2.email, PASSWORD);
  await demo.go("/student/docs");
  await fillGoal();
  {
    const first = rowsToAttach().first();
    const title = (await first.locator("td").first().innerText()).split("\n")[0].trim();
    const row = p.locator("table.doc-table tbody tr", { hasText: title }).first();
    const docsNow = () => prisma.document.count({ where: { studentId: s2.pk } });
    const before = await docsNow();
    await expectBlocked(`s2 แนบไฟล์ปลอม (ข้อความตั้งชื่อ .pdf) ที่ "${title}" → ระบบไม่รับ`,
      async () => { await row.locator('input[type="file"]').setInputFiles(bad.fake); await row.getByRole("button", { name: "🚀 ยืนยันส่งไฟล์" }).click(); },
      async () => (await docsNow()) === before);
    await p.reload({ waitUntil: "networkidle" });
    const row2 = p.locator("table.doc-table tbody tr", { hasText: title }).first();
    await expectBlocked(`s2 แนบไฟล์ใหญ่ 52 MB → ระบบไม่รับ พร้อมบอกเหตุผล`,
      async () => { await row2.locator('input[type="file"]').setInputFiles(bad.big); await row2.getByRole("button", { name: "🚀 ยืนยันส่งไฟล์" }).click(); },
      async () => (await docsNow()) === before);
    const bigToast = R.toasts.filter((t) => t.phase === phase && /ใหญ่|ขนาด|MB|เกิน/.test(t.text));
    check("s2 ไฟล์ใหญ่: ข้อความบอกว่าไฟล์ใหญ่เกิน (ไม่ใช่ข้อความกว้างๆ)", bigToast.length > 0, R.toasts.filter((t) => t.phase === phase).map((t) => t.text).join(" / "));
    await p.reload({ waitUntil: "networkidle" });
    const row3 = p.locator("table.doc-table tbody tr", { hasText: title }).first();
    await row3.locator('input[type="file"]').setInputFiles(await samplePdf("s2-t000-0", title, [`${s2.first} ${s2.last}`]));
    const from = R.toasts.length;
    expecting = true;
    await row3.getByRole("button", { name: "🚀 ยืนยันส่งไฟล์" }).dblclick();
    await row3.getByText("⏳ รอตรวจสอบ").first().waitFor();
    await sleep(1500);
    expecting = false;
    const type = (await latestDoc(s2.pk, (await prisma.document.findFirst({ where: { studentId: s2.pk }, orderBy: { id: "desc" } }))!.type))!.type;
    const same = await prisma.document.count({ where: { studentId: s2.pk, type } });
    const errs = R.toasts.slice(from).filter((t) => t.type === "error");
    check(`s2 ดับเบิลคลิกส่งไฟล์: เอกสาร "${title}" มีแถวเดียว`, same === 1, `มี ${same} แถว · error ${errs.map((e) => e.text).join(" / ") || "ไม่มี"}`);
  }
  await uploadAll(s2, "s2-t000");
  await waitStatus(s2.pk, "WAITING_FOR_STAFF_CHECK");
  check("s2 ส่ง T000 ครบ", true);

  await demo.login("student", s4.email, PASSWORD);
  await demo.go("/student/docs");
  await fillGoal();
  await uploadAll(s4, "s4-t000");
  await waitStatus(s4.pk, "WAITING_FOR_STAFF_CHECK");
  check("s4 ส่ง T000 ครบ", true);

  // ═══ 8. เจ้าหน้าที่ตรวจ T000 ═══
  startPhase("8. เจ้าหน้าที่ตรวจเอกสาร T000");
  const REASON_T000 = "สำเนาบัตรประชาชนไม่ชัด กรุณาสแกนใหม่";
  const REASON_T000_FAIL = "เอกสารไม่ใช่ฉบับปัจจุบัน";
  const t000Row = (s: typeof s1) => p.locator("tbody tr", { hasText: s.studentId }).first();
  const openT000 = async (s: typeof s1, button = "ตรวจสอบเอกสาร") => {
    await demo.go("/admin/doct000");
    await demo.type(p.getByPlaceholder(/ค้นหา/).first(), s.studentId);
    await demo.click(t000Row(s).getByRole("button", { name: button }));
    const m = p.locator(".modal-backdrop").last();
    await m.waitFor();
    await p.waitForTimeout(600);
    return m;
  };
  const docAction = async (m: Locator, docName: string, cls: "edit" | "fail" | "pass") => {
    const card = m.locator("div", { has: p.getByText(docName, { exact: true }) }).filter({ has: p.locator(`.action-btn.${cls}`) }).last();
    await demo.click(card.locator(`.action-btn.${cls}`));
    await confirmIf(p, 1_500);
  };
  await staff();
  {
    const target = (await prisma.document.findFirst({ where: { studentId: s1.pk, NOT: { type: "APPLICATION_DOC" } }, orderBy: { id: "asc" } }))!;
    const m = await openT000(s1);
    await demo.click(m.getByText(target.name, { exact: true }));
    await expectBlocked("s1 กด \"ส่งกลับแก้ไข\" เอกสาร T000 โดยไม่ใส่เหตุผล → ระบบไม่ยอม",
      () => docAction(m, target.name, "edit"),
      async () => (await prisma.document.findUnique({ where: { id: target.id } }))?.status === "WAITING");
    await demo.type(m.getByPlaceholder("ระบุเหตุผล (กรณีแก้ไข/ไม่ผ่าน)"), REASON_T000);
    await docAction(m, target.name, "edit");
    await waitDoc(s1.pk, target.type, "EDITS_REQUIRED");
    await waitStatus(s1.pk, "EDITS_REQUIRED");
    const back = await prisma.document.findUnique({ where: { id: target.id } });
    const c1 = await coopOf(s1.pk);
    check("s1 เอกสาร T000 ส่งกลับแก้ พร้อมเหตุผล", back?.status === "EDITS_REQUIRED" && c1?.t000Comment === REASON_T000, `เหตุผลที่บันทึก "${c1?.t000Comment}"`);
    await p.keyboard.press("Escape");
  }
  {
    const target = (await prisma.document.findFirst({ where: { studentId: s4.pk, NOT: { type: "APPLICATION_DOC" } }, orderBy: { id: "asc" } }))!;
    const m = await openT000(s4);
    await demo.click(m.getByText(target.name, { exact: true }));
    await demo.type(m.getByPlaceholder("ระบุเหตุผล (กรณีแก้ไข/ไม่ผ่าน)"), REASON_T000_FAIL);
    await docAction(m, target.name, "fail");
    await waitDoc(s4.pk, target.type, "REJECTED");
    note(`s4 หลังให้ "ไม่ผ่าน" หนึ่งฉบับ สถานะนักศึกษา = ${await statusOf(s4.pk)}`);
    await p.keyboard.press("Escape");
  }
  {
    const m = await openT000(s2);
    await demo.click(m.getByRole("button", { name: "อนุมัติทั้งหมด" }));
    await demo.confirm();
    await waitStatus(s2.pk, "DOCS_APPROVED");
    await p.keyboard.press("Escape");
    await p.waitForTimeout(800);
    const btn = t000Row(s2).getByRole("button", { name: "ออกหนังสือขอความอนุเคราะห์" });
    check("s2 อนุมัติทั้งหมด → แถวในรายการเปลี่ยนเป็นปุ่มออกหนังสือทันที (ไม่ต้องรีเฟรช)", (await btn.count()) > 0);
  }

  // ═══ 9. นักศึกษาแก้เอกสาร → เจ้าหน้าที่ตรวจซ้ำ ═══
  startPhase("9. นักศึกษาแก้เอกสาร T000 · ตรวจซ้ำ");
  const fixDoc = async (s: typeof s1, reason: string, label: RegExp) => {
    await demo.login("student", s.email, PASSWORD);
    await p.waitForTimeout(800);
    check(`${s.key} เห็นเหตุผลบนหน้าแรก`, (await p.getByText(reason).count()) > 0);
    await demo.go("/student/docs");
    const target = (await prisma.document.findFirst({ where: { studentId: s.pk, status: { in: ["EDITS_REQUIRED", "REJECTED"] } } }))!;
    // แถวในหน้าเอกสารหาจากชื่อหัวข้อ (ชื่อไฟล์หายไปจากแถวหลังลบไฟล์เดิม)
    const title = (await prisma.documentRequirement.findFirst({ where: { docKey: target.type! } }))?.title ?? target.name;
    const fixRow = p.locator("table.doc-table tbody tr", { hasText: title }).first();
    await fixRow.getByText(label).first().waitFor();
    await demo.click(fixRow.locator("button.icon-btn"));
    await demo.confirm();
    const attach = fixRow.getByText(/📤 แนบไฟล์|🔄 ส่งไฟล์แก้ไข/);
    await attach.waitFor();
    await demo.files(fixRow.locator('input[type="file"]'), await samplePdf(`${s.key}-fixed`, `${title} (ฉบับแก้ไข)`, [`${s.first} ${s.last}`]));
    await demo.click(fixRow.getByRole("button", { name: "🚀 ยืนยันส่งไฟล์" }));
    await waitStatus(s.pk, "WAITING_FOR_STAFF_CHECK");
  };
  await fixDoc(s1, REASON_T000, /รอแก้ไข/);
  await fixDoc(s4, REASON_T000_FAIL, /ไม่ผ่าน|รอแก้ไข/);
  await staff();
  for (const s of [s1, s4]) {
    await demo.go("/admin/doct000");
    await demo.type(p.getByPlaceholder(/ค้นหา/).first(), s.studentId);
    check(`${s.key} รายการแสดงว่า "ส่งแก้ไขแล้ว"`, (await t000Row(s).getByText(/ส่งแก้ไขแล้ว/).count()) > 0);
    const m = await openT000(s);
    await demo.click(m.getByRole("button", { name: "อนุมัติทั้งหมด" }));
    await demo.confirm();
    await waitStatus(s.pk, "DOCS_APPROVED");
    await p.keyboard.press("Escape");
  }
  check("s1, s4 เอกสารผ่านหลังแก้", true);

  // ═══ 10. หนังสือขอความอนุเคราะห์ ═══
  startPhase("10. หนังสือขอความอนุเคราะห์ (เดี่ยว + ออกหลายฉบับ/รวมบริษัทเดียวกัน)");
  await demo.go("/admin/doct000");
  await demo.type(p.getByPlaceholder(/ค้นหา/).first(), s4.studentId);
  await demo.click(t000Row(s4).getByRole("button", { name: "ออกหนังสือขอความอนุเคราะห์" }));
  await issueLetter(demo, DOC_NO(1), "signed-file-dispatch", "หนังสือขอความอนุเคราะห์");
  await waitStatus(s4.pk, "REQ_LETTER_ISSUED");
  check("s4 หนังสือขอความอนุเคราะห์ฉบับเดี่ยว", (await coopOf(s4.pk))?.reqDocNumber === DOC_NO(1), `เลข ${(await coopOf(s4.pk))?.reqDocNumber}`);
  await p.keyboard.press("Escape");

  await demo.go("/admin/doct000");
  await demo.click(p.getByRole("button", { name: "ออกร่างหลายฉบับพร้อมกัน" }));
  const draft = p.locator(".letter-modal-backdrop").last();
  await draft.getByText(/2\. รายชื่อ \(2 \/ 2 คน\)/).waitFor();
  await demo.type(draft.locator("div", { has: p.getByText("เลขเริ่มต้น", { exact: true }) }).locator("input.input").first(), DOC_NO(11));
  await demo.click(draft.getByText(/^PDF — ฉบับละ 1 ไฟล์/));
  const dl = p.waitForEvent("download", { timeout: 180_000 });
  await demo.click(draft.getByRole("button", { name: /จองเลขและโหลด zip/ }));
  const zipPath = test.info().outputPath("ร่างหนังสือ.zip");
  await (await dl).saveAs(zipPath);
  await draft.getByText(/สร้างร่างหนังสือ 1 ฉบับ/).waitFor({ timeout: 180_000 });
  const outDir = test.info().outputPath("ร่าง");
  fs.mkdirSync(outDir, { recursive: true });
  const pdfs: string[] = [];
  for (const [name, data] of Object.entries(unzipSync(fs.readFileSync(zipPath)))) {
    if (!name.toLowerCase().endsWith(".pdf")) continue;
    const f = path.join(outDir, path.basename(name));
    fs.writeFileSync(f, data);
    pdfs.push(f);
  }
  check("ออกร่างหลายฉบับ: s1+s2 บริษัทเดียวกันได้ร่าง 1 ฉบับ", pdfs.length === 1, `ไฟล์ใน zip ${pdfs.length}`);
  await demo.click(draft.locator("button.btn-secondary", { hasText: /^ปิด$/ }));
  await demo.click(p.getByRole("button", { name: "อัปโหลดฉบับลงนามหลายฉบับ" }));
  const signed = p.locator(".letter-modal-backdrop").last();
  await signed.getByText(/3\. หนังสือรอลงนาม \(1 ฉบับ/).waitFor();
  await demo.files(signed.locator('input[type="file"][multiple]'), pdfs);
  await signed.getByText(/มีไฟล์ 1/).waitFor();
  await demo.click(signed.getByRole("button", { name: /^บันทึก 1 ฉบับ/ }));
  await demo.confirm();
  for (const s of [s1, s2]) await waitStatus(s.pk, "REQ_LETTER_ISSUED");
  const n1 = (await coopOf(s1.pk))?.reqDocNumber, n2 = (await coopOf(s2.pk))?.reqDocNumber;
  check("s1, s2 ได้หนังสือฉบับรวมเลขเดียวกัน", !!n1 && n1 === n2, `${n1} / ${n2}`);
  await demo.click(signed.locator("button.btn-secondary", { hasText: /^ปิด$/ }));

  // ═══ 11. ใบตอบรับ ═══
  startPhase("11. ใบตอบรับ (ตีกลับแล้วส่งใหม่ · เจ้าหน้าที่บันทึกแทน · สองแท็บ)");
  const REASON_ACC = "ใบตอบรับไม่มีลายมือชื่อผู้มีอำนาจของบริษัท";
  const uploadAcceptance = async (s: typeof s1, tag: string, download: boolean) => {
    await demo.login("student", s.email, PASSWORD);
    await demo.go("/student/docs");
    const step4 = p.locator("div", { has: p.getByRole("heading", { name: /ขั้นตอนที่ 4/ }) }).last();
    await step4.scrollIntoViewIfNeeded();
    if (download) {
      const popup = context.waitForEvent("page", { timeout: 5_000 }).catch(() => null);
      const dlw = p.waitForEvent("download", { timeout: 5_000 }).catch(() => null);
      await demo.click(step4.getByRole("button", { name: "⬇️ ดาวน์โหลด" }));
      (await popup)?.close().catch(() => {}); await dlw;
      await waitStatus(s.pk, "WAITING_FOR_PLACEMENT_LETTER");
    }
    // ส่งครั้งแรก = ปุ่มเลือกไฟล์ · ถูกตีกลับ = ไฟล์เดิมขึ้นว่าไม่ผ่าน พร้อมปุ่ม "🔄 เปลี่ยนไฟล์"
    const input = download ? p.locator("#upload-acceptance") : p.locator("#upload-acceptance-change");
    await demo.files(input, await samplePdf(tag, "ใบตอบรับนักศึกษาสหกิจศึกษา", [`ยินดีรับ ${s.first} ${s.last}`]));
    await demo.click(step4.getByRole("button", { name: "🚀 ยืนยันส่งไฟล์" }));
    await waitStatus(s.pk, "WAITING_FOR_STAFF_CHECK_LETTER");
  };
  await uploadAcceptance(s1, "acc-s1", true);
  await uploadAcceptance(s2, "acc-s2", true);
  check("s1, s2 ดาวน์โหลดหนังสือแล้วส่งใบตอบรับ", true);

  await staff();
  {
    const m = await openT000(s1, "ตรวจสอบใบตอบรับ");
    const acc = (await latestDoc(s1.pk, "ACCEPTANCE_LETTER")) ?? (await prisma.document.findFirst({ where: { studentId: s1.pk }, orderBy: { id: "desc" } }))!;
    await expectBlocked("s1 ตีกลับใบตอบรับโดยไม่ใส่เหตุผล → ระบบไม่ยอม",
      async () => { await m.locator(".action-btn.edit").first().click(); await confirmIf(p, 1_500); },
      async () => (await statusOf(s1.pk)) === "WAITING_FOR_STAFF_CHECK_LETTER");
    await demo.type(m.getByPlaceholder("ระบุเหตุผล (กรณีแก้ไข/ไม่ผ่าน)"), REASON_ACC);
    await demo.click(m.locator(".action-btn.edit").first());
    await confirmIf(p, 1_500);
    const st = await poll(() => statusOf(s1.pk), (v) => v !== "WAITING_FOR_STAFF_CHECK_LETTER");
    check("s1 ใบตอบรับถูกตีกลับ (นักศึกษาต้องส่งใหม่)", st === "WAITING_FOR_PLACEMENT_LETTER", `สถานะ ${st} · ไฟล์ ${acc?.type}`);
    await p.keyboard.press("Escape");
  }
  await demo.login("student", s1.email, PASSWORD);
  await p.waitForTimeout(800);
  check("s1 เห็นเหตุผลที่ใบตอบรับถูกตีกลับ", (await p.getByText(REASON_ACC).count()) > 0 || (await (async () => { await demo.go("/student/docs"); return (await p.getByText(REASON_ACC).count()) > 0; })()));
  await uploadAcceptance(s1, "acc-s1-new", false);
  check("s1 ส่งใบตอบรับใหม่", true);

  await staff();
  for (const s of [s1, s2]) {
    // s2: เปิดหน้าต่างตรวจค้างไว้อีกแท็บก่อน แล้วกดผ่านซ้ำหลังแท็บแรกผ่านไปแล้ว
    let stale: Page | null = null;
    if (s === s2) {
      stale = await context.newPage();
      await stale.goto("/admin/doct000", { waitUntil: "networkidle" });
      await stale.getByPlaceholder(/ค้นหา/).first().fill(s.studentId);
      await stale.locator("tbody tr", { hasText: s.studentId }).first().getByRole("button", { name: "ตรวจสอบใบตอบรับ" }).click();
      await stale.locator(".modal-backdrop").last().waitFor();
      await p.bringToFront();
    }
    const m = await openT000(s, "ตรวจสอบใบตอบรับ");
    await demo.click(m.locator(".action-btn.pass").first());
    await demo.confirm();
    await waitStatus(s.pk, "ACCEPTANCE_CHECKED");
    await p.keyboard.press("Escape");
    if (stale) {
      const from = R.toasts.length;
      expecting = true;
      await stale.locator(".modal-backdrop").last().locator(".action-btn.pass").first().click();
      await confirmIf(stale, 2_000);
      await sleep(1500);
      expecting = false;
      const st = await statusOf(s.pk);
      const ts = R.toasts.slice(from);
      check("s2 แท็บเก่ากดผ่านใบตอบรับซ้ำ: สถานะไม่ถอยหลัง ไม่มี error 5xx", st === "ACCEPTANCE_CHECKED", `สถานะ ${st} · แจ้ง ${ts.map((t) => `[${t.type}] ${t.text}`).join(" / ") || "ไม่มี"}`);
      await stale.close();
    }
  }
  // s4: บริษัทส่งใบตอบรับถึงวิทยาลัยโดยตรง — เจ้าหน้าที่บันทึกแทน
  await demo.go("/admin/doct000");
  await demo.type(p.getByPlaceholder(/ค้นหา/).first(), s4.studentId);
  await demo.click(t000Row(s4).getByRole("button", { name: "บันทึกใบตอบรับจากบริษัท" }));
  const recv = p.getByRole("dialog").filter({ hasText: "บันทึกใบตอบรับที่ได้รับจากบริษัทโดยตรง" }).last();
  await demo.files(recv.locator('input[type="file"]'), await samplePdf("acc-s4", "ใบตอบรับ (บริษัทส่งทางอีเมล)", [`ยินดีรับ ${s4.first} ${s4.last}`]));
  await demo.type(recv.getByPlaceholder("เช่น บริษัทส่งทางอีเมล / ไปรษณีย์"), "บริษัทส่งทางอีเมลถึงงานสหกิจ");
  await demo.click(recv.getByRole("button", { name: "บันทึก", exact: true }));
  await confirmIf(p, 1_500);
  await waitStatus(s4.pk, "ACCEPTANCE_CHECKED");
  check("s4 เจ้าหน้าที่บันทึกใบตอบรับแทน", true);

  // ═══ 12. หนังสือส่งตัว → เริ่มฝึกงาน ═══
  startPhase("12. หนังสือส่งตัว · นักศึกษาเริ่มฝึกงาน");
  for (const [s, n] of [[s1, 2], [s2, 3], [s4, 4]] as const) {
    await demo.go("/admin/doct000");
    await demo.type(p.getByPlaceholder(/ค้นหา/).first(), s.studentId);
    await demo.click(t000Row(s).getByRole("button", { name: "ออกหนังสือส่งตัว" }));
    await issueLetter(demo, DOC_NO(n), "signed-file-placement", "หนังสือส่งตัว");
    await waitStatus(s.pk, "PLACEMENT_LETTER_ISSUED");
    await p.keyboard.press("Escape");
  }
  for (const s of [s1, s2, s4]) {
    await demo.login("student", s.email, PASSWORD);
    await demo.go("/student/docs");
    const placeCard = p.locator("div", { has: p.getByRole("heading", { name: /หนังสือส่งตัว \(Placement Letter\)/ }) })
      .filter({ has: p.getByRole("button", { name: /ดาวน์โหลด/ }) }).last();
    await demo.openPopupPdf(placeCard.getByRole("button", { name: /ดาวน์โหลด/ }), "หนังสือส่งตัว");
    await waitStatus(s.pk, "INTERNSHIP_STARTED");
  }
  check("s1, s2, s4 เริ่มฝึกงาน", true);
  await demo.login("student", s1.email, PASSWORD);
  await p.waitForTimeout(1000);
  // นับถอยหลัง = "T000 … เหลือ N วัน" ติดกัน (แถบปฏิทินกำหนดส่งที่ขึ้น "ส่งแล้ว" ไม่นับ)
  const bodyText = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  const cd = bodyText.match(/T000[^·|]{0,40}?(เหลือ|อีก)\s*\d+\s*วัน/g) ?? [];
  check("s1 หน้าแรกไม่นับถอยหลัง T000 แล้ว (ฝึกงานอยู่)", cd.length === 0, cd.join(" | "));

  // ═══ 13. T002 / T003 ═══
  startPhase("13. T002 / T003 (ตีกลับแล้วส่งใหม่)");
  const REASON_T002 = "ลักษณะงานสั้นเกินไป กรุณาอธิบายงานที่ได้รับมอบหมายให้ชัดเจน";
  const sendT002 = async (s: typeof s1, tag: string, again = false) => {
    await demo.go("/student/docs-t002");
    await demo.type(p.getByPlaceholder("อธิบายลักษณะงานที่ได้รับมอบหมายพอสังเขป..."), `พัฒนาระบบเว็บ (${tag})`);
    await sleep(1500);
    // ถูกตีกลับ = ไฟล์เดิมขึ้นว่าไม่ผ่าน พร้อมปุ่มเปลี่ยนไฟล์
    await demo.files(p.locator(again ? "#upload-t002-change" : "#upload-t002"), await samplePdf(tag, "T002 แบบแจ้งรายละเอียดงาน", [`${s.first} ${s.last}`]));
    await demo.click(p.getByRole("button", { name: /ยืนยันส่งไฟล์ T002/ }));
    await waitDoc(s.pk, "T002_FORM", "WAITING");
  };
  const sendT003 = async (s: typeof s1, tag: string) => {
    await demo.go("/student/docs-t003");
    await demo.files(p.locator("#upload-t003"), await samplePdf(tag, "T003 โครงร่างรายงาน", [`${s.first} ${s.last}`]));
    await demo.click(p.getByRole("button", { name: /ยืนยันส่งไฟล์ T003/ }));
    await waitDoc(s.pk, "T003_FORM", "WAITING");
  };
  for (const s of [s1, s2, s4]) {
    await demo.login("student", s.email, PASSWORD);
    await sendT002(s, `t002-${s.key}`);
    await sendT003(s, `t003-${s.key}`);
  }
  check("s1, s2, s4 ส่ง T002 และ T003", true);
  await teacher();
  const openForm = async (pathName: string, s: typeof s1) => {
    await demo.go(pathName);
    await demo.type(p.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท..."), s.studentId);
    await demo.click(p.locator("tr", { hasText: s.studentId }).getByRole("button", { name: /🔍 (ตรวจเอกสาร|พิจารณา)/ }));
    await p.waitForTimeout(800);
  };
  await openForm("/teacher/review-t002", s1);
  await expectBlocked("s1 ตีกลับ T002 โดยไม่ใส่เหตุผล → ระบบไม่ยอม",
    async () => { await p.getByRole("button", { name: "❌ ตีกลับให้แก้ไข" }).click(); await confirmIf(p, 1_500); },
    async () => (await latestDoc(s1.pk, "T002_FORM"))?.status === "WAITING");
  await demo.type(p.locator(".review-sidebar textarea").first(), REASON_T002);
  await demo.click(p.getByRole("button", { name: "❌ ตีกลับให้แก้ไข" }));
  await confirmIf(p, 1_500);
  const t002st = await poll(async () => (await latestDoc(s1.pk, "T002_FORM"))?.status, (v) => v !== "WAITING");
  check("s1 T002 ถูกตีกลับ", t002st !== "WAITING", `สถานะเอกสาร ${t002st}`);
  for (const s of [s2, s4]) {
    await openForm("/teacher/review-t002", s);
    await demo.click(p.locator(".btn-success").last());
    await demo.confirm();
    await waitDoc(s.pk, "T002_FORM", "APPROVED");
  }
  for (const s of [s1, s2, s4]) {
    await openForm("/teacher/review-t003", s);
    await demo.click(p.locator(".btn-success").last());
    await demo.confirm();
    await waitDoc(s.pk, "T003_FORM", "APPROVED");
  }
  check("T003 ผ่าน 3 คน · T002 ผ่าน s2, s4", true);
  await demo.login("student", s1.email, PASSWORD);
  await p.waitForTimeout(800);
  check("s1 เห็นเหตุผลที่ T002 ถูกตีกลับ", (await p.getByText(REASON_T002).count()) > 0 || (await (async () => { await demo.go("/student/docs-t002"); return (await p.getByText(REASON_T002).count()) > 0; })()));
  await sendT002(s1, "t002-s1-new", true);
  await teacher();
  await openForm("/teacher/review-t002", s1);
  await demo.click(p.locator(".btn-success").last());
  await demo.confirm();
  await waitDoc(s1.pk, "T002_FORM", "APPROVED");
  check("s1 T002 ส่งใหม่แล้วผ่าน", true);

  // ═══ 14. นัดนิเทศ ═══
  startPhase("14. นัดนิเทศ (รวมบริษัท · เดี่ยว + อาจารย์ร่วม · ปฏิเสธแล้วเสนอใหม่)");
  const D1 = weekday(20), D2 = weekday(27), D3 = weekday(34);
  const propose = async (s: typeof s1, day: string, from: string, to: string) => {
    await demo.login("student", s.email, PASSWORD);
    await demo.go("/student/supervision");
    const slot = p.locator("div").filter({ has: p.getByText("ตัวเลือก 1", { exact: true }) }).filter({ has: p.locator("select") }).last();
    await demo.fill(slot.locator('input[type="date"]').first(), day);
    const sel = slot.locator("select");
    await demo.select(sel.nth(0), from);
    await demo.select(sel.nth(1), to);
    await demo.select(sel.nth(2), "ONSITE");
    await demo.click(p.getByRole("button", { name: "🚀 ส่งข้อมูลให้อาจารย์พิจารณา" }));
    await demo.confirm();
    await waitAppt(s.pk, "PENDING_TEACHER");
  };
  await propose(s1, D1, "09:00", "10:00");
  await propose(s2, D1, "10:00", "11:00");
  await propose(s4, D2, "13:00", "14:00");
  check("s1, s2 เสนอวันเดียวกันคนละเวลา · s4 เสนอวันของตัวเอง", true);

  // อาจารย์ประจำวิชามอบหมายอาจารย์ร่วมให้ s4
  await teacher();
  await demo.go("/teacher/review-supervision");
  await demo.click(p.getByRole("button", { name: /🗂️ ทั้งหมด/ }));
  await demo.type(p.getByPlaceholder("ค้นหา รหัส / ชื่อ / บริษัท / อาจารย์...").first(), s4.studentId);
  await demo.click(p.locator("tr", { hasText: s4.studentId }).getByRole("button", { name: /มอบหมายอาจารย์ร่วม|อาจารย์ร่วม/ }).first());
  await demo.click(p.locator("label", { hasText: t2.name }).locator('input[type="checkbox"]'));
  await demo.click(p.getByRole("button", { name: "💾 บันทึก" }));
  const appt4 = () => prisma.supervisionAppointment.findFirst({ where: { studentId: s4.pk }, orderBy: { id: "desc" }, include: { coTeachers: true } });
  check("s4 มีอาจารย์ร่วม", (await poll(async () => (await appt4())?.coTeachers.length ?? 0, (v) => v > 0)) === 1);

  // คนเห็นคำเตือน "มีนัดนิเทศรอคุณในรอบอื่น" แล้วกด "ดูทุกปีการศึกษา"
  const showOtherRounds = async (who: string) => {
    const warn = p.getByText(/มีนัดนิเทศรอคุณในรอบอื่น/);
    await warn.first().waitFor({ timeout: 4_000 }).catch(() => {});
    if (await warn.count()) {
      check(`${who} เห็นคำเตือนว่ามีนัดรอในรอบอื่น`, true);
      await demo.click(p.getByRole("button", { name: "ดูทุกปีการศึกษา" }));
    }
  };
  // อาจารย์ร่วม: ไม่ว่างวันที่เสนอ
  await coTeacher();
  // อาจารย์/เจ้าหน้าที่ไม่มีกล่องแจ้งเตือน (ตั้งใจ) — ดูงานจากตัวเลขงานค้างบนเมนู (/api/notifications/pending)
  const coPending = await p.evaluate(async () => {
    const r = await fetch("/api/notifications/pending", { headers: { Authorization: `Bearer ${localStorage.getItem("coop.token")}` } });
    return (await r.json())?.pending?.teacherSupervision ?? 0;
  });
  check("อาจารย์ร่วมเห็นงานค้างบนเมนู (ต้องระบุวันว่าง)", coPending >= 1, `teacherSupervision = ${coPending}`);
  await demo.go("/teacher/review-supervision");
  await showOtherRounds("อาจารย์ร่วม");
  await demo.click(p.locator("tr", { hasText: s4.studentId }).getByRole("button", { name: /ระบุวันว่าง/ }));
  await demo.click(p.getByRole("button", { name: /บันทึก — ไม่ว่างทุกวันที่เสนอ/ }));
  await poll(async () => (await appt4())?.coTeachers[0]?.availableDates, (v) => v != null);
  check("อาจารย์ร่วมตอบว่าไม่ว่าง", (await appt4())?.coTeachers[0]?.availableDates != null, `availableDates=${(await appt4())?.coTeachers[0]?.availableDates}`);

  // อาจารย์หลัก: เลือกวัน → ระบบเตือนอาจารย์ร่วมไม่ว่าง → ยกเลิก → ปฏิเสธ (ไม่ใส่เหตุผลก่อน)
  const REASON_SUP = "อาจารย์นิเทศร่วมไม่ว่างวันนั้น ขอวันใหม่";
  await teacher();
  const openSup = async (s: typeof s1) => {
    await demo.go("/teacher/review-supervision");
    await showOtherRounds("อาจารย์ที่ปรึกษา");
    await demo.type(p.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท...").first(), s.studentId);
    await demo.click(p.locator("tr", { hasText: s.studentId }).getByRole("button", { name: "พิจารณาวันนิเทศ" }));
  };
  await openSup(s4);
  expecting = true; // server ตอบ 409 CO_TEACHER_UNAVAILABLE ก่อนถามซ้ำ — เป็นขั้นตอนปกติ
  await demo.click(p.getByRole("button", { name: "เลือกวันนี้" }).first());
  await confirmIf(p, 3_000, /ยืนยันวันนี้/);
  {
    const warn = p.locator('[role="dialog"][aria-modal="true"]').filter({ hasText: "อาจารย์นิเทศร่วมอาจไม่สะดวก" });
    const shown = await warn.waitFor({ timeout: 8_000 }).then(() => true).catch(() => false);
    check("s4 เลือกวันที่อาจารย์ร่วมไม่ว่าง → ระบบเตือนก่อน", shown);
    if (shown) await warn.getByRole("button", { name: /ยกเลิก/ }).click();
    await sleep(600);
    expecting = false;
    check("s4 กดยกเลิกที่คำเตือน → ยังไม่ยืนยันวัน", (await waitAppt(s4.pk, "PENDING_TEACHER").then(() => true).catch(() => false)));
  }
  await expectBlocked("s4 ปฏิเสธวันนิเทศโดยไม่ใส่เหตุผล → ระบบไม่ยอม",
    async () => { await p.getByRole("button", { name: "ปฏิเสธให้เลือกวันใหม่" }).click(); await confirmIf(p, 1_500); },
    async () => (await appt4())?.status === "PENDING_TEACHER");
  await demo.type(p.getByPlaceholder("เช่น ขอเลื่อนเป็นสัปดาห์หน้า..."), REASON_SUP);
  await demo.click(p.getByRole("button", { name: "ปฏิเสธให้เลือกวันใหม่" }));
  await confirmIf(p, 2_000);
  await waitAppt(s4.pk, "TEACHER_REJECTED");
  check("s4 อาจารย์ปฏิเสธวันพร้อมเหตุผล", true);

  // นักศึกษาเห็นขั้นถัดไป "เสนอวันใหม่" → เสนอใหม่
  await demo.login("student", s4.email, PASSWORD);
  await p.waitForTimeout(800);
  check("s4 หน้าแรกบอกให้เสนอวันใหม่", (await p.getByText(/เสนอวันใหม่/).count()) > 0);
  await propose(s4, D3, "13:00", "14:00");
  const a4 = await appt4();
  check("s4 เสนอวันใหม่แล้ว อาจารย์ร่วมยังอยู่", (a4?.coTeachers.length ?? 0) === 1, `อาจารย์ร่วม ${a4?.coTeachers.length} · วันว่างเดิม ${a4?.coTeachers[0]?.availableDates}`);

  await coTeacher();
  await demo.go("/teacher/review-supervision");
  await showOtherRounds("อาจารย์ร่วม (รอบสอง)");
  await demo.click(p.locator("tr", { hasText: s4.studentId }).getByRole("button", { name: /ระบุวันว่าง|แก้วันว่าง/ }));
  const freeBox = p.locator('label:has(input[type="checkbox"])').first();
  await demo.click(freeBox.locator('input[type="checkbox"]'));
  await demo.click(p.getByRole("button", { name: /บันทึกวันว่าง \(1 วัน\)/ }));
  await poll(async () => (await appt4())?.coTeachers[0]?.availableDates ?? "", (v) => String(v).includes(D3));
  check("อาจารย์ร่วมติ๊กว่างวันใหม่", String((await appt4())?.coTeachers[0]?.availableDates ?? "").includes(D3));

  await teacher();
  await openSup(s4);
  await demo.click(p.getByRole("button", { name: "เลือกวันนี้" }).first());
  await confirmIf(p, 3_000, /ยืนยันวันนี้/);
  const extra = await confirmIf(p, 2_500, /ยืนยันวันนี้/);
  if (extra) note("อาจารย์ร่วมว่างแล้วแต่ระบบยังถามซ้ำ");
  await waitAppt(s4.pk, "DATE_CONFIRMED");
  check("s4 ยืนยันวันนิเทศ (อาจารย์ร่วมว่าง)", !extra);

  // นิเทศรวม s1 + s2
  await demo.go("/teacher/review-supervision");
  await demo.click(p.getByRole("button", { name: /🏢 นิเทศตามบริษัท/ }));
  const gcard = p.locator("div", { has: p.getByText(companyA.name, { exact: false }) }).filter({ has: p.getByRole("button", { name: /นัดพร้อมกัน/ }) }).last();
  await demo.click(gcard.getByText(companyA.name).first());
  await demo.click(gcard.getByRole("button", { name: /นัดพร้อมกัน/ }));
  const gm = p.locator("div").filter({ has: p.getByText(/^นัดพร้อมกัน — /) }).filter({ has: p.locator("select") }).last();
  for (const box of await gm.locator('input[type="checkbox"]').all()) {
    if (!(await box.isChecked()) && (await box.isEnabled())) await demo.click(box);
  }
  await demo.click(gm.getByRole("button", { name: /ยืนยัน \(2 คน\)/ }));
  await demo.confirm();
  for (const s of [s1, s2]) await waitAppt(s.pk, "DATE_CONFIRMED");
  const g1 = await prisma.supervisionAppointment.findFirst({ where: { studentId: s1.pk }, orderBy: { id: "desc" } });
  const g2 = await prisma.supervisionAppointment.findFirst({ where: { studentId: s2.pk }, orderBy: { id: "desc" } });
  check("s1, s2 นัดพร้อมกัน วันเดียวกัน คนละเวลา", !!g1?.confirmedDate && !!g2?.confirmedDate && g1.confirmedDate.getTime() !== g2.confirmedDate.getTime()
    && g1.confirmedDate.toISOString().slice(0, 10) === g2.confirmedDate.toISOString().slice(0, 10), `${g1?.confirmedDate?.toISOString()} / ${g2?.confirmedDate?.toISOString()}`);

  // เจ้าหน้าที่ออกหนังสือขอนิเทศ: รวมกลุ่ม + เดี่ยว
  await staff();
  await demo.go("/admin/supervision-manager");
  await demo.type(p.getByPlaceholder("ค้นหา รหัส / ชื่อ / บริษัท / อาจารย์..."), s1.studentId);
  await demo.click(p.locator(".responsive-table tr", { hasText: s1.studentId }).getByRole("button", { name: /👥 หนังสือรวมทั้งกลุ่ม \(2\)/ }));
  await issueLetter(demo, DOC_NO(5), "signed-file-supervision", "หนังสือขอนิเทศฉบับรวม");
  for (const s of [s1, s2]) await waitAppt(s.pk, "LETTER_UPLOADED");
  await p.keyboard.press("Escape");
  await demo.go("/admin/supervision-manager");
  await demo.type(p.getByPlaceholder("ค้นหา รหัส / ชื่อ / บริษัท / อาจารย์..."), s4.studentId);
  await demo.click(p.locator(".responsive-table tr", { hasText: s4.studentId }).getByRole("button", { name: "📄 ออกหนังสือ" }));
  await issueLetter(demo, DOC_NO(6), "signed-file-supervision", "หนังสือขอนิเทศ");
  await waitAppt(s4.pk, "LETTER_UPLOADED");
  check("หนังสือขอนิเทศ: ฉบับรวม s1+s2 และฉบับเดี่ยว s4", true);

  // อาจารย์จบนิเทศ
  await teacher();
  for (const s of [s1, s2, s4]) {
    await demo.go("/teacher/review-supervision");
    await demo.click(p.locator("tr", { hasText: s.studentId }).getByRole("button", { name: "🏁 จบนิเทศ" }).first());
    await demo.confirm();
    await waitAppt(s.pk, "COMPLETED");
  }
  check("จบนิเทศ 3 คน", true);
  await demo.login("student", s1.email, PASSWORD);
  await p.waitForTimeout(800);
  check("s1 หน้าแรกบอกขั้นถัดไป \"ไปส่งเล่ม T008\"", (await p.getByText(/ไปส่งเล่ม T008/).count()) > 0);

  // ═══ 15. แบบประเมินการนิเทศ ═══
  startPhase("15. ส่งแบบประเมินการนิเทศ");
  await staff();
  await demo.go("/admin/supervision-eval");
  for (const s of [s1, s4]) {
    const row = p.locator("tr", { hasText: s.studentId }).first();
    await row.waitFor();
    await demo.click(row.getByRole("button", { name: "ส่ง", exact: true }));
    await demo.confirm();
    await row.getByText(/ส่งแล้ว/).waitFor();
  }
  await coTeacher();
  await demo.go("/teacher/review-supervision");
  check("อาจารย์ร่วมเห็นแบบประเมินการนิเทศของ s4", (await p.locator("section", { hasText: "📋 แบบประเมินการนิเทศ" }).count()) > 0);
  note(`อาจารย์ร่วมมีแถวแจ้งเตือน ${await notiCount(t2User.id)} รายการ (อาจารย์ไม่มีกล่องแจ้งเตือน — ใช้ตัวเลขงานค้างบนเมนู)`);

  // ═══ 16. จอมือถือ + สถานะสุดท้าย ═══
  startPhase("16. จอมือถือ · สถานะสุดท้าย");
  await demo.login("student", s1.email, PASSWORD);
  await p.setViewportSize({ width: 390, height: 844 });
  for (const u of ["/student/dashboard", "/student/docs", "/student/docs-t002", "/student/supervision", "/student/doc-t008"]) {
    await p.goto(u, { waitUntil: "networkidle" });
    await p.waitForTimeout(500);
    const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    check(`จอมือถือ ${u} ไม่ล้นแนวนอน`, w.sw <= w.iw + 1, `กว้าง ${w.sw}px / จอ ${w.iw}px`);
  }
  await p.setViewportSize({ width: 1600, height: 900 });
  const final = Object.fromEntries(await Promise.all(S.map(async (s) => [s.key, await statusOf(s.pk)] as const)));
  console.log("\nสถานะสุดท้าย:", final);
  check("สถานะสุดท้ายตรงตามเส้นทาง", final.s1 === "INTERNSHIP_STARTED" && final.s2 === "INTERNSHIP_STARTED" && final.s3 === "QUALIFICATION_FAILED"
    && final.s4 === "INTERNSHIP_STARTED" && final.s5 === "NOT_SUBMITTED", JSON.stringify(final));
});

test.afterAll(async () => {
  const failed = R.checks.filter((c) => !c.ok);
  const unexpected4xx = R.api.filter((a) => !a.expected && a.status < 500);
  const s5xx = R.api.filter((a) => a.status >= 500);
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify({ at: new Date().toISOString(), ...R, summary: {
    checks: R.checks.length, failed: failed.length, unexpected4xx: unexpected4xx.length, server5xx: s5xx.length,
    pageErrors: R.pageErrors.length, consoleErrors: R.consoleErrors.length,
  } }, null, 2));
  console.log(`\n══════════ สรุปการกดมือ ══════════`);
  console.log(`ตรวจ ${R.checks.length} จุด · ไม่ผ่าน ${failed.length} · API 4xx ที่ไม่ได้ตั้งใจ ${unexpected4xx.length} · 5xx ${s5xx.length} · error ในหน้า ${R.pageErrors.length} · console error ${R.consoleErrors.length}`);
  for (const f of failed) console.log(`  ✗ [${f.phase}] ${f.name} — ${f.detail}`);
  for (const a of [...s5xx, ...unexpected4xx]) console.log(`  · [${a.phase}] ${a.status} ${a.method} ${a.url} ${a.body ?? ""}`);
  for (const e of [...R.pageErrors, ...R.consoleErrors]) console.log(`  ‼ ${e}`);
  for (const n of R.notes) console.log(`  ℹ ${n}`);
  console.log(`รายละเอียด: ${REPORT}`);
});
