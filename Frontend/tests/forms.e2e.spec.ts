/**
 * tests/forms.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * แบบฟอร์มช่วงท้ายสหกิจ T005/T006 (แบบประเมิน) · T007 (ประเมินสถานประกอบการ) · T008 (ส่งเล่มรายงาน)
 *   เป็นหน้าลิงก์ + คำชี้แจง + กำหนดส่ง (ไม่มีการส่งไฟล์ในระบบ) — ค่ากลาง (เจ้าหน้าที่) · ค่าเฉพาะหลักสูตร (อาจารย์ประจำวิชา)
 *   · กำหนดส่งจากปฏิทินของรอบ (ไม่มีรอบ = กำหนดส่งเดิมในค่าตั้ง) · รูปประกอบ T008
 * backend + DB จริง (ข้อมูล ZF ลบทิ้งตอนจบ · ค่าตั้งค่ากลาง/ค่าเฉพาะหลักสูตรคืนค่าเดิม — CONFIG_T008 ถูกเขียนทับด้วยค่าทดสอบก่อน
 *   ไม่งั้น server ลบรูปจริงตอนเปลี่ยนรูป)
 * บั๊กที่แก้รอบนี้: กำหนดส่งวันที่ไม่มีจริง (2026-02-31) บันทึกได้ · หน้าตั้งค่าบันทึกไม่ผ่านขึ้นแค่ "เกิดข้อผิดพลาด" ไม่บอกเหตุผล
 */
import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { api, type Res } from "./helpers/letterWorld";
import { WorldKit, UPLOADS, day, type KStudent, type KTeacher, type KUser } from "./helpers/worldKit";

const k = new WorldKit("ZF");
test.describe.configure({ mode: "serial" });
const msg = (r: Res) => JSON.stringify(r.body);
const SYSTEM = path.join(UPLOADS, "system");
const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
const systemFiles = () => fs.readdirSync(SYSTEM).length;
const KEYS = ["EVALUATION_FORMS", "CONFIG_T007", "CONFIG_T008", "EVALUATION_FORMS@CS", "CONFIG_T007@CS", "CONFIG_T007@AI", "CONFIG_T008@CS"];

let staff: KUser;
const t = {} as Record<"coopCS" | "coopAI" | "plain", KTeacher>;
const s = {} as Record<"csRound" | "csNoRound" | "aiNoRound", KStudent>;
const imagesMade: string[] = [];

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน");
  staff = await k.staff();
  t.coopCS = await k.teacher("ประจำวิชาCS", { coop: ["CS"] });
  t.coopAI = await k.teacher("ประจำวิชาAI", { major: "AI", coop: ["AI"] });
  t.plain = await k.teacher("ทั่วไป");
  const period = await k.period(8, { CS: { deadlines: { T005_T006: { due: day(40) }, T007: { due: day(50) }, T008: { due: day(60) } } } });
  s.csRound = await k.student("csRound", 1, { status: "INTERNSHIP_STARTED", periodId: period });
  s.csNoRound = await k.student("csNoRound", 2, { status: "INTERNSHIP_STARTED" });
  s.aiNoRound = await k.student("aiNoRound", 3, { major: "AI", status: "INTERNSHIP_STARTED" });
  await k.snapshot(...KEYS);
  // ค่าทดสอบตั้งต้น — ค่าจริงไม่ถูกแตะ (รูป T008 จริงไม่ถูกลบ) · ค่าเฉพาะหลักสูตรเดิมถูกพักไว้
  await k.overwrite("EVALUATION_FORMS", { instructionText: "ZF เดิม", ccEmails: "a@kku.ac.th", t005Link: "https://zf.example.com/005", t006Link: "https://zf.example.com/006", templateLink: null, deadline: null });
  await k.overwrite("CONFIG_T007", { instructionText: "ZF เดิม", t007Link: "https://zf.example.com/007", deadline: null });
  await k.overwrite("CONFIG_T008", { instructionText: "ZF เดิม", driveLink: null, imagePath: null, deadline: null });
  for (const key of KEYS.filter((x) => x.includes("@"))) await k.overwrite(key, null);
});
test.afterAll(async () => {
  const cfg = await k.config("CONFIG_T008");
  if (cfg?.imagePath) imagesMade.push(cfg.imagePath);
  await k.cleanup();
  for (const f of imagesMade) { try { fs.unlinkSync(path.join(SYSTEM, path.basename(f))); } catch { /* ลบไปแล้ว */ } }
  await k.disconnect();
});

