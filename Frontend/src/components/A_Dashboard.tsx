// src/components/A_Dashboard.tsx
import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { StudentProfile, DocumentItem } from "./store";

const IOS_BLUE = "#0074B7";

const KS = "coop.student.profile.v1";
const KM = "coop.admin.mentors";
const KA = "coop.shared.announcements";

function loadStudents(): StudentProfile[] { try { return JSON.parse(localStorage.getItem(KS) || "[]"); } catch { return []; } }
function loadMentors(): any[] { try { return JSON.parse(localStorage.getItem(KM) || "[]"); } catch { return []; } }
function loadAnns(): any[] { try { return JSON.parse(localStorage.getItem(KA) || "[]"); } catch { return []; } }
function loadStudentDaily(): number {
  try {
    const raw = localStorage.getItem("coop.student.daily.v1");
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

/* ---------- Inline Icons (ไม่พึ่ง lib ภายนอก) ---------- */
function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="dash-icon"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 12,
        background: "rgba(0,116,183,.10)",
        color: IOS_BLUE,
      }}
      aria-hidden
    >
      {children}
    </span>
  );
}

const StudentsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const MentorsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="7" r="4"></circle>
    <path d="M6 21v-2a6 6 0 0 1 12 0v2"></path>
    <path d="M16 3l2 2"></path>
    <path d="M8 3L6 5"></path>
  </svg>
);

const AnnounceIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11v2"></path>
    <path d="M7 11v2"></path>
    <path d="M21 8v8l-7-3H8a4 4 0 0 1-4-4V7a1 1 0 0 1 1-1h3l7-3v0"></path>
  </svg>
);

const DailyStuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2v4"></path><path d="M16 2v4"></path>
    <rect x="3" y="4" width="18" height="18" rx="2"></rect>
    <path d="M3 10h18"></path>
    <path d="M8 14h.01"></path><path d="M12 14h4"></path>
  </svg>
);

const DailyMenIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="14" rx="2"></rect>
    <path d="M7 21h10"></path><path d="M12 17v4"></path>
    <path d="M7 7h10v6H7z"></path>
  </svg>
);

