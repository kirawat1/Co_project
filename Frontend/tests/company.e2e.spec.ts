/**
 * tests/company.e2e.spec.ts
 * ─────────────────────────────────────────────────────
 * ข้อมูลบริษัท (ใช้ร่วมทุกรุ่น) · ผู้ติดต่อ (HR) · พี่เลี้ยง · นำเข้าบริษัทหลายแห่ง · นักศึกษาเลือกบริษัท/ผู้ติดต่อ
 * · นำเข้านักศึกษาจาก Excel — backend + DB จริง (ข้อมูล ZC ลบทิ้งตอนจบ · MAJOR_IMPORT_ALIASES คืนค่าเดิม)
 *
 * กติกาที่ผู้ใช้ตัดสิน 2026-11-04: ออกหนังสือขอความอนุเคราะห์แล้ว (รวมร่างรอลงนาม) นักศึกษาเปลี่ยนบริษัท/ผู้ติดต่อเองไม่ได้
 * บั๊กที่แก้รอบนี้: ชื่อบริษัท/พี่เลี้ยงเป็นช่องว่างได้ (เพิ่มและแก้) · แก้บริษัทโดยไม่ส่งเว็บไซต์ = เว็บไซต์หาย
 *   · นำเข้า Excel ซ้ำล้างเบอร์โทร/ชั้นปีที่ไฟล์ไม่มี · พรีวิวนับอีเมลซ้ำในไฟล์เป็น "สร้างใหม่" ทุกแถว
 */
import { createRequire } from "node:module";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { api, type Res } from "./helpers/letterWorld";
import { WorldKit, BACKEND_DIR, prisma, type KStudent, type KTeacher, type KUser } from "./helpers/worldKit";

const XLSX = createRequire(import.meta.url)(path.join(BACKEND_DIR, "node_modules/xlsx"));
const k = new WorldKit("ZC");
test.describe.configure({ mode: "serial" });
const msg = (r: Res) => JSON.stringify(r.body);
const N = () => `${k.prefix}${k.tail}`;

let staff: KUser;
const t = {} as Record<"adv" | "coopCS" | "plain", KTeacher>;
const s = {} as Record<string, KStudent>;
let X: { id: string; name: string; contactIds: string[] }, Y: { id: string; name: string; contactIds: string[] };

test.beforeAll(async () => {
  const up = await fetch("http://localhost:5000/api/auth/me").catch(() => null);
  if (!up || up.status >= 500) throw new Error("ต้องรัน backend ที่ http://localhost:5000 ก่อน");
  staff = await k.staff();
  t.adv = await k.teacher("ที่ปรึกษา");
  t.coopCS = await k.teacher("ประจำวิชาCS", { coop: ["CS"] });
  t.plain = await k.teacher("ทั่วไป");
  X = await k.company(`บริษัท ${N()} เอ็กซ์ จำกัด`, ["เอชอาร์เอ็กซ์"], staff.userId);
  Y = await k.company(`บริษัท ${N()} วาย จำกัด`, ["เอชอาร์วาย"], staff.userId);
  const atX = { companyId: X.id, contactIds: X.contactIds };
  s.a = await k.student("a", 1, { ...atX });
  s.b = await k.student("b", 2, { ...atX });
  s.free = await k.student("free", 3, { ...atX, status: "QUALIFIED" });
  s.issued = await k.student("issued", 4, { ...atX, status: "REQ_LETTER_ISSUED" });
  s.pending = await k.student("pending", 5, { ...atX, status: "DOCS_APPROVED" });
  await prisma.studentCoop.update({ where: { studentId: s.pending.pk }, data: { reqLetterPendingAt: new Date() } });
  s.imp1 = await k.student("imp1", 6, { status: null, phone: "0811111111", year: "4" });
  s.uiLocked = await k.student("uiLocked", 7, { ...atX, status: "PLACEMENT_LETTER_ISSUED" });
  await k.snapshot("MAJOR_IMPORT_ALIASES");
});
test.afterAll(async () => { await k.cleanup(); await k.disconnect(); });

const addCompany = (token: string, body: object) => api(token, "POST", "/api/companies", body);
const company = (id: string) => prisma.company.findUnique({ where: { id }, include: { contacts: true, mentors: true } });

