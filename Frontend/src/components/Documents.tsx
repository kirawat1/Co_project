// src/components/Documents.jsx
import React, { useState } from 'react';

export default function Documents({ documents, setDocuments }) {
    const [selected, setSelected] = useState(null);
    const [file, setFile] = useState(null);

    const onUpload = () => {
        if (!selected || !file) return alert('เลือกเอกสารและไฟล์ก่อน');
        setDocuments(prev => prev.map(d => (d.id === selected ? { ...d, status: 'pending_review' } : d)));
        setFile(null);
        alert('อัพโหลดแล้ว (mock)');
    };

    return (
        <section>
            <h2 className="text-lg font-medium mb-4">เอกสารฝึกสหกิจ (T001-T007)</h2>
            <div className="bg-white p-4 border rounded mb-4">
                <label className="block text-sm mb-2">เลือกแบบฟอร์ม</label>
                <select
                    className="border p-2 w-full rounded mb-2"
                    value={selected || ''}
                    onChange={e => setSelected(e.target.value)}
                >
                    <option value="">-- เลือก --</option>
                    {documents.map(d => (
                        <option key={d.id} value={d.id}>
                            {d.id} - {d.name}
                        </option>
                    ))}
                </select>
                <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} />
                <div className="pt-2">
                    <button onClick={onUpload} className="bg-blue-600 text-white px-4 py-2 rounded mt-2">
                        อัพโหลด (ส่งเป็น PDF)
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {documents.map(d => (
                    <div
                        key={d.id}
                        className="bg-white p-3 border rounded flex items-center justify-between"
                    >
                        <div>
                            <div className="font-medium">
                                {d.id} - {d.name}
                            </div>
                            <div className="text-xs text-gray-500">
                                สถานะ:{' '}
                                <span
                                    className={`px-2 py-0.5 rounded ${d.status === 'approved'
                                        ? 'bg-green-100 text-green-700'
                                        : d.status === 'pending_review'
                                            ? 'bg-yellow-100 text-yellow-700'
                                            : 'bg-gray-100 text-gray-700'
                                        }`}
                                >
                                    {d.status}
                                </span>
                            </div>
                        </div>
                        <div>
                            <button className="text-sm text-blue-600">ดู PDF</button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
