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

// ── Global axios interceptors ────────────────────────────────
// Request: inject Authorization header จาก localStorage โดยอัตโนมัติ
// (ครอบคลุม axios ทุกที่ในแอป — ไม่ต้องใส่ header ทีละ call)
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("coop.token");
  if (token && !config.headers["Authorization"]) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// Response: เมื่อ backend คืน 401 → ลบ token และ redirect กลับ login
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("coop.token");
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
