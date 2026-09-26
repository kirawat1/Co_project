import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../utils/apiFetch";
import { fmtDate, fmtDateTime } from "../utils/dateFormat";
import StatusBadge from "../components/StatusBadge";
import { STATUS_GROUPS } from "./StatusFilterChips";
import { useDebounce } from "../hooks/useDebounce";
import A_StudentEditModal from "./A_StudentEditModal";
import A_StudentTrash from "./A_StudentTrash";
import A_AddStudentModal from "./A_AddStudentModal";
import PasswordReveal from "./PasswordReveal";
import LoadMoreFooter from "./LoadMoreFooter";
import { useInfinitePages } from "../utils/useInfinitePages";
import { toggleSelectAllShown, allShownSelected } from "../utils/useLoadMore";
import { notify, askConfirm } from "../utils/notify";
import { contactName, contactLine } from "../utils/contacts";

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
  contactPerson?: string;
  contactPosition?: string;
}

interface TeacherName { id: number; prefix?: string | null; firstName: string; lastName: string }

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
  phone?: string;
  email?: string | null;
  advisorName?: string;
  generalAdvisorId?: number | null;
  coopAdvisorId?: number | null;
  generalAdvisor?: TeacherName | null;
  coopAdvisor?: TeacherName | null;
  supervisionAppointment?: {
    status: string;
    supervisionType?: "ONLINE" | "ONSITE";
    confirmedDate?: string | null;
    coTeacherName?: string | null;
    teacher?: TeacherName | null;
  } | null;
  jobPosition?: string;
  user?: { email: string };
  nationality?: string;
  company?: Company;
  docStatus?: "WAITING" | "WAITING_FOR_STAFF_CHECK" | "EDITS_REQUIRED" | "REQ_LETTER_ISSUED" | "DOCS_APPROVED" | "WAITING_FOR_PLACEMENT_LETTER" | "WAITING_FOR_STAFF_CHECK_LETTER" | "ACCEPTANCE_CHECKED" | "PLACEMENT_LETTER_ISSUED";
  coop?: {
    status: string;
    company?: Company;
    mentors?: Mentor[];
    teacherComment?: string;
    jobPosition?: string | null;
    actualStartDate?: string | null;
    actualEndDate?: string | null;
    coopPeriod?: { semester: number; academicYear: string } | null;
  };
  documents?: StudentDocument[];
  coopApplicationForm?: { gradeSheetUrl?: string | null } | null;
}

/* =========================
   Mapping Helpers
========================= */
// ค่าในตัวกรองสาขาสำหรับนักศึกษาที่ยังไม่ระบุสาขา — ตรงกับ backend getStudents (majors=__NONE__)
const NO_MAJOR = "__NONE__";

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

function teacherFullName(t?: TeacherName | null): string {
  if (!t?.firstName) return "";
  return `${t.prefix || ""}${t.firstName} ${t.lastName || ""}`.trim();
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
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // ช่องติ๊กจะแสดงเฉพาะตอนเปิดโหมดเลือก — กันกดลบผิดคนตอนดูรายชื่อตามปกติ
  const [selectMode, setSelectMode] = useState(false);

  // Filters
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [filterCurriculums, setFilterCurriculums] = useState<string[]>([]);
  // สาขา: "all" · รหัสสาขา (CS) · NO_MAJOR = ยังไม่ระบุสาขา
  const [filterMajor, setFilterMajor] = useState<string>("all");
  const [departments, setDepartments] = useState<{ major: string; nameTh: string | null }[]>([]);
  const deptMap = Object.fromEntries(departments.filter(d => d.nameTh).map(d => [d.major, d.nameTh as string]));
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterStatusGroups, setFilterStatusGroups] = useState<string[]>([]);

  const [modalStudent, setModalStudent] = useState<StudentProfile | null>(null);
  const [editStudent, setEditStudent] = useState<StudentProfile | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [pageTab, setPageTab] = useState<"list" | "trash">("list");
  const [coopPeriods, setCoopPeriods] = useState<CoopPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("all");
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
  // เปลี่ยนค่านี้เมื่อไหร่ (ค้นหา/ตัวกรอง/เรียงลำดับ/ปีการศึกษา) → useInfinitePages ละทิ้งรายการเดิม
  // แล้วโหลดหน้า 1 ใหม่ให้เอง แทนการเรียก fetchStudents(...) มือเองแบบเดิม
  const resetKey = `${selectedPeriodId}|${debouncedQ}|${filterStatuses.join(",")}|${filterCurriculums.join(",")}|${filterMajor}|${sortBy}|${sortDir}`;

  const fetchStudentsPage = async (page: number) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sortBy, sortDir });
      if (selectedPeriodId !== "all") params.set("coopPeriodId", selectedPeriodId);
      if (debouncedQ.trim()) params.set("search", debouncedQ.trim());
      if (filterStatuses.length > 0) params.set("statuses", filterStatuses.join(','));
      if (filterCurriculums.length > 0) params.set("studyProgram", filterCurriculums.join(','));
      if (filterMajor !== "all") params.set("majors", filterMajor);
      const res = await apiFetch(`/api/students?${params}`);
      if (!res.ok) return null;
      const data = await res.json();
      return { items: data?.data ?? [], total: data?.meta?.total ?? 0, totalPages: data?.meta?.totalPages ?? 1 };
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const {
    items, setItems, setTotal, reload: reloadStudents, loadMore, hasMore, sentinelRef, total,
  } = useInfinitePages<StudentProfile>(fetchStudentsPage, resetKey);

  const fetchData = async () => {
    try {
      setLoading(true);

      const resPeriods = await apiFetch("/api/admin/coop-periods/all");
      if (resPeriods.ok) {
        const data = await resPeriods.json();
        if (data?.periods) setCoopPeriods(data.periods);
      }

      // สาขาวิชาจากหน้าจัดการสาขา (admin/criteria) — ใช้ในตัวกรอง คอลัมน์สาขา และหน้าต่างดูข้อมูล
      const resDept = await apiFetch("/api/coop/departments").catch(() => null);
      if (resDept?.ok) {
        const d = await resDept.json();
        if (d.ok && Array.isArray(d.departments)) setDepartments(d.departments);
      }

      await reloadStudents();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ค้นหา/ตัวกรอง/เรียงลำดับเปลี่ยน — เคลียร์การเลือกเดิมทิ้ง (รายการที่แสดงเปลี่ยนไปแล้ว)
  useEffect(() => {
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    if (importPreview && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [importPreview]);

  function resetFilters() {
    setQ("");
    setFilterCurriculums([]);
    setFilterMajor("all");
    setFilterStatuses([]);
    setFilterStatusGroups([]);
    // debouncedQ ยังไม่ทันเปลี่ยนตาม q ทันที (มี debounce 300ms) แต่ตัวกรองอื่นเปลี่ยนทันที
    // resetKey จะเปลี่ยนและโหลดหน้า 1 ใหม่ให้เอง ไม่ต้องเรียก reload เอง
  }

  function handleStatusGroupsChange(groups: string[]) {
    setFilterStatusGroups(groups);
    const expanded = groups.flatMap(g => STATUS_GROUPS[g]?.statuses ?? []);
    setFilterStatuses(expanded);
  }

  const handleDeleteStudent = async (s: StudentProfile) => {
    const fullName = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim();
    if (!(await askConfirm(`ย้าย "${fullName || s.studentId}" ไปถังขยะ?`, { confirmLabel: "ย้ายไปถังขยะ", danger: true }))) return;
    try {
      const res = await apiFetch(`/api/admin/students/${s.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.ok) {
        notify.error(data.message || "ลบไม่สำเร็จ");
        return;
      }
      // ลบออกจากรายการที่โหลดไว้แล้วเลย ไม่ต้องโหลดใหม่ทั้งหมด (เหมือนหน้าบริษัท/อาจารย์)
      setItems(prev => prev.filter(x => x.id !== s.id));
      setTotal(t => Math.max(0, t - 1));
    } catch (err: any) {
      notify.error(err.message || "เกิดข้อผิดพลาด");
    }
  };

  // เลือกทั้งหมด = เฉพาะรายชื่อที่โหลดมาแสดงแล้ว ไม่เหมารวมรายชื่อที่ยังไม่ได้เลื่อนลงไปแสดง
  function toggleSelectAll() {
    setSelectedIds(prev => toggleSelectAllShown(filtered, prev, s => s.id));
  }

  function toggleSelectOne(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  const handleBulkDeleteStudents = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!(await askConfirm(`ย้ายนักศึกษาที่เลือก ${ids.length} คน ไปถังขยะ?`, { confirmLabel: "ย้ายไปถังขยะ", danger: true }))) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        ids.map(id => apiFetch(`/api/admin/students/${id}`, { method: "DELETE" }).then(async r => {
          const data = await r.json().catch(() => ({}));
          if (!data.ok) throw new Error(data.message || "ลบไม่สำเร็จ");
          return id;
        }))
      );
      const succeededIds = new Set(
        results.filter((r): r is PromiseFulfilledResult<number> => r.status === "fulfilled").map(r => r.value)
      );
      const failed = results.length - succeededIds.size;
      if (failed > 0) {
        notify.warning(`ย้ายไปถังขยะสำเร็จ ${succeededIds.size} คน, ไม่สำเร็จ ${failed} คน`);
      }
      // ลบออกจากรายการที่โหลดไว้แล้วเลย ไม่ต้องโหลดใหม่ทั้งหมด
      setItems(prev => prev.filter(s => !succeededIds.has(s.id)));
      setTotal(t => Math.max(0, t - succeededIds.size));
      exitSelectMode();
    } finally {
      setBulkDeleting(false);
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
        notify.error(data.message || "ไม่สามารถอ่านไฟล์ได้");
      }
    } catch (err: any) {
      notify.error(err.message || "เกิดข้อผิดพลาด");
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
        reloadStudents(); // นำเข้าใหม่อาจมีหลายร้อยแถว ไม่รู้ตำแหน่งที่ควรแทรก โหลดหน้า 1 ใหม่ทั้งหมด
      } else {
        notify.error(data.message || "นำเข้าไม่สำเร็จ");
      }
    } catch (err: any) {
      notify.error(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setImportLoading(false);
    }
  };

  // การกรอง/ค้นหา/เรียงลำดับทำที่ server ทั้งหมด — items คือรายการที่โหลดมาแสดงแล้ว (ต่อท้ายเรื่อยๆ เมื่อเลื่อน)
  const filtered = items;
  const isAllShownSelected = allShownSelected(filtered, selectedIds, s => s.id);

  if (loading) return <div style={{ padding: 28, marginLeft: 35 }}>กำลังโหลดข้อมูล...</div>;

  return (
    <div style={{ padding: 28, marginLeft: 35 }}>
      {/* ── Import toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "12px 16px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>📥 นำเข้าข้อมูลนักศึกษา</span>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
        >
          + เพิ่มทีละคน
        </button>
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
            ✅ สร้างใหม่ {importResult.created} | อัปเดต {importResult.updated} | error {importResult.errors} จาก {importResult.total} รายการ{importResult.autoCreatedMajors ? ` · เพิ่มหลักสูตรใหม่ ${importResult.autoCreatedMajors} หลักสูตร` : ""}
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
                  {["แถว", "รหัส", "ชื่อ-นามสกุล", "อีเมล", "หลักสูตร", "รูปแบบการศึกษา", "อาจารย์ที่ปรึกษา", "สถานะ"].map(h => (
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

          <div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>หลักสูตร</div>
            <select
              className="input"
              style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e5e7eb' }}
              value={filterMajor}
              onChange={e => setFilterMajor(e.target.value)}
            >
              <option value="all">🎓 ทุกหลักสูตร</option>
              {departments.map(d => (
                <option key={d.major} value={d.major}>{d.nameTh && d.nameTh !== d.major ? `${d.nameTh} (${d.major})` : d.major}</option>
              ))}
              <option value={NO_MAJOR}>— ยังไม่ระบุหลักสูตร —</option>
            </select>
          </div>

          <FilterBox
            title="รูปแบบการศึกษา"
            items={CURRICULUM_TH}
            values={filterCurriculums}
            onChange={setFilterCurriculums}
          />

          <button onClick={resetFilters} style={clearBtn}>
            ✕ ล้าง
          </button>
        </div>
      </section>

      {/* ================= Bulk action bar ================= */}
      {!selectMode ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn" style={ghostBtn} onClick={() => setSelectMode(true)}>
            ☑️ เลือกหลายคน
          </button>
        </div>
      ) : (
        <div style={{
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 16,
          padding: "10px 16px", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#9a3412" }}>
            เลือกแล้ว {selectedIds.size} คน
          </span>
          {/* อยู่ในแถบนี้แทนหัวตาราง เพราะจอ ≤1024px ซ่อน thead ทั้งแถว (S_Theme.tsx) */}
          <button className="btn" style={ghostBtn} onClick={toggleSelectAll} disabled={bulkDeleting || filtered.length === 0}>
            {isAllShownSelected ? "ยกเลิกเลือกทั้งหมด" : `เลือกทั้งหมดที่โหลดแล้ว (${filtered.length})`}
          </button>
          <button
            className="btn"
            style={{ ...ghostBtn, color: "#ef4444", borderColor: "#ef4444", opacity: bulkDeleting || selectedIds.size === 0 ? 0.6 : 1, cursor: bulkDeleting || selectedIds.size === 0 ? "not-allowed" : "pointer" }}
            onClick={handleBulkDeleteStudents}
            disabled={bulkDeleting || selectedIds.size === 0}
          >
            🗑️ {bulkDeleting ? "กำลังลบ..." : `ย้ายไปถังขยะ (${selectedIds.size})`}
          </button>
          <button
            className="btn"
            style={{ ...ghostBtn, marginLeft: "auto" }}
            onClick={exitSelectMode}
            disabled={bulkDeleting}
          >
            ปิดโหมดเลือก
          </button>
        </div>
      )}

      {/* ================= Table ================= */}
      <section style={{ ...card, marginTop: 12, padding: 0, overflowX: 'auto' }}>
        <table width="100%" className="responsive-table" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {selectMode && (
                <th style={{ ...th, width: 36 }}>
                  <input
                    type="checkbox"
                    checked={isAllShownSelected}
                    ref={el => { if (el) el.indeterminate = !isAllShownSelected && filtered.some(s => selectedIds.has(s.id)); }}
                    onChange={toggleSelectAll}
                    aria-label="เลือกทั้งหมดที่โหลดแล้ว"
                  />
                </th>
              )}
              {([
                { label: "รหัส", key: "studentId" },
                { label: "ชื่อ", key: "firstName" },
                { label: "นามสกุล", key: "lastName" },
                { label: "อีเมล", key: null },
                { label: "หลักสูตร", key: null },
                { label: "รูปแบบการศึกษา", key: "studyProgram" },
                { label: "สถานะ", key: null },
                { label: "รายละเอียด", key: null },
              ] as { label: string; key: string | null }[]).map(({ label, key }) => (
                <th key={label} style={{ ...th, cursor: key ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (!key) return;
                    const newDir = sortBy === key && sortDir === 'asc' ? 'desc' : 'asc';
                    setSortBy(key as typeof sortBy);
                    setSortDir(newDir);
                    // resetKey (รวม sortBy/sortDir) เปลี่ยน → useInfinitePages โหลดหน้า 1 ใหม่ให้เอง
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
                <td colSpan={selectMode ? 9 : 8} style={{ padding: 20, textAlign: 'center', color: "#64748b" }}>
                  ไม่พบนักศึกษาตามเงื่อนไข
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: selectedIds.has(s.id) ? "#fff7ed" : undefined }}>
                  {selectMode && (
                    <td style={td}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleSelectOne(s.id)}
                        aria-label={`เลือก ${s.firstName} ${s.lastName}`}
                      />
                    </td>
                  )}
                  <td style={td} data-label="รหัส">{s.studentId}</td>
                  <td style={td} data-label="ชื่อ">{getThaiPrefix(s.prefix)} {s.firstName}</td>
                  <td style={td} data-label="นามสกุล">{s.lastName}</td>
                  <td style={td} data-label="อีเมล">{s.user?.email || "-"}</td>
                  <td style={td} data-label="หลักสูตร">{s.major ? (deptMap[s.major] || s.major) : <span style={{ color: "#94a3b8" }}>-</span>}</td>
                  <td style={td} data-label="รูปแบบการศึกษา">{CURRICULUM_TH[s.studyProgram ?? ""] ?? s.studyProgram ?? "-"}</td>
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

      <LoadMoreFooter shownCount={filtered.length} total={total} hasMore={hasMore} onShowMore={loadMore} sentinelRef={sentinelRef} itemLabel="คน" />
        </>
      )}
      {pageTab === "trash" && <A_StudentTrash />}

      {/* ================= Modal ================= */}
      {modalStudent && (
        <StudentModal
          student={modalStudent}
          deptMap={deptMap}
          onClose={() => setModalStudent(null)}
        />
      )}
      {editStudent && (
        <A_StudentEditModal
          student={editStudent}
          onClose={() => setEditStudent(null)}
          onSaved={() => reloadStudents()}
        />
      )}
      {showAddModal && (
        <A_AddStudentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); reloadStudents(); }}
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
  deptMap,
  onClose,
}: {
  student: StudentProfile;
  deptMap: Record<string, string>; // รหัสสาขา → ชื่อไทย (โหลดครั้งเดียวที่หน้ารายชื่อ)
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"profile" | "company" | "docs">("profile");

  const companyData = student.coop?.company || student.company;
  // เดิมอ่าน student.coop?.mentor (เอกพจน์) ซึ่งไม่มีอยู่จริง (เก็บเป็น mentors อาเรย์ เพราะเลือกพี่เลี้ยงได้หลายคน) — ทำให้ขึ้น "-" เสมอ
  const mentorList: any[] = student.coop?.mentors || [];
  // ผู้ติดต่อ (HR) ที่นักศึกษาเลือก — ผู้รับหนังสือจากวิทยาลัย
  const contactList: any[] = (student.coop as any)?.contacts || [];

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
            <>
              <Section title="ข้อมูลส่วนตัว">
                <InfoRow label="รหัสนักศึกษา" value={student.studentId} />
                <InfoRow label="ชื่อ-สกุล" value={fullName} />
                <InfoRow label="ชื่อ-สกุล (EN)" value={[student.firstNameEn, student.lastNameEn].filter(Boolean).join(" ")} />
                <InfoRow label="ชั้นปี" value={student.year} />
                <InfoRow label="หลักสูตร" value={student.major ? (deptMap[student.major] ? `${deptMap[student.major]} (${student.major})` : student.major) : "-"} />
                <InfoRow label="รูปแบบการศึกษา" value={CURRICULUM_TH[student.studyProgram || ""] || student.studyProgram} />
                <InfoRow label="เบอร์โทร" value={student.phone} />
                {/* อีเมลติดต่อที่นักศึกษากรอกเอง กับอีเมลบัญชีเข้าระบบ อาจเป็นคนละอัน */}
                <InfoRow label="อีเมลติดต่อ" value={student.email || student.user?.email} />
                {student.email && student.user?.email && student.email !== student.user.email && (
                  <InfoRow label="อีเมลเข้าระบบ" value={student.user.email} />
                )}
                {/* นักศึกษาลืมรหัสผ่านแล้วมาถาม — ปกติซ่อน กดแสดงเมื่อจำเป็น (ถูกบันทึกใน log) */}
                <InfoRow label="รหัสผ่าน" value={<PasswordReveal endpoint={`/api/admin/students/${student.id}/password/reveal`} />} />
              </Section>
              <Section title="ข้อมูลสหกิจ">
                <InfoRow label="สถานะ" value={<StatusBadge status={student.coop?.status || "NOT_SUBMITTED"} />} />
                <InfoRow label="รอบสหกิจ" value={student.coop?.coopPeriod ? `เทอม ${student.coop.coopPeriod.semester}/${student.coop.coopPeriod.academicYear}` : undefined} />
                <InfoRow label="ตำแหน่งงาน" value={student.coop?.jobPosition || student.jobPosition} />
                <InfoRow label="ช่วงฝึกงาน" value={student.coop?.actualStartDate ? `${fmtDate(student.coop.actualStartDate)} – ${fmtDate(student.coop.actualEndDate)}` : undefined} />
                <InfoRow label="ที่ปรึกษาทั่วไป" value={teacherFullName(student.generalAdvisor) || student.advisorName} />
                <InfoRow label="ที่ปรึกษาโครงงาน" value={teacherFullName(student.coopAdvisor)} />
                <InfoRow label="ผู้ติดต่อ (HR)" value={contactList.length ? contactList.map((c) => contactLine(c)).join(" / ") : "-"} />
              </Section>
              <Section title="การนิเทศ">
                {student.supervisionAppointment ? (
                  <>
                    <InfoRow label="สถานะ" value={<StatusBadge status={student.supervisionAppointment.status} />} />
                    <InfoRow label="อาจารย์นิเทศ" value={teacherFullName(student.supervisionAppointment.teacher)} />
                    <InfoRow label="อาจารย์นิเทศร่วม" value={student.supervisionAppointment.coTeacherName} />
                    <InfoRow label="วันนิเทศ" value={student.supervisionAppointment.confirmedDate ? fmtDateTime(student.supervisionAppointment.confirmedDate) : "รอยืนยันวัน"} />
                    <InfoRow label="รูปแบบ" value={student.supervisionAppointment.supervisionType === "ONLINE" ? "ออนไลน์" : student.supervisionAppointment.supervisionType === "ONSITE" ? "ออนไซต์" : undefined} />
                  </>
                ) : <div style={{ color: "#94a3b8" }}>ยังไม่นัดนิเทศ</div>}
              </Section>
            </>
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
                    <InfoRow label="เว็บไซต์" value={safeHref(companyData.website) ? <a href={safeHref(companyData.website)} target="_blank" rel="noreferrer" style={{ color: "#0074B7" }}>{companyData.website}</a> : companyData.website} />
                  </>
                ) : <div>-</div>}
              </Section>
              <Section title="ผู้ติดต่อ (HR)">
                {contactList.length > 0 ? contactList.map((c: any, i: number) => (
                  <div key={c.id || i} style={i > 0 ? { marginTop: 10, paddingTop: 10, borderTop: "1px dashed #e2e8f0" } : undefined}>
                    {contactList.length > 1 && <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>คนที่ {i + 1}</div>}
                    <InfoRow label="ชื่อ-นามสกุล" value={contactName(c) || "-"} />
                    <InfoRow label="ตำแหน่ง / ทีม" value={[c.position, c.department].filter(Boolean).join(" · ") || "-"} />
                    <InfoRow label="เบอร์โทร" value={c.phone || "-"} />
                    <InfoRow label="อีเมล" value={c.email || "-"} />
                  </div>
                )) : <div className="no-contact-note" style={{ color: "#b45309", padding: "8px 0" }}>⚠️ ยังไม่มีผู้ติดต่อ — นักศึกษายังไม่ได้เลือกผู้ติดต่อ (HR)</div>}
              </Section>
              <Section title="ข้อมูลพี่เลี้ยง">
                {mentorList.length > 0 ? (
                  mentorList.map((m, i) => (
                    <div key={m.id || i} style={i > 0 ? { marginTop: 10, paddingTop: 10, borderTop: "1px dashed #e2e8f0" } : undefined}>
                      {mentorList.length > 1 && <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 2 }}>คนที่ {i + 1}</div>}
                      <InfoRow label="ชื่อ-สกุล" value={`${m.firstName} ${m.lastName}`} />
                      <InfoRow label="ตำแหน่ง" value={m.position} />
                      <InfoRow label="แผนก" value={m.department} />
                      <InfoRow label="อีเมล" value={m.email} />
                      <InfoRow label="เบอร์โทร" value={m.phone} />
                    </div>
                  ))
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