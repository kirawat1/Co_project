import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../utils/apiFetch";
import { TABLE_TH as th, TABLE_TD as td, TABLE_HEADER_ROW } from "../utils/tableStyles";

// ภาพรวมการตั้งค่าแยกหลักสูตร — หลักสูตรไหนตั้งค่าช่องไหนแยกจากค่ากลางไว้บ้าง (อาจารย์ประจำวิชาเห็นเฉพาะหลักสูตรตัวเอง)
interface SettingRow { key: string; label: string; page: string; overrides: Record<string, string[]> }

export default function A_MajorConfigSummary() {
  const [majors, setMajors] = useState<string[]>([]);
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/admin/major-config")
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { setError(d.message || "โหลดข้อมูลไม่สำเร็จ"); return; }
        setMajors(d.majors ?? []);
        setSettings(d.settings ?? []);
      })
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  const customized = settings.reduce((n, s) => n + majors.filter(m => s.overrides[m]?.length).length, 0);

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#1e293b" }}>🗂️ สรุปการตั้งค่ารายหลักสูตร</h2>
        <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
          ช่องที่หลักสูตรตั้งค่าแยกไว้ (✎) ใช้ค่าของหลักสูตรนั้น · ช่องอื่นใช้ค่ากลาง — กดชื่อการตั้งค่าเพื่อไปแก้ไข
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>กำลังโหลด...</div>
        ) : error ? (
          <div style={{ padding: 32, textAlign: "center", color: "#dc2626" }}>{error}</div>
        ) : (
          <>
            <div style={{ padding: "12px 20px", fontSize: 13, color: "#475569", borderBottom: "1px solid #f1f5f9" }}>
              {customized === 0 ? "ทุกหลักสูตรใช้ค่ากลางทั้งหมด" : `มีการตั้งค่าแยกหลักสูตร ${customized} รายการ`}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={TABLE_HEADER_ROW}>
                    <th style={th}>การตั้งค่า</th>
                    {majors.map(m => <th key={m} style={th}>หลักสูตร {m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {settings.map(s => (
                    <tr key={s.key} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ ...td, fontWeight: 700 }}>
                        <Link to={s.page} style={{ color: "#1d4ed8", textDecoration: "none" }}>{s.label} →</Link>
                      </td>
                      {majors.map(m => {
                        const fields = s.overrides[m] ?? [];
                        return (
                          <td key={m} style={td}>
                            {fields.length === 0 ? (
                              <span style={{ fontSize: 12, color: "#94a3b8" }}>ค่ากลาง</span>
                            ) : (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {fields.map(f => (
                                  <span key={f} style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "2px 8px" }}>✎ {f}</span>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
