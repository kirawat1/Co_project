/**
 * tests/buttons.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * ไล่กดทุกปุ่มของทุกหน้า ทุกบทบาท (เจ้าหน้าที่ · อาจารย์ประจำวิชา · อาจารย์ทั่วไป · นักศึกษาก่อน/ระหว่างฝึก)
 *   - รายชื่อหน้าอ่านจาก A_App / T_App / S_App เอง (หน้าใหม่ถูกกดด้วยอัตโนมัติ)
 *   - กันข้อมูลจริง: คำขอที่ไม่ใช่ GET ถูกตอบแทนด้วย 418 (ไม่ถึง server) · ปุ่มยืนยันลบ/ออกจากระบบไม่กด
 *   - ปุ่มชื่อซ้ำ (แถวในตาราง) กดครั้งเดียว · กดแล้วมีหน้าต่าง = ปิดด้วยปุ่มยกเลิก/Esc · เปลี่ยนหน้า = กลับมา
 *   - ล้มเมื่อ: หน้าเว็บพัง (uncaught error / หน้าว่าง) · API ฝั่ง server ตอบ 5xx
 */
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WorldKit, prisma, type KUser } from "./helpers/worldKit";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/components");
const routesOf = (file: string) => [...fs.readFileSync(path.join(SRC, file), "utf8").matchAll(/path="([^"*:]+)"/g)].map((m) => m[1]);
const k = new WorldKit("ZB");
test.describe.configure({ mode: "serial" });

// ปุ่มที่ไม่กด: ออกจากระบบ (ล้าง token) · ยืนยันการลบ/ทำลาย (เผื่อหลุดการกันคำขอ) · ลิงก์ดาวน์โหลดไฟล์ใหญ่ไม่ใช่ปัญหา
const SKIP = /ออกจากระบบ|logout|ยืนยันลบ|ลบถาวร|ยืนยันลบถาวร/i;
const MAX_PER_PAGE = 45;

const who = {} as Record<"staff" | "coop" | "teacher" | "early" | "intern", KUser>;
test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน");
  const X = await k.major("X", "หลักสูตรเอ็กซ์");
  const P = await k.period(1, { [X]: {} });
  who.staff = await k.staff();
  const coop = await k.teacher("ประจำวิชา", { major: X, coop: [X] });
  const plain = await k.teacher("ทั่วไป", { major: X });
  who.coop = coop; who.teacher = plain;
  const c = await k.company(`${k.prefix}${k.tail} บริษัท`, ["HR"]);
  who.early = await k.student("early", 1, { major: X, status: "QUALIFIED", periodId: P, companyId: c.id, contactIds: c.contactIds, advisor: plain.pk });
  who.intern = await k.student("intern", 2, { major: X, status: "INTERNSHIP_STARTED", periodId: P, companyId: c.id, contactIds: c.contactIds, advisor: plain.pk });
});
test.afterAll(async () => { await k.cleanup(); await k.disconnect(); });

