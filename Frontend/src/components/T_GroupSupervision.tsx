import React, { useState, useEffect } from "react";
import axios from "axios";
import Spinner from "./Spinner";

interface StudentAppointment {
  appointmentId: number;
  studentId: number;
  studentName: string;
  studentCode: string;
  proposedDates: string[];
  status: string;
  groupId: string | null;
}
interface CompanyGroup {
  companyId: string;
  companyName: string;
  students: StudentAppointment[];
  commonDates: string[];
}

function parseDateEntry(entry: string): { dateKey: string; displayDate: string; time: string } {
  const [dPart = "", tPart = ""] = entry.split("|");
  const d = new Date(dPart);
  const dateKey = dPart.slice(0, 10);
  const displayDate = isNaN(d.getTime())
    ? dPart
    : `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
  return { dateKey, displayDate, time: tPart || "" };
}

function hasDate(proposedDates: string[], targetDateKey: string): boolean {
  return proposedDates.some(e => e.split("|")[0].slice(0, 10) === targetDateKey);
}

export default function T_GroupSupervision() {
  const token = localStorage.getItem("coop.token");
  const [companies, setCompanies] = useState<CompanyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ company: CompanyGroup } | null>(null);
  const [selectedDateEntry, setSelectedDateEntry] = useState<string>("");
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get("/api/teacher/supervisions/by-company", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) setCompanies(res.data.companies);
    } catch {
      setError("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openModal = (company: CompanyGroup) => {
    setModal({ company });
    const firstEntry = company.commonDates[0] || "";
    setSelectedDateEntry(firstEntry);
    const dateKey = firstEntry.split("|")[0].slice(0, 10);
    setCheckedIds(new Set(
      company.students
        .filter(s => hasDate(s.proposedDates, dateKey))
        .map(s => s.appointmentId)
    ));
  };

  const onDateChange = (entry: string) => {
    setSelectedDateEntry(entry);
    const dateKey = entry.split("|")[0].slice(0, 10);
    setCheckedIds(new Set(
      modal!.company.students
        .filter(s => hasDate(s.proposedDates, dateKey))
        .map(s => s.appointmentId)
    ));
  };

  const toggleCheck = (id: number) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!modal || !selectedDateEntry || checkedIds.size === 0) return;
    setSubmitting(true);
    setConfirmError(null);
    try {
      const [dPart, tPart = "00:00"] = selectedDateEntry.split("|");
      const confirmedDate = new Date(`${dPart.slice(0, 10)}T${tPart}:00`).toISOString();
      const res = await axios.post(
        "/api/teacher/supervisions/confirm-group",
        { appointmentIds: [...checkedIds], confirmedDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.ok) {
        setModal(null);
        fetchData();
      } else {
        setConfirmError(res.data.message || "เกิดข้อผิดพลาด");
      }
    } catch {
      setConfirmError("ไม่สามารถยืนยันการนัดหมายได้ กรุณาลองใหม่");
    }
    setSubmitting(false);
  };

  if (loading) return <div style={{ padding: 32 }}><Spinner /></div>;
  if (error) return <div style={{ padding: 32, color: '#ef4444', textAlign: 'center' }}>{error}</div>;
  if (companies.length === 0) return (
    <div style={{ padding: 32, color: "#64748b", textAlign: "center" }}>
      ยังไม่มีการนัดหมายที่รอยืนยัน
    </div>
  );

  return (
    <div style={{ padding: "16px 0" }}>
      {companies.map(company => {
        const expanded = expandedIds.has(company.companyId);
        return (
          <div key={company.companyId} style={{
            border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 16, overflow: "hidden"
          }}>
            <div
              onClick={() => toggleExpand(company.companyId)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 20px", cursor: "pointer", background: "#f8fafc",
                userSelect: "none",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                {company.companyName}
                <span style={{
                  marginLeft: 10, fontSize: 12, color: "#64748b", fontWeight: 400
                }}>
                  {company.students.length} คน
                </span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {company.commonDates.length > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); openModal(company); }}
                    style={{
                      padding: "6px 14px", borderRadius: 7, border: "none",
                      background: "#0074B7", color: "#fff", fontWeight: 700,
                      cursor: "pointer", fontSize: 13,
                    }}
                  >
                    นัดพร้อมกัน ({company.commonDates.length} วัน)
                  </button>
                )}
                <span style={{ fontSize: 18, color: "#94a3b8" }}>{expanded ? "▲" : "▼"}</span>
              </div>
            </div>
            {expanded && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    <th style={thStyle}>ชื่อ-สกุล</th>
                    <th style={thStyle}>รหัส</th>
                    <th style={thStyle}>วันที่เสนอ</th>
                    <th style={thStyle}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {company.students.map(s => (
                    <tr key={s.appointmentId} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={tdStyle}>{s.studentName}</td>
                      <td style={tdStyle}>{s.studentCode}</td>
                      <td style={tdStyle}>
                        {s.proposedDates.map((e, i) => {
                          const { displayDate, time } = parseDateEntry(e);
                          return <div key={i}>{displayDate} {time}</div>;
                        })}
                      </td>
                      <td style={tdStyle}>{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {modal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999
        }}>
          <div style={{
            background: "#fff", borderRadius: 14, padding: 28, minWidth: 380, maxWidth: 500
          }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
              นัดพร้อมกัน — {modal.company.companyName}
            </div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>เลือกวันที่</label>
            <select
              value={selectedDateEntry}
              onChange={e => onDateChange(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #e2e8f0", marginBottom: 14 }}
            >
              {modal.company.commonDates.map(entry => {
                const { displayDate, time } = parseDateEntry(entry);
                return <option key={entry} value={entry}>{displayDate} {time}</option>;
              })}
            </select>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>นักศึกษา</div>
            {modal.company.students.map(s => {
              const dateKey = selectedDateEntry.split("|")[0].slice(0, 10);
              const eligible = hasDate(s.proposedDates, dateKey);
              return (
                <label key={s.appointmentId} style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
                  opacity: eligible ? 1 : 0.4, cursor: eligible ? "pointer" : "default"
                }}>
                  <input
                    type="checkbox"
                    checked={checkedIds.has(s.appointmentId)}
                    disabled={!eligible}
                    onChange={() => eligible && toggleCheck(s.appointmentId)}
                  />
                  {s.studentName} ({s.studentCode})
                  {!eligible && <span style={{ fontSize: 11, color: "#ef4444" }}>ไม่ได้เสนอวันนี้</span>}
                </label>
              );
            })}
            {confirmError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 8 }}>{confirmError}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setModal(null)}
                style={{ padding: "8px 18px", borderRadius: 7, border: "1px solid #e2e8f0", cursor: "pointer" }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting || checkedIds.size === 0}
                style={{
                  padding: "8px 20px", borderRadius: 7, border: "none",
                  background: "#0074B7", color: "#fff", fontWeight: 700,
                  cursor: "pointer", opacity: (submitting || checkedIds.size === 0) ? 0.5 : 1
                }}
              >
                {submitting ? "กำลังยืนยัน..." : `ยืนยัน (${checkedIds.size} คน)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: "#475569"
};
const tdStyle: React.CSSProperties = {
  padding: "10px 16px", verticalAlign: "top"
};
