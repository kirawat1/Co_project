import { useEffect, type CSSProperties, type ReactNode } from "react";

/* ============================================================
   Modal — กล่องโมดัลกลางของทั้งระบบ
   ก่อนหน้านี้แต่ละหน้ากำหนด .modal-backdrop/.modal-card เอง ~13 ไฟล์
   มุมโค้ง/padding/เงา ไม่ตรงกัน — ใช้ตัวนี้แทนทุกที่ที่มีหน้าต่างลอย

   ใช้งานปกติ (หัวเรื่องเป็นข้อความ):
   <Modal title="แก้ไขข้อมูลบริษัท" onClose={...}>...</Modal>

   หัวเรื่องกำหนดเอง (เช่น มีป้ายสถานะ/รายละเอียดต่อท้ายชื่อ) — ใช้ ModalCloseButton เอง:
   <Modal header={<CustomHeader />} onClose={...}>...</Modal>

   เนื้อหาแบบ split-pane/เต็มจอ (ตัวอย่าง PDF, ตัวแก้ไข) — ปิด padding ของ body เอง:
   <Modal title="..." onClose={...} maxWidth={1400} height="90vh" noBodyPadding>...</Modal>
============================================================ */

interface ModalProps {
  title?: ReactNode;
  header?: ReactNode; // แทน title เมื่อหัวเรื่องซับซ้อนกว่าข้อความเดียว (ต้องใส่ปุ่มปิดเอง)
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number | string;
  height?: string; // เช่น "90vh" — สำหรับโมดัลเนื้อหายาว/split-pane
  noBodyPadding?: boolean; // เนื้อหาจัดการ padding/scroll เอง (split-pane, PDF preview)
  closeOnBackdropClick?: boolean; // ค่าเริ่มต้น true — โมดัลที่มีฟอร์มกรอกยาวอาจปิดไว้กันคลิกพลาด
  ariaLabel?: string;
  cardStyle?: CSSProperties; // ใช้เมื่อจำเป็นจริงๆ เท่านั้น (เช่น กว้างเป็น vw ไม่ใช่ px คงที่)
}

export default function Modal({
  title,
  header,
  onClose,
  children,
  maxWidth = 640,
  height,
  noBodyPadding = false,
  closeOnBackdropClick = true,
  ariaLabel,
  cardStyle,
}: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isFlex = !!height;

  return (
    <div
      className="modal-backdrop"
      onClick={closeOnBackdropClick ? onClose : undefined}
    >
      <div
        className={`modal-card${isFlex ? " modal-card--flex" : ""}`}
        style={{
          maxWidth,
          ...(height ? { height } : null),
          ...(noBodyPadding ? { padding: 0 } : null),
          ...cardStyle,
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === "string" ? title : undefined)}
      >
        {header ?? (title !== undefined && (
          <div className="modal-card-header" style={noBodyPadding ? { padding: "20px 20px 14px" } : undefined}>
            <h3>{title}</h3>
            <ModalCloseButton onClose={onClose} />
          </div>
        ))}
        <div style={noBodyPadding ? { flex: 1, minHeight: 0, overflow: "auto" } : undefined}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** ปุ่มปิด × — ใช้เองเมื่อหัวโมดัลกำหนดเอง (variant="circle" สำหรับหัวที่มีรายละเอียดหลายบรรทัด) */
export function ModalCloseButton({ onClose, variant = "plain" }: { onClose: () => void; variant?: "plain" | "circle" }) {
  if (variant === "circle") {
    return <button onClick={onClose} aria-label="ปิด" className="close-btn">&times;</button>;
  }
  return <button onClick={onClose} aria-label="ปิด" className="modal-close">&times;</button>;
}