const put = (token: string, which: "evaluation" | "t007", body: object) => api(token, "PUT", `/api/admin/config/${which}`, body);
function t008Form(fields: Record<string, string>, image = false) {
  const fd = new FormData();
  for (const [key, v] of Object.entries(fields)) fd.append(key, v);
  if (image) fd.append("image", new Blob([PNG], { type: "image/png" }), "step.png");
  return fd;
}
const putT008 = (token: string, fields: Record<string, string>, image = false) => api(token, "PUT", "/api/admin/config/t008", t008Form(fields, image));
const studentView = async (key: keyof typeof s, which: "evaluation" | "t007" | "t008") => (await api(s[key].token, "GET", `/api/coop/config/${which}`)).body.config;
const putMajor = (token: string, key: string, override: object, major?: string) =>
  api(token, "PUT", `/api/admin/major-config/${key}${major ? `?major=${major}` : ""}`, { override });

// ══════════════════════════════════════════════════════
// A. สิทธิ์
// ══════════════════════════════════════════════════════
test.describe("A. สิทธิ์", () => {
  test("อ่านค่ากลาง: เจ้าหน้าที่/อาจารย์ประจำวิชา · อาจารย์ทั่วไป/นักศึกษา 403 · แก้ค่ากลาง: เจ้าหน้าที่เท่านั้น", async () => {
    for (const which of ["evaluation", "t007", "t008"]) {
      expect((await api(staff.token, "GET", `/api/admin/config/${which}`)).status, which).toBe(200);
      expect((await api(t.coopCS.token, "GET", `/api/admin/config/${which}`)).status, which).toBe(200);
      expect((await api(t.plain.token, "GET", `/api/admin/config/${which}`)).status, which).toBe(403);
      expect((await api(s.csRound.token, "GET", `/api/admin/config/${which}`)).status, which).toBe(403);
    }
    for (const tk of [t.coopCS.token, t.plain.token, s.csRound.token]) {
      expect((await put(tk, "evaluation", { t005Link: "https://x.example.com" })).status).toBe(403);
      expect((await put(tk, "t007", { t007Link: "https://x.example.com" })).status).toBe(403);
      expect((await putT008(tk, { driveLink: "https://x.example.com" })).status).toBe(403);
    }
    expect((await k.config("CONFIG_T007")).t007Link).toBe("https://zf.example.com/007");
  });
});

// ══════════════════════════════════════════════════════
// B. ตรวจข้อมูลตอนบันทึก
// ══════════════════════════════════════════════════════
test.describe("B. ตรวจข้อมูล", () => {
  test("ลิงก์ทุกช่องต้องเป็น http(s) · กำหนดส่งต้องเป็น YYYY-MM-DD · (ใหม่) วันที่ต้องมีจริง — ค่าเดิมไม่ถูกแตะ · รูป T008 ที่ส่งมากับค่าผิดไม่ค้าง", async () => {
    for (const field of ["t005Link", "t006Link", "templateLink"]) {
      const r = await put(staff.token, "evaluation", { [field]: "javascript:alert(1)" });
      expect(r.status, `${field}: ${msg(r)}`).toBe(400);
    }
    expect((await put(staff.token, "t007", { t007Link: "ftp://x" })).status).toBe(400);
    for (const deadline of ["2026/01/01", "abc", "2026-02-31", "2026-13-01"]) {
      expect((await put(staff.token, "evaluation", { deadline })).status, deadline).toBe(400);
      expect((await put(staff.token, "t007", { deadline })).status, deadline).toBe(400);
    }
    const files = systemFiles();
    expect((await putT008(staff.token, { driveLink: "javascript:x" }, true)).status).toBe(400);
    expect((await putT008(staff.token, { deadline: "2026-02-30" }, true)).status).toBe(400);
    expect(systemFiles()).toBe(files);
    expect((await k.config("EVALUATION_FORMS")).t005Link).toBe("https://zf.example.com/005");
    expect((await k.config("CONFIG_T007")).deadline).toBeNull();
  });
});

