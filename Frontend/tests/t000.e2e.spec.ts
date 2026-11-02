/**
 * tests/t000.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * เอกสาร T000 / ใบตอบรับ — กรณีข้างทางที่ coop-lifecycle (ทางปกติ) ไม่ได้เดิน
 * backend + DB จริง (ข้อมูลจาก helpers/t000World.ts ลบทิ้งตอนจบ) · ต้องรัน backend ที่ :5000 และ frontend ที่ :5173
 *
 * บั๊กที่เคยเจอ (ล็อกไว้ไม่ให้กลับมา):
 *   - อัปโหลดครบหัวข้อบังคับแล้วสถานะค้าง "ผ่านคุณสมบัติ" (เจ้าหน้าที่ไม่เห็น ไม่ได้แจ้งเตือน) · ลบจนไม่ครบต้องถอยกลับ
 *   - ส่งแก้หลายไฟล์หลังกำหนด: ไฟล์ที่สองโดน 403 ว่าเลยกำหนด
 *   - อาจารย์ที่ปรึกษาเปลี่ยนผลคุณสมบัติของคนที่ส่ง T000 ครั้งแรกแล้วได้
 *   - ตีกลับใบตอบรับแล้วนักศึกษาส่งใหม่ไม่ได้ (รวมข้อมูลเก่าที่ตีกลับเป็น EDITS_REQUIRED)
 *   - "อนุมัติทั้งหมด" กับคนที่ออกหนังสือแล้ว · ตั้ง "ออกหนังสือแล้ว" โดยไม่มีไฟล์ · ถอยสถานะคนที่ฝึกงานแล้ว
 *   - (รอบนี้) นักศึกษาลบ/อัปโหลดทับไฟล์ที่ผ่านแล้ว และลบใบตอบรับผ่าน API ได้ — หน้าเว็บซ่อนปุ่มแต่ server ไม่กัน
 *     รวมทางลบของหน้ายื่นคำร้อง (/api/coop/documents/:id) ที่ลบไฟล์ได้ทุกชนิดทุกสถานะ
 */
import { test, expect, type Page } from "@playwright/test";
import { api } from "./helpers/letterWorld";
import { T000World, uploadForm, staffFileForm } from "./helpers/t000World";

const w = new T000World();
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน (cd backend && npm run dev)");
  await w.setup();
});
test.afterAll(async () => { await w.cleanup(); await w.disconnect(); });

const st = (key: string) => w.s[key].token;
const pk = (key: string) => w.s[key].pk;
const staff = () => w.staff.token;
const upload = (key: string, docType: string) => api(st(key), "POST", "/api/docs/upload", uploadForm(docType));
const del = async (key: string, docType: string) => api(st(key), "DELETE", `/api/docs/delete/${(await w.doc(key, docType))!.id}`);
const msg = (r: { body: any }) => JSON.stringify(r.body);
// ป้ายเมนู T000 ของเจ้าหน้าที่ = งานที่รอจริง (แทนแจ้งเตือน — เจ้าหน้าที่ไม่มีหน้าจอแจ้งเตือน ระบบจึงไม่สร้างให้แล้ว)
const pendingT000 = async () => (await api(staff(), "GET", "/api/notifications/pending")).body.pending.t000 as number;

