// src/App.jsx

import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./components/Dashboard";
import ProfileView from "./components/ProfileView";
import CoopSites, { type CoopSitesProps } from "./components/CoopSites";
import Documents from "./components/Documents";
import DailyLog from "./components/DailyLog";


export default function App() {
  const [route, setRoute] = useState('dashboard');

  const [profile, setProfile] = useState({
    name: 'นาย สหกิจ',
    studentId: '6512345678',
    email: 'student@example.com',
    phone: '0812345678',
  });

  const [announcements] = useState([
    { id: 1, title: 'เปิดลงทะเบียนฝึกสหกิจ', date: '2024-08-01' },
    { id: 2, title: 'วันรายงานตัวฝึกสหกิจ', date: '2024-08-10' },
  ]);

  const [sites, setSites] = useState<CoopSitesProps['sites']>([
    { id: 'site1', name: 'บริษัท เอ จำกัด', address: 'ถนนสุขสวัสดิ์', email: 'contact@a.co', phone: '022345678' },
    { id: 'site2', name: 'บริษัท บี จำกัด', address: 'ถนนพระราม 9', email: 'contact@b.co', phone: '022345679' },
  ]);

  const [documents, setDocuments] = useState([
    { id: 'T001', name: 'แบบฟอร์ม T001', status: 'approved' },
    { id: 'T002', name: 'แบบฟอร์ม T002', status: 'not_uploaded' },
    { id: 'T003', name: 'แบบฟอร์ม T003', status: 'pending_review' },
  ]);

  const [dailyLogs, setDailyLogs] = useState([]);

  return (
    <div className="flex min-h-screen bg-gray-100 text-gray-800">
      <Sidebar route={route} setRoute={setRoute} profile={profile} />
      <main className="flex-1 p-6">
        <Header profile={profile} />
        {route === 'dashboard' && <Dashboard announcements={announcements} />}
        {route === 'profile' && <ProfileView profile={profile} setProfile={setProfile} />}
        {route === 'sites' && <CoopSites sites={sites} setSites={setSites} />}
        {route === 'documents' && <Documents documents={documents} setDocuments={setDocuments} />}
        {route === 'daily' && <DailyLog dailyLogs={dailyLogs} setDailyLogs={setDailyLogs} sites={sites} />}
      </main>
    </div>
  );
}
