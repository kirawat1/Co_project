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
  await page.goto("/admin/announcements");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await expect(page.locator("main").first()).toBeVisible();
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
