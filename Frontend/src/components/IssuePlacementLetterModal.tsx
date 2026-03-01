// Frontend/src/components/IssuePlacementLetterModal.tsx
// หนังสือส่งตัว
import React, { useState } from "react";
import { createPlacementPDF } from "../utils/pdfGeneratorPlacement";

interface Props {
    student: any;
    onClose: () => void;
    onSuccess: () => void;
}

export default function IssuePlacementLetterModal({
    student,
    onClose,
    onSuccess
}: Props) {
    const [placeDocNumber, setPlaceDocNumber] = useState("อว 660301.26.6.2/xxxx");
    const [placeDocDate, setPlaceDocDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [loading, setLoading] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    // --- วันที่ฝึกงาน ---
    const startDate =
        student.coop?.actualStartDate ||
        student.coopApplicationForm?.startDate ||
        "";

    const endDate =
        student.coop?.actualEndDate ||
        student.coopApplicationForm?.endDate ||
        "";

    const toThaiDate = (dateStr: string) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("th-TH", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    };

    const studentName = `${student.firstName} ${student.lastName}`;
    const companyName = student.coop?.company?.name || "-";

    // --- Preview PDF ---
    const handlePreview = async () => {
        setLoading(true);
        try {
            const doc = await createPlacementPDF(student, {
                placeDocNumber,
                placeDocDate,
                actualStartDate: startDate,
                actualEndDate: endDate
            });

            const blob = doc.output("blob");
            setPdfUrl(URL.createObjectURL(blob));
        } catch (err) {
            console.error(err);
            alert("ไม่สามารถสร้าง PDF ได้");
        } finally {
            setLoading(false);
        }
    };

    // --- Confirm Issue ---
    const handleConfirm = async () => {
        if (!confirm("ยืนยันการออกหนังสือส่งตัว?")) return;

        try {
            let fileToSend: File | null = null;

            if (pdfUrl) {
                const blob = await fetch(pdfUrl).then(r => r.blob());
                fileToSend = new File(
                    [blob],
                    `placement_${student.studentId}.pdf`,
                    { type: "application/pdf" }
                );
            }

            const formData = new FormData();
            formData.append("studentId", student.id);
            formData.append("status", "PLACEMENT_LETTER_ISSUED");
            formData.append(
                "comment",
                `ออกหนังสือส่งตัว เลขที่ ${placeDocNumber}`
            );
            formData.append("placeDocNumber", placeDocNumber);
            formData.append("placeDocDate", placeDocDate);

            if (fileToSend) {
                formData.append("file", fileToSend);
            }

            const token = localStorage.getItem("coop.token");

            await fetch("http://localhost:5000/api/admin/t000/review", {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            alert("✅ ออกหนังสือส่งตัวเรียบร้อย");
            onSuccess();
        } catch (err) {
            console.error(err);
            alert("เกิดข้อผิดพลาด");
        }
    };

    return (
        <div className="modal-backdrop" style={{ zIndex: 10000 }}>
            <div
                className="modal-card"
                style={{ width: "95%", height: "95%", maxWidth: "1400px" }}
            >
                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        paddingBottom: 12,
                        borderBottom: "1px solid #eee"
                    }}
                >
                    <h3 style={{ margin: 0 }}>
                        📄 ออกหนังสือส่งตัว (Placement Letter)
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            border: "none",
                            background: "none",
                            fontSize: 24,
                            cursor: "pointer"
                        }}
                    >
                        &times;
                    </button>
                </div>

                {/* Body */}
                <div
                    style={{
                        display: "flex",
                        gap: 24,
                        height: "100%",
                        paddingTop: 20,
                        overflow: "hidden"
                    }}
                >
                    {/* PDF Preview */}
                    <div
                        style={{
                            flex: 1,
                            background: "#525659",
                            borderRadius: 8,
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column"
                        }}
                    >
                        {pdfUrl ? (
                            <iframe
                                src={pdfUrl}
                                title="PDF Preview"
                                style={{ border: "none", flex: 1 }}
                            />
                        ) : (
                            <div
                                style={{
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#ccc",
                                    gap: 10
                                }}
                            >
                                <div style={{ fontSize: 40 }}>📄</div>
                                <div>
                                    กดปุ่ม <b>"ดูตัวอย่าง"</b> เพื่อสร้างเอกสาร
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Panel */}
                    <div
                        style={{
                            width: 300,
                            display: "flex",
                            flexDirection: "column",
                            gap: 15,
                            flexShrink: 0
                        }}
                    >
                        {/* Section 1 */}
                        <div
                            style={{
                                fontSize: 14,
                                fontWeight: "bold",
                                color: "#334155",
                                borderBottom: "2px solid #3b82f6",
                                paddingBottom: 4,
                                marginBottom: 4
                            }}
                        >
                            1. ข้อมูลหนังสือ
                        </div>

                        <div>
                            <label style={labelStyle}>เลขที่หนังสือ</label>
                            <input
                                className="input"
                                value={placeDocNumber}
                                onChange={e => setPlaceDocNumber(e.target.value)}
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>วันที่ออกหนังสือ</label>
                            <input
                                type="date"
                                className="input"
                                value={placeDocDate}
                                onChange={e => setPlaceDocDate(e.target.value)}
                            />
                        </div>

                        {/* Section 2 */}
                        <div
                            style={{
                                fontSize: 14,
                                fontWeight: "bold",
                                color: "#334155",
                                borderBottom: "2px solid #f59e0b",
                                paddingBottom: 4,
                                marginBottom: 4
                            }}
                        >
                            2. ตรวจสอบข้อมูล
                        </div>

                        {/* Student */}
                        <div style={infoCardStyle}>
                            <div style={infoLabelStyle}>👤 นักศึกษา</div>
                            <div style={infoValueStyle}>{studentName}</div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>
                                {student.studentId}
                            </div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>
                                {student.major || "-"}
                            </div>
                        </div>

                        {/* Company */}
                        <div style={infoCardStyle}>
                            <div style={infoLabelStyle}>🏢 สถานประกอบการ</div>
                            <div style={infoValueStyle}>{companyName}</div>
                        </div>

                        {/* Date */}
                        <div
                            style={{
                                ...infoCardStyle,
                                background: "#f0f9ff",
                                borderColor: "#bae6fd"
                            }}
                        >
                            <div
                                style={{
                                    ...infoLabelStyle,
                                    color: "#0369a1"
                                }}
                            >
                                📅 ระยะเวลาปฏิบัติงาน
                            </div>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "40px 1fr",
                                    gap: 4,
                                    fontSize: 13,
                                    marginBottom: 8
                                }}
                            >
                                <span style={{ color: "#64748b" }}>เริ่ม:</span>
                                <span style={{ fontWeight: 600 }}>
                                    {toThaiDate(startDate)}
                                </span>
                                <span style={{ color: "#64748b" }}>ถึง:</span>
                                <span style={{ fontWeight: 600 }}>
                                    {toThaiDate(endDate)}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div
                            style={{
                                marginTop: "auto",
                                display: "flex",
                                flexDirection: "column",
                                gap: 10
                            }}
                        >
                            <button
                                className="btn btn-secondary"
                                onClick={handlePreview}
                                disabled={loading}
                            >
                                {loading ? "⏳ กำลังโหลด..." : "👁️ ดูตัวอย่าง (Preview)"}
                            </button>
                            <button
                                className="btn btn-success"
                                onClick={handleConfirm}
                                disabled={!pdfUrl}
                            >
                                🚀 ยืนยันการออกหนังสือ
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
        .input {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-family: inherit;
          font-size: 14px;
        }
        .btn {
          padding: 12px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
        }
        .btn-secondary {
          background: #e2e8f0;
          color: #334155;
        }
        .btn-success {
          background: #10b981;
          color: white;
        }
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .modal-card {
          background: white;
          padding: 24px;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
      `}</style>
        </div>
    );
}

// Shared styles
const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
    marginBottom: 4,
    display: "block"
};

const infoCardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 12,
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
};

const infoLabelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 6
};

const infoValueStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: "#1e293b",
    marginBottom: 2
};