// ══════════════════════════════════════════════════════
// A. บริษัท
// ══════════════════════════════════════════════════════
test.describe("A. บริษัท", () => {
  test("เพิ่ม: นักศึกษา/อาจารย์/เจ้าหน้าที่เพิ่มได้ · ไม่มีชื่อ 400 · (ใหม่) ชื่อมีแต่ช่องว่าง 400 · เว็บไซต์ไม่มี http เติมให้ · scheme อื่น 400 · ชื่อถูกตัดช่องว่าง", async () => {
    expect((await addCompany(s.a.token, {})).status).toBe(400);
    let r = await addCompany(s.a.token, { name: "   " });
    expect(r.status, msg(r)).toBe(400);
    expect((await addCompany(s.a.token, { name: `${N()} ผิด`, website: "javascript:alert(1)" })).status).toBe(400);
    r = await addCompany(s.a.token, { name: `  ${N()} นักศึกษาเพิ่ม  `, website: "www.zc-student.co.th", province: "ขอนแก่น" });
    expect(r.status, msg(r)).toBe(200);
    expect([r.body.company.name, r.body.company.website]).toEqual([`${N()} นักศึกษาเพิ่ม`, "https://www.zc-student.co.th"]);
    expect((await addCompany(t.plain.token, { name: `${N()} อาจารย์เพิ่ม` })).status).toBe(200);
    expect((await addCompany(staff.token, { name: `${N()} เจ้าหน้าที่เพิ่ม` })).status).toBe(200);
  });

  test("แก้: ไม่มีบริษัท 404 · (ใหม่) ชื่อว่าง 400 · (ใหม่) แก้ช่องอื่นโดยไม่ส่งเว็บไซต์ = เว็บไซต์เดิมอยู่ · ส่งค่าว่าง = ล้าง · เว็บไซต์ผิด 400", async () => {
    const c = (await addCompany(staff.token, { name: `${N()} แก้ไข`, website: "https://zc-edit.example.com", phone: "02" })).body.company;
    expect((await api(staff.token, "PUT", "/api/companies/nope", { name: "x" })).status).toBe(404);
    for (const name of ["", "   "]) expect((await api(s.a.token, "PUT", `/api/companies/${c.id}`, { name })).status, JSON.stringify(name)).toBe(400);
    let r = await api(s.a.token, "PUT", `/api/companies/${c.id}`, { phone: "043-000000" });
    expect(r.status, msg(r)).toBe(200);
    expect([(await company(c.id)).name, (await company(c.id)).website, (await company(c.id)).phone]).toEqual([`${N()} แก้ไข`, "https://zc-edit.example.com", "043-000000"]);
    expect((await api(s.a.token, "PUT", `/api/companies/${c.id}`, { website: "ftp://x" })).status).toBe(400);
    r = await api(s.a.token, "PUT", `/api/companies/${c.id}`, { website: "" });
    expect(r.status, msg(r)).toBe(200);
    expect((await company(c.id)).website).toBeNull();
  });

  test("ค้นหา: พิมพ์น้อยกว่า 2 ตัว = ว่าง · เจอตามชื่อ (พร้อมผู้ติดต่อ) · ลบ: นักศึกษาลบบริษัทที่คนอื่นเลือก 409 · เจ้าหน้าที่ได้รายชื่อก่อน → ยืนยันแล้วลบ · ไม่มีใครเลือก → ลบเลย", async () => {
    expect((await api(s.a.token, "GET", "/api/companies/search?q=Z")).body.data).toEqual([]);
    const found = (await api(s.a.token, "GET", `/api/companies/search?q=${encodeURIComponent(`${N()} เอ็กซ์`)}`)).body.data;
    expect(found.map((c: { id: string }) => c.id)).toEqual([X.id]);
    expect(found[0].contacts.map((c: { id: string }) => c.id)).toEqual(X.contactIds);

    const Z = await k.company(`บริษัท ${N()} แซด จำกัด`, [], staff.userId);
    await prisma.studentCoop.update({ where: { studentId: s.b.pk }, data: { companyId: Z.id } });
    let r = await api(s.a.token, "DELETE", `/api/companies/${Z.id}`);
    expect(r.status, msg(r)).toBe(409);
    r = await api(staff.token, "DELETE", `/api/companies/${Z.id}`);
    expect([r.status, r.body.code, r.body.students.map((x: { studentId: string }) => x.studentId)]).toEqual([409, "COMPANY_IN_USE", [s.b.studentId]]);
    r = await api(staff.token, "DELETE", `/api/companies/${Z.id}?confirm=1`);
    expect(r.status, msg(r)).toBe(200);
    expect((await k.coop(s.b.pk)).companyId).toBeNull();
    const lonely = (await addCompany(s.a.token, { name: `${N()} ไม่มีใครเลือก` })).body.company;
    expect((await api(s.a.token, "DELETE", `/api/companies/${lonely.id}`)).status).toBe(200);
    await prisma.studentCoop.update({ where: { studentId: s.b.pk }, data: { companyId: X.id } });
  });

  test("นำเข้าหลายแห่ง (เจ้าหน้าที่): อาจารย์/นักศึกษา 403 · ว่าง 400 · สร้างใหม่ · ชื่อซ้ำเติมเฉพาะช่องที่ว่าง (ไม่ทับ) · ไม่มีชื่อข้าม", async () => {
    const rows = [{ name: `${N()} นำเข้า1`, province: "ขอนแก่น" }, { name: X.name, province: "ไม่ควรทับ", email: "fill@zc.example.com" }, { name: "  " }];
    expect((await api(t.plain.token, "POST", "/api/companies/bulk", { companies: rows })).status).toBe(403);
    expect((await api(s.a.token, "POST", "/api/companies/bulk", { companies: rows })).status).toBe(403);
    expect((await api(staff.token, "POST", "/api/companies/bulk", { companies: [] })).status).toBe(400);
    const r = await api(staff.token, "POST", "/api/companies/bulk", { companies: rows });
    expect([r.status, r.body.created, r.body.updated, r.body.skipped]).toEqual([200, 1, 1, 1]);
    const x = await company(X.id);
    expect([x.province, x.email]).toEqual(["ขอนแก่น", "fill@zc.example.com"]);
  });
});

