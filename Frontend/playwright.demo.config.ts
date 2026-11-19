// การสาธิตระบบ (เปิด Chrome ให้เห็น กดให้ดูทีละขั้น) — เรียกผ่าน `node demo.js` ที่ root ของโปรเจกต์
//   รันตรง: npx playwright test --config=playwright.demo.config.ts full.demo.ts
//   DEMO_AUTO=1 = ไม่รอปุ่มถัดไป · DEMO_HEADLESS=1 = ไม่เปิดหน้าต่าง (ใช้ตรวจสคริปต์)
import { defineConfig } from "@playwright/test";

const headless = !!process.env.DEMO_HEADLESS;

export default defineConfig({
  testDir: "./demo",
  testMatch: /.*\.demo\.ts/,
  outputDir: "./test-results/demo",
  workers: 1,
  timeout: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    channel: "chrome",
    headless,
    viewport: headless ? { width: 1600, height: 900 } : null,
    launchOptions: { args: headless ? [] : ["--start-maximized"] },
    acceptDownloads: true,
    timezoneId: "Asia/Bangkok",
    locale: "th-TH",
    actionTimeout: 20_000,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
