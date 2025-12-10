/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/A_Daily.tsx
import React, { useMemo, useState } from "react";
import type { DailyLog } from "./store";

const DAILY_KEY = "coop.student.daily.v1";
const YEAR_KEY = "coop.admin.academicYear";

const YEAR_OPTIONS = [
  "2568/1",
  "2568/2",
  "2567/1",
  "2567/2",
  "2566/1",
  "2566/2",
];

type WeekOption = {
  key: string;
  label: string;
  sortIndex: number;
};

/* ---------------- LOAD DAILY LOG ---------------- */
function loadDaily(): DailyLog[] {
  try {
    return JSON.parse(localStorage.getItem(DAILY_KEY) || "[]") || [];
  } catch {
    return [];
  }
}

/* ---------------- LOAD ACADEMIC YEAR ---------------- */
function loadYear(): string {
  const s = localStorage.getItem(YEAR_KEY);
  if (s) return s;
  const now = new Date();
  const th = now.getFullYear() + 543;
  const m = now.getMonth() + 1;
  const term = m >= 6 && m <= 11 ? 1 : 2;
  const guess = `${th}/${term}`;
  localStorage.setItem(YEAR_KEY, guess);
  return guess;
}

/* ---------------- ACADEMIC YEAR FROM DATE ---------------- */
function academicYearFromDate(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  if (!y) return "";
  const th = y + 543;
  const term = m >= 6 && m <= 11 ? 1 : 2;
  return `${th}/${term}`;
}

