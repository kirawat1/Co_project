// src/components/LoginPage.tsx
import { useEffect, useMemo, useState } from "react";
import { AuthAPI } from "./api";
import type { Role, TokenClaims } from "./api";
import { useNavigate } from "react-router-dom";
import coopLogo from "../assets/COOP_Logo.png";

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

  if (role === "student") {
    if (!/^\d{10}$/.test(u)) {
      return "รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก";
    }
  } else {
    if (!u) return "กรุณากรอกอีเมลมหาวิทยาลัย";
    const uniEmail = /^[^@\s]+@(kkumail\.com|kku\.ac\.th)$/i;
    if (!uniEmail.test(u)) {
      return "กรุณากรอกอีเมลมหาวิทยาลัยให้ถูกต้อง (@kkumail.com หรือ @kku.ac.th)";
    }
  }

  if (!/^\d{13}$/.test(p)) {
    return "รหัสผ่านต้องเป็นเลขบัตรประชาชน 13 หลัก";
  }

  return null;
}

// ------------------------------------------------------
// PAGE COMPONENT
// ------------------------------------------------------
export default function LoginPage() {
  const [role, setRole] = useState<Role>("student");
  const [username, setUsername] = useState("");  // student → รหัสนักศึกษา / staff/teacher → email
  const [password, setPassword] = useState("");  // เลขบัตรประชาชน 13 หลัก

  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // ชื่อที่ดึงจาก Token Claims (หลังล็อกอิน)
  const [loggedName, setLoggedName] = useState("");

  const navigate = useNavigate();
  const roleText = useMemo(() => ROLE_LABEL[role], [role]);

  const onlyDigits = (v: string) => v.replace(/\D/g, "");

  const usernamePlaceholder =
    role === "student" ? "รหัสนักศึกษา 10 หลัก" : "namexx@kku.ac.th";

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

      // ----------------------------------------------------
      // SAVE TOKEN
      // ----------------------------------------------------
      if (remember) {
        localStorage.setItem("coop.token", res.token);
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
      setError(er instanceof Error ? er.message : String(er));
    } finally {
      setLoading(false);
    }
  }

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
              type="text"
              autoComplete="username"
              placeholder={usernamePlaceholder}
              value={username}
              onChange={(e) =>
                setUsername(
                  role === "student"
                    ? onlyDigits(e.target.value).slice(0, 10)
                    : e.target.value
                )
              }
              required
              inputMode={role === "student" ? "numeric" : "email"}
            />

            <label className="label" htmlFor="password" style={{ marginLeft: 10 }}>
              รหัสผ่าน (เลขบัตรประชาชน)
            </label>
            <input
              id="password"
              className="input"
              type="password"
              inputMode="numeric"
              placeholder="เลขบัตรประชาชน 13 หลัก"
              value={password}
              onChange={(e) => setPassword(onlyDigits(e.target.value).slice(0, 13))}
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

          <p className="footnote">
            · ตอนนี้ใช้ username ตามบทบาท
            และ password = เลขบัตรประชาชน 13 หลัก
          </p>
        </div>
      </div>

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