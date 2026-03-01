import { useState, useEffect, useMemo } from "react";
import StatusBadge from "../components/StatusBadge";

/* =========================
   Types
========================= */
interface StudentDocument {
  id: number;
  name: string;
  path: string;
}

interface Mentor {
  firstName?: string;
  lastName?: string;
  position?: string;
  department?: string;
  email?: string;
  phone?: string;
}

interface Company {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

interface StudentProfile {
  id: number;
  studentId: string;
  firstName?: string;
  lastName?: string;
  prefix?: string;
  year?: string;
  faculty?: string;
  major?: string;
  studyProgram?: string;
  gpa?: number;
  phone?: string;
  user?: { email: string };
  nationality?: string;
  company?: Company;
  docStatus?: "WAITING" | "WAITING_FOR_STAFF_CHECK" | "EDITS_REQUIRED" | "REQ_LETTER_ISSUED" | "DOCS_APPROVED" | "WAITING_FOR_PLACEMENT_LETTER" | "WAITING_FOR_STAFF_CHECK_LETTER" | "ACCEPTANCE_CHECKED" | "PLACEMENT_LETTER_ISSUED";
  coop?: {
    status: string;
    company?: Company;
    mentor?: Mentor;
    teacherComment?: string;
  };
  documents?: StudentDocument[];
}

/* =========================
   Mapping Helpers
========================= */
const MAJOR_TH: Record<string, string> = {
  CS: "วิทยาการคอมพิวเตอร์",
  IT: "เทคโนโลยีสารสนเทศ",
  GIS: "ภูมิสารสนเทศศาสตร์",
};

const CURRICULUM_TH: Record<string, string> = {
  normal: "ภาคปกติ",
  special: "ภาคพิเศษ",
};

const STATUS_TH: Record<string, string> = {
  draft: "ฉบับร่าง",
  pending: "รอพิจารณา",
  submitted: "รอพิจารณา",
  approved: "อนุมัติ",
  rejected: "ไม่อนุมัติ",
  edits_required: "รอแก้ไข"
};

function getThaiPrefix(prefix?: string) {
  const p = (prefix || "").trim().toLowerCase();
  if (['mr', 'mr.', 'mister', 'นาย'].includes(p)) return "นาย";
  if (['miss', 'ms', 'ms.', 'นางสาว'].includes(p)) return "นางสาว";
  if (['mrs', 'mrs.', 'นาง'].includes(p)) return "นาง";
  return prefix || "";
}

function normalizeStatus(status?: string) {
  const s = (status || "draft").toLowerCase();
  if (s === "pending") return "submitted";
  if (s === "qualified") return "approved"; // Map qualified -> approved ให้แสดงผลเหมือนกัน
  if (s === "qualification_failed") return "rejected";
  return s;
}

/* =========================
   Main Component
========================= */
export default function A_Students() {
  const [items, setItems] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState("");
  const [filterMajors, setFilterMajors] = useState<string[]>([]);
  const [filterCurriculums, setFilterCurriculums] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);

  const [modalStudent, setModalStudent] = useState<StudentProfile | null>(null);

  // --- Fetch Data ---
  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("coop.token");
      const res = await fetch("http://localhost:5000/api/students", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Update Status ---
  const handleUpdateStatus = async (studentId: number, status: string, comment: string) => {
    try {
      const token = localStorage.getItem("coop.token");
      const res = await fetch("http://localhost:5000/api/coop/status", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: studentId,
          status: status,
          comment: comment
        }),
      });