// ══════════════════════════════════════════════════════
// C. บันทึกค่ากลาง → นักศึกษาเห็น (กำหนดส่งจากปฏิทินของรอบ / ไม่มีรอบใช้กำหนดส่งเดิม)
// ══════════════════════════════════════════════════════
test.describe("C. ค่ากลางและกำหนดส่ง", () => {
  test("T005/T006 · T007 · T008: บันทึกแล้วนักศึกษาเห็นลิงก์ใหม่ · มีรอบ = กำหนดส่งของรอบ · ไม่มีรอบ = กำหนดส่งเดิม · บทบาทอื่นเห็นค่ากลาง", async () => {
    let r = await put(staff.token, "evaluation", { instructionText: "ZF ประเมิน", ccEmails: "zf@kku.ac.th", t005Link: "https://zf.example.com/005b", t006Link: "https://zf.example.com/006b", templateLink: "https://docs.google.com/zf", deadline: day(10) });
    expect(r.status, msg(r)).toBe(200);
    r = await put(staff.token, "t007", { instructionText: "ZF T007", t007Link: "https://forms.gle/zf007", deadline: day(11) });
    expect(r.status, msg(r)).toBe(200);
    r = await putT008(staff.token, { instructionText: "ZF T008", driveLink: "https://drive.google.com/zf", deadline: day(12) });
    expect(r.status, msg(r)).toBe(200);

    expect(await studentView("csRound", "evaluation")).toMatchObject({ t005Link: "https://zf.example.com/005b", ccEmails: "zf@kku.ac.th", deadline: day(40) });
    expect(await studentView("csNoRound", "evaluation")).toMatchObject({ t005Link: "https://zf.example.com/005b", deadline: day(10) });
    expect(await studentView("csRound", "t007")).toMatchObject({ t007Link: "https://forms.gle/zf007", deadline: day(50) });
    expect(await studentView("csNoRound", "t007")).toMatchObject({ deadline: day(11) });
    expect(await studentView("csRound", "t008")).toMatchObject({ driveLink: "https://drive.google.com/zf", deadline: day(60) });
    expect(await studentView("aiNoRound", "t008")).toMatchObject({ deadline: day(12) });
    expect((await api(t.plain.token, "GET", "/api/coop/config/t007")).body.config).toMatchObject({ t007Link: "https://forms.gle/zf007", deadline: day(11) });
    // ล้างกำหนดส่งเดิม (ค่าว่าง = ไม่มีกำหนด) → นักศึกษาที่ไม่มีรอบไม่มีกำหนดส่ง
    expect((await put(staff.token, "t007", { instructionText: "ZF T007", t007Link: "https://forms.gle/zf007", deadline: "" })).status).toBe(200);
    expect(await studentView("csNoRound", "t007")).not.toHaveProperty("deadline");
  });
});

// ══════════════════════════════════════════════════════
// D. ค่าเฉพาะหลักสูตร (อาจารย์ประจำวิชาตั้งให้หลักสูตรตัวเอง)
// ══════════════════════════════════════════════════════
test.describe("D. ค่าเฉพาะหลักสูตร", () => {
  test("ประจำวิชา CS ตั้งลิงก์ T007 ของ CS → นักศึกษา CS เห็น · AI ยังเห็นค่ากลาง · ตั้งของ AI ไม่ได้ 403 · ไม่ระบุหลักสูตร 400 · ลิงก์ผิด/ช่องที่ตั้งแยกไม่ได้ 400 · อาจารย์ทั่วไป 403 · ล้างแล้วกลับไปใช้ค่ากลาง", async () => {
    let r = await putMajor(t.coopCS.token, "CONFIG_T007", { t007Link: "https://forms.gle/zf-cs" }, "CS");
    expect(r.status, msg(r)).toBe(200);
    expect((await studentView("csRound", "t007")).t007Link).toBe("https://forms.gle/zf-cs");
    expect((await studentView("aiNoRound", "t007")).t007Link).toBe("https://forms.gle/zf007");
    expect((await putMajor(t.coopCS.token, "CONFIG_T007", { t007Link: "https://x.example.com" }, "AI")).status).toBe(403);
    expect((await putMajor(t.coopCS.token, "CONFIG_T007", { t007Link: "https://x.example.com" })).status).toBe(400);
    expect((await putMajor(t.coopCS.token, "CONFIG_T007", { t007Link: "javascript:x" }, "CS")).status).toBe(400);
    expect((await putMajor(t.coopCS.token, "CONFIG_T007", { deadline: day(5) }, "CS")).status).toBe(400);
    expect((await putMajor(t.plain.token, "CONFIG_T007", { t007Link: "https://x.example.com" }, "CS")).status).toBe(403);

    r = await putMajor(staff.token, "CONFIG_T007", { t007Link: "https://forms.gle/zf-ai", instructionText: "ZF AI" }, "AI");
    expect(r.status, msg(r)).toBe(200);
    expect(await studentView("aiNoRound", "t007")).toMatchObject({ t007Link: "https://forms.gle/zf-ai", instructionText: "ZF AI" });
    r = await api(t.coopAI.token, "GET", "/api/admin/major-config/CONFIG_T007?major=AI");
    expect([r.body.major, r.body.override.t007Link, r.body.effective.t007Link]).toEqual(["AI", "https://forms.gle/zf-ai", "https://forms.gle/zf-ai"]);

    expect((await putMajor(t.coopCS.token, "CONFIG_T007", {}, "CS")).status).toBe(200);
    expect((await studentView("csRound", "t007")).t007Link).toBe("https://forms.gle/zf007");
  });
});

