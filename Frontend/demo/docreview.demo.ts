/**
 * ตรวจปุ่ม "ผ่าน" รายฉบับ / "อนุมัติทั้งหมด" ในหน้าตรวจเอกสาร T000 แบบกดมือ (ชั่วคราว — ผู้ใช้สงสัยว่ามีบั๊ก)
 *   DEMO_AUTO=1 DEMO_HEADLESS=1 npx playwright test --config=playwright.demo.config.ts docreview.demo.ts
 */
import { test, type Page } from "@playwright/test";
import { Demo } from "./kit";
import { ACCOUNTS, MAJOR, PASSWORD, prisma, resetDemo, seedBase, seedOpenPeriod, seedReadyStudent } from "./data";

const FILTER = { "coop.adminMajorFilter": MAJOR };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rows: string[] = [];
const log = (s: string) => { rows.push(s); console.log(s); };

test("ผ่านรายฉบับ / อนุมัติทั้งหมด", async ({ page, context }) => {
  test.setTimeout(0);
  const demo = new Demo(context, "ตรวจเอกสาร", 1);
  await demo.init(page);
  const p: Page = page;
  const toasts: string[] = [];
  await context.exposeBinding("__t", (_s, type: string, text: string) => { toasts.push(`[${type}] ${text}`); });
  await context.addInitScript(`(() => { const seen = new WeakSet(); new MutationObserver(() => document.querySelectorAll('[data-toast-type]').forEach((el) => { if (seen.has(el)) return; seen.add(el); window.__t(el.getAttribute('data-toast-type'), (el.textContent||'').replace(/\\s+/g,' ').trim()); })).observe(document, { childList: true, subtree: true }); })();`);
  p.on("response", async (r) => { if (r.url().includes("/api/") && r.status() >= 400) log(`    · ${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, "")} ${(await r.text().catch(() => "")).slice(0, 120)}`); });

  await resetDemo();
  const base = await seedBase();
  const period = await seedOpenPeriod();
  const company = { id: base.companyId, contactId: base.contactId };
  const st = [];
  for (let i = 0; i < 5; i++) st.push(await seedReadyStudent(i, base, period.id, company, "WAITING_FOR_STAFF_CHECK", { t000Status: "PENDING" }, "WAITING"));
  // s3: ผ่านคำร้องแล้วแต่ส่งเอกสารไม่ครบ (2 ฉบับ)
  const s3docs = await prisma.document.findMany({ where: { studentId: st[2].pk }, orderBy: { id: "asc" } });
  await prisma.document.deleteMany({ where: { id: { in: s3docs.slice(2).map((d: { id: number }) => d.id) } } });
  await prisma.studentCoop.update({ where: { studentId: st[2].pk }, data: { status: "QUALIFIED", t000Status: "WAITING" } });

  const coop = async (pk: number) => (await prisma.studentCoop.findUnique({ where: { studentId: pk } }))!;
  const docs = async (pk: number) => prisma.document.findMany({ where: { studentId: pk }, orderBy: { id: "asc" } });
  const noti = async (s: { userId: number }) => (await prisma.notification.findMany({ where: { userId: s.userId }, orderBy: { id: "desc" }, take: 3 })).map((n: { message: string }) => n.message);
  const open = async (s: { studentId: string }) => {
    await demo.go("/admin/doct000");
    await p.getByPlaceholder(/ค้นหา/).first().fill(s.studentId);
    await p.waitForTimeout(600);
    await p.locator("tbody tr", { hasText: s.studentId }).first().getByRole("button", { name: "ตรวจสอบเอกสาร" }).click();
    const m = p.locator(".modal-backdrop").last();
    await m.waitFor();
    await p.waitForTimeout(800);
    return m;
  };
  const report = async (label: string, s: { pk: number; userId: number }) => {
    await sleep(1500);
    const c = await coop(s.pk);
    const d = await docs(s.pk);
    log(`${label}\n    สถานะ ${c.status} · t000Status ${c.t000Status} · comment "${c.t000Comment}"\n    ไฟล์: ${d.map((x: { type: string; status: string }) => `${x.type}=${x.status}`).join(", ")}\n    แจ้งนักศึกษา: ${(await noti(s)).join(" | ") || "-"}\n    toast: ${toasts.splice(0).join(" | ") || "-"}`);
  };

  await demo.login("staff", ACCOUNTS.staff.email, PASSWORD, FILTER);

  // 1. ผ่านทีละฉบับ ความเร็วคน
  {
    const m = await open(st[0]);
    const n = await m.locator(".action-btn.pass").count();
    for (let i = 0; i < n; i++) { await m.locator(".action-btn.pass").nth(i).click(); await p.waitForTimeout(900); }
    await report(`1. s1 กด "ผ่าน" ทีละฉบับ ${n} ฉบับ (เว้น ~1 วินาที)`, st[0]);
    const uiBadge = await m.locator(".action-btn.pass.active").count();
    log(`    ในหน้าต่าง ปุ่มผ่านที่ติดสถานะ ${uiBadge}/${n} · ปุ่มอนุมัติทั้งหมดยังอยู่ ${await m.getByRole("button", { name: "อนุมัติทั้งหมด" }).count()}`);
    await p.keyboard.press("Escape");
    await p.waitForTimeout(800);
    log(`    แถวในรายการ: "${(await p.locator("tbody tr", { hasText: st[0].studentId }).first().innerText()).replace(/\s+/g, " ").slice(0, 160)}"`);
  }
  // 2. ผ่านทีละฉบับ กดเร็ว
  {
    const m = await open(st[1]);
    const n = await m.locator(".action-btn.pass").count();
    for (let i = 0; i < n; i++) await m.locator(".action-btn.pass").nth(i).click();
    await report(`2. s2 กด "ผ่าน" ทีละฉบับเร็ว ๆ ${n} ฉบับ`, st[1]);
    log(`    ในหน้าต่าง ปุ่มผ่านที่ติดสถานะ ${await m.locator(".action-btn.pass.active").count()}/${n}`);
    await p.keyboard.press("Escape");
  }
  // 3. ส่งไม่ครบ → อนุมัติทั้งหมด
  {
    const m = await open(st[2]);
    const btn = m.getByRole("button", { name: "อนุมัติทั้งหมด" });
    log(`3. s3 ส่งเอกสาร 2 ฉบับจากที่ต้องส่ง (สถานะ QUALIFIED) — ปุ่มอนุมัติทั้งหมด ${await btn.count() ? "มี" : "ไม่มี"}`);
    if (await btn.count()) { await btn.click(); await demo.confirm(); }
    await report("   หลังกดอนุมัติทั้งหมด", st[2]);
    await p.keyboard.press("Escape");
  }
  // 4. อนุมัติทั้งหมดปกติ
  {
    const m = await open(st[3]);
    await m.getByRole("button", { name: "อนุมัติทั้งหมด" }).click();
    await demo.confirm();
    await report("4. s4 อนุมัติทั้งหมด (ส่งครบ)", st[3]);
    log(`    ในหน้าต่าง ปุ่มผ่านที่ติดสถานะ ${await m.locator(".action-btn.pass.active").count()}/${await m.locator(".action-btn.pass").count()}`);
    await p.keyboard.press("Escape");
  }
  // 5. ผ่าน 5 ฉบับ → ส่งกลับแก้ 1 ฉบับ → เปลี่ยนใจกดผ่านฉบับนั้น
  {
    const m = await open(st[4]);
    const n = await m.locator(".action-btn.pass").count();
    for (let i = 0; i < n - 1; i++) { await m.locator(".action-btn.pass").nth(i).click(); await p.waitForTimeout(700); }
    await m.getByPlaceholder("ระบุเหตุผล (กรณีแก้ไข/ไม่ผ่าน)").fill("ไฟล์ไม่ชัด");
    await m.locator(".action-btn.edit").nth(n - 1).click();
    await report(`5. s5 ผ่าน ${n - 1} ฉบับ แล้วส่งกลับแก้ฉบับสุดท้าย`, st[4]);
    const m2 = await open(st[4]); // ส่งกลับแก้แล้วหน้าต่างปิด — เปิดใหม่
    await m2.locator(".action-btn.pass").nth(n - 1).click();
    await report("   เปลี่ยนใจ กดผ่านฉบับสุดท้าย", st[4]);
    await p.keyboard.press("Escape");
  }
  // 6. เปิดหน้าต่างของ s4 (อนุมัติแล้ว) ใหม่ — ปุ่มแสดงตรงไหม
  {
    const m = await open(st[3]);
    log(`6. s4 เปิดใหม่หลังอนุมัติทั้งหมด: ปุ่มผ่านติดสถานะ ${await m.locator(".action-btn.pass.active").count()}/${await m.locator(".action-btn.pass").count()} · ข้อความ "${(await m.locator("textarea").first().inputValue().catch(() => ""))}"`);
    await p.keyboard.press("Escape");
  }
  // 7. นักศึกษาเห็นอะไร
  await demo.login("student", st[0].email, PASSWORD);
  await demo.go("/student/docs");
  log(`7. s1 (ผ่านรายฉบับ) หน้าเอกสาร: ${(await p.locator("table.doc-table tbody tr").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").slice(0, 60)).join(" | ")}`);
  await demo.login("student", st[3].email, PASSWORD);
  await demo.go("/student/docs");
  log(`   s4 (อนุมัติทั้งหมด) หน้าเอกสาร: ${(await p.locator("table.doc-table tbody tr").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").slice(0, 60)).join(" | ")}`);
});
