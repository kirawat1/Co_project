import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./components/loginpage";
import StudentApp from "./components/S_App";
import MentorApp from "./components/M_App";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      {/* เส้นทางของนักศึกษา */}
      <Route path="/student/*" element={<StudentApp />} />
      {/* เส้นทางของพี่เลี้ยง */}
      <Route path="/mentor/*" element={<MentorApp />} />
      {/* กันหลงทาง */}
      <Route path="*" element={<Navigate to="/mentor/dashboard" replace/>} />

    </Routes>
  );
}
