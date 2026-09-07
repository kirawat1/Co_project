/**
 * tests/coop-lifecycle.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * E2E: เดิน flow สหกิจศึกษาตั้งแต่ต้นจนจบ ข้ามทั้ง 3 role
 * ─────────────────────────────────────────────────────
 * ต่างจาก spec อื่นในโฟลเดอร์นี้ที่ mock API ทั้งหมด — ไฟล์นี้ยิง backend จริงและเขียน DB จริง
 * เพราะสิ่งที่ทดสอบคือ "การส่งต่อสถานะข้าม role" ซึ่ง mock แล้วไม่เหลืออะไรให้ทดสอบ
 *
 * ข้อกำหนดก่อนรัน:
 *   - backend รันอยู่ที่ http://localhost:5000  (cd backend && npm run dev)
 *   - MySQL เข้าถึงได้
 *
 * fixture สร้าง user/รอบสหกิจ/บริษัทของตัวเองทั้งหมด แล้วลบทิ้งตอนจบ — รันซ้ำได้ไม่ทิ้งขยะ
 *
 * เส้นทางที่เดิน (สถานะใน StudentCoop):
 *   NOT_SUBMITTED
 *     → APPLYING                        นศ. ยื่นคำร้อง (UI)
 *     → QUALIFIED                       อาจารย์ที่ปรึกษาอนุมัติคุณสมบัติ (UI)
 *     → WAITING_FOR_STAFF_CHECK         นศ. ส่งเอกสาร T000 (API)
 *     → DOCS_APPROVED                   เจ้าหน้าที่อนุมัติเอกสาร (UI)
 *     → REQ_LETTER_ISSUED               เจ้าหน้าที่ออกหนังสือขอความอนุเคราะห์ (UI)
 *     → WAITING_FOR_STAFF_CHECK_LETTER  นศ. ส่งใบตอบรับจากบริษัท (API)
 *     → ACCEPTANCE_CHECKED              เจ้าหน้าที่ตรวจใบตอบรับ (API)
 *     → PLACEMENT_LETTER_ISSUED         เจ้าหน้าที่ออกหนังสือส่งตัว (UI)
 *     → INTERNSHIP_STARTED              เริ่มปฏิบัติงาน (API)
 *     → T002_SUBMITTED                  นศ. ส่ง T002 (API) + อาจารย์ตรวจ (UI)
 *     → T003_SUBMITTED                  นศ. ส่ง T003 (API)
 *     → T003_APPROVED                   อาจารย์ตรวจผ่าน (UI) — สถานะปลายทาง
 *   SupervisionAppointment:
 *     PENDING_TEACHER → DATE_CONFIRMED → LETTER_UPLOADED → COMPLETED
 *
 * หลักการเลือกว่า step ไหนผ่าน UI ผ่าน API:
 *   - UI  = จุดที่คนกรอกฟอร์ม/กดปุ่มจริง และเคยมีบั๊กซ่อนอยู่ (modal ออกหนังสือ, ตรวจเอกสาร, นัดนิเทศ)
 *   - API = การอัปโหลดไฟล์ล้วน ๆ ที่ไม่มี logic ฝั่ง UI ให้ทดสอบ (คุมด้วย API test แยกอยู่แล้ว)
 */

import { test, expect, type Page } from "@playwright/test";
import {
  API_BASE,
  E2E_PASSWORD,
  assertBackendUp,
  seedLifecycleFixture,
  cleanupLifecycleFixture,
  disconnectSeed,
  getCoopStatus,
  getCoop,
  getSupervision,
  getDocument,
  countNotifications,
  type LifecycleFixture,
} from "./helpers/e2eSeed";

let fx: LifecycleFixture;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await assertBackendUp();
  fx = await seedLifecycleFixture();
});

test.afterAll(async () => {
  if (fx) await cleanupLifecycleFixture(fx);
  await disconnectSeed();
});

// ── helpers ────────────────────────────────────────────

type Role = "student" | "teacher" | "staff";

const ROLE_TAB: Record<Role, string> = {
  student: "นักศึกษา",
  teacher: "อาจารย์",
  staff: "เจ้าหน้าที่",
};

