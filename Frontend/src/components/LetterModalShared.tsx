// Frontend/src/components/LetterModalShared.tsx
// Shared components and styles for Issue*Letter modals

export function FileReady({ label, onDownload }: { label: string; onDownload: () => void }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
            <span style={{ fontSize: 12, color: '#166534', flex: 1 }}>✅ {label}</span>
            <button className="btn" style={{ background: '#3b82f6', color: 'white', padding: '4px 10px', fontSize: 11 }} onClick={onDownload}>⬇️ โหลด</button>
        </div>
    );
}

export function DeliveryPicker({ value, onChange, name }: {
    value: "STUDENT" | "STAFF";
    onChange: (v: "STUDENT" | "STAFF") => void;
    name: string;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name={name} value="STUDENT" checked={value === "STUDENT"} onChange={() => onChange("STUDENT")} style={{ marginTop: 2 }} />
                <div><b>นักศึกษาดาวน์โหลด / รับเองที่คณะ</b></div>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name={name} value="STAFF" checked={value === "STAFF"} onChange={() => onChange("STAFF")} style={{ marginTop: 2 }} />
                <div><b>เจ้าหน้าที่จัดส่งให้บริษัท</b></div>
            </label>
        </div>
    );
}

export const MODAL_CSS = `
  .input { width: 100%; padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: inherit; font-size: 13px; box-sizing: border-box; }
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 12px; }
  .modal-card { background: white; padding: 20px; border-radius: 16px; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
  @media (max-width: 768px) {
    .letter-split { flex-direction: column !important; }
    .letter-preview { flex: none !important; min-height: 280px !important; }
    .letter-sidebar { width: 100% !important; }
  }
`;
