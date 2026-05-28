/**
 * helpers/mockApi.ts
 * ──────────────────────────────────────────────────────────────
 * Shared Playwright helper: inject a fake JWT token and
 * mock ALL backend API calls so tests run without a real backend.
 *
 * ⚠ IMPORTANT — Playwright routes are LIFO (last registered = first matched).
 *   Strategy: register the catch-all FIRST so it's tried last;
 *   specific mocks are registered LAST so they're tried first.
 * ──────────────────────────────────────────────────────────────
 */
import { type Page } from "@playwright/test";

export const FAKE_TOKEN = "playwright-test-token";

// ══════════════════════════════════════════════════════════════
// Mock payloads
// ══════════════════════════════════════════════════════════════
export const MOCK_STUDENT_ME = {
  ok: true,
  id: 1,
  studentId: "640610001",
  firstName: "นักศึกษา",
  lastName: "ทดสอบ",
  faculty: "วิทยาลัยการคอมพิวเตอร์",
  major: "วิทยาการคอมพิวเตอร์",
  advisorName: "อ.อาจารย์ ทดสอบ",
  emails: [{ email: "student@test.com", primary: true }],
  coop: null,
};

export const MOCK_TEACHER_ME = {
  ok: true,
  id: 2,
  firstName: "อาจารย์",
  lastName: "ทดสอบ",
  email: "teacher@test.com",
  faculty: "วิทยาลัยการคอมพิวเตอร์",
  major: "วิทยาการคอมพิวเตอร์",
};

export const MOCK_AUTH_ME = {
  ok: true,
  user: {
    id: 3,
    email: "admin@test.com",
    role: "staff",
  },
};

// ── zeroed stats object — ใช้ใน mocks ที่คืน stats (dashboard-stats, teacher/stats)
//   เพื่อป้องกัน stats.totalStudents.toLocaleString() crash ──
export const ZEROED_STATS = {
  totalStudents: 0, submittedStudents: 0, totalAnnouncements: 0,
  totalDailyLogs: 0, waiting: 0, approved: 0, rejected: 0, specialRequests: 0,
  myStudentsCount: 0, pendingRequests: 0, approvedStudents: 0,
};

// ── safe fat catch-all — ทุก field เป็น empty array/object
// เพื่อป้องกัน TypeError เมื่อ component ทำ .find()/.map() กับค่า undefined ──
//
// ⚠️  IMPORTANT: data ต้องเป็น ARRAY ว่าง (ไม่ใช่ object)!
//   list components เรียก data?.data ?? [] แล้วทำ .filter()/.map()
//   ถ้า data เป็น object → items.filter is not a function → React tree crash
//   stats components ใช้ ZEROED_STATS ผ่าน specific mock แทน
const SAFE_EMPTY = {
  ok: true,
  data: [],  // empty array — safe for list components (.map/.filter)
  periods: [],         // A_Dashboard, T_Dashboard → periodList.find(...)
  criteria: [],        // A_CriteriaPage → res.data.criteria
  assets: [],          // A_Settings → res.data.assets
  students: [],
  teachers: [],
  companies: [],
  mentors: [],
  visits: [],
  announcements: [],
  appointments: [],
  docs: [],
  requests: [],
  latest: [],
  config: {},
  deanName: "",
  deanPosition: "",
  meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
};

// ══════════════════════════════════════════════════════════════
// Route helper
// ══════════════════════════════════════════════════════════════
async function mockRoute(page: Page, pattern: string | RegExp, body: unknown, status = 200) {
  await page.route(pattern, (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    })
  );
}

// ══════════════════════════════════════════════════════════════
// Per-role setup functions
// Registration order: catch-all FIRST → specific LAST
// (Playwright LIFO: last registered = matched first)
// ══════════════════════════════════════════════════════════════

