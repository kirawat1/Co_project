/* ============================================================
   ตัวหมุนบอกว่า "ระบบกำลังทำงาน" — ใช้ชุดเดียวทั้งระบบ
   - <Spinner size={18} color="#fff" />        วงแหวนหมุน (ค่าเริ่มต้นสีตามตัวอักษร)
   - <BusyLabel text="กำลังบันทึก…" />          ใส่ในปุ่มระหว่างทำงาน (ปุ่มต้อง disabled เอง กันกดซ้ำ)
   - <LoadingBlock text="กำลังโหลดรายชื่อ…" />  แทนหน้า/ส่วนของหน้าที่กำลังโหลด
   ⏳ ที่เป็นป้ายสถานะ "ยังรออีกฝ่าย" (เช่น ยังไม่ส่ง · รอดำเนินการ) ไม่ใช่การรอระบบ — คงไว้ ไม่ใช้ตัวหมุน
============================================================ */
import type { CSSProperties } from "react";

// ผู้ที่ตั้งค่าลดการเคลื่อนไหว: หมุนช้าลงแทนหยุด (ยังต้องรู้ว่าระบบทำงานอยู่)
const SPIN_CSS = "@keyframes coop-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){.coop-spin{animation-duration:2.4s!important}}";

export default function Spinner({
  size = 18,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <span
      className="coop-spin"
      aria-hidden="true"
      style={{
        display: "inline-block",
        flex: "none",
        width: size,
        height: size,
        boxSizing: "border-box",
        borderRadius: "50%",
        borderWidth: Math.max(2, Math.round(size / 7)),
        borderStyle: "solid",
        borderColor: color,
        borderRightColor: "transparent",
        animation: "coop-spin .7s linear infinite",
        verticalAlign: "middle",
      }}
    >
      <style>{SPIN_CSS}</style>
    </span>
  );
}

/** ข้อความในปุ่มระหว่างทำงาน: ตัวหมุน + บอกว่าทำอะไร (สีตามตัวอักษรของปุ่ม) */
export function BusyLabel({ text = "กำลังดำเนินการ…", size = 15, color }: { text?: string; size?: number; color?: string }) {
  return (
    <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Spinner size={size} color={color} />
      {text}
    </span>
  );
}

/** หน้า/ส่วนของหน้าที่กำลังโหลด — ตัวหมุนสีหลัก + ข้อความ */
export function LoadingBlock({ text = "กำลังโหลด…", style }: { text?: string; style?: CSSProperties }) {
  return (
    <div role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 32, color: "#64748b", fontSize: 14, ...style }}>
      <Spinner size={24} color="#0074B7" />
      <span>{text}</span>
    </div>
  );
}
