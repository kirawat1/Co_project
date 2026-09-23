import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { apiFetch } from "../utils/apiFetch";

/**
 * รูปถ่ายในใบสมัคร T000 — ใบสมัครมีกรอบรูปถ่ายมุมขวาบน อัปโหลดครั้งเดียวแล้ว PDF ใส่ให้เอง
 *
 * ก่อนอัปโหลดจะครอปกึ่งกลางเป็นสัดส่วนรูปติดบัตร 5:6 และย่อเหลือ 600×720 px
 * รูปจากมือถือหลาย MB จะเหลือราว 100 KB — อัปโหลดเร็ว และ PDF ไม่บวม
 */
const OUT_W = 600;
const OUT_H = 720; // 5:6 ใกล้เคียงกรอบรูปใน PDF (30×35 มม.)

async function cropToPortrait(file: File): Promise<Blob> {
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error("เปิดไฟล์รูปนี้ไม่ได้ ลองใช้ไฟล์ JPG หรือ PNG"));
            el.src = url;
        });
        const target = OUT_W / OUT_H;
        const srcRatio = img.naturalWidth / img.naturalHeight;
        // ครอปกึ่งกลางให้ได้สัดส่วนเป้าหมาย (รูปกว้างตัดข้าง รูปสูงตัดบนล่าง)
        let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
        if (srcRatio > target) { sw = Math.round(sh * target); sx = Math.round((img.naturalWidth - sw) / 2); }
        else { sh = Math.round(sw / target); sy = Math.round((img.naturalHeight - sh) / 2); }

        const canvas = document.createElement("canvas");
        canvas.width = OUT_W;
        canvas.height = OUT_H;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("เบราว์เซอร์นี้ย่อรูปไม่ได้");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, OUT_W, OUT_H);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
        return await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("ย่อรูปไม่สำเร็จ"))), "image/jpeg", 0.88));
    } finally {
        URL.revokeObjectURL(url);
    }
}

interface Props {
    photoPath?: string | null;
    onChange: (photoPath: string | null) => void;
    disabled?: boolean;
}

export default function S_FormPhoto({ photoPath, onChange, disabled }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const pick = async (file: File | undefined) => {
        if (!file) return;
        setError("");
        if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
            setError("กรุณาเลือกไฟล์รูปภาพ");
            return;
        }
        setBusy(true);
        try {
            const blob = await cropToPortrait(file);
            const form = new FormData();
            form.append("photo", blob, "photo.jpg");
            const res = await apiFetch("/api/docs/form-photo", { method: "POST", body: form });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
                setError(data.message || "อัปโหลดรูปไม่สำเร็จ");
                return;
            }
            onChange(data.data.photoPath);
        } catch (e) {
            setError(e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ");
        } finally {
            setBusy(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    const remove = async () => {
        setBusy(true);
        setError("");
        try {
            const res = await apiFetch("/api/docs/form-photo", { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
                setError(data.message || "ลบรูปไม่สำเร็จ");
                return;
            }
            onChange(null);
        } catch {
            setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={frame}>
                {photoPath
                    ? <img src={`/uploads/${photoPath}`} alt="รูปถ่ายสำหรับใบสมัคร" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", lineHeight: 1.5 }}>ยังไม่มี<br />รูปถ่าย</span>}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 10 }}>
                    รูปหน้าตรง พื้นหลังสีเรียบ ระบบจะครอปให้พอดีกรอบรูปถ่ายในใบสมัครอัตโนมัติ
                </div>
                <input
                    ref={inputRef}
                    id="t000-photo"
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => pick(e.target.files?.[0])}
                    disabled={disabled || busy}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn-secondary" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
                        {busy ? "กำลังอัปโหลด..." : photoPath ? "🔄 เปลี่ยนรูป" : "📷 อัปโหลดรูปถ่าย"}
                    </button>
                    {photoPath && (
                        <button type="button" className="btn-ghost" disabled={disabled || busy} onClick={remove}>ลบรูป</button>
                    )}
                </div>
                {error && <div role="alert" style={{ marginTop: 8, fontSize: 13, color: "#b91c1c" }}>{error}</div>}
            </div>
        </div>
    );
}

const frame: CSSProperties = {
    width: 100,
    height: 120,
    border: "1px dashed #94a3b8",
    borderRadius: 6,
    background: "#fff",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
};
