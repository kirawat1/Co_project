// src/components/api.ts

//
// const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

const USE_MOCK = false; // เปลี่ยนเป็น false เพื่อใช้ API จริง
// ✅ ใช้บทบาทเฉพาะ 3 แบบนี้
export type Role = "student" | "staff" | "teacher";

export interface SigninPayload {
  role: Role;
  email: string;        // student = รหัสนักศึกษา / staff/teacher = email มข.
  password: string;     // เลขบัตรประชาชน 13 หลัก
}

export interface SignupPayload {
  role: Role;
  email: string;
  password: string;
}

// Token Claims ที่ถอดออกจาก token ได้
export interface TokenClaims {
  role: Role;
  email: string;
  studentId?: string;
  staffName?: string;
  teacherName?: string;

  iat: number;  // issued-at
  exp: number;  // expire time
}

export interface AuthRes {
  ok: boolean;
  message?: string;
  token?: string;      // base64 ของ TokenClaims
  user?: TokenClaims;
}

// ======================================================
// UTIL — สร้าง Token Claims แบบ Mock
// ======================================================
function createMockClaims(payload: SigninPayload): TokenClaims {
  return {
    role: payload.role,
    email: payload.email,

    studentId: payload.role === "student" ? payload.email : undefined,
    staffName: payload.role === "staff" ? "เจ้าหน้าที่มหาวิทยาลัย" : undefined,
    teacherName: payload.role === "teacher" ? "อาจารย์ประจำวิชา" : undefined,

    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 4, // หมดอายุใน 4 ชั่วโมง
  };
}

function encodeToken(claims: TokenClaims): string {
  return btoa(JSON.stringify(claims));
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
  body: SigninPayload | SignupPayload
): Promise<AuthRes> {
  const r = await fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!r.ok) throw new Error(`HTTP ${r.status}`);

  return r.json() as Promise<AuthRes>;
}

// ======================================================
// MOCK API
// ======================================================

function mockSignin(payload: SigninPayload): AuthRes {
  const claims = createMockClaims(payload);
  const token = encodeToken(claims);

  return {
    ok: true,
    token,
    user: claims,
    message: "เข้าสู่ระบบสำเร็จ (MOCK)",
  };
}

function mockSignup(payload: SignupPayload): AuthRes {
  return {
    ok: true,
    message: "สมัครสมาชิกสำเร็จ",
    token: encodeToken({
      role: payload.role,
      email: payload.email,
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 4,
    }),
  };
}


// ======================================================

export const AuthAPI = {
  signin: (data: SigninPayload) =>
    USE_MOCK ? Promise.resolve(mockSignin(data)) : realFetch("signin", data),

  signup: (data: SignupPayload) =>
    USE_MOCK ? Promise.resolve(mockSignup(data)) : realFetch("signup", data),

  decodeToken,
};