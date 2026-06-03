import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./components/loginpage";
import StudentApp from "./components/S_App";
import AdminApp from "./components/A_App";
import TeacherApp from "./components/T_App";
import StudentTheme from "./components/S_Theme";

export default function App() {
  return (
    <>
      {/* Global theme CSS — must be rendered at root so LoginPage also gets dark mode overrides */}
      <StudentTheme />
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
    </>
  );
}
