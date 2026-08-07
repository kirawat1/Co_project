export default function A_CriteriaPage() {
  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 32, border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: 22, fontWeight: 800, color: "#1e293b" }}>
          ⚙️ จัดการหลักสูตรสหกิจศึกษา
        </h2>
        <div style={{ color: "#64748b", fontSize: 14, marginTop: 4, marginBottom: 24 }}>
          ระบบได้เปลี่ยนมาใช้ "หลักสูตร" แทน "สาขาวิชา" แล้ว
        </div>
        <div style={{ padding: 20, background: "#fffbeb", borderRadius: 12, border: "1px solid #fde68a" }}>
          <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8 }}>
            📋 หลักสูตรที่ใช้งานในระบบ (คงที่)
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { code: "normal", label: "ภาคปกติ" },
              { code: "special", label: "ภาคพิเศษ" },
            ].map(({ code, label }) => (
              <div
                key={code}
                style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 24px", minWidth: 160 }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: "#0ea5e9", textTransform: "uppercase", letterSpacing: 1 }}>
                  หลักสูตร
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>{label}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>รหัส: {code}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
