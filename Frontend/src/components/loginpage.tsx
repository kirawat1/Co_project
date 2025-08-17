// src/components/LoginPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { AuthAPI, validateByRole } from "./api";
import type { Role } from "./api";
import { loadProfile, saveProfile } from "./store";
import coopLogo from "../assets/COOP_Logo.png";

const IOS_BLUE = "#0074B7";
const ROLE_LABEL: Record<Role, string> = { student: "นักศึกษา", staff: "เจ้าหน้าที่", mentor: "พี่เลี้ยง" };
const ALL_ROLES: Role[] = ["student", "staff", "mentor"];

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<Role>("student");

  // กลาง
  const [email, setEmail] = useState("");

  // เข้าสู่ระบบ
  const [password, setPassword] = useState("");

  // สมัคร — นักศึกษา
  const [sFirst, setSFirst] = useState("");
  const [sLast, setSLast] = useState("");
  const [sStdId, setSStdId] = useState("");
  const [sPhone, setSPhone] = useState("");
  const [sGpa, setSGpa] = useState("");
  const [sMajor, setSMajor] = useState("");
  const [sCurr, setSCurr] = useState("");
  const [sNation, setSNation] = useState("");

  // สมัคร — พี่เลี้ยง
  const [mFirst, setMFirst] = useState("");
  const [mLast, setMLast] = useState("");
  const [mPhone, setMPhone] = useState("");

  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const roleText = useMemo(() => ROLE_LABEL[role], [role]);
  const pwdPlaceholder = role === "student" ? "รหัสนักศึกษา 10 หลัก" : "เบอร์โทร 10 หลักขึ้นต้นด้วย 0";

  useEffect(() => { setError(""); setNotice(""); }, [mode, role]);
  // กันบทบาท staff ตอนสมัคร (แม้ปุ่มจะ disabled อยู่แล้ว)
  useEffect(() => { if (mode === "signup" && role === "staff") setRole("student"); }, [mode, role]);

  const onlyDigits = (v: string) => v.replace(/\D/g, "");
  const passwordPattern = role === "student" ? "\\d{10}" : "0\\d{9}";
  // แสดงครบทั้ง 3 บทบาทเสมอ (signup จะ disable staff)
  const rolesForMode: Role[] = ALL_ROLES;

  function validateSignupFields(): string | null {
    const e = email.trim();
    if (!e) return "กรุณากรอกอีเมล";
    if (role === "student") {
      if (!sStdId || sStdId.length !== 10) return "กรุณากรอกรหัสนักศึกษา 10 หลัก";
      if (!sFirst.trim()) return "กรุณากรอกชื่อ";
      if (!sLast.trim()) return "กรุณากรอกนามสกุล";
      if (!sPhone || sPhone.length !== 10 || sPhone[0] !== "0") return "กรุณากรอกเบอร์โทรให้ถูกต้อง";
      if (!sGpa) return "กรุณากรอก GPA";
      const g = Number(sGpa);
      if (Number.isNaN(g) || g < 0 || g > 4) return "GPA ต้องอยู่ระหว่าง 0.00 - 4.00";
      if (!sMajor.trim()) return "กรุณากรอกสาขาวิชา";
      if (!sCurr.trim()) return "กรุณากรอกหลักสูตร";
      if (!sNation.trim()) return "กรุณากรอกสัญชาติ";
    } else if (role === "mentor") {
      if (!mFirst.trim()) return "กรุณากรอกชื่อ";
      if (!mLast.trim()) return "กรุณากรอกนามสกุล";
      if (!mPhone || mPhone.length !== 10 || mPhone[0] !== "0") return "กรุณากรอกเบอร์โทรให้ถูกต้อง";
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setNotice(""); setLoading(true);
    try {
      if (mode === "signin") {
        const err = validateByRole(role, email.trim(), password);
        if (err) throw new Error(err);
        const res = await AuthAPI.signin({ role, email: email.trim(), password });
        if (!res.ok) throw new Error(res.message || "เข้าสู่ระบบไม่สำเร็จ");
        if (remember && res.token) localStorage.setItem("coop.token", res.token);
        setNotice(`เข้าสู่ระบบสำเร็จ: ${res.user?.email} (${res.user?.role})`);
      } else {
        const missing = validateSignupFields();
        if (missing) throw new Error(missing);

        // password ตามบทบาท
        const pwd = role === "student" ? sStdId : mPhone;
        const err = validateByRole(role, email.trim(), pwd);
        if (err) throw new Error(err);

        const res = await AuthAPI.signup({ role, email: email.trim(), password: pwd });
        if (!res.ok) throw new Error(res.message || "สมัครไม่สำเร็จ");

        // seed โปรไฟล์นักศึกษาให้ Student Portal ใช้งานต่อได้เลย
        if (role === "student") {
          const current = loadProfile();
          const next = {
            ...current,
            email: email.trim().toLowerCase(),
            studentId: sStdId,
            firstName: sFirst.trim(),
            lastName: sLast.trim(),
            phone: sPhone,
            gpa: sGpa,
            major: sMajor.trim(),
            curriculum: sCurr.trim(),
            nationality: sNation.trim(),
            religion: current.religion ?? "",
          };
          saveProfile(next);
        }

        setNotice(res.message || "สมัครสำเร็จ");
        setMode("signin");
        // เคลียร์ฟอร์มสมัคร
        setPassword("");
        setSFirst(""); setSLast(""); setSStdId(""); setSPhone(""); setSGpa(""); setSMajor(""); setSCurr(""); setSNation("");
        setMFirst(""); setMLast(""); setMPhone("");
      }
    } catch (er: unknown) {
      setError(er instanceof Error ? er.message : String(er));
    } finally { setLoading(false); }
  }

  return (
    <div className="screen">
      <div className="card">
        {/* Left visual panel (ความกว้างฝั่งซ้ายเท่ากันทุกโหมด) */}
        <div className="panel-left">
          <div className="pill">CP · KKU</div>
          <h1 className="headline">Co-operative:<br/>Computer Science, KKU</h1><br/>
          <ul className="bullets">
            <li>บทบาท: นักศึกษา / เจ้าหน้าที่ / พี่เลี้ยง</li>
            <li><b>สมัคร:</b> นักศึกษา และ พี่เลี้ยง</li>
            <li>username = อีเมล</li>
            <li>password: นักศึกษา = รหัส 10 หลัก · พี่เลี้ยง/เจ้าหน้าที่ = เบอร์ 0XXXXXXXXX</li>
          </ul>
        </div>

        {/* Right form panel */}
        <div className="panel-right">
          <header className="topbar">
            <div className="brand">
              <div className="brand-badge"><img src={coopLogo} alt="Co-op Logo" className="brand-img" /></div>
            </div>
            <div className="switch" role="tablist" aria-label="สลับโหมด">
              <button className={`sw-btn ${mode==="signin"?"active":""}`} onClick={()=>setMode("signin")} type="button">เข้าสู่ระบบ</button>
              <button className={`sw-btn ${mode==="signup"?"active":""}`} onClick={()=>setMode("signup")} type="button">สมัคร</button>
            </div>
          </header>

          <div className="title">
            <h2>{mode==="signin" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</h2>
            <p className="muted">บทบาท: <b>{roleText}</b></p>
          </div>

          {/* Role switch — ในโหมดสมัคร "เจ้าหน้าที่" จะถูก disable */}
          <div className="segment" role="tablist" aria-label="เลือกบทบาท">
            {rolesForMode.map(r=>{
              const disabled = mode==="signup" && r==="staff";
              return (
                <button
                  key={r}
                  className={`seg ${role===r?"active":""} ${disabled?"disabled":""}`}
                  disabled={disabled}
                  aria-disabled={disabled}
                  title={disabled ? "เจ้าหน้าที่สมัครไม่ได้ (เข้าสู่ระบบเท่านั้น)" : undefined}
                  onClick={()=>{ if(!disabled){ setRole(r); setPassword(""); }}}
                  type="button"
                >
                  {ROLE_LABEL[r]}
                </button>
              );
            })}
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="form" noValidate>
            {/* email */}
            <label className="label" htmlFor="email">อีเมล</label>
            <input id="email" className="input" type="email" autoComplete="email" placeholder="name@example.com"
              value={email} onChange={(e)=>setEmail(e.target.value)} required />

            {mode==="signin" ? (
              <>
                <label className="label" htmlFor="password">รหัสผ่าน</label>
                <input
                  id="password" className="input" type="password" inputMode="numeric"
                  placeholder={pwdPlaceholder}
                  value={password} onChange={(e)=>setPassword(onlyDigits(e.target.value))}
                  required pattern={passwordPattern} minLength={10} maxLength={10}
                />
                <label className="remember">
                  <input type="checkbox" checked={remember} onChange={(e)=>setRemember(e.target.checked)} />
                  <span>จดจำฉันไว้</span>
                </label>
              </>
            ) : (
              <>
                {/* SIGNUP FIELDS */}
                {role==="student" && (
                  <div className="grid2">
                    <div>
                      <label className="label" htmlFor="sFirst">ชื่อ</label>
                      <input id="sFirst" className="input" value={sFirst} onChange={e=>setSFirst(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label" htmlFor="sLast">นามสกุล</label>
                      <input id="sLast" className="input" value={sLast} onChange={e=>setSLast(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label" htmlFor="sStdId">รหัสนักศึกษา (10 หลัก)</label>
                      <input id="sStdId" className="input" inputMode="numeric" placeholder="6501234567"
                        value={sStdId} onChange={e=>setSStdId(onlyDigits(e.target.value).slice(0,10))}
                        required pattern="\\d{10}" minLength={10} maxLength={10} />
                    </div>
                    <div>
                      <label className="label" htmlFor="sPhone">เบอร์โทร (0XXXXXXXXX)</label>
                      <input id="sPhone" className="input" inputMode="tel" placeholder="0812345678"
                        value={sPhone} onChange={e=>setSPhone(onlyDigits(e.target.value).slice(0,10))}
                        required pattern="0\\d{9}" minLength={10} maxLength={10} />
                    </div>
                    <div><br />
                      <label className="label" htmlFor="sGpa">เกรด (GPA)</label>
                      <input id="sGpa" className="input" type="number" step="0.01" min={0} max={4}
                        value={sGpa} onChange={e=>setSGpa(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label" htmlFor="sMajor">สาขาวิชา</label>
                      <input id="sMajor" className="input" value={sMajor} onChange={e=>setSMajor(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label" htmlFor="sCurr">หลักสูตร</label>
                      <input id="sCurr" className="input" value={sCurr} onChange={e=>setSCurr(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label" htmlFor="sNation">สัญชาติ</label>
                      <input id="sNation" className="input" value={sNation} onChange={e=>setSNation(e.target.value)} required />
                    </div>
                  </div>
                )}

                {role==="mentor" && (
                  <div className="grid2">
                    <div>
                      <label className="label" htmlFor="mFirst">ชื่อ</label>
                      <input id="mFirst" className="input" value={mFirst} onChange={e=>setMFirst(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label" htmlFor="mLast">นามสกุล</label>
                      <input id="mLast" className="input" value={mLast} onChange={e=>setMLast(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label" htmlFor="mPhone">เบอร์โทร (0XXXXXXXXX)</label>
                      <input id="mPhone" className="input" inputMode="tel" placeholder="0812345678"
                        value={mPhone} onChange={e=>setMPhone(onlyDigits(e.target.value).slice(0,10))}
                        required pattern="0\\d{9}" minLength={10} maxLength={10} />
                    </div>
                  </div>
                )}
              </>
            )}

            <div aria-live="polite">
              {error && <div className="alert error">{error}</div>}
              {notice && <div className="alert ok">{notice}</div>}
            </div>

            <button className="btn" type="submit" disabled={loading}>
              {loading ? "กำลังดำเนินการ..." : (mode==="signin" ? "เข้าสู่ระบบ" : "สมัครสมาชิก")}
            </button>
          </form>

          <p className="footnote">* Frontend ล้วน — ต่อ API จริงที่ <code>/api/auth/*</code> · เปิด mock ด้วย <code>VITE_USE_MOCK=true</code></p>
        </div>
      </div>

      <style>{css(IOS_BLUE)}</style>
    </div>
  );
}

function css(IOS_BLUE: string) {
  return `
  :root{
    --ios-blue:${IOS_BLUE};
    --shadow:0 10px 40px rgba(10,132,255,.15);
    --font-ui: "Inter Variable","Noto Sans Thai Variable","Inter","Noto Sans Thai",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  }
  *{ box-sizing:border-box }
  html,body,#root{ height:100% }
  body{
    margin:0;
    font-family: var(--font-ui);
    line-height: 1.55;
    letter-spacing: .1px;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color:#0a0a0a; background:#fff;
  }
  input,button,select,textarea{ font: inherit }

  .screen{
    min-height:100vh; display:flex; align-items:center; justify-content:center;
    background: radial-gradient(1200px 700px at 80% -10%, #E6F0FF 0%, #F7FAFF 40%, #FFFFFF 100%);
    padding: 32px 16px;
  }

  /* ✅ ซ้าย-ขวากว้างเท่ากันทุกโหมด (1.1fr | 1fr) */
  .card{
    width:100%; max-width:980px; background:rgba(255,255,255,.8); backdrop-filter: blur(12px);
    border:1px solid rgba(0,0,0,.06); border-radius:24px; overflow:hidden; box-shadow: var(--shadow);
    display:grid; grid-template-columns: 1.1fr 1fr;
  }

  .panel-left{
    display:none; padding:40px; color:#fff;
    background: linear-gradient(160deg, var(--ios-blue) 0%, #60A3D9 60%, #BFD7ED 100%);
  }
  .pill{ display:inline-flex; align-items:center; width:112px; gap:8px; background:rgba(255,255,255,.15); padding:6px 20px; border-radius:999px; font-weight:700; }
  .headline{ margin:16px 0 6px; font-size:28px; line-height:1.25; font-weight:800 }
  .bullets{ margin:0; padding-left:18px; line-height:1.6 }

  .panel-right{ padding:28px 22px 26px; background:#fff }
  .topbar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:18px }
  .brand-badge{ background: #BFD7ED; padding:6px 10px; border-radius:10px; display:inline-flex; align-items:center; box-shadow:0 6px 18px rgba(10,132,255,.18) }
  .brand-img{ height:30px; display:block; object-fit:contain }
  .switch{ display:inline-flex; background:#F3F4F6; padding:4px; border-radius:12px; }
  .sw-btn{ border:0; background:transparent; padding:6px 10px; border-radius:10px; font-weight:600; color:#6b7280; }
  .sw-btn.active{ background:#fff; color:#111827; box-shadow:0 1px 0 rgba(0,0,0,.02), 0 8px 18px rgba(10,132,255,.18) }

  .title h2{ margin:0; font-size:22px; font-weight:800 }
  .title .muted{ color:#6b7280; margin:6px 0 16px }

  .segment{ display:grid; grid-template-columns:repeat(3,1fr); gap:6px; background:#EFF3FF; border:1px solid rgba(10,132,255,.15); padding:6px; border-radius:14px; margin-bottom:16px }
  .seg{ border:0; background:transparent; padding:10px 12px; border-radius:11px; font-weight:700; color:#4b5563 }
  .seg.active{ background:#fff; color:#111827; box-shadow:0 1px 0 rgba(0,0,0,.02), 0 6px 18px rgba(10,132,255,.18) }
  .seg.disabled, .seg:disabled{
    opacity:.5; cursor:not-allowed; color:#9ca3af !important; box-shadow:none !important; 
    pointer-events:none; /* กันคลิก */
  }

  .form{ display:grid; gap:10px }
  .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  @media (max-width: 520px){ .grid2{ grid-template-columns:1fr } }

  .label{ font-weight:700; color:#111827; font-size:14px; letter-spacing:.2px }
  .input{
    height:46px; border:1px solid #e5e7eb; border-radius:12px; padding:0 14px; outline:none;
    transition: border-color .12s, box-shadow .12s; font-variant-numeric: tabular-nums;
  }
  .input:focus{ border-color:var(--ios-blue); box-shadow:0 0 0 4px rgba(10,132,255,.18) }

  .remember{ display:flex; align-items:center; gap:8px; margin:4px 0 2px; color:#374151; user-select:none }
  .remember input{ width:16px; height:16px; accent-color: var(--ios-blue); }

  .alert{ padding:10px 12px; border-radius:12px; border:1px solid; font-size:14px }
  .alert.error{ color:#B91C1C; background:#FEF2F2; border-color:#FCA5A5 }
  .alert.ok{ color:#065F46; background:#ECFDF5; border-color:#6EE7B7 }

  .btn{
    height:48px; border:0; border-radius:12px; background:var(--ios-blue); color:#fff; font-weight:800;
    box-shadow:0 10px 22px rgba(10,132,255,.25), inset 0 -1px 0 rgba(255,255,255,.25);
  }
  .btn:disabled{ filter:grayscale(.1) brightness(.95); opacity:.9 }

  .footnote{ margin-top:14px; font-size:12px; color:#6b7280 }
  code{ background:#F3F4F6; padding:2px 6px; border-radius:6px }

  /* Responsive: Desktop & iPad */
  @media (min-width: 900px){
    .panel-left{ display:flex; flex-direction:column; justify-content:center }
    .panel-right{ padding:36px 34px }
  }
  @media (max-width: 899px){ .card{ grid-template-columns: 1fr } }
  `;
}
