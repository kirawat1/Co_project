import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ThemeProvider } from "./components/ThemeContext";
import { ToastProvider } from "./components/Toast";
import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/noto-sans-thai/index.css';
import App from "./App";

// ── Global axios interceptor ─────────────────────────────────
// เมื่อ backend คืน 401 (token หมดอายุ / secret เปลี่ยน)
// ให้ลบ token ออกจาก localStorage แล้ว redirect กลับ login
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("coop.token");
      // ถ้าไม่ได้อยู่หน้า login อยู่แล้ว ให้ redirect
      if (window.location.pathname !== "/") {
        alert("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);
// ─────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  </GoogleOAuthProvider>
);
