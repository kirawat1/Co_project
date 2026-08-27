import { useState, useEffect, useMemo, useRef } from "react";
import { apiFetch } from "../utils/apiFetch";
import StatusBadge from "../components/StatusBadge";
import { STATUS_GROUPS } from "./StatusFilterChips";
import { useDebounce } from "../hooks/useDebounce";
import A_StudentEditModal from "./A_StudentEditModal";
import A_StudentTrash from "./A_StudentTrash";

function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try { const u = new URL(url); return ['http:', 'https:'].includes(u.protocol) ? url : undefined; }
  catch { return undefined; }
}

/* =========================
   Types
========================= */
interface CoopPeriod {
  id: number;
  semester: string | number;
  academicYear: string;
}

interface PreviewRow {
  rowNum: number;
  studentId: string;
  name: string;
  email: string;
  major: string | null;
  studyProgram: string | null;
  advisorName: string | null;
  action: "create" | "update" | "skip";
  advisorStatus: "found" | "notFound" | "ambiguous" | "empty";
  error?: string;
}

interface PreviewSummary {
  total: number;
  willCreate: number;
  willUpdate: number;
  willSkip: number;
  advisorWarnings: number;
}

interface StudentDocument {
  id: number;
  name: string;
  path: string;
  type?: string;
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

export interface StudentProfile {
  id: number;
  studentId: string;
  firstName?: string;
  lastName?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  prefix?: string;
  year?: string;
  faculty?: string;
  major?: string;
  studyProgram?: string;
  gpa?: number;
  phone?: string;
  advisorName?: string;
  generalAdvisorId?: number | null;
  coopAdvisorId?: number | null;
  generalAdvisor?: { id: number; firstName: string; lastName: string } | null;
  coopAdvisor?: { id: number; firstName: string; lastName: string } | null;
  jobPosition?: string;
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
  coopApplicationForm?: { gradeSheetUrl?: string | null } | null;
}

/* =========================
   Mapping Helpers
========================= */
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

/* =========================
   Main Component
========================= */
export default function A_Students() {
  const [items, setItems] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [filterCurriculums, setFilterCurriculums] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterStatusGroups, setFilterStatusGroups] = useState<string[]>([]);

