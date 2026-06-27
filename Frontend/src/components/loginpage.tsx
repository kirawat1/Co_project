// src/components/LoginPage.tsx
import { useEffect, useMemo, useState } from "react";
import { AuthAPI } from "./api";
import type { Role, TokenClaims } from "./api";
import { useNavigate } from "react-router-dom";
import coopLogo from "../assets/COOP_Logo.png";
import { ThemeToggleBtn } from "./ThemeContext";
import { GoogleLogin } from '@react-oauth/google';

// ------------------------------------------------------
// ROLES
// ------------------------------------------------------
const ROLE_LABEL: Record<Role, string> = {
  student: "นักศึกษา",
  staff: "เจ้าหน้าที่",
  teacher: "อาจารย์",
};

const ALL_ROLES: Role[] = ["student", "staff", "teacher"];

// เส้นทางหลังล็อกอิน
const HOME_BY_ROLE: Record<Role, string> = {
  student: "/student",
  staff: "/admin",
  teacher: "/teacher",
};

// ------------------------------------------------------
// VALIDATION RULES
// ------------------------------------------------------
function validateByRole(role: Role, username: string, password: string): string | null {
  const u = username.trim();
  const p = password.trim();

  // ตรวจสอบ Email สำหรับทุกบทบาท (รวมนักศึกษาด้วย)
  if (!u) return "กรุณากรอกอีเมลมหาวิทยาลัย";

  const uniEmail = /^[^@\s]+@(kkumail\.com|kku\.ac\.th)$/i;
  if (!uniEmail.test(u)) {
    return "กรุณากรอกอีเมลมหาวิทยาลัยให้ถูกต้อง (@kkumail.com หรือ @kku.ac.th)";
  }

  if (!p) {
    return "กรุณากรอกรหัสผ่าน";
  }

  return null;
}