// ══════════════════════════════════════════════════════
// B. ผู้ติดต่อ (HR) · พี่เลี้ยง
// ══════════════════════════════════════════════════════
test.describe("B. ผู้ติดต่อ และ พี่เลี้ยง", () => {
  test("ผู้ติดต่อ: ไม่มีชื่อ/อีเมลผิด 400 · ไม่มีบริษัท 404 · เพิ่ม/แก้ได้ทุกบทบาท · นักศึกษาลบคนที่นักศึกษาอื่นเลือก 409 · เจ้าหน้าที่ลบได้ (ถอดจากคำร้อง) · รายชื่อทั้งหมดเฉพาะเจ้าหน้าที่", async () => {
    expect((await api(s.a.token, "POST", `/api/companies/${X.id}/contacts`, { firstName: " " })).status).toBe(400);
    expect((await api(s.a.token, "POST", `/api/companies/${X.id}/contacts`, { firstName: "ก", email: "not-mail" })).status).toBe(400);
    expect((await api(s.a.token, "POST", "/api/companies/nope/contacts", { firstName: "ก" })).status).toBe(404);
    let r = await api(s.a.token, "POST", `/api/companies/${X.id}/contacts`, { firstName: "  สมศรี  ", lastName: "ใจดี", email: "somsri@zc.example.com", position: "HR" });
    expect(r.status, msg(r)).toBe(200);
    const id = r.body.contact.id;
    expect(r.body.contact.firstName).toBe("สมศรี");
    r = await api(t.plain.token, "PUT", `/api/companies/contacts/${id}`, { firstName: "สมศรี", position: "HR Manager" });
    expect([r.status, r.body.contact.position]).toEqual([200, "HR Manager"]);
    expect((await api(s.a.token, "PUT", "/api/companies/contacts/nope", { firstName: "x" })).status).toBe(404);

    // ผู้ติดต่อที่ a และ b เลือกอยู่: a ลบไม่ได้ (b ใช้อยู่) · เจ้าหน้าที่ลบได้
    const shared = X.contactIds[0];
    expect((await api(s.a.token, "DELETE", `/api/companies/contacts/${shared}`)).status).toBe(409);
    expect((await api(t.plain.token, "GET", "/api/companies/contacts")).status).toBe(403);
    const all = (await api(staff.token, "GET", "/api/companies/contacts")).body.contacts;
    expect(all.find((c: { id: string }) => c.id === shared)._count.studentCoops).toBeGreaterThanOrEqual(2);
    expect((await api(s.a.token, "DELETE", `/api/companies/contacts/${id}`)).status).toBe(200);
  });

  test("พี่เลี้ยง: (ใหม่) ชื่อ/นามสกุลมีแต่ช่องว่าง 400 ทั้งเพิ่มและแก้ · ไม่มีบริษัท 404 · เพิ่ม/แก้/ลบได้ · ไม่มีพี่เลี้ยง 404", async () => {
    expect((await api(s.a.token, "POST", `/api/companies/${X.id}/mentors`, { firstName: "  ", lastName: "ข" })).status).toBe(400);
    expect((await api(s.a.token, "POST", `/api/companies/${X.id}/mentors`, { firstName: "ก" })).status).toBe(400);
    expect((await api(s.a.token, "POST", "/api/companies/nope/mentors", { firstName: "ก", lastName: "ข" })).status).toBe(404);
    let r = await api(s.a.token, "POST", `/api/companies/${X.id}/mentors`, { firstName: "พี่เลี้ยง", lastName: "ทดสอบ", position: "Senior" });
    expect(r.status, msg(r)).toBe(200);
    const id = r.body.mentor.id;
    expect((await api(s.a.token, "PUT", `/api/companies/mentors/${id}`, { firstName: "  " })).status).toBe(400);
    expect((await api(s.a.token, "PUT", `/api/companies/mentors/${id}`, { lastName: "" })).status).toBe(400);
    r = await api(staff.token, "PUT", `/api/companies/mentors/${id}`, { position: "Lead" });
    expect([r.status, r.body.mentor.firstName, r.body.mentor.position]).toEqual([200, "พี่เลี้ยง", "Lead"]);
    expect((await api(s.a.token, "PUT", "/api/companies/mentors/nope", { position: "x" })).status).toBe(404);
    expect((await api(t.plain.token, "DELETE", `/api/companies/mentors/${id}`)).status).toBe(200);
    expect((await api(s.a.token, "DELETE", `/api/companies/mentors/${id}`)).status).toBe(404);
  });
});

