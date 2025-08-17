// src/components/api.ts
export type Role = "student" | "staff" | "mentor";

export interface SignPayload { role: Role; email: string; password: string; }
export interface AuthUser { email: string; role: Role; name?: string; }
export interface AuthResponse { ok: boolean; token?: string; message?: string; user?: AuthUser; }

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? "").toLowerCase() === "true";

// helpers
const normalizeEmail = (v: string) => v.trim().toLowerCase();
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const asStringOr = (d: string, v: unknown) => (typeof v === "string" ? v : d);
const getProp = <T extends "string" | "boolean">(obj: unknown, key: string, kind: T) => {
  if (!isRecord(obj) || !(key in obj)) return undefined;
  const val = (obj as Record<string, unknown>)[key];
  if (kind === "string") return typeof val === "string" ? (val as string) : undefined;
  return typeof val === "boolean" ? (val as boolean) : undefined;
};
const getMessageFrom = (obj: unknown, fallback: string) =>
  asStringOr(fallback, getProp(obj, "message", "string"));

// validators
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const isStudentId10 = (v: string) => /^\d{10}$/.test(v);
const isThaiPhone10 = (v: string) => /^0\d{9}$/.test(v);

export const validateByRole = (role: Role, email: string, password: string): string | null => {
  const e = normalizeEmail(email);
  if (!isEmail(e)) return "อีเมลไม่ถูกต้อง";
  if (role === "student" && !isStudentId10(password)) return "รหัสนักศึกษาไม่ถูกต้อง ต้องเป็นตัวเลข 10 หลัก";
  if ((role === "staff" || role === "mentor") && !isThaiPhone10(password))
    return "รหัสผ่านไม่ถูกต้อง ต้องเป็นเบอร์โทร 10 หลักขึ้นต้นด้วย 0";
  return null;
};

// ---- Real API ----
async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  let data: unknown = null;
  try {
    data = await res.clone().json();
  } catch (_err: unknown) {
    // response ไม่ใช่ JSON ก็ปล่อยไว้
    void _err; // ใช้ตัวแปร เพื่อไม่ให้ no-unused-vars ฟ้อง
  }

  if (!res.ok) {
    const msg = getMessageFrom(data, `HTTP ${res.status}`);
    throw new Error(msg);
  }

  const okVal = getProp(data, "ok", "boolean");
  if (okVal === false) {
    const msg = getMessageFrom(data, "เกิดข้อผิดพลาด");
    throw new Error(msg);
  }

  return data as T;
}

async function realSignin(payload: SignPayload): Promise<AuthResponse> {
  const p = { ...payload, email: normalizeEmail(payload.email) };
  return postJSON<AuthResponse>(`${API_BASE}/auth/signin`, p);
}
async function realSignup(payload: SignPayload): Promise<AuthResponse> {
  const p = { ...payload, email: normalizeEmail(payload.email) };
  return postJSON<AuthResponse>(`${API_BASE}/auth/signup`, p);
}

// ---- MOCK ----
type MockAcc = { email: string; role: Role; password: string; name?: string };
const ACC_KEY = "coop.mock.accounts.v1";
const loadMock = (): MockAcc[] => {
  try {
    const raw = localStorage.getItem(ACC_KEY);
    return raw ? (JSON.parse(raw) as MockAcc[]) : [];
  } catch (_err: unknown) {
    // localStorage เสียรูปหรือ parse ไม่ได้
    void _err;
    return [];
  }
};
const saveMock = (list: MockAcc[]) => localStorage.setItem(ACC_KEY, JSON.stringify(list));

if (USE_MOCK && loadMock().length === 0) {
  saveMock([
    { role: "student", email: "std001@kkumail.com",    password: "6501234567", name: "Student One" },
    { role: "staff",   email: "admin01@kkumail.ac.th", password: "0812345678", name: "Admin One" },
    { role: "mentor",  email: "mentor01@company.com",  password: "0912345678", name: "Mentor One" },
  ]);
}

const mockDelay = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms));

async function mockSignin(payload: SignPayload): Promise<AuthResponse> {
  const email = normalizeEmail(payload.email);
  const err = validateByRole(payload.role, email, payload.password);
  if (err) return { ok: false, message: err };
  await mockDelay();

  const found = loadMock().find(a => a.role === payload.role && a.email.toLowerCase() === email);
  if (!found || found.password !== payload.password) return { ok: false, message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  return {
    ok: true,
    token: "MOCK_TOKEN_" + window.btoa(`${found.email}:${Date.now()}`),
    user: { email: found.email, role: found.role, name: found.name },
  };
}

async function mockSignup(payload: SignPayload): Promise<AuthResponse> {
  const email = normalizeEmail(payload.email);
  const err = validateByRole(payload.role, email, payload.password);
  if (err) return { ok: false, message: err };
  await mockDelay();

  const list = loadMock();
  const exists = list.some(a => a.role === payload.role && a.email.toLowerCase() === email);
  if (exists) return { ok: false, message: "มีบัญชีนี้อยู่แล้วในบทบาทนี้" };

  list.unshift({ email, password: payload.password, role: payload.role, name: "New User" });
  saveMock(list);
  return { ok: true, message: "สมัครสำเร็จ โปรดเข้าสู่ระบบ" };
}

export const AuthAPI = {
  signin: (p: SignPayload) => (USE_MOCK ? mockSignin(p) : realSignin(p)),
  signup: (p: SignPayload) => (USE_MOCK ? mockSignup(p) : realSignup(p)),
};
