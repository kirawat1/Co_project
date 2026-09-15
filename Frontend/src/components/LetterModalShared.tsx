// Frontend/src/components/LetterModalShared.tsx
// Shared components and styles for Issue*Letter modals
import React, { useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import { fmtDate, fmtDateTime } from "../utils/dateFormat";

// ================= รอลงนาม =================
// ดาวน์โหลดร่างหนังสือไปเสนอลงนาม → ป้าย "รอลงนาม" (เห็นเฉพาะเจ้าหน้าที่/อาจารย์ สถานะหลักไม่เปลี่ยน)
// จำเลขที่/วันที่ของร่างไว้ ตอนกลับมาอัปโหลดฉบับลงนามจะเติมให้ตรงกับที่ส่งไปเซ็น

// ร่างที่สร้างแล้ว + เลขที่/วันที่ตอนกดสร้าง (แก้ช่องเลขที่ทีหลังไม่ทำให้ร่างเดิมเปลี่ยน)
export type LetterDraft = { blob: Blob; docNumber: string; docDate: string };

// record = แถวที่เก็บป้าย · prefix = ชื่อช่อง <prefix>PendingAt/DraftNumber/DraftDate
//   หนังสือขอความอนุเคราะห์: student.coop + "reqLetter" · หนังสือส่งตัว: student.coop + "placeLetter" · หนังสือขอนิเทศ: supervision + "letter"
export type LetterPendingTarget = { record: any; prefix: string; endpoint: string; body?: object };

export function letterPendingInfo(record: any, prefix: string) {
    return {
        pendingAt: (record?.[`${prefix}PendingAt`] as string | null) || null,
        draftNumber: (record?.[`${prefix}DraftNumber`] as string | null) || null,
        draftDate: record?.[`${prefix}DraftDate`] ? String(record[`${prefix}DraftDate`]).slice(0, 10) : null,
    };
}

export function useLetterPending({ record, prefix, endpoint, body: baseBody }: LetterPendingTarget) {
    const [info, setInfo] = useState(() => letterPendingInfo(record, prefix));

    const request = (body: object) => apiFetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...baseBody, ...body }),
    });

    // คืน false = ไม่ควรดาวน์โหลด (เลขที่ซ้ำ) · ถ้าบันทึกป้ายไม่สำเร็จด้วยเหตุอื่นยังให้ดาวน์โหลดได้
    const markPending = async (draft: LetterDraft): Promise<boolean> => {
        try {
            const res = await request({ docNumber: draft.docNumber, docDate: draft.docDate });
            const d = await res.json().catch(() => ({}));
            if (res.status === 409) { alert(`❌ ${d.message}`); return false; }
            if (!res.ok) { alert(`⚠️ บันทึกสถานะ "รอลงนาม" ไม่สำเร็จ: ${d.message || res.status} — ดาวน์โหลดไฟล์ต่อได้`); return true; }
            setInfo({ pendingAt: d.pendingAt, draftNumber: d.draftNumber, draftDate: d.draftDate ? String(d.draftDate).slice(0, 10) : null });
        } catch {
            alert('⚠️ บันทึกสถานะ "รอลงนาม" ไม่สำเร็จ — ดาวน์โหลดไฟล์ต่อได้');
        }
        return true;
    };

    const cancelPending = async () => {
        if (!confirm('ยกเลิกสถานะ "รอลงนาม" ของหนังสือนี้? (ใช้เมื่อไม่ได้นำร่างไปเสนอลงนามแล้ว)')) return;
        const res = await request({ cancel: true }).catch(() => null);
        if (!res?.ok) { const d = await res?.json().catch(() => ({})); return alert(`❌ ยกเลิกไม่สำเร็จ: ${d?.message || res?.status || ''}`); }
        setInfo({ pendingAt: null, draftNumber: null, draftDate: null });
    };

    return { ...info, markPending, cancelPending };
}