// ══════════════════════════════════════════════════════
// C. นักศึกษาเลือกบริษัท / ผู้ติดต่อ
// ══════════════════════════════════════════════════════
test.describe("C. นักศึกษาเลือกบริษัท", () => {
  const choose = (key: string, companyId: string | null, contactIds: string[]) => api(s[key].token, "PUT", "/api/students/me", { companyId, contactIds });

  test("เลือกบริษัท + ผู้ติดต่อ · ผู้ติดต่อของบริษัทอื่น 400 · เปลี่ยนบริษัท = ผู้ติดต่อเดิมหลุด · ก่อนออกหนังสือเปลี่ยนได้ (ผ่านคุณสมบัติแล้วก็ได้)", async () => {
    let r = await choose("a", Y.id, X.contactIds);
    expect(r.status, msg(r)).toBe(400);
    r = await choose("a", Y.id, Y.contactIds);
    expect(r.status, msg(r)).toBe(200);
    let c = await k.coop(s.a.pk);
    expect([c.companyId, c.contacts.map((x: { id: string }) => x.id)]).toEqual([Y.id, Y.contactIds]);
    r = await choose("free", Y.id, Y.contactIds);
    expect(r.status, msg(r)).toBe(200);
    c = await k.coop(s.free.pk);
    expect(c.companyId).toBe(Y.id);
  });

  test("(ใหม่) ออกหนังสือขอความอนุเคราะห์แล้ว / ร่างรอลงนาม: เปลี่ยนบริษัทหรือผู้ติดต่อ 409 — ส่งค่าเดิม (บันทึกช่องอื่น) ผ่าน · ข้อมูลไม่เปลี่ยน", async () => {
    for (const key of ["issued", "pending"]) {
      let r = await choose(key, Y.id, Y.contactIds);
      expect(r.status, `${key}: ${msg(r)}`).toBe(409);
      expect(r.body.message).toMatch(/ติดต่อเจ้าหน้าที่/);
      r = await choose(key, X.id, []);
      expect(r.status, `${key} contacts: ${msg(r)}`).toBe(409);
      r = await choose(key, X.id, X.contactIds);
      expect(r.status, `${key} same: ${msg(r)}`).toBe(200);
      const c = await k.coop(s[key].pk);
      expect([c.companyId, c.contacts.map((x: { id: string }) => x.id)]).toEqual([X.id, X.contactIds]);
    }
  });
});

