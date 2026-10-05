// หน้าต่างออกหนังสือเดี่ยวของนักศึกษาที่อยู่ในหนังสือรวม — เลขที่เดิมใช้กับเพื่อนในฉบับอยู่ ออกเดี่ยวด้วยเลขเดิมไม่ได้ (409)
// → บอกว่าอยู่ฉบับไหนกับใคร และให้เปิดหนังสือรวมทั้งฉบับแทน
interface Props {
    mates: any[];          // นักศึกษาทุกคนในหนังสือรวมฉบับเดิม (รวมคนนี้)
    docNumber?: string | null;
    onOpenBatch?: () => void;
}

export default function LetterBatchNotice({ mates, docNumber, onOpenBatch }: Props) {
    if (mates.length < 2) return null;
    return (
        <div style={{ padding: '10px 12px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 12, color: '#78350f' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>👥 อยู่ในหนังสือรวม{docNumber ? ` เลขที่ ${docNumber}` : ""} ({mates.length} คน)</div>
            {mates.map((m: any) => <div key={m.id}>• {m.studentId} {m.firstName} {m.lastName}</div>)}
            <div style={{ marginTop: 4 }}>พิมพ์ซ้ำด้วยเลขเดิมต้องออกเป็นหนังสือรวมทั้งฉบับ · ออกเดี่ยวต้องใช้เลขที่ใหม่</div>
            {onOpenBatch && (
                <button className="btn" style={{ marginTop: 6, background: '#d97706', color: 'white', fontSize: 12 }} onClick={onOpenBatch}>เปิดหนังสือรวมทั้งฉบับ</button>
            )}
        </div>
    );
}
