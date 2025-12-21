import { useMemo, useState } from "react";
import type { StudentProfile, StudentEmail } from "./store";
import { loadStudents, saveStudents } from "./store";
import DocTable from "./S_DocTable";

/* =========================
   Helpers
========================= */

function primaryEmail(emails: StudentEmail[] | undefined): string {
  if (!emails || emails.length === 0) return "-";
  return emails.find((e) => e.primary)?.email || emails[0].email;
}

/* =========================
   Mapping
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
  submitted: "รอพิจารณา",
  approved: "อนุมัติ",
  rejected: "ไม่อนุมัติ",
};

/* =========================
   Main
========================= */

export default function A_Students() {
  const [items, setItems] = useState<StudentProfile[]>(() => loadStudents());

  const [q, setQ] = useState("");
  const [filterMajors, setFilterMajors] = useState<string[]>([]);
  const [filterCurriculums, setFilterCurriculums] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [modalStudent, setModalStudent] = useState<StudentProfile | null>(null);

  function resetFilters() {
    setQ("");
    setFilterMajors([]);
    setFilterCurriculums([]);
    setFilterStatuses([]);
  }

  function setRequestStatus(
    studentId: string,
    status: "approved" | "rejected",
    teacherReason?: string
  ) {
    setItems((prev) => {
      const next = prev.map((s) =>
        s.studentId !== studentId
          ? s
          : {
            ...s,
            coopRequest: {
              ...s.coopRequest,
              status,
              teacherReason,
              decidedAt: new Date().toISOString(),
              decidedBy: "เจ้าหน้าที่ระบบ",
            },
          }
      );
      saveStudents(next);
      return next;
    });
    setModalStudent(null);
  }

  const filtered = useMemo(() => {
    return items.filter((s) => {
      const text = `
        ${s.studentId}
        ${s.prefix ?? ""}
        ${s.firstName ?? ""}
        ${s.lastName ?? ""}
        ${primaryEmail(s.emails)}
      `.toLowerCase();

      return (
        text.includes(q.toLowerCase()) &&
        (filterMajors.length === 0 || filterMajors.includes(s.major ?? "")) &&
        (filterCurriculums.length === 0 ||
          filterCurriculums.includes(s.curriculum ?? "")) &&
        (filterStatuses.length === 0 ||
          filterStatuses.includes(s.coopRequest?.status ?? ""))
      );
    });
  }, [items, q, filterMajors, filterCurriculums, filterStatuses]);

  return (
    <div style={{ padding: 28, marginLeft: 35 }}>
      {/* ================= Filters ================= */}
      <section style={card}>
        <h2 style={{ marginBottom: 16 }}>ข้อมูลนักศึกษา</h2>

        <div style={filterRow}>
          <input
            className="input"
            placeholder="ค้นหา: รหัส / ชื่อ / อีเมล"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 260 }}
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
          <FilterBox
            title="สถานะคำร้อง"
            items={STATUS_TH}
            values={filterStatuses}
            onChange={setFilterStatuses}
          />

          <button className="btn" style={saveBtn} onClick={resetFilters}>
            ล้างตัวกรอง
          </button>
        </div>
      </section>

      {/* ================= Table ================= */}
      <section style={{ ...card, marginTop: 20 }}>
        <table width="100%">
          <thead>
            <tr>
              {[
                "รหัส",
                "ชื่อ–นามสกุล",
                "อีเมล",
                "สาขา",
                "หลักสูตร",
                "สถานะ",
                "รายละเอียด",
              ].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 16, color: "#64748b" }}>
                  ไม่พบนักศึกษาตามเงื่อนไข
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.studentId}>
                  <td>{s.studentId}</td>
                  <td>
                    {(s.prefix ?? "") + s.firstName} {s.lastName}
                  </td>
                  <td>{primaryEmail(s.emails)}</td>
                  <td>{MAJOR_TH[s.major ?? ""] ?? "-"}</td>
                  <td>{CURRICULUM_TH[s.curriculum ?? ""] ?? "-"}</td>
                  <td>
                    <StatusBadge status={s.coopRequest?.status} />
                  </td>
                  <td>
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

      {modalStudent && (
        <StudentModal
          student={modalStudent}
          onClose={() => setModalStudent(null)}
          onApprove={(r) =>
            setRequestStatus(modalStudent.studentId, "approved", r)
          }
          onReject={(r) =>
            setRequestStatus(modalStudent.studentId, "rejected", r)
          }
        />
      )}
    </div>
  );
}

