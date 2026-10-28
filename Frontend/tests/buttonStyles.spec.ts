import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ปุ่มทุกปุ่มใช้คลาสกลางใน S_Theme.tsx (btn · btn-secondary · btn-success · btn-danger · btn-warning ·
// btn-danger-outline · .small · filter-chip · modal-close) — ห้ามทาสี/กรอบเองใน style ของ <button>
// (เคยสะสมจนปุ่มหน้าที่เดียวกันมีหลายแบบ: แก้ไข 8 แบบ · ลบ 6 แบบ · เพิ่ม 9 แบบ ก่อนรวมเป็นแบบกลาง 2026-10-28)
// ตัวควบคุมเฉพาะทางที่ตั้งใจคงหน้าตาเอง = รายการข้างล่าง (จำนวนต่อไฟล์) — เพิ่มที่นี่เมื่อจำเป็นจริง พร้อมเหตุผล
const ALLOWED: Record<string, number> = {
  "components/SupervisionCalendar.tsx": 5, // ปุ่มเลื่อนเดือน/วันนี้/ตัวกรองในหัวปฏิทิน
  "components/AnnouncementRooms.tsx": 3, // การ์ดห้องประกาศ · ปุ่มกลับบนแถบสีของห้อง · ช่องเขียนประกาศ
  "components/AnnouncementEditor.tsx": 3, // ตัวเลือกกลุ่มเป้าหมาย (สีตามหลักสูตร) · × เอาไฟล์แนบออก
  "components/AnnouncementCard.tsx": 2, // ลิงก์ "อ่านต่อ" · รูปย่อ
  "components/S_FeedbackButton.tsx": 2, // ปุ่มลอย "แจ้งปัญหา" มุมจอ
  "components/Toast.tsx": 1, // × ปิดแจ้งเตือน
  "components/S_ProfilePage.tsx": 1, // × เอาผู้ติดต่อออกจากเม็ด
  "components/A_StudentEditModal.tsx": 1, // ✕ ล้างค่าในช่องค้นหาอาจารย์
  "components/S_Company.tsx": 1, // ✕ ล้างค่าในช่องค้นหาบริษัท
  "components/A_Students.tsx": 1, // ลิงก์ "เลือกใหม่" ในบรรทัดจับคู่หลักสูตร
  "components/A_DocRequirements.tsx": 1, // ตัวเปิด/ปิดหัวข้อเอกสารรายหลักสูตร (✓/✕)
  "components/LetterModalShared.tsx": 1, // ลิงก์ยกเลิกป้ายรอลงนามในกล่องสีเหลือง
  "components/T_SupervisionReview.tsx": 2, // แท็บขีดเส้นใต้ของหน้า · ปุ่มเตือนรอบอื่น (ด้านล่าง)
  // ปุ่มเตือน "มีรายการรอ…ในรอบอื่น — ดูทุกปีการศึกษา" (กล่องเตือนสีเหลือง แบบเดียวกันทุกหน้า)
  "components/A_CoopApplications.tsx": 1,
  "components/A_DocT000.tsx": 1,
  "components/A_DocT002Review.tsx": 1,
  "components/A_DocT003Review.tsx": 1,
  "components/A_SupervisionManage.tsx": 1,
  "components/T_Requests.tsx": 1,
  "components/T_T002Review.tsx": 1,
  "components/T_T003Review.tsx": 1,
};

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const PAINT = /\b(background|backgroundColor|color|border|borderColor|borderTop|borderBottom|borderLeft|borderRight)\s*:/;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

// จุดจบของแท็กเปิด <button ...> — ข้าม > ที่อยู่ใน {...} หรือในสตริง
function openingTag(src: string, start: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start + 7; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === quote && src[i - 1] !== "\\") quote = null; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0 && src[i - 1] !== "=") return src.slice(start, i + 1);
  }
  return src.slice(start);
}

// ค่าของ style={...} (ข้อความข้างใน วงเล็บปีกกาครบคู่)
function styleExpr(tag: string): string | null {
  const at = tag.indexOf("style={");
  if (at < 0) return null;
  let depth = 0;
  for (let i = at + 6; i < tag.length; i++) {
    if (tag[i] === "{") depth++;
    else if (tag[i] === "}" && --depth === 0) return tag.slice(at + 7, i);
  }
  return null;
}

// <button> ที่ทาสี/กรอบเอง: สีใน style ตรงๆ หรือในค่าคงที่ที่อ้างถึง (style={x} / {...x}) ในไฟล์เดียวกัน
function paintedButtons(src: string): number {
  const consts = new Map<string, string>();
  for (const m of src.matchAll(/const\s+(\w+)\s*(?::[^=]+)?=\s*(\{[\s\S]*?\});/g)) consts.set(m[1], m[2]);
  let n = 0;
  for (const m of src.matchAll(/<button\b/g)) {
    const expr = styleExpr(openingTag(src, m.index!));
    if (!expr) continue;
    const refs = [...expr.matchAll(/(?:^\s*|\.\.\.)([A-Za-z_]\w*)/g)].map((r) => consts.get(r[1]) ?? "");
    if (PAINT.test(expr.replace(/\.\.\.\w+/g, "")) || refs.some((c) => PAINT.test(c))) n++;
  }
  return n;
}

test("ปุ่มไม่ทาสีเองนอกรายการที่อนุญาต", () => {
  const found: Record<string, number> = {};
  for (const f of walk(SRC)) {
    const n = paintedButtons(fs.readFileSync(f, "utf8"));
    if (n) found[path.relative(SRC, f).replace(/\\/g, "/")] = n;
  }
  const over = Object.entries(found)
    .filter(([f, n]) => n > (ALLOWED[f] ?? 0))
    .map(([f, n]) => `${f}: ${n} ปุ่ม (อนุญาต ${ALLOWED[f] ?? 0}) — ใช้คลาสกลางใน S_Theme.tsx แทนสีใน style`);
  expect(over, over.join("\n")).toEqual([]);
});