  const [modalStudent, setModalStudent] = useState<StudentProfile | null>(null);
  const [editStudent, setEditStudent] = useState<StudentProfile | null>(null);
  const [pageTab, setPageTab] = useState<"list" | "trash">("list");
  const [coopPeriods, setCoopPeriods] = useState<CoopPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;
  const [sortBy, setSortBy] = useState<'studentId' | 'firstName' | 'lastName' | 'studyProgram'>('studentId');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; created: number; updated: number; errors: number; autoCreatedMajors?: number } | null>(null);
  const [importWarnings, setImportWarnings] = useState<{ row: number; email: string; reason: string }[]>([]);
  const [importPreview, setImportPreview] = useState<PreviewRow[] | null>(null);
  const [importPreviewSummary, setImportPreviewSummary] = useState<PreviewSummary | null>(null);
  const [importPreviewLoading, setImportPreviewLoading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);

  // --- Fetch Data ---
  const fetchStudents = async (periodId: string, page = 1, search = "", statuses: string[] = [], curriculums: string[] = [], sb = sortBy, sd = sortDir) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sortBy: sb, sortDir: sd });
      if (periodId !== "all") params.set("coopPeriodId", periodId);
      if (search.trim()) params.set("search", search.trim());
      if (statuses.length > 0) params.set("statuses", statuses.join(','));
      if (curriculums.length > 0) params.set("studyProgram", curriculums.join(','));
      const res = await apiFetch(`/api/students?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data?.data ?? []);
        setTotalPages(data?.meta?.totalPages ?? 1);
        setTotalCount(data?.meta?.total ?? 0);
        setCurrentPage(data?.meta?.page ?? 1);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const resPeriods = await apiFetch("/api/admin/coop-periods/all");
      if (resPeriods.ok) {
        const data = await resPeriods.json();
        if (data?.periods) setCoopPeriods(data.periods);
      }

      await fetchStudents(selectedPeriodId, 1, "");
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
    setCurrentPage(1);
    fetchStudents(selectedPeriodId, 1, debouncedQ, filterStatuses, filterCurriculums);
  }, [selectedPeriodId]);

  const initialSearchMount = useRef(true);
  useEffect(() => {
    if (initialSearchMount.current) {
      initialSearchMount.current = false;
      return;
    }
    setCurrentPage(1);
    fetchStudents(selectedPeriodId, 1, debouncedQ, filterStatuses, filterCurriculums);
  }, [debouncedQ]);

  const initialCurriculumMount = useRef(true);
  useEffect(() => {
    if (initialCurriculumMount.current) {
      initialCurriculumMount.current = false;
      return;
    }
    setCurrentPage(1);
    fetchStudents(selectedPeriodId, 1, debouncedQ, filterStatuses, filterCurriculums);
  }, [filterCurriculums]);

  useEffect(() => {
    if (importPreview && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [importPreview]);

  function resetFilters() {
    setQ("");
    setFilterCurriculums([]);
    setFilterStatuses([]);
    setFilterStatusGroups([]);
    setCurrentPage(1);
    fetchStudents(selectedPeriodId, 1, "", [], []);
  }

  function handleStatusGroupsChange(groups: string[]) {
    setFilterStatusGroups(groups);
    const expanded = groups.flatMap(g => STATUS_GROUPS[g]?.statuses ?? []);
    setFilterStatuses(expanded);
    setCurrentPage(1);
    fetchStudents(selectedPeriodId, 1, debouncedQ, expanded, filterCurriculums);
  }

  const handleDeleteStudent = async (s: StudentProfile) => {
    const fullName = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim();
    if (!window.confirm(`ย้าย "${fullName || s.studentId}" ไปถังขยะ?`)) return;
    try {
      const res = await apiFetch(`/api/admin/students/${s.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "ลบไม่สำเร็จ");
        return;
      }
      fetchStudents(selectedPeriodId, currentPage, debouncedQ, filterStatuses, filterCurriculums);
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    }
  };

  const clearImportState = () => {
    setImportFile(null);
    setImportPreview(null);
    setImportPreviewSummary(null);
    setImportResult(null);
    setImportWarnings([]);
    setFileInputKey(k => k + 1);
  };

  const handlePreview = async () => {
    if (!importFile) return;
    setImportPreviewLoading(true);
    setImportPreview(null);
    setImportPreviewSummary(null);
    try {
      const form = new FormData();
      form.append("file", importFile);
      const res = await apiFetch("/api/admin/students/import-preview", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.ok) {
        setImportPreview(data.rows);
        setImportPreviewSummary(data.summary);
      } else {
        alert(data.message || "ไม่สามารถอ่านไฟล์ได้");
      }
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setImportPreviewLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const form = new FormData();
      form.append("file", importFile);
      const res = await apiFetch("/api/admin/students/import-excel", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.ok) {
        setImportResult(data.summary);
        setImportWarnings(data.errorRows || []);
        setImportFile(null);
        setImportPreview(null);
        setImportPreviewSummary(null);
        fetchStudents(selectedPeriodId, currentPage, debouncedQ, filterStatuses, filterCurriculums);
      } else {
        alert(data.message || "นำเข้าไม่สำเร็จ");
      }
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setImportLoading(false);
    }
  };

  // All filtering (status, curriculum, search) is now server-side; items = already filtered page
  const filtered = items;

  if (loading) return <div style={{ padding: 28, marginLeft: 35 }}>กำลังโหลดข้อมูล...</div>;

  return (
    <div style={{ padding: 28, marginLeft: 35 }}>
      {/* ── Import toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "12px 16px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>📥 นำเข้าข้อมูลนักศึกษา</span>
        <label style={{ cursor: "pointer", fontSize: 12, padding: "6px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontWeight: 600, color: "#475569" }}>
          เลือกไฟล์ Excel
          <input
            key={fileInputKey}
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={e => {
              setImportFile(e.target.files?.[0] || null);
              setImportPreview(null);
              setImportPreviewSummary(null);
              setImportResult(null);
              setImportWarnings([]);
            }}
          />
        </label>
        {importFile && !importPreview && (
          <>
            <span style={{ fontSize: 12, color: "#64748b" }}>📄 {importFile.name}</span>
            <button
              style={{ padding: "6px 16px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
              onClick={handlePreview}
              disabled={importPreviewLoading}
            >
              {importPreviewLoading ? "กำลังโหลด..." : "ดูตัวอย่าง"}
            </button>
          </>
        )}
        {importResult && (
          <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>
            ✅ สร้างใหม่ {importResult.created} | อัปเดต {importResult.updated} | error {importResult.errors} จาก {importResult.total} รายการ{importResult.autoCreatedMajors ? ` · เพิ่มสาขาใหม่ ${importResult.autoCreatedMajors} สาขา` : ""}
          </span>
        )}
      </div>

      {/* ── Preview table ── */}
      {importPreview && importPreviewSummary && (
        <div ref={previewRef} style={{ marginBottom: 16 }}>
          {/* Summary bar */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10, padding: "10px 14px", background: "#f1f5f9", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13 }}>
            <span style={{ fontWeight: 700, color: "#334155" }}>📄 {importFile?.name}</span>
            <span style={{ color: "#15803d", fontWeight: 600 }}>🟢 สร้างใหม่ {importPreviewSummary.willCreate}</span>
            <span style={{ color: "#1d4ed8", fontWeight: 600 }}>🔵 อัปเดต {importPreviewSummary.willUpdate}</span>
            {importPreviewSummary.willSkip > 0 && (
              <span style={{ color: "#dc2626", fontWeight: 600 }}>🔴 ข้าม {importPreviewSummary.willSkip}</span>
            )}
            {importPreviewSummary.advisorWarnings > 0 && (
              <span style={{ color: "#b45309", fontWeight: 600 }}>⚠️ เตือนอาจารย์ {importPreviewSummary.advisorWarnings} แถว</span>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                style={{ padding: "6px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: importLoading ? "not-allowed" : "pointer", fontSize: 13, opacity: importLoading ? 0.7 : 1 }}
                onClick={handleImport}
                disabled={importLoading}
              >
                {importLoading ? "กำลังนำเข้า..." : "ยืนยันนำเข้า"}
              </button>
              <button
                style={{ padding: "6px 14px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}
                onClick={clearImportState}
                disabled={importLoading}
              >
                ยกเลิก
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e2e8f0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  {["แถว", "รหัส", "ชื่อ-นามสกุล", "อีเมล", "สาขาวิชา", "หลักสูตร", "อาจารย์ที่ปรึกษา", "สถานะ"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#475569", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {importPreview.map(row => {
                  const rowBg = row.action === "skip" ? "#fef2f2"
                              : row.action === "update" ? "#eff6ff"
                              : "#f0fdf4";
                  const rowBorder = row.action === "skip" ? "#ef4444"
                                  : row.action === "update" ? "#3b82f6"
                                  : "#22c55e";
                  const advisorCellStyle: React.CSSProperties =
                    row.advisorStatus === "notFound" || row.advisorStatus === "ambiguous"
                      ? { background: "#fef9c3", color: "#92400e" }
                      : {};
                  return (
                    <tr key={row.rowNum} style={{ background: rowBg, borderLeft: `3px solid ${rowBorder}`, borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "7px 12px", color: "#94a3b8" }}>{row.rowNum}</td>
                      <td style={{ padding: "7px 12px", fontWeight: 600 }}>{row.studentId}</td>
                      <td style={{ padding: "7px 12px" }}>{row.name}</td>
                      <td style={{ padding: "7px 12px", color: "#64748b" }}>{row.email}</td>
                      <td style={{ padding: "7px 12px", maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={row.major ?? undefined}>
                        {row.major || <span style={{ color: "#cbd5e1" }}>-</span>}
                      </td>
                      <td style={{ padding: "7px 12px", color: "#64748b", whiteSpace: "nowrap" }}>
                        {row.studyProgram === "normal" ? "ภาคปกติ" : row.studyProgram === "special" ? "ภาคพิเศษ" : "-"}
                      </td>
                      <td style={{ padding: "7px 12px", ...advisorCellStyle }}>
                        {row.advisorStatus === "found"     && <span>{row.advisorName}</span>}
                        {row.advisorStatus === "notFound"  && <span>⚠️ ไม่พบ "{row.advisorName}"</span>}
                        {row.advisorStatus === "ambiguous" && <span>⚠️ ซ้ำกัน "{row.advisorName}"</span>}
                        {row.advisorStatus === "empty"     && <span style={{ color: "#cbd5e1" }}>-</span>}
                      </td>
                      <td style={{ padding: "7px 12px", whiteSpace: "nowrap" }}>
                        {row.action === "create" && <span style={{ color: "#15803d", fontWeight: 700 }}>🟢 สร้างใหม่</span>}
                        {row.action === "update" && <span style={{ color: "#1d4ed8", fontWeight: 700 }}>🔵 อัปเดต</span>}
                        {row.action === "skip"   && <span style={{ color: "#dc2626", fontWeight: 700 }} title={row.error}>🔴 ข้าม</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importWarnings.length > 0 && (
        <div style={{ marginTop: 8, padding: 12, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, maxHeight: 160, overflowY: "auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>⚠️ คำเตือนระหว่างนำเข้า ({importWarnings.length} แถว) — ข้อมูลแถวเหล่านี้ยังถูกนำเข้า แต่ควรตรวจสอบ:</div>
          {importWarnings.map((w, idx) => (
            <div key={idx} style={{ fontSize: 12, color: "#92400e" }}>แถว {w.row} ({w.email}): {w.reason}</div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button
          style={pageTab === "list" ? saveBtn : ghostBtn}
          onClick={() => setPageTab("list")}
        >
          รายชื่อนักศึกษา
        </button>
        <button
          style={pageTab === "trash" ? saveBtn : ghostBtn}
          onClick={() => setPageTab("trash")}
        >
          ถังขยะ
        </button>
      </div>

      {pageTab === "list" && (
        <>
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
            title="สถานะ"
            items={Object.fromEntries(Object.entries(STATUS_GROUPS).filter(([k]) => k !== 'ALL').map(([k, v]) => [k, `${v.icon} ${v.label}`]))}
            values={filterStatusGroups}
            onChange={handleStatusGroupsChange}
          />

          <FilterBox
            title="หลักสูตร"
            items={CURRICULUM_TH}
            values={filterCurriculums}
            onChange={setFilterCurriculums}
          />

          <button onClick={resetFilters} style={clearBtn}>
            ✕ ล้าง
          </button>
        </div>
      </section>

      {/* ================= Table ================= */}
      <section style={{ ...card, marginTop: 20, padding: 0, overflowX: 'auto' }}>
        <table width="100%" className="responsive-table" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {([
                { label: "รหัส", key: "studentId" },
                { label: "ชื่อ", key: "firstName" },
                { label: "นามสกุล", key: "lastName" },
                { label: "อีเมล", key: null },
                { label: "หลักสูตร", key: "studyProgram" },
                { label: "สถานะ", key: null },
                { label: "รายละเอียด", key: null },
              ] as { label: string; key: string | null }[]).map(({ label, key }) => (
                <th key={label} style={{ ...th, cursor: key ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (!key) return;
                    const newDir = sortBy === key && sortDir === 'asc' ? 'desc' : 'asc';
                    setSortBy(key as typeof sortBy);
                    setSortDir(newDir);
                    setCurrentPage(1);
                    fetchStudents(selectedPeriodId, 1, debouncedQ, filterStatuses, filterCurriculums, key as typeof sortBy, newDir);
                  }}
                >
                  {label}{key && (sortBy === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅')}
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
                  <td style={td} data-label="รหัส">{s.studentId}</td>
                  <td style={td} data-label="ชื่อ">{getThaiPrefix(s.prefix)} {s.firstName}</td>
                  <td style={td} data-label="นามสกุล">{s.lastName}</td>
                  <td style={td} data-label="อีเมล">{s.user?.email || "-"}</td>
                  <td style={td} data-label="หลักสูตร">{CURRICULUM_TH[s.studyProgram ?? ""] ?? s.studyProgram ?? "-"}</td>
                  <td style={td} data-label="สถานะ"><StatusBadge status={s.coop?.status || s.docStatus} /></td>
                  <td style={td} data-label="รายละเอียด">
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        className="btn"
                        style={ghostBtn}
                        onClick={() => setModalStudent(s)}
                      >
                        ดูข้อมูล
                      </button>
                      <button
                        className="btn"
                        style={ghostBtn}
                        onClick={() => setEditStudent(s)}
                      >
                        ✏️ แก้ไข
                      </button>
                      <button
                        className="btn"
                        style={{ ...ghostBtn, color: "#ef4444", borderColor: "#ef4444" }}
                        onClick={() => handleDeleteStudent(s)}
                      >
                        🗑️ ลบ
                      </button>
                      {s.coopApplicationForm?.gradeSheetUrl ? (
                        <a
                          href={safeHref(s.coopApplicationForm.gradeSheetUrl)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ ...ghostBtn, padding: "5px 10px", borderRadius: 7, fontSize: 12, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700 }}
                        >
                          📊 แบบฟอร์มเกรด
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* ================= Pagination ================= */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: '0 4px' }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            แสดง {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} จาก {totalCount} คน
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              className="btn"
              style={{ ...ghostBtn, padding: '6px 14px' }}
              disabled={currentPage <= 1}
              onClick={() => { setCurrentPage(p => p - 1); fetchStudents(selectedPeriodId, currentPage - 1, debouncedQ, filterStatuses, filterCurriculums); }}
            >
              ← ก่อนหน้า
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '…' ? (
                  <span key={`ellipsis-${i}`} style={{ fontSize: 13, color: '#94a3b8', padding: '0 4px' }}>…</span>
                ) : (
                  <button
                    key={p}
                    className="btn"
                    style={{
                      ...ghostBtn,
                      padding: '6px 12px',
                      fontWeight: currentPage === p ? 800 : 600,
                      background: currentPage === p ? '#e0f2fe' : '#fff',
                      color: currentPage === p ? '#0284c7' : '#475569',
                      borderColor: currentPage === p ? '#7dd3fc' : '#cbd5e1',
                    }}
                    onClick={() => { setCurrentPage(p as number); fetchStudents(selectedPeriodId, p as number, debouncedQ, filterStatuses, filterCurriculums); }}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              className="btn"
              style={{ ...ghostBtn, padding: '6px 14px' }}
              disabled={currentPage >= totalPages}
              onClick={() => { setCurrentPage(p => p + 1); fetchStudents(selectedPeriodId, currentPage + 1, debouncedQ, filterStatuses, filterCurriculums); }}
            >
              ถัดไป →
            </button>
          </div>
        </div>
      )}
        </>
      )}
      {pageTab === "trash" && <A_StudentTrash />}

      {/* ================= Modal ================= */}
      {modalStudent && (
        <StudentModal
          student={modalStudent}
          onClose={() => setModalStudent(null)}
        />
      )}
      {editStudent && (
        <A_StudentEditModal
          student={editStudent}
          onClose={() => setEditStudent(null)}
          onSaved={() => fetchStudents(selectedPeriodId, currentPage, debouncedQ)}
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
  const [deptMap, setDeptMap] = useState<Record<string, string>>({});

  useEffect(() => {
    apiFetch("/api/coop/departments").then(r => r.json()).then(d => {
      if (d.ok && Array.isArray(d.departments)) {
        const map: Record<string, string> = {};
        d.departments.forEach((dep: { major: string; nameTh: string | null }) => {
          if (dep.nameTh) map[dep.major] = dep.nameTh;
        });
        setDeptMap(map);
      }
    }).catch(() => {});
  }, []);

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
              <InfoRow label="สาขาวิชา" value={student.major ? (deptMap[student.major] ? `${deptMap[student.major]} (${student.major})` : student.major) : "-"} />
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
                <DocsByGroup docs={student.documents} />
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
const ghostBtn: React.CSSProperties = { background: "#fff", color: "#0074B7", boxShadow: "none", border: "1px solid rgba(10,132,255,.25)", height: 34, borderRadius: 8, padding: '0 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13 };
const saveBtn: React.CSSProperties = { background: "#0074B7", color: "#fff", boxShadow: "none", border: "1px solid rgba(10,132,255,.25)", height: 36, borderRadius: 8, padding: '0 16px', cursor: 'pointer' };
const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e5e7eb" };
const filterRow: React.CSSProperties = { display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" };
const clearBtn: React.CSSProperties = { height: 28, padding: '0 10px', fontSize: 12, background: 'transparent', border: '1px solid #cbd5e1', borderRadius: 6, color: '#64748b', cursor: 'pointer', alignSelf: 'flex-end', marginBottom: 2 };
const th: React.CSSProperties = { textAlign: "left", paddingBottom: 8, fontSize: 14, padding: "12px 10px", color: '#475569' };
const td: React.CSSProperties = { padding: "12px 10px", fontSize: 14, color: '#1e293b' };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 };
const modal: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 700, border: "1px solid #e5e7eb" };
const modalFooter: React.CSSProperties = { display: "flex", justifyContent: "flex-end", marginTop: 24 };

function Section({ title, children }: { title: string; children: React.ReactNode }) { return (<div style={sectionCard}><div style={sectionTitle}>{title}</div>{children}</div>); }
const sectionCard: React.CSSProperties = { background: "#f8fafc", borderRadius: 12, padding: 16, marginBottom: 14 };
const sectionTitle: React.CSSProperties = { fontWeight: 700, marginBottom: 10, fontSize: 14 };

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) { return (<div style={{ display: "grid", gridTemplateColumns: "120px 1fr", marginBottom: 4 }}><div style={{ color: "#64748b", fontWeight: 600 }}>{label}</div><div style={{ fontWeight: 600 }}>{value || "-"}</div></div>); }

const DOC_GROUPS: Record<string, { groupKey: string; groupLabel: string }> = {
  CV:               { groupKey: 't000', groupLabel: 'T000 — คำร้องสหกิจ' },
  T000_SIGNED:      { groupKey: 't000', groupLabel: 'T000 — คำร้องสหกิจ' },
  TRANSCRIPT:       { groupKey: 't000', groupLabel: 'T000 — คำร้องสหกิจ' },
  STUDENT_CARD:     { groupKey: 't000', groupLabel: 'T000 — คำร้องสหกิจ' },
  CITIZEN_CARD:     { groupKey: 't000', groupLabel: 'T000 — คำร้องสหกิจ' },
  PARENTAL_CONSENT: { groupKey: 't000', groupLabel: 'T000 — คำร้องสหกิจ' },
  T002_FORM:        { groupKey: 't002', groupLabel: 'T002 — แบบแจ้งรายละเอียดงาน' },
  T003_FORM:        { groupKey: 't003', groupLabel: 'T003 — โครงร่างรายงาน' },
  'CP-ACCEPTANCE':  { groupKey: 'accept', groupLabel: 'ใบตอบรับจากบริษัท' },
};

function DocsByGroup({ docs }: { docs: StudentDocument[] }) {
  const groups: Record<string, { label: string; docs: StudentDocument[] }> = {};
  docs.forEach(doc => {
    const info = DOC_GROUPS[doc.type || ''] ?? { groupKey: doc.type || 'other', groupLabel: doc.type || 'อื่นๆ' };
    if (!groups[info.groupKey]) groups[info.groupKey] = { label: info.groupLabel, docs: [] };
    groups[info.groupKey].docs.push(doc);
  });
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {Object.values(groups).map(g => (
        <div key={g.label}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0074B7', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{g.label}</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
            {g.docs.map(doc => (
              <li key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📄</span>
                  <span style={{ fontSize: 13 }}>{doc.name}</span>
                </div>
                <a href={`/uploads/${encodeURIComponent(doc.path)}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#0074B7', textDecoration: 'none', fontWeight: 600 }}>
                  เปิดดู
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

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