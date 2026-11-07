import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    headless: true,
  },

  // ปกติรัน Chromium อย่างเดียว · CROSS_BROWSER=1 = เพิ่ม Firefox + WebKit (เครื่องยนต์เดียวกับ Safari)
  //   ต้องติดตั้งก่อนครั้งแรก: npx playwright install firefox webkit · รันทีละตัว: --project=firefox / --project=webkit
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    ...(process.env.CROSS_BROWSER ? [
      { name: "firefox", use: { ...devices["Desktop Firefox"] } },
      { name: "webkit", use: { ...devices["Desktop Safari"] } },
    ] : []),
  ],

  /* Start Vite dev server automatically before tests */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,   // ถ้า port 5173 เปิดอยู่แล้ว ใช้ต่อเลย
    timeout: 60_000,
  },
});
