import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./components/loginpage";
import StudentApp from "./components/S_App";
import MentorApp from "./components/M_App";
import AdminApp from "./components/A_App";
import TeacherApp from "./components/T_App";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      {/* นักศึกษา */}
      <Route path="/student/*" element={<StudentApp />} />
      {/* พี่เลี้ยง */}
      <Route path="/mentor/*" element={<MentorApp />} />
      {/* แอดมิน */}
      <Route path="/admin/*" element={<AdminApp />} />
      {/* อาจารย์ */}
      <Route path="/teacher/*" element={<TeacherApp />} />
      {/* กันหลงทาง */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