export async function setupStudentMocks(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem("coop.token", token);
  }, FAKE_TOKEN);

  // 1. catch-all (registered first = matched last)
  await mockRoute(page, "**/api/**", SAFE_EMPTY);

  // 2. specific routes (registered last = matched first due to LIFO)
  await mockRoute(page, "**/api/students/me",       MOCK_STUDENT_ME);
  await mockRoute(page, "**/api/auth/me",            MOCK_AUTH_ME);
  await mockRoute(page, "**/api/coop/me",            { ok: true, data: null });
  await mockRoute(page, "**/api/coop/daily",         SAFE_EMPTY);
  await mockRoute(page, "**/api/coop/supervision**", SAFE_EMPTY);
  await mockRoute(page, "**/api/students/docs**",    SAFE_EMPTY);
  await mockRoute(page, "**/api/docs**",             SAFE_EMPTY);
  await mockRoute(page, "**/api/companies/**",       SAFE_EMPTY);
  await mockRoute(page, "**/api/announcements**",    SAFE_EMPTY);
}

export async function setupAdminMocks(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem("coop.token", token);
  }, FAKE_TOKEN);

  // 1. catch-all (matched last)
  await mockRoute(page, "**/api/**", SAFE_EMPTY);

  // 2. specific routes (registered last = matched first due to LIFO)
  // NOTE: ไม่ใช้ **/api/admin/** catch-all เพราะจะ override specific mocks ข้างล่าง
  await mockRoute(page, "**/api/auth/me",                    MOCK_AUTH_ME);
  await mockRoute(page, "**/api/admin/coop-periods",         { ok: true, periods: [] });
  await mockRoute(page, "**/api/admin/dashboard-stats**",    { ok: true, data: ZEROED_STATS });
  await mockRoute(page, "**/api/admin/assets",               { ok: true, assets: [] });
  await mockRoute(page, "**/api/admin/config/dean-info",     { ok: true, deanName: "", deanPosition: "" });
  await mockRoute(page, "**/api/admin/criteria",             { ok: true, criteria: [] });
}

export async function setupTeacherMocks(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem("coop.token", token);
    localStorage.setItem("coop.teacher.displayName", "อาจารย์ทดสอบ");
    localStorage.setItem(
      "coop.teacher.profile",
      JSON.stringify({ firstName: "อาจารย์", lastName: "ทดสอบ", email: "teacher@test.com" })
    );
  }, FAKE_TOKEN);

  // 1. catch-all (matched last)
  await mockRoute(page, "**/api/**", SAFE_EMPTY);

  // 2. specific routes (registered last = matched first)
  // NOTE: ไม่ใช้ **/api/teacher/** หรือ **/api/admin/** catch-all เพื่อไม่ override specific mocks
  await mockRoute(page, "**/api/teacher/me",               MOCK_TEACHER_ME);
  await mockRoute(page, "**/api/teacher/stats**",          { ok: true, data: ZEROED_STATS });
  await mockRoute(page, "**/api/teacher/latest-requests**",{ ok: true, data: [], students: [], pendingStudents: [], approvedStudents: [] });
  await mockRoute(page, "**/api/teacher/supervision**",    { ok: true, data: [], appointments: [] });
  await mockRoute(page, "**/api/admin/coop-periods",       { ok: true, periods: [] });
  await mockRoute(page, "**/api/admin/dashboard-stats**",  { ok: true, data: ZEROED_STATS });
  await mockRoute(page, "**/api/auth/me",                  MOCK_AUTH_ME);
}

// ══════════════════════════════════════════════════════════════
// Common assertions
// ══════════════════════════════════════════════════════════════

/** ตรวจว่า topbar แสดงอยู่ — แสดงว่าหน้าโหลดได้ ไม่ redirect ออก */
export async function assertTopbarVisible(page: Page) {
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
}

/** ตรวจว่า URL ไม่ถูก redirect กลับไปหน้า login */
export async function assertNotRedirectedToLogin(page: Page) {
  const url = page.url();
  if (url.match(/^https?:\/\/[^/]+\/?$/) || url.includes("?redirect")) {
    throw new Error(`Redirected to login page: ${url}`);
  }
}
