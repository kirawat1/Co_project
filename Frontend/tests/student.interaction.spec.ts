/**
 * tests/student.interaction.spec.ts
 * Student role — interaction & render quality tests
 */
import { test, expect } from "@playwright/test";
import { setupStudentMocks } from "./helpers/mockApi";

// TC-SI-01: Dashboard — no JS errors
test("TC-SI-01: Student Dashboard — ไม่มี JS error หลัง render", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await setupStudentMocks(page);
  await page.goto("/student/dashboard");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await page.waitForTimeout(1500);

  expect(errors).toHaveLength(0);
});

// TC-SI-02: Daily page — <main> visible
test("TC-SI-02: Student Daily page — main content visible", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await setupStudentMocks(page);
  await page.goto("/student/daily");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await expect(page.locator("main").first()).toBeVisible();
  await page.waitForTimeout(1000);

  expect(errors).toHaveLength(0);
});

// TC-SI-03: Docs page — <main> visible
test("TC-SI-03: Student Docs page — main content visible", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await setupStudentMocks(page);
  await page.goto("/student/docs");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await expect(page.locator("main").first()).toBeVisible();
  await page.waitForTimeout(1000);

  expect(errors).toHaveLength(0);
});

// TC-SI-04: Company page — <main> visible
test("TC-SI-04: Student Company page — main content visible", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await setupStudentMocks(page);
  await page.goto("/student/company");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await expect(page.locator("main").first()).toBeVisible();
  await page.waitForTimeout(1000);

  expect(errors).toHaveLength(0);
});

// TC-SI-05: Status Tracker — no JS errors
test("TC-SI-05: Student Status Tracker — ไม่มี JS error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await setupStudentMocks(page);
  await page.goto("/student/status-tracker");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await page.waitForTimeout(1500);

  expect(errors).toHaveLength(0);
});
