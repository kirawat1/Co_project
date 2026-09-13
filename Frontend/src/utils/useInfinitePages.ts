import { useCallback, useEffect, useRef, useState } from "react";

export interface PageResult<T> {
  items: T[];
  total: number;
  totalPages: number;
}

/**
 * โหลดรายการจาก server ทีละหน้า (page-based API เช่น /api/students?page=N&limit=50)
 * แล้วต่อท้ายรายการเดิมเมื่อเลื่อนถึงท้ายตาราง — แทนปุ่มเลขหน้า ให้พฤติกรรมเหมือน useLoadMore
 * (ใช้กับรายการที่กรองในหน้าจอ) แต่ข้อมูลจริงมาจาก server ทีละหน้า
 *
 * @param fetchPage  ขอข้อมูลหน้าที่ pageNum จาก server คืน null ถ้าดึงไม่สำเร็จ (จะไม่แก้ไข state)
 *                   อ่านค่าตัวกรอง/คำค้น/การเรียงลำดับปัจจุบันจาก closure ได้เลย — ฟังก์ชันนี้ถูกอ่าน
 *                   ใหม่ทุก render ผ่าน ref ภายใน จึงไม่มีปัญหาค่าค้าง (stale closure)
 * @param resetKey   เปลี่ยนค่านี้เมื่อไหร่ (คำค้น/ตัวกรอง/การเรียงลำดับ) จะละทิ้งของเดิมแล้วโหลดหน้า 1 ใหม่
 */
export function useInfinitePages<T>(fetchPage: (pageNum: number) => Promise<PageResult<T> | null>, resetKey: unknown) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const reload = useCallback(async () => {
    const result = await fetchPageRef.current(1);
    if (!result) return;
    setItems(result.items);
    setPage(1);
    setTotalPages(result.totalPages);
    setTotal(result.total);
  }, []);

  // resetKey เปลี่ยน (ค้นหา/ตัวกรอง/เรียงลำดับ) → ละทิ้งรายการเดิมแล้วโหลดหน้า 1 ใหม่
  // ข้ามรอบแรกเพราะผู้เรียกเป็นคนสั่งโหลดครั้งแรกเอง (มักรวมกับการโหลดข้อมูลอื่น เช่น รายการปีการศึกษา)
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const hasMore = page < totalPages;

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const result = await fetchPageRef.current(next);
      if (!result) return;
      setItems((prev) => [...prev, ...result.items]);
      setPage(next);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, page, totalPages, loadingMore]);

  return { items, setItems, setTotal, reload, loadMore, loadingMore, hasMore, sentinelRef, total, totalPages, page };
}
