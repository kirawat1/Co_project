import React, { useState, useEffect } from "react";

interface CountdownTimerProps {
    endDate?: string;
    isOpen?: boolean;
}

export default function CountdownTimer({ endDate, isOpen }: CountdownTimerProps) {
    const [timeLeft, setTimeLeft] = useState<{
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        isExpired: boolean;
    } | null>(null);

    useEffect(() => {
        if (!endDate) return;

        const calculateTimeLeft = () => {
            // 🟢 สร้าง Date object ใหม่ และบังคับให้เป็นเวลา 23:59:59 ของวันนั้นๆ ตามเวลาเครื่อง
            const targetDate = new Date(endDate);
            // ตัดส่วนเวลาเดิมทิ้งก่อน (เผื่อ Backend ส่งมาแบบมี T00:00:00Z)
            targetDate.setHours(23, 59, 59, 999);

            const now = new Date();
            const difference = targetDate.getTime() - now.getTime();

            if (difference <= 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
                return;
            }

            setTimeLeft({
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
                isExpired: false,
            });
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(timer);
    }, [endDate]);

    // แปลงวันที่ให้อ่านง่าย (เช่น 26 มีนาคม 2569)
    const formattedDueDate = endDate
        ? new Date(endDate).toLocaleDateString("th-TH", {
            day: "numeric",
            month: "long",
            year: "numeric",
        })
        : "รอประกาศ";

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                กำหนดส่งภายใน: <span style={{ color: "#0f172a", marginLeft: 6 }}>{formattedDueDate}</span>
            </span>

            {isOpen && timeLeft && !timeLeft.isExpired ? (
                <div style={{ display: "flex", gap: 6, background: "#fff1f2", padding: "6px 12px", borderRadius: 8, border: "1px solid #fecaca", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#e11d48" }}>⏳ เหลือเวลา:</span>
                    <div style={{ display: "flex", gap: 4, color: "#be123c", fontWeight: 800, fontSize: 15 }}>
                        <span>{timeLeft.days} วัน</span>
                        <span>{String(timeLeft.hours).padStart(2, "0")}:</span>
                        <span>{String(timeLeft.minutes).padStart(2, "0")}:</span>
                        <span style={{ width: 22, textAlign: "left" }}>{String(timeLeft.seconds).padStart(2, "0")}</span>
                    </div>
                </div>
            ) : isOpen === false ? (
                <div style={{ background: "#f1f5f9", padding: "6px 12px", borderRadius: 8, color: "#475569", fontWeight: 700, fontSize: 14, border: "1px solid #cbd5e1" }}>
                    ⛔ ระบบปิดรับเอกสารชั่วคราว
                </div>
            ) : timeLeft?.isExpired ? (
                <div style={{ background: "#fef2f2", padding: "6px 12px", borderRadius: 8, color: "#ef4444", fontWeight: 700, fontSize: 14, border: "1px dashed #fca5a5" }}>
                    🚫 หมดเขตการส่งเอกสาร
                </div>
            ) : (
                <span style={{ color: "#9ca3af", fontSize: 13 }}>กำลังคำนวณเวลา...</span>
            )}
        </div>
    );
}