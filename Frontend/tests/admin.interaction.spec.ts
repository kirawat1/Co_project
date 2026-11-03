/**
 * tests/admin.interaction.spec.ts
 * Admin role — interaction & render quality tests
 */
import { test, expect } from "@playwright/test";
import { setupAdminMocks } from "./helpers/mockApi";

// TC-AI-01: Dashboard — no JS errors after render
test("TC-AI-01: Admin Dashboard — ไม่มี JS error หลัง render", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await setupAdminMocks(page);
  await page.goto("/admin/dashboard");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await page.waitForTimeout(1500);

  expect(errors).toHaveLength(0);
});

// TC-AI-02: Students page — <main> visible, no JS errors
test("TC-AI-02: Admin Students page — main content visible", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await setupAdminMocks(page);
  await page.goto("/admin/students");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await expect(page.locator("main").first()).toBeVisible();
  await page.waitForTimeout(1000);

  expect(errors).toHaveLength(0);
});

// TC-AI-03: Announcements — renders empty list without crash
test("TC-AI-03: Admin Announcements — render ด้วย empty list ไม่ crash", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await setupAdminMocks(page);
  // A_Announcements fetches /api/admin/supervision-periods (ไม่ใช่ coop-periods)
  await page.route("**/api/admin/supervision-periods**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, periods: [] }) })
  );
  await page.route("**/api/announcements**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, list: [] }) })
  );
  await page.route("**/api/admin/majors**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, majors: [] }) })
  );

  await page.goto("/admin/announcements");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  // Verify no redirect — URL should contain /admin/
  expect(page.url()).toContain("/admin/");
  await page.waitForTimeout(1000);

  expect(errors).toHaveLength(0);
});

// TC-AI-04: Settings page — renders without crash
test("TC-AI-04: Admin Settings — render ด้วย empty assets ไม่ crash", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await setupAdminMocks(page);
  await page.goto("/admin/settings");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await expect(page.locator("main").first()).toBeVisible();
  await page.waitForTimeout(1000);

  expect(errors).toHaveLength(0);
});

// TC-AI-05: Criteria page — renders without crash
test("TC-AI-05: Admin Criteria — render ด้วย empty criteria ไม่ crash", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await setupAdminMocks(page);
  await page.goto("/admin/criteria");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await expect(page.locator("main").first()).toBeVisible();
  await page.waitForTimeout(1000);

  expect(errors).toHaveLength(0);
});

// TC-AI-06: รอบสหกิจ — ปุ่ม "💡 ดูตัวอย่างการกรอก" · ชื่อปุ่มที่ตัวอย่างบอกให้กดต้องมีจริงในหน้า (กันตัวอย่างเพี้ยนเมื่อเปลี่ยนชื่อปุ่ม)
test("TC-AI-06: Admin รอบสหกิจ — ตัวอย่างการกรอก · ชื่อปุ่มในตัวอย่างตรงกับปุ่มจริง", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await setupAdminMocks(page);
  const row = (major: string) => ({ periodId: 1, major, startDate: "2026-06-01", endDate: "2026-07-31", isActive: false, supervisionStartDate: null, supervisionEndDate: null, isSupervisionOpen: false });
  await page.route("**/api/admin/coop-periods", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, periods: [
      { id: 1, academicYear: "2569", semester: 2, startDate: "2026-06-01", endDate: "2026-07-31", isActive: false, majors: [row("CS"), row("IT")] },
    ] }) })
  );
  await page.route("**/api/admin/majors**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, majors: ["CS", "IT"] }) })
  );

  await page.goto("/admin/coop-period");
  const pageButtons = ["+ สร้างรอบใหม่", "📆 ปฏิทินของรอบ", "แก้วัน", "เอาออก", "เปิดรับสมัคร", "เปิดทุกหลักสูตร"];
  for (const name of pageButtons) await expect(page.getByRole("button", { name, exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "💡 ดูตัวอย่างการกรอก" }).click();
  const dialog = page.getByRole("dialog", { name: "💡 ตัวอย่างการกรอกรอบสหกิจ" });
  await expect(dialog).toBeVisible();
  for (const name of pageButtons) await expect(dialog.getByText(name, { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText("T000 เอกสารสมัคร")).toBeVisible();
  await expect(dialog.getByText("คัดลอกจากรอบก่อน", { exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "เข้าใจแล้ว" }).click();
  await expect(dialog).toHaveCount(0);
  expect(errors).toHaveLength(0);
});
