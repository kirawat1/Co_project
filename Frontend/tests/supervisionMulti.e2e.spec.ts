/**
 * tests/supervisionMulti.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * ระบบนิเทศเมื่อมีผู้ใช้หลายคน หลายหลักสูตร ทำงานพร้อมกัน (backend + DB จริง · ลบทุกอย่างที่สร้างตอนจบ)
 * ต้องรัน backend ที่ :5000 และ frontend ที่ :5173 (backend ตั้ง API_RATE_LIMIT_MAX สูง — เทสต์ยิงคำขอพร้อมกันเยอะ)
 *
 * หลักสูตรทดสอบ X และ Y (สร้างใหม่ — ไม่ปนข้อมูลจริง) · เจ้าหน้าที่ 2 คน
 * อาจารย์: coopX / coopY (ประจำวิชาหลักสูตรเดียว) · coopXY (ประจำวิชาสองหลักสูตร) · advX / advY (ที่ปรึกษา)
 *          advBoth (ที่ปรึกษาของนักศึกษาทั้ง X และ Y) · coT (หลักสูตร Y เป็นอาจารย์ร่วมของนักศึกษาทั้งสองหลักสูตร) · other
 *
 * A ขอบเขตการมองเห็นตามหลักสูตร · B ทำข้ามหลักสูตร/ข้ามบทบาท · C กดซ้ำ/หลายคนกดพร้อมกัน · D ข้อมูลแปลก ๆ · E ปุ่มบนหน้าเว็บ (ดับเบิลคลิก)
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { test, expect, type Page } from "@playwright/test";
import { WorldKit, prisma, day, BACKEND_DIR, type KStudent, type KTeacher, type KUser } from "./helpers/worldKit";

const require = createRequire(import.meta.url);
const XLSX = require(path.join(BACKEND_DIR, "node_modules/xlsx"));
const jwt = require(path.join(BACKEND_DIR, "node_modules/jsonwebtoken"));
const SUP_DIR = path.join(BACKEND_DIR, "uploads/supervision");
const API = "http://localhost:5000";

const k = new WorldKit("ZU");
test.describe.configure({ mode: "serial" });

// ── ข้อมูลของ world ──
let MX = "", MY = "", P = 0;
let staff1: KUser, staff2: KUser;
const t = {} as Record<"coopX" | "coopY" | "coopXY" | "advX" | "advY" | "advBoth" | "coT" | "other", KTeacher>;
const s: Record<string, KStudent> = {};
const ap: Record<string, number> = {};
const comp = {} as Record<"shared" | "cx", { id: string; name: string }>;
const newFiles: string[] = [];
let supFilesBefore = new Set<string>();

// ── ตัวช่วย ──
const at = (d: string, hhmm: string) => new Date(`${d}T${hhmm}:00+07:00`).toISOString();
const slot = (n: number, time: string, type: "ONSITE" | "ONLINE" = "ONSITE") => `${day(n)}|${time}|${type}`;
const no = (n: number | string) => `ZU${k.tail}.26/${n}`;
interface Res { status: number; body: any }
async function req(token: string, method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
  const init: RequestInit = { method, headers: { Authorization: `Bearer ${token}`, ...headers } };
  if (body instanceof FormData) init.body = body;
  else if (typeof body === "string") { init.body = body; (init.headers as any)["Content-Type"] ??= "application/json"; }
  else if (body !== undefined) { init.body = JSON.stringify(body); (init.headers as any)["Content-Type"] = "application/json"; }
  const r = await fetch(API + url, init);
  return { status: r.status, body: await r.json().catch(() => null) };
}
const statuses = (rs: Res[]) => rs.map((r) => r.status).sort();
const count = (rs: Res[], code: number) => rs.filter((r) => r.status === code).length;
const no500 = (rs: Res[]) => expect(rs.filter((r) => r.status >= 500).map((r) => JSON.stringify(r.body)), "ห้ามมี 500").toEqual([]);
const appt = (key: string) => prisma.supervisionAppointment.findUnique({ where: { studentId: s[key].pk }, include: { coTeachers: true } });
const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

const propose = (key: string, dates: unknown, extra: Record<string, unknown> = {}) =>
  req(s[key].token, "POST", "/api/coop/supervision/propose", { proposedDates: typeof dates === "string" ? dates : JSON.stringify(dates), supervisionType: "ONSITE", ...extra });
const review = (tk: string, id: number | string, body: object) => req(tk, "PUT", `/api/teacher/supervisions/${id}/review`, body);
const approve = (tk: string, id: number, isoDate: string) => review(tk, id, { action: "APPROVE", confirmedDate: isoDate, acknowledgeUnavailable: true });
const editDate = (tk: string, id: number | string, isoDate: unknown) => req(tk, "PUT", `/api/admin/supervisions/${id}/confirmed-date`, { confirmedDate: isoDate });
const assign = (tk: string, id: number | string, ids: unknown) => req(tk, "PUT", `/api/admin/supervisions/${id}/co-teachers`, { coTeacherIds: ids });
const complete = (tk: string, id: number, via: "teacher" | "admin") => req(tk, "PUT", `/api/${via}/supervisions/${id}/complete`, {});
const letterPending = (tk: string, id: number, body: object) => req(tk, "PUT", `/api/admin/supervisions/${id}/letter-pending`, body);
const PDF = Buffer.from("%PDF-1.4\nsupervision multi e2e\n%%EOF");
function letterForm(fields: Record<string, string>, file: { bytes: Buffer; name: string; type: string } | null = { bytes: PDF, name: "signed.pdf", type: "application/pdf" }) {
  const fd = new FormData();
  for (const [kk, v] of Object.entries(fields)) fd.append(kk, v);
  if (file) fd.append("file", new Blob([file.bytes], { type: file.type }), file.name);
  return fd;
}
const upload = (tk: string, id: number, fields: Record<string, string>, file?: Parameters<typeof letterForm>[1]) =>
  req(tk, "POST", `/api/admin/supervisions/${id}/upload-letter`, letterForm(fields, file));
const listIds = (r: Res) => new Set<number>((r.body?.supervisions || r.body?.data || []).map((x: any) => x.id));
const ours = (set: Set<number>, keys: string[]) => keys.filter((kk) => set.has(ap[kk]));

// ══════════════════════════════════════════════════════
// สร้างข้อมูล
// ══════════════════════════════════════════════════════
type Seed = { major: "X" | "Y"; adv: keyof typeof t; company?: "shared" | "cx" | null; status?: string;
  appt?: { status: string; teacher?: keyof typeof t; proposed: string[]; confirmed?: [number, string, string]; co?: (keyof typeof t)[]; letter?: boolean } };

test.beforeAll(async () => {
  const up = await fetch(`${API}/api/auth/me`).catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน");
  supFilesBefore = new Set(fs.readdirSync(SUP_DIR));

  staff1 = await k.staff("staff1");
  staff2 = await k.staff("staff2");
  MX = await k.major("X");
  MY = await k.major("Y");
  const tdefs: [keyof typeof t, string, string[]][] = [
    ["coopX", MX, [MX]], ["coopY", MY, [MY]], ["coopXY", MX, [MX, MY]], ["advX", MX, []], ["advY", MY, []],
    ["advBoth", MX, []], ["coT", MY, []], ["other", MX, []],
  ];
  for (const [key, major, coop] of tdefs) t[key] = await k.teacher(key, { major, coop });

  P = await k.period(7, { [MX]: {}, [MY]: {} });
  await prisma.coopPeriodMajor.updateMany({
    where: { periodId: P },
    data: { isSupervisionOpen: true, supervisionStartDate: new Date(`${day(-5)}T00:00:00Z`), supervisionEndDate: new Date(`${day(150)}T00:00:00Z`) },
  });
  comp.shared = await k.company(`บริษัท ZU${k.tail} ร่วม จำกัด`, [], staff1.userId);
  comp.cx = await k.company(`บริษัท ZU${k.tail} เอกซ์ จำกัด`, [], staff1.userId);

  const C = (d: number, a: string, b: string) => [d, a, b] as [number, string, string];
  const plan: Record<string, Seed> = {
    // A/B ขอบเขต
    x1: { major: "X", adv: "advX", company: "shared", appt: { status: "PENDING_TEACHER", proposed: [slot(30, "13:00-14:00")] } },
    x2: { major: "X", adv: "advX", company: "cx", appt: { status: "DATE_CONFIRMED", proposed: [slot(30, "09:00-10:00")], confirmed: C(30, "09:00", "10:00") } },
    x3: { major: "X", adv: "advBoth", company: "shared", appt: { status: "PENDING_TEACHER", proposed: [slot(51, "09:00-10:00")] } },
    y1: { major: "Y", adv: "advY", company: "shared", appt: { status: "PENDING_TEACHER", proposed: [slot(31, "13:00-14:00")] } },
    y2: { major: "Y", adv: "advY", appt: { status: "DATE_CONFIRMED", proposed: [slot(31, "09:00-10:00")], confirmed: C(31, "09:00", "10:00") } },
    y3: { major: "Y", adv: "advBoth", company: "shared", appt: { status: "PENDING_TEACHER", proposed: [slot(51, "13:00-14:00")] } },
    // C กดซ้ำ / พร้อมกัน
    cProp: { major: "X", adv: "advX" },
    cAppr: { major: "X", adv: "advX", appt: { status: "PENDING_TEACHER", proposed: [slot(40, "09:00-10:00")] } },
    lpA: { major: "X", adv: "advX", appt: { status: "DATE_CONFIRMED", proposed: [slot(45, "09:00-10:00")], confirmed: C(45, "09:00", "10:00") } },
    lpB: { major: "Y", adv: "advY", appt: { status: "DATE_CONFIRMED", proposed: [slot(45, "09:00-10:00")], confirmed: C(45, "09:00", "10:00") } },
    upl: { major: "X", adv: "advX", appt: { status: "DATE_CONFIRMED", proposed: [slot(46, "09:00-10:00")], confirmed: C(46, "09:00", "10:00") } },
    cmp: { major: "Y", adv: "advY", appt: { status: "LETTER_UPLOADED", proposed: [slot(-1, "09:00-10:00")], confirmed: C(-1, "09:00", "10:00"), letter: true } },
    asg: { major: "X", adv: "advX", appt: { status: "PENDING_TEACHER", proposed: [slot(47, "09:00-10:00")] } },
    race: { major: "X", adv: "advX", appt: { status: "PENDING_TEACHER", proposed: [slot(48, "09:00-10:00")] } },
    avl: { major: "X", adv: "advX", appt: { status: "PENDING_TEACHER", proposed: [slot(49, "09:00-10:00"), slot(49, "13:00-14:00"), slot(50, "09:00-10:00")], co: ["coT"] } },
    grpX: { major: "X", adv: "advBoth", company: "shared", appt: { status: "PENDING_TEACHER", proposed: [slot(52, "09:00-10:00")] } },
    grpY: { major: "Y", adv: "advBoth", company: "shared", appt: { status: "PENDING_TEACHER", proposed: [slot(52, "10:00-11:00")] } },
    // D ข้อมูลแปลก
    weird: { major: "X", adv: "advX" },
    wApp: { major: "X", adv: "advX", appt: { status: "PENDING_TEACHER", proposed: [slot(53, "09:00-10:00")] } },
    trashed: { major: "X", adv: "advX" },
    // E หน้าเว็บ
    uiS: { major: "X", adv: "advX" },
    uiT: { major: "X", adv: "advX", appt: { status: "PENDING_TEACHER", proposed: [slot(55, "09:00-10:00")] } },
    uiM: { major: "Y", adv: "advY", appt: { status: "DATE_CONFIRMED", proposed: [slot(56, "09:00-10:00")], confirmed: C(56, "09:00", "10:00") } },
  };
  // คู่ที่ชนกัน: อาจารย์คนเดียวกัน (advBoth) อนุมัติสองคนเวลาทับกันพร้อมกัน · อาจารย์ร่วมคนเดียวกันในสองนัด · แก้วันสองนัดให้ทับกันพร้อมกัน
  for (let i = 0; i < 3; i++) {
    plan[`clA${i}`] = { major: "X", adv: "advBoth", appt: { status: "PENDING_TEACHER", proposed: [slot(60 + i, "09:00-10:00")] } };
    plan[`clB${i}`] = { major: "Y", adv: "advBoth", appt: { status: "PENDING_TEACHER", proposed: [slot(60 + i, "09:30-10:30")] } };
    plan[`coA${i}`] = { major: "X", adv: "advX", appt: { status: "PENDING_TEACHER", proposed: [slot(70 + i, "09:00-10:00")], co: ["coT"] } };
    plan[`coB${i}`] = { major: "Y", adv: "advY", appt: { status: "PENDING_TEACHER", proposed: [slot(70 + i, "09:00-10:00")], co: ["coT"] } };
    plan[`edA${i}`] = { major: "X", adv: "advX", appt: { status: "DATE_CONFIRMED", proposed: [slot(80 + i, "08:00-09:00")], confirmed: C(80 + i, "08:00", "09:00") } };
    plan[`edB${i}`] = { major: "Y", adv: "advX", appt: { status: "DATE_CONFIRMED", proposed: [slot(80 + i, "13:00-14:00")], confirmed: C(80 + i, "13:00", "14:00") } };
  }

  let n = 0;
  for (const [key, p] of Object.entries(plan)) {
    n++;
    const company = p.company === undefined ? comp.cx.id : p.company ? comp[p.company].id : null;
    s[key] = await k.student(key, n, { major: p.major === "X" ? MX : MY, status: p.status || "INTERNSHIP_STARTED", periodId: P, companyId: company, advisor: t[p.adv].pk });
    if (!p.appt) continue;
    const a = p.appt;
    let letterPath: string | null = null;
    if (a.letter) {
      letterPath = `ZU${k.tail}-${key}.pdf`;
      fs.writeFileSync(path.join(SUP_DIR, letterPath), PDF);
      newFiles.push(letterPath);
    }
    const row = await prisma.supervisionAppointment.create({
      data: {
        studentId: s[key].pk, teacherId: t[a.teacher || p.adv].pk, status: a.status, supervisionType: "ONSITE",
        proposedDates: JSON.stringify(a.proposed), officialLetterPath: letterPath,
        ...(a.confirmed ? { confirmedDate: new Date(at(day(a.confirmed[0]), a.confirmed[1])), confirmedEndDate: new Date(at(day(a.confirmed[0]), a.confirmed[2])) } : {}),
        ...(a.co?.length ? { coTeacherName: a.co.map((c) => t[c].name).join(", ") } : {}),
      },
    });
    for (const c of a.co || []) await prisma.supervisionCoTeacher.create({ data: { appointmentId: row.id, teacherId: t[c].pk } });
    ap[key] = row.id;
  }
});

test.afterAll(async () => {
  // ไฟล์หนังสือที่เทสต์สร้าง (seed + อัปโหลดผ่าน API) · เลขหนังสือที่จองไว้
  const pks = Object.values(s).map((x) => x.pk);
  const rows = await prisma.supervisionAppointment.findMany({ where: { studentId: { in: pks } }, select: { officialLetterPath: true } });
  const created = fs.readdirSync(SUP_DIR).filter((f) => !supFilesBefore.has(f));
  for (const f of new Set([...newFiles, ...rows.map((r) => r.officialLetterPath).filter(Boolean) as string[], ...created])) {
    try { fs.unlinkSync(path.join(SUP_DIR, f)); } catch { /* ลบแล้ว */ }
  }
  await prisma.docNumberLock.deleteMany({ where: { number: { startsWith: `ZU${k.tail}` } } });
  await prisma.visit.deleteMany({ where: { studentId: { in: pks } } });
  await k.cleanup();
  await k.disconnect();
});

