// src/components/Sidebar.jsx
import React from 'react';

export default function Sidebar({ route, setRoute, profile }) {
    return (
        <aside className="w-full md:w-64 bg-white border-r">
            <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">สหกิจ | นักศึกษา</h2>
                <p className="text-sm text-gray-500">{profile.name}</p>
            </div>
            <nav className="p-4 space-y-2">
                {['dashboard', 'profile', 'sites', 'documents', 'daily'].map(r => (
                    <NavItem
                        key={r}
                        label={{
                            dashboard: 'Dashboard',
                            profile: 'ข้อมูลนักศึกษา',
                            sites: 'สถานฝึกสหกิจ',
                            documents: 'เอกสารฝึกสหกิจ',
                            daily: 'บันทึกประจำวัน'
                        }[r]}
                        active={route === r}
                        onClick={() => setRoute(r)}
                    />
                ))}
            </nav>
        </aside>
    );
}

function NavItem({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`w-full text-left px-3 py-2 rounded ${active ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
        >
            {label}
        </button>
    );
}
