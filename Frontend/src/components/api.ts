// src/components/api.ts

// ✅ ใช้บทบาทเฉพาะ 3 แบบนี้
export type Role = "student" | "staff" | "teacher";

export interface SigninPayload {
  role: Role;
  email: string; // ใช้อีเมลมหาวิทยาลัย (@kkumail.com หรือ @kku.ac.th)
  password: string; // เลขบัตรประชาชน 13 หลัก
}

export interface SignupPayload {
  role: Role;
  email: string;
  password: string;
}

// Token Claims ที่ถอดออกจาก token ได้
export interface TokenClaims {
  id?: number;
  role: Role;
  email: string;
  studentId?: string;
  staffName?: string;
  teacherName?: string;

  iat: number; // issued-at
  exp: number; // expire time
}

export interface AuthRes {
  ok: boolean;
  message?: string;
  token?: string; // base64 ของ TokenClaims
  user?: TokenClaims;
}

function decodeToken(token: string): TokenClaims | null {
  try {
    return JSON.parse(atob(token)) as TokenClaims;
  } catch {
    return null;
  }
}

// ======================================================
// REAL FETCH (ต่อ API จริงภายหลังได้)
// ======================================================

async function realFetch(
  path: string,
  body: SigninPayload | SignupPayload,
): Promise<AuthRes> {
  const r = await fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // backend ส่งเหตุผลเป็นภาษาไทยมาใน body เสมอ (เช่น rate limit ตอบ 429 พร้อม
  // "ลองใหม่ภายหลัง (พยายาม login มากเกินไป)") — ถ้าโยนแค่ `HTTP <status>` ทิ้งไป
  // ผู้ใช้จะเห็นรหัสดิบบนหน้าล็อกอินและไม่รู้ว่าต้องทำอะไรต่อ
  if (!r.ok) {
    const detail = await r
      .json()
      .then((d: { message?: string }) => d?.message)
      .catch(() => undefined);
    throw new Error(detail || `HTTP ${r.status}`);
  }

  return r.json() as Promise<AuthRes>;
}

export const AuthAPI = {
  signin: (data: SigninPayload) => realFetch("signin", data),
  signup: (data: SignupPayload) => realFetch("signup", data),
  decodeToken,
};