// ══════════════════════════════════════════════════════
// A. ขอบเขตการมองเห็นตามหลักสูตร
// ══════════════════════════════════════════════════════
test.describe("A. ใครเห็นอะไร (หลายหลักสูตร)", () => {
  const X = ["x1", "x2", "x3"], Y = ["y1", "y2", "y3"];

  test("หน้าจัดการ: เจ้าหน้าที่เห็นทั้ง X/Y · ประจำวิชา X เห็นแค่ X · Y แค่ Y · ประจำวิชาสองหลักสูตรเห็นทั้งคู่ · ที่ปรึกษาทั่วไป/นักศึกษา 403", async () => {
    const get = (tk: string, h: Record<string, string> = {}) => req(tk, "GET", `/api/admin/supervisions?coopPeriodId=${P}`, undefined, h);
    for (const tk of [staff1.token, staff2.token]) expect(ours(listIds(await get(tk)), [...X, ...Y])).toEqual([...X, ...Y]);
    expect(ours(listIds(await get(t.coopX.token)), [...X, ...Y])).toEqual(X);
    expect(ours(listIds(await get(t.coopY.token)), [...X, ...Y])).toEqual(Y);
    expect(ours(listIds(await get(t.coopXY.token)), [...X, ...Y])).toEqual([...X, ...Y]);
    for (const tk of [t.advX.token, t.advBoth.token, t.coT.token, s.x1.token]) expect((await get(tk)).status).toBe(403);
  });

  test("ตัวกรองหลักสูตรบนแถบบน: เจ้าหน้าที่เลือก X เหลือแค่ X · ประจำวิชา X เลือก Y ไม่ได้ขยายสิทธิ์ · ค่าแปลก (SQL / ยาว 5,000 ตัว / ภาษาไทย) ไม่ 500", async () => {
    const get = (tk: string, f: string) => req(tk, "GET", `/api/admin/supervisions?coopPeriodId=${P}`, undefined, { "X-Major-Filter": f });
    expect(ours(listIds(await get(staff1.token, MX)), [...X, ...Y])).toEqual(X);
    expect(ours(listIds(await get(t.coopX.token, MY)), [...X, ...Y])).toEqual(X);
    expect(ours(listIds(await get(t.coopXY.token, MY)), [...X, ...Y])).toEqual(Y);
    for (const f of ["' OR 1=1 --", "x".repeat(5000), "หลักสูตร\u0000", "__none__", "*"]) {
      const r = await get(staff1.token, encodeURIComponent(f));
      expect(r.status, f.slice(0, 20)).toBe(200);
      expect(ours(listIds(r), [...X, ...Y]), f.slice(0, 20)).toEqual([]);
    }
  });

  test("หน้าอาจารย์: ที่ปรึกษาเห็นนัดของตัวเองทุกหลักสูตร · อาจารย์ร่วม (หลักสูตร Y) เห็นนัดที่ตัวเองร่วมของนักศึกษา X · ไม่เห็นของคนอื่น", async () => {
    const mine = async (tk: string) => listIds(await req(tk, "GET", "/api/teacher/supervisions"));
    const both = await mine(t.advBoth.token);
    expect(ours(both, ["x3", "y3", "grpX", "grpY", "x1", "y1"])).toEqual(["x3", "y3", "grpX", "grpY"]);
    const co = await mine(t.coT.token);
    expect(ours(co, ["avl", "coA0", "coB0", "x1", "y1", "y2"])).toEqual(["avl", "coA0", "coB0"]);
    expect(ours(await mine(t.advX.token), ["x1", "x2", "y1", "y2", "x3"])).toEqual(["x1", "x2"]);
    expect(ours(await mine(t.other.token), ["x1", "x2", "y1", "y2"])).toEqual([]);
    expect((await req(s.x1.token, "GET", "/api/teacher/supervisions")).status).toBe(403);
  });

  test("ปฏิทิน: นักศึกษาเห็นนัดหลักสูตรตัวเอง · อาจารย์เห็นหลักสูตรตัวเอง + นัดที่ตัวเองนิเทศ/ร่วม + หลักสูตรที่ประจำวิชา · เจ้าหน้าที่เห็นหมด", async () => {
    const cal = async (tk: string, h: Record<string, string> = {}) => {
      const r = await req(tk, "GET", "/api/coop/supervision/calendar", undefined, h);
      expect(r.status).toBe(200);
      return new Set<number>(r.body.events.map((e: any) => e.id));
    };
    const pair = ["x2", "y2"];
    expect(ours(await cal(s.x1.token), pair)).toEqual(["x2"]);
    expect(ours(await cal(s.y1.token), pair)).toEqual(["y2"]);
    expect(ours(await cal(staff2.token), pair)).toEqual(pair);
    expect(ours(await cal(staff2.token, { "X-Major-Filter": MY }), pair)).toEqual(["y2"]);
    expect(ours(await cal(t.coopX.token), pair)).toEqual(["x2"]);
    expect(ours(await cal(t.coopXY.token), pair)).toEqual(pair);
    expect(ours(await cal(t.advBoth.token), pair)).toEqual(["x2"]);   // หลักสูตรตัวเอง X
    expect(ours(await cal(t.coT.token), pair)).toEqual(["y2"]);       // หลักสูตรตัวเอง Y
    expect(ours(await cal(t.advX.token), [...pair, "edB0"])).toEqual(["x2", "edB0"]); // edB0 = นักศึกษา Y ที่ advX นิเทศ
  });

  test("ส่งออกตารางนิเทศ (Excel): ประจำวิชา X ได้แค่ X · เจ้าหน้าที่ได้ทั้งคู่ · ที่ปรึกษาทั่วไป 403", async () => {
    const codes = async (tk: string) => {
      const r = await fetch(`${API}/api/admin/supervisions/export?coopPeriodId=${P}`, { headers: { Authorization: `Bearer ${tk}` } });
      expect(r.status).toBe(200);
      const wb = XLSX.read(Buffer.from(await r.arrayBuffer()), { type: "buffer" });
      const text = wb.SheetNames.map((n: string) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n");
      return ["x2", "y2"].filter((kk) => text.includes(s[kk].studentId));
    };
    expect(await codes(t.coopX.token)).toEqual(["x2"]);
    expect(await codes(t.coopY.token)).toEqual(["y2"]);
    expect(await codes(staff1.token)).toEqual(["x2", "y2"]);
    expect((await fetch(`${API}/api/admin/supervisions/export`, { headers: { Authorization: `Bearer ${t.advX.token}` } })).status).toBe(403);
  });

  test("นิเทศตามบริษัท: ที่ปรึกษาสองหลักสูตรเห็นนักศึกษา X และ Y ของบริษัทเดียวกันรวมกัน · ที่ปรึกษาคนอื่นไม่เห็น", async () => {
    const r = await req(t.advBoth.token, "GET", "/api/teacher/supervisions/by-company");
    expect(r.status).toBe(200);
    const shared = r.body.companies.find((c: any) => c.companyId === comp.shared.id);
    expect(shared.students.map((x: any) => x.appointmentId).sort()).toEqual([ap.x3, ap.y3, ap.grpX, ap.grpY].sort());
    const other = await req(t.advX.token, "GET", "/api/teacher/supervisions/by-company");
    const sh2 = other.body.companies.find((c: any) => c.companyId === comp.shared.id);
    expect(sh2.students.map((x: any) => x.appointmentId)).toEqual([ap.x1]);
  });
});

// ══════════════════════════════════════════════════════
// B. ทำข้ามหลักสูตร / ข้ามบทบาท
// ══════════════════════════════════════════════════════
test.describe("B. ทำข้ามหลักสูตร/บทบาท ต้องโดนกัน", () => {
  test("ประจำวิชา X แก้วัน/จบนิเทศ/มอบหมายอาจารย์ร่วม/ตั้งช่วงนิเทศของหลักสูตร Y = 403 (และกลับกัน) · ข้อมูลไม่เปลี่ยน", async () => {
    const before = await appt("y2");
    expect((await editDate(t.coopX.token, ap.y2, at(day(32), "09:00"))).status).toBe(403);
    expect((await editDate(t.coopY.token, ap.x2, at(day(32), "09:00"))).status).toBe(403);
    expect((await complete(t.coopX.token, ap.cmp, "admin")).status).toBe(403);
    expect((await assign(t.coopX.token, ap.y1, [t.coT.pk])).status).toBe(403);
    expect((await assign(t.coopY.token, ap.x1, [t.coT.pk])).status).toBe(403);
    const period = (tk: string, major: string) => req(tk, "POST", "/api/admin/supervision-periods", { periodId: P, major, isSupervisionOpen: true, supervisionStartDate: day(-5), supervisionEndDate: day(150) });
    expect((await period(t.coopX.token, MY)).status).toBe(403);
    expect((await period(t.coopY.token, MX)).status).toBe(403);
    expect((await period(t.coopXY.token, MY)).status).toBe(200);
    expect((await period(staff2.token, MX)).status).toBe(200);
    const after = await appt("y2");
    expect([after?.status, iso(after!.confirmedDate), after?.coTeachers.length]).toEqual([before?.status, iso(before!.confirmedDate), before?.coTeachers.length]);
    expect((await appt("cmp"))?.status).toBe("LETTER_UPLOADED");
  });

  test("อาจารย์ที่ไม่ใช่ผู้นิเทศหลักพิจารณาวันไม่ได้ — ที่ปรึกษาหลักสูตรอื่น · อาจารย์ร่วม · ประจำวิชา · เจ้าหน้าที่ (ไม่มีโปรไฟล์อาจารย์ = 404 ไม่ใช่ 500)", async () => {
    const body = { action: "APPROVE", confirmedDate: at(day(30), "13:00") };
    expect((await review(t.advY.token, ap.x1, body)).status).toBe(403);
    expect((await review(t.coT.token, ap.coA0, { action: "APPROVE", confirmedDate: at(day(70), "09:00") })).status).toBe(403);
    expect((await review(t.coopX.token, ap.x1, body)).status).toBe(403);
    expect((await review(staff1.token, ap.x1, body)).status).toBe(404);
    expect((await review(t.advY.token, ap.x1, { action: "REJECT", rejectReason: "แอบปฏิเสธ" })).status).toBe(403);
    expect((await appt("x1"))?.status).toBe("PENDING_TEACHER");
  });

  test("ระบุวันว่าง: เฉพาะอาจารย์ร่วมของนัดนั้น — ผู้นิเทศหลัก/อาจารย์อื่น/เจ้าหน้าที่/นักศึกษา ไม่ได้", async () => {
    const avail = (tk: string, id: number) => req(tk, "PUT", `/api/teacher/supervisions/${id}/availability`, { availableDates: [day(49)] });
    expect((await avail(t.coT.token, ap.x1)).status).toBe(403);
    expect((await avail(t.advX.token, ap.avl)).status).toBe(403);
    expect((await avail(t.other.token, ap.avl)).status).toBe(403);
    expect((await avail(staff1.token, ap.avl)).status).toBe(403);
    expect((await avail(s.avl.token, ap.avl)).status).toBe(403);
  });

  test("นักศึกษาเรียกทุก API ของอาจารย์/เจ้าหน้าที่ = 403 (รวมนัดของตัวเอง)", async () => {
    const tk = s.x2.token, id = ap.x2;
    const calls: [string, string, unknown?][] = [
      ["GET", `/api/admin/supervisions`], ["GET", `/api/admin/supervisions/export`], ["GET", `/api/admin/supervision-periods`],
      ["POST", `/api/admin/supervision-periods`, { periodId: P, major: MX }], ["PUT", `/api/admin/supervisions/${id}/confirmed-date`, { confirmedDate: at(day(33), "09:00") }],
      ["PUT", `/api/admin/supervisions/${id}/co-teachers`, { coTeacherIds: [] }], ["PUT", `/api/admin/supervisions/${id}/letter-pending`, { docNumber: no(1) }],
      ["PUT", `/api/admin/supervisions/${id}/complete`, {}], ["PUT", `/api/teacher/supervisions/${id}/review`, { action: "REJECT", rejectReason: "x" }],
      ["PUT", `/api/teacher/supervisions/${id}/complete`, {}], ["GET", `/api/teacher/supervisions/by-company`], ["POST", `/api/teacher/supervisions/confirm-group`, { appointmentIds: [id] }],
    ];
    for (const [m, u, b] of calls) expect((await req(tk, m, u, b)).status, `${m} ${u}`).toBe(403);
    expect((await appt("x2"))?.status).toBe("DATE_CONFIRMED");
  });

  test("โทเคนแปลก: ไม่มี / ปลอม (คีย์ผิด) / หมดอายุ / นักศึกษาที่อยู่ในถังขยะ = 401", async () => {
    const forged = jwt.sign({ id: t.advX.userId, role: "teacher", tv: 0 }, "not-the-secret");
    const expired = jwt.sign({ id: t.advX.userId, role: "teacher", tv: 0 }, process.env.JWT_SECRET, { expiresIn: -10 });
    for (const tk of ["", "null", forged, expired]) expect((await req(tk, "GET", "/api/teacher/supervisions")).status, tk.slice(0, 10)).toBe(401);
    await prisma.student.update({ where: { id: s.trashed.pk }, data: { deletedAt: new Date() } });
    expect((await propose("trashed", [slot(57, "09:00-10:00")])).status).toBe(401);
    expect((await req(s.trashed.token, "GET", "/api/coop/supervision/calendar")).status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════
// C. กดซ้ำ / หลายคนกดพร้อมกัน
// ══════════════════════════════════════════════════════
test.describe("C. กดซ้ำและกดพร้อมกัน", () => {
  test("นักศึกษากดส่งวันนิเทศรัว 8 ครั้งพร้อมกัน → นัดเดียว · ไม่มี 500 · อย่างน้อย 1 สำเร็จ", async () => {
    const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => propose("cProp", [slot(41, `${String(8 + (i % 3)).padStart(2, "0")}:00-${String(9 + (i % 3)).padStart(2, "0")}:00`)])));
    no500(rs);
    expect(count(rs, 200)).toBeGreaterThan(0);
    expect(await prisma.supervisionAppointment.count({ where: { studentId: s.cProp.pk } })).toBe(1);
    expect((await appt("cProp"))?.status).toBe("PENDING_TEACHER");
  });

  test("อาจารย์กดยืนยันวันเดียวกันรัว 6 ครั้ง → สำเร็จครั้งเดียว ที่เหลือ 400/409 · สถานะยืนยันแล้ว", async () => {
    const rs = await Promise.all(Array.from({ length: 6 }, () => approve(t.advX.token, ap.cAppr, at(day(40), "09:00"))));
    no500(rs);
    expect(count(rs, 200), statuses(rs).join(",")).toBe(1);
    const a = await appt("cAppr");
    expect([a?.status, iso(a!.confirmedDate)]).toEqual(["DATE_CONFIRMED", at(day(40), "09:00")]);
  });

  test("อาจารย์คนเดียวยืนยันนักศึกษา X และ Y เวลาทับกัน 'พร้อมกัน' (3 คู่) → แต่ละคู่สำเร็จได้คนเดียว (ห้ามนัดซ้อน)", async () => {
    const pairs = [0, 1, 2].map((i) => [approve(t.advBoth.token, ap[`clA${i}`], at(day(60 + i), "09:00")), approve(t.advBoth.token, ap[`clB${i}`], at(day(60 + i), "09:30"))]);
    const rs = await Promise.all(pairs.flat());
    no500(rs);
    for (let i = 0; i < 3; i++) {
      const [a, b] = [await appt(`clA${i}`), await appt(`clB${i}`)];
      expect([a?.status, b?.status].filter((x) => x === "DATE_CONFIRMED").length, `คู่ที่ ${i + 1}: ${rs[i * 2].status}/${rs[i * 2 + 1].status}`).toBe(1);
    }
  });

  test("อาจารย์ร่วมคนเดียวกันอยู่ในสองนัด (X ของ advX · Y ของ advY) ที่สองคนกดยืนยันเวลาเดียวกันพร้อมกัน → ยืนยันได้นัดเดียว", async () => {
    const rs = await Promise.all([0, 1, 2].flatMap((i) => [approve(t.advX.token, ap[`coA${i}`], at(day(70 + i), "09:00")), approve(t.advY.token, ap[`coB${i}`], at(day(70 + i), "09:00"))]));
    no500(rs);
    for (let i = 0; i < 3; i++) {
      const [a, b] = [await appt(`coA${i}`), await appt(`coB${i}`)];
      expect([a?.status, b?.status].filter((x) => x === "DATE_CONFIRMED").length, `คู่ที่ ${i + 1}`).toBe(1);
    }
  });

  test("เจ้าหน้าที่กับประจำวิชา Y แก้วันของสองนัด (อาจารย์คนเดียวกัน) ไปเวลาเดียวกันพร้อมกัน → แก้ได้นัดเดียว", async () => {
    const rs = await Promise.all([0, 1, 2].flatMap((i) => [editDate(staff1.token, ap[`edA${i}`], at(day(90 + i), "10:00")), editDate(t.coopY.token, ap[`edB${i}`], at(day(90 + i), "10:00"))]));
    no500(rs);
    for (let i = 0; i < 3; i++) {
      const [a, b] = [await appt(`edA${i}`), await appt(`edB${i}`)];
      const moved = [a, b].filter((x) => iso(x!.confirmedDate) === at(day(90 + i), "10:00")).length;
      expect(moved, `คู่ที่ ${i + 1}: ${rs[i * 2].status}/${rs[i * 2 + 1].status}`).toBe(1);
    }
  });

  test("ยืนยันแบบกลุ่ม (นักศึกษา X+Y บริษัทเดียวกัน) กดรัว 3 ครั้ง → สำเร็จครั้งเดียว · คิวต่อกันไม่ทับ · กลุ่มเดียวกัน", async () => {
    const body = { appointmentIds: [ap.grpX, ap.grpY], confirmedDate: at(day(52), "09:00") };
    const rs = await Promise.all(Array.from({ length: 3 }, () => req(t.advBoth.token, "POST", "/api/teacher/supervisions/confirm-group", body)));
    no500(rs);
    expect(count(rs, 200), statuses(rs).join(",")).toBe(1);
    const [x, y] = [await appt("grpX"), await appt("grpY")];
    expect([x?.status, y?.status]).toEqual(["DATE_CONFIRMED", "DATE_CONFIRMED"]);
    expect(x?.groupId).toBeTruthy();
    expect(y?.groupId).toBe(x?.groupId);
    expect(new Date(x!.confirmedEndDate!).getTime()).toBeLessThanOrEqual(new Date(y!.confirmedDate!).getTime());
  });

  test("เจ้าหน้าที่สองคนใส่เลขหนังสือเดียวกันให้คนละนัดพร้อมกัน → ได้คนเดียว อีกคน 409 · กดซ้ำนัดเดิมเลขเดิมไม่พัง", async () => {
    const rs = await Promise.all([letterPending(staff1.token, ap.lpA, { docNumber: no(500) }), letterPending(staff2.token, ap.lpB, { docNumber: no(500) })]);
    no500(rs);
    expect(statuses(rs)).toEqual([200, 409]);
    const winner = rs[0].status === 200 ? "lpA" : "lpB";
    const again = await Promise.all(Array.from({ length: 4 }, () => letterPending(staff1.token, ap[winner], { docNumber: no(500) })));
    no500(again);
    expect(count(again, 200)).toBe(4);
    const [a, b] = [await appt("lpA"), await appt("lpB")];
    expect([a?.letterDraftNumber, b?.letterDraftNumber].filter((x) => x === no(500))).toHaveLength(1);
  });

  test("อัปโหลดหนังสือลงนามรัว 4 ครั้งพร้อมกัน → ออกหนังสือครั้งเดียว · ไฟล์ค้างไม่มี (เหลือไฟล์เดียวที่นัดอ้างถึง)", async () => {
    const before = new Set(fs.readdirSync(SUP_DIR));
    const rs = await Promise.all(Array.from({ length: 4 }, () => upload(staff1.token, ap.upl, { docNumber: no(600) })));
    no500(rs);
    expect(count(rs, 200), statuses(rs).join(",")).toBe(1);
    const a = await appt("upl");
    expect([a?.status, a?.letterDocNumber]).toEqual(["LETTER_UPLOADED", no(600)]);
    const added = fs.readdirSync(SUP_DIR).filter((f) => !before.has(f));
    expect(added, "ไฟล์ที่เพิ่มขึ้น").toEqual([a?.officialLetterPath]);
  });

  test("จบนิเทศพร้อมกัน 5 คน (ที่ปรึกษา · ประจำวิชา Y · ประจำวิชา XY · เจ้าหน้าที่ 2 คน) → สำเร็จครั้งเดียว · ไม่มี 500", async () => {
    const rs = await Promise.all([
      complete(t.advY.token, ap.cmp, "teacher"), complete(t.coopY.token, ap.cmp, "admin"), complete(t.coopXY.token, ap.cmp, "admin"),
      complete(staff1.token, ap.cmp, "admin"), complete(staff2.token, ap.cmp, "admin"),
    ]);
    no500(rs);
    expect(count(rs, 200), statuses(rs).join(",")).toBe(1);
    expect((await appt("cmp"))?.status).toBe("COMPLETED");
  });

  test("มอบหมายอาจารย์ร่วมพร้อมกันจาก 3 คน (รายชื่อต่างกัน) → ผลสุดท้ายเป็นชุดใดชุดหนึ่งครบ · ชื่อที่แสดงตรงกับรายการจริง", async () => {
    const sets: [string, number[]][] = [[staff1.token, [t.coT.pk]], [t.coopX.token, [t.other.pk]], [t.coopXY.token, [t.coT.pk, t.other.pk]]];
    for (let round = 0; round < 3; round++) {
      const rs = await Promise.all(sets.map(([tk, ids]) => assign(tk, ap.asg, ids)));
      no500(rs);
      const a = await appt("asg");
      const ids = a!.coTeachers.map((c) => c.teacherId).sort();
      expect(sets.map(([, x]) => [...x].sort().join(",")), `รอบ ${round + 1}: ${ids}`).toContain(ids.join(","));
      const names = ids.map((id) => Object.values(t).find((x) => x.pk === id)!.name).sort();
      expect(String(a?.coTeacherName || "").split(",").map((x) => x.trim()).filter(Boolean).sort(), `รอบ ${round + 1}`).toEqual(names);
    }
  });

  test("นักศึกษาแก้วันที่เสนอ 'ขณะที่' อาจารย์กดยืนยัน (5 รอบ) → ถ้ายืนยันแล้ว วันที่ยืนยันต้องเป็นวันที่นักศึกษาเสนอไว้จริง", async () => {
    for (let i = 0; i < 5; i++) {
      await prisma.supervisionAppointment.update({ where: { id: ap.race }, data: { status: "PENDING_TEACHER", confirmedDate: null, confirmedEndDate: null, proposedDates: JSON.stringify([slot(48, "09:00-10:00")]) } });
      const rs = await Promise.all([approve(t.advX.token, ap.race, at(day(48), "09:00")), propose("race", [slot(58 + (i % 3), "13:00-14:00")])]);
      no500(rs);
      const a = await appt("race");
      if (a?.status === "DATE_CONFIRMED") {
        const proposedDays = (JSON.parse(a.proposedDates) as string[]).map((e) => e.slice(0, 10));
        expect(proposedDays, `รอบ ${i + 1}`).toContain(new Date(a.confirmedDate!).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }));
      } else expect(a?.status).toBe("PENDING_TEACHER");
    }
  });

  test("อาจารย์ร่วมกดบันทึกวันว่างรัว 5 ครั้ง (ค่าต่างกัน) → แถวเดียว ค่าเป็นชุดใดชุดหนึ่ง · ไม่มี 500", async () => {
    const choices = [[day(49)], [day(50)], [day(49), day(50)], [], [day(49)]];
    const rs = await Promise.all(choices.map((c) => req(t.coT.token, "PUT", `/api/teacher/supervisions/${ap.avl}/availability`, { availableDates: c })));
    no500(rs);
    const rows = await prisma.supervisionCoTeacher.findMany({ where: { appointmentId: ap.avl } });
    expect(rows).toHaveLength(1);
    expect(choices.map((c) => JSON.stringify([...c].sort()))).toContain(JSON.stringify(JSON.parse(rows[0].availableDates || "[]").sort()));
  });
});

// ══════════════════════════════════════════════════════
// D. ข้อมูลแปลก ๆ
// ══════════════════════════════════════════════════════
test.describe("D. ส่งข้อมูลแปลก ๆ", () => {
  test("เสนอวัน: เวลาที่ไม่มีจริง / วันที่ไม่มีจริง / ไม่ใช่รายการ / เกิน 30 ตัวเลือก / รูปแบบนิเทศแปลก / ลิงก์อันตราย → 400 และไม่บันทึก", async () => {
    const bad: [string, unknown, Record<string, unknown>?][] = [
      ["ชั่วโมงเกิน 23", [`${day(57)}|08:00-99:00|ONSITE`]],
      ["25 นาฬิกา", [`${day(57)}|25:00-26:00|ONSITE`]],
      ["นาที 60", [`${day(57)}|09:60-10:30|ONSITE`]],
      ["30 กุมภา", [`2027-02-30|09:00-10:00|ONSITE`]],
      ["เดือน 13", [`2026-13-01|09:00-10:00|ONSITE`]],
      ["object", "{}"], ["ตัวเลข", "[1,2,3]"], ["null", "[null]"], ["สตริงเดี่ยว", '"x"'], ["ไม่ใช่ JSON", "not json"], ["ว่าง", "[]"],
      ["31 ตัวเลือก", Array.from({ length: 31 }, (_, i) => `${day(20 + i)}|09:00-10:00|ONSITE`)],
      ["SQL", ["'); DROP TABLE Student; --"]],
      ["type แปลก", [slot(57, "09:00-10:00")], { supervisionType: "HYBRID" }],
      ["javascript:", [slot(57, "09:00-10:00", "ONLINE")], { supervisionType: "ONLINE", onlineLink: "javascript:alert(1)" }],
      ["ftp", [slot(57, "09:00-10:00", "ONLINE")], { supervisionType: "ONLINE", onlineLink: "ftp://example.com/x" }],
      ["data:", [slot(57, "09:00-10:00", "ONLINE")], { supervisionType: "ONLINE", onlineLink: "data:text/html,<script>alert(1)</script>" }],
    ];
    const got: string[] = [];
    for (const [name, dates, extra] of bad) {
      const r = await propose("weird", dates, extra);
      if (r.status !== 400) got.push(`${name} → ${r.status}`);
    }
    expect(got, "กรณีที่ควรได้ 400").toEqual([]);
    expect(await appt("weird")).toBeNull();
  });

  test("เสนอวัน: proposedDates ไม่ใช่ string / body ว่าง / ไม่ใช่ JSON / ข้อความยาวมาก (70,000 ตัว) → ไม่ 500", async () => {
    const tk = s.weird.token;
    const rs = [
      await req(tk, "POST", "/api/coop/supervision/propose", { proposedDates: [slot(57, "09:00-10:00")], supervisionType: "ONSITE" }),
      await req(tk, "POST", "/api/coop/supervision/propose", {}),
      await req(tk, "POST", "/api/coop/supervision/propose", "{not json", { "Content-Type": "application/json" }),
      await req(tk, "POST", "/api/coop/supervision/propose", "proposedDates=x", { "Content-Type": "text/plain" }),
      await propose("weird", [slot(57, "09:00-10:00"), "ก".repeat(70_000)]),
      await propose("weird", [slot(57, "09:00-10:00", "ONLINE")], { supervisionType: "ONLINE", onlineLink: `https://meet.example.com/${"a".repeat(70_000)}` }),
    ];
    no500(rs);
    expect(rs.slice(0, 4).map((r) => r.status).every((x) => x === 400 || x === 413)).toBe(true);
  });

  test("พิจารณาวัน: id แปลก (ตัวอักษร / ติดลบ / ศูนย์ / เลขใหญ่เกิน int) · action แปลก · วันแปลก → 400/404 ไม่ 500 · นัดยังรออยู่", async () => {
    const tk = t.advX.token;
    const ids = ["abc", "-1", "0", "99999999999999999999", "1e400", "%27OR%201=1"];
    const r1 = await Promise.all(ids.map((id) => review(tk, id, { action: "REJECT", rejectReason: "x" })));
    no500(r1);
    expect(r1.map((r) => r.status).every((x) => [400, 403, 404].includes(x)), statuses(r1).join(",")).toBe(true);
    const bodies: object[] = [
      { action: "approve", confirmedDate: at(day(53), "09:00") }, { action: ["APPROVE"], confirmedDate: at(day(53), "09:00") }, { action: null },
      { action: "APPROVE", confirmedDate: "garbage" }, { action: "APPROVE", confirmedDate: 12345 }, { action: "APPROVE", confirmedDate: {} },
      { action: "APPROVE", confirmedDate: "2027-02-30T09:00:00+07:00" }, { action: "APPROVE", confirmedDate: at(day(54), "09:00") },
      { action: "REJECT", rejectReason: "   " }, { action: "REJECT", rejectReason: { x: 1 } },
    ];
    const r2 = [];
    for (const b of bodies) r2.push(await review(tk, ap.wApp, b));
    no500(r2);
    expect(r2.map((r) => r.status).every((x) => x === 400), statuses(r2).join(",")).toBe(true);
    expect((await appt("wApp"))?.status).toBe("PENDING_TEACHER");
  });

  test("ปฏิเสธพร้อมเหตุผลยาวมาก (ภาษาไทย 30,000 ตัว ≈ 90 KB) → 400 หรือบันทึกได้ ไม่ 500", async () => {
    const r = await review(t.advX.token, ap.wApp, { action: "REJECT", rejectReason: "ก".repeat(30_000) });
    expect(r.status, JSON.stringify(r.body)).not.toBeGreaterThanOrEqual(500);
    if (r.status === 200) await prisma.supervisionAppointment.update({ where: { id: ap.wApp }, data: { status: "PENDING_TEACHER", rejectReason: null } });
  });

  test("มอบหมายอาจารย์ร่วม: ค่าแปลก (ไม่ใช่ array / ตัวอักษร / ติดลบ / ไม่มีจริง / ซ้ำ / 300 คน / null) → 400/404 หรือจัดการถูก ไม่ 500", async () => {
    const tk = staff2.token, id = ap.x1;
    const cases: unknown[] = ["abc", ["abc"], [-1], [0], [999_999_999], [1.5], [{ id: 1 }], null, Array.from({ length: 300 }, (_, i) => i + 1), [t.coT.pk, t.coT.pk, String(t.coT.pk)]];
    const rs = [];
    for (const c of cases) rs.push(await assign(tk, id, c));
    no500(rs);
    const a = await appt("x1");
    const ids = a!.coTeachers.map((c) => c.teacherId);
    expect(new Set(ids).size, "ห้ามมีอาจารย์ซ้ำ").toBe(ids.length);
    expect(ids.every((x) => Object.values(t).some((tt) => tt.pk === x) || x > 0)).toBe(true);
  });

  test("แก้วันที่ยืนยันแล้ว: ค่าแปลก (ว่าง / ตัวอักษร / ปีเกิน / object) → 400 ไม่ 500 · วันเดิมไม่เปลี่ยน", async () => {
    const before = iso((await appt("x2"))!.confirmedDate);
    const rs = [];
    for (const v of ["", "nonsense", "+275760-09-14T00:00:00Z", {}, [], null, "2027-02-30T09:00:00+07:00"]) rs.push(await editDate(staff1.token, ap.x2, v));
    no500(rs);
    expect(rs.map((r) => r.status).every((x) => x === 400), statuses(rs).join(",")).toBe(true);
    expect(iso((await appt("x2"))!.confirmedDate)).toBe(before);
  });

  test("ออกหนังสือ: ไฟล์ .exe ปลอมเป็น PDF / ไฟล์ 0 ไบต์ / ไม่มีไฟล์ / เลขหนังสือยาว 5,000 ตัว / วันที่ผิด → 400 ไม่ 500 · สถานะไม่เปลี่ยน", async () => {
    const id = ap.lpA;
    const exe = { bytes: Buffer.from("MZ\x90\x00\x03\x00\x00\x00this program cannot be run"), name: "signed.pdf", type: "application/pdf" };
    const zero = { bytes: Buffer.alloc(0), name: "signed.pdf", type: "application/pdf" };
    const html = { bytes: Buffer.from("<html><script>alert(1)</script></html>"), name: "signed.pdf", type: "application/pdf" };
    const rs = [
      await upload(staff1.token, id, { docNumber: no(700) }, exe),
      await upload(staff1.token, id, { docNumber: no(701) }, zero),
      await upload(staff1.token, id, { docNumber: no(702) }, html),
      await upload(staff1.token, id, { docNumber: no(703) }, null),
      await upload(staff1.token, id, { docNumber: "ก".repeat(5000) }),
      await upload(staff1.token, id, { docNumber: no(704), docDate: "2027-02-30" }),
      await letterPending(staff1.token, ap.lpB, { docNumber: "ก".repeat(5000) }),
    ];
    no500(rs);
    expect(rs.map((r) => r.status).every((x) => x === 400 || x === 409), rs.map((r) => r.status).join(",")).toBe(true);
    expect((await appt("lpA"))?.status).toBe("DATE_CONFIRMED");
  });

  test("นัดพร้อมกัน (เรียก API ตรง): ต่างบริษัท → 400 · แต่ละคนได้ช่วงที่ตัวเองเสนอ (X เช้า · Y บ่าย) ไม่ถูกต่อคิว", async () => {
    const group = (tk: string, ids: number[], d: string) => req(tk, "POST", "/api/teacher/supervisions/confirm-group", { appointmentIds: ids, confirmedDate: at(d, "00:00") });
    const r1 = await group(t.advX.token, [ap.x1, ap.wApp], day(30));
    expect([r1.status, r1.body?.message]).toEqual([400, expect.stringMatching(/บริษัทเดียวกัน/)]);
    const r2 = await group(t.advBoth.token, [ap.y3, ap.x3], day(51));
    expect(r2.status, JSON.stringify(r2.body)).toBe(200);
    const [x, y] = [await appt("x3"), await appt("y3")];
    expect([iso(x!.confirmedDate), iso(x!.confirmedEndDate)]).toEqual([at(day(51), "09:00"), at(day(51), "10:00")]);
    expect([iso(y!.confirmedDate), iso(y!.confirmedEndDate)]).toEqual([at(day(51), "13:00"), at(day(51), "14:00")]);
  });

  test("ตั้งช่วงนิเทศ: periodId/หลักสูตร/วันที่แปลก → 400/404 ไม่ 500 · ค่าเดิมไม่เปลี่ยน", async () => {
    const save = (b: object) => req(staff1.token, "POST", "/api/admin/supervision-periods", { periodId: P, major: MX, isSupervisionOpen: true, supervisionStartDate: day(-5), supervisionEndDate: day(150), ...b });
    const rs = [];
    for (const b of [{ periodId: "abc" }, { periodId: 999_999_999 }, { major: "NOPE-ZU" }, { major: "" }, { supervisionStartDate: "2027-02-30" }, { supervisionStartDate: day(10), supervisionEndDate: day(5) }, { supervisionStartDate: "+275760-09-14" }, { major: ["X"] }]) rs.push(await save(b));
    no500(rs);
    expect(rs.map((r) => r.status).every((x) => x === 400 || x === 404), statuses(rs).join(",")).toBe(true);
    const row = await prisma.coopPeriodMajor.findUnique({ where: { periodId_major: { periodId: P, major: MX } } });
    expect(row?.supervisionEndDate?.toISOString().slice(0, 10)).toBe(day(150));
  });
});

// ══════════════════════════════════════════════════════
// E. ปุ่มบนหน้าเว็บ — ดับเบิลคลิก/กดรัว
// ══════════════════════════════════════════════════════
test.describe("E. ปุ่มบนหน้าเว็บ (กดรัว)", () => {
  async function asUser(page: Page, token: string, userId: number, to: string) {
    await page.goto("/");
    await page.evaluate(([tk, uid]) => {
      localStorage.clear();
      localStorage.setItem("coop.token", tk); localStorage.setItem("coop.userId", uid); localStorage.setItem("coop.theme", "light");
    }, [token, String(userId)]);
    await page.goto(to, { waitUntil: "networkidle" });
  }
  const countRequests = (page: Page, method: string, part: string) => {
    const hits: string[] = [];
    page.on("request", (r) => { if (r.method() === method && r.url().includes(part)) hits.push(r.url()); });
    return hits;
  };
  const SUBMIT = "🚀 ส่งข้อมูลให้อาจารย์พิจารณา";

  test("นักศึกษา: ดับเบิลคลิกปุ่มยืนยันการส่ง → ส่งคำขอครั้งเดียว · ได้นัดเดียว", async ({ page }) => {
    await asUser(page, s.uiS.token, s.uiS.userId, "/student/supervision");
    await page.locator('input[type="date"]').first().fill(day(55));
    await page.locator('select:has(option[value="ONSITE"])').first().selectOption("ONSITE");
    const hits = countRequests(page, "POST", "/api/coop/supervision/propose");
    await page.getByRole("button", { name: SUBMIT }).click();
    await page.getByRole("button", { name: "ส่งให้อาจารย์พิจารณา", exact: true }).dblclick();
    await expect(page.getByText("รออาจารย์ยืนยันวันนิเทศ")).toBeVisible();
    await page.waitForTimeout(500);
    expect(hits, "จำนวนคำขอ").toHaveLength(1);
    expect(await prisma.supervisionAppointment.count({ where: { studentId: s.uiS.pk } })).toBe(1);
  });

  test("อาจารย์: ดับเบิลคลิก \"ยืนยันวันนี้\" → ส่งคำขอครั้งเดียว · ไม่มีข้อความผิดพลาด", async ({ page }) => {
    await asUser(page, t.advX.token, t.advX.userId, "/teacher/review-supervision");
    await page.locator("select", { has: page.locator("option", { hasText: "📚 ทุกปีการศึกษา" }) }).selectOption("all");
    await page.getByPlaceholder("🔍 ค้นหารหัส / ชื่อ / บริษัท...").fill(s.uiT.studentId);
    await page.locator("tr", { hasText: s.uiT.studentId }).getByRole("button", { name: "พิจารณาวันนิเทศ" }).click();
    const hits = countRequests(page, "PUT", `/api/teacher/supervisions/${ap.uiT}/review`);
    await page.getByRole("button", { name: "เลือกวันนี้" }).first().click();
    await page.getByRole("button", { name: "ยืนยันวันนี้", exact: true }).dblclick();
    await expect(page.getByText("บันทึกผลการพิจารณาเรียบร้อยแล้ว")).toBeVisible();
    await page.waitForTimeout(500);
    expect(hits, "จำนวนคำขอ").toHaveLength(1);
    await expect(page.getByText(/สามารถอนุมัติได้เฉพาะ|ผิดพลาด/)).toHaveCount(0);
    expect((await appt("uiT"))?.status).toBe("DATE_CONFIRMED");
  });

  test("เจ้าหน้าที่: ดับเบิลคลิก \"บันทึก\" ตอนแก้วันนิเทศ → ส่งคำขอครั้งเดียว · วันใหม่ถูกบันทึก", async ({ page }) => {
    await asUser(page, staff2.token, staff2.userId, "/admin/supervision-manager");
    await page.locator("select", { has: page.locator("option", { hasText: "📚 ทุกปีการศึกษา" }) }).selectOption(String(P));
    await page.getByPlaceholder("ค้นหา รหัส / ชื่อ / บริษัท / อาจารย์...").fill(s.uiM.studentId);
    await page.locator(".responsive-table tr", { hasText: s.uiM.studentId }).getByRole("button", { name: "✏️ แก้ไขวัน" }).click();
    await page.locator('input[type="date"]').last().fill(day(57));
    await page.locator('input[type="time"]').fill("13:00");
    const hits = countRequests(page, "PUT", `/api/admin/supervisions/${ap.uiM}/confirmed-date`);
    await page.getByRole("button", { name: "💾 บันทึกวันใหม่" }).click();
    await page.getByRole("button", { name: "บันทึก", exact: true }).dblclick();
    await expect(page.getByText("แก้ไขวันนิเทศเรียบร้อยแล้ว")).toBeVisible();
    await page.waitForTimeout(500);
    expect(hits, "จำนวนคำขอ").toHaveLength(1);
    expect(iso((await appt("uiM"))!.confirmedDate)).toBe(at(day(57), "13:00"));
  });
});
