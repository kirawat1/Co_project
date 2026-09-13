import type { RefObject } from "react";

interface Props {
  shownCount: number;
  total: number;
  hasMore: boolean;
  onShowMore: () => void;
  sentinelRef: RefObject<HTMLDivElement | null>;
  /** หน่วยนับท้ายตัวเลข เช่น "แห่ง", "คน", "รายการ" (ค่าเริ่มต้น "รายการ") */
  itemLabel?: string;
}

/**
 * แถบท้ายตาราง + จุดสังเกตสำหรับ useLoadMore — วางไว้ใต้ </table> หรือ </section> ของตาราง
 * ถ้า total === 0 จะไม่แสดงอะไรเลย (ให้ผู้เรียกจัดการข้อความ "ไม่มีข้อมูล" เอง)
 */
export default function LoadMoreFooter({ shownCount, total, hasMore, onShowMore, sentinelRef, itemLabel = "รายการ" }: Props) {
  if (total === 0) return null;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 12, marginTop: 16, padding: "0 4px" }}>
        <span style={{ fontSize: 13, color: "#64748b" }}>
          {hasMore ? `แสดง ${shownCount} จาก ${total} ${itemLabel}` : `แสดงครบ ${total} ${itemLabel}แล้ว`}
        </span>
        {hasMore && (
          // ปุ่มสำรอง เผื่อเลื่อนแล้วไม่โหลดเพิ่ม (เบราว์เซอร์เก่า/จอพิเศษ)
          <button
            type="button"
            className="btn"
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#334155", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            onClick={onShowMore}
          >
            แสดงเพิ่ม
          </button>
        )}
      </div>
      {/* จุดสังเกต: เลื่อนมาใกล้จุดนี้แล้วแสดงเพิ่มอีกชุด */}
      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
    </>
  );
}