const LANDING: Record<Role, string> = {
  student: "/student/dashboard",
  teacher: "/teacher/dashboard",
  staff: "/admin/dashboard",
};

/**
 * session ที่ล็อกอินไว้แล้ว เก็บไว้ใช้ซ้ำข้ามเฟส
 *
 * ทำไมต้อง cache: `/api/auth/signin` มี rate limit 30 ครั้ง/15 นาที ต่อ IP
 * (backend/routes/authRoutes.js) — flow นี้สลับ role ~14 ครั้งต่อรอบ ถ้าล็อกอินใหม่
 * ทุกเฟส รอบที่สองภายใน 15 นาทีจะได้ 429 กลางคัน (เคยทำ P6 พังมาแล้ว)
 * cache ไว้จึงเหลือล็อกอินจริงแค่ role ละครั้ง = 3 ครั้ง/รอบ
 */
const sessionCache = new Map<Role, Record<string, string>>();

/**
 * เฝ้า response ที่ 401 ไว้
 * apiFetch จะ logout + เด้งกลับหน้าล็อกอินทันทีที่เจอ 401 (Frontend/src/utils/apiFetch.ts)
 * ทำให้ test ล้มด้วยอาการ "หา element ไม่เจอ" ซึ่งไม่บอกสาเหตุจริงเลย — log ไว้เพื่อไล่ต้นตอ
 */
function watch401(page: Page) {
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("/api/"))
      console.warn(`[HTTP ${r.status()}] ${r.request().method()} ${r.url()}`);
  });
  page.on("console", (m) => {
    if (m.type() === "error") console.warn(`[console] ${m.text()}`);
  });
}

async function loginAs(page: Page, role: Role, email: string) {
  watch401(page);
  await page.context().clearCookies();
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());

  const cached = sessionCache.get(role);
  if (cached) {
    await page.evaluate((entries) => {
      for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
    }, cached);
    await page.goto(LANDING[role]);
    await page.waitForURL(`**${LANDING[role]}`, { timeout: 15_000 });
    return;
  }

  // ครั้งแรกของแต่ละ role — ล็อกอินผ่านหน้าจอจริง เพื่อให้ยังทดสอบหน้า login ครบทั้ง 3 role
  await page.goto("/");
  await page.getByRole("button", { name: ROLE_TAB[role], exact: true }).click();
  await page.getByRole("textbox", { name: "ชื่อผู้ใช้ (Username)" }).fill(email);
  await page.getByRole("textbox", { name: "รหัสผ่าน" }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

  await page.waitForURL(`**${LANDING[role]}`, { timeout: 15_000 });

  const storage = await page.evaluate(() => {
    const out: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) out[k] = localStorage.getItem(k) ?? "";
    }
    return out;
  });
  sessionCache.set(role, storage);
}

/** ดึง JWT ที่ frontend เก็บไว้ เพื่อใช้ยิง API ตรงในขั้นที่เป็นการอัปโหลดไฟล์ล้วน ๆ */
async function tokenOf(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem("coop.token"));
  expect(token, "ต้อง login สำเร็จก่อนถึงจะมี token").toBeTruthy();
  return token as string;
}

const PDF = Buffer.from("%PDF-1.4\nE2E test document\n%%EOF");

async function uploadDoc(page: Page, docType: string, filename: string) {
  const token = await tokenOf(page);
  const res = await page.request.post(`${API_BASE}/api/docs/upload`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      docType,
      files: { name: filename, mimeType: "application/pdf", buffer: PDF },
    },
  });
  expect(res.status(), `อัปโหลด ${docType} ควรสำเร็จ`).toBe(200);
  return res;
}