// ══════════════════════════════════════════════════════
// D. นำเข้านักศึกษาจาก Excel
// ══════════════════════════════════════════════════════
type Row = Record<string, string>;
function kkuRow(n: number, o: Partial<Row> = {}): Row {
  return {
    STUDENTCODE: k.code(n), PREFIXNAME: "นาย", STUDENTNAME: `นำเข้า${n}`, STUDENTSURNAME: "ทดสอบ", STUDENTNAMEENG: `Imp${n}`, STUDENTSURNAMEENG: "Test",
    KKUMAIL: `${k.tag}-x${n}@kkumail.com`, PROGRAMNAME: "CS", LEVELNAME: "ภาคปกติ", OFFICERNAME: "", OFFICERSURNAME: "", ...o,
  };
}
function xlsxForm(rows: Row[], majorMap?: object, raw?: string[][]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, raw ? XLSX.utils.aoa_to_sheet(raw) : XLSX.utils.json_to_sheet(rows), "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "students.xlsx");
  if (majorMap) fd.append("majorMap", JSON.stringify(majorMap));
  return fd;
}
const preview = (token: string, rows: Row[], majorMap?: object) => api(token, "POST", "/api/admin/students/import-preview", xlsxForm(rows, majorMap));
const doImport = (token: string, rows: Row[], majorMap?: object) => api(token, "POST", "/api/admin/students/import-excel", xlsxForm(rows, majorMap));

