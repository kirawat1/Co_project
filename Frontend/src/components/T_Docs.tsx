// src/components/T_Docs.tsx
import { useMemo, useState } from "react";
import type { StudentProfile, DocumentItem, DocStatus } from "./store";
import { loadStudents, saveStudents } from "./store";

export default function T_Docs() {
  const [students, setStudents] = useState<StudentProfile[]>(() => loadStudents());
  const [st, setSt] = useState<"all" | DocStatus>("all");
  const [q, setQ] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  const allDocDefs = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) for (const d of (s.docs || [])) {
      if (!map.has(d.id)) map.set(d.id, d.title || d.id);
    }
    return Array.from(map.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title, "th"));
  }, [students]);

  function shortName(doc: { id: string; title: string }): string {
    const mId = /T(\d{1,3})/.exec(doc.id);
    if (mId) {
      const n = parseInt(mId[1], 10);
      if (!Number.isNaN(n)) return `T${n.toString().padStart(2, "0")}`;
    }
    const mTitle = /T(\d{1,3})/.exec(doc.title);
    if (mTitle) {
      const n = parseInt(mTitle[1], 10);
      if (!Number.isNaN(n)) return `T${n.toString().padStart(2, "0")}`;
    }
    return doc.title || doc.id;
  }

  const rows = useMemo(() => {
    const out: { studentId: string; name: string; item: DocumentItem }[] = [];
    students.forEach((s) => (s.docs || []).forEach((d) => out.push({
      studentId: s.studentId || "-",
      name: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
      item: d,
    })));

    return out.filter((r) => {
      const hitStatus = st === "all" || r.item.status === st;
      const hitDoc = selectedDocIds.length === 0 || selectedDocIds.includes(r.item.id);
      const hitQuery = `${r.studentId} ${r.name} ${r.item.title}`.toLowerCase().includes(q.toLowerCase());
      return hitStatus && hitDoc && hitQuery;
    });
  }, [students, st, q, selectedDocIds]);

  function save(next: StudentProfile[]) {
    setStudents(next);
    saveStudents(next);
  }

  function attachFile(studentId: string, docId: string, file: File) {
    const r = new FileReader();
    r.onload = () => {
      const fileData = String(r.result);
      const next = students.map((s) => {
        if (s.studentId !== studentId) return s;
        const docs = (s.docs || []).map((d) =>
          d.id === docId ? { ...d, fileName: file.name, fileData, lastUpdated: new Date().toISOString() } : d
        );
        return { ...s, docs };
      });
      save(next);
    };
    r.readAsDataURL(file);
  }

  function updateStatus(studentId: string, docId: string, v: DocStatus) {
    const next = students.map((s) =>
      s.studentId === studentId
        ? ({
            ...s,
            docs: (s.docs || []).map((d) =>
              d.id === docId ? { ...d, status: v, lastUpdated: new Date().toISOString() } : d
            ),
          } as StudentProfile)
        : s
    );
    save(next);
  }

  function toggleDoc(id: string) {
    setSelectedDocIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function selectAllDocs() {
    setSelectedDocIds(allDocDefs.map((d) => d.id));
  }
  function clearAllDocs() {
    setSelectedDocIds([]);
  }

  return (
    <div className="page" style={{ display: "grid", gap: 16 }}>
      <section className="card" style={{ padding: 24 }}>
        <h2 style={{ marginTop: 0, marginBottom: 10, fontWeight: 1000 }}>เอกสารทั้งหมด</h2>

        <div className="tools" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input className="input" placeholder="ค้นหา: ชื่อ/รหัส/ชื่อเอกสาร" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: "1 1 260px" }} />

          <select className="input" value={st} onChange={(e) => setSt(e.target.value as any)} style={{ flex: "0 0 200px" }}>
            <option value="all">ทุกสถานะ</option>
            <option value="waiting">รอส่ง</option>
            <option value="under-review">รอพิจารณา</option>
            <option value="approved">ผ่าน</option>
            <option value="rejected">ไม่ผ่าน</option>
          </select>

          <button className="btn" onClick={selectAllDocs} type="button">เลือกเอกสารทั้งหมด</button>
          <button className="btn ghost" onClick={clearAllDocs} type="button">ล้างการเลือก</button>
        </div>

        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {allDocDefs.map((d) => {
            const active = selectedDocIds.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                className="btn ghost"
                onClick={() => toggleDoc(d.id)}
                style={{
                  height: 40,
                  borderRadius: 999,
                  borderColor: active ? "rgba(0,116,183,.35)" : "rgba(0,0,0,.08)",
                  color: active ? "#0074B7" : "#0f172a",
                  background: active ? "rgba(0,116,183,.08)" : "#fff",
                }}
                title={d.title}
              >
                {shortName(d)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="doc-table" style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px" }}>
            <thead>
              <tr>
                <th align="left">รหัส</th>
                <th align="left">ชื่อ</th>
                <th align="left">เอกสาร</th>
                <th align="left">ไฟล์</th>
                <th align="left">สถานะ</th>
                <th align="left">อัปเดตล่าสุด</th>
                <th align="left">อัปโหลด</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={`${r.studentId}.${r.item.id}`} className="row" style={{ background: "#fff" }}>
                  <td style={td()}>{r.studentId}</td>
                  <td style={td()} title={r.name}>{r.name || "-"}</td>
                  <td style={td()} title={r.item.title}>{r.item.title}</td>
                  <td style={td()} title={r.item.fileName || "-"}>{r.item.fileName || "-"}</td>
                  <td style={td()}>
                    <select
                      className="input"
                      value={r.item.status}
                      onChange={(e) => updateStatus(r.studentId, r.item.id, e.target.value as DocStatus)}
                      style={{ minWidth: 160, maxWidth: 200, height: 42 }}
                      aria-label={`เปลี่ยนสถานะ: ${r.item.title} ของ ${r.name}`}
                    >
                      <option value="waiting">รอส่ง</option>
                      <option value="under-review">รอพิจารณา</option>
                      <option value="approved">ผ่าน</option>
                      <option value="rejected">ไม่ผ่าน</option>
                    </select>
                  </td>
                  <td style={td()}>{r.item.lastUpdated ? new Date(r.item.lastUpdated).toLocaleString() : "-"}</td>
                  <td style={td()}>
                    <label className="btn" style={{ cursor: "pointer", height: 40, display: "inline-flex", alignItems: "center" }}>
                      แนบไฟล์
                      <input
                        hidden
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          const f = e.currentTarget.files?.[0];
                          if (f) attachFile(r.studentId, r.item.id, f);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} style={{ color: "#6b7280", padding: 12 }}>— ไม่มีข้อมูล —</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        .btn.ghost{
          background:#fff; color:#0f172a; border:1px solid rgba(0,0,0,.08);
          border-radius:12px; padding:10px 14px; font-weight:900; height:44px;
        }
        .btn.ghost:hover{
          background:#f8fafc; border-color:#c7d2fe;
          box-shadow:0 1px 0 rgba(0,0,0,.02), 0 6px 14px rgba(0,116,183,.14);
        }
        @media (max-width: 1100px){
          table{ min-width: 1100px; }
        }
      `}</style>
    </div>
  );
}

function td(): React.CSSProperties {
  return { padding: "12px 10px", borderTop: "1px solid rgba(0,0,0,.04)", borderBottom: "1px solid rgba(0,0,0,.04)" };
}
