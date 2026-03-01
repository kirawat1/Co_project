import { useState, useEffect } from "react";
import type { CSSProperties } from "react"; // ✅ ใช้ type-only import

export default function StaffCriteriaPage() {
    const [major, setMajor] = useState("CS");
    const [form, setForm] = useState({
        minGpa: 2.00,
        minCoreGpa: 2.00,
        minActivityUnit: 60,
        requiredCourses: "",
        coreCourses: ""
    });

    const token = localStorage.getItem("coop.token");

    // 1. ดึงข้อมูล
    useEffect(() => {
        // ถ้าใส่ token ใน backend แล้วอย่าลืมใส่ headers
        fetch(`http://localhost:5000/api/criteria?major=${major}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(async (res) => {
                if (!res.ok) throw new Error("Network response was not ok");
                return res.json();
            })
            .then(data => {
                setForm({
                    minGpa: data.minGpa || 2.00,
                    minCoreGpa: data.minCoreGpa || 2.00,
                    minActivityUnit: data.minActivityUnit || 60,
                    requiredCourses: Array.isArray(data.requiredCourses) ? data.requiredCourses.join(",") : "",
                    coreCourses: Array.isArray(data.coreCourses) ? data.coreCourses.join(",") : ""
                });
            })
            .catch(err => {
                console.error("Error fetching criteria:", err);
                // กรณี Error ให้ตั้งค่า Default กลับไป
                setForm({ minGpa: 2.0, minCoreGpa: 2.0, minActivityUnit: 60, requiredCourses: "", coreCourses: "" });
            });
    }, [major, token]);

    // 2. บันทึกข้อมูล
    const handleSave = async () => {
        const payload = {
            major,
            ...form,
            requiredCourses: form.requiredCourses.split(",").map(s => s.trim()).filter(s => s !== ""),
            coreCourses: form.coreCourses.split(",").map(s => s.trim()).filter(s => s !== "")
        };

        try {
            const res = await fetch("http://localhost:5000/api/criteria", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) alert("บันทึกเกณฑ์เรียบร้อยแล้ว");
            else alert("เกิดข้อผิดพลาดในการบันทึก");
        } catch (error) {
            console.error(error);
            alert("ไม่สามารถเชื่อมต่อ Server ได้");
        }
    };

    return (
        <div style={{ padding: 30, maxWidth: 800, margin: "0 auto" }}>
            <h2 style={{ marginBottom: 20, fontSize: 20, fontWeight: 700 }}>⚙️ ตั้งค่าเกณฑ์สหกิจศึกษา (Staff)</h2>

            {/* เลือกสาขา */}
            <div style={{ marginBottom: 20 }}>
                <label style={label}>เลือกสาขาวิชาที่จะตั้งค่า: </label>
                <select
                    value={major}
                    onChange={e => setMajor(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", marginLeft: 10 }}
                >
                    <option value="CS">วิทยาการคอมพิวเตอร์ (CS)</option>
                    <option value="IT">เทคโนโลยีสารสนเทศ (IT)</option>
                    <option value="GIS">ภูมิสารสนเทศศาสตร์ (GIS)</option>
                </select>
            </div>

            <div style={card}>
                <div style={formGrid}>
                    <div style={field}>
                        <label style={label}>เกรดเฉลี่ยสะสมขั้นต่ำ (GPAX)</label>
                        <input
                            type="number" step="0.01" style={inputStyle}
                            value={form.minGpa}
                            onChange={e => setForm({ ...form, minGpa: parseFloat(e.target.value) })}
                        />
                    </div>

                    <div style={field}>
                        <label style={label}>เกรดหมวดวิชาเฉพาะขั้นต่ำ (Core GPA)</label>
                        <input
                            type="number" step="0.01" style={inputStyle}
                            value={form.minCoreGpa}
                            onChange={e => setForm({ ...form, minCoreGpa: parseFloat(e.target.value) })}
                        />
                    </div>

                    <div style={field}>
                        <label style={label}>หน่วยกิตกิจกรรมขั้นต่ำ</label>
                        <input
                            type="number" style={inputStyle}
                            value={form.minActivityUnit}
                            onChange={e => setForm({ ...form, minActivityUnit: parseInt(e.target.value) })}
                        />
                    </div>
                </div>

                <hr style={{ margin: "24px 0", borderTop: "1px solid #eee", borderBottom: "none" }} />

                <div style={formGrid}>
                    <div style={field}>
                        <label style={label}>รหัสวิชาเตรียมความพร้อม</label>
                        <div style={meta}>คั่นด้วยเครื่องหมายจุลภาค (,) เช่น CP002001, SC002001</div>
                        <textarea
                            style={{ ...inputStyle, height: 80, fontFamily: 'monospace' }}
                            value={form.requiredCourses}
                            onChange={e => setForm({ ...form, requiredCourses: e.target.value })}
                        />
                    </div>

                    <div style={field}>
                        <label style={label}>รหัสวิชาเฉพาะ (สำหรับคำนวณ Core GPA)</label>
                        <div style={meta}>ใส่รหัสวิชาทั้งหมดที่นำมาคิดเกรดวิชาเฉพาะ (คั่นด้วย ,)</div>
                        <textarea
                            style={{ ...inputStyle, height: 120, fontFamily: 'monospace' }}
                            value={form.coreCourses}
                            onChange={e => setForm({ ...form, coreCourses: e.target.value })}
                        />
                    </div>
                </div>

                <div style={{ marginTop: 30, display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={handleSave} style={saveBtnStyle}>บันทึกการตั้งค่า</button>
                </div>
            </div>
        </div>
    );
}

// ================= STYLES =================
const card: CSSProperties = { background: "#fff", borderRadius: 14, padding: 30, border: "1px solid #e5e7eb", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" };
const formGrid: CSSProperties = { display: "grid", gap: 20 };
const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 8, width: "100%" };
const label: CSSProperties = { fontSize: 14, fontWeight: 600, color: "#334155" };
const meta: CSSProperties = { fontSize: 12, color: "#64748b", marginTop: -4 };
const inputStyle: CSSProperties = {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    transition: "border-color 0.2s"
};
const saveBtnStyle: CSSProperties = {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 24px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14
};