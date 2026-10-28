import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./components/loginpage";
import { LoadingBlock } from "./components/Spinner";
import StudentTheme from "./components/S_Theme";

// หน้าในส่วนนี้โหลดตอนเปิดหน้านั้น (แบ่งไฟล์ — ไม่ต้องโหลดทุกหน้า/ไลบรารี PDF/Excel ตั้งแต่แรก)
const StudentApp = lazy(() => import("./components/S_App"));
const AdminApp = lazy(() => import("./components/A_App"));
const TeacherApp = lazy(() => import("./components/T_App"));

export default function App() {
  return (
    <>
      {/* Global theme CSS — must be rendered at root so LoginPage also gets dark mode overrides */}
      <StudentTheme />
      <Suspense fallback={<LoadingBlock text="กำลังโหลด…" style={{ padding: 24 }} />}>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        {/* นักศึกษา */}
        <Route path="/student/*" element={<StudentApp />} />
        {/* แอดมิน */}
        <Route path="/admin/*" element={<AdminApp />} />
        {/* อาจารย์ */}
        <Route path="/teacher/*" element={<TeacherApp />} />
        {/* กันหลงทาง */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  );
}
