import React, { useEffect, useMemo, useState } from "react";
import { AuthAPI } from "./api";
import { loadProfile, saveProfile } from "./store";
import { useNavigate } from "react-router-dom";
import coopLogo from "../assets/COOP_Logo.png";


// ✅ บทบาทใหม่: นักศึกษา / เจ้าหน้าที่ / อาจารย์ (ไม่มีพี่เลี้ยง)
type Role = "student" | "staff" | "teacher";

function validateByRole(role: Role, email: string, password: string): string | null {
  const e = email.trim();
  if (!e) return "กรุณากรอกอีเมล";
  if (!e.includes("@")) return "รูปแบบอีเมลไม่ถูกต้อง";
  if (role === "student") {
    if (!/^\d{10}$/.test(password)) return "รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก";
  } else {
    if (!/^0\d{9}$/.test(password)) return "รหัสผ่านต้องเป็นเบอร์โทร 10 หลักขึ้นต้นด้วย 0";
  }
  return null;
}

const IOS_BLUE = "#0074B7";
const ROLE_LABEL: Record<Role, string> = { student: "นักศึกษา", staff: "เจ้าหน้าที่", teacher: "อาจารย์" };
const ALL_ROLES: Role[] = ["student", "staff", "teacher"];
// ✅ เส้นทางหลังล็อกอินตามบทบาท
const HOME_BY_ROLE: Record<Role, string> = {
  student: "/student",
  staff: "/admin",
  teacher: "/teacher",
};
// ✅ คำนำหน้าชื่อ (สมัครนักศึกษาเท่านั้น)
const PREFIXES = ["นาย", "นางสาว", "นาง"] as const;

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<Role>("student");

  // กลาง
  const [email, setEmail] = useState("");

  // เข้าสู่ระบบ
  const [password, setPassword] = useState("");

  // สมัคร — นักศึกษาเท่านั้น
  const [sPrefix, setSPrefix] = useState<(typeof PREFIXES)[number]>("นาย");
  const [sFirst, setSFirst] = useState("");
  const [sLast, setSLast] = useState("");
  const [sStdId, setSStdId] = useState("");
  const [sPhone, setSPhone] = useState("");
  const [sGpa, setSGpa] = useState("");
  const [sMajor, setSMajor] = useState("");
  const [sCurr, setSCurr] = useState("");
  const [sNation, setSNation] = useState("");

  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const roleText = useMemo(() => ROLE_LABEL[role], [role]);
  const pwdPlaceholder = role === "student" ? "รหัสนักศึกษา 10 หลัก" : "เบอร์โทร 10 หลักขึ้นต้นด้วย 0";

  useEffect(() => { setError(""); setNotice(""); }, [mode, role]);
  // ✅ ถ้าอยู่โหมดสมัคร ให้ล็อกบทบาทเป็น "student" เสมอ
  useEffect(() => { if (mode === "signup" && role !== "student") setRole("student"); }, [mode, role]);

  const onlyDigits = (v: string) => v.replace(/\D/g, "");
  const passwordPattern = role === "student" ? "\\d{10}" : "0\\d{9}";
  const rolesForMode: Role[] = ALL_ROLES;

  function validateSignupFields(): string | null {
    const e = email.trim().toLowerCase();
    if (!e) return "กรุณากรอกอีเมล";
    if (!e.endsWith("@kkumail.com")) {
      return "สมัครนักศึกษาได้เฉพาะอีเมล @kkumail.com เท่านั้น";
    }
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

        if (remember && res.token)
          localStorage.setItem("coop.token", res.token);

        // ✅ เก็บบทบาทไว้ใช้ในแอปส่วนอื่น
        localStorage.setItem("coop.role", role);
        // ✅ ส่งไปยัง portal ตามบทบาท

        navigate(HOME_BY_ROLE[role] || "/student/dashboard", { replace: true });

        setNotice(`เข้าสู่ระบบสำเร็จ: ${res.user?.email} (${res.user?.role})`);
      } else {
        // signup (เฉพาะนักศึกษา)
        const missing = validateSignupFields();
        if (missing) throw new Error(missing);

        const pwd = sStdId; // นักศึกษาใช้รหัสนักศึกษาเป็นรหัสผ่านตอนสมัคร
        const err = validateByRole("student", email.trim(), pwd);
        if (err) throw new Error(err);

        const res = await AuthAPI.signup({ role: "student", email: email.trim(), password: pwd });
        if (!res.ok) throw new Error(res.message || "สมัครไม่สำเร็จ");

        // ✅ เก็บโปรไฟล์นักศึกษา
        const current = loadProfile();
        const next = {
          ...current,
          email: email.trim().toLowerCase(),
          studentId: sStdId,
          prefix: sPrefix,
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

        setNotice(res.message || "สมัครสำเร็จ");
        setMode("signin");

        // เคลียร์ฟอร์มสมัคร
        setPassword("");
        setSPrefix("นาย"); setSFirst(""); setSLast(""); setSStdId(""); setSPhone(""); setSGpa(""); setSMajor(""); setSCurr(""); setSNation("");
      }
    } catch (er: unknown) {
      setError(er instanceof Error ? er.message : String(er));
    } finally { setLoading(false); }
  }

  return (
    <div className="screen">
      <div className="card">
        <div className="panel-left">
          <div className="pill">CP · KKU</div>
          <h1 className="headline">Co-operative:<br />Computer Science, KKU</h1><br />
          <ul className="bullets">
            <li>บทบาท: นักศึกษา / เจ้าหน้าที่ / อาจารย์</li>
            <li><b>สมัคร:</b> เฉพาะนักศึกษา</li>
            <li>username = อีเมล</li>
            <li>password: นักศึกษา = รหัส 10 หลัก · เจ้าหน้าที่/อาจารย์ = เบอร์ 0XXXXXXXXX</li>
          </ul>
        </div>

        <div className="panel-right">
          <header className="topbar">
            <div className="brand">
              <div className="brand-badge"><img src={coopLogo} alt="Co-op Logo" className="brand-img" /></div>
            </div>
            <div className="switch" role="tablist" aria-label="สลับโหมด">
              <button className={`sw-btn ${mode === "signin" ? "active" : ""}`} onClick={() => setMode("signin")} type="button">เข้าสู่ระบบ</button>
              <button className={`sw-btn ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")} type="button">สมัคร</button>
            </div>
          </header>

          <div className="title">
            <h2>{mode === "signin" ? "เข้าสู่ระบบ" : "สมัครสมาชิก (นักศึกษา)"}</h2>
            <p className="muted">บทบาท: <b>{roleText}</b></p>
          </div>

          <div className="segment" role="tablist" aria-label="เลือกบทบาท">
            {rolesForMode.map(r => {
              const disabled = mode === "signup" && r !== "student"; // ✅ สมัครได้เฉพาะนักศึกษา
              return (
                <button
                  key={r}
                  className={`seg ${role === r ? "active" : ""} ${disabled ? "disabled" : ""}`}
                  disabled={disabled}
                  aria-disabled={disabled}
                  title={disabled ? "สมัครสมาชิกได้เฉพาะนักศึกษาเท่านั้น" : undefined}
                  onClick={() => { if (!disabled) { setRole(r); setPassword(""); } }}
                  type="button"
                >
                  {ROLE_LABEL[r]}
                </button>
              );
            })}
          </div>

          <form onSubmit={onSubmit} className="form" noValidate>
            <label className="label" htmlFor="email" style={{ marginLeft: 10 }}>อีเมล</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              pattern={mode === "signup" ? "^[^\\s@]+@kkumail\\.com$" : undefined}
              title={mode === "signup" ? "สมัครนักศึกษาใช้อีเมล @kkumail.com เท่านั้น" : undefined}
            />

            {mode === "signin" ? (
              <>
                <label className="label" htmlFor="password" style={{ marginLeft: 10 }}>รหัสผ่าน</label>
                <input
                  id="password" className="input" type="password" inputMode="numeric"
                  placeholder={pwdPlaceholder}
                  value={password} onChange={(e) => setPassword(onlyDigits(e.target.value))}
                  required pattern={passwordPattern} minLength={10} maxLength={10}
                />
                <label className="remember">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ marginLeft: 8 }} />
                  <span>จดจำฉันไว้</span>
                </label>
              </>
            ) : (
              <>
                {/* SIGNUP FIELDS — เฉพาะนักศึกษา */}
                <div className="grid2">
                  {/* คำนำหน้า */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="label" htmlFor="sPrefix">คำนำหน้า</label>
                    <select id="sPrefix" className="input" value={sPrefix} onChange={e => setSPrefix(e.target.value as any)} required style={{ marginLeft: 10 }}>
                      {PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* ชื่อ / นามสกุล */}
                  <div>
                    <label className="label" htmlFor="sFirst" style={{ marginLeft: 10 }}>ชื่อ</label>
                    <input id="sFirst" className="input" value={sFirst} onChange={e => setSFirst(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label" htmlFor="sLast" style={{ marginLeft: 10 }}>นามสกุล</label>
                    <input id="sLast" className="input" value={sLast} onChange={e => setSLast(e.target.value)} required />
                  </div>

                  <div>
                    <label className="label" htmlFor="sStdId" style={{ marginLeft: 10 }}>รหัสนักศึกษา</label>
                    <input id="sStdId" className="input" inputMode="numeric" placeholder="6501234567"
                      value={sStdId} onChange={e => setSStdId(onlyDigits(e.target.value).slice(0, 10))}
                      required pattern="\\d{10}" minLength={10} maxLength={10} />
                  </div>
                  <div>
                    <label className="label" htmlFor="sPhone" style={{ marginLeft: 10 }}>เบอร์โทร</label>
                    <input id="sPhone" className="input" inputMode="tel" placeholder="0812345678"
                      value={sPhone} onChange={e => setSPhone(onlyDigits(e.target.value).slice(0, 10))}
                      required pattern="0\\d{9}" minLength={10} maxLength={10} />
                  </div>
                  <div><br />
                    <label className="label" htmlFor="sGpa">เกรด (GPA)</label>
                    <input id="sGpa" className="input" type="number" step="0.01" min={0} max={4}
                      value={sGpa} onChange={e => setSGpa(e.target.value)} required style={{ marginLeft: 10 }} />
                  </div>
                  <div>
                    <label className="label" htmlFor="sMajor" style={{ marginLeft: 10 }}>สาขาวิชา</label>
                    <input id="sMajor" className="input" value={sMajor} onChange={e => setSMajor(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label" htmlFor="sCurr" style={{ marginLeft: 10 }}>หลักสูตร</label>
                    <input id="sCurr" className="input" value={sCurr} onChange={e => setSCurr(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label" htmlFor="sNation" style={{ marginLeft: 10 }}>สัญชาติ</label>
                    <input id="sNation" className="input" value={sNation} onChange={e => setSNation(e.target.value)} required />
                  </div>
                </div>
              </>
            )}

            <div aria-live="polite">
              {error && <div className="alert error">{error}</div>}
              {notice && <div className="alert ok">{notice}</div>}
            </div>

            <button className="btn" type="submit" disabled={loading}>
              {loading ? "กำลังดำเนินการ..." : (mode === "signin" ? "เข้าสู่ระบบ" : "สมัครสมาชิก")}
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
  body{ margin:0; font-family: var(--font-ui); line-height: 1.55; letter-spacing: .1px; color:#0a0a0a; background:#fff; }
  input,button,select,textarea{ font: inherit }

  .screen{ min-height:100vh; display:flex; align-items:center; justify-content:center; background: radial-gradient(1200px 700px at 80% -10%, #E6F0FF 0%, #F7FAFF 40%, #FFFFFF 100%); padding: 32px 16px; }

  .card{ width:100%; max-width:980px; background:rgba(255,255,255,.8); backdrop-filter: blur(12px); border:1px solid rgba(0,0,0,.06); border-radius:24px; overflow:hidden; box-shadow: var(--shadow); display:grid; grid-template-columns: 1.1fr 1fr; }

  .panel-left{ display:none; padding:40px; color:#fff; background: linear-gradient(160deg, var(--ios-blue) 0%, #60A3D9 60%, #BFD7ED 100%); }
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
  .seg.disabled{ opacity:.5; cursor:not-allowed; color:#9ca3af !important; box-shadow:none !important; pointer-events:none; }

  .form{ display:grid; gap:10px }
  .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  @media (max-width: 520px){ .grid2{ grid-template-columns:1fr } }

  .label{ font-weight:700; color:#111827; font-size:14px; letter-spacing:.2px }
  .input{ height:46px; border:1px solid #e5e7eb; border-radius:12px; padding:0 14px; outline:none; transition: border-color .12s, box-shadow .12s; font-variant-numeric: tabular-nums; }
  .input:focus{ border-color:var(--ios-blue); box-shadow:0 0 0 4px rgba(10,132,255,.18) }

  .remember{ display:flex; align-items:center; gap:8px; margin:4px 0 2px; color:#374151; user-select:none }
  .remember input{ width:16px; height:16px; accent-color: var(--ios-blue); }

  .alert{ padding:10px 12px; border-radius:12px; border:1px solid; font-size:14px }
  .alert.error{ color:#B91C1C; background:#FEF2F2; border-color:#FCA5A5 }
  .alert.ok{ color:#065F46; background:#ECFDF5; border-color:#6EE7B7 }

  .btn{ height:48px; border:0; border-radius:12px; background:var(--ios-blue); color:#fff; font-weight:800; box-shadow:0 10px 22px rgba(10,132,255,.25), inset 0 -1px 0 rgba(255,255,255,.25); }
  .btn:disabled{ filter:grayscale(.1) brightness(.95); opacity:.9 }

  .footnote{ margin-top:14px; font-size:12px; color:#6b7280 }

  @media (min-width: 1024px){ .panel-left{ display:flex; flex-direction:column; justify-content:center } .panel-right{ padding:36px 34px } }
  @media (max-width: 1023px){ .card{ grid-template-columns: 1fr } }
  `;
}