// ------------------------------------------------------
// PAGE COMPONENT
// ------------------------------------------------------
export default function LoginPage() {
  const [role, setRole] = useState<Role>("student");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loggedName, setLoggedName] = useState("");

  function friendlyError(msg: string): string {
    if (/40[01]|unauthorized|invalid.*creden/i.test(msg))
      return "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
    if (/403|forbidden/i.test(msg))
      return "ไม่มีสิทธิ์เข้าถึง กรุณาติดต่อผู้ดูแลระบบ";
    if (/5\d{2}|internal server|server error/i.test(msg))
      return "เกิดข้อผิดพลาดของระบบ กรุณาลองใหม่อีกครั้ง";
    if (/failed to fetch|networkerror|network request failed/i.test(msg))
      return "ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบอินเทอร์เน็ต";
    return msg;
  }

  // ── Self-Registration ─────────────────────
  const [registerMode, setRegisterMode] = useState(false);
  const [regForm, setRegForm] = useState({
    studentId: "", prefix: "นาย", firstName: "", lastName: "",
    email: "", password: "", major: "", year: "",
  });
  const [regLoading, setRegLoading] = useState(false);

  const navigate = useNavigate();
  const roleText = useMemo(() => ROLE_LABEL[role], [role]);



  const usernamePlaceholder = "example@kkumail.com หรือ @kku.ac.th";

  useEffect(() => {
    setError("");
    setNotice("");
    setPassword("");
    setLoggedName("");
  }, [role]);

  // ------------------------------------------------------
  // SUBMIT LOGIN
  // ------------------------------------------------------
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const err = validateByRole(role, username, password);
      if (err) throw new Error(err);

      const res = await AuthAPI.signin({
        role,
        email: username.trim(),
        password,
      });

      if (!res.ok || !res.token) {
        throw new Error(res.message || "เข้าสู่ระบบไม่สำเร็จ");
      }

      if (remember) {
        localStorage.setItem("coop.token", res.token);

        // ✅ เพิ่มบรรทัดนี้: บันทึก ID เพื่อให้หน้าอื่นเอาไปใช้เช็คสิทธิ์ (Delete/Edit) ได้ทันที
        if (res.user && res.user.id) {
          localStorage.setItem("coop.userId", String(res.user.id));
        }
      }

      // ----------------------------------------------------
      // DECODE CLAIMS
      // ----------------------------------------------------
      const claims: TokenClaims | null = AuthAPI.decodeToken(res.token);

      if (claims) {
        localStorage.setItem("coop.claims", JSON.stringify(claims));

        // ตั้งชื่อที่แสดงบนหน้าล็อกอินทันที
        if (claims.role === "student" && claims.studentId) {
          setLoggedName(`นักศึกษา: ${claims.studentId}`);
        } else if (claims.role === "staff" && claims.staffName) {
          setLoggedName(`เจ้าหน้าที่: ${claims.staffName}`);
        } else if (claims.role === "teacher" && claims.teacherName) {
          setLoggedName(`อาจารย์: ${claims.teacherName}`);
        } else {
          setLoggedName(claims.email);
        }
      }

      setNotice("เข้าสู่ระบบสำเร็จ");

      setTimeout(() => {
        navigate(HOME_BY_ROLE[role], { replace: true });
      }, 900);
    } catch (er: unknown) {
      setError(friendlyError(er instanceof Error ? er.message : String(er)));
    } finally {
      setLoading(false);
    }
  }

  // ── Self-Register handler ─────────────────────────────
  async function onRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setNotice("");
    const { studentId, firstName, lastName, email, password, major, year, prefix } = regForm;
    if (!studentId.trim() || !firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      setError("กรุณากรอกข้อมูลให้ครบ: รหัสนักศึกษา, ชื่อ-นามสกุล, อีเมล, รหัสผ่าน");
      return;
    }
    setRegLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: studentId.trim(), prefix, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password: password.trim(), major, year }),
      });
      const data = await res.json();
      if (!data.ok || !data.token) throw new Error(data.message || "สมัครสมาชิกไม่สำเร็จ");

      localStorage.setItem("coop.token", data.token);
      if (data.user?.id) localStorage.setItem("coop.userId", String(data.user.id));

      setNotice("สมัครสมาชิกสำเร็จ กำลังเข้าสู่ระบบ...");
      setTimeout(() => navigate("/student", { replace: true }), 900);
    } catch (er: unknown) {
      setError(friendlyError(er instanceof Error ? er.message : String(er)));
    } finally {
      setRegLoading(false);
    }
  }

  // helper to reset all modes
  function resetMode() { setRegisterMode(false); setError(""); setNotice(""); }

  // ------------------------------------------------------
  // RENDER UI (CSS เดิมทั้งหมด)
  // ------------------------------------------------------
  return (
    <div className="screen">
      <div className="card">
        {/* ฝั่งซ้าย */}
        <div className="panel-left">
          <div className="pill">CP · KKU</div>
          <h1 className="headline">
            Co-operative:
            <br />
            Computer Science, KKU
          </h1>
        </div>

        {/* ฝั่งขวา */}
        <div className="panel-right">
          <header className="topbar">
            <div className="brand">
              <div className="brand-badge">
                <img src={coopLogo} alt="Co-op Logo" className="brand-img" />
              </div>
            </div>
            <ThemeToggleBtn />
          </header>

          <div className="title">
            <h2>เข้าสู่ระบบ</h2>
            <p className="muted">
              บทบาท: <b>{roleText}</b>
            </p>
          </div>

          {/* ชื่อจาก Token Claims */}
          {loggedName && (
            <div
              style={{
                marginBottom: 10,
                fontSize: 16,
                fontWeight: 800,
                color: "#0f172a",
                marginLeft: 2,
              }}
            >
              {loggedName}
            </div>
          )}

          {/* เลือกบทบาท */}
          <div className="segment" role="tablist">
            {ALL_ROLES.map((r) => (
              <button
                key={r}
                className={`seg ${role === r ? "active" : ""}`}
                type="button"
                onClick={() => {
                  setRole(r);
                  setUsername("");
                }}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>

          {/* ฟอร์มเข้าสู่ระบบ */}
          <form onSubmit={onSubmit} className="form" noValidate>
            <label className="label" htmlFor="username" style={{ marginLeft: 10 }}>
              ชื่อผู้ใช้ (Username)
            </label>
            <input
              id="username"
              className="input"
              type="email" // เปลี่ยนจาก text เป็น email เพื่อให้คีย์บอร์ดมือถือรองรับ
              autoComplete="username"
              placeholder={usernamePlaceholder}
              value={username}
              onChange={(e) => setUsername(e.target.value)} // เอา onlyDigits และ slice(0, 10) ออก
              required
              inputMode="email" // เปลี่ยนเป็น email สำหรับทุกบทบาท
            />

            <label className="label" htmlFor="password" style={{ marginLeft: 10 }}>
              รหัสผ่าน
</label>
            <input
              id="password"
              className="input"
              type="password"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <label className="remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                style={{ marginLeft: 8 }}
              />
              <span>จดจำฉันไว้</span>
            </label>

            <div aria-live="polite">
              {error && <div className="alert error">{error}</div>}
              {notice && <div className="alert ok">{notice}</div>}
            </div>

            <button className="btn" type="submit" disabled={loading}>
              {loading ? "กำลังดำเนินการ..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          {/* ── Google Sign-In (students only) ── */}
          {role === "student" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 14px" }}>
                <div style={{ flex: 1, height: 1, background: "var(--border,#e5e7eb)" }} />
                <span style={{ fontSize: 12, color: "var(--text-muted,#6b7280)", fontWeight: 600, whiteSpace: "nowrap" }}>
                  หรือเข้าสู่ระบบด้วย
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--border,#e5e7eb)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    try {
                      setLoading(true);
                      const res = await fetch("/api/auth/login/google", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id_token: credentialResponse.credential }),
                      });
                      const data = await res.json();
                      if (!data.ok || !data.token) throw new Error(data.message || "เข้าสู่ระบบไม่สำเร็จ");

                      localStorage.setItem("coop.token", data.token);
                      if (data.user?.id) localStorage.setItem("coop.userId", String(data.user.id));

                      const claims = AuthAPI.decodeToken(data.token);
                      if (claims) localStorage.setItem("coop.claims", JSON.stringify(claims));

                      setNotice("เข้าสู่ระบบสำเร็จ");
                      const userRole = (data.user?.role || "student") as Role;
                      setTimeout(() => navigate(HOME_BY_ROLE[userRole] ?? "/", { replace: true }), 900);
                    } catch (er: unknown) {
                      setError(friendlyError(er instanceof Error ? er.message : String(er)));
                    } finally {
                      setLoading(false);
                    }
                  }}
                  onError={() => setError("เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่")}
                  text="signin_with"
                  useOneTap={false}
                />
              </div>
            </>
          )}

          <p className="footnote">
            · ตอนนี้ใช้ username ตามบทบาท และ password = เลขบัตรประชาชน 13 หลัก
          </p>

          {/* ── สมัครสมาชิกใหม่ (นักศึกษาเท่านั้น) ── */}
          {role === "student" && (
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <span style={{ fontSize: 13, color: "var(--text-muted,#6b7280)" }}>ยังไม่มีบัญชี? </span>
              <button
                type="button"
                onClick={() => { setRegisterMode(true); resetMode(); setRegisterMode(true); }}
                style={{ background: "none", border: "none", color: "#0074B7", fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: "12px 4px" }}
              >
                สมัครสมาชิกด้วยตนเอง
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Register Modal ── */}
      {registerMode && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)", padding: 16 }}>
          <div style={{ background: "var(--surface,#fff)", borderRadius: 20, padding: "28px 32px", width: 500, maxWidth: "100%", maxHeight: "95vh", overflowY: "auto", boxShadow: "0 20px 40px rgba(0,0,0,.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>📋 สมัครสมาชิกนักศึกษาใหม่</h3>
              <button onClick={() => setRegisterMode(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" }}>✕</button>
            </div>

            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#92400e" }}>
              ⚠️ สำหรับนักศึกษาที่ยังไม่เคยเข้าระบบ — รหัสผ่านคือเลขบัตรประชาชน 13 หลักของคุณ
            </div>

            <form onSubmit={onRegisterSubmit} className="form" noValidate>
              {/* row: prefix + studentId */}
              <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 10 }}>
                <div>
                  <label className="label" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>คำนำหน้า</label>
                  <select className="input" value={regForm.prefix} onChange={e => setRegForm({ ...regForm, prefix: e.target.value })} style={{ height: 46 }}>
                    <option value="นาย">นาย</option>
                    <option value="นางสาว">นางสาว</option>
                  </select>
                </div>
                <div>
                  <label className="label" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>รหัสนักศึกษา *</label>
                  <input className="input" placeholder="เช่น 6430212186" value={regForm.studentId}
                    onChange={e => setRegForm({ ...regForm, studentId: e.target.value.replace(/\D/g, "").slice(0, 12) })}
                    inputMode="numeric" required />
                </div>
              </div>

              {/* row: ชื่อ + นามสกุล */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="label" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>ชื่อ (ภาษาไทย) *</label>
                  <input className="input" placeholder="ชื่อจริง" value={regForm.firstName}
                    onChange={e => setRegForm({ ...regForm, firstName: e.target.value })} required />
                </div>
                <div>
                  <label className="label" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>นามสกุล *</label>
                  <input className="input" placeholder="นามสกุล" value={regForm.lastName}
                    onChange={e => setRegForm({ ...regForm, lastName: e.target.value })} required />
                </div>
              </div>

              {/* อีเมล */}
              <div>
                <label className="label" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>อีเมล KKU * (@kkumail.com หรือ @kku.ac.th)</label>
                <input className="input" type="email" placeholder="xxxxxx@kkumail.com"
                  value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                  autoComplete="username" required />
              </div>

              {/* รหัสผ่าน (เลขบัตรประชาชน) */}
              <div>
                <label className="label" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>รหัสผ่าน *</label>
                <input className="input" type="password" placeholder="เลขบัตรประชาชน 13 หลัก"
                  value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                  autoComplete="new-password" required />
              </div>

              {/* row: สาขา + ชั้นปี */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 10 }}>
                <div>
                  <label className="label" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>สาขาวิชา</label>
                  <select className="input" value={regForm.major} onChange={e => setRegForm({ ...regForm, major: e.target.value })} style={{ height: 46 }}>
                    <option value="">-- เลือกสาขา --</option>
                    <option value="วิทยาการคอมพิวเตอร์">วิทยาการคอมพิวเตอร์</option>
                    <option value="เทคโนโลยีสารสนเทศ">เทคโนโลยีสารสนเทศ</option>
                    <option value="ภูมิสารสนเทศศาสตร์">ภูมิสารสนเทศศาสตร์</option>
                    <option value="ความมั่นคงปลอดภัยไซเบอร์">ความมั่นคงปลอดภัยไซเบอร์</option>
                    <option value="วิทยาการข้อมูลและปัญญาประดิษฐ์">วิทยาการข้อมูลและปัญญาประดิษฐ์</option>
                    <option value="ปัญญาประดิษฐ์">ปัญญาประดิษฐ์</option>
                  </select>
                </div>
                <div>
                  <label className="label" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>ชั้นปี</label>
                  <select className="input" value={regForm.year} onChange={e => setRegForm({ ...regForm, year: e.target.value })} style={{ height: 46 }}>
                    <option value="">-</option>
                    {["1","2","3","4"].map(y => <option key={y} value={y}>ปี {y}</option>)}
                  </select>
                </div>
              </div>

              <div aria-live="polite">
                {error && <div className="alert error">{error}</div>}
                {notice && <div className="alert ok">{notice}</div>}
              </div>

              <button className="btn" type="submit" disabled={regLoading} style={{ background: "#0074B7" }}>
                {regLoading ? "กำลังสมัครสมาชิก..." : "✅ สมัครสมาชิกและเข้าสู่ระบบ"}
              </button>
              <button type="button" onClick={() => setRegisterMode(false)}
                style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer", textAlign: "center", padding: "4px 0" }}>
                ← กลับไปหน้า Login
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CSS เดิมของคุณทั้งหมด */}
      <style>{css("#0074B7")}</style>
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

  .title h2{ margin:0; font-size:22px; font-weight:800 }
  .title .muted{ color:#6b7280; margin:6px 0 16px }

  .segment{ display:grid; grid-template-columns:repeat(3,1fr); gap:6px; background:#EFF3FF; border:1px solid rgba(10,132,255,.15); padding:6px; border-radius:14px; margin-bottom:16px }
  .seg{ border:0; background:transparent; padding:10px 12px; border-radius:11px; font-weight:700; color:#4b5563 }
  .seg.active{ background:#fff; color:#111827; box-shadow:0 1px 0 rgba(0,0,0,.02), 0 6px 18px rgba(10,132,255,.18) }

  .form{ display:grid; gap:10px }

  .label{ font-weight:700; color:#111827; font-size:14px; letter-spacing:.2px }
  .input{ height:46px; border:1px solid #e5e7eb; border-radius:12px; padding:0 14px; outline:none; transition: border-color .12s, box-shadow .12s; font-variant-numeric: tabular-nums; }
  .input:focus{ border-color:var(--ios-blue); box-shadow:0 0 0 4px rgba(10,132,255,.18) }

  .remember{ display:flex; align-items:center; gap:8px; margin:4px 0 2px; padding:10px 0; color:#374151; user-select:none; cursor:pointer }
  .remember input{ width:16px; height:16px; accent-color: var(--ios-blue); }

  .alert{ padding:10px 12px; border-radius:12px; border:1px solid; font-size:14px }
  .alert.error{ color:#B91C1C; background:#FEF2F2; border-color:#FCA5A5 }
  .alert.ok{ color:#065F46; background:#ECFDF5; border-color:#6EE7B7 }

  .btn{ height:48px; border:0; border-radius:12px; background:var(--ios-blue); color:#fff; font-weight:800; box-shadow:0 10px 22px rgba(10,132,255,.25), inset 0 -1px 0 rgba(255,255,255,.25); }
  .btn:disabled{ filter:grayscale(.1) brightness(.95); opacity:.9 }

  .footnote{ margin-top:14px; font-size:12px; color:#6b7280 }

  @media (min-width: 1024px){ .panel-left{ display:flex; flex-direction:column; justify-content:center } .panel-right{ padding:36px 34px } }
  @media (max-width: 1023px){ .card{ grid-template-columns: 1fr } }

  /* ===== DARK MODE ===== */
  [data-theme="dark"] .screen {
    background: radial-gradient(1200px 700px at 80% -10%, #0f1f3d 0%, #0f172a 40%, #0a101e 100%) !important;
  }
  [data-theme="dark"] .card {
    background: rgba(30,41,59,.85) !important;
    border-color: rgba(255,255,255,.08) !important;
    box-shadow: 0 10px 40px rgba(0,0,0,.4) !important;
  }
  [data-theme="dark"] .panel-right {
    background: #1e293b !important;
    color: #f1f5f9 !important;
  }
  [data-theme="dark"] .title h2 { color: #f1f5f9 !important; }
  [data-theme="dark"] .title .muted { color: #94a3b8 !important; }
  [data-theme="dark"] .label { color: #cbd5e1 !important; }
  [data-theme="dark"] .segment {
    background: #0f172a !important;
    border-color: rgba(255,255,255,.08) !important;
  }
  [data-theme="dark"] .seg { color: #94a3b8 !important; }
  [data-theme="dark"] .seg.active {
    background: #334155 !important;
    color: #f1f5f9 !important;
    box-shadow: 0 6px 18px rgba(0,0,0,.3) !important;
  }
  [data-theme="dark"] .remember { color: #cbd5e1 !important; }
  [data-theme="dark"] .footnote { color: #64748b !important; }
  [data-theme="dark"] .brand-badge {
    background: #1e3a5f !important;
    box-shadow: 0 6px 18px rgba(0,0,0,.3) !important;
  }
  `;
}