test.describe("D. นำเข้านักศึกษาจาก Excel", () => {
  const UNKNOWN = `${N()} หลักสูตรมหัศจรรย์`;
  const rows = () => [
    kkuRow(91, { OFFICERNAME: "ทดสอบที่ปรึกษา", OFFICERSURNAME: N() }),
    kkuRow(91, { STUDENTNAME: "ซ้ำในไฟล์", OFFICERNAME: "ทดสอบที่ปรึกษา", OFFICERSURNAME: N() }), // อีเมลเดียวกับแถวแรก
    { ...kkuRow(6), KKUMAIL: s.imp1.email, STUDENTNAME: "อัปเดตชื่อ" },               // นักศึกษาเดิม (ไฟล์ทะเบียนไม่มีเบอร์โทร/ชั้นปี)
    kkuRow(92, { PROGRAMNAME: UNKNOWN }),
    kkuRow(93, { KKUMAIL: "" }),
    kkuRow(94, { OFFICERNAME: "ไม่มี", OFFICERSURNAME: "ในระบบ" }),
  ];

  test("ด่าน: ไม่มีไฟล์ 400 · ไม่มีหัวคอลัมน์รหัสนักศึกษา 400 · อาจารย์ทั่วไป/นักศึกษา 403 · การจับคู่หลักสูตรผิด 400 · ประจำวิชาจับคู่ไปหลักสูตรที่ไม่ได้ดูแล 400", async () => {
    expect((await api(staff.token, "POST", "/api/admin/students/import-preview", new FormData())).status).toBe(400);
    const noHeader = new FormData();
    noHeader.append("file", new Blob([XLSX.write((() => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["ชื่อ"], ["ก"]]), "S"); return wb; })(), { type: "buffer", bookType: "xlsx" })]), "x.xlsx");
    expect((await api(staff.token, "POST", "/api/admin/students/import-preview", noHeader)).status).toBe(400);
    expect((await preview(t.plain.token, rows())).status).toBe(403);
    expect((await preview(s.a.token, rows())).status).toBe(403);
    expect((await api(staff.token, "POST", "/api/admin/students/import-preview", (() => { const fd = xlsxForm(rows()); fd.set("majorMap", "{bad"); return fd; })())).status).toBe(400);
    expect((await preview(staff.token, rows(), { [UNKNOWN]: "NOPE" })).status).toBe(400);
    expect((await preview(t.coopCS.token, rows(), { [UNKNOWN]: "AI" })).status).toBe(400);
  });

  test("พรีวิว: (ใหม่) อีเมลซ้ำในไฟล์ = แถวแรกสร้าง แถวถัดไปอัปเดต · นักศึกษาเดิม = อัปเดต · หลักสูตรไม่รู้จัก/อีเมลว่าง = ข้าม · บอกชื่อหลักสูตรที่ต้องจับคู่ · อาจารย์ที่ปรึกษาเจอ/ไม่เจอ — ไม่เขียนข้อมูล", async () => {
    const r = await preview(staff.token, rows());
    expect(r.status, msg(r)).toBe(200);
    expect(r.body.rows.map((x: { action: string }) => x.action)).toEqual(["create", "update", "update", "skip", "skip", "create"]);
    expect(r.body.summary).toMatchObject({ total: 6, willCreate: 2, willUpdate: 2, willSkip: 2, advisorWarnings: 1 });
    expect(r.body.rows.map((x: { advisorStatus: string }) => x.advisorStatus)).toEqual(["found", "found", "empty", "empty", "empty", "notFound"]);
    expect(r.body.unknownMajors).toEqual([expect.objectContaining({ name: UNKNOWN, rows: 1 })]);
    expect(await prisma.student.count({ where: { studentId: { in: [k.code(91), k.code(94)] } } })).toBe(0);
  });

  test("นำเข้า: สร้าง/อัปเดต/ข้ามตรงกับพรีวิว · (ใหม่) นักศึกษาเดิมเบอร์โทร/ชั้นปีไม่ถูกล้าง · ที่ปรึกษาจับคู่ได้ · จับคู่หลักสูตรแล้วนำเข้าได้ (จำชื่อไว้ครั้งหน้า)", async () => {
    let r = await doImport(staff.token, rows());
    expect(r.status, msg(r)).toBe(200);
    expect(r.body.summary).toMatchObject({ total: 6, created: 2, updated: 2, errors: 2 });
    const imp1 = await prisma.student.findUnique({ where: { id: s.imp1.pk } });
    expect([imp1.firstName, imp1.phone, imp1.year]).toEqual(["อัปเดตชื่อ", "0811111111", "4"]);
    const n91 = await prisma.student.findUnique({ where: { studentId: k.code(91) } });
    expect([n91.firstName, n91.major, n91.generalAdvisorId]).toEqual(["ซ้ำในไฟล์", "CS", t.adv.pk]);
    expect(r.body.errorRows.map((x: { reason: string }) => x.reason)).toEqual(expect.arrayContaining([expect.stringMatching(/ไม่พบอาจารย์ที่ปรึกษา/)]));

    r = await doImport(staff.token, [kkuRow(92, { PROGRAMNAME: UNKNOWN })], { [UNKNOWN]: "CS" });
    expect([r.status, r.body.summary.created]).toEqual([200, 1]);
    expect((await prisma.student.findUnique({ where: { studentId: k.code(92) } })).major).toBe("CS");
    expect((await k.config("MAJOR_IMPORT_ALIASES"))[UNKNOWN]).toBe("CS");

    // (ใหม่) รหัสเลข 10 หลักในไฟล์ → เก็บแบบระบบทะเบียน (มีขีด) เหมือนเพิ่มทีละคน
    const id10 = `9${k.tail}0095`;
    r = await doImport(staff.token, [kkuRow(95, { STUDENTCODE: id10 })]);
    expect([r.status, r.body.summary.created]).toEqual([200, 1]);
    expect(await prisma.student.findUnique({ where: { studentId: `${id10.slice(0, 9)}-${id10.slice(9)}` } })).not.toBeNull();

    // (ใหม่) นักศึกษาเดิมที่รหัสถูกตัดขีดไปแล้ว (บันทึกหน้าข้อมูลก่อนแก้บั๊ก) — ไฟล์ทะเบียน (มีขีด) จับคู่แถวเดิมได้ อัปเดต + คืนรหัสเป็นแบบมีขีด
    const legacy = await k.student("legacyId", 96);
    const old10 = `9${k.tail}0096`;
    await prisma.student.update({ where: { id: legacy.pk }, data: { studentId: old10 } });
    r = await doImport(staff.token, [kkuRow(96, { STUDENTCODE: `${old10.slice(0, 9)}-${old10.slice(9)}`, KKUMAIL: legacy.email, STUDENTNAME: "รหัสเก่า" })]);
    expect([r.status, r.body.summary.updated, r.body.summary.created, r.body.summary.errors], msg(r)).toEqual([200, 1, 0, 0]);
    const healed = await prisma.student.findUnique({ where: { id: legacy.pk } });
    expect([healed.studentId, healed.firstName]).toEqual([`${old10.slice(0, 9)}-${old10.slice(9)}`, "รหัสเก่า"]);
  });

  test("อาจารย์ประจำวิชา: นำเข้าได้เฉพาะหลักสูตรที่ดูแล — แถว AI ข้าม · แถว CS นำเข้า", async () => {
    const r = await doImport(t.coopCS.token, [kkuRow(95, { PROGRAMNAME: "AI" }), kkuRow(96)]);
    expect(r.status, msg(r)).toBe(200);
    expect(r.body.summary).toMatchObject({ created: 1, errors: 1 });
    expect(r.body.errorRows[0].reason).toMatch(/ไม่อยู่ในหลักสูตรที่คุณดูแล/);
    expect(await prisma.student.count({ where: { studentId: k.code(95) } })).toBe(0);
  });
});

