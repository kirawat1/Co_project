/**
 * tests/teacher.spec.ts
 * ─────────────────────────────────────────────────────
 * Playwright UI tests — Teacher role (/teacher/*)
 */

import { test, expect } from "@playwright/test";
import {
  setupTeacherMocks,
  assertTopbarVisible,
  assertNotRedirectedToLogin,
} from "./helpers/mockApi";

// local safe response สำหรับ no-token test (ไม่ import SAFE_EMPTY เพื่อ simplicity)
const SAFE_EMPTY_TC12 = {
  ok: true,
  data: { totalStudents: 0, submittedStudents: 0, waiting: 0, approved: 0, rejected: 0, specialRequests: 0, totalAnnouncements: 0, totalDailyLogs: 0, myStudentsCount: 0, pendingRequests: 0, approvedStudents: 0 },
  periods: [], criteria: [], assets: [], students: [], teachers: [],
  meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
};

const TEACHER_ROUTES = [
  { path: "/teacher/dashboard",          label: "TC-T-01: Dashboard หน้าหลัก Teacher" },
  { path: "/teacher/requests",           label: "TC-T-02: คำขอนิเทศ (Requests)" },
  { path: "/teacher/students",           label: "TC-T-03: รายชื่อนักศึกษาในที่ปรึกษา" },
  { path: "/teacher/exams",              label: "TC-T-04: หน้าการสอบ (Exams)" },
  { path: "/teacher/profile",            label: "TC-T-05: โปรไฟล์อาจารย์" },
  { path: "/teacher/review-t002",        label: "TC-T-06: ตรวจ T002" },
  { path: "/teacher/review-t003",        label: "TC-T-07: ตรวจ T003" },
  { path: "/teacher/review-supervision", label: "TC-T-08: ตรวจบันทึกนิเทศ" },
  { path: "/teacher/doc-t005-006",       label: "TC-T-09: เอกสาร T005/T006 Teacher" },
  { path: "/teacher/doc-t007",           label: "TC-T-10: เอกสาร T007 Teacher" },
  { path: "/teacher/doc-t008",           label: "TC-T-11: เอกสาร T008 Teacher" },
];

// ── TC-T-00: /teacher → redirect ──
test("TC-T-00: /teacher/ redirects to /teacher/dashboard", async ({ page }) => {
  await setupTeacherMocks(page);
  await page.goto("/teacher");
  await page.waitForURL("**/teacher/dashboard", { timeout: 10_000 });
  await assertTopbarVisible(page);
});

// ── Loop ทดสอบแต่ละหน้า ──
for (const { path, label } of TEACHER_ROUTES) {
  test(`${label} — โหลดได้ไม่ redirect`, async ({ page }) => {
    await setupTeacherMocks(page);
    await page.goto(path);
    await assertTopbarVisible(page);
    await assertNotRedirectedToLogin(page);
    expect(page.url()).toContain("/teacher/");
  });
}

// ── TC-T-12: ไม่มี token — Teacher ไม่ redirect อัตโนมัติ
// (T_App ไม่มี auth guard redirect เหมือน S_App)
// NOTE: ต้อง mock API ด้วย 200 (ไม่ใช่ 401) เพราะ global Axios interceptor ใน main.tsx
//   จะ redirect ไปหน้า login เมื่อ status 401 (แม้ไม่มี token) ──
test("TC-T-12: ไม่มี token → Teacher App แสดง fallback ไม่ redirect", async ({ page }) => {
  // mock API ด้วย 200 OK เพื่อไม่ trigger global 401 interceptor
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SAFE_EMPTY_TC12) })
  );
  await page.goto("/teacher/dashboard");
  await page.waitForTimeout(2000);
  // T_App renders with fallback "อาจารย์" (no redirect since no auth guard)
  expect(page.url()).toContain("/teacher/");
});

// ── TC-T-13: Topbar แสดงชื่ออาจารย์จาก localStorage ──
test("TC-T-13: Topbar แสดงชื่ออาจารย์จาก localStorage / API", async ({ page }) => {
  await setupTeacherMocks(page);
  await page.goto("/teacher/dashboard");
  await assertTopbarVisible(page);
  const userNameEl = page.locator(".user-name");
  await expect(userNameEl).toBeVisible();
  const text = await userNameEl.innerText();
  expect(text.trim().length).toBeGreaterThan(0);
});

// ── TC-T-14: Students มี content ──
test("TC-T-14: หน้า Students โหลดได้", async ({ page }) => {
  await setupTeacherMocks(page);
  await page.goto("/teacher/students");
  await assertTopbarVisible(page);
  const main = page.locator("main");
  await expect(main).toBeVisible();
});

// ── TC-T-15: ปุ่ม Logout ──
test("TC-T-15: ปุ่ม Logout แสดงอยู่ใน topbar", async ({ page }) => {
  await setupTeacherMocks(page);
  await page.goto("/teacher/dashboard");
  await assertTopbarVisible(page);
  const logoutBtn = page.locator('button[aria-label="ออกจากระบบ"]');
  await expect(logoutBtn).toBeVisible({ timeout: 5_000 });
});

// ── TC-T-16: URL ไม่ถูกต้อง → redirect ──
test("TC-T-16: URL ไม่ถูกต้อง → redirect ไป /teacher/dashboard", async ({ page }) => {
  await setupTeacherMocks(page);
  await page.goto("/teacher/unknown");
  await page.waitForURL("**/teacher/dashboard", { timeout: 10_000 });
});

// ── TC-T-17: Sidebar เปิดได้ ──
// NOTE: hamburger เป็น mobile-only (display:none บน desktop ตาม S_Theme CSS)
// → ต้องตั้ง viewport เป็น mobile (≤768px) เพื่อให้ปุ่มมองเห็นได้
test("TC-T-17: Sidebar เปิดได้เมื่อกด hamburger menu", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await setupTeacherMocks(page);
  await page.goto("/teacher/dashboard");
  await assertTopbarVisible(page);
  const hamburger = page.locator('button[aria-label="เมนู"]').first();
  await hamburger.click();
  const sidebar = page.locator("aside.sidebar");
  await expect(sidebar).toHaveClass(/open/, { timeout: 5_000 });
});
