import { useState, useEffect, useMemo, useRef } from "react";
import StatusBadge from "../components/StatusBadge";
import { useDebounce } from "../hooks/useDebounce";

/* =========================
   Types
========================= */
interface CoopPeriod {
  id: number;
  semester: string | number;
  academicYear: string;
}

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
  addressNo?: string;
  moo?: string;
  soi?: string;
  road?: string;
  subDistrict?: string;
  district?: string;
  province?: string;
  zipcode?: string;
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
// เก็บไว้เผื่อเป็น Fallback สำหรับข้อมูลเก่าในระบบ
const LEGACY_MAJOR_TH: Record<string, string> = {
  CS: "วิทยาการคอมพิวเตอร์",
  IT: "เทคโนโลยีสารสนเทศ",
  GIS: "ภูมิสารสนเทศศาสตร์",
};

const CURRICULUM_TH: Record<string, string> = {
  normal: "ภาคปกติ",
  special: "ภาคพิเศษ",
};

function getThaiPrefix(prefix?: string) {
  const p = (prefix || "").trim().toLowerCase();
  if (['mr', 'mr.', 'mister', 'นาย'].includes(p)) return "นาย";
  if (['miss', 'ms', 'ms.', 'นางสาว'].includes(p)) return "นางสาว";
  if (['mrs', 'mrs.', 'นาง'].includes(p)) return "นาง";
  return prefix || "";
}

function getFullAddress(c?: Company) {
  if (!c) return "-";

  if (c.address && !c.addressNo && !c.province) return c.address;

  const isBKK = c.province === "กรุงเทพมหานคร" || c.province === "กรุงเทพฯ" || c.province === "กทม.";

  const parts = [
    c.addressNo && `${c.addressNo}`,
    c.moo && `หมู่ ${c.moo}`,
    c.soi && `ซอย${c.soi}`,
    c.road && `ถนน${c.road}`,
    c.subDistrict && (isBKK ? `แขวง${c.subDistrict}` : `ต.${c.subDistrict}`),
    c.district && (isBKK ? `เขต${c.district}` : `อ.${c.district}`),
    c.province && (isBKK ? c.province : `จ.${c.province}`),
    c.zipcode
  ];

  const fullAddress = parts.filter(Boolean).join(" ");
  return fullAddress || c.address || "ไม่มีข้อมูลที่อยู่";
}

function normalizeStatus(status?: string) {
  const s = (status || "draft").toLowerCase();
  if (s === "pending") return "submitted";
  if (s === "qualified") return "approved";
  if (s === "qualification_failed") return "rejected";
  return s;
}

