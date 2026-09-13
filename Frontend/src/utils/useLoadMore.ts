import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_BATCH = 30;

/**
 * แสดงรายการทีละ batch แล้วเลื่อนถึงท้ายตารางค่อยแสดงเพิ่ม (แทนแบ่งหน้า)
 * เลือกวิธีนี้เพราะงานเลือกหลายรายการ: แถวที่ติ๊กเลือกไว้ยังอยู่บนจอ ไม่ต้องล้างการเลือกตอนเปลี่ยนหน้า
 *
 * ใช้กับรายการที่กรอง/ค้นหาแล้วในหน้าจอ (อยู่ใน memory ทั้งหมด) ไม่ใช่ผลลัพธ์จาก server ที่แบ่งหน้ามาให้แล้ว
 *
 * @param list      รายการทั้งหมดหลังกรอง/ค้นหา
 * @param resetKey  เปลี่ยนค่านี้เมื่อไหร่ (เช่น คำค้น, ตัวกรอง) จะรีเซ็ตกลับไปแสดง batch แรก
 */
export function useLoadMore<T>(list: T[], resetKey?: unknown, batchSize = DEFAULT_BATCH) {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisibleCount(batchSize); }, [resetKey, batchSize]);

  const shown = useMemo(() => list.slice(0, visibleCount), [list, visibleCount]);
  const hasMore = visibleCount < list.length;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    // สร้าง observer ใหม่ทุกครั้งที่แสดงเพิ่ม — จอสูงมากจนท้ายตารางยังอยู่ในจอ จะได้แสดงเพิ่มต่อจนเต็มจอ
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) setVisibleCount((c) => c + batchSize); },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, visibleCount, list.length, batchSize]);

  function showMore() { setVisibleCount((c) => c + batchSize); }

  return { shown, hasMore, sentinelRef, showMore, total: list.length };
}

/** สลับ "เลือกทั้งหมด" ให้หมายถึงเฉพาะรายการที่แสดงอยู่บนจอ ไม่เหมารวมรายการที่ยังไม่ได้เลื่อนไปแสดง */
export function toggleSelectAllShown<T, K>(shown: T[], selectedIds: Set<K>, getId: (item: T) => K): Set<K> {
  const allSelected = shown.length > 0 && shown.every((item) => selectedIds.has(getId(item)));
  const next = new Set(selectedIds);
  if (allSelected) shown.forEach((item) => next.delete(getId(item)));
  else shown.forEach((item) => next.add(getId(item)));
  return next;
}

export function allShownSelected<T, K>(shown: T[], selectedIds: Set<K>, getId: (item: T) => K): boolean {
  return shown.length > 0 && shown.every((item) => selectedIds.has(getId(item)));
}
