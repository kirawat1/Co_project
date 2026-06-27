import { useState } from "react";
import { loadDocPeriods, saveDocPeriods, loadAcademicYear } from "./store";

/* =========================
   Constants
========================= */

const DOCS = [
  { id: "T001", code: "COOP-T001", title: "แบบฟอร์มคำร้องสหกิจ" },
  { id: "T002", code: "COOP-T002", title: "ใบสมัครงานสหกิจศึกษา" },
  { id: "T003", code: "COOP-T003", title: "รายละเอียดงาน / สถานประกอบการ" },
  { id: "T004", code: "COOP-T004", title: "แผน/โครงร่างการทำงาน" },
  { id: "T005", code: "COOP-T005", title: "บันทึกการปฏิบัติงาน" },
  { id: "T006", code: "COOP-T006", title: "รายงานฉบับสมบูรณ์" },
];

/* =========================
   Helpers
========================= */

function getDocWindow(p?: {
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
}) {
  if (!p?.startDate || !p?.endDate) return "not-open";
  const now = new Date();
  const start = new Date(`${p.startDate} ${p.startTime || "00:00"}`);
  const end = new Date(`${p.endDate} ${p.endTime || "23:59"}`);
  return now >= start && now <= end ? "open" : "not-open";
}

/* =========================
   Component
========================= */

export default function A_Docs() {
  const year = loadAcademicYear();
  const [periods, setPeriods] = useState(loadDocPeriods());
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
  });

  function open(docId: string) {
    const p = periods[docId] || {};
    setForm({
      startDate: p.startDate || "",
      startTime: p.startTime || "",
      endDate: p.endDate || "",
      endTime: p.endTime || "",
    });
    setEditing(docId);
  }

  function save() {
    if (!editing) return;
    const next = { ...periods, [editing]: form };
    setPeriods(next);
    saveDocPeriods(next);
    setEditing(null);
  }

  return (
    <div className="page" style={{ padding: 28, marginLeft: 30 }}>
      {/* ================= Header ================= */}
      <section style={card}>
        <h2 style={{ marginBottom: 4 }}>📄 ตั้งค่าช่วงเวลาส่งเอกสาร</h2>
        <div style={{ color: "#64748b" }}>ปีการศึกษา {year}</div>
      </section>

      {/* ================= Table Description ================= */}
      <div style={tableDesc}>
        <div style={tableDescTitle}>รายการในตาราง</div>
        <ul style={tableDescList}>
          <li>
            <b>รหัสเอกสาร</b> – รหัสอ้างอิงเอกสารสหกิจศึกษา
          </li>
          <li>
            <b>ชื่อเอกสาร</b> – ประเภทเอกสารที่นักศึกษาต้องส่ง
          </li>
          <li>
            <b>วันที่เริ่ม</b> – วันที่เริ่มเปิดรับการส่งเอกสาร
          </li>
          <li>
            <b>วันที่สิ้นสุด</b> – วันที่สิ้นสุดการเปิดรับเอกสาร
          </li>
          <li>
            <b>สถานะ</b> – สถานะช่วงเวลาเอกสาร (
            <span style={{ color: "#16a34a" }}>● เปิดรับ</span> /{" "}
            <span style={{ color: "#64748b" }}>● ยังไม่เปิด</span>)
          </li>
          <li>
            <b>การจัดการ</b> – ปุ่มแก้ไขช่วงวันและเวลา
          </li>
        </ul>
      </div>

      <style>{ROW_MOBILE_CSS}</style>

      {/* ================= Table ================= */}
      <section style={{ ...card, marginTop: 16 }}>
        {DOCS.map((d) => {
          const p = periods[d.id] || {};
          const status = getDocWindow(p);
          return (
            <div key={d.id} className="doc-row" style={row}>
              <div style={{ fontWeight: 600 }}>{d.code}</div>
              <div>{d.title}</div>
              <div>{p.startDate || "-"}</div>
              <div>{p.endDate || "-"}</div>
              <div>
                {status === "open" ? (
                  <span style={badgeOk}>เปิดรับ</span>
                ) : (
                  <span style={badgeWait}>ยังไม่เปิด</span>
                )}
              </div>
              <button
                className="btn"
                style={ghostBtn}
                onClick={() => open(d.id)}
              >
                แก้ไข
              </button>
            </div>
          );
        })}
      </section>

      {/* ================= Modal ================= */}
      {editing && (
        <div style={overlay}>
          <div style={modal}>
            <h3 style={modalTitle}>แก้ไขช่วงเวลาเอกสาร</h3>

            <div style={formGrid}>
              <label style={field}>
                วันที่เริ่ม
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                  style={input}
                />
              </label>

              <label style={field}>
                เวลาเริ่ม
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) =>
                    setForm({ ...form, startTime: e.target.value })
                  }
                  style={input}
                />
              </label>

              <label style={field}>
                วันที่สิ้นสุด
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                  style={input}
                />
              </label>

              <label style={field}>
                เวลาสิ้นสุด
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) =>
                    setForm({ ...form, endTime: e.target.value })
                  }
                  style={input}
                />
              </label>
            </div>

            <div style={footer}>
              <button
                className="btn"
                style={ghostBtn}
                onClick={() => setEditing(null)}
              >
                ยกเลิก
              </button>
              <button className="btn" onClick={save} style={saveBtn}>
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Styles
========================= */

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 14,
  padding: 20,
  border: "1px solid #e5e7eb",
};

const tableDesc: React.CSSProperties = {
  marginTop: 16,
  padding: "14px 16px",
  background: "#f8fafc",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
};

const tableDescTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 8,
};

const tableDescList: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  fontSize: 13,
  color: "#475569",
  lineHeight: 1.8,
};

const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr 120px 120px 120px auto",
  gap: 12,
  padding: "12px 0",
  alignItems: "center",
  borderBottom: "1px solid #f1f5f9",
};

const ROW_MOBILE_CSS = `
  @media (max-width: 768px) {
    .doc-row { grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)) !important; }
  }
`;

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: 16,
};

const modal: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 28,
  width: "100%",
  maxWidth: 460,
  boxShadow: "0 20px 50px rgba(15,23,42,.18)",
};

const modalTitle: React.CSSProperties = {
  margin: 0,
  marginBottom: 20,
  fontSize: 18,
  fontWeight: 700,
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 16,
  marginBottom: 24,
};

const field: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13,
  color: "#475569",
};

const input: React.CSSProperties = {
  height: 38,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  padding: "0 12px",
  fontSize: 14,
};

const footer: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};

const ghostBtn: React.CSSProperties = {
  background: "#fff",
  color: "var(--ios-blue)",
  boxShadow: "none",
  border: "1px solid rgba(10,132,255,.25)",
  height: 36,
};

const saveBtn: React.CSSProperties = {
  background: "var(--ios-blue)",
  color: "#fff",
  boxShadow: "none",
  border: "1px solid rgba(10,132,255,.25)",
  height: 36,
};

const badgeOk: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  background: "#ecfdf5",
  color: "#065f46",
};

const badgeWait: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  background: "#f8fafc",
  color: "#64748b",
};
