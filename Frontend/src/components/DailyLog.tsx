// src/components/DailyLog.jsx
import { useState, useEffect, useRef } from 'react';

export default function DailyLog({ dailyLogs, setDailyLogs, sites }) {
    const [form, setForm] = useState({ date: '', summary: '', hours: '', supervisor: '', siteId: sites[0]?.id || '' });
    const sigCanvasRef = useRef(null);
    const [sigData, setSigData] = useState(null);

    useEffect(() => {
        if (sites[0]) setForm(f => ({ ...f, siteId: sites[0].id }));
    }, [sites]);

    const saveEntry = () => {
        const entry = { id: Date.now(), ...form, signature: sigData };
        setDailyLogs(prev => [...prev, entry]);
        setForm({ date: '', summary: '', hours: '', supervisor: '', siteId: sites[0]?.id || '' });
        setSigData(null);
        alert('บันทึกแล้ว (mock)');
    };

    // signature canvas logic (same as before)
    useEffect(() => {
        const canvas = sigCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let drawing = false;
        const start = e => {
            drawing = true;
            ctx.beginPath();
            ctx.moveTo(e.offsetX, e.offsetY);
        };
        const move = e => {
            if (!drawing) return;
            ctx.lineTo(e.offsetX, e.offsetY);
            ctx.stroke();
        };
        const end = () => {
            drawing = false;
        };
        canvas.addEventListener('mousedown', start);
        canvas.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);

        // touch support
        const startT = e => {
            e.preventDefault();
            drawing = true;
            const rect = canvas.getBoundingClientRect();
            const t = e.touches[0];
            ctx.beginPath();
            ctx.moveTo(t.clientX - rect.left, t.clientY - rect.top);
        };
        const moveT = e => {
            e.preventDefault();
            if (!drawing) return;
            const rect = canvas.getBoundingClientRect();
            const t = e.touches[0];
            ctx.lineTo(t.clientX - rect.left, t.clientY - rect.top);
            ctx.stroke();
        };
        const endT = () => {
            drawing = false;
        };
        canvas.addEventListener('touchstart', startT);
        canvas.addEventListener('touchmove', moveT);
        window.addEventListener('touchend', endT);

        return () => {
            canvas.removeEventListener('mousedown', start);
            canvas.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', end);
            canvas.removeEventListener('touchstart', startT);
            canvas.removeEventListener('touchmove', moveT);
            window.removeEventListener('touchend', endT);
        };
    }, [sigCanvasRef]);

    const clearSig = () => {
        const c = sigCanvasRef.current;
        if (!c) return;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        setSigData(null);
    };
    const saveSig = () => {
        const c = sigCanvasRef.current;
        if (!c) return;
        const data = c.toDataURL('image/png');
        setSigData(data);
        alert('บันทึกลายเซ็นแล้ว (mock)');
    };

    return (
        <section>
            <h2 className="text-lg font-medium mb-4">บันทึกประจำวัน</h2>
            <div className="bg-white p-4 border rounded mb-4 max-w-2xl">
                <label className="block text-sm">วันที่</label>
                <input
                    type="date"
                    className="border p-2 rounded w-full mb-2"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                />
                <label className="block text-sm">สถานที่ฝึก</label>
                <select
                    className="border p-2 rounded w-full mb-2"
                    value={form.siteId}
                    onChange={e => setForm({ ...form, siteId: e.target.value })}
                >
                    {sites.map(s => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </select>
                <label className="block text-sm">รายงานโดยย่อ</label>
                <textarea
                    className="border p-2 rounded w-full mb-2"
                    rows={3}
                    value={form.summary}
                    onChange={e => setForm({ ...form, summary: e.target.value })}
                />
                <label className="block text-sm">ชั่วโมงฝึก</label>
                <input
                    className="border p-2 rounded w-full mb-2"
                    value={form.hours}
                    onChange={e => setForm({ ...form, hours: e.target.value })}
                />
                <label className="block text-sm">ผู้ควบคุมการฝึกงาน</label>
                <input
                    className="border p-2 rounded w-full mb-2"
                    value={form.supervisor}
                    onChange={e => setForm({ ...form, supervisor: e.target.value })}
                />

                <div className="mt-2">
                    <p className="text-sm mb-2">ลายเซ็นผู้ควบคุม (เซ็นบนกรอบด้านล่าง)</p>
                    <canvas
                        ref={sigCanvasRef}
                        width={600}
                        height={150}
                        className="border w-full mb-2 touch-none"
                    />
                    <div className="flex gap-2">
                        <button onClick={clearSig} className="bg-gray-300 px-3 py-1 rounded">
                            ล้าง
                        </button>
                        <button onClick={saveSig} className="bg-blue-600 text-white px-3 py-1 rounded">
                            บันทึกลายเซ็น
                        </button>
                    </div>
                </div>

                <div className="pt-4">
                    <button onClick={saveEntry} className="bg-green-600 text-white px-4 py-2 rounded">
                        บันทึกประจำวัน
                    </button>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-medium mb-2">รายการบันทึกย้อนหลัง</h3>
                <ul className="space-y-3 max-w-2xl">
                    {dailyLogs.map(log => (
                        <li key={log.id} className="bg-white p-3 border rounded">
                            <div>วันที่: {log.date}</div>
                            <div>สถานที่: {sites.find(s => s.id === log.siteId)?.name || ''}</div>
                            <div>รายงาน: {log.summary}</div>
                            <div>ชั่วโมง: {log.hours}</div>
                            <div>ผู้ควบคุม: {log.supervisor}</div>
                            {log.signature && <img src={log.signature} alt="Signature" className="mt-2 max-h-20" />}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