// ══════════════════════════════════════════════════════
// A. ส่งครั้งแรก — ครบแล้วรอตรวจทันที · ลบจนไม่ครบถอยกลับ
// ══════════════════════════════════════════════════════
test.describe("A. ส่ง T000 ครั้งแรก", () => {
  test("อัปโหลดทีละหัวข้อ: ยังไม่ครบ = ผ่านคุณสมบัติ · ครบ = รอตรวจ + บันทึกเวลาส่ง + ป้ายเจ้าหน้าที่ +1 · ลบ = ถอย · ส่งใหม่ = รอตรวจ", async () => {
    const keys = w.required;
    const before = await pendingT000();
    for (const [i, k] of keys.entries()) {
      const r = await upload("fresh", k);
      expect(r.status, msg(r)).toBe(200);
      const c = await w.coop("fresh");
      if (i < keys.length - 1) expect(c.status).toBe("QUALIFIED");
      else {
        expect(c.status).toBe("WAITING_FOR_STAFF_CHECK");
        expect(c.t000Status).toBe("PENDING");
        expect(c.submittedSteps?.T000?.at).toBeTruthy();
      }
    }
    expect(await pendingT000()).toBe(before + 1);
    expect(await w.notes("fresh", "T000_SUBMITTED")).toHaveLength(0);

    const r = await del("fresh", keys[0]);
    expect(r.status, msg(r)).toBe(200);
    let c = await w.coop("fresh");
    expect([c.status, c.t000Status]).toEqual(["QUALIFIED", "WAITING"]);

    expect((await upload("fresh", keys[0])).status).toBe(200);
    c = await w.coop("fresh");
    expect([c.status, c.t000Status]).toEqual(["WAITING_FOR_STAFF_CHECK", "PENDING"]);
  });

  test("ส่งครั้งแรกรอตรวจอยู่: อาจารย์ที่ปรึกษาเปลี่ยนผลคุณสมบัติไม่ได้ (400)", async () => {
    const r = await api(w.teacher.token, "PUT", "/api/coop/status", { studentId: pk("firstWaiting"), status: "REJECTED", comment: "x" });
    expect(r.status, msg(r)).toBe(400);
    expect((await w.coop("firstWaiting")).status).toBe("WAITING_FOR_STAFF_CHECK");
  });
});

// ══════════════════════════════════════════════════════
// B. ส่งกลับแก้ — ส่งแก้หลายไฟล์หลังกำหนดได้ · ไฟล์ที่ผ่านแล้วแตะไม่ได้
// ══════════════════════════════════════════════════════
test.describe("B. ส่งกลับแก้ (รอบเลยกำหนดแล้ว)", () => {
  test("ไฟล์ที่ผ่านแล้วอัปโหลดทับ/ลบไม่ได้ (409) — ไฟล์เดิมยังอยู่", async () => {
    const k = w.required[2];
    const before = await w.doc("sentBack", k);
    let r = await upload("sentBack", k);
    expect(r.status, msg(r)).toBe(409);
    expect(r.body.message).toMatch(/ผ่านการตรวจสอบแล้ว/);
    r = await del("sentBack", k);
    expect(r.status, msg(r)).toBe(409);
    const after = await w.doc("sentBack", k);
    expect([after.id, after.path, after.status]).toEqual([before.id, before.path, "APPROVED"]);
    expect((await w.coop("sentBack")).status).toBe("EDITS_REQUIRED");
  });

  test("ส่งแก้ไฟล์แรก → รอตรวจ (ส่งแก้) · ไฟล์ที่สองไม่โดนเลยกำหนด · ป้ายเจ้าหน้าที่ +1", async () => {
    const [k0, k1] = w.required;
    const before = await pendingT000();
    let r = await upload("sentBack", k0);
    expect(r.status, msg(r)).toBe(200);
    let c = await w.coop("sentBack");
    expect([c.status, c.t000Status]).toEqual(["WAITING_FOR_STAFF_CHECK", "EDITS_REQUIRED"]);
    r = await upload("sentBack", k1);
    expect(r.status, msg(r)).toBe(200);
    c = await w.coop("sentBack");
    expect([c.status, c.t000Status]).toEqual(["WAITING_FOR_STAFF_CHECK", "EDITS_REQUIRED"]);
    expect((await w.doc("sentBack", k1)).status).toBe("WAITING");
    expect(await pendingT000()).toBe(before + 1);
  });
});

