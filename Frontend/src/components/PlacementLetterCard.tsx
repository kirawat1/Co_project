import { useState } from "react";

interface Props {
    placeLetterUrl?: string;
    placeDocNumber?: string;
    placeDocDate?: string;
    docStatus?: string;
    onRefresh?: () => void;
}

export default function PlacementLetterCard({
    placeLetterUrl,
    placeDocNumber,
    placeDocDate,
    docStatus,
    onRefresh
}: Props) {
    const baseUrl = "/uploads";
    const fileUrl = placeLetterUrl ? `${baseUrl}/${placeLetterUrl}` : null;

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const canDownload = !!fileUrl;

    // 👁️ Preview
    const handlePreview = () => {
        if (!fileUrl) return;
        setPreviewUrl(fileUrl);
    };

    // ⬇️ Download + Acknowledge
    const handleDownloadAndAck = async () => {
        if (!fileUrl) return;

        window.open(fileUrl, "_blank");

        try {
            const token = localStorage.getItem("coop.token");

            const res = await fetch(
                "/api/students/acknowledge-placement-letter",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        status: "INTERNSHIP_STARTED"
                    })
                }
            );

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(data.message || "ไม่สามารถอัปเดตสถานะได้ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่");
                return;
            }

            onRefresh?.();
        } catch (err) {
            console.error("ack placement error", err);
            alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        }
    };

    return (
        <>
            <div style={cardStyle}>
                {/* ===== Header ===== */}
                <div style={headerStyle}>
                    <h4 style={titleStyle}>📄 หนังสือส่งตัว (Placement Letter)</h4>
                    <div style={subStyle}>
                        {canDownload
                            ? `เลขที่ ${placeDocNumber || "-"}`
                            : "อยู่ระหว่างการออกหนังสือ"}
                    </div>
                </div>

                {/* ===== Info ===== */}
                {canDownload && (
                    <div style={infoStyle}>
                        <span>📅 วันที่ออก</span>
                        <strong>
                            {placeDocDate
                                ? new Date(placeDocDate).toLocaleDateString("th-TH", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric"
                                })
                                : "-"}
                        </strong>
                    </div>
                )}

                {/* ===== Actions ===== */}
                <div style={actionStyle}>
                    <button
                        onClick={handlePreview}
                        disabled={!canDownload}
                        style={{
                            ...btnStyle,
                            background: canDownload ? "#ede9fe" : "#e5e7eb",
                            color: canDownload ? "#5b21b6" : "#9ca3af"
                        }}
                    >
                        👁️ ดูตัวอย่าง
                    </button>

                    <button
                        onClick={handleDownloadAndAck}
                        disabled={!canDownload}
                        style={{
                            ...btnStyle,
                            background: canDownload ? "#7c3aed" : "#e5e7eb",
                            color: canDownload ? "white" : "#9ca3af"
                        }}
                    >
                        ⬇️ ดาวน์โหลด
                    </button>
                </div>

                {!canDownload && (
                    <div style={hintStyle}>
                        ⏳ เจ้าหน้าที่กำลังจัดทำหนังสือส่งตัว
                    </div>
                )}

                {canDownload && docStatus !== "ACCEPTANCE_CHECKED" && (
                    <div style={hintStyle}>
                        * เมื่อกดดาวน์โหลด สถานะจะเปลี่ยนเป็น “เริ่มออกฝึกสหกิจ”
                    </div>
                )}
            </div>

            {/* ===== Preview Modal ===== */}
            {previewUrl && (
                <div style={modalBackdrop}>
                    <div style={modalCard}>
                        <div style={modalHeader}>
                            <h3 style={{ margin: 0 }}>ตัวอย่างหนังสือส่งตัว</h3>
                            <button
                                onClick={() => setPreviewUrl(null)}
                                style={closeBtn}
                            >
                                ×
                            </button>
                        </div>

                        <iframe
                            src={previewUrl}
                            title="placement-letter-preview"
                            style={iframeStyle}
                        />
                    </div>
                </div>
            )}
        </>
    );
}

/* ===== Styles ===== */

const cardStyle: React.CSSProperties = {
    background: "white",
    marginTop: 24,
    padding: 20,
    borderRadius: 14,
    border: "1px solid #e9d5ff",
    boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
    maxWidth: 420
};

const headerStyle: React.CSSProperties = {
    marginBottom: 12
};

const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 16,
    color: "#4c1d95"
};

const subStyle: React.CSSProperties = {
    fontSize: 13,
    color: "#64748b"
};

const infoStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    background: "#f5f3ff",
    padding: "8px 12px",
    marginBottom: 10,
    borderRadius: 8,
    fontSize: 13
};

const actionStyle: React.CSSProperties = {
    display: "flex",
    gap: 10
};

const btnStyle: React.CSSProperties = {
    flex: 1,
    border: "none",
    padding: "10px",
    borderRadius: 8,
    fontWeight: 600,
    cursor: "pointer"
};

const hintStyle: React.CSSProperties = {
    fontSize: 11,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8
};

/* ===== Modal ===== */

const modalBackdrop: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
};

const modalCard: React.CSSProperties = {
    background: "white",
    width: "80%",
    height: "85%",
    padding: 20,
    borderRadius: 12,
    display: "flex",
    flexDirection: "column"
};

const modalHeader: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
};

const closeBtn: React.CSSProperties = {
    border: "none",
    background: "none",
    fontSize: 24,
    cursor: "pointer"
};

const iframeStyle: React.CSSProperties = {
    flex: 1,
    border: "1px solid #eee",
    borderRadius: 8
};