export function LetterPendingBanner({ pendingAt, draftNumber, draftDate, onCancel }: {
    pendingAt: string | null; draftNumber: string | null; draftDate: string | null; onCancel: () => void;
}) {
    if (!pendingAt) return null;
    return (
        <div style={{ padding: '10px 12px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700 }}>✍️ รอลงนาม</div>
            <div>ดาวน์โหลดร่างไปเมื่อ {fmtDateTime(pendingAt)}</div>
            <div>เลขที่ร่าง: <b>{draftNumber || '— ยังไม่ได้กรอกเลขที่ —'}</b>{draftDate && <> · ลงวันที่ <b>{fmtDate(draftDate)}</b></>}</div>
            <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ opacity: .8 }}>ได้ฉบับลงนามแล้ว แนบไฟล์ในข้อ 3</span>
                <button type="button" onClick={onCancel} style={{ fontSize: 11, color: '#b45309', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', whiteSpace: 'nowrap' }}>ยกเลิกรอลงนาม</button>
            </div>
        </div>
    );
}

// ป้ายในตารางรายชื่อ เช่น "✍️ รอลงนามหนังสือส่งตัว · 14 ก.ย. 2569" (ชี้ดูเลขที่ร่าง)
export function PendingSignBadge({ label, at, draftNumber }: { label: string; at: string; draftNumber?: string | null }) {
    return (
        <div title={draftNumber ? `เลขที่ร่าง ${draftNumber}` : 'ร่างยังไม่ได้กรอกเลขที่'}
            style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 6, padding: '2px 8px', marginTop: 4, whiteSpace: 'nowrap', width: 'fit-content' }}>
            ✍️ {label} · {fmtDate(at)}
        </div>
    );
}

// เลขที่ที่จะบันทึกไม่ตรงกับร่างที่ส่งไปลงนาม → ให้ยืนยันก่อน (กันอัปโหลดไฟล์ผิดคน/ผิดฉบับ)
export function confirmMatchesDraft(draftNumber: string | null, docNo: string): boolean {
    if (!draftNumber || draftNumber === docNo) return true;
    return confirm(`⚠️ เลขที่หนังสือ "${docNo}" ไม่ตรงกับร่างที่ส่งไปลงนาม "${draftNumber}"\nตรวจสอบว่าไฟล์ที่แนบเป็นฉบับที่ถูกต้อง แล้วกดตกลงเพื่อบันทึกต่อ`);
}

function buildAddressLine(c: any): string {
    const parts = [
        c.addressNo && `${c.addressNo}`,
        c.moo && `หมู่ ${c.moo}`,
        c.soi && `ซอย${c.soi}`,
        c.road && `ถนน${c.road}`,
        c.subDistrict && `ต.${c.subDistrict}`,
        c.district && `อ.${c.district}`,
        c.province && `จ.${c.province}`,
        c.zipcode && c.zipcode,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : (c.address || '');
}

export function CompanyAddressBox({ company }: { company: any }) {
    const base: React.CSSProperties = {
        marginTop: 8, padding: '12px 14px', borderRadius: 8, fontSize: 12,
        background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.35)',
        color: 'inherit',
    };
    if (!company) return (
        <div style={{ ...base, background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.35)' }}>
            ⚠️ ไม่พบข้อมูลบริษัทของนักศึกษา
        </div>
    );
    const addrLine = buildAddressLine(company);
    return (
        <div style={base}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: '#38bdf8' }}>📦 ที่อยู่จัดส่ง</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{company.name}</div>
            {addrLine && <div style={{ opacity: 0.85, marginBottom: 2, lineHeight: 1.5 }}>{addrLine}</div>}
            {company.contactPerson && <div style={{ opacity: 0.85, marginBottom: 2 }}>เรียน: {company.contactPerson}</div>}
            {company.phone && <div style={{ opacity: 0.85, marginBottom: 2 }}>โทร: {company.phone}</div>}
            {company.fax && <div style={{ opacity: 0.85 }}>แฟกซ์: {company.fax}</div>}
        </div>
    );
}

export function FileReady({ label, onDownload }: { label: string; onDownload: () => void | Promise<void> }) {
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
                <div><b>นักศึกษาดาวน์โหลด</b></div>
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
  /* Force light mode — document preview must not be affected by app dark theme */
  .modal-backdrop { color-scheme: light; }
  .modal-card { background: #ffffff !important; color: #1e293b !important; }
  .modal-card .input, .modal-card select, .modal-card textarea { background: #f8fafc !important; color: #1e293b !important; border-color: #e2e8f0 !important; }
  .modal-card label { color: #374151 !important; }
  .modal-card h2, .modal-card h3 { color: #0f172a !important; }
`;
