import { Link } from "react-router-dom";
import { usePendingCounts, type PendingKey } from "../hooks/usePendingCounts";

// แผง "งานที่รอคุณ" บน Dashboard — ตัวเลขชุดเดียวกับป้ายบนเมนู (งานที่รออยู่จริง ทุกรอบ ในหลักสูตรที่ดูแล)
// แสดงเฉพาะเมนูที่ผู้ใช้มี (backend ส่งเฉพาะ key ของบทบาทนั้น) · กดแล้วไปหน้าที่ทำงานนั้น
export interface PendingItem { key: PendingKey; label: string; to: string }

export default function PendingWorkPanel({ items }: { items: PendingItem[] }) {
  const pending = usePendingCounts();
  const shown = items.filter((i) => pending[i.key] !== undefined);
  if (!shown.length) return null; // ยังโหลดไม่เสร็จ / บทบาทนี้ไม่มีงานในรายการ
  const total = shown.reduce((n, i) => n + (pending[i.key] ?? 0), 0);

  return (
    <section className="card" aria-labelledby="pending-work-h" style={{ marginBottom: 20 }}>
      <h2 id="pending-work-h" style={{ fontSize: 18, fontWeight: 800, margin: "0 0 12px" }}>
        {total ? `📌 งานที่รอคุณ (${total})` : "✅ ไม่มีงานที่รอคุณ"}
      </h2>
      <div className="pending-panel">
        {shown.map((i) => {
          const n = pending[i.key] ?? 0;
          return (
            <Link key={i.key} to={i.to} className={n ? "pending-tile has" : "pending-tile"}>
              <span className="n">{n}</span>
              <span>{i.label}</span>
              {n > 0 && <span className="go">ไปทำ →</span>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