/* ---------------- WEEK INFO ---------------- */
const TH_MONTH = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function fmtShort(d: Date) {
  return `${d.getDate()} ${TH_MONTH[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function getWeekInfo(iso: string): WeekOption {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const tmp = new Date(
    Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate())
  );
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const diffDays = (tmp.getTime() - yearStart.getTime()) / 86400000;

  const weekNo = Math.ceil((diffDays + 1) / 7);

  return {
    key: `${monday.getFullYear()}-W${String(weekNo).padStart(2, "0")}`,
    label: `สัปดาห์ที่ ${weekNo} (${fmtShort(monday)} – ${fmtShort(sunday)})`,
    sortIndex: monday.getFullYear() * 100 + weekNo,
  };
}

/* ---------------- FORMAT TH DATE ---------------- */
function fmtDateThai(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return iso;
  return `${d} ${TH_MONTH[m - 1]} ${y + 543}`;
}

/* ================= MAIN COMPONENT ================= */
export default function A_Daily() {
  const allLogs = useMemo(loadDaily, []);
  const [year, setYear] = useState(loadYear);
  const [studentId, setStudentId] = useState("all");
  const [weekKey, setWeekKey] = useState("all");
  const [q, setQ] = useState("");

  /* ---------------- FILTER BY YEAR ---------------- */
  const logsByYear = useMemo(
    () => allLogs.filter((l) => academicYearFromDate(l.date) === year),
    [allLogs, year]
  );

  /* ---------------- STUDENT OPTIONS ---------------- */
  const studentOptions = useMemo(() => {
    const map = new Map<string, string>();
    logsByYear.forEach((l: any) => {
      if (!l.studentId) return;
      map.set(l.studentId, `${l.studentId} ${l.studentName || ""}`.trim());
    });
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "th"));
  }, [logsByYear]);

  /* ---------------- WEEK OPTIONS ---------------- */
  const weekOptions = useMemo(() => {
    const base =
      studentId === "all"
        ? logsByYear
        : logsByYear.filter((l) => l.studentId === studentId);

    const map = new Map<string, WeekOption>();
    base.forEach((l) => {
      if (!l.date) return;
      const info = getWeekInfo(l.date);
      if (!map.has(info.key)) map.set(info.key, info);
    });

    return [...map.values()].sort((a, b) => a.sortIndex - b.sortIndex);
  }, [logsByYear, studentId]);

  /* ---------------- FILTER ROWS ---------------- */
  const rows = useMemo(() => {
    let base = logsByYear;

    if (studentId !== "all") {
      base = base.filter((l) => l.studentId === studentId);
    }

    if (weekKey !== "all") {
      base = base.filter((l) => getWeekInfo(l.date).key === weekKey);
    }

    if (q.trim()) {
      const t = q.toLowerCase();
      base = base.filter(
        (l: any) =>
          String(l.studentId).includes(t) ||
          (l.studentName || "").toLowerCase().includes(t) ||
          (l.note || "").toLowerCase().includes(t)
      );
    }

    return [...base].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [logsByYear, studentId, weekKey, q]);

  /* ---------------- EXPORT CSV ---------------- */
  function exportCsv() {
    if (rows.length === 0) return alert("ไม่มีข้อมูลสำหรับส่งออก");

    const header = [
      "วันที่ทำงาน",
      "รหัสนักศึกษา",
      "ชื่อนักศึกษา",
      "เข้า",
      "ออก",
      "สรุปงาน",
      "วันที่บันทึก",
    ];

    const toCsv = (v: any) => `"${String(v || "").replace(/"/g, '""')}"`;

    const lines = [
      header.join(","),
      ...rows.map((l: any) =>
        [
          fmtDateThai(l.date),
          toCsv(l.studentId),
          toCsv(l.studentName),
          toCsv(l.checkIn),
          toCsv(l.checkOut),
          toCsv(l.note),
          l.createdAt
            ? new Date(l.createdAt).toLocaleString("th-TH", {
                dateStyle: "short",
                timeStyle: "short",
              })
            : "",
        ].join(",")
      ),
    ].join("\r\n");

    const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `daily-logs-${year.replace("/", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      {/* ---------------- FILTER CARD ---------------- */}
      <section
        className="card"
        style={{
          padding: 24,
          marginBottom: 28,
          width: "95%",
          maxWidth: "1600px",
          marginInline: "auto",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>
          บันทึกการทำงานนักศึกษา
        </h2>

        {/* FILTER GRID */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
            alignItems: "flex-end",
            marginBottom: 12,
          }}
        >
          {/* ปีการศึกษา */}
          <div>
            <label className="label" style={{ fontSize: 13 }}>
              ปีการศึกษาที่ต้องดู
            </label>
            <select
              className="input"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              style={{ fontSize: 14 }}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* นักศึกษา + เชื่อมคำค้นหา */}
          <div>
            <label className="label" style={{ fontSize: 13 }}>
              นักศึกษาที่ต้องการดู
            </label>
            <select
              className="input"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              style={{ fontSize: 14 }}
            >
              <option value="all">นักศึกษาทุกคน</option>
              {studentOptions
                .filter((s) => {
                  if (!q.trim()) return true;
                  const t = q.toLowerCase();
                  return (
                    s.label.toLowerCase().includes(t) ||
                    s.id.toLowerCase().includes(t)
                  );
                })
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
            </select>
          </div>

          {/* เลือกสัปดาห์ */}
          <div>
            <label className="label" style={{ fontSize: 13 }}>
              สัปดาห์ที่ต้องการดู
            </label>
            <select
              className="input"
              value={weekKey}
              onChange={(e) => setWeekKey(e.target.value)}
              style={{ fontSize: 14 }}
            >
              <option value="all">ทุกสัปดาห์ในปีนี้</option>
              {weekOptions.map((w) => (
                <option key={w.key} value={w.key}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>

          {/* ค้นหา */}
          <div>
            <label className="label" style={{ fontSize: 13 }}>
              ค้นหา (รหัส / ชื่อ / สรุปงาน)
            </label>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="เช่น 65 / ชื่อ นศ. / คำสำคัญ"
              style={{ fontSize: 14 }}
            />
          </div>

          {/* ปุ่ม Export */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn"
              onClick={exportCsv}
              style={{
                fontSize: 14,
                height: 40,
                whiteSpace: "nowrap",
                marginTop: 4,
              }}
            >
              Export Excel (.csv)
            </button>
          </div>
        </div>
      </section>

      {/* ---------------- TABLE CARD ---------------- */}
      <section
        className="card"
        style={{
          padding: 24,
          width: "95%",
          maxWidth: "1600px",
          marginInline: "auto",
        }}
      >
        <h3 style={{ marginTop: 0, fontSize: 16, marginBottom: 12 }}>
          วันที่ทำงาน รหัส ชื่อนักศึกษา เข้า ออก สรุปงาน วันที่เพิ่ม
        </h3>

        <div style={{ overflowX: "auto" }}>
          <table
            className="tbl"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 900,
            }}
          >
            <thead>
              <tr>
                <th style={{ padding: 10, fontSize: 14 }}>วันที่</th>
                <th style={{ padding: 10, fontSize: 14 }}>รหัส นศ.</th>
                <th style={{ padding: 10, fontSize: 14 }}>ชื่อ</th>
                <th style={{ padding: 10, fontSize: 14 }}>เข้า</th>
                <th style={{ padding: 10, fontSize: 14 }}>ออก</th>
                <th style={{ padding: 10, fontSize: 14 }}>สรุปงาน</th>
                <th style={{ padding: 10, fontSize: 14 }}>วันที่เพิ่ม</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      padding: 22,
                      fontSize: 14,
                      color: "#6b7280",
                    }}
                  >
                    ไม่พบบันทึกตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                rows.map((l: any) => (
                  <tr key={l.id}>
                    <td style={{ padding: 10, fontSize: 14 }}>
                      {fmtDateThai(l.date)}
                    </td>
                    <td style={{ padding: 10, fontSize: 14 }}>{l.studentId}</td>
                    <td style={{ padding: 10, fontSize: 14 }}>
                      {l.studentName}
                    </td>
                    <td style={{ padding: 10, fontSize: 14 }}>
                      {l.checkIn || "-"}
                    </td>
                    <td style={{ padding: 10, fontSize: 14 }}>
                      {l.checkOut || "-"}
                    </td>
                    <td
                      style={{
                        padding: 10,
                        fontSize: 14,
                        whiteSpace: "pre-line",
                      }}
                    >
                      {l.note || "-"}
                    </td>
                    <td style={{ padding: 10, fontSize: 14 }}>
                      {l.createdAt
                        ? new Date(l.createdAt).toLocaleString("th-TH", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <style>{`
          .tbl thead th {
            text-align: left;
            background: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
            font-weight: 600;
            color: #6b7280;
          }
          .tbl tbody td {
            border-bottom: 1px solid #e5e7eb;
          }
          /* iOS style zebra rows */
          .tbl tbody tr:nth-child(odd) td {
            background: #ffffff;
          }
          .tbl tbody tr:nth-child(even) td {
            background: #f8fafc;
          }
        `}</style>
      </section>
    </div>
  );
}
