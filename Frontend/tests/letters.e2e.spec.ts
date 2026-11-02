/**
 * tests/letters.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * หนังสือ (ขอความอนุเคราะห์ / ส่งตัว / ขอนิเทศ) — กรณีข้างทางที่ coop-lifecycle (ทางปกติ) ไม่ได้เดิน
 * backend + DB จริง (ข้อมูลจาก helpers/letterWorld.ts ลบทิ้งตอนจบ) · ต้องรัน backend ที่ :5000 และ frontend ที่ :5173
 *
 * บั๊กที่เคยเจอ (ล็อกไว้ไม่ให้กลับมา):
 *   - ยกเลิกรอลงนามแล้วกลัวสถานะเปลี่ยน → ต้องไม่เปลี่ยน (คนที่ผ่านขั้นไปแล้ว = พิมพ์ซ้ำ สถานะเดิม)
 *   - รอลงนามอยู่ยังสร้าง/ออกร่างเลขใหม่ทับได้ (หน้าต่างรายคน · ออกร่างหลายคน · API ตรง)
 *   - เลขที่หนังสือซ้ำข้ามประเภทได้ (ทุกประเภทใช้เลขชุดเดียวกัน 811 → 893 → 1215)
 */
import { test, expect, type Page } from "@playwright/test";
import { LetterWorld, api, signedForm } from "./helpers/letterWorld";

const w = new LetterWorld();
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน (cd backend && npm run dev)");
  await w.setup();
});
test.afterAll(async () => { await w.cleanup(); await w.disconnect(); });
test.beforeEach(async () => { await w.clearPending(); });

const staff = () => w.staff.token;
const pending = (body: object) => api(staff(), "PUT", "/api/admin/t000/letter-pending", body);
const supPending = (body: object) => api(staff(), "PUT", `/api/admin/supervisions/${w.supervisionId}/letter-pending`, body);
const id = (key: string) => w.s[key].pk;
const DATE = "2026-11-02";

// ══════════════════════════════════════════════════════
// A. ยกเลิกรอลงนาม — ไม่เปลี่ยนสถานะนักศึกษา
// ══════════════════════════════════════════════════════
test.describe("A. ยกเลิกรอลงนามไม่เปลี่ยนสถานะ", () => {
  for (const [key, letter, status, n] of [
    ["reqA1", "REQUEST", "DOCS_APPROVED", 100],
    ["place", "PLACEMENT", "ACCEPTANCE_CHECKED", 101],
    // พิมพ์ซ้ำของคนที่ฝึกอยู่แล้ว (เลขเดิมของตัวเอง) — ยกเลิกแล้วต้องเห็น "อยู่ระหว่างฝึกสหกิจ" + "พิมพ์ซ้ำ" ตามเดิม
    ["intern", "PLACEMENT", "INTERNSHIP_STARTED", 6],
  ] as const) {
    test(`${letter} ${status}: ตั้งรอลงนาม → ยกเลิก → สถานะเดิม ป้ายหาย`, async () => {
      const prefix = letter === "REQUEST" ? "reqLetter" : "placeLetter";
      let r = await pending({ studentId: id(key), letter, docNumber: w.no(n), docDate: DATE });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      let c = await w.coop(key);
      expect(c.status).toBe(status);
      expect(c[`${prefix}DraftNumber`]).toBe(w.no(n));
      r = await pending({ studentId: id(key), letter, cancel: true });
      expect(r.status).toBe(200);
      c = await w.coop(key);
      expect(c.status).toBe(status);
      expect(c[`${prefix}PendingAt`]).toBeNull();
      expect(c[`${prefix}DraftNumber`]).toBeNull();
    });
  }
});

