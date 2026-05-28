/**
 * kkuRegService.js — KKU Registration API v1.2 Proxy Service
 *
 * ต้องตั้งค่าใน .env:
 *   KKU_REG_BASE_URL=https://reg2.kku.ac.th/api/v1.2
 *   KKU_REG_CLIENT_ID=<ขอจาก kritssa@kku.ac.th>
 *   KKU_REG_CLIENT_SECRET=<ขอจาก kritssa@kku.ac.th>
 *
 * ถ้า env ยังไม่มี → ทุก function คืน null (graceful fallback)
 */

const axios = require("axios");

const BASE_URL = process.env.KKU_REG_BASE_URL || "https://reg2.kku.ac.th/api/v1.2";
const CLIENT_ID = process.env.KKU_REG_CLIENT_ID;
const CLIENT_SECRET = process.env.KKU_REG_CLIENT_SECRET;

// ──────────────────────────────────────────
// ตรวจสอบว่า credentials พร้อมใช้หรือยัง
// ──────────────────────────────────────────
function isConfigured() {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

// ──────────────────────────────────────────
// 1. Login ด้วย REG account (username + password)
//    ไม่ต้องมี CLIENT_ID/SECRET — ใช้ endpoint นี้ได้เลย
// ──────────────────────────────────────────
async function getStudentToken(username, password) {
  try {
    const res = await axios.post(
      `${BASE_URL}/auth/login/reg-account`,
      { username, password },
      { timeout: 10000 }
    );
    // KKU REG คืน access_token ใน response body
    return res.data?.access_token || res.data?.token || null;
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message;
    console.error(`[KKU REG] getStudentToken error (${status}):`, msg);
    // คืน error message เพื่อให้ caller แสดงผลถูกต้อง
    if (status === 401 || status === 400) return { error: "username หรือ password ไม่ถูกต้อง" };
    if (status === 429) return { error: "คำขอมากเกินไป กรุณารอแล้วลองใหม่" };
    return { error: "ไม่สามารถเชื่อมต่อ KKU REG ได้ในขณะนี้" };
  }
}

// ──────────────────────────────────────────
// 2. ดึงข้อมูลส่วนตัวนักศึกษา
// ──────────────────────────────────────────
async function getStudentInfo(accessToken) {
  if (!accessToken) return null;
  try {
    const res = await axios.get(`${BASE_URL}/student/info`, {
      headers: { "x-access-token": accessToken },
      timeout: 8000,
    });
    return res.data || null;
  } catch (err) {
    console.error("[KKU REG] getStudentInfo error:", err.response?.data || err.message);
    return null;
  }
}

// ──────────────────────────────────────────
// 3. ดึง GPA สะสมและหน่วยกิต
// ──────────────────────────────────────────
async function getGradeSummary(accessToken) {
  if (!accessToken) return null;
  try {
    const res = await axios.get(`${BASE_URL}/student/get_grade_summary`, {
      headers: { "x-access-token": accessToken },
      timeout: 8000,
    });
    return res.data || null;
  } catch (err) {
    console.error("[KKU REG] getGradeSummary error:", err.response?.data || err.message);
    return null;
  }
}

// ──────────────────────────────────────────
// 4. ดึงชื่ออาจารย์ที่ปรึกษา
// ──────────────────────────────────────────
async function getAdvisor(accessToken) {
  if (!accessToken) return null;
  try {
    const res = await axios.get(`${BASE_URL}/student/get_advisor`, {
      headers: { "x-access-token": accessToken },
      timeout: 8000,
    });
    return res.data || null;
  } catch (err) {
    console.error("[KKU REG] getAdvisor error:", err.response?.data || err.message);
    return null;
  }
}

// ──────────────────────────────────────────
// 5. ดึงรูปถ่ายนักศึกษา (base64)
// ──────────────────────────────────────────
async function getStudentImage(accessToken) {
  if (!accessToken) return null;
  try {
    const res = await axios.get(`${BASE_URL}/student/get_student_image`, {
      headers: { "x-access-token": accessToken },
      timeout: 10000,
    });
    return res.data?.image || res.data?.base64 || null;
  } catch (err) {
    console.error("[KKU REG] getStudentImage error:", err.response?.data || err.message);
    return null;
  }
}

// ──────────────────────────────────────────
// 6. ดึงหน่วยกิตกิจกรรม
// ──────────────────────────────────────────
async function getCreditCondition(accessToken, acadYear, semester) {
  if (!accessToken) return null;
  try {
    const res = await axios.get(
      `${BASE_URL}/student/enroll_credit_condition/${acadYear}/${semester}`,
      { headers: { "x-access-token": accessToken }, timeout: 8000 }
    );
    return res.data || null;
  } catch (err) {
    console.error("[KKU REG] getCreditCondition error:", err.response?.data || err.message);
    return null;
  }
}

// ──────────────────────────────────────────
// 7. ดึงภาคเรียนปัจจุบัน (ไม่ต้องใช้ token)
// ──────────────────────────────────────────
async function getCurrentSemester() {
  if (!isConfigured()) return null;
  try {
    const res = await axios.get(`${BASE_URL}/other/academic/get_current_semester`, {
      timeout: 8000,
    });
    return res.data || null;
  } catch (err) {
    console.error("[KKU REG] getCurrentSemester error:", err.response?.data || err.message);
    return null;
  }
}

// ──────────────────────────────────────────
// 8. ดึงประวัติเกรดทุกวิชา (ใช้ตรวจ requiredCourses / coreCourses)
//    NOTE: ยืนยัน endpoint กับ KKU REG API docs ก่อน deploy
//    ลองใช้ student/enroll_list (ไม่มี year/sem = ทุก semester)
// ──────────────────────────────────────────
async function getGradeList(accessToken) {
  if (!accessToken) return null;
  try {
    const res = await axios.get(`${BASE_URL}/student/enroll_list`, {
      headers: { "x-access-token": accessToken },
      timeout: 12000,
    });
    return (
      res.data?.data?.enroll_list ||
      res.data?.enroll_list ||
      res.data?.data ||
      null
    );
  } catch (err) {
    console.error("[KKU REG] getGradeList error:", err.response?.data || err.message);
    return null;
  }
}

// ──────────────────────────────────────────
// 9. ค้นหาวิชาจาก KKU course catalog (สำหรับ Admin เลือกวิชาในเกณฑ์)
//    NOTE: ยืนยัน endpoint กับ KKU REG API docs ก่อน deploy
// ──────────────────────────────────────────
async function searchCourses(query) {
  if (!query || query.length < 2) return [];
  if (!isConfigured()) return [];
  try {
    const tokenRes = await axios.post(
      `${BASE_URL}/auth/token`,
      { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: "client_credentials" },
      { timeout: 8000 }
    );
    const serviceToken = tokenRes.data?.access_token || null;

    const res = await axios.get(`${BASE_URL}/course/search`, {
      params: { keyword: query },
      headers: serviceToken ? { "x-access-token": serviceToken } : {},
      timeout: 8000,
    });
    return res.data?.data || res.data?.courses || res.data || [];
  } catch (err) {
    console.error("[KKU REG] searchCourses error:", err.response?.data || err.message);
    return [];
  }
}

// ──────────────────────────────────────────
// Composite: ดึงทุกอย่างในครั้งเดียว
// คืน { info, grades, advisor, image } หรือ field ที่ได้
// ──────────────────────────────────────────
async function syncStudentAll(username, password) {
  const token = await getStudentToken(username, password);
  if (!token) return { ok: false, message: "ไม่สามารถเชื่อมต่อ KKU REG ได้ — ตรวจสอบ username/password" };

  const [info, grades, advisor, image] = await Promise.allSettled([
    getStudentInfo(token),
    getGradeSummary(token),
    getAdvisor(token),
    getStudentImage(token),
  ]);

  return {
    ok: true,
    info:    info.status    === "fulfilled" ? info.value    : null,
    grades:  grades.status  === "fulfilled" ? grades.value  : null,
    advisor: advisor.status === "fulfilled" ? advisor.value : null,
    image:   image.status   === "fulfilled" ? image.value   : null,
  };
}

module.exports = {
  isConfigured,
  getStudentToken,
  getStudentInfo,
  getGradeSummary,
  getAdvisor,
  getStudentImage,
  getCreditCondition,
  getCurrentSemester,
  syncStudentAll,
  getGradeList,    // NEW
  searchCourses,   // NEW
};
