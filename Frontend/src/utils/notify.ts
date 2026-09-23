/* ============================================================
   การแจ้งเตือนมาตรฐานของทั้งระบบ — ใช้แทน alert() / confirm() ของเบราว์เซอร์
   (ห้ามใช้ alert/confirm — มีเทสต์ backend/__tests__/noNativeDialogs.test.js คอยตรวจ)

   ผลของปุ่มที่เพิ่งกด       → notify.success / notify.error / notify.warning / notify.info
   ถามก่อนทำสิ่งที่ย้อนไม่ได้ → if (!(await askConfirm("ลบไฟล์นี้?", { confirmLabel: "ลบ", danger: true }))) return;
   ข้อความที่ต้องโชว์หลังรีโหลดหน้า → notify.afterReload("success", "…") แล้วค่อย reload

   เรียกได้จากทุกที่ (รวมไฟล์ utils ที่ไม่ใช่ component) — <ToastProvider> ใน main.tsx เป็นตัวแสดงผล
============================================================ */

export type NotifyType = "success" | "error" | "info" | "warning";

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** ปุ่มยืนยันสีแดง — ใช้กับการลบหรือสิ่งที่ย้อนไม่ได้ */
  danger?: boolean;
  icon?: string;
}

export interface ConfirmRequest extends ConfirmOptions {
  message: string;
  resolve: (ok: boolean) => void;
}

type ToastSink = (type: NotifyType, message: string) => void;
type ConfirmSink = (req: ConfirmRequest) => void;

let toastSink: ToastSink | null = null;
let confirmSink: ConfirmSink | null = null;
// ข้อความที่ถูกเรียกก่อน provider พร้อม (เช่นตอนหน้าเพิ่งโหลด) — เก็บไว้แสดงทีหลัง
const early: Array<[NotifyType, string]> = [];

const FLASH_KEY = "coop.flash";

// ตัด ✅ ❌ ⚠️ ที่นำหน้าข้อความออก — กล่องแจ้งเตือนมีไอคอนและสีบอกประเภทอยู่แล้ว
const LEADING_ICON = /^\s*(?:✅|❌|⚠️|⚠|ℹ️|🚫|⛔|✔️|✔|🗑️|🗑)\s*/u;

export function cleanMessage(message: unknown): string {
  return String(message ?? "").replace(LEADING_ICON, "").trim();
}

function show(type: NotifyType, message: unknown) {
  const text = cleanMessage(message);
  if (!text) return;
  if (toastSink) toastSink(type, text);
  else early.push([type, text]);
}

export const notify = {
  success: (message: unknown) => show("success", message),
  error: (message: unknown) => show("error", message),
  warning: (message: unknown) => show("warning", message),
  info: (message: unknown) => show("info", message),
  /** เก็บข้อความไว้แสดงหลัง window.location.reload() / เปลี่ยนหน้าแบบโหลดใหม่ */
  afterReload(type: NotifyType, message: string) {
    try {
      sessionStorage.setItem(FLASH_KEY, JSON.stringify({ type, message: cleanMessage(message) }));
    } catch {
      /* โหมดไม่เก็บข้อมูล — ข้ามไป */
    }
  },
};

/** กล่องยืนยันของระบบ — คืน true เมื่อกดยืนยัน, false เมื่อกดยกเลิก/กด Esc/คลิกนอกกล่อง */
export function askConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!confirmSink) {
      // ยังไม่มีตัวแสดงผล (ไม่ควรเกิดในแอปจริง) — ไม่ทำต่อเพื่อความปลอดภัย
      console.warn("askConfirm: ConfirmHost ยังไม่พร้อม", message);
      resolve(false);
      return;
    }
    confirmSink({ ...options, message: cleanMessage(message), resolve });
  });
}

/** เรียกจาก ToastProvider เท่านั้น */
export function registerToastSink(sink: ToastSink | null) {
  toastSink = sink;
  if (!sink) return;
  while (early.length) {
    const [type, text] = early.shift()!;
    sink(type, text);
  }
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (raw) {
      sessionStorage.removeItem(FLASH_KEY);
      const { type, message } = JSON.parse(raw);
      if (message) sink(type, message);
    }
  } catch {
    /* ข้าม */
  }
}

/** เรียกจาก ToastProvider เท่านั้น */
export function registerConfirmSink(sink: ConfirmSink | null) {
  confirmSink = sink;
}