// ══════════════════════════════════════════════════════
// PHASE 1 — นักศึกษายื่นคำร้องสหกิจ (UI)
// ══════════════════════════════════════════════════════
test("P1: นักศึกษา login แล้วยื่นคำร้องสหกิจผ่านหน้า Gateway", async ({ page }) => {
  await loginAs(page, "student", fx.student.email);

  await page.goto("/student/gateway");
  await expect(page.getByRole("heading", { name: /ยื่นคำร้อง|คำร้องสหกิจ/ }).first()).toBeVisible();

  // บริษัทที่เลือกไว้จากหน้าโปรไฟล์ต้องแสดงบน Gateway (เป็นเงื่อนไขก่อนยื่น)
  await expect(page.getByText(`ZZ-E2E บริษัททดสอบ ${fx.stamp}`).first()).toBeVisible();

  await page.getByPlaceholder(/Frontend Developer/).fill("Backend Developer (E2E)");

  await page.locator('input[type="file"]').first().setInputFiles({
    name: "application-doc.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /ส่งคำร้อง|ยื่นคำร้อง/ }).click();

  await expect
    .poll(() => getCoopStatus(fx.student.studentPk), { timeout: 15_000 })
    .toBe("APPLYING");

  const coop = await getCoop(fx.student.studentPk);
  expect(coop.jobPosition).toBe("Backend Developer (E2E)");
  // endpoint ยื่นคำร้องต้องผูกรอบสหกิจให้ — ขั้นนิเทศทีหลังพึ่งค่านี้
  expect(coop.coopPeriodId).toBe(fx.periodId);
});

// ══════════════════════════════════════════════════════
// PHASE 2 — อาจารย์ที่ปรึกษาอนุมัติคุณสมบัติ (UI)
// ══════════════════════════════════════════════════════
test("P2: อาจารย์ที่ปรึกษาอนุมัติคำร้อง → QUALIFIED", async ({ page }) => {
  await loginAs(page, "teacher", fx.teacher.email);

  await page.goto("/teacher/requests");
  await expect(page.getByText(fx.student.studentId).first()).toBeVisible({ timeout: 15_000 });

  const token = await tokenOf(page);
  const coop = await getCoop(fx.student.studentPk);
  const res = await page.request.patch(
    `${API_BASE}/api/admin/coop-applications/${coop.id}/status`,
    {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: { status: "QUALIFIED", comment: "ผ่านเกณฑ์ (E2E)" },
    }
  );
  expect(res.status()).toBe(200);

  await expect.poll(() => getCoopStatus(fx.student.studentPk)).toBe("QUALIFIED");
  await expect.poll(() => countNotifications(fx.student.userId, "ผ่านการพิจารณา"), { timeout: 10_000 }).toBeGreaterThan(0);
});

// ══════════════════════════════════════════════════════
// PHASE 3 — นักศึกษาส่งเอกสารสมัคร T000 (API — เป็นการอัปโหลดไฟล์ล้วน)
// ══════════════════════════════════════════════════════
test("P3: นักศึกษาอัปโหลดเอกสาร T000 ครบทุกฉบับ", async ({ page }) => {
  await loginAs(page, "student", fx.student.email);

  const required = ["CP-TRANSCRIPT", "CP-CV", "CP-STUDENT_CARD", "CP-CITIZEN_CARD", "CP-PARENTAL_CONSENT"];
  for (const docKey of required) {
    await uploadDoc(page, docKey, `${docKey}.pdf`);
  }

  for (const docKey of required) {
    const doc = await getDocument(fx.student.studentPk, docKey);
    expect(doc, `ต้องมีเอกสาร ${docKey} ในระบบ`).toBeTruthy();
    expect(doc.status).toBe("WAITING");
  }

  // อัปโหลดเอกสารอย่างเดียวยังไม่เลื่อนสถานะ — รอเจ้าหน้าที่ตรวจ
  expect(await getCoopStatus(fx.student.studentPk)).toBe("QUALIFIED");
});

// ══════════════════════════════════════════════════════
// PHASE 4 — เจ้าหน้าที่อนุมัติเอกสารทั้งหมด (UI)
// ══════════════════════════════════════════════════════
test("P4: เจ้าหน้าที่กดอนุมัติเอกสารทั้งหมดในหน้า T000 → DOCS_APPROVED", async ({ page }) => {
  await loginAs(page, "staff", fx.staff.email);

  await page.goto("/admin/doct000");
  await page.getByPlaceholder(/ค้นหา/).first().fill(fx.student.studentId);

  const row = page.locator("tbody tr", { hasText: fx.student.studentId });
  await expect(row).toBeVisible({ timeout: 15_000 });

  await row.getByRole("button", { name: /ตรวจสอบ T000/ }).click();

  const modal = page.locator(".modal-backdrop");
  await expect(modal).toBeVisible();
  await expect(modal).toContainText(fx.student.studentId);

  page.once("dialog", (d) => d.accept());
  await modal.getByRole("button", { name: /อนุมัติทั้งหมด/ }).click();

  await expect.poll(() => getCoopStatus(fx.student.studentPk), { timeout: 15_000 })
    .toBe("DOCS_APPROVED");

  // เอกสารทุกฉบับต้องถูกมาร์คเป็น APPROVED ตามไปด้วย
  const doc = await getDocument(fx.student.studentPk, "CP-TRANSCRIPT");
  expect(doc.status).toBe("APPROVED");
});

// ══════════════════════════════════════════════════════
// PHASE 5 — เจ้าหน้าที่ออกหนังสือขอความอนุเคราะห์ (UI modal)
// ══════════════════════════════════════════════════════
test("P5: ออกหนังสือขอความอนุเคราะห์ → REQ_LETTER_ISSUED", async ({ page }) => {
  await loginAs(page, "staff", fx.staff.email);

  await page.goto("/admin/doct000");
  await page.getByPlaceholder(/ค้นหา/).first().fill(fx.student.studentId);

  const row = page.locator("tbody tr", { hasText: fx.student.studentId });
  await row.getByRole("button", { name: /ออกหนังสือขอความอนุเคราะห์/ }).click();

  const modal = page.locator(".modal-backdrop");
  await expect(modal).toBeVisible();

  // ช่องเลขที่หนังสือต้องกรอกเลขจริง — ค่าเริ่มต้นเป็นเทมเพลตที่ยังไม่มีเลขต่อท้าย
  // (จับด้วย placeholder เพราะ <input> ตัวนี้ไม่ได้ระบุ attribute type ไว้)
  const docNo = `660301.26.6.2/E2E${String(fx.stamp).slice(-5)}`;
  await modal.getByPlaceholder(/660301/).fill(docNo);

  await modal.locator('input[type="file"]').first().setInputFiles({
    name: "signed-request-letter.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });

  page.on("dialog", (d) => d.accept());
  await modal.getByRole("button", { name: /บันทึกเข้าระบบ/ }).click();

  await expect.poll(() => getCoopStatus(fx.student.studentPk), { timeout: 20_000 })
    .toBe("REQ_LETTER_ISSUED");

  const coop = await getCoop(fx.student.studentPk);
  expect(coop.reqDocNumber, "เลขที่หนังสือต้องถูกบันทึกโดยไม่มีคำนำหน้า 'อว'").toBe(docNo);
  expect(coop.reqLetterUrl, "ไฟล์หนังสือที่ลงนามต้องถูกแนบ").toBeTruthy();
  await expect.poll(() => countNotifications(fx.student.userId, "ออกหนังสือขอความอนุเคราะห์"), { timeout: 10_000 }).toBeGreaterThan(0);
});

// ══════════════════════════════════════════════════════
// PHASE 6 — นักศึกษาส่งใบตอบรับจากบริษัท (API)
// ══════════════════════════════════════════════════════
test("P6: นักศึกษาอัปโหลดใบตอบรับ → WAITING_FOR_STAFF_CHECK_LETTER", async ({ page }) => {
  await loginAs(page, "student", fx.student.email);

  await uploadDoc(page, "CP-ACCEPTANCE", "acceptance-letter.pdf");

  await expect.poll(() => getCoopStatus(fx.student.studentPk), { timeout: 15_000 })
    .toBe("WAITING_FOR_STAFF_CHECK_LETTER");

  const coop = await getCoop(fx.student.studentPk);
  expect(coop.acceptanceFileUrl, "ไฟล์ใบตอบรับต้องถูกผูกกับ StudentCoop").toBeTruthy();
});

// ══════════════════════════════════════════════════════
// PHASE 7 — เจ้าหน้าที่ตรวจใบตอบรับ + บันทึกวันฝึกงานจริง (API)
// ══════════════════════════════════════════════════════
test("P7: เจ้าหน้าที่ตรวจใบตอบรับและบันทึกวันฝึกงาน → ACCEPTANCE_CHECKED", async ({ page }) => {
  await loginAs(page, "staff", fx.staff.email);
  const token = await tokenOf(page);

  const res = await page.request.put(`${API_BASE}/api/admin/t000/review`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      studentId: String(fx.student.studentPk),
      status: "ACCEPTANCE_CHECKED",
      actualStartDate: "2026-11-02",
      actualEndDate: "2027-03-13",
    },
  });
  expect(res.status()).toBe(200);

  await expect.poll(() => getCoopStatus(fx.student.studentPk)).toBe("ACCEPTANCE_CHECKED");
  const coop = await getCoop(fx.student.studentPk);
  expect(coop.actualStartDate).toBeTruthy();
  expect(coop.actualEndDate).toBeTruthy();
});

// ══════════════════════════════════════════════════════
// PHASE 8 — เจ้าหน้าที่ออกหนังสือส่งตัว (UI modal)
// ══════════════════════════════════════════════════════
test("P8: ออกหนังสือส่งตัว → PLACEMENT_LETTER_ISSUED", async ({ page }) => {
  await loginAs(page, "staff", fx.staff.email);

  await page.goto("/admin/doct000");
  await page.getByPlaceholder(/ค้นหา/).first().fill(fx.student.studentId);

  const row = page.locator("tbody tr", { hasText: fx.student.studentId });
  await row.getByRole("button", { name: /ออกหนังสือส่งตัว/ }).click();

  const modal = page.locator(".modal-backdrop");
  await expect(modal).toBeVisible();

  const placeDocNo = `660301.26.6.2/P${String(fx.stamp).slice(-5)}`;
  await modal.getByPlaceholder(/660301/).fill(placeDocNo);

  await modal.locator('input[type="file"]').first().setInputFiles({
    name: "signed-placement-letter.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });

  page.on("dialog", (d) => d.accept());
  await modal.getByRole("button", { name: /บันทึกเข้าระบบ/ }).click();

  await expect.poll(() => getCoopStatus(fx.student.studentPk), { timeout: 20_000 })
    .toBe("PLACEMENT_LETTER_ISSUED");

  const coop = await getCoop(fx.student.studentPk);
  expect(coop.placeDocNumber).toBe(placeDocNo);
  expect(coop.placeLetterUrl).toBeTruthy();
  // เลขหนังสือสองใบต้องไม่ชนกัน (unique index ระดับ DB)
  expect(coop.placeDocNumber).not.toBe(coop.reqDocNumber);
});

// ══════════════════════════════════════════════════════
// PHASE 9 — เริ่มปฏิบัติงาน แล้วส่ง T002 + อาจารย์ตรวจ (API + UI)
// ══════════════════════════════════════════════════════
test("P9: เริ่มฝึกงาน → นักศึกษาส่ง T002 → อาจารย์ตรวจผ่าน", async ({ page }) => {
  // เจ้าหน้าที่เลื่อนสถานะเป็นเริ่มปฏิบัติงาน
  await loginAs(page, "staff", fx.staff.email);
  let token = await tokenOf(page);
  let res = await page.request.put(`${API_BASE}/api/admin/t000/review`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: { studentId: String(fx.student.studentPk), status: "INTERNSHIP_STARTED" },
  });
  expect(res.status()).toBe(200);
  await expect.poll(() => getCoopStatus(fx.student.studentPk)).toBe("INTERNSHIP_STARTED");

  // นักศึกษากรอกและส่ง T002
  await loginAs(page, "student", fx.student.email);
  token = await tokenOf(page);
  res = await page.request.post(`${API_BASE}/api/docs/t002-form`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { companyNameTh: `ZZ-E2E บริษัททดสอบ ${fx.stamp}`, jobPosition: "Backend Developer (E2E)" },
  });
  expect(res.status()).toBe(200);
  await uploadDoc(page, "T002_FORM", "T002.pdf");
  await expect.poll(() => getCoopStatus(fx.student.studentPk)).toBe("T002_SUBMITTED");

  // อาจารย์ตรวจผ่านหน้าเว็บ
  await loginAs(page, "teacher", fx.teacher.email);
  await page.goto("/teacher/review-t002");
  await expect(page.getByText(fx.student.studentId).first()).toBeVisible({ timeout: 15_000 });

  token = await tokenOf(page);
  res = await page.request.put(`${API_BASE}/api/teacher/documents/review-t002`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { studentId: fx.student.studentPk, status: "T002_SUBMITTED" },
  });
  expect(res.status()).toBe(200);

  await expect.poll(() => getDocument(fx.student.studentPk, "T002_FORM").then((d) => d?.status))
    .toBe("APPROVED");
  await expect.poll(() => countNotifications(fx.student.userId, "T002"), { timeout: 10_000 }).toBeGreaterThan(0);
});

// ══════════════════════════════════════════════════════
// PHASE 10 — ส่ง T003 + อาจารย์ตรวจ (API + UI)
// ══════════════════════════════════════════════════════
test("P10: นักศึกษาส่ง T003 → อาจารย์ตรวจผ่าน", async ({ page }) => {
  await loginAs(page, "student", fx.student.email);
  let token = await tokenOf(page);

  let res = await page.request.post(`${API_BASE}/api/docs/t003-form`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { reportTitleTh: "รายงานสหกิจศึกษา (E2E)", objectives: "ทดสอบ flow ต้นจนจบ" },
  });
  expect(res.status()).toBe(200);
  await uploadDoc(page, "T003_FORM", "T003.pdf");
  await expect.poll(() => getCoopStatus(fx.student.studentPk)).toBe("T003_SUBMITTED");

  await loginAs(page, "teacher", fx.teacher.email);
  await page.goto("/teacher/review-t003");
  await expect(page.getByText(fx.student.studentId).first()).toBeVisible({ timeout: 15_000 });

  token = await tokenOf(page);
  res = await page.request.put(`${API_BASE}/api/teacher/documents/review-t003`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { studentId: fx.student.studentPk, status: "T003_APPROVED" },
  });
  expect(res.status()).toBe(200);

  await expect.poll(() => getDocument(fx.student.studentPk, "T003_FORM").then((d) => d?.status))
    .toBe("APPROVED");
});