// ══════════════════════════════════════════════════════
// C. เอกสารผ่านแล้ว — ทุกทางลบ/เปลี่ยนไฟล์ถูกกัน
// ══════════════════════════════════════════════════════
test.describe("C. เอกสารผ่านแล้วล็อก", () => {
  test("ลบ (หน้าเอกสาร · หน้ายื่นคำร้อง) · อัปโหลดทับ → 409 ทั้งหมด · สถานะและไฟล์ไม่เปลี่ยน", async () => {
    const before = await w.docs("approved");
    const k = w.required[0];
    const id = (await w.doc("approved", k))!.id;
    for (const r of [
      await api(st("approved"), "DELETE", `/api/docs/delete/${id}`),
      await api(st("approved"), "DELETE", `/api/coop/documents/${id}`),
      await upload("approved", k),
    ]) expect(r.status, msg(r)).toBe(409);
    expect((await w.coop("approved")).status).toBe("DOCS_APPROVED");
    const after = await w.docs("approved");
    expect(after.map((d: any) => [d.id, d.path, d.status])).toEqual(before.map((d: any) => [d.id, d.path, d.status]));
  });

  test("ทางลบของหน้ายื่นคำร้องลบไฟล์ T000 ที่ยังไม่ผ่านก็ไม่ได้ (ต้องลบที่หน้าเอกสาร — ถอยสถานะถูก)", async () => {
    const id = (await w.doc("firstWaiting", w.required[0]))!.id;
    const r = await api(st("firstWaiting"), "DELETE", `/api/coop/documents/${id}`);
    expect(r.status, msg(r)).toBe(409);
    expect(await w.doc("firstWaiting", w.required[0])).not.toBeNull();
  });
});