// ══════════════════════════════════════════════════════
// E. รูปประกอบ T008
// ══════════════════════════════════════════════════════
test.describe("E. รูปประกอบ T008", () => {
  test("อัปโหลดรูป → นักศึกษาเห็น · คงรูปเดิม (ส่งชื่อเดิม) · เปลี่ยนรูป = ลบรูปเก่า · ชื่อรูปปลอม (../) ไม่ถูกเก็บ/ลบไฟล์นอกโฟลเดอร์ · เอารูปออก = ลบไฟล์", async () => {
    let r = await putT008(staff.token, { instructionText: "ZF T008", driveLink: "https://drive.google.com/zf" }, true);
    expect(r.status, msg(r)).toBe(200);
    const first = r.body.imagePath as string;
    imagesMade.push(first);
    expect(fs.existsSync(path.join(SYSTEM, first))).toBe(true);
    expect((await studentView("csRound", "t008")).imagePath).toBe(first);

    r = await putT008(staff.token, { instructionText: "ZF T008", existingImage: first });
    expect([r.status, r.body.imagePath]).toEqual([200, first]);
    r = await putT008(staff.token, { instructionText: "ZF T008", existingImage: first }, true);
    const second = r.body.imagePath as string;
    imagesMade.push(second);
    expect(second).not.toBe(first);
    expect(fs.existsSync(path.join(SYSTEM, first))).toBe(false);

    const serverJs = path.join(UPLOADS, "../server.js");
    r = await putT008(staff.token, { instructionText: "ZF T008", existingImage: "../../server.js" });
    expect([r.status, r.body.imagePath]).toEqual([200, null]);
    expect(fs.existsSync(serverJs)).toBe(true);
    expect(fs.existsSync(path.join(SYSTEM, second))).toBe(false);        // ไม่ได้คงรูปเดิม = เอารูปออก
    expect((await studentView("csRound", "t008")).imagePath).toBeNull();
  });
});

// ══════════════════════════════════════════════════════
// หน้าเว็บ
// ══════════════════════════════════════════════════════
test.use({ timezoneId: "Asia/Bangkok" });
async function asUser(page: Page, token: string, userId: number, to: string) {
  await page.goto("/");
  await page.evaluate(([tk, uid]) => {
    localStorage.clear();
    localStorage.setItem("coop.token", tk); localStorage.setItem("coop.userId", uid); localStorage.setItem("coop.theme", "light");
  }, [token, String(userId)]);
  await page.goto(to, { waitUntil: "networkidle" });
}
const SAVE = "💾 บันทึกการเปลี่ยนแปลง";
const confirmSave = (page: Page) => page.getByRole("button", { name: "บันทึก", exact: true }).click();

