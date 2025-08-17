import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./components/loginpage";
import StudentApp from "./components/S_App";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      {/* เส้นทางของนักศึกษา */}
      <Route path="/student/*" element={<StudentApp />} />
      {/* กันหลงทาง */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
