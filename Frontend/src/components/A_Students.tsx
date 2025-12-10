/* eslint-disable react-refresh/only-export-components */
import React, { useMemo, useState } from "react";
import type { StudentProfile, DocumentItem, DocStatus } from "./store";

const KS = "coop.student.profile.v1";

function load(): StudentProfile[] {
  try {
    return JSON.parse(localStorage.getItem(KS) || "[]");
  } catch {
    return [];
  }
}

export default function A_Students() {
  const [items] = useState<StudentProfile[]>(() => load());
  const [q, setQ] = useState("");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [modalStudent, setModalStudent] = useState<StudentProfile | null>(null);

  function openStudentInfo(st: StudentProfile) {
    setModalStudent(st);
    setShowModal(true);
  }

  const filtered = useMemo(() => {
    return items.filter((s) => {
      const t = `${s.studentId} ${s.firstName} ${s.lastName} ${s.email} ${s.major} ${s.curriculum}`.toLowerCase();
      return t.includes(q.toLowerCase());
    });
  }, [items, q]);

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>

      {/* Header Card */}
      <section
        className="card"
        style={{
          padding: 24,
          marginBottom: 28,
          borderRadius: 18,
          boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
        }}
      >
        <h2 style={{ marginBottom: 16, fontSize: 20, fontWeight: 700 }}>
          ข้อมูลนักศึกษา
        </h2>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <input
            className="input"
            placeholder="ค้นหา: รหัส / ชื่อ / อีเมล / สาขาวิชา"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              flex: "1 1 280px",
              height: 42,
              borderRadius: 12,
              paddingLeft: 14,
              fontSize: 15,
            }}
          />
        </div>
      </section>

      {/* Table Card */}
      <section
        className="card"
        style={{
          padding: 20,
          borderRadius: 18,
          boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
        }}
      >
        <table
          className="tbl"
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: "0 10px",
          }}
        >
          <thead>
            <tr>
              {["รหัสนักศึกษา", "ชื่อ–นามสกุล", "อีเมล", "สาขาวิชา", "หลักสูตร", "รายละเอียด"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "6px 8px",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#374151",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: "center",
                    padding: 18,
                    color: "#6b7280",
                    fontSize: 14,
                  }}
                >
                  ไม่พบนักศึกษาตามเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr
                  key={s.studentId}
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  }}
                >
                  <td style={cell}>{s.studentId}</td>
                  <td style={cell}>{s.firstName} {s.lastName}</td>
                  <td style={cell}>{s.email || "-"}</td>
                  <td style={cell}>{s.major || "-"}</td>
                  <td style={cell}>{s.curriculum || "-"}</td>

                  <td style={cell}>
                    <button
                      className="btn-secondary"
                      onClick={() => openStudentInfo(s)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 999,
                        border: "1px solid #d1d5db",
                        background: "#fff",
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      ดูข้อมูล
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {showModal && modalStudent && (
        <StudentModal student={modalStudent} onClose={() => setShowModal(false)} />
      )}

    </div>
  );
}

/* Shared Cell Style */
const cell: React.CSSProperties = {
  padding: "14px 10px",
  fontSize: 15,
  color: "#111827",
};

/* ======================================================================
   Modal (iOS 2-column card)
====================================================================== */

function StudentModal({
  student,
  onClose,
}: {
  student: StudentProfile;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 28,
          borderRadius: 18,
          width: "100%",
          maxWidth: 760,
          boxShadow: "0 18px 45px rgba(15,23,42,.24)",
        }}
      >
        <h3 style={{ marginTop: 0, fontSize: 20, fontWeight: 700 }}>
          {student.studentId} — {student.firstName} {student.lastName}
        </h3>

        {/* 2-column Info */}
        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            background: "#f9fafb",
            padding: 16,
            borderRadius: 14,
            border: "1px solid #f3f4f6",
          }}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <Field label="อีเมล" value={student.email || "-"} />
            <Field label="เบอร์โทร" value={student.phone || "-"} />
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <Field label="สาขาวิชา" value={student.major || "-"} />
            <Field label="หลักสูตร" value={student.curriculum || "-"} />
          </div>
        </div>

        <h4 style={{ marginTop: 24, marginBottom: 8, fontSize: 16, fontWeight: 700 }}>
          เอกสารทั้งหมด
        </h4>

        <StudentDocs items={student.docs || []} />

        <div style={{ textAlign: "right", marginTop: 22 }}>
          <button
            className="btn-secondary"
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "1px solid #d1d5db",
              background: "#fff",
              fontSize: 14,
            }}
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

/* Field component for 2-column display */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, color: "#111827", fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}

/* ======================================================================
   Documents Table
====================================================================== */

function fmtStatus(s: DocStatus) {
  return {
    waiting: "รอส่งเอกสาร",
    "under-review": "รอพิจารณา",
    approved: "ผ่าน",
    rejected: "ไม่ผ่าน",
  }[s] || s;
}

function badgeColor(s: DocStatus) {
  return {
    waiting: "#fbbf24",
    "under-review": "#60a5fa",
    approved: "#22c55e",
    rejected: "#ef4444",
  }[s];
}

function StudentDocs({ items }: { items: DocumentItem[] }) {
  if (!items.length)
    return <p style={{ color: "#6b7280" }}>ยังไม่มีเอกสาร</p>;

  return (
    <table style={{ width: "100%", marginTop: 10 }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", padding: 6 }}>ชื่อเอกสาร</th>
          <th style={{ textAlign: "left", padding: 6 }}>สถานะ</th>
          <th style={{ textAlign: "left", padding: 6 }}>ไฟล์</th>
        </tr>
      </thead>

      <tbody>
        {items.map((it, i) => (
          <tr key={it.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
            <td style={{ padding: 10 }}>{it.title || it.id}</td>
            <td style={{ padding: 10 }}>
              <span
                style={{
                  background: badgeColor(it.status),
                  color: "#fff",
                  padding: "3px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                }}
              >
                {fmtStatus(it.status)}
              </span>
            </td>
            <td style={{ padding: 10 }}>
              {it.fileData ? (
                <a
                  href={it.fileData}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    fontSize: 13,
                  }}
                >
                  ดูไฟล์
                </a>
              ) : (
                "-"
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