test.describe("F. หน้าตั้งค่า (เจ้าหน้าที่) และหน้านักศึกษา", () => {
  test("T007: (ใหม่) ลิงก์ผิด → บอกเหตุผลจาก server · ลิงก์ถูก → บันทึก → นักศึกษาเห็นลิงก์ + กำหนดส่งของรอบ + ปุ่มเปิดฟอร์ม", async ({ page }) => {
    await asUser(page, staff.token, staff.userId, "/admin/doc-t007");
    const link = page.getByPlaceholder("https://forms.gle/...");
    await link.fill("ftp://zf-bad");
    await page.getByRole("button", { name: SAVE }).click();
    await confirmSave(page);
    await expect(page.getByText("t007Link ต้องเป็น URL แบบ http/https เท่านั้น")).toBeVisible();
    await link.fill("https://forms.gle/zf-ui");
    await page.getByPlaceholder("พิมพ์ข้อความคำชี้แจงให้นักศึกษา...").fill("ZF คำชี้แจงจากหน้าเว็บ");
    await page.getByRole("button", { name: SAVE }).click();
    await confirmSave(page);
    await expect.poll(async () => (await k.config("CONFIG_T007")).t007Link).toBe("https://forms.gle/zf-ui");
    await expect(page.getByText("บันทึกข้อมูลสำเร็จ")).toBeVisible();

    await asUser(page, s.csRound.token, s.csRound.userId, "/student/doc-t007");
    await expect(page.getByText("ZF คำชี้แจงจากหน้าเว็บ")).toBeVisible();
    await expect(page.getByText("https://forms.gle/zf-ui").first()).toBeVisible();
    await expect(page.getByText(/กำหนดส่ง: .* · เหลืออีก 50 วัน/)).toBeVisible();
    const popup = page.waitForEvent("popup");
    await page.getByRole("button", { name: "🔗 เปิดฟอร์มประเมิน T007" }).click();
    expect((await popup).url()).toContain("forms.gle/zf-ui");
  });

  test("T005/T006: แก้ลิงก์ + อีเมล CC → บันทึก → นักศึกษาเห็นทั้งสองลิงก์และอีเมล", async ({ page }) => {
    await asUser(page, staff.token, staff.userId, "/admin/doc-t005-006");
    await page.getByPlaceholder("เช่น thanaphon@kku.ac.th, chitsutha@kku.ac.th").fill("zf-ui@kku.ac.th");
    await page.getByPlaceholder("https://...").first().fill("https://zf.example.com/005-ui");
    await page.getByRole("button", { name: SAVE }).click();
    await confirmSave(page);
    await expect(page.getByText("บันทึกข้อมูลสำเร็จ")).toBeVisible();
    await asUser(page, s.csNoRound.token, s.csNoRound.userId, "/student/doc-t005-006");
    await expect(page.getByText("zf-ui@kku.ac.th")).toBeVisible();
    await expect(page.getByText("https://zf.example.com/005-ui").first()).toBeVisible();
  });

  test("T008: เลือกรูป → แสดงตัวอย่าง → บันทึก → นักศึกษาเห็นรูป · ปุ่มลบภาพ → บันทึก → รูปหาย", async ({ page, browser }) => {
    await asUser(page, staff.token, staff.userId, "/admin/doc-t008");
    await page.locator('input[type="file"]').setInputFiles({ name: "zf.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByAltText("Preview")).toBeVisible();
    await page.getByRole("button", { name: SAVE }).click();
    await confirmSave(page);
    await expect(page.getByText("บันทึกข้อมูลสำเร็จ")).toBeVisible();
    const img = (await k.config("CONFIG_T008")).imagePath as string;
    expect(img).toBeTruthy();
    imagesMade.push(img);

    // หน้านักศึกษาเปิดใน context แยก — localStorage ร่วมกันใน context เดียว token ของเจ้าหน้าที่จะถูกแทน
    const ctx = await browser.newContext();
    const student = await ctx.newPage();
    await asUser(student, s.csRound.token, s.csRound.userId, "/student/doc-t008");
    await expect(student.locator(`img[src="/uploads/system/${img}"]`)).toBeVisible();
    await ctx.close();

    await page.getByRole("button", { name: "🗑️ ลบภาพ" }).click();
    await page.getByRole("button", { name: SAVE }).click();
    await confirmSave(page);
    await expect.poll(async () => (await k.config("CONFIG_T008")).imagePath).toBeNull();
    expect(fs.existsSync(path.join(SYSTEM, img))).toBe(false);
  });
});
