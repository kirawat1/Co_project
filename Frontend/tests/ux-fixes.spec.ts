/**
 * tests/ux-fixes.spec.ts
 * ─────────────────────────────────────────────────────
 * Playwright tests สำหรับ UX fixes (commit 600f12d + f232c35)
 * ─────────────────────────────────────────────────────
 */
import { test, expect } from "@playwright/test";
import {
  setupStudentMocks,
  setupTeacherMocks,
  setupAdminMocks,
  MOCK_STUDENT_ME,
  FAKE_TOKEN,
} from "./helpers/mockApi";
import type { Page } from "@playwright/test";

// ── helper: override /api/students/me ด้วยสถานะที่กำหนด
async function setupStudentWithStatus(page: Page, coopStatus: string) {
  await page.addInitScript((token) => {
    localStorage.setItem("coop.token", token);
  }, FAKE_TOKEN);

  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [], periods: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }) })
  );

  await page.route("**/api/students/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...MOCK_STUDENT_ME,
        coop: { status: coopStatus },
      }),
    })
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, user: { id: 1, role: "student" } }) })
  );
  await page.route("**/api/coop/supervision**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, appointment: null }) })
  );
  await page.route("**/api/announcements**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, list: [] }) })
  );
  await page.route("**/api/admin/config/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ isOpen: false, startDate: "", endDate: "" }) })
  );
}

// ══════════════════════════════════════════════════════════════
// TC-UX-01 ~ TC-UX-03: ปุ่ม "ยื่นคำร้อง" — Student Dashboard
// ══════════════════════════════════════════════════════════════

test("TC-UX-01: ปุ่มยื่นคำร้อง — แสดงสำหรับ NOT_SUBMITTED", async ({ page }) => {
  await setupStudentWithStatus(page, "NOT_SUBMITTED");
  await page.goto("/student/dashboard");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await page.waitForTimeout(1000);
  const btn = page.locator("a.dash-btn").filter({ hasText: "ยื่นคำร้องเข้าร่วมโครงการ" });
  await expect(btn).toBeVisible();
});

test("TC-UX-02: ปุ่มยื่นคำร้อง — ซ่อนสำหรับ QUALIFIED (ผ่านแล้ว)", async ({ page }) => {
  await setupStudentWithStatus(page, "QUALIFIED");
  await page.goto("/student/dashboard");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await page.waitForTimeout(1000);
  const btn = page.locator("a.dash-btn").filter({ hasText: "ยื่นคำร้องเข้าร่วมโครงการ" });
  await expect(btn).not.toBeVisible();
});

test("TC-UX-03: ปุ่มยื่นคำร้อง — ซ่อนสำหรับ INTERNSHIP_STARTED (กำลังฝึก)", async ({ page }) => {
  await setupStudentWithStatus(page, "INTERNSHIP_STARTED");
  await page.goto("/student/dashboard");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await page.waitForTimeout(1000);
  const btn = page.locator("a.dash-btn").filter({ hasText: "ยื่นคำร้องเข้าร่วมโครงการ" });
  await expect(btn).not.toBeVisible();
});

// ══════════════════════════════════════════════════════════════
// TC-UX-04 ~ TC-UX-05: Sidebar label T002/T003 ชัดเจน
// ══════════════════════════════════════════════════════════════

test("TC-UX-04: Sidebar T002 label ต้องมีคำว่า 'T002'", async ({ page }) => {
  await setupStudentWithStatus(page, "INTERNSHIP_STARTED");
  await page.goto("/student/docs-t002");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await page.waitForTimeout(500);
  const t002Link = page.locator(".sidebar .item").filter({ hasText: "T002" });
  await expect(t002Link).toBeVisible();
});