// ══════════════════════════════════════════════════════
// D. กำหนดส่ง + ขยายเวลารายคน
// ══════════════════════════════════════════════════════
test.describe("D. เลยกำหนด / ขยายเวลา", () => {
  test("เลยกำหนด 403 · ขยายเวลา → ส่งได้ (ติดส่งช้า) · ยกเลิกขยาย → 403 อีก", async () => {
    const [k0, k1] = w.required;
    let r = await upload("late", k0);
    expect(r.status, msg(r)).toBe(403);
    expect(r.body.message).toMatch(/เลยกำหนดส่ง/);

    const until = new Date(Date.now() + 7 * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
    r = await api(staff(), "PUT", `/api/admin/students/${pk("late")}/deadline-extension`, { stepKey: "T000", until, reason: "ทดสอบ" });
    expect(r.status, msg(r)).toBe(200);
    r = await upload("late", k0);
    expect(r.status, msg(r)).toBe(200);
    expect(r.body.late).toBe(true);

    r = await api(staff(), "DELETE", `/api/admin/students/${pk("late")}/deadline-extension/T000`);
    expect(r.status, msg(r)).toBe(200);
    expect((await upload("late", k1)).status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════
// E. เจ้าหน้าที่ตรวจ — อนุมัติทั้งหมด · ด่านกันข้ามขั้น/ถอยสถานะ
// ══════════════════════════════════════════════════════
test.describe("E. เจ้าหน้าที่ตรวจเอกสาร", () => {
  test("อนุมัติทั้งหมด → เอกสารผ่าน (รอออกหนังสือ) ทุกไฟล์ผ่าน · คนที่ออกหนังสือแล้ว 400 สถานะเดิม", async () => {
    let r = await api(staff(), "POST", "/api/admin/t000/approve-all", { studentId: pk("review") });
    expect(r.status, msg(r)).toBe(200);
    const c = await w.coop("review");
    expect(c.status).toBe("DOCS_APPROVED");
    expect((await w.docs("review")).every((d: any) => d.status === "APPROVED")).toBe(true);

    r = await api(staff(), "POST", "/api/admin/t000/approve-all", { studentId: pk("reqIssued") });
    expect(r.status, msg(r)).toBe(400);
    expect((await w.coop("reqIssued")).status).toBe("REQ_LETTER_ISSUED");
  });

  test("ตั้ง \"ออกหนังสือแล้ว\" โดยไม่มีไฟล์ 400 · ถอยคนที่ฝึกงานแล้วกลับขั้นเอกสาร 409", async () => {
    let r = await api(staff(), "PUT", "/api/admin/t000/review", { studentId: pk("approved"), status: "REQ_LETTER_ISSUED" });
    expect(r.status, msg(r)).toBe(400);
    expect((await w.coop("approved")).status).toBe("DOCS_APPROVED");
    r = await api(staff(), "PUT", "/api/admin/t000/review", { studentId: pk("intern"), status: "EDITS_REQUIRED", comment: "x" });
    expect(r.status, msg(r)).toBe(409);
    expect((await w.coop("intern")).status).toBe("INTERNSHIP_STARTED");
  });
});

// ══════════════════════════════════════════════════════
// F. ใบตอบรับ — ตีกลับ/ส่งใหม่ · บริษัทส่งตรง · เจ้าหน้าที่เปลี่ยนไฟล์ · ล็อกหลังออกหนังสือส่งตัว
// ══════════════════════════════════════════════════════
test.describe("F. ใบตอบรับ", () => {
  test("ตีกลับ → รอใบตอบรับ + แจ้งนักศึกษา · ลบใบตอบรับไม่ได้ · ส่งใหม่ → รอตรวจ + ป้ายเจ้าหน้าที่ +1", async () => {
    const acc = (await w.doc("accWait", "CP-ACCEPTANCE"))!;
    let r = await api(staff(), "PUT", `/api/admin/doc/${acc.id}/status`, { status: "REJECTED" });
    expect(r.status, msg(r)).toBe(200);
    r = await api(staff(), "PUT", "/api/admin/t000/review", { studentId: pk("accWait"), status: "WAITING_FOR_PLACEMENT_LETTER", comment: "ไม่มีตราบริษัท" });
    expect(r.status, msg(r)).toBe(200);
    expect((await w.coop("accWait")).status).toBe("WAITING_FOR_PLACEMENT_LETTER");
    await expect.poll(async () => (await w.notes("accWait", "DOCS_UPDATED")).map((n: any) => n.message).join()).toMatch(/ใบตอบรับต้องแก้ไข/);

    r = await del("accWait", "CP-ACCEPTANCE");
    expect(r.status, msg(r)).toBe(409);

    const before = await pendingT000();
    r = await upload("accWait", "CP-ACCEPTANCE");
    expect(r.status, msg(r)).toBe(200);
    expect((await w.coop("accWait")).status).toBe("WAITING_FOR_STAFF_CHECK_LETTER");
    expect((await w.doc("accWait", "CP-ACCEPTANCE")).status).toBe("WAITING");
    expect(await pendingT000()).toBe(before + 1);
    expect(await w.notes("accWait", "ACCEPTANCE_UPLOADED")).toHaveLength(0);
  });

  test("ข้อมูลเก่า (ตีกลับเป็น EDITS_REQUIRED หลังออกหนังสือแล้ว) ส่งใหม่ได้ · ขั้นเอกสาร T000 ส่งใบตอบรับไม่ได้", async () => {
    let r = await upload("accLegacy", "CP-ACCEPTANCE");
    expect(r.status, msg(r)).toBe(200);
    expect((await w.coop("accLegacy")).status).toBe("WAITING_FOR_STAFF_CHECK_LETTER");
    r = await upload("approved", "CP-ACCEPTANCE");
    expect(r.status, msg(r)).toBe(400);
    expect(await w.doc("approved", "CP-ACCEPTANCE")).toBeNull();
  });

  test("บริษัทส่งตรง → ใบตอบรับผ่าน · บันทึกซ้ำ 400 · นักศึกษาเปลี่ยนไฟล์ → รอตรวจ · เจ้าหน้าที่เปลี่ยนไฟล์ → รอตรวจ", async () => {
    let r = await api(staff(), "POST", "/api/admin/t000/acceptance-received", staffFileForm({ studentId: pk("reqIssued") }));
    expect(r.status, msg(r)).toBe(200);
    expect((await w.coop("reqIssued")).status).toBe("ACCEPTANCE_CHECKED");
    expect((await w.doc("reqIssued", "CP-ACCEPTANCE")).status).toBe("APPROVED");
    r = await api(staff(), "POST", "/api/admin/t000/acceptance-received", staffFileForm({ studentId: pk("reqIssued") }));
    expect(r.status, msg(r)).toBe(400);

    // ใบตอบรับที่ผ่านแล้วยังเปลี่ยนได้จนกว่าจะออกหนังสือส่งตัว (ไม่ใช่ไฟล์ T000)
    r = await upload("reqIssued", "CP-ACCEPTANCE");
    expect(r.status, msg(r)).toBe(200);
    expect((await w.coop("reqIssued")).status).toBe("WAITING_FOR_STAFF_CHECK_LETTER");

    r = await api(staff(), "POST", "/api/admin/t000/acceptance-replace", staffFileForm({ studentId: pk("reqIssued"), note: "ฉบับแก้" }));
    expect(r.status, msg(r)).toBe(200);
    const c = await w.coop("reqIssued");
    expect(c.status).toBe("WAITING_FOR_STAFF_CHECK_LETTER");
    expect(c.t000Comment).toMatch(/เจ้าหน้าที่เปลี่ยนไฟล์ใบตอบรับ/);
    expect((await w.docs("reqIssued")).filter((d: any) => d.type === "CP-ACCEPTANCE")).toHaveLength(1);
  });

  test("ออกหนังสือส่งตัวแล้ว: นักศึกษาส่ง/ลบ · เจ้าหน้าที่เปลี่ยน/บันทึก ไม่ได้ทั้งหมด · ไฟล์เดิมอยู่", async () => {
    const before = await w.doc("placed", "CP-ACCEPTANCE");
    const results = [
      await upload("placed", "CP-ACCEPTANCE"),
      await del("placed", "CP-ACCEPTANCE"),
      await api(staff(), "POST", "/api/admin/t000/acceptance-replace", staffFileForm({ studentId: pk("placed") })),
      await api(staff(), "POST", "/api/admin/t000/acceptance-received", staffFileForm({ studentId: pk("placed") })),
    ];
    expect(results.map((r) => r.status)).toEqual([400, 409, 400, 400]);
    expect(results[0].body.message).toMatch(/ออกหนังสือส่งตัวแล้ว/);
    const after = await w.doc("placed", "CP-ACCEPTANCE");
    expect([after.id, after.path, after.status]).toEqual([before.id, before.path, "APPROVED"]);
    expect((await w.coop("placed")).status).toBe("PLACEMENT_LETTER_ISSUED");
  });
});

// ══════════════════════════════════════════════════════
// G. หน้าเว็บจริง — ปุ่ม/ป้าย ตามสถานะ
// ══════════════════════════════════════════════════════
async function asUser(page: Page, token: string, userId: number) {
  await page.goto("/");
  await page.evaluate(([t, uid]) => {
    localStorage.clear();
    localStorage.setItem("coop.token", t); localStorage.setItem("coop.userId", uid); localStorage.setItem("coop.theme", "light");
  }, [token, String(userId)]);
}
async function openT000(page: Page, periodId: number, studentId: string) {
  await page.goto("/admin/doct000", { waitUntil: "networkidle" });
  await page.locator("select", { has: page.locator('option[value="all"]', { hasText: "ทุกปีการศึกษา" }) }).selectOption(String(periodId));
  await page.getByPlaceholder(/ค้นหา/).first().fill(studentId);
  return page.locator("tbody tr", { hasText: studentId });
}
async function confirmDialog(page: Page) {
  const dlg = page.locator('[role="dialog"][aria-modal="true"]');
  await dlg.last().waitFor({ state: "visible" });
  await dlg.last().locator("button").last().click();
}
const docRow = (page: Page, docKey: string) => page.locator("table.doc-table tbody tr", { hasText: w.titles[docKey] });

test.describe("G. หน้าเว็บ", () => {
  test("นักศึกษา เอกสารผ่านแล้ว: ทุกแถวขึ้นผ่าน ไม่มีปุ่มลบ ไม่มีปุ่มแนบไฟล์", async ({ page }) => {
    await asUser(page, st("approved"), w.s.approved.userId);
    await page.goto("/student/docs", { waitUntil: "networkidle" });
    for (const k of w.required) {
      const row = docRow(page, k);
      await expect(row.getByText("✅ เอกสารผ่าน")).toBeVisible();
      await expect(row.locator(".icon-btn")).toHaveCount(0);
      await expect(row.getByText("📤 แนบไฟล์")).toHaveCount(0);
    }
  });

  test("นักศึกษา ส่งครั้งแรกรอตรวจ: ลบไฟล์ (ถามก่อน) → ถอยสถานะ · แนบใหม่ + ยืนยันส่ง → รอตรวจอีกครั้ง", async ({ page }) => {
    const k = w.required[0];
    await asUser(page, st("firstWaiting"), w.s.firstWaiting.userId);
    await page.goto("/student/docs", { waitUntil: "networkidle" });
    const row = docRow(page, k);
    await expect(row.getByText("⏳ รอตรวจสอบ")).toBeVisible();
    await row.locator(".icon-btn").click();
    await confirmDialog(page);
    await expect(row.getByText("📤 แนบไฟล์")).toBeVisible();
    expect((await w.coop("firstWaiting")).status).toBe("QUALIFIED");

    await row.locator('input[type="file"]').setInputFiles({ name: "ใหม่.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nt000\n%%EOF") });
    await expect(row.getByText(/ไฟล์ที่เลือก: ใหม่\.pdf/)).toBeVisible();
    await row.getByRole("button", { name: "🚀 ยืนยันส่งไฟล์" }).click();
    await expect(row.getByText("⏳ รอตรวจสอบ")).toBeVisible();
    const c = await w.coop("firstWaiting");
    expect([c.status, c.t000Status]).toEqual(["WAITING_FOR_STAFF_CHECK", "PENDING"]);
  });

  test("เจ้าหน้าที่: ป้ายแยก ส่งครั้งแรก / ส่งแก้ · หน้าต่างตรวจของคนที่ฝึกงานแล้วดูอย่างเดียว", async ({ page }) => {
    await asUser(page, staff(), w.staff.userId);
    let row = await openT000(page, w.openPeriodId, w.s.fresh.studentId);
    await expect(row.getByText("ส่งเอกสารแล้ว (รอการตรวจสอบ)")).toBeVisible();
    row = await openT000(page, w.latePeriodId, w.s.sentBack.studentId);
    await expect(row.getByText("ส่งแก้ไขแล้ว (รอการตรวจสอบ)")).toBeVisible();

    row = await openT000(page, w.openPeriodId, w.s.fresh.studentId);
    await row.getByRole("button", { name: "ตรวจสอบเอกสาร" }).click();
    await expect(page.getByRole("button", { name: "อนุมัติทั้งหมด" })).toBeVisible();
    await page.keyboard.press("Escape");

    row = await openT000(page, w.openPeriodId, w.s.intern.studentId);
    await row.getByRole("button", { name: "ตรวจสอบเอกสาร" }).click();
    await expect(page.getByText(/เปิดดูย้อนหลังได้อย่างเดียว/)).toBeVisible();
    await expect(page.getByRole("button", { name: "อนุมัติทั้งหมด" })).toHaveCount(0);
  });
});