/* =========================
   Main Component
========================= */
export default function A_Students() {
  const [items, setItems] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // 🟢 State สำหรับเก็บสาขาวิชาจาก API
  const [dynamicMajors, setDynamicMajors] = useState<Record<string, string>>({});

  // Filters
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [filterMajors, setFilterMajors] = useState<string[]>([]);
  const [filterCurriculums, setFilterCurriculums] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);

  const [modalStudent, setModalStudent] = useState<StudentProfile | null>(null);
  const [coopPeriods, setCoopPeriods] = useState<CoopPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("all");

  // --- Fetch Data ---
  const fetchStudents = async (periodId: string) => {
    try {
      const token = localStorage.getItem("coop.token");
      const params = periodId !== "all" ? `?coopPeriodId=${periodId}` : "";
      const res = await fetch(`/api/students${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : (data?.data ?? []));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("coop.token");

      const resPeriods = await fetch("/api/admin/coop-periods/all", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resPeriods.ok) {
        const data = await resPeriods.json();
        if (data?.periods) setCoopPeriods(data.periods);
      }

      const resMajors = await fetch("/api/admin/majors", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resMajors.ok) {
        const dataMajors = await resMajors.json();
        if (dataMajors.ok) {
          const majorDict: Record<string, string> = { ...LEGACY_MAJOR_TH };
          dataMajors.majors.forEach((m: string) => {
            majorDict[m] = m;
          });
          setDynamicMajors(majorDict);
        }
      }

      await fetchStudents(selectedPeriodId);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const initialMount = useRef(true);
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    fetchStudents(selectedPeriodId);
  }, [selectedPeriodId]);

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
        text.includes(debouncedQ.toLowerCase()) &&
        (filterMajors.length === 0 || filterMajors.includes(s.major ?? "")) &&
        (filterCurriculums.length === 0 || filterCurriculums.includes(s.studyProgram ?? "")) &&
        (filterStatuses.length === 0 || filterStatuses.includes(st))
      );
    });
  }, [items, debouncedQ, filterMajors, filterCurriculums, filterStatuses]);

  if (loading) return <div style={{ padding: 28, marginLeft: 35 }}>กำลังโหลดข้อมูล...</div>;

  return (
    <div style={{ padding: 28, marginLeft: 35 }}>
      {/* ================= Filters ================= */}
      <section style={card}>
        <h2 style={{ marginBottom: 16, marginTop: 0 }}>ข้อมูลนักศึกษา</h2>

        <div style={filterRow}>
          <select
            className="input"
            style={{ padding: '8px', borderRadius: 8, border: '1px solid #e5e7eb' }}
            value={selectedPeriodId}
            onChange={e => setSelectedPeriodId(e.target.value)}
          >
            <option value="all">📚 ทุกปีการศึกษา</option>
            {coopPeriods.map(p => (
              <option key={p.id} value={String(p.id)}>
                เทอม {p.semester} / {p.academicYear}
              </option>
            ))}
          </select>

          <input
            className="input"
            placeholder="ค้นหา: รหัส / ชื่อ / อีเมล"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 260, padding: '8px', borderRadius: 8, border: '1px solid #e5e7eb' }}
          />

          <FilterBox
            title="สาขาวิชา"
            items={Object.keys(dynamicMajors).length > 0 ? dynamicMajors : LEGACY_MAJOR_TH} // 🟢 ใช้ Dynamic Majors
            values={filterMajors}
            onChange={setFilterMajors}
          />
          <FilterBox
            title="หลักสูตร"
            items={CURRICULUM_TH}
            values={filterCurriculums}
            onChange={setFilterCurriculums}
          />

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
                  {/* 🟢 แสดงสาขาโดยเช็คจากข้อมูลเก่าเผื่อไว้ ถ้าไม่ตรงให้แสดงชื่อตรงๆ */}
                  <td style={td}>{LEGACY_MAJOR_TH[s.major ?? ""] ?? s.major ?? "-"}</td>
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
}: {
  student: StudentProfile;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"profile" | "company" | "docs">("profile");

  const companyData = student.coop?.company || student.company;
  const mentorData = student.coop?.mentor;

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
              <InfoRow label="สาขาวิชา" value={LEGACY_MAJOR_TH[student.major || ""] || student.major} />
              <InfoRow label="หลักสูตร" value={CURRICULUM_TH[student.studyProgram || ""] || student.studyProgram} />
              <InfoRow label="เบอร์โทร" value={student.phone} />
              <InfoRow label="อีเมล" value={student.user?.email} />
              <InfoRow label="GPA" value={student.gpa?.toFixed(2)} />
            </Section>
          )}

          {tab === "company" && (
            <>
              <Section title="ข้อมูลสถานประกอบการ">
                {companyData ? (
                  <>
                    <InfoRow label="ชื่อบริษัท" value={companyData.name} />
                    <InfoRow label="ที่อยู่" value={getFullAddress(companyData)} />
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
                      <a href={`/uploads/${encodeURIComponent(doc.path)}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#0074B7', textDecoration: 'none', fontWeight: 600 }}>
                        เปิดดู
                      </a>
                    </li>
                  ))}
                </ul>
              ) : <div style={{ color: '#94a3b8' }}>ไม่มีเอกสาร</div>}
            </Section>
          )}
        </div>

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

function Section({ title, children }: { title: string; children: React.ReactNode }) { return (<div style={sectionCard}><div style={sectionTitle}>{title}</div>{children}</div>); }
const sectionCard: React.CSSProperties = { background: "#f8fafc", borderRadius: 12, padding: 16, marginBottom: 14 };
const sectionTitle: React.CSSProperties = { fontWeight: 700, marginBottom: 10, fontSize: 14 };

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) { return (<div style={{ display: "grid", gridTemplateColumns: "120px 1fr", marginBottom: 4 }}><div style={{ color: "#64748b", fontWeight: 600 }}>{label}</div><div style={{ fontWeight: 600 }}>{value || "-"}</div></div>); }

function FilterBox({ title, items, values, onChange }: { title: string; items: Record<string, string>; values: string[]; onChange: (v: string[]) => void; }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>{title}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        {Object.entries(items).map(([k, v]) => (
          <label key={k} style={{ fontSize: 13, cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={values.includes(k)}
              onChange={(e) => onChange(e.target.checked ? [...values, k] : values.filter((x) => x !== k))}
            />
            {v}
          </label>
        ))}
      </div>
    </div>
  );
}