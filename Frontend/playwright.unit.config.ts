// เทสต์ฟังก์ชันล้วน (ไม่เปิดเบราว์เซอร์) — ไม่สตาร์ต Vite dev server
//   npx playwright test --config=playwright.unit.config.ts deadlines.spec.ts letterUtils.spec.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  reporter: [["list"]],
});
