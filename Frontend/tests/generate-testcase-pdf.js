/**
 * generate-testcase-pdf.js
 * สร้าง PDF รายงาน Test Cases โดยใช้ Playwright
 * รัน: node tests/generate-testcase-pdf.js
 * ผลลัพธ์: Frontend/TESTCASES.pdf
 */

import { chromium } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "..", "TESTCASES.pdf");

const HTML = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Test Cases — Co-op Management System</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Sarabun', 'TH Sarabun New', 'Noto Sans Thai', sans-serif;
    font-size: 10.5pt;
    line-height: 1.6;
    color: #1e293b;
    background: #fff;
    padding: 0;
  }

  /* ── Cover Page ── */
  .cover {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0074B7 100%);
    color: #fff;
    padding: 60px 40px;
    page-break-after: always;
  }
  .cover .badge {
    display: inline-block;
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.3);
    color: #93c5fd;
    font-size: 9pt;
    font-weight: 600;
    letter-spacing: 3px;
    text-transform: uppercase;
    padding: 6px 18px;
    border-radius: 100px;
    margin-bottom: 28px;
  }
  .cover h1 {
    font-size: 28pt;
    font-weight: 800;
    line-height: 1.2;
    margin-bottom: 12px;
    letter-spacing: -0.5px;
  }
  .cover h1 span { color: #60a5fa; }
  .cover .sub {
    font-size: 13pt;
    color: rgba(255,255,255,0.75);
    margin-bottom: 48px;
  }
  .cover .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 32px;
    margin: 0 auto;
    max-width: 400px;
    text-align: left;
  }
  .cover .meta-item label {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: rgba(255,255,255,0.5);
    display: block;
    margin-bottom: 2px;
  }
  .cover .meta-item span {
    font-size: 10pt;
    font-weight: 600;
    color: #e2e8f0;
  }
  .cover .divider {
    width: 60px;
    height: 3px;
    background: #60a5fa;
    border-radius: 2px;
    margin: 36px auto;
  }
  .cover .stats-row {
    display: flex;
    gap: 24px;
    justify-content: center;
    margin-top: 40px;
  }
  .cover .stat-box {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 12px;
    padding: 16px 24px;
    text-align: center;
  }
  .cover .stat-box .num {
    font-size: 26pt;
    font-weight: 800;
    color: #60a5fa;
    line-height: 1;
  }
  .cover .stat-box .lbl {
    font-size: 9pt;
    color: rgba(255,255,255,0.65);
    margin-top: 4px;
  }

  /* ── Content pages ── */
  .content { padding: 30px 36px; }

  h2.section-title {
    font-size: 15pt;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 4px 0;
    padding-bottom: 8px;
    border-bottom: 2.5px solid #0074B7;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h2.section-title .icon { font-size: 16pt; }
  h2.section-title .count {
    margin-left: auto;
    font-size: 9pt;
    font-weight: 600;
    color: #64748b;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    padding: 2px 10px;
    border-radius: 100px;
  }

  .section-block { margin-bottom: 32px; page-break-inside: avoid; }

  /* ── Tables ── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    margin-top: 10px;
  }
  th {
    background: #0f172a;
    color: #fff;
    font-weight: 700;
    padding: 7px 10px;
    text-align: left;
    letter-spacing: 0.3px;
  }
  th:first-child { border-radius: 6px 0 0 0; width: 70px; }
  th:last-child  { border-radius: 0 6px 0 0; }
  td {
    padding: 6px 10px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #f8fafc; }
  tr:last-child td { border-bottom: none; }
  tr:last-child td:first-child { border-radius: 0 0 0 6px; }
  tr:last-child td:last-child  { border-radius: 0 0 6px 0; }

  .tid {
    font-family: 'Courier New', monospace;
    font-size: 8pt;
    font-weight: 700;
    color: #0074B7;
    white-space: nowrap;
  }
  .pass-badge {
    display: inline-block;
    background: #dcfce7;
    color: #166534;
    font-size: 7.5pt;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 100px;
    border: 1px solid #bbf7d0;
  }

  /* ── Summary card ── */
  .summary-section { margin-top: 24px; page-break-inside: avoid; }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin: 12px 0 20px;
  }
  .summary-card {
    border-radius: 10px;
    padding: 14px 16px;
    border: 1px solid;
    text-align: center;
  }
  .summary-card.student { background: #eff6ff; border-color: #bfdbfe; }
  .summary-card.admin   { background: #f0fdf4; border-color: #bbf7d0; }
  .summary-card.teacher { background: #fdf4ff; border-color: #e9d5ff; }
  .summary-card .num {
    font-size: 24pt;
    font-weight: 800;
    line-height: 1;
  }
  .summary-card.student .num { color: #1d4ed8; }
  .summary-card.admin   .num { color: #15803d; }
  .summary-card.teacher .num { color: #7e22ce; }
  .summary-card .role {
    font-size: 9pt;
    font-weight: 600;
    margin-top: 4px;
    color: #475569;
  }
  .summary-card .file {
    font-size: 7.5pt;
    color: #94a3b8;
    margin-top: 2px;
    font-family: 'Courier New', monospace;
  }

  .total-row {
    background: #0f172a;
    color: #fff;
    border-radius: 10px;
    padding: 14px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11pt;
    font-weight: 700;
  }
  .total-row span { font-size: 16pt; font-weight: 800; color: #60a5fa; }

  /* ── Coverage table ── */
  .coverage-table td:nth-child(1) { width: 30%; font-weight: 600; }
  .coverage-table td:nth-child(2) { width: 50%; }
  .check { color: #16a34a; font-weight: 700; }
  .cross { color: #dc2626; font-weight: 700; }

  /* ── Strategy table ── */
  .strategy-table td:nth-child(1) { font-weight: 700; color: #0074B7; width: 28%; }

  /* ── Page break helpers ── */
  .page-break { page-break-before: always; }

  /* ── Info box ── */
  .info-box {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-left: 4px solid #0074B7;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 9pt;
    color: #1e40af;
    margin-bottom: 20px;
  }
  .info-box strong { font-weight: 700; }

  /* ── Bug fix highlight ── */
  .bug-box {
    background: #fff7ed;
    border: 1px solid #fed7aa;
    border-left: 4px solid #f97316;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 9pt;
    color: #7c2d12;
    margin-top: 16px;
  }
  .bug-box strong { font-weight: 700; color: #ea580c; }

  /* ── Footer ── */
  @page { margin: 15mm 14mm; }
</style>
</head>
<body>

<!-- ══════════════════════════ COVER ══════════════════════════ -->
<div class="cover">
  <div class="badge">📋 Test Documentation</div>
  <h1>Test Cases<br/><span>Co-op Management System</span></h1>
  <p class="sub">UI Automated Tests — Playwright Framework</p>
  <div class="divider"></div>
  <div class="meta-grid">
    <div class="meta-item"><label>วันที่จัดทำ</label><span>28 พฤษภาคม 2569</span></div>
    <div class="meta-item"><label>Framework</label><span>Playwright v1.60</span></div>
    <div class="meta-item"><label>ขอบเขต</label><span>UI Tests — 4 Roles</span></div>
    <div class="meta-item"><label>สถานะ</label><span>✅ All Pass</span></div>
    <div class="meta-item"><label>Project</label><span>วิทยาลัยการคอมพิวเตอร์ มข.</span></div>
    <div class="meta-item"><label>Browser</label><span>Chromium (Desktop)</span></div>
  </div>
  <div class="stats-row">
    <div class="stat-box"><div class="num">64</div><div class="lbl">Test Cases</div></div>
    <div class="stat-box"><div class="num">4</div><div class="lbl">User Roles</div></div>
    <div class="stat-box"><div class="num">100%</div><div class="lbl">Pass Rate</div></div>
  </div>
</div>

<!-- ══════════════════════════ CONTENT ══════════════════════════ -->
<div class="content">

  <!-- ── Overview ── -->
  <div class="info-box">
    <strong>หมายเหตุสำคัญ:</strong> ทุก test ใช้ <em>API mocking</em> ผ่าน <code>page.route()</code>
    และ inject JWT token ผ่าน <code>localStorage</code> — สามารถรันได้โดยไม่ต้องพึ่ง backend จริง
    ยังไม่รวม Login flow, Form submission, และ API error handling (pending)
  </div>

  <!-- ── Strategy ── -->
  <div class="section-block">
    <h2 class="section-title"><span class="icon">⚙️</span> กลยุทธ์การทดสอบ</h2>
    <table class="strategy-table">
      <thead><tr><th>กลยุทธ์</th><th>รายละเอียด</th></tr></thead>
      <tbody>
        <tr><td>Token injection</td><td>inject <code>coop.token</code> ใน <code>localStorage</code> ผ่าน <code>page.addInitScript()</code> ก่อน page load</td></tr>
        <tr><td>API mocking</td><td>ใช้ <code>page.route()</code> ดัก URL pattern ทุก <code>/api/**</code> คืนค่า mock JSON (LIFO strategy)</td></tr>
        <tr><td>Backend independence</td><td>ทุก test รันได้โดยไม่ต้องเปิด backend/database จริง</td></tr>
        <tr><td>Auth guard test</td><td>test แยกสำหรับกรณีไม่มี token — ตรวจว่า redirect ไป <code>/</code> ได้ถูกต้อง</td></tr>
        <tr><td>Mobile viewport</td><td>Sidebar tests ใช้ viewport 768×1024 เพราะ hamburger button แสดงเฉพาะ mobile (≤768px)</td></tr>
      </tbody>
    </table>
  </div>

  <!-- ══════ STUDENT ══════ -->
  <div class="section-block">
    <h2 class="section-title">
      <span class="icon">👨‍🎓</span> Student Role — <code>/student/*</code>
      <span class="count">19 test cases</span>
    </h2>
    <table>
      <thead>
        <tr><th>Test ID</th><th>ชื่อ Test Case</th><th>เงื่อนไขเริ่มต้น</th><th>ขั้นตอน</th><th>ผลที่คาดหวัง</th><th>สถานะ</th></tr>
      </thead>
      <tbody>
        <tr><td class="tid">TC-S-00</td><td>/student/ redirect</td><td>มี token ใน localStorage</td><td>navigate ไป <code>/student/</code></td><td>redirect ไป <code>/student/dashboard</code></td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-01</td><td>Dashboard หน้าหลัก</td><td>มี token</td><td>navigate ไป <code>/student/dashboard</code></td><td>topbar แสดง, URL อยู่ที่ <code>/student/</code></td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-02</td><td>โปรไฟล์นักศึกษา</td><td>มี token</td><td>navigate ไป <code>/student/profile</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-03</td><td>Gateway (สมัครสหกิจ)</td><td>มี token</td><td>navigate ไป <code>/student/gateway</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-04</td><td>บันทึกประจำวัน</td><td>มี token</td><td>navigate ไป <code>/student/daily</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-05</td><td>หน้าเอกสาร</td><td>มี token</td><td>navigate ไป <code>/student/docs</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-06</td><td>ข้อมูลบริษัท</td><td>มี token</td><td>navigate ไป <code>/student/company</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-07</td><td>ฟอร์มเอกสาร T002</td><td>มี token</td><td>navigate ไป <code>/student/docs-t002</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-08</td><td>ฟอร์มเอกสาร T003</td><td>มี token</td><td>navigate ไป <code>/student/docs-t003</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-09</td><td>หน้านิเทศ</td><td>มี token</td><td>navigate ไป <code>/student/supervision</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-10</td><td>Status Tracker</td><td>มี token</td><td>navigate ไป <code>/student/status-tracker</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-11</td><td>เอกสาร T005/T006</td><td>มี token</td><td>navigate ไป <code>/student/doc-t005-006</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-12</td><td>เอกสาร T007</td><td>มี token</td><td>navigate ไป <code>/student/doc-t007</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-13</td><td>เอกสาร T008</td><td>มี token</td><td>navigate ไป <code>/student/doc-t008</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-14</td><td>Sidebar hamburger</td><td>มี token, viewport 768px</td><td>navigate dashboard → คลิก hamburger</td><td><code>aside.sidebar</code> มี class <code>open</code></td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-15</td><td>ปุ่ม Logout</td><td>มี token</td><td>navigate ไป dashboard</td><td>ปุ่ม <code>aria-label="ออกจากระบบ"</code> มองเห็นได้</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-16</td><td>ไม่มี token → redirect</td><td>ไม่มี token</td><td>navigate ไป <code>/student/dashboard</code></td><td>redirect กลับไป <code>/</code> (login)</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-17</td><td>Daily มี content</td><td>มี token</td><td>navigate ไป daily</td><td><code>&lt;main&gt;</code> แสดงเนื้อหา</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-S-18</td><td>โลโก้ Co-op</td><td>มี token</td><td>navigate ไป dashboard</td><td><code>img[alt="Co-op Logo"]</code> แสดงได้</td><td><span class="pass-badge">PASS</span></td></tr>
      </tbody>
    </table>
  </div>

  <!-- ══════ ADMIN ══════ -->
  <div class="section-block page-break">
    <h2 class="section-title">
      <span class="icon">🔧</span> Admin / Staff Role — <code>/admin/*</code>
      <span class="count">27 test cases</span>
    </h2>
    <table>
      <thead>
        <tr><th>Test ID</th><th>ชื่อ Test Case</th><th>เงื่อนไขเริ่มต้น</th><th>ขั้นตอน</th><th>ผลที่คาดหวัง</th><th>สถานะ</th></tr>
      </thead>
      <tbody>
        <tr><td class="tid">TC-A-00</td><td>/admin/ redirect</td><td>มี token</td><td>navigate ไป <code>/admin</code></td><td>redirect ไป <code>/admin/dashboard</code></td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-01</td><td>Dashboard</td><td>มี token</td><td>navigate ไป <code>/admin/dashboard</code></td><td>topbar แสดง, URL อยู่ที่ <code>/admin/</code></td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-02</td><td>จัดการนักศึกษา</td><td>มี token</td><td>navigate ไป <code>/admin/students</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-03</td><td>จัดการพี่เลี้ยง</td><td>มี token</td><td>navigate ไป <code>/admin/mentors</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-04</td><td>จัดการบริษัท</td><td>มี token</td><td>navigate ไป <code>/admin/company</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-05</td><td>หน้าเอกสาร</td><td>มี token</td><td>navigate ไป <code>/admin/docs</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-06</td><td>บันทึกประจำวัน</td><td>มี token</td><td>navigate ไป <code>/admin/daily</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-07</td><td>ประกาศข่าวสาร</td><td>มี token</td><td>navigate ไป <code>/admin/announcements</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-08</td><td>ตั้งค่าระบบ</td><td>มี token</td><td>navigate ไป <code>/admin/settings</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-09</td><td>จัดการอาจารย์</td><td>มี token</td><td>navigate ไป <code>/admin/teachers</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-10</td><td>เกณฑ์คะแนน</td><td>มี token</td><td>navigate ไป <code>/admin/criteria</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-11</td><td>เอกสาร T000</td><td>มี token</td><td>navigate ไป <code>/admin/doct000</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-12</td><td>ตรวจ T002</td><td>มี token</td><td>navigate ไป <code>/admin/doct002</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-13</td><td>ตรวจ T003</td><td>มี token</td><td>navigate ไป <code>/admin/doct003</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-14</td><td>จัดการรอบสหกิจ</td><td>มี token</td><td>navigate ไป <code>/admin/coop-period</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-15</td><td>ใบสมัครสหกิจ</td><td>มี token</td><td>navigate ไป <code>/admin/coop-applications</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-16</td><td>จัดการนิเทศ</td><td>มี token</td><td>navigate ไป <code>/admin/supervision-manager</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-17</td><td>เอกสาร T005/T006</td><td>มี token</td><td>navigate ไป <code>/admin/doc-t005-006</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-18</td><td>เอกสาร T007</td><td>มี token</td><td>navigate ไป <code>/admin/doc-t007</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-19</td><td>เอกสาร T008</td><td>มี token</td><td>navigate ไป <code>/admin/doc-t008</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-20</td><td>ข้อกำหนดเอกสาร</td><td>มี token</td><td>navigate ไป <code>/admin/doc-requirements</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-21</td><td>ไม่มี token → redirect</td><td>ไม่มี token</td><td>navigate ไป <code>/admin/dashboard</code></td><td>redirect กลับไป <code>/</code> (login)</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-22</td><td>แสดงชื่อ admin</td><td>มี token</td><td>navigate ไป dashboard</td><td><code>.user-name</code> มีข้อความ (email/ชื่อ)</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-23</td><td>Students มี content</td><td>มี token</td><td>navigate ไป students</td><td><code>&lt;main&gt;</code> แสดงได้</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-24</td><td>ปุ่ม Logout</td><td>มี token</td><td>navigate ไป dashboard</td><td>ปุ่ม <code>aria-label="ออกจากระบบ"</code> มองเห็น</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-25</td><td>โลโก้ Co-op</td><td>มี token</td><td>navigate ไป dashboard</td><td><code>img[alt="Co-op Logo"]</code> แสดงได้</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-A-26</td><td>URL ไม่ถูกต้อง</td><td>มี token</td><td>navigate ไป <code>/admin/nonexistent-page</code></td><td>redirect ไป <code>/admin/dashboard</code></td><td><span class="pass-badge">PASS</span></td></tr>
      </tbody>
    </table>
  </div>

  <!-- ══════ TEACHER ══════ -->
  <div class="section-block page-break">
    <h2 class="section-title">
      <span class="icon">👩‍🏫</span> Teacher Role — <code>/teacher/*</code>
      <span class="count">18 test cases</span>
    </h2>
    <table>
      <thead>
        <tr><th>Test ID</th><th>ชื่อ Test Case</th><th>เงื่อนไขเริ่มต้น</th><th>ขั้นตอน</th><th>ผลที่คาดหวัง</th><th>สถานะ</th></tr>
      </thead>
      <tbody>
        <tr><td class="tid">TC-T-00</td><td>/teacher/ redirect</td><td>มี token</td><td>navigate ไป <code>/teacher</code></td><td>redirect ไป <code>/teacher/dashboard</code></td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-01</td><td>Dashboard</td><td>มี token</td><td>navigate ไป <code>/teacher/dashboard</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-02</td><td>Requests</td><td>มี token</td><td>navigate ไป <code>/teacher/requests</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-03</td><td>รายชื่อนักศึกษา</td><td>มี token</td><td>navigate ไป <code>/teacher/students</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-04</td><td>การสอบ</td><td>มี token</td><td>navigate ไป <code>/teacher/exams</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-05</td><td>โปรไฟล์อาจารย์</td><td>มี token</td><td>navigate ไป <code>/teacher/profile</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-06</td><td>ตรวจ T002</td><td>มี token</td><td>navigate ไป <code>/teacher/review-t002</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-07</td><td>ตรวจ T003</td><td>มี token</td><td>navigate ไป <code>/teacher/review-t003</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-08</td><td>ตรวจบันทึกนิเทศ</td><td>มี token</td><td>navigate ไป <code>/teacher/review-supervision</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-09</td><td>เอกสาร T005/T006</td><td>มี token</td><td>navigate ไป <code>/teacher/doc-t005-006</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-10</td><td>เอกสาร T007</td><td>มี token</td><td>navigate ไป <code>/teacher/doc-t007</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-11</td><td>เอกสาร T008</td><td>มี token</td><td>navigate ไป <code>/teacher/doc-t008</code></td><td>topbar แสดง, ไม่ redirect</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-12</td><td>ไม่มี token</td><td>ไม่มี token</td><td>navigate ไป <code>/teacher/dashboard</code></td><td>Teacher App แสดง fallback "อาจารย์" (ไม่ redirect)</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-13</td><td>แสดงชื่ออาจารย์</td><td>มี token + profile ใน localStorage</td><td>navigate ไป dashboard</td><td><code>.user-name</code> มีชื่ออาจารย์</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-14</td><td>Students มี content</td><td>มี token</td><td>navigate ไป students</td><td><code>&lt;main&gt;</code> แสดงได้</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-15</td><td>ปุ่ม Logout</td><td>มี token</td><td>navigate ไป dashboard</td><td>ปุ่ม <code>aria-label="ออกจากระบบ"</code> มองเห็น</td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-16</td><td>URL ไม่ถูกต้อง</td><td>มี token</td><td>navigate ไป <code>/teacher/unknown</code></td><td>redirect ไป <code>/teacher/dashboard</code></td><td><span class="pass-badge">PASS</span></td></tr>
        <tr><td class="tid">TC-T-17</td><td>Sidebar hamburger</td><td>มี token, viewport 768px</td><td>navigate dashboard → คลิก hamburger</td><td><code>aside.sidebar</code> มี class <code>open</code></td><td><span class="pass-badge">PASS</span></td></tr>
      </tbody>
    </table>
  </div>

  <!-- ══════ SUMMARY ══════ -->
  <div class="summary-section page-break">
    <h2 class="section-title"><span class="icon">📊</span> สรุปจำนวน Test Cases</h2>
    <div class="summary-grid">
      <div class="summary-card student">
        <div class="num">19</div>
        <div class="role">👨‍🎓 Student</div>
        <div class="file">student.spec.ts</div>
      </div>
      <div class="summary-card admin">
        <div class="num">27</div>
        <div class="role">🔧 Admin/Staff</div>
        <div class="file">admin.spec.ts</div>
      </div>
      <div class="summary-card teacher">
        <div class="num">18</div>
        <div class="role">👩‍🏫 Teacher</div>
        <div class="file">teacher.spec.ts</div>
      </div>
    </div>
    <div class="total-row">
      <span>รวมทั้งหมด — ผ่านทุก test</span>
      <span>64 / 64 ✅</span>
    </div>

    <!-- Coverage -->
    <br/>
    <h2 class="section-title"><span class="icon">🎯</span> ขอบเขตการทดสอบ (Coverage)</h2>
    <table class="coverage-table" style="margin-top:10px">
      <thead><tr><th>ประเภท</th><th>รายละเอียด</th><th>สถานะ</th></tr></thead>
      <tbody>
        <tr><td>Page load</td><td>ทุกหน้าโหลดได้ ไม่ crash — ตรวจผ่าน topbar selector</td><td><span class="check">✅ ครบ</span></td></tr>
        <tr><td>Auth guard (with token)</td><td>มี token → เข้าถึงหน้าได้ปกติ ไม่ redirect ออก</td><td><span class="check">✅ ครบ</span></td></tr>
        <tr><td>Auth guard (no token)</td><td>ไม่มี token → redirect ไป <code>/</code> (Admin/Student)</td><td><span class="check">✅ ครบ</span></td></tr>
        <tr><td>Redirect fallback</td><td>URL ไม่ถูกต้อง → redirect ไป <code>/role/dashboard</code></td><td><span class="check">✅ ครบ</span></td></tr>
        <tr><td>UI layout</td><td>topbar, logo <code>img</code>, logout button, sidebar (<code>aside.sidebar.open</code>)</td><td><span class="check">✅ ครบ</span></td></tr>
        <tr><td>Role root redirect</td><td><code>/role/</code> → <code>/role/dashboard</code> ทุก role</td><td><span class="check">✅ ครบ</span></td></tr>
        <tr><td>Login flow</td><td>ทดสอบ form submit, credentials validation</td><td><span class="cross">⏳ Pending</span></td></tr>
        <tr><td>Form submission</td><td>ทดสอบ submit เอกสาร T002/T003, บันทึกประจำวัน</td><td><span class="cross">⏳ Pending</span></td></tr>
        <tr><td>API error handling</td><td>ทดสอบ 500, 403, network error</td><td><span class="cross">⏳ Pending</span></td></tr>
      </tbody>
    </table>

    <!-- Bug fixes discovered -->
    <div class="bug-box">
      <strong>🐛 Bug พบระหว่างการเขียน test (แก้ไขแล้ว)</strong><br/>
      <strong>Infinite redirect loop — T_App.tsx wildcard route</strong><br/>
      Navigate ใน wildcard route ใช้ relative path <code>to="dashboard"</code> จาก <code>/teacher/unknown</code>
      → resolve เป็น <code>/teacher/unknown/dashboard</code> → wildcard fire ซ้ำ → loop ไม่จบ<br/>
      <strong>แก้:</strong> เปลี่ยนเป็น absolute path <code>to="/teacher/dashboard"</code>
    </div>
  </div>

</div>
</body>
</html>`;

async function main() {
  console.log("🚀 กำลังสร้าง PDF...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent(HTML, { waitUntil: "networkidle" });

  await page.pdf({
    path: OUTPUT_PATH,
    format: "A4",
    printBackground: true,
    margin: { top: "15mm", right: "14mm", bottom: "15mm", left: "14mm" },
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:8px;color:#94a3b8;width:100%;text-align:right;padding-right:14mm;font-family:sans-serif;">
      Co-op Management System — Test Cases Documentation
    </div>`,
    footerTemplate: `<div style="font-size:8px;color:#94a3b8;width:100%;text-align:center;font-family:sans-serif;">
      <span class="pageNumber"></span> / <span class="totalPages"></span>
    </div>`,
  });

  await browser.close();
  console.log("✅ สร้าง PDF สำเร็จ:", OUTPUT_PATH);
}

main().catch((err) => { console.error("❌ Error:", err); process.exit(1); });
