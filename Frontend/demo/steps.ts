/** demo/steps.ts — ตัวช่วยที่ใช้ร่วมกันทุกการสาธิต (รอสถานะในฐานข้อมูล · หน้าต่างออกหนังสือ) */
import { test } from "@playwright/test";
import type { Demo } from "./kit";
import { prisma } from "./data";

async function poll<T>(read: () => Promise<T>, ok: (v: T) => boolean, what: string, ms = 20_000) {
  const end = Date.now() + ms;
  let v = await read();
  while (!ok(v) && Date.now() < end) { await new Promise((r) => setTimeout(r, 400)); v = await read(); }
  if (!ok(v)) throw new Error(`${what} (ตอนนี้ ${JSON.stringify(v)})`);
}

export const waitStatus = (pk: number, status: string) => poll(
  async () => (await prisma.studentCoop.findUnique({ where: { studentId: pk }, select: { status: true } }))?.status,
  (v) => v === status, `สถานะไม่เปลี่ยนเป็น ${status}`);

export const waitDoc = (pk: number, type: string, status: string) => poll(
  async () => (await prisma.document.findFirst({ where: { studentId: pk, type }, orderBy: { id: "desc" }, select: { status: true } }))?.status,
  (v) => v === status, `เอกสาร ${type} ไม่เป็น ${status}`);

export const waitAppt = (pk: number, status: string) => poll(
  async () => (await prisma.supervisionAppointment.findFirst({ where: { studentId: pk }, orderBy: { id: "desc" }, select: { status: true } }))?.status,
  (v) => v === status, `นัดนิเทศไม่เป็น ${status}`);

/** หน้าต่างออกหนังสือ (ขอความอนุเคราะห์ / ส่งตัว / ขอนิเทศ ใช้แบบเดียวกัน) */
export async function issueLetter(demo: Demo, docNo: string, signedInputId: string, caption: string) {
  const p = demo.page;
  const modal = p.locator(".letter-modal-backdrop").last();
  await modal.waitFor();
  await demo.type(modal.getByPlaceholder("660301.26.6.2/1234"), docNo);
  await demo.click(modal.getByRole("button", { name: "📄 PDF" }));
  await modal.locator(".letter-preview iframe").waitFor({ timeout: 60_000 });
  await demo.wait(1500);
  await demo.pause(`${caption}ฉบับร่าง (หนังสือ + เอกสารแนบรวมไฟล์เดียว) แสดงทางซ้าย`);
  const dl = p.waitForEvent("download");
  await demo.click(modal.getByRole("button", { name: "⬇️ โหลด" }).first());
  // ร่างที่โหลด = ใช้เป็น "ฉบับลงนาม" ในการสาธิต (ชื่อไฟล์ต้องลงท้าย .pdf ระบบตรวจชนิดไฟล์)
  const file = test.info().outputPath(`${caption}-ฉบับลงนาม.pdf`);
  await (await dl).saveAs(file);
  await modal.getByText(/รอลงนาม/).first().waitFor().catch(() => {});
  await demo.pause(`โหลดร่างแล้ว ระบบติดป้าย "รอลงนาม" — เสนอผู้บริหารลงนาม แล้วแนบฉบับลงนามกลับเข้าระบบ`);
  await demo.files(p.locator(`#${signedInputId}`), file, modal.getByText("📤 เลือกไฟล์ที่ลงนามแล้ว"));
  await demo.click(modal.getByRole("button", { name: /บันทึกเข้าระบบ/ }));
  await demo.confirm(2);
}