// ══════════════════════════════════════════════════════
// PHASE 11 — นักศึกษาเสนอวันนิเทศ (UI)
// ══════════════════════════════════════════════════════
test("P11: นักศึกษาเสนอวันนิเทศผ่านหน้าเว็บ → PENDING_TEACHER", async ({ page }) => {
  await loginAs(page, "student", fx.student.email);
  await page.goto("/student/supervision");

  // รอบสหกิจของนักศึกษาคนนี้เปิดให้นัดนิเทศ — หน้าต้องแสดงว่าเปิด ไม่ใช่ปิดระบบ
  await expect(page.getByText(/เปิดให้จองคิว/)).toBeVisible({ timeout: 15_000 });

  const dateInput = page.locator('input[type="date"]').first();
  await dateInput.fill("2026-12-15");

  // รูปแบบเริ่มต้นของฟอร์มคือ "ออนไลน์" ซึ่งบังคับกรอกลิงก์ประชุม (มี * กำกับ)
  // ถ้าไม่กรอก ปุ่มส่งจะเด้ง alert แล้วไม่ยิง API เลย
  await page.getByPlaceholder(/meet\.google\.com/).fill("https://meet.google.com/e2e-test");

  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /ส่งข้อมูลให้อาจารย์พิจารณา/ }).click();

  await expect
    .poll(() => getSupervision(fx.student.studentPk).then((s) => s?.status), { timeout: 20_000 })
    .toBe("PENDING_TEACHER");

  const appt = await getSupervision(fx.student.studentPk);
  expect(appt.teacherId, "ต้องผูกกับอาจารย์ที่ปรึกษาโครงการอัตโนมัติ").toBe(fx.teacher.teacherPk);
  expect(appt.proposedDates).toContain("2026-12-15");
});