// ══════════════════════════════════════════════════════
// B. รอลงนามอยู่ = ร่างที่ส่งไปเซ็นแล้ว — ออกร่างเลขอื่นทับไม่ได้
// ══════════════════════════════════════════════════════
test.describe("B. รอลงนามอยู่ห้ามออกร่างเลขอื่นทับ", () => {
  test("รายคน: เลขอื่น 409 · เลขเดิมได้ (โหลดซ้ำ) · ยกเลิกแล้วออกเลขใหม่ได้", async () => {
    expect((await pending({ studentId: id("reqA1"), letter: "REQUEST", docNumber: w.no(110), docDate: DATE })).status).toBe(200);
    const clash = await pending({ studentId: id("reqA1"), letter: "REQUEST", docNumber: w.no(111), docDate: DATE });
    expect(clash.status).toBe(409);
    expect(clash.body.message).toContain("ยกเลิกรอลงนาม");
    expect((await w.coop("reqA1")).reqLetterDraftNumber).toBe(w.no(110));
    expect((await pending({ studentId: id("reqA1"), letter: "REQUEST", docNumber: w.no(110), docDate: DATE })).status).toBe(200);
    expect((await pending({ studentId: id("reqA1"), letter: "REQUEST", cancel: true })).status).toBe(200);
    expect((await pending({ studentId: id("reqA1"), letter: "REQUEST", docNumber: w.no(111), docDate: DATE })).status).toBe(200);
  });

  test("ออกร่างหลายคน: มีคนรอลงนามในชุด → 409 ไม่ติดป้ายใครเลย · ไม่มีใครรอ → ติดป้ายทุกฉบับ", async () => {
    await pending({ studentId: id("reqA1"), letter: "REQUEST", docNumber: w.no(112), docDate: DATE });
    const bulk = (letters: object[]) => api(staff(), "PUT", "/api/admin/t000/letter-pending-bulk", { letter: "REQUEST", docDate: DATE, letters });
    let r = await bulk([{ studentIds: [id("reqA1"), id("reqA2")], docNumber: w.no(120) }, { studentIds: [id("reqB")], docNumber: w.no(121) }]);
    expect(r.status).toBe(409);
    expect(r.body.message).toContain("รอลงนามอยู่");
    expect((await w.coop("reqA2")).reqLetterPendingAt).toBeNull();
    expect((await w.coop("reqA1")).reqLetterDraftNumber).toBe(w.no(112));

    await w.clearPending();
    r = await bulk([{ studentIds: [id("reqA1"), id("reqA2")], docNumber: w.no(120) }, { studentIds: [id("reqB")], docNumber: w.no(121) }]);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect((await w.coop("reqA2")).reqLetterDraftNumber).toBe(w.no(120));
    expect((await w.coop("reqB")).reqLetterDraftNumber).toBe(w.no(121));
  });
});

// ══════════════════════════════════════════════════════
// C. เลขที่หนังสือ — ชุดเดียวกันทุกประเภท
// ══════════════════════════════════════════════════════
test.describe("C. เลขที่ห้ามซ้ำข้ามประเภท", () => {
  test("ส่งตัวใช้เลขที่ออกเป็นขอความอนุเคราะห์แล้ว (ของคนอื่น / ของตัวเอง) → 409", async () => {
    let r = await pending({ studentId: id("placeStaff"), letter: "PLACEMENT", docNumber: w.no(1), docDate: DATE });
    expect(r.status).toBe(409);
    expect(r.body.message).toContain("ถูกใช้เป็นหนังสือขอความอนุเคราะห์");
    r = await pending({ studentId: id("place"), letter: "PLACEMENT", docNumber: w.no(1), docDate: DATE });
    expect(r.status, "ต่างประเภทห้ามแม้เป็นคนเดียวกัน").toBe(409);
  });

  test("เลขในร่างที่รอลงนามของอีกประเภท → 409 บอกให้ยกเลิกรอลงนามของคนนั้น", async () => {
    expect((await pending({ studentId: id("reqA1"), letter: "REQUEST", docNumber: w.no(130), docDate: DATE })).status).toBe(200);
    const r = await pending({ studentId: id("place"), letter: "PLACEMENT", docNumber: w.no(130), docDate: DATE });
    expect(r.status).toBe(409);
    expect(r.body.message).toContain("อยู่ในร่างหนังสือขอความอนุเคราะห์ที่รอลงนาม");
  });

  test("หนังสือขอนิเทศชนเลขส่งตัว · เลขในร่างขอนิเทศชนกับขอความอนุเคราะห์", async () => {
    let r = await supPending({ docNumber: w.no(6), docDate: DATE });
    expect(r.status, "เลขส่งตัวของ intern เอง").toBe(409);
    expect(r.body.message).toContain("ถูกใช้เป็นหนังสือส่งตัว");
    expect((await supPending({ docNumber: w.no(131), docDate: DATE })).status).toBe(200);
    r = await pending({ studentId: id("reqB"), letter: "REQUEST", docNumber: w.no(131), docDate: DATE });
    expect(r.status).toBe(409);
    expect(r.body.message).toContain("อยู่ในร่างหนังสือขอนิเทศที่รอลงนาม");
  });

  test("ที่ยังทำได้: หนังสือรวมใช้เลขเดียวกันหลายคน · พิมพ์ซ้ำคนเดิมใช้เลขเดิมของตัวเอง", async () => {
    expect((await pending({ studentIds: [id("reqA1"), id("reqA2")], letter: "REQUEST", docNumber: w.no(132), docDate: DATE })).status).toBe(200);
    expect((await pending({ studentId: id("intern"), letter: "PLACEMENT", docNumber: w.no(6), docDate: DATE })).status).toBe(200);
  });
});