      if (res.ok) {
        alert("บันทึกสถานะเรียบร้อย");
        setModalStudent(null);
        fetchData();
      } else {
        const d = await res.json();
        alert("Error: " + d.message);
      }
    } catch (err) {
      console.error(err);
      alert("Cannot connect to server");
    }
  };

  function resetFilters() {
    setQ("");
    setFilterMajors([]);
    setFilterCurriculums([]);
    setFilterStatuses([]);
  }

  // --- Filter Logic ---
  const filtered = useMemo(() => {
    return items.filter((s) => {
      const email = s.user?.email || "";
      const text = `${s.studentId} ${getThaiPrefix(s.prefix)} ${s.firstName} ${s.lastName} ${email}`.toLowerCase();
      const st = normalizeStatus(s.coop?.status);

      return (
        text.includes(q.toLowerCase()) &&
        (filterMajors.length === 0 || filterMajors.includes(s.major ?? "")) &&
        (filterCurriculums.length === 0 || filterCurriculums.includes(s.studyProgram ?? "")) &&
        (filterStatuses.length === 0 || filterStatuses.includes(st))
      );
    });
  }, [items, q, filterMajors, filterCurriculums, filterStatuses]);

  if (loading) return <div style={{ padding: 28, marginLeft: 35 }}>กำลังโหลดข้อมูล...</div>;

  return (
    <div style={{ padding: 28, marginLeft: 35 }}>
      {/* ================= Filters ================= */}
      <section style={card}>
        <h2 style={{ marginBottom: 16, marginTop: 0 }}>ข้อมูลนักศึกษา</h2>

        <div style={filterRow}>
          <input
            className="input"
            placeholder="ค้นหา: รหัส / ชื่อ / อีเมล"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 260, padding: '8px', borderRadius: 8, border: '1px solid #e5e7eb' }}
          />

          <FilterBox
            title="สาขาวิชา"
            items={MAJOR_TH}
            values={filterMajors}
            onChange={setFilterMajors}
          />
          <FilterBox
            title="หลักสูตร"
            items={CURRICULUM_TH}
            values={filterCurriculums}
            onChange={setFilterCurriculums}
          />
          {/* <FilterBox
            title="สถานะคำร้อง"
            items={{ submitted: "รอพิจารณา", approved: "อนุมัติ", rejected: "ไม่อนุมัติ", edits_required: "รอแก้ไข" }}
            values={filterStatuses}
            onChange={setFilterStatuses}
          /> */}

          <button className="btn" style={saveBtn} onClick={resetFilters}>
            ล้างตัวกรอง
          </button>
        </div>
      </section>

      {/* ================= Table ================= */}
      <section style={{ ...card, marginTop: 20, padding: 0, overflow: 'hidden' }}>
        <table width="100%" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {["รหัส", "ชื่อ–นามสกุล", "อีเมล", "สาขา", "หลักสูตร", "สถานะ", "รายละเอียด"].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: "#64748b" }}>
                  ไม่พบนักศึกษาตามเงื่อนไข
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={td}>{s.studentId}</td>
                  <td style={td}>
                    {getThaiPrefix(s.prefix)} {s.firstName} {s.lastName}
                  </td>
                  <td style={td}>{s.user?.email || "-"}</td>
                  <td style={td}>{MAJOR_TH[s.major ?? ""] ?? s.major ?? "-"}</td>
                  <td style={td}>{CURRICULUM_TH[s.studyProgram ?? ""] ?? s.studyProgram ?? "-"}</td>
                  <td style={td}><StatusBadge status={s.coop?.status || s.docStatus} /></td>
                  <td style={td}>
                    <button
                      className="btn"
                      style={ghostBtn}
                      onClick={() => setModalStudent(s)}
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

      {/* ================= Modal ================= */}
      {modalStudent && (
        <StudentModal
          student={modalStudent}
          onClose={() => setModalStudent(null)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </div>
  );
}

/* =========================
   Modal Component
========================= */
function StudentModal({
  student,
  onClose,
  onUpdateStatus,
}: {
  student: StudentProfile;
  onClose: () => void;
  onUpdateStatus: (id: number, status: string, comment: string) => void;
}) {
  const [tab, setTab] = useState<"profile" | "company" | "docs">("profile");
  const [reason, setReason] = useState("");

  const companyData = student.coop?.company || student.company;
  const mentorData = student.coop?.mentor;
  const currentStatus = normalizeStatus(student.coop?.status);

  // ✅ แก้ไขเงื่อนไขให้ครอบคลุมสถานะที่รอตรวจ (Applying / Submitted)
  const isPending = currentStatus === "submitted" || currentStatus === "applying" || currentStatus === "waiting_for_staff_check";

  const fullName = `${getThaiPrefix(student.prefix)} ${student.firstName} ${student.lastName}`.trim();

  return (
    <div style={overlay}>
      <div style={modal}>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{fullName}</h2>
          <div style={{ color: "#64748b" }}>รหัสนักศึกษา: {student.studentId}</div>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button style={tab === "profile" ? saveBtn : ghostBtn} onClick={() => setTab("profile")}>ข้อมูลนักศึกษา</button>
          <button style={tab === "company" ? saveBtn : ghostBtn} onClick={() => setTab("company")}>ข้อมูลบริษัท</button>
          <button style={tab === "docs" ? saveBtn : ghostBtn} onClick={() => setTab("docs")}>เอกสาร</button>
        </div>

        {/* Content */}
        <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          {tab === "profile" && (
            <Section title="ข้อมูลส่วนตัว">
              <InfoRow label="รหัสนักศึกษา" value={student.studentId} />
              <InfoRow label="ชื่อ-สกุล" value={fullName} />
              <InfoRow label="ชั้นปี" value={student.year} />
              <InfoRow label="คณะ" value={student.faculty || "วิทยาลัยการคอมพิวเตอร์"} />
              <InfoRow label="สาขาวิชา" value={MAJOR_TH[student.major || ""] || student.major} />
              <InfoRow label="หลักสูตร" value={CURRICULUM_TH[student.studyProgram || ""] || student.studyProgram} />
              <InfoRow label="เบอร์โทร" value={student.phone} />
              <InfoRow label="อีเมล" value={student.user?.email} />
              <InfoRow label="GPA" value={student.gpa?.toFixed(2)} />
              <InfoRow label="สัญชาติ" value={student.nationality} />
            </Section>
          )}

          {tab === "company" && (
            <>
              <Section title="ข้อมูลสถานประกอบการ">
                {companyData ? (
                  <>
                    <InfoRow label="ชื่อบริษัท" value={companyData.name} />
                    <InfoRow label="ที่อยู่" value={companyData.address} />
                    <InfoRow label="อีเมล" value={companyData.email} />
                    <InfoRow label="เบอร์โทร" value={companyData.phone} />
                  </>
                ) : <div>-</div>}
              </Section>
              <Section title="ข้อมูลพี่เลี้ยง">
                {mentorData ? (
                  <>
                    <InfoRow label="ชื่อ-สกุล" value={`${mentorData.firstName} ${mentorData.lastName}`} />
                    <InfoRow label="ตำแหน่ง" value={mentorData.position} />
                    <InfoRow label="แผนก" value={mentorData.department} />
                    <InfoRow label="อีเมล" value={mentorData.email} />
                    <InfoRow label="เบอร์โทร" value={mentorData.phone} />
                  </>
                ) : <div>-</div>}
              </Section>
            </>
          )}

          {tab === "docs" && (
            <Section title="เอกสารที่อัปโหลด">
              {student.documents && student.documents.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
                  {student.documents.map(doc => (
                    <li key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>📄</span>
                        <span style={{ fontSize: 14 }}>{doc.name}</span>
                      </div>
                      {/* ✅ ใส่ encodeURIComponent เพื่อรองรับชื่อไฟล์ภาษาไทย */}
                      <a href={`http://localhost:5000/uploads/${encodeURIComponent(doc.path)}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#0074B7', textDecoration: 'none', fontWeight: 600 }}>
                        เปิดดู
                      </a>
                    </li>
                  ))}
                </ul>
              ) : <div style={{ color: '#94a3b8' }}>ไม่มีเอกสาร</div>}
            </Section>
          )}
        </div>

        {/* Footer Actions */}
        {isPending && (
          <Section title="ผลการพิจารณา">
            <textarea
              style={textarea}
              placeholder="ระบุเหตุผล (กรณีไม่อนุมัติ)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="btn" style={{ ...ghostBtn, color: "#dc2626", borderColor: '#dc2626' }} onClick={() => onUpdateStatus(student.id, "REJECTED", reason)}>
                ไม่อนุมัติ
              </button>
              <button className="btn" style={saveBtn} onClick={() => onUpdateStatus(student.id, "APPROVED", reason)}>
                อนุมัติ
              </button>
            </div>
          </Section>
        )}

        <div style={modalFooter}>
          <button className="btn" style={saveBtn} onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

// UI Helpers & Styles
const ghostBtn: React.CSSProperties = { background: "#fff", color: "#0074B7", boxShadow: "none", border: "1px solid rgba(10,132,255,.25)", height: 36, borderRadius: 8, padding: '0 16px', cursor: 'pointer' };
const saveBtn: React.CSSProperties = { background: "#0074B7", color: "#fff", boxShadow: "none", border: "1px solid rgba(10,132,255,.25)", height: 36, borderRadius: 8, padding: '0 16px', cursor: 'pointer' };
const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e5e7eb" };
const filterRow: React.CSSProperties = { display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" };
const th: React.CSSProperties = { textAlign: "left", paddingBottom: 8, fontSize: 14, padding: "12px 10px", color: '#475569' };
const td: React.CSSProperties = { padding: "12px 10px", fontSize: 14, color: '#1e293b' };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 };
const modal: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 700, border: "1px solid #e5e7eb" };
const modalFooter: React.CSSProperties = { display: "flex", justifyContent: "flex-end", marginTop: 24 };
const textarea: React.CSSProperties = { width: "100%", minHeight: 90, borderRadius: 10, padding: 12, border: "1px solid #e5e7eb", fontFamily: 'inherit' };

function Section({ title, children }: { title: string; children: React.ReactNode }) { return (<div style={sectionCard}><div style={sectionTitle}>{title}</div>{children}</div>); }
const sectionCard: React.CSSProperties = { background: "#f8fafc", borderRadius: 12, padding: 16, marginBottom: 14 };
const sectionTitle: React.CSSProperties = { fontWeight: 700, marginBottom: 10, fontSize: 14 };

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) { return (<div style={{ display: "grid", gridTemplateColumns: "120px 1fr", marginBottom: 4 }}><div style={{ color: "#64748b", fontWeight: 600 }}>{label}</div><div style={{ fontWeight: 600 }}>{value || "-"}</div></div>); }

function FilterBox({ title, items, values, onChange }: { title: string; items: Record<string, string>; values: string[]; onChange: (v: string[]) => void; }) { return (<div><div style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>{title}</div><div style={{ display: 'flex', gap: 10 }}>{Object.entries(items).map(([k, v]) => (<label key={k} style={{ fontSize: 13, cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={values.includes(k)} onChange={(e) => onChange(e.target.checked ? [...values, k] : values.filter((x) => x !== k))} /> {v}</label>))}</div></div>); }

// ✅ ปรับ StatusBadge ให้ Safe (Fallback ถ้าหา status ไม่เจอ)
// function StatusBadge({ status }: { status?: string }) {
//   const map: Record<string, { bg: string; color: string }> = {
//     submitted: { bg: "#eff6ff", color: "#1e40af" },
//     approved: { bg: "#ecfdf5", color: "#065f46" },
//     rejected: { bg: "#fef2f2", color: "#991b1b" },
//     edits_required: { bg: "#fff7ed", color: "#c2410c" },
//     draft: { bg: "#f1f5f9", color: "#64748b" },
//     // เพิ่ม qualified ให้แสดงเหมือน approved
//     qualified: { bg: "#ecfdf5", color: "#065f46" }
//   };

//   const s = status ? (map[status] || map['draft']) : map['draft'];
//   const label = STATUS_TH[status ?? ""] ?? STATUS_TH['draft'];

//   return (<span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>{label}</span>);
// }