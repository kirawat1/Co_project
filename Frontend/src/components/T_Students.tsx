import { useMemo, useState, useEffect, useRef } from "react";
import axios from "axios";
import StatusBadge from "../components/StatusBadge";
import StatusFilterChips, { STATUS_GROUPS } from "./StatusFilterChips";
import { useDebounce } from "../hooks/useDebounce";

// --- Interfaces ---
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
  docStatus?: string;
  coopPeriodId?: number; // ✅ กรองตามปี
  coop?: {
    status: string;
    company?: Company;
    mentor?: Mentor;
  };
  coopRequest?: {
    status: string;
  };
  documents?: StudentDocument[];
}

interface CoopPeriod {
  id: number;
  semester: string | number;
  academicYear: string;
}

// Fallback สำหรับข้อมูลเก่า
const LEGACY_MAJOR_TH: Record<string, string> = {
  CS: "วิทยาการคอมพิวเตอร์",
  IT: "เทคโนโลยีสารสนเทศ",
  GIS: "ภูมิสารสนเทศศาสตร์",
};

// --- Helpers ---
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

interface Props { isCoopTeacher?: boolean; }

export default function T_Students({ isCoopTeacher = false }: Props) {
  const [allStudents, setAllStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ States สำหรับค้นหาและตัวกรอง
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [coopPeriods, setCoopPeriods] = useState<CoopPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");

  const [dynamicMajors, setDynamicMajors] = useState<Record<string, string>>({});
  const [filterMajor, setFilterMajor] = useState<string>("all");

  // ✅ State สำหรับควบคุม Modal แบบ Admin
  const [modalStudent, setModalStudent] = useState<StudentProfile | null>(null);

  // --- 1. Fetch Data ---
  const fetchStudents = async (periodId: string, search = "") => {
    const token = localStorage.getItem("coop.token");
    const params = new URLSearchParams({ limit: "50" });
    if (periodId !== "all") params.set("coopPeriodId", periodId);
    if (search.trim()) params.set("search", search.trim());

    // isCoopTeacher=true → all students; false → advisees only
    const endpoint = isCoopTeacher
      ? `/api/students?${params}`
      : `/api/teacher/my-students?${params}`;

    try {
      const resStd = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resStd.ok) {
        const data = await resStd.json();
        setAllStudents(data?.data ?? []);
      }
    } catch (err) {
      console.error("Error fetching students:", err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem("coop.token");
    try {
      const resPeriods = await axios.get("/api/admin/coop-periods/all", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resPeriods.data?.periods) {
        setCoopPeriods(resPeriods.data.periods);
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

      await fetchStudents(selectedPeriod, "");
    } catch (err) {
      console.error("Error fetching data:", err);
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
    fetchStudents(selectedPeriod, debouncedQ);
  }, [selectedPeriod]);

  const initialSearchMount = useRef(true);
  useEffect(() => {
    if (initialSearchMount.current) {
      initialSearchMount.current = false;
      return;
    }
    fetchStudents(selectedPeriod, debouncedQ);
  }, [debouncedQ]);

  const [activeStatusGroup, setActiveStatusGroup] = useState<string>("ALL");
  const [statusGroupFilter, setStatusGroupFilter] = useState<string[]>([]);

  const handleStatusGroupChange = (group: string) => {
    setActiveStatusGroup(group);
    setStatusGroupFilter(group === "ALL" ? [] : STATUS_GROUPS[group]?.statuses ?? []);
  };

  // --- 2. Filter Logic ---
  const filteredStudents = useMemo(() => {
    return allStudents.filter((s) => {
      const matchMajor = filterMajor === "all" || s.major === filterMajor;
      const matchGroup = statusGroupFilter.length === 0 || statusGroupFilter.includes(s.coop?.status ?? "");
      return matchMajor && matchGroup;
    });
  }, [allStudents, filterMajor, statusGroupFilter]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>กำลังโหลดข้อมูล...</div>;

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      {/* Header Card */}
      <section className="card p-6 mb-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 15 }}>
          <div>
            <h2 className="title-text" style={{ margin: '0 0 4px 0' }}>👥 รายชื่อนักศึกษาในความดูแล</h2>
            <div style={{ color: "#64748b", fontSize: 14 }}>
              ตรวจสอบและติดตามสถานะของนักศึกษาในความดูแลของคุณ
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn-ghost" onClick={fetchData}>🔄 รีเฟรช</button>
            <div style={{ background: '#f0f9ff', color: '#0284c7', padding: '8px 16px', borderRadius: 8, fontWeight: 700, border: '1px solid #bae6fd' }}>
              ทั้งหมด {filteredStudents.length} คน
            </div>
          </div>
        </div>

        {/* Status Filter Chips */}
        <StatusFilterChips
          students={allStudents}
          activeFilter={activeStatusGroup}
          onFilterChange={handleStatusGroupChange}
        />

        {/* Filters */}
        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            className="input soft"
            placeholder="🔍 ค้นหา: รหัสนักศึกษา / ชื่อ / บริษัท..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 250 }}
          />

          <select className="input soft" style={{ width: 'auto' }} value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
            <option value="all">📚 ทุกปีการศึกษา</option>
            {coopPeriods.map(p => (
              <option key={p.id} value={String(p.id)}>เทอม {p.semester} / {p.academicYear}</option>
            ))}
          </select>

          <select className="input soft" style={{ width: 'auto' }} value={filterMajor} onChange={e => setFilterMajor(e.target.value)}>
            <option value="all">🎓 ทุกสาขาวิชา</option>
            {Object.entries(dynamicMajors).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Table Card */}
      <section>
        <table className="student-table">
          <thead>
            <tr>
              <th>รหัสนักศึกษา</th>
              <th>ชื่อ-นามสกุล</th>
              <th>สาขาวิชา</th>
              <th>สถานประกอบการ</th>
              <th>สถานะคำร้อง</th>
              <th style={{ textAlign: 'right' }}>รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                  — ไม่พบรายชื่อนักศึกษาที่ตรงกับเงื่อนไข —
                </td>
              </tr>
            ) : filteredStudents.map((s) => {
              const name = `${s.firstName || ""} ${s.lastName || ""}`.trim() || "-";
              const st = s.coop?.status || s.coopRequest?.status || s.docStatus || "WAITING";
              const displayMajor = dynamicMajors[s.major || ""] || s.major || "-";

              return (
                <tr key={s.studentId} className="student-row">
                  <td style={{ fontWeight: 700, color: '#0ea5e9' }}>{s.studentId}</td>
                  <td style={{ fontWeight: 600, color: '#1e293b' }}>{name}</td>
                  <td>{displayMajor}</td>
                  <td style={{ color: '#475569' }}>{s.company?.name || "-"}</td>
                  <td><StatusBadge status={st} /></td>
                  <td style={{ textAlign: 'right' }}>
                    {/* ✅ เปลี่ยนเป็นปุ่มเปิด Modal แทน Link */}
                    <button className="btn-edit" onClick={() => setModalStudent(s)}>
                      🔍 ดูข้อมูล
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ================= Modal (Popup) ================= */}
      {modalStudent && (
        <StudentViewModal
          student={modalStudent}
          dynamicMajors={dynamicMajors}
          onClose={() => setModalStudent(null)}
        />
      )}

      {/* ================= STYLES ================= */}
      <style>{`
        .card { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .p-6 { padding: 24px; }
        .mb-6 { margin-bottom: 24px; }
        .title-text { font-size: 22px; font-weight: 800; color: #0f172a; }
        
        .input { padding: 12px 16px; border-radius: 10px; border: 1px solid #cbd5e1; font-family: inherit; font-size: 14px; transition: 0.2s; box-sizing: border-box; outline: none; }
        .input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1); }
        .input.soft { background: #f8fafc; }
        
        .btn-ghost { padding: 10px 16px; background: #fff; color: #475569; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.2s; font-family: inherit; font-size: 13px; }
        .btn-ghost:hover { background: #f1f5f9; color: #0f172a; }

        .student-table { width: 100%; border-collapse: separate; border-spacing: 0 10px; }
        .student-table th { padding: 10px 16px; color: #64748b; font-size: 13px; text-align: left; font-weight: 600; }
        .student-table td { background: #fff; padding: 16px; font-size: 14px; color: #334155; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; transition: 0.2s; vertical-align: middle; }
        .student-table td:first-child { border-left: 1px solid #f1f5f9; border-radius: 12px 0 0 12px; }
        .student-table td:last-child { border-right: 1px solid #f1f5f9; border-radius: 0 12px 12px 0; }
        .student-row:hover td { background: #f8fafc; border-color: #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }

        .btn-edit { background: #f0f9ff; color: #0284c7; border: 1px solid #bae6fd; border-radius: 8px; padding: 8px 16px; font-weight: 700; cursor: pointer; transition: 0.2s; font-family: inherit; font-size: 13px; }
        .btn-edit:hover { background: #e0f2fe; }

        /* Modal Styles */
        .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.6); display: flex; align-items: center; justify-content: center; z-index: 50; backdrop-filter: blur(4px); }
        .modal-card { background: #fff; width: 100%; max-width: 850px; border-radius: 24px; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0,0,0,.25); display: flex; flex-direction: column; max-height: 90vh; }
        .tab-btn { padding: 10px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; border: none; background: transparent; color: #64748b; transition: 0.2s; font-size: 14px; }
        .tab-btn.active { background: #eff6ff; color: #0ea5e9; }
        .tab-btn:hover:not(.active) { background: #f8fafc; }
      `}</style>
    </div>
  );
}

/* =========================
   Modal Component (View Only)
========================= */
function StudentViewModal({
  student,
  dynamicMajors,
  onClose,
}: {
  student: StudentProfile;
  dynamicMajors: Record<string, string>;
  onClose: () => void;
}) {
  // ✅ ตัด Tab 'visits' ทิ้ง เหลือแค่ 3 แท็บ
  const [tab, setTab] = useState<"profile" | "company" | "docs">("profile");

  const companyData = student.coop?.company || student.company;
  const mentorData = student.coop?.mentor;
  const fullName = `${getThaiPrefix(student.prefix)} ${student.firstName} ${student.lastName}`.trim();
  const displayMajor = dynamicMajors[student.major || ""] || student.major || "-";
  const st = student.coop?.status || student.docStatus || "WAITING";

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0', color: '#0f172a', fontSize: 22, fontWeight: 800 }}>
              {fullName}
            </h2>
            <div style={{ color: "#64748b", fontWeight: 600, display: 'flex', gap: 12, alignItems: 'center' }}>
              <span>รหัสนักศึกษา: <span style={{ color: '#0ea5e9' }}>{student.studentId}</span></span>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#cbd5e1' }} />
              <StatusBadge status={st} />
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', width: 36, height: 36, borderRadius: '50%', fontSize: 20, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, background: '#f8fafc', padding: 6, borderRadius: 16 }}>
          <button className={`tab-btn ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>📝 ข้อมูลนักศึกษา</button>
          <button className={`tab-btn ${tab === "company" ? "active" : ""}`} onClick={() => setTab("company")}>🏢 ข้อมูลบริษัท</button>
          <button className={`tab-btn ${tab === "docs" ? "active" : ""}`} onClick={() => setTab("docs")}>📄 เอกสารแนบ</button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}>
          {tab === "profile" && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#334155' }}>ข้อมูลพื้นฐานและการศึกษา</h4>
                <div style={{ display: 'grid', gap: 12 }}>
                  <InfoRow label="รหัสนักศึกษา" value={student.studentId} />
                  <InfoRow label="ชื่อ-สกุล" value={fullName} />
                  <InfoRow label="ชั้นปี" value={student.year || "-"} />
                  <InfoRow label="คณะ" value={student.faculty || "วิทยาลัยการคอมพิวเตอร์"} />
                  <InfoRow label="สาขาวิชา" value={displayMajor} />
                  <InfoRow label="รูปแบบการศึกษา" value={student.studyProgram || "-"} />
                  <InfoRow label="เกรดเฉลี่ย (GPA)" value={student.gpa?.toFixed(2) || "-"} />
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#334155' }}>ข้อมูลการติดต่อ</h4>
                <div style={{ display: 'grid', gap: 12 }}>
                  <InfoRow label="เบอร์โทรศัพท์" value={student.phone || "-"} />
                  <InfoRow label="อีเมล" value={student.user?.email || "-"} />
                  <InfoRow label="สัญชาติ" value={student.nationality || "ไทย"} />
                </div>
              </div>
            </div>
          )}

          {tab === "company" && (
            <div style={{ display: 'grid', gap: 20 }}>
              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#334155' }}>🏢 ข้อมูลบริษัท</h4>
                {companyData ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <InfoRow label="ชื่อบริษัท" value={companyData.name} />
                    <InfoRow label="ที่อยู่" value={getFullAddress(companyData)} />
                    <InfoRow label="อีเมล" value={companyData.email} />
                    <InfoRow label="เบอร์โทร" value={companyData.phone} />
                    <InfoRow label="เว็บไซต์" value={companyData.website ? <a href={companyData.website} target="_blank" rel="noreferrer" style={{ color: '#0ea5e9' }}>{companyData.website}</a> : "-"} />
                  </div>
                ) : <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>นักศึกษายังไม่ได้ระบุข้อมูลบริษัท</div>}
              </div>

              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#334155' }}>👤 ข้อมูลพี่เลี้ยง</h4>
                {mentorData ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <InfoRow label="ชื่อ-สกุล" value={`${mentorData.firstName || ""} ${mentorData.lastName || ""}`} />
                    <InfoRow label="ตำแหน่ง" value={mentorData.position} />
                    <InfoRow label="แผนก" value={mentorData.department} />
                    <InfoRow label="อีเมล" value={mentorData.email} />
                    <InfoRow label="เบอร์โทร" value={mentorData.phone} />
                  </div>
                ) : <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>นักศึกษายังไม่ได้ระบุข้อมูลพี่เลี้ยง</div>}
              </div>
            </div>
          )}

          {tab === "docs" && (
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#334155' }}>📄 เอกสารแนบของนักศึกษา</h4>
              {student.documents && student.documents.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12, margin: 0 }}>
                  {student.documents.map(doc => (
                    <li key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, background: '#eff6ff', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, fontSize: 18 }}>📄</div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{doc.name}</span>
                      </div>
                      {/* เปิดดูไฟล์แท็บใหม่เหมือนของ Admin */}
                      <a href={`/uploads/${encodeURIComponent(doc.path)}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#0ea5e9', textDecoration: 'none', fontWeight: 700, background: '#f0f9ff', padding: '8px 16px', borderRadius: 8, transition: '0.2s' }}>
                        เปิดดูไฟล์ ↗
                      </a>
                    </li>
                  ))}
                </ul>
              ) : <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>นักศึกษายังไม่มีเอกสารในระบบ</div>}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24, borderTop: '1px solid #e2e8f0', paddingTop: 24 }}>
          <button className="btn-ghost" style={{ padding: '10px 24px' }} onClick={onClose}>
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}

// Sub Component: Info Row
function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 10, borderBottom: '1px dashed #cbd5e1' }}>
      <div style={{ color: "#64748b", fontWeight: 600, fontSize: 14 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', textAlign: 'right' }}>{value || "-"}</div>
    </div>
  );
}