/* ---------- LineChart (SVG, ไม่ใช้ไลบรารี) ---------- */
function LineChart({
  data,
  height = 260,
  stroke = IOS_BLUE,
}: {
  data: { key: string; label: string; value: number | string; color?: string }[];
  height?: number;
  stroke?: string;
}) {
  const values = data.map(d => Number(d.value) || 0);
  const max = Math.max(1, ...values);

  // padding ของกราฟ
  const P = { top: 16, right: 16, bottom: 36, left: 36 };
  const W = 720; // viewBox responsive width
  const H = height;
  const innerW = W - P.left - P.right;
  const innerH = H - P.top - P.bottom;

  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = P.left + i * stepX;
    const v = Number(d.value) || 0;
    const y = P.top + (innerH - (v / max) * innerH);
    return { x, y, v, label: d.label, color: d.color || stroke };
  });

  const poly = points.map(p => `${p.x},${p.y}`).join(" ");

  const yTicks = 4;
  const gridLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const y = P.top + (innerH / yTicks) * i;
    const val = Math.round(max - (max / yTicks) * i);
    return { y, val };
  });

  // รวมทั้งหมด (ใช้แสดง %)
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <div className="line-wrap" aria-label="กราฟเส้นสถานะเอกสารรวม" style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img">
        {/* พื้นหลัง */}
        <rect x={0} y={0} width={W} height={H} fill="#fff" rx="12" />

        {/* grid + ป้ายแกน Y */}
        {gridLines.map((g, i) => (
          <g key={`grid-${i}`}>
            <line x1={P.left} x2={W - P.right} y1={g.y} y2={g.y} stroke="rgba(0,0,0,.06)" />
            <text x={P.left - 8} y={g.y + 4} textAnchor="end" fontSize="11" fill="#6b7280">{g.val}</text>
          </g>
        ))}

        {/* แกน */}
        <line x1={P.left} y1={H - P.bottom} x2={W - P.right} y2={H - P.bottom} stroke="rgba(0,0,0,.2)" />
        <line x1={P.left} y1={P.top} x2={P.left} y2={H - P.bottom} stroke="rgba(0,0,0,.2)" />

        {/* ไฮไลต์ใต้เส้น */}
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path
          d={`M ${P.left},${H - P.bottom} L ${poly} L ${W - P.right},${H - P.bottom} Z`}
          fill="url(#areaFill)"
          stroke="none"
        />

        {/* เส้นกราฟ */}
        <polyline
          points={poly}
          fill="none"
          stroke={stroke}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* จุด + ค่า + ป้าย X + tooltip */}
        {points.map((p, i) => {
          const pct = total ? Math.round((p.v / total) * 100) : 0;
          return (
            <g key={`pt-${i}`}>
              <circle cx={p.x} cy={p.y} r={5} fill={p.color} stroke="#fff" strokeWidth={1.5}>
                <title>{`${p.label}: ${p.v}${total ? ` (${pct}%)` : ""}`}</title>
              </circle>
              <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="12" fontWeight={700} fill="#111827">
                {p.v}
              </text>
              <text x={p.x} y={H - P.bottom + 18} textAnchor="middle" fontSize="12" fill="#6b7280">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ---------- Legend (สถานะ + จำนวน + %) ---------- */
function ChartLegend({
  data,
  title = "สรุปตามสถานะ",
}: {
  data: { label: string; value: number | string; color: string }[];
  title?: string;
}) {
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  return (
    <div>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>{title}</div>
      <div
        className="legend-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 10,
        }}
      >
        {data.map((d) => {
          const v = Number(d.value) || 0;
          const pct = total ? Math.round((v / total) * 100) : 0;
          return (
            <div
              key={d.label}
              className="legend-item"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                border: "1px solid rgba(0,0,0,.06)",
                borderRadius: 12,
                background: "#fff",
              }}
            >
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: 9999, background: d.color, display: "inline-block" }} />
              <div style={{ flex: 1, color: "#374151", fontWeight: 700 }}>{d.label}</div>
              <div style={{ fontWeight: 900, minWidth: 32, textAlign: "right" }}>{v}</div>
              <div style={{ color: "#6b7280", fontSize: 12, marginLeft: 6 }}>{pct}%</div>
            </div>
          );
        })}
        <div
          className="legend-total"
          style={{
            marginTop: 6,
            padding: "10px 12px",
            border: "1px dashed rgba(0,0,0,.08)",
            borderRadius: 12,
            color: "#374151",
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 800,
          }}
        >
          <span>รวมทั้งหมด</span>
          <span>{total}</span>
        </div>
      </div>
    </div>
  );
}

