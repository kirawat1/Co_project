// Frontend/src/components/api.ts

const USE_MOCK = false;

export type Role = "student" | "staff" | "teacher";

type AuthRes = {
  ok: boolean;
  message?: string;
  token?: string;
  user?: { role: Role; email: string };
};

type SigninParams = { role: Role; email: string; password: string };

async function realFetch(path: string, body: any): Promise<AuthRes> {
  const r = await fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export const AuthAPI = {
  async signin({ role, email, password }: SigninParams): Promise<AuthRes> {
    if (USE_MOCK)
      return { ok: true, token: "mock-token", user: { role, email } };
    try {
      return await realFetch("signin", { role, email, password });
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
};

// ตรวจสอบ input ก่อน submit
export function validateByRole(
  role: Role,
  email: string,
  password: string
): string | null {
  const e = email.trim();
  const p = password.trim();

  if (role === "student") {
    if (!/^\d{10}$/.test(e)) return "รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก";
    if (!/^\d{13}$/.test(p)) return "รหัสผ่านต้องเป็นเลขบัตรประชาชน 13 หลัก";
  } else {
    const uniEmail = /^[^@\s]+@(kkumail\.com|kku\.ac\.th)$/i;
    if (!uniEmail.test(e)) return "กรุณากรอกอีเมลมหาวิทยาลัยให้ถูกต้อง";
    if (!/^\d{13}$/.test(p)) return "รหัสผ่านต้องเป็นเลขบัตรประชาชน 13 หลัก";
  }

  return null;
}

export async function getProfile(token: string) {
  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}