// ══════════════════════════════════════════════════════
// หน้าเว็บ
// ══════════════════════════════════════════════════════
test.use({ timezoneId: "Asia/Bangkok" });
async function asUser(page: Page, token: string, userId: number, to: string) {
  await page.goto("/");
  await page.evaluate(([tk, uid]) => {
    localStorage.clear();
    localStorage.setItem("coop.token", tk); localStorage.setItem("coop.userId", uid); localStorage.setItem("coop.theme", "light");
  }, [token, String(userId)]);
  await page.goto(to, { waitUntil: "networkidle" });
}

test.describe("E. หน้าบริษัท (เจ้าหน้าที่)", () => {
  test("เพิ่มบริษัท (ฟอร์ม) → เพิ่มสำเร็จ → ข้ามไปก่อน · รายละเอียด → เพิ่มผู้ติดต่อ · เพิ่มพี่เลี้ยง · แก้ไข · ลบบริษัทที่มีนักศึกษาเลือกต้องยืนยันพร้อมรายชื่อ (ยกเลิกได้) · ลบที่ไม่มีใครใช้", async ({ page }) => {
    await asUser(page, staff.token, staff.userId, "/admin/company");
    await page.getByRole("button", { name: "+ เพิ่มบริษัท" }).click();
    const name = `${N()} หน้าเว็บ`;
    const fill = async (field: string, v: string) => page.locator(`form [name="${field}"]`).fill(v);
    await fill("name", name);
    for (const [f, v] of [["addressNo", "1"], ["subDistrict", "ในเมือง"], ["district", "เมือง"], ["province", "ขอนแก่น"], ["zipcode", "40000"], ["phone", "043-111111"]]) await fill(f, v);
    await page.getByRole("button", { name: "💾 บันทึกข้อมูลบริษัท" }).click();
    await expect(page.getByText("เพิ่มบริษัทสำเร็จ")).toBeVisible();
    await page.getByRole("button", { name: "ข้ามไปก่อน" }).click();
    const created = await prisma.company.findFirst({ where: { name } });
    expect(created?.province).toBe("ขอนแก่น");

    await page.getByPlaceholder("ค้นหา: ชื่อ / จังหวัด / อีเมล / ปี / เลขที่").fill(name);
    const row = page.locator("tr", { hasText: name });
    await row.getByRole("button", { name: "รายละเอียด" }).click();
    await page.getByRole("button", { name: "+ เพิ่มผู้ติดต่อ" }).click();
    await page.getByPlaceholder("เช่น สมศรี").fill("ผู้ติดต่อหน้าเว็บ");
    await page.getByPlaceholder("เช่น HR Manager").fill("HR");
    await page.getByRole("group", { name: "ข้อมูลผู้ติดต่อ" }).getByRole("button", { name: /บันทึกผู้ติดต่อ/ }).click();
    await expect(page.getByText("เพิ่มผู้ติดต่อแล้ว")).toBeVisible();
    await expect.poll(async () => (await company(created!.id))?.contacts.map((c: { firstName: string }) => c.firstName)).toEqual(["ผู้ติดต่อหน้าเว็บ"]);
    await page.getByRole("button", { name: "+ เพิ่มพี่เลี้ยง" }).click();
    for (const [f, v] of [["firstName", "พี่"], ["lastName", "หน้าเว็บ"], ["position", "Dev"], ["department", "IT"], ["email", "mentor@zc.example.com"], ["phone", "081"]]) {
      await page.locator(`form [name="${f}"]`).last().fill(v);
    }
    await page.getByRole("button", { name: "💾 บันทึกข้อมูลพี่เลี้ยง" }).click();
    await expect.poll(async () => (await company(created!.id))?.mentors.map((m: { lastName: string }) => m.lastName)).toEqual(["หน้าเว็บ"]);
    await page.keyboard.press("Escape");

    await page.reload({ waitUntil: "networkidle" });
    await page.getByPlaceholder("ค้นหา: ชื่อ / จังหวัด / อีเมล / ปี / เลขที่").fill(X.name);
    await page.locator("tr", { hasText: X.name }).getByRole("button", { name: "🗑️ ลบ" }).click();
    await page.getByRole("button", { name: /ลบ/ }).last().click();                      // ยืนยันครั้งแรก
    await expect(page.getByText(/มีนักศึกษาเลือกบริษัทนี้อยู่/)).toBeVisible();
    await expect(page.getByText(s.b.studentId)).toBeVisible();
    await page.getByRole("button", { name: "ยกเลิก" }).last().click();
    expect(await company(X.id)).not.toBeNull();

    await page.getByPlaceholder("ค้นหา: ชื่อ / จังหวัด / อีเมล / ปี / เลขที่").fill(name);
    await page.locator("tr", { hasText: name }).getByRole("button", { name: "🗑️ ลบ" }).click();
    await page.getByRole("button", { name: /ลบ/ }).last().click();
    await expect.poll(async () => company(created!.id)).toBeNull();
  });

  test("ผู้ติดต่อ (HR): ค้นหา → แก้ไข → บันทึก · พี่เลี้ยง: ค้นหาแล้วเห็นรายการ", async ({ page }) => {
    await asUser(page, staff.token, staff.userId, "/admin/contacts");
    await page.getByPlaceholder("ค้นหา: ชื่อ / บริษัท / ตำแหน่ง / อีเมล / เบอร์").fill("เอชอาร์วาย");
    await page.locator("tr", { hasText: "เอชอาร์วาย" }).getByRole("button", { name: "✏️ แก้ไข" }).click();
    await page.getByPlaceholder("เช่น HR Manager").fill("ZC ตำแหน่งใหม่");
    await page.getByRole("group", { name: "ข้อมูลผู้ติดต่อ" }).getByRole("button", { name: /บันทึกผู้ติดต่อ/ }).click();
    await expect(page.getByText("แก้ไขผู้ติดต่อแล้ว")).toBeVisible();
    expect((await prisma.companyContact.findUnique({ where: { id: Y.contactIds[0] } })).position).toBe("ZC ตำแหน่งใหม่");
  });
});