export default function A_Dashboard() {
  const students = loadStudents();
  const mentors = loadMentors();
  const anns = loadAnns();
  const studentDaily = loadStudentDaily();


  const docStats = useMemo(() => {
    const counters = { waiting: 0, under: 0, approved: 0, rejected: 0 } as Record<string, number>;
    students.forEach(s => (s.docs || []).forEach(d => { counters[keyOf(d.status)]++; }));
    return counters;
  }, [students]);
  function keyOf(s: DocumentItem["status"]) { return s === "under-review" ? "under" : (s as any); }

  const CARD_ROUTES: Record<string, string> = {
    c1: "/admin/students",
    c2: "/admin/mentors",
    c3: "/admin/announcements",
    c4: "/admin/daily?role=student",
  };

  const cards = [
    { id: "c1", title: "จำนวนนักศึกษา", value: String(students.length), icon: <StudentsIcon /> },
    { id: "c2", title: "จำนวนพี่เลี้ยง", value: String(mentors.length), icon: <MentorsIcon /> },
    { id: "c3", title: "ประกาศ", value: String(anns.length), icon: <AnnounceIcon /> },
    { id: "c4", title: "บันทึกนักศึกษา (รายการ)", value: String(studentDaily), icon: <DailyStuIcon /> },
  ];

  // ข้อมูลกราฟเส้น + ใช้ร่วมกับ Legend
  const chartData = [
    { key: "waiting", label: "รอส่ง", value: docStats.waiting, color: "#9CA3AF" }, // gray-400
    { key: "under", label: "รอพิจารณา", value: docStats.under, color: IOS_BLUE },  // theme
    { key: "approved", label: "ผ่าน", value: docStats.approved, color: "#10B981" }, // emerald-500
    { key: "rejected", label: "ไม่ผ่าน", value: docStats.rejected, color: "#EF4444" }, // red-500
  ];

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      {/* ===== ภาพรวม ===== */}
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>ภาพรวม</h2>

        <div
          className="overview-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 250px))",
            gap: 30,
            justifyContent: "start",
            marginLeft: 50
          }}
        >
          {cards.map(c => {
            const to = CARD_ROUTES[c.id] || "/admin";
            return (
              <Link
                key={c.id}
                to={to}
                className="card dash-link"
                style={{
                  padding: 14,
                  textDecoration: "none",
                  color: "inherit",
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,.06)",
                }}
                aria-label={`ไปที่รายละเอียด: ${c.title}`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
                  <IconWrap>{c.icon}</IconWrap>
                  <div style={{ color: "#6b7280", fontWeight: 800, lineHeight: 1.2, fontSize: 17, marginLeft: 5 }}>
                    {c.title}
                  </div>
                </div>
                {/* ยังคงขยับตัวเลขไปทางขวาตามที่เคยขอ */}
                <div style={{ fontSize: 26, fontWeight: 900, marginTop: 8, marginLeft: 60 }}>
                  {c.value}
                </div>
                <div className="dash-link-foot" aria-hidden style={{ marginLeft: 10 }}>ดูรายละเอียด</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ===== สถานะเอกสารรวม: ซ้าย = Legend | ขวา = กราฟเส้น ===== */}
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>สถานะเอกสารรวม</h2>

        <div
          className="status-split"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 320px) 1fr",
            gap: 16,
            alignItems: "start",
            marginTop: 10,
            marginLeft: 70,
            marginBottom: 10
          }}
        >
          {/* ซ้าย: ข้อมูลสถานะ/จำนวน/เปอร์เซ็นต์ */}
          <div >
            <ChartLegend data={chartData} />
          </div>

          {/* ขวา: กราฟเส้น */}
          <div className="chart-box" style={{ minWidth: 0, marginTop: 40 }}>
            <LineChart data={chartData} />
          </div>
        </div>
      </section>

      {/* ===== Styles & Responsive ===== */}
      <style>{`
        @media (max-width: 1024px){
          .overview-grid{ grid-template-columns: 1fr !important; }
          .status-split{ grid-template-columns: 1fr !important; }
          .line-wrap svg{ height: 280px !important; }
          .legend-grid{ grid-template-columns: 1fr !important; }
        }
        .dash-link{
          position: relative;
          transition: transform .08s ease, box-shadow .12s ease, border-color .12s ease, background .12s ease;
          cursor: pointer;
          background: #fff;
        }
        .dash-link:hover{
          transform: translateY(-1px);
          border-color: rgba(10,132,255,.18);
          box-shadow: 0 8px 24px rgba(10,132,255,.20);
          background: #fcfcff;
        }
        .dash-link:focus-visible{
          outline: 3px solid rgba(10,132,255,.45);
          outline-offset: 2px;
        }
        .dash-link-foot{
          margin-top: 6px;
          font-size: 12px;
          font-weight: 850;
          color: #2563eb;
          opacity: .95;
        }
      `}</style>
    </div>
  );
}