// ══════════════════════════════════════════════════════
// D. หน้าเว็บจริง (เจ้าหน้าที่) — ปุ่ม/ป้าย/หน้าต่าง ตามสถานะ
// ══════════════════════════════════════════════════════
async function asStaff(page: Page, theme: "light" | "dark" = "light") {
  await page.goto("/");
  await page.evaluate(([t, uid, th]) => {
    localStorage.clear();
    localStorage.setItem("coop.token", t); localStorage.setItem("coop.userId", uid); localStorage.setItem("coop.theme", th);
  }, [w.staff.token, String(w.staff.userId), theme]);
}
async function openT000(page: Page, studentId: string) {
  await page.goto("/admin/doct000", { waitUntil: "networkidle" });
  await page.locator("select", { has: page.locator('option[value="all"]', { hasText: "ทุกปีการศึกษา" }) }).selectOption(String(w.periodId));
  await page.getByPlaceholder(/ค้นหา/).first().fill(studentId);
  return page.locator("tbody tr", { hasText: studentId });
}
async function confirmDialog(page: Page) {
  const dlg = page.locator('[role="dialog"][aria-modal="true"]');
  await dlg.last().waitFor({ state: "visible" });
  await dlg.last().locator("button").last().click();
}

test.describe("D. หน้า T000 ตามสถานะ", () => {
  test("รอลงนาม: ปุ่มแถว = อัปโหลดฉบับลงนาม · หน้าต่างปิดปุ่มสร้าง · ยกเลิกในหน้าต่างแล้วสร้างได้ · ปิดหน้าต่างปุ่มแถวกลับ", async ({ page }) => {
    await asStaff(page);
    let row = await openT000(page, w.s.reqA1.studentId);
    await expect(row.getByRole("button", { name: "ออกหนังสือขอความอนุเคราะห์" })).toBeVisible();

    await pending({ studentId: id("reqA1"), letter: "REQUEST", docNumber: w.no(150), docDate: DATE });
    row = await openT000(page, w.s.reqA1.studentId);
    await expect(row.getByText(/รอลงนามหนังสือขอความอนุเคราะห์/)).toBeVisible();
    await row.getByRole("button", { name: "อัปโหลดฉบับลงนาม" }).click();

    const modal = page.locator(".letter-modal-card");
    await expect(modal.getByRole("button", { name: "📄 PDF" })).toBeDisabled();
    await expect(modal.getByRole("button", { name: "📝 Word" })).toBeDisabled();
    await expect(modal.getByText(/สร้างเอกสารใหม่ไม่ได้/)).toBeVisible();

    await modal.getByRole("button", { name: "ยกเลิกรอลงนาม" }).click();
    await confirmDialog(page);
    await expect(modal.getByText("✍️ รอลงนาม")).toBeHidden();
    await expect(modal.getByRole("button", { name: "📄 PDF" })).toBeEnabled();
    await expect(modal.getByRole("button", { name: "📝 Word" })).toBeEnabled();

    await modal.locator(".modal-close").click();
    await expect(row.getByRole("button", { name: "ออกหนังสือขอความอนุเคราะห์" })).toBeVisible();
    const c = await w.coop("reqA1");
    expect(c.status).toBe("DOCS_APPROVED");
    expect(c.reqLetterPendingAt).toBeNull();
  });

  test("คนที่ฝึกสหกิจอยู่แล้ว: ป้ายสถานะ \"อยู่ระหว่างฝึกสหกิจ\" · ปุ่ม \"พิมพ์ซ้ำ\"", async ({ page }) => {
    await asStaff(page);
    const row = await openT000(page, w.s.intern.studentId);
    await expect(row.getByText("อยู่ระหว่างฝึกสหกิจ")).toBeVisible();
    await expect(row.getByRole("button", { name: "พิมพ์ซ้ำ" }).first()).toBeVisible();
  });

  test("ออกร่างหลายคน: คนที่รอลงนามติ๊กไม่ได้ (บอกเหตุผล) · คนอื่นติ๊กได้", async ({ page }) => {
    await pending({ studentId: id("reqA1"), letter: "REQUEST", docNumber: w.no(151), docDate: DATE });
    await asStaff(page);
    await openT000(page, w.s.reqA1.studentId);
    await page.getByPlaceholder(/ค้นหา/).first().fill("");
    await page.getByRole("button", { name: "ออกร่างหนังสือหลายคน" }).click();
    const blocked = page.locator("label", { hasText: w.s.reqA1.studentId });
    await expect(blocked.getByText(/รอลงนามอยู่ \(เลข .*\) — ยกเลิกรอลงนาม/)).toBeVisible();
    await expect(blocked.locator('input[type="checkbox"]')).toBeDisabled();
    await expect(page.locator("label", { hasText: w.s.reqA2.studentId }).locator('input[type="checkbox"]')).toBeEnabled();
  });

  test("กล่องแจ้งเตือนธีมมืดพื้นทึบ (เดิมโปร่ง เห็นปุ่มของหน้าทะลุ)", async ({ page }) => {
    await asStaff(page, "dark");
    await page.goto("/admin/doct000", { waitUntil: "networkidle" });
    await page.evaluate(async () => { const { notify } = await import("/src/utils/notify.ts"); notify.success("ทดสอบ"); notify.error("ทดสอบ"); });
    const bgs = await page.locator("[data-toast-type]").evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
    expect(bgs.length).toBe(2);
    for (const bg of bgs) expect(bg, "พื้นต้องไม่มีความโปร่ง (rgba … < 1)").toMatch(/^rgb\(/);
  });
});

// ══════════════════════════════════════════════════════
// E. ออกหนังสือ/นักศึกษาโหลด → สถานะ (ทำหลังสุด เพราะเปลี่ยนสถานะจริง)
// ══════════════════════════════════════════════════════
test.describe("E. ออกหนังสือและนักศึกษาโหลด → สถานะ", () => {
  test("ส่งตัว เจ้าหน้าที่จัดส่ง → ฝึกสหกิจทันที · บันทึกเลข · ล้างป้ายรอลงนาม", async () => {
    await pending({ studentId: id("placeStaff"), letter: "PLACEMENT", docNumber: w.no(140), docDate: DATE });
    const r = await api(staff(), "PUT", "/api/admin/t000/review", signedForm({
      studentId: id("placeStaff"), status: "PLACEMENT_LETTER_ISSUED", docType: "PLACEMENT_LETTER", deliveryMethod: "STAFF",
      placeDocNumber: w.no(140), placeDocDate: DATE, comment: "e2e",
    }));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const c = await w.coop("placeStaff");
    expect(c.status).toBe("INTERNSHIP_STARTED");
    expect(c.placeDocNumber).toBe(w.no(140));
    expect(c.placeLetterPendingAt).toBeNull();
  });

  test("ส่งตัว นักศึกษารับเอง → ออกหนังสือส่งตัวแล้ว → นักศึกษาโหลด → ฝึกสหกิจ · โหลดซ้ำ 400", async () => {
    const r = await api(staff(), "PUT", "/api/admin/t000/review", signedForm({
      studentId: id("place"), status: "PLACEMENT_LETTER_ISSUED", docType: "PLACEMENT_LETTER", deliveryMethod: "STUDENT",
      placeDocNumber: w.no(141), placeDocDate: DATE, comment: "e2e",
    }));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect((await w.coop("place")).status).toBe("PLACEMENT_LETTER_ISSUED");
    expect((await api(w.s.place.token, "POST", "/api/students/download-placement-letter")).status).toBe(200);
    expect((await w.coop("place")).status).toBe("INTERNSHIP_STARTED");
    expect((await api(w.s.place.token, "POST", "/api/students/download-placement-letter")).status).toBe(400);
  });

  test("นักศึกษาโหลดหนังสือขอความอนุเคราะห์ → รอใบตอบรับ · สถานะอื่นกดไม่ได้", async () => {
    expect((await api(w.s.reqIssued.token, "POST", "/api/students/acknowledge-dispatch")).status).toBe(200);
    expect((await w.coop("reqIssued")).status).toBe("WAITING_FOR_PLACEMENT_LETTER");
    expect((await api(w.s.reqIssued.token, "POST", "/api/students/acknowledge-dispatch")).status).toBe(400);
    expect((await api(w.s.reqA2.token, "POST", "/api/students/acknowledge-dispatch")).status).toBe(400);
  });

  test("ออกหนังสือขอความอนุเคราะห์ด้วยเลขที่ใช้แล้ว → 409 · เลขใหม่ → ออกหนังสือแล้ว", async () => {
    const issue = (n: string) => api(staff(), "PUT", "/api/admin/t000/review", signedForm({
      studentId: id("reqB"), status: "REQ_LETTER_ISSUED", docType: "DISPATCH_LETTER", deliveryMethod: "STUDENT",
      reqDocNumber: n, reqDocDate: DATE, comment: "e2e",
    }));
    const r = await issue(w.no(7));
    expect(r.status).toBe(409);
    expect((await w.coop("reqB")).status).toBe("DOCS_APPROVED");
    expect((await issue(w.no(142))).status).toBe(200);
    expect((await w.coop("reqB")).status).toBe("REQ_LETTER_ISSUED");
  });
});