async function crawl(page: Page, u: KUser, base: string, routes: string[]) {
  const problems: string[] = [];
  let where = "";
  // WebKit รายงานคำขอที่ถูกยกเลิกเพราะเปลี่ยนหน้า (กดปุ่มที่พาไปหน้าอื่นระหว่างโหลด) เป็น error — ผู้ใช้ไม่เห็นอะไร ไม่นับ
  const CANCELLED = /due to access control checks|Load failed|The operation was aborted|AbortError/i;
  page.on("pageerror", (e) => { if (!CANCELLED.test(e.message)) problems.push(`${where} · หน้าเว็บพัง: ${e.message.slice(0, 160)}`); });
  page.on("response", (r) => { if (r.status() >= 500 && r.url().includes("/api/")) problems.push(`${where} · ${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, "")}`); });
  page.context().on("page", (p) => { p.close().catch(() => {}); });            // ปุ่มที่เปิดแท็บใหม่ (PDF/ลิงก์) — ปิดทิ้ง
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  await page.route("**/api/**", (route) => (route.request().method() === "GET"
    ? route.continue()
    : route.fulfill({ status: 418, contentType: "application/json", body: JSON.stringify({ ok: false, message: "ทดสอบกดปุ่ม — ไม่บันทึกจริง" }) })));
  await page.goto("/");
  await page.evaluate(([tk, uid]) => { localStorage.clear(); localStorage.setItem("coop.token", tk); localStorage.setItem("coop.userId", uid); localStorage.setItem("coop.theme", "light"); }, [u.token, String(u.userId)]);

  let clicked = 0;
  for (const r of routes) {
    const url = `${base}/${r}`;
    where = url;
    await page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
    // พาไปส่วนอื่นของระบบ (อาจารย์ประจำวิชา: หน้าตั้งค่า /teacher → /admin) = ตั้งใจ · เด้งไปหน้าเข้าสู่ระบบ = ปัญหา
    if (!page.url().includes(base)) {
      if (!/\/(admin|teacher|student)\//.test(page.url())) problems.push(`${url} · เด้งออกไป ${page.url()}`);
      continue;
    }
    const done = new Set<string>();
    for (let n = 0; n < MAX_PER_PAGE; n++) {
      // ปุ่มที่ยังไม่กดตัวถัดไป (คิวรีใหม่ทุกครั้ง — หน้าเปลี่ยนหลังกด)
      const buttons = page.locator("button:visible:enabled");
      const count = await buttons.count();
      let target = -1, name = "";
      for (let i = 0; i < count; i++) {
        const b = buttons.nth(i);
        const label = ((await b.getAttribute("aria-label").catch(() => null)) || (await b.innerText().catch(() => "")) || "").trim().replace(/\s+/g, " ").slice(0, 60);
        const key = label || `#${i}`;
        if (done.has(key) || SKIP.test(label)) continue;
        target = i; name = key; break;
      }
      if (target < 0) break;
      done.add(name);
      where = `${url} [${name}]`;
      await buttons.nth(target).click({ timeout: 2_000 }).catch(() => {});
      clicked++;
      await page.waitForTimeout(250);
      // ปิดสิ่งที่เปิดขึ้น: หน้าต่างยืนยัน/โมดัล → ยกเลิก/ปิด/Esc · ออกนอกหน้า → กลับ
      for (const close of [/^ยกเลิก$/, /^ปิด$/, /^✕$|^×$/]) {
        const c = page.getByRole("button", { name: close }).last();
        if (await c.isVisible().catch(() => false)) { await c.click({ timeout: 1_000 }).catch(() => {}); break; }
      }
      await page.keyboard.press("Escape").catch(() => {});
      if (!page.url().startsWith(new URL(url, "http://localhost:5173").href.split("?")[0])) await page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
      const empty = await page.locator("#root").evaluate((el) => el.childElementCount === 0).catch(() => false);
      if (empty) { problems.push(`${where} · หน้าว่าง (React พัง)`); await page.goto(url, { waitUntil: "networkidle" }).catch(() => {}); }
    }
  }
  return { problems: [...new Set(problems)], clicked };
}

const cases: [string, keyof typeof who, string, string[]][] = [
  ["เจ้าหน้าที่ /admin", "staff", "/admin", routesOf("A_App.tsx")],
  ["อาจารย์ประจำวิชา /admin", "coop", "/admin", routesOf("A_App.tsx")],
  ["อาจารย์ประจำวิชา /teacher", "coop", "/teacher", routesOf("T_App.tsx")],
  ["อาจารย์ทั่วไป /teacher", "teacher", "/teacher", routesOf("T_App.tsx")],
  ["นักศึกษา (ผ่านคุณสมบัติ) /student", "early", "/student", routesOf("S_App.tsx")],
  ["นักศึกษา (ออกฝึกแล้ว) /student", "intern", "/student", routesOf("S_App.tsx")],
];
for (const [title, role, base, routes] of cases) {
  test(`กดทุกปุ่ม: ${title} (${routes.length} หน้า)`, async ({ browser }) => {
    test.setTimeout(900_000);
    expect(routes.length).toBeGreaterThan(5);
    const page = await (await browser.newContext()).newPage();
    const { problems, clicked } = await crawl(page, who[role], base, routes);
    console.log(`${title}: กด ${clicked} ปุ่ม · ปัญหา ${problems.length}`);
    expect(problems).toEqual([]);
    // ไม่มีอะไรถูกบันทึกจริง (คำขอเขียนถูกกันไว้ทั้งหมด)
    expect(await prisma.auditLog.count({ where: { userId: who[role].userId, method: { not: "GET" }, createdAt: { gte: k.startedAt } } })).toBe(0);
  });
}
