// src/components/api.ts
// const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const USE_MOCK = true; // เปลี่ยนเป็น false เพื่อใช้ API จริง
// ✅ ใช้บทบาทเฉพาะ 3 แบบนี้
export type Role = "student" | "staff" | "teacher";

type AuthRes = {
  ok: boolean;
  message?: string;
  token?: string;
  user?: { role: Role; email: string };
};

// ขอพารามฯ แยกชัดเจน
type SigninParams = { role: Role; email: string; password: string };
// สมัครได้เฉพาะ "student"
type SignupParams = { role: "student"; email: string; password: string };

async function realFetch(path: string, body: any): Promise<AuthRes> {
  const r = await fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function mockSignin({ role, email }: { role: Role; email: string }): AuthRes {
  return { ok: true, token: "mock-token", user: { role, email } };
}
function mockSignup({
  role,
  email,
}: {
  role: "student";
  email: string;
}): AuthRes {
  return {
    ok: true,
    message: "สมัครสำเร็จ (mock)",
    token: "mock-token",
    user: { role, email },
  };
}

export const AuthAPI = {
  async signin({ role, email, password }: SigninParams): Promise<AuthRes> {
    if (USE_MOCK) return mockSignin({ role, email });
    try {
      return await realFetch("signin", { role, email, password });
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },

  // ✅ พารามฯ role ถูกจำกัดเป็น "student" ตั้งแต่ระดับ type
  async signup({ role, email, password }: SignupParams): Promise<AuthRes> {
    if (USE_MOCK) return mockSignup({ role, email });
    try {
      return await realFetch("signup", { role, email, password });
    } catch (e) {
      // dev mode fallback
      if (import.meta.env.DEV) return mockSignup({ role, email });
      return { ok: false, message: (e as Error).message };
    }
  },
};

// (ตัวเลือก) export ตัวตรวจสอบให้ใช้ซ้ำได้
export function validateByRole(
  role: Role,
  email: string,
  password: string
): string | null {
  const e = email.trim();
  if (!e) return "กรุณากรอกอีเมล";
  if (!e.includes("@")) return "รูปแบบอีเมลไม่ถูกต้อง";
  if (role === "student") {
    if (!/^\d{10}$/.test(password)) return "รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก";
  } else {
    if (!/^0\d{9}$/.test(password))
      return "รหัสผ่านต้องเป็นเบอร์โทร 10 หลักขึ้นต้นด้วย 0";
  }
  return null;
}
