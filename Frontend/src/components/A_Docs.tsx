import { useMemo, useState } from "react";
import type { StudentProfile, DocumentItem, DocStatus } from "./store";

const KS = "coop.student.profile.v1";
function loadStudents(): StudentProfile[] { try { return JSON.parse(localStorage.getItem(KS) || "[]"); } catch { return [] } }
function saveStudents(list: StudentProfile[]) { localStorage.setItem(KS, JSON.stringify(list)); }

export default function A_Docs() {
  const [students, setStudents] = useState<StudentProfile[]>(() => loadStudents());
  const [st, setSt] = useState<"all" | DocStatus>("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const out: { studentId: string; name: string; item: DocumentItem }[] = [];
    students.forEach(s => (s.docs || []).forEach(d => out.push({
      studentId: s.studentId || "-",
      name: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
      item: d
    })));
    return out.filter(r =>
      (st === "all" || r.item.status === st) &&
      `${r.studentId} ${r.name} ${r.item.title}`.toLowerCase().includes(q.toLowerCase())
    );
  }, [students, st, q]);

  function updateStatus(studentId: string, id: string, v: DocStatus) {
    const next = students.map(s => s.studentId === studentId
      ? ({ ...s, docs: (s.docs || []).map(d => d.id === id ? { ...d, status: v, lastUpdated: new Date().toISOString() } : d) })
      : s
    );
    setStudents(next); saveStudents(next);
  }

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>เอกสารทั้งหมด</h2>

        {/* Toolbar แบบ flex: ช่องค้นหา (ยืดได้) + select (คงที่) + ปุ่มส่งออก (คงที่) */}
        <div
          className="tools"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginLeft: 18
          }}
        >
          <input
            className="input"
            placeholder="ค้นหา: ชื่อ/รหัส/ชื่อเอกสาร"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ flex: "1 1 480px", minWidth: 240 }}
          />
          <select
            className="input"
            value={st}
            onChange={e => setSt(e.target.value as any)}
            style={{ flex: "0 0 220px" }}
          >
            <option value="all">ทุกสถานะ</option>
            <option value="waiting">รอส่ง</option>
            <option value="under-review">รอพิจารณา</option>
            <option value="approved">ผ่าน</option>
            <option value="rejected">ไม่ผ่าน</option>
          </select>
          <Export rows={rows} />
        </div>
      </section>

      <section className="card" style={{ paddingBottom: 12 }}>
        <table className="doc-table" style={{ width: "100%", marginTop: 8, marginLeft: 18, marginBottom: 15 }}>
          {/* คุมความกว้างคอลัมน์ให้พอดีข้อมูล และป้องกันการล้น */}
          <colgroup>
            <col style={{ width: "10ch" }} />  {/* รหัส */}
            <col style={{ width: "14ch" }} />  {/* ชื่อ */}
            <col className="col-title" />       {/* เอกสาร */}
            <col className="col-file" />        {/* ไฟล์ */}
            <col style={{ width: "16ch" }} />  {/* สถานะ */}
            <col style={{ width: "18ch" }} />  {/* อัปเดตล่าสุด */}
          </colgroup>

          <thead>
            <tr>
              <th align="left">รหัส</th>
              <th align="left">ชื่อ</th>
              <th align="left">เอกสาร</th>
              <th align="left">ไฟล์</th>
              <th align="left">สถานะ</th>
              <th align="left">อัปเดตล่าสุด</th>
            </tr>
          </thead>

          <tbody>
            {rows.map(r => (
              <tr key={`${r.studentId}.${r.item.id}`} className="row">
                <td>{r.studentId}</td>
                <td className="cell-ellipsis" title={r.name}>{r.name || "-"}</td>
                <td className="cell-ellipsis" title={r.item.title}>{r.item.title}</td>
                <td className="cell-ellipsis" title={r.item.fileName || "-"}>{r.item.fileName || "-"}</td>
                <td>
                  <select
                    className="input"
                    value={r.item.status}
                    onChange={e => updateStatus(r.studentId, r.item.id, e.target.value as DocStatus)}
                    style={{ minWidth: 140, maxWidth: 180 }}
                  >
                    <option value="waiting">รอส่ง</option>
                    <option value="under-review">รอพิจารณา</option>
                    <option value="approved">ผ่าน</option>
                    <option value="rejected">ไม่ผ่าน</option>
                  </select>
                </td>
                <td>{r.item.lastUpdated ? new Date(r.item.lastUpdated).toLocaleString() : "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} style={{ color: "#6b7280" }}>— ไม่มีข้อมูล —</td></tr>}
          </tbody>
        </table>
      </section>

      <style>{`
        /* ตารางคงที่ + ตัดข้อความด้วย … ในคอลัมน์ยาว */
        .doc-table{ table-layout: fixed; }
        .col-title{ width: 28ch; }
        .col-file{ width: 20ch; }
        .cell-ellipsis{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

        /* ปรับปุ่มส่งออกให้ไม่กินที่เกินไป */
        .tools .btn{ white-space: nowrap; flex: 0 0 auto; }

        /* Responsive: iPad และเล็กกว่า */
        @media (max-width:1024px){
          .tools{ margin-left: 18px !important; }
          .tools .input{ flex: 1 1 100% !important; min-width: 0 !important; }
          .tools select{ flex-basis: 100% !important; }
          .tools .btn{ flex-basis: 100% !important; }

          .col-title{ width: 22ch; }
          .col-file{ width: 16ch; }
        }
      `}</style>
    </div>
  );
}

function Export({ rows }: { rows: { studentId: string; name: string; item: DocumentItem }[] }) {
  function onClick() {
    const data = rows.map(r => ({
      studentId: r.studentId,
      name: r.name,
      title: r.item.title,
      status: r.item.status,
      file: r.item.fileName || "",
      lastUpdated: r.item.lastUpdated || ""
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "docs_export.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <button className="btn" onClick={onClick} type="button" style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}>
      ส่งออกผลรวม (JSON)
    </button>
  );
}
