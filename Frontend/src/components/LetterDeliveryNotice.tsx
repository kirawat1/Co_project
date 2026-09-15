// กล่องบอกนักศึกษาว่าหนังสือ (ขอความอนุเคราะห์ / ส่งตัว) ถูกส่งให้บริษัทอย่างไร
// delivery มาจาก StudentCoop.reqLetterDelivery / placeLetterDelivery ที่เจ้าหน้าที่เลือกตอนออกหนังสือ

export type LetterDelivery = "STUDENT" | "STAFF";

export default function LetterDeliveryNotice({ delivery, letter }: { delivery: LetterDelivery; letter: "REQUEST" | "PLACEMENT" }) {
    const staff = delivery === "STAFF";
    const text = staff
        ? (letter === "REQUEST"
            ? "เจ้าหน้าที่จัดส่งหนังสือให้บริษัทเรียบร้อยแล้ว ไม่ต้องนำไปยื่นเอง"
            : "เจ้าหน้าที่จัดส่งหนังสือส่งตัวให้บริษัทล่วงหน้าเรียบร้อยแล้ว ไม่ต้องนำไปยื่นเอง")
        : (letter === "REQUEST"
            ? "ดาวน์โหลดหนังสือ แล้วนำไปยื่นบริษัทด้วยตนเอง (หรือรับตัวจริงที่คณะ)"
            : "ดาวน์โหลดหนังสือส่งตัว แล้วนำไปยื่นบริษัทในวันรายงานตัว (หรือรับตัวจริงที่คณะ)");
    return (
        <div style={{
            marginTop: 12, padding: "10px 12px", borderRadius: 8, fontSize: 13, lineHeight: 1.5,
            background: staff ? "#f0fdf4" : "#eff6ff", border: `1px solid ${staff ? "#bbf7d0" : "#bfdbfe"}`,
            color: staff ? "#166534" : "#1e40af",
        }}>
            <strong>{staff ? "📮 เจ้าหน้าที่จัดส่งให้แล้ว" : "📥 นักศึกษานำไปยื่นเอง"}</strong><br />
            {text}
        </div>
    );
}