/* =========================
   Modal
========================= */

function StudentModal({
  student,
  onClose,
  onApprove,
  onReject,
}: {
  student: StudentProfile;
  onClose: () => void;
  onApprove: (reason?: string) => void;
  onReject: (reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const isApproved = student.coopRequest?.status === "approved";

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2>
          {(student.prefix ?? "") + student.firstName} {student.lastName}
        </h2>
        <div style={{ color: "#64748b", marginBottom: 16 }}>
          รหัสนักศึกษา: {student.studentId}
        </div>

        <Section title="ข้อมูลนักศึกษา">
          <InfoRow label="สาขา" value={MAJOR_TH[student.major ?? ""]} />
          <InfoRow
            label="หลักสูตร"
            value={CURRICULUM_TH[student.curriculum ?? ""]}
          />
          <InfoRow label="อีเมล" value={primaryEmail(student.emails)} />
          <InfoRow label="เบอร์โทร" value={student.phone} />
        </Section>

        {student.company && (
          <Section title="ข้อมูลบริษัท">
            <InfoRow label="ชื่อบริษัท" value={student.company.name} />
            <InfoRow label="ที่อยู่" value={student.company.address} />
            <InfoRow label="อีเมล" value={student.company.hrEmail} />
          </Section>
        )}

        {/* ===== ADD: เอกสารของนักศึกษา ===== */}
        <Section title="เอกสารของนักศึกษา">
          <DocTable
            items={student.docs ?? []} //  fallback
            allowStatusChange={false} // Admin ดูอย่างเดียว
            onChange={() => { }}
          />
        </Section>

        {!isApproved && (
          <Section title="ผลการพิจารณา">
            <textarea
              style={textarea}
              placeholder="เหตุผลตอบกลับ"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button
                className="btn"
                style={{ ...ghostBtn, color: "#dc2626" }}
                onClick={() => onReject(reason)}
              >
                ไม่อนุมัติ
              </button>
              <button className="btn" onClick={() => onApprove(reason)}>
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

/* =========================
   UI Helpers
========================= */

function FilterBox({
  title,
  items,
  values,
  onChange,
}: {
  title: string;
  items: Record<string, string>;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>
        {title}
      </div>
      {Object.entries(items).map(([k, v]) => (
        <label key={k} style={{ marginRight: 10, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={values.includes(k)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...values, k]
                  : values.filter((x) => x !== k)
              )
            }
          />{" "}
          {v}
        </label>
      ))}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr" }}>
      <div style={{ color: "#64748b", fontWeight: 600 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value || "-"}</div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    submitted: { bg: "#eff6ff", color: "#1e40af" },
    approved: { bg: "#ecfdf5", color: "#065f46" },
    rejected: { bg: "#fef2f2", color: "#991b1b" },
  };
  const s = status ? map[status] : undefined;
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: s?.bg ?? "#f1f5f9",
        color: s?.color ?? "#334155",
      }}
    >
      {STATUS_TH[status ?? ""] ?? "-"}
    </span>
  );
}

/* =========================
   Styles
========================= */

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 14,
  padding: 20,
  border: "1px solid #e5e7eb",
};

const filterRow: React.CSSProperties = {
  display: "flex",
  gap: 24,
  flexWrap: "wrap",
  alignItems: "flex-end",
};

const th: React.CSSProperties = {
  textAlign: "left",
  paddingBottom: 8,
  fontSize: 14,
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
};

const modal: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 28,
  width: "100%",
  maxWidth: 640,
  border: "1px solid #e5e7eb",
};

const modalFooter: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: 24,
};

const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: 90,
  borderRadius: 10,
  padding: 12,
  border: "1px solid #e5e7eb",
};

const ghostBtn: React.CSSProperties = {
  background: "#fff",
  color: "var(--ios-blue)",
  boxShadow: "none",
  border: "1px solid rgba(10,132,255,.25)",
  height: 36,
};

const saveBtn: React.CSSProperties = {
  background: "var(--ios-blue)",
  color: "#fff",
  boxShadow: "none",
  border: "1px solid rgba(10,132,255,.25)",
  height: 36,
};

/* ===== Section ===== */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={sectionCard}>
      <div style={sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

const sectionCard: React.CSSProperties = {
  background: "#f8fafc",
  borderRadius: 12,
  padding: 16,
  marginBottom: 14,
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 700,
  marginBottom: 10,
  fontSize: 14,
};
