// src/components/ProfileView.jsx
import React, { useState, useEffect } from 'react';

export default function ProfileView({ profile, setProfile }) {
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState(profile);

    useEffect(() => setForm(profile), [profile]);

    const save = () => {
        setProfile(form);
        setEditing(false);
    };

    return (
        <section className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium">ข้อมูลนักศึกษา</h2>
                <button onClick={() => setEditing(!editing)} className="text-sm text-blue-600">
                    {editing ? 'ยกเลิก' : 'แก้ไขข้อมูล'}
                </button>
            </div>

            {!editing ? (
                <div className="bg-white p-4 border rounded space-y-2">
                    <p>
                        <span className="font-medium">ชื่อ:</span> {profile.name}
                    </p>
                    <p>
                        <span className="font-medium">รหัส:</span> {profile.studentId}
                    </p>
                    <p>
                        <span className="font-medium">อีเมล:</span> {profile.email}
                    </p>
                    <p>
                        <span className="font-medium">โทร:</span> {profile.phone}
                    </p>
                </div>
            ) : (
                <div className="bg-white p-4 border rounded space-y-3">
                    <label className="block text-sm">ชื่อ</label>
                    <input
                        className="border p-2 w-full rounded"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                    />
                    <label className="block text-sm">อีเมล</label>
                    <input
                        className="border p-2 w-full rounded"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                    />
                    <label className="block text-sm">โทร</label>
                    <input
                        className="border p-2 w-full rounded"
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                    />
                    <div className="pt-2">
                        <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded">
                            บันทึก
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