test.describe("F. หน้านักศึกษา + นำเข้า Excel (เจ้าหน้าที่)", () => {
  test("(ใหม่) ออกหนังสือแล้ว: หน้าข้อมูลนักศึกษาแสดงบริษัทแบบล็อก ไม่มีช่องเลือก/ปุ่มเพิ่มผู้ติดต่อ · ยังไม่ออก: เลือกได้", async ({ page }) => {
    await asUser(page, s.uiLocked.token, s.uiLocked.userId, "/student/profile");
    await expect(page.getByText(/ออกหนังสือขอความอนุเคราะห์ถึงบริษัทนี้แล้ว/)).toBeVisible();
    await expect(page.getByLabel("บริษัท", { exact: true })).toHaveValue(X.name);
    await expect(page.getByPlaceholder("พิมพ์ค้นหาชื่อบริษัท...")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "+ เพิ่มผู้ติดต่อ" })).toHaveCount(0);

    await asUser(page, s.b.token, s.b.userId, "/student/profile");
    await expect(page.getByText(/ออกหนังสือขอความอนุเคราะห์ถึงบริษัทนี้แล้ว/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "+ เพิ่มผู้ติดต่อ" })).toBeVisible();
  });

  test("นำเข้า Excel: เลือกไฟล์ → ดูตัวอย่าง (สร้างใหม่/อัปเดต) → ยืนยันนำเข้า → สรุปผล", async ({ page }) => {
    await asUser(page, staff.token, staff.userId, "/admin/students");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([kkuRow(97), kkuRow(98)]), "Sheet1");
    await page.locator('input[type="file"]').first().setInputFiles({ name: "zc.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) });
    await page.getByRole("button", { name: "ดูตัวอย่าง" }).click();
    await expect(page.getByText("🟢 สร้างใหม่ 2")).toBeVisible();
    await page.getByRole("button", { name: "ยืนยันนำเข้า" }).click();
    await expect(page.getByText(/สร้างใหม่ 2 \| อัปเดต 0 \| error 0 จาก 2 รายการ/)).toBeVisible();
    expect(await prisma.student.count({ where: { studentId: { in: [k.code(97), k.code(98)] } } })).toBe(2);
  });
});
