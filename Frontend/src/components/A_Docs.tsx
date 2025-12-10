/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/A_Docs.tsx

import React, { useState } from "react";

const KD = "coop.admin.docPeriods.v1"; // เก็บช่วงส่งเอกสาร
const YEAR_KEY = "coop.admin.academicYear";

// โหลดปีการศึกษา
function loadYear(): string {
  return localStorage.getItem(YEAR_KEY) || "2568/1";
}

// โหลดช่วงส่งเอกสาร
function loadPeriods(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem(KD) || "{}");
  } catch {
    return {};
  }
}

// บันทึก
function savePeriods(v: any) {
  localStorage.setItem(KD, JSON.stringify(v));
}

export default function A_Docs() {
  const year = loadYear(); // ไม่มีการแก้ไข ใช้เป็นตัวแสดงผลเท่านั้น
  const [periods, setPeriods] = useState(loadPeriods());

  // Modal state
  const [editingId, setEditingId] = useState<string>("");
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
  });

  // เอกสารที่มีในระบบ (mock)
  const allDocs = [
    { id: "T00", title: "แบบคำร้องขอฝึกสหกิจ" },
    { id: "T001", title: "ใบสมัครงานสหกิจศึกษา" },
    { id: "T002", title: "รายละเอียดงาน / สถานประกอบการ" },
    { id: "T003", title: "แผน/โครงร่างรายงาน" },
    { id: "T004", title: "บันทึกการปฏิบัติงาน" },
    { id: "T005", title: "รายงานฉบับสมบูรณ์" },
  ];

  function openEditor(docId: string) {
    setEditingId(docId);

    const p = periods[docId] || {};
    setForm({
      startDate: p.startDate || "",
      startTime: p.startTime || "",
      endDate: p.endDate || "",
      endTime: p.endTime || "",
    });

    setShowModal(true);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();

    const next = {
      ...periods,
      [editingId]: { ...form },
    };

    setPeriods(next);
    savePeriods(next);
    setShowModal(false);
  }

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      {/* Header */}
      <section
        className="card"
        style={{
          padding: 24,
          marginBottom: 28,
          width: "95%",
          maxWidth: 1480,
          marginInline: "auto",
        }}
      >
        <h2 style={{ margin: 0 }}>ตั้งค่าช่วงเวลาส่งเอกสาร</h2>
        <p style={{ marginTop: 6, color: "#6b7280" }}>
          ปีการศึกษา: <b>{year}</b>
        </p>
      </section>

      {/* Document List */}
      <section
        className="card"
        style={{
          padding: 24,
          width: "95%",
          maxWidth: 1480,
          marginInline: "auto",
        }}
      >
        {allDocs.map((d) => {
          const p = periods[d.id] || {};
          const start = p.startDate ? `${p.startDate} ${p.startTime ?? ""}` : "-";
          const end = p.endDate ? `${p.endDate} ${p.endTime ?? ""}` : "-";

          return (
            <div
              key={d.id}
              style={{
                padding: "14px 0",
                borderBottom: "1px solid #f1f5f9",
                display: "grid",
                gridTemplateColumns: "1fr 180px 180px auto",
                gap: 12,
                alignItems: "center",
                fontSize: 14,
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{d.title}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>ID: {d.id}</div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>เริ่มส่งได้</div>
                <div>{start}</div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>ส่งได้ถึง</div>
                <div>{end}</div>
              </div>

              <button
                className="btn"
                type="button"
                onClick={() => openEditor(d.id)}
                style={{ whiteSpace: "nowrap" }}
              >
                แก้ไขช่วงส่ง
              </button>
            </div>
          );
        })}
      </section>

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 600 }}>
            <h3 style={{ marginTop: 0 }}>แก้ไขช่วงส่งเอกสาร</h3>
            <p style={{ marginTop: 2, color: "#6b7280" }}>
              เอกสาร: <b>{editingId}</b>
            </p>

            <form
              onSubmit={save}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                marginTop: 14,
              }}
            >
              <div>
                <label className="label">วันที่เริ่มส่ง</label>
                <input
                  className="input"
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((x) => ({ ...x, startDate: e.target.value }))
                  }
                  style={{ width: "90%" }}
                />
              </div>

              <div>
                <label className="label">เวลาเริ่มส่ง</label>
                <input
                  className="input"
                  type="time"
                  value={form.startTime}
                  onChange={(e) =>
                    setForm((x) => ({ ...x, startTime: e.target.value }))
                  }
                  style={{ width: "90%" }}
                />
              </div>

              <div>
                <label className="label">วันที่สิ้นสุด</label>
                <input
                  className="input"
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((x) => ({ ...x, endDate: e.target.value }))
                  }
                  style={{ width: "90%" }}
                />
              </div>

              <div>
                <label className="label">เวลาสิ้นสุด</label>
                <input
                  className="input"
                  type="time"
                  value={form.endTime}
                  onChange={(e) =>
                    setForm((x) => ({ ...x, endTime: e.target.value }))
                  }
                  style={{ width: "90%" }}
                />
              </div>

              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  ยกเลิก
                </button>
                <button type="submit" className="btn">
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        .modal-backdrop{
          position:fixed; inset:0;
          background:rgba(15,23,42,.35);
          display:flex; align-items:center; justify-content:center;
          z-index:40;
        }
        .modal-card{
          background:white;
          padding:24px;
          border-radius:18px;
          box-shadow:0 18px 45px rgba(0,0,0,.18);
          width:100%;
        }
        .btn-secondary{
          padding:8px 16px;
          border-radius:10px;
          background:#fff;
          border:1px solid #d1d5db;
        }
      `}</style>
    </div>
  );
}
