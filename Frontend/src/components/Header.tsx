// src/components/Header.jsx
import React from 'react';

export default function Header({ profile }) {
    return (
        <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">สวัสดี, {profile.name}</h1>
            <div className="text-sm text-gray-500">Student ID: {profile.studentId}</div>
        </div>
    );
}
