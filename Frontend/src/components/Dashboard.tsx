// src/components/Dashboard.jsx
import React from 'react';

export default function Dashboard({ announcements }) {
    return (
        <section>
            <h2 className="text-lg font-medium mb-3">ประกาศจากแอดมิน</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {announcements.map(a => (
                    <article key={a.id} className="p-4 bg-white border rounded">
                        <h3 className="font-medium">{a.title}</h3>
                        <p className="text-xs text-gray-500 mt-2">{a.date}</p>
                    </article>
                ))}
            </div>
        </section>
    );
}