test("TC-UX-05: Sidebar T003 label ต้องมีคำว่า 'T003' และต่างจาก T002", async ({ page }) => {
  await setupStudentWithStatus(page, "INTERNSHIP_STARTED");
  await page.goto("/student/docs-t003");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await page.waitForTimeout(500);
  const t003Link = page.locator(".sidebar .item").filter({ hasText: "T003" });
  await expect(t003Link).toBeVisible();
  // ตรวจว่า label ไม่ซ้ำกับ T002 (ต้องต่างกัน)
  const t002Text = await page.locator(".sidebar .item").filter({ hasText: "T002" }).textContent();
  const t003Text = await page.locator(".sidebar .item").filter({ hasText: "T003" }).textContent();
  expect(t002Text).not.toBe(t003Text);
});

// ══════════════════════════════════════════════════════════════
// TC-UX-06: Login — ไม่มี debug hint text
// ══════════════════════════════════════════════════════════════

test("TC-UX-06: หน้า Login — ไม่มีข้อความ debug password hint", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);
  const bodyText = await page.locator("body").textContent();
  expect(bodyText).not.toContain("เลขบัตรประชาชน 13 หลัก");
});

// ══════════════════════════════════════════════════════════════
// TC-UX-07: Teacher Dashboard — ปุ่ม "พิจารณา" สำหรับ PENDING_TEACHER
// ══════════════════════════════════════════════════════════════

test("TC-UX-07: Teacher Dashboard — แสดงปุ่มพิจารณาสำหรับนัดนิเทศที่รอ PENDING_TEACHER", async ({ page }) => {
  await page.addInitScript((token) => {
    localStorage.setItem("coop.token", token);
    localStorage.setItem("coop.teacher.displayName", "อาจารย์ทดสอบ");
    localStorage.setItem("coop.teacher.profile", JSON.stringify({ firstName: "อาจารย์", lastName: "ทดสอบ" }));
  }, FAKE_TOKEN);

  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [], periods: [], supervisions: [], students: [], pendingStudents: [], approvedStudents: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }) })
  );

  await page.route("**/api/teacher/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: 1, firstName: "อาจารย์", lastName: "ทดสอบ" }) })
  );

  // mock supervision list with 1 PENDING_TEACHER item
  await page.route("**/api/teacher/supervisions**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        supervisions: [{
          id: 99,
          status: "PENDING_TEACHER",
          confirmedDate: null,
          supervisionType: "ONLINE",
          student: {
            studentId: "640000001",
            firstName: "ทดสอบ",
            lastName: "นักศึกษา",
            coop: { company: { name: "บริษัททดสอบ" } },
          },
        }],
      }),
    })
  );

  await page.route("**/api/teacher/stats**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { myStudentsCount: 0, pendingRequests: 0, approvedStudents: 0 } }) })
  );
  await page.route("**/api/teacher/latest-requests**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, pendingStudents: [], approvedStudents: [] }) })
  );
  await page.route("**/api/admin/coop-periods**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, periods: [] }) })
  );

  await page.goto("/teacher/dashboard");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await page.waitForTimeout(1500);

  const btn = page.locator("a").filter({ hasText: "พิจารณา" });
  await expect(btn).toBeVisible({ timeout: 5_000 });
});

// ══════════════════════════════════════════════════════════════
// TC-UX-08: A_DocT000 — ปุ่ม T000 ไม่แสดงสำหรับสถานะ post-letter
// ══════════════════════════════════════════════════════════════

test("TC-UX-08: A_DocT000 — โหลดได้ไม่มี JS error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await setupAdminMocks(page);
  await page.route("**/api/admin/t000/students", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    })
  );
  await page.route("**/api/admin/doc-requirements", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, requirements: [] }) })
  );
  await page.route("**/api/admin/config/t000", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ isOpen: false, startDate: "", endDate: "" }) })
  );
  await page.route("**/api/admin/coop-periods/all", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, periods: [] }) })
  );

  await page.goto("/admin/doc-t000");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await page.waitForTimeout(1500);

  expect(errors).toHaveLength(0);
});
