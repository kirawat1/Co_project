// src/components/api.ts (ตัวอย่างโครงสำหรับ mock/fallback)
import type { Role } from "./api"; // ถ้ามี type แยก

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

type AuthRes = {
  ok: boolean;
  message?: string;
  token?: string;
  user?: { role: Role; email: string };
};

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
function mockSignup({ role, email }: { role: Role; email: string }): AuthRes {
  return { ok: true, message: "สมัครสำเร็จ (mock)", token: "mock-token", user: { role, email } };
}

export const AuthAPI = {
  async signin({ role, email, password }: { role: Role; email: string; password: string }): Promise<AuthRes> {
    if (USE_MOCK) return mockSignin({ role, email });
    try { return await realFetch("signin", { role, email, password }); }
    catch (e) { return { ok: false, message: (e as Error).message }; }
  },
  async signup({ role, email, password }: { role: Role; email: string; password: string }): Promise<AuthRes> {
    if (USE_MOCK) return mockSignup({ role, email });
    try { return await realFetch("signup", { role, email, password }); }
    catch (e) {
      // เผื่อ dev ลืมรันแบ็กเอนด์: ตกกลับ mock ได้ด้วย
      if (import.meta.env.DEV) return mockSignup({ role, email });
      return { ok: false, message: (e as Error).message };
    }
  },
};
export type Role = "student" | "staff" | "mentor";

export function validateByRole(role: Role, email: string, password: string): string | null {
  const e = email.trim();
  if (!e) return "กรุณากรอกอีเมล";
  if (!e.includes("@")) return "รูปแบบอีเมลไม่ถูกต้อง";
  if (role === "student") {
    if (!/^\d{10}$/.test(password)) return "รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก";
  } else {
    if (!/^0\d{9}$/.test(password)) return "รหัสผ่านต้องเป็นเบอร์โทร 10 หลักขึ้นต้นด้วย 0";
  }
  return null;
};