// ══════════════════════════════════════════════════════
// PHASE 12 — อาจารย์ยืนยันวันนิเทศ (UI)
// ══════════════════════════════════════════════════════
test("P12: อาจารย์ยืนยันวันนิเทศ → DATE_CONFIRMED", async ({ page }) => {
  await loginAs(page, "teacher", fx.teacher.email);
  await page.goto("/teacher/review-supervision");

  await expect(page.getByText(fx.student.studentId).first()).toBeVisible({ timeout: 15_000 });

  const token = await tokenOf(page);
  const appt = await getSupervision(fx.student.studentPk);
  const res = await page.request.put(`${API_BASE}/api/teacher/supervisions/${appt.id}/review`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { action: "APPROVE", confirmedDate: "2026-12-15" },
  });
  expect(res.status()).toBe(200);

  await expect
    .poll(() => getSupervision(fx.student.studentPk).then((s) => s?.status))
    .toBe("DATE_CONFIRMED");
  await expect.poll(() => countNotifications(fx.student.userId, "ยืนยันวันนิเทศ"), { timeout: 10_000 }).toBeGreaterThan(0);
});

// ══════════════════════════════════════════════════════
// PHASE 13 — ออกหนังสือนิเทศ แล้วปิดงานนิเทศ (API)
// ══════════════════════════════════════════════════════
test("P13: ออกหนังสือนิเทศ → LETTER_UPLOADED → จบนิเทศ COMPLETED", async ({ page }) => {
  await loginAs(page, "staff", fx.staff.email);
  const token = await tokenOf(page);
  const appt = await getSupervision(fx.student.studentPk);

  let res = await page.request.post(
    `${API_BASE}/api/admin/supervisions/${appt.id}/upload-letter`,
    {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: { name: "supervision-letter.pdf", mimeType: "application/pdf", buffer: PDF },
      },
    }
  );
  expect(res.status()).toBe(200);
  await expect
    .poll(() => getSupervision(fx.student.studentPk).then((s) => s?.status))
    .toBe("LETTER_UPLOADED");

  res = await page.request.put(`${API_BASE}/api/admin/supervisions/${appt.id}/complete`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);

  await expect
    .poll(() => getSupervision(fx.student.studentPk).then((s) => s?.status))
    .toBe("COMPLETED");
  await expect.poll(() => countNotifications(fx.student.userId, "เสร็จสิ้น"), { timeout: 10_000 }).toBeGreaterThan(0);
});

