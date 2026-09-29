import type { CSSProperties } from "react";

/* ============================================================
   สไตล์ตารางกลาง — ก่อนหน้านี้แต่ละหน้า (นักศึกษา, บริษัท, ผู้ติดต่อ, พี่เลี้ยง, อาจารย์ ฯลฯ)
   กำหนด th/td เอง ~15 ไฟล์ ระยะห่างและเส้นขอบหัวตารางไม่ตรงกัน

   ใช้แทนของเดิม (ชื่อตัวแปรเดิมคือ th/td อยู่แล้วในเกือบทุกไฟล์ — import แบบ alias ตรงๆ ได้เลย):
   import { TABLE_TH as th, TABLE_TD as td, TABLE_HEADER_ROW } from "../utils/tableStyles";
   ...
   <tr style={TABLE_HEADER_ROW}><th style={th}>...</th></tr>
   <td style={{ ...td, textAlign: "center" }}>...</td>  // spread ต่อได้ตามเดิม
============================================================ */

export const TABLE_HEADER_ROW: CSSProperties = { background: "#f8fafc", borderBottom: "1px solid #e2e8f0" };
export const TABLE_TH: CSSProperties = { textAlign: "left", fontSize: 14, fontWeight: 700, padding: "12px 16px", color: "#475569" };
export const TABLE_TD: CSSProperties = { padding: "14px 16px", fontSize: 14, color: "#334155", verticalAlign: "middle" };
