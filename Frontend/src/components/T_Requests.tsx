// eslint-disable react-refresh/only-export-components */
import React, { useMemo, useState } from "react";
import type { StudentProfile } from "./store";
import { loadStudents, loadAcademicYear } from "./store";

const IOS_BLUE = "#0074B7";

type RequestStatus = "submitted" | "approved" | "rejected";

/* =========================
   UI helpers
========================= */
function statusChip(status?: string) {
  const v = status || "draft";
  const cls =
    v === "submitted"
      ? "under"
      : v === "approved"
      ? "appr"
      : v === "rejected"
      ? "rej"
      : "waiting";
  const label =
    v === "submitted"
      ? "รอพิจารณา"
      : v === "approved"
      ? "ผ่าน"
      : v === "rejected"
      ? "ไม่ผ่าน"
      : "ฉบับร่าง";
  return <span className={`chip ${cls}`}>{label}</span>;
}

/* =========================
   Main Component
========================= */
export default function T_Requests() {
  const year = loadAcademicYear();

  const [students] = useState<StudentProfile[]>(() => loadStudents());
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus[]>([]);

  const list = useMemo(() => {
    const txt = q.toLowerCase();

    return students
      // Teacher เห็นแค่ 3 สถานะ
      .filter(
        (s) =>
          s.coopRequest?.status === "submitted" ||
          s.coopRequest?.status === "approved" ||
          s.coopRequest?.status === "rejected"
      )
      .filter((s) => {
        const t = `${s.studentId} ${s.firstName || ""} ${
          s.lastName || ""
        } ${s.company?.name || ""}`.toLowerCase();

        if (!t.includes(txt)) return false;

        const st = s.coopRequest?.status;
        if (
          statusFilter.length > 0 &&
          (!st || !statusFilter.includes(st as RequestStatus))
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) =>
        (b.coopRequest?.submittedAt || "").localeCompare(
          a.coopRequest?.submittedAt || ""
        )
      );
  }, [students, q, statusFilter]);

  return (
    <div style={{ display: "grid", gap: 16, marginLeft: 35, marginTop: 28 }}>
      {/* ===== Header + Filters ===== */}
      <section className="card">
        <div>
          <div style={{ fontWeight: 1000, fontSize: 20 }}>
            คำร้องขอเข้าร่วมโครงการ
          </div>
          <div style={{ color: "#6b7280", marginTop: 4 }}>
            ปีการศึกษา <b>{year}</b>
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            className="input"
            placeholder="ค้นหา: รหัส / ชื่อ / บริษัท"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: "1 1 280px", maxWidth: 360 }}
          />

          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontWeight: 800, fontSize: 14 }}>สถานะ:</span>

            {(
              [
                ["submitted", "รอพิจารณา"],
                ["approved", "ผ่าน"],
                ["rejected", "ไม่ผ่าน"],
              ] as const
            ).map(([k, label]) => (
              <label
                key={k}
                style={{
                  fontSize: 14,
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <input
                  type="checkbox"
                  checked={statusFilter.includes(k)}
                  onChange={(e) =>
                    setStatusFilter((prev) =>
                      e.target.checked
                        ? [...prev, k]
                        : prev.filter((x) => x !== k)
                    )
                  }
                />
                {label}
              </label>
            ))}

            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setQ("");
                setStatusFilter([]);
              }}
              style={{ height: 38 }}
            >
              ล้างตัวกรอง
            </button>
          </div>
        </div>
      </section>

      {/* ===== Table ===== */}
      <section className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: "0 10px",
              padding: 14,
            }}
          >
            <thead>
              <tr>
                {[
                  "รหัส",
                  "ชื่อ-นามสกุล",
                  "บริษัท",
                  "สถานะ",
                  "การทำงาน",
                ].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: 8 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {list.map((s) => {
                const st = s.coopRequest?.status;

                return (
                  <tr key={s.studentId} style={{ background: "#fff" }}>
                    <td style={td()}>{s.studentId}</td>
                    <td style={td()}>
                      {s.firstName} {s.lastName}
                    </td>
                    <td style={td()}>{s.company?.name || "-"}</td>
                    <td style={td()}>{statusChip(st)}</td>
                    <td style={td()}>
                      {st === "submitted" && (
                        <button
                          className="btn"
                          style={{ background: IOS_BLUE }}
                        >
                          พิจารณา
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {list.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 14, color: "#6b7280" }}>
                    — ไม่มีรายการ —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* =========================
   Styles
========================= */
function td(): React.CSSProperties {
  return {
    padding: "12px 10px",
    borderTop: "1px solid rgba(0,0,0,.04)",
    borderBottom: "1px solid rgba(0,0,0,.04)",
  };
}