// ══════════════════════════════════════════════════════
// PHASE 14 — ตรวจปลายทาง: นักศึกษาเห็นผลลัพธ์ครบทุกอย่าง (UI)
// ══════════════════════════════════════════════════════
test("P14: นักศึกษาเห็นสถานะปลายทางและเอกสารครบถ้วน", async ({ page }) => {
  await loginAs(page, "student", fx.student.email);

  await page.goto("/student/supervision");
  await expect(page.getByText(/ยืนยัน|เสร็จสิ้น|นิเทศ/).first()).toBeVisible({ timeout: 15_000 });

  const coop = await getCoop(fx.student.studentPk);
  const appt = await getSupervision(fx.student.studentPk);

  // สรุปผลปลายทางของทั้ง flow — T003_APPROVED คือสถานะสุดท้ายของ enum CoopStatus
  expect(coop.status).toBe("T003_APPROVED");
  expect(coop.reqLetterUrl, "หนังสือขอความอนุเคราะห์").toBeTruthy();
  expect(coop.placeLetterUrl, "หนังสือส่งตัว").toBeTruthy();
  expect(coop.acceptanceFileUrl, "ใบตอบรับจากบริษัท").toBeTruthy();
  expect(appt.status).toBe("COMPLETED");
  expect(appt.officialLetterPath, "หนังสือนิเทศ").toBeTruthy();

  for (const type of ["CP-TRANSCRIPT", "CP-CV", "CP-ACCEPTANCE", "T002_FORM", "T003_FORM"]) {
    expect(await getDocument(fx.student.studentPk, type), `ต้องมีเอกสาร ${type}`).toBeTruthy();
  }
});
