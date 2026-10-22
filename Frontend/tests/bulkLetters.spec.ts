import { test, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import * as XLSX from "xlsx";
import {
  numberSequence, duplicateNumbers, bulkCandidates, blockReason, groupByCompany, letterFileNames, safeFileName,
  fileLeadingNumber, groupPending, matchFiles, signedLetterRequest, docSuffix, pendingDraftOf,
} from "../src/utils/bulkLetters";
import { createZip, registerWorkbook } from "../src/utils/bulkLetterZip";

// ฟังก์ชันล้วน ไม่เปิดเบราว์เซอร์ — ออกร่างหนังสือหลายคน / จับคู่ไฟล์ลงนาม

const file = new File(["x"], "811-a.pdf", { type: "application/pdf" });

test("numberSequence ไล่เลขท้าย / · คงหลัก · ไม่ใช่ตัวเลข = null", () => {
  expect(numberSequence("ที่ อว 660301.26.6.2/1234", 3)).toEqual(["660301.26.6.2/1234", "660301.26.6.2/1235", "660301.26.6.2/1236"]);
  expect(numberSequence("660301.26.6.2/0099", 2)).toEqual(["660301.26.6.2/0099", "660301.26.6.2/0100"]);
  expect(numberSequence("660301.26.6.2/", 2)).toBeNull();
  expect(numberSequence("660301.26.6.2/12ก", 2)).toBeNull();
  expect(numberSequence("660301.26.6.2/12", 0)).toBeNull();
});

test("duplicateNumbers เทียบหลังตัด 'ที่ อว'", () => {
  expect([...duplicateNumbers(["ที่ อว 660301.26.6.2/811", "660301.26.6.2/811", "660301.26.6.2/812"])]).toEqual(["660301.26.6.2/811"]);
});

test("docSuffix", () => {
  expect(docSuffix("ที่ อว 660301.26.6.2/0811")).toBe(811);
  expect(docSuffix("660301.26.6.2/")).toBeNull();
  expect(docSuffix(null)).toBeNull();
});

test("bulkCandidates / blockReason", () => {
  const mk = (id: number, over: any = {}, coop: any = {}) => ({ id, docStatus: "DOCS_APPROVED", coop: { companyId: 1, ...coop }, ...over });
  const list = [
    mk(1),                                                       // อยู่
    mk(2, { docStatus: "REQ_LETTER_ISSUED" }),                   // ผิดขั้น
    mk(3, {}, { reqLetterUrl: "/uploads/x.pdf" }),               // มีหนังสือแล้ว
    mk(4, { outsidePeriod: true }),                              // นอกรอบ
    mk(5, { docStatus: "ACCEPTANCE_CHECKED" }),                  // ขั้นส่งตัว
    mk(6, { docStatus: "ACCEPTANCE_CHECKED" }, { placeLetterUrl: "/uploads/y.pdf" }),
  ];
  expect(bulkCandidates(list, "REQUEST").map(s => s.id)).toEqual([1]);
  expect(bulkCandidates(list, "PLACEMENT").map(s => s.id)).toEqual([5]);

  expect(blockReason({ id: 1, coop: { actualStartDate: "2026-06-01" } }, "REQUEST")).toBe("ยังไม่มีบริษัท");
  expect(blockReason({ id: 1, coop: { companyId: 1 } }, "REQUEST")).toBe("ยังไม่มีวันเริ่มฝึก");
  expect(blockReason({ id: 1, coop: { companyId: 1, actualStartDate: "2026-06-01" } }, "REQUEST")).toBeNull();
  expect(blockReason({ id: 1, coop: { companyId: 1 }, coopApplicationForm: { startDate: "2026-06-01" } }, "REQUEST")).toBeNull();
  expect(blockReason({ id: 1, coop: { companyId: 1, actualStartDate: "2026-06-01" } }, "PLACEMENT")).toBe("ยังไม่มีวันเริ่ม/สิ้นสุดฝึก");
  expect(blockReason({ id: 1, coop: { companyId: 1, actualStartDate: "2026-06-01" }, coopApplicationForm: { endDate: "2026-09-30" } }, "PLACEMENT")).toBeNull();
});

test("groupByCompany: บริษัทเดียวกันรวม · แยกฉบับได้ · เรียงชื่อบริษัทแล้วรหัส", () => {
  const s = (id: number, companyId: number, name: string) => ({ id, studentId: `65000000${id}`, coop: { companyId, company: { name } } });
  const students = [s(3, 2, "บริษัท ข จำกัด"), s(2, 1, "บริษัท ก จำกัด"), s(1, 1, "บริษัท ก จำกัด")];
  const merged = groupByCompany(students, new Set());
  expect(merged.map(g => [g.companyName, g.students.map(x => x.studentId)])).toEqual([
    ["บริษัท ก จำกัด", ["650000001", "650000002"]], ["บริษัท ข จำกัด", ["650000003"]]]);
  const groups = groupByCompany(students, new Set([2]));
  expect(groups.map(g => [g.companyName, g.students.map(x => x.studentId)])).toEqual([
    ["บริษัท ก จำกัด", ["650000001"]], ["บริษัท ก จำกัด", ["650000002"]], ["บริษัท ข จำกัด", ["650000003"]]]);
  expect(groups[0].key).toBe("1");
  expect(groups[1].key).toBe("solo:2");
});

test("letterFileNames + safeFileName", () => {
  expect(letterFileNames("REQUEST", "doc", "660301.26.6.2/1234", "บริษัท เอไอเอส จำกัด"))
    .toEqual(["1234-หนังสือขอความอนุเคราะห์-บริษัท เอไอเอส จำกัด.doc", "1234-หนังสือขอความอนุเคราะห์-บริษัท เอไอเอส จำกัด-เอกสารแนบ.pdf"]);
  expect(letterFileNames("REQUEST", "pdf", "660301.26.6.2/1234", "บริษัท เอไอเอส จำกัด")).toEqual(["1234-หนังสือขอความอนุเคราะห์-บริษัท เอไอเอส จำกัด.pdf"]);
  expect(letterFileNames("PLACEMENT", "doc", "660301.26.6.2/893", "บริษัท วันจีโอเซอร์เวย์ จำกัด")).toEqual(["893-หนังสือส่งตัว-บริษัท วันจีโอเซอร์เวย์ จำกัด.doc"]);
  expect(safeFileName(' บริษัท A/B: "C" <D>|E*? จำกัด. ')).toBe("บริษัท A B C D E จำกัด");
});

test("fileLeadingNumber — แบบที่จับคู่ได้และไม่ได้", () => {
  for (const [name, n] of [["811-บริษัท แอดวานซ์ อินโฟร์ เซอร์วิส จำกัด (มหาชน).pdf", 811], ["811 บริษัท.PDF", 811], ["811.pdf", 811],
    ["  811-x.pdf", 811], ["811-x (1).pdf", 811], ["660301.26.6.2-811-x.pdf", 811], ["660301.26.6.2_811.pdf", 811],
    ["scan001.pdf", null], ["660301.26.6.2.pdf", null], ["บริษัท 811.pdf", null]] as const) expect(fileLeadingNumber(name), name).toBe(n);
});

const pendingList = () => {
  const st = (id: number, coop: any, over: any = {}) => ({ id, studentId: `65000000${id}`, coop: { companyId: 1, company: { name: "บริษัท ก" }, ...coop }, ...over });
  const at = "2026-10-20T03:00:00.000Z";
  return [
    st(1, { reqLetterPendingAt: at, reqLetterDraftNumber: "ที่ อว 660301.26.6.2/811", reqLetterDraftDate: "2026-10-22T00:00:00.000Z" }),
    st(2, { reqLetterPendingAt: at, reqLetterDraftNumber: "660301.26.6.2/811", reqLetterDraftDate: "2026-10-22T00:00:00.000Z" }, { outsidePeriod: true }),
    st(3, { reqLetterPendingAt: at, reqLetterDraftNumber: "660301.26.6.2/812" }, { outsidePeriod: true }),
    st(4, { reqLetterPendingAt: at }),
    st(5, {}),
  ];
};

test("groupPending: เลขร่างเดียวกัน = ฉบับเดียว รวมเพื่อนนอกรอบ · ฉบับที่ทุกคนอยู่นอกรอบไม่แสดง · ไม่มีเลขร่าง = ฉบับเดี่ยว", () => {
  const list = pendingList();
  expect(groupPending(list, "REQUEST").map(p => [p.key, p.docNumber, p.students.map(s => s.id)])).toEqual([
    ["660301.26.6.2/811", "660301.26.6.2/811", [1, 2]], ["id:4", null, [4]]]);
  expect(groupPending(list, "REQUEST")[0].docDate).toBe("2026-10-22");
  expect(groupPending(list, "PLACEMENT")).toEqual([]);
  expect(pendingDraftOf(list[3], "REQUEST")).toMatchObject({ number: null });
  expect(pendingDraftOf(list[4], "REQUEST")).toBeNull();
});

test("matchFiles: ตรงฉบับเดียวผูกให้ · ไม่มีเลข / ไม่มีฉบับ / สองไฟล์ชี้ฉบับเดียว → ไม่ผูก มีเหตุผล", () => {
  const letters = [
    { key: "660301.26.6.2/811", docNumber: "660301.26.6.2/811", docDate: null, companyName: "ก", students: [{ id: 1 }, { id: 2 }] },
    { key: "660301.26.6.2/812", docNumber: "660301.26.6.2/812", docDate: null, companyName: "ข", students: [{ id: 3 }] },
    { key: "id:4", docNumber: null, docDate: null, companyName: "ค", students: [{ id: 4 }] },
  ];
  const f = (n: string) => new File(["x"], n);
  const r = matchFiles([f("811-a.pdf"), f("812-b.pdf"), f("812-c.pdf"), f("999.pdf"), f("scan.pdf")], letters);
  expect(r.map(m => [m.file.name, m.letterKey])).toEqual([["811-a.pdf", "660301.26.6.2/811"], ["812-b.pdf", null], ["812-c.pdf", null], ["999.pdf", null], ["scan.pdf", null]]);
  expect(r[0].reason).toBeNull();
  expect(r[1].reason).toContain("หลายไฟล์");
  expect(r[3].reason).toContain("999");
  expect(r[4].reason).toContain("ไม่ขึ้นต้นด้วยเลข");
  // เลขท้ายเดียวกันหลายฉบับ → ไม่เดา
  const dup = matchFiles([f("5-a.pdf")], [
    { key: "a/5", docNumber: "a/5", docDate: null, companyName: "", students: [] },
    { key: "b/5", docNumber: "b/5", docDate: null, companyName: "", students: [] }]);
  expect(dup[0].letterKey).toBeNull();
  expect(dup[0].reason).toContain("หลายฉบับ");
});

test("signedLetterRequest: เดี่ยว → /review · รวม → /letter-batch · ช่องเดียวกับหน้าต่างเดิม", () => {
  const fields = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([k]) => k !== "file"));
  const one = signedLetterRequest("REQUEST", { key: "660301.26.6.2/811", docNumber: "660301.26.6.2/811", docDate: "2026-10-22", companyName: "x", students: [{ id: 1 }] }, "STUDENT", file);
  expect(one.url).toBe("/api/admin/t000/review");
  expect(fields(one.body)).toEqual({ studentId: "1", status: "REQ_LETTER_ISSUED", docType: "DISPATCH_LETTER", deliveryMethod: "STUDENT",
    comment: "เจ้าหน้าที่ออกหนังสือแล้ว ให้นักศึกษามารับเอกสารตัวจริงที่คณะ หรือดาวน์โหลดไฟล์เพื่อนำไปยื่นบริษัทด้วยตนเอง",
    reqDocNumber: "660301.26.6.2/811", reqDocDate: "2026-10-22" });
  expect((one.body.get("file") as File).name).toBe(file.name);
  const grp = signedLetterRequest("PLACEMENT", { key: "660301.26.6.2/893", docNumber: "660301.26.6.2/893", docDate: "2026-10-22", companyName: "x", students: [{ id: 1 }, { id: 2 }] }, "STAFF", file);
  expect(grp.url).toBe("/api/admin/t000/letter-batch");
  expect(fields(grp.body)).toEqual({ letter: "PLACEMENT", studentIds: "[1,2]", docNumber: "660301.26.6.2/893", docDate: "2026-10-22",
    studentId: "1", status: "PLACEMENT_LETTER_ISSUED", docType: "PLACEMENT_LETTER", deliveryMethod: "STAFF",
    comment: "เจ้าหน้าที่ออกหนังสือส่งตัวและจัดส่งให้บริษัทล่วงหน้าเรียบร้อยแล้ว", placeDocNumber: "660301.26.6.2/893", placeDocDate: "2026-10-22" });
});

test("createZip: ชื่อไทยและเนื้อไฟล์กลับมาครบ", async () => {
  const z = createZip();
  const a = new Uint8Array([1, 2, 3, 4]), b = new TextEncoder().encode("สวัสดี");
  z.add("811-หนังสือขอความอนุเคราะห์-บริษัท ก.doc", a);
  z.add("811-เอกสารแนบ.pdf", b);
  const blob = await z.finish();
  const out = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  expect(Object.keys(out).sort()).toEqual(["811-หนังสือขอความอนุเคราะห์-บริษัท ก.doc", "811-เอกสารแนบ.pdf"].sort());
  expect([...out["811-หนังสือขอความอนุเคราะห์-บริษัท ก.doc"]]).toEqual([1, 2, 3, 4]);
  expect(new TextDecoder().decode(out["811-เอกสารแนบ.pdf"])).toBe("สวัสดี");
});

test("registerWorkbook: หัวตาราง 7 คอลัมน์", () => {
  const bytes = registerWorkbook([{ docNumber: "ที่ อว 660301.26.6.2/811", docDate: "2026-10-22", letter: "REQUEST", recipient: "ผู้จัดการ", companyName: "บริษัท ก", students: ["นายก", "นายข"], files: ["a.doc", "b.pdf"] }]);
  const wb = XLSX.read(bytes, { type: "array" });
  const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  expect(rows[0]).toEqual(["เลขที่", "วันที่", "ประเภท", "เรียน", "บริษัท", "นักศึกษา", "ชื่อไฟล์"]);
  expect(rows[1]).toEqual(["ที่ อว 660301.26.6.2/811", "22 ตุลาคม 2569", "หนังสือขอความอนุเคราะห์", "ผู้จัดการ", "บริษัท ก", "นายก; นายข", "a.doc; b.pdf"]);
});

test("createZip: finish() เรียกซ้ำได้ คืนผลเดิม", async () => {
  const z = createZip();
  z.add("a.bin", new Uint8Array([9, 8, 7]));
  const p1 = z.finish();
  const p2 = z.finish();
  expect(p2).toBe(p1);
  const out = unzipSync(new Uint8Array(await (await p1).arrayBuffer()));
  expect([...out["a.bin"]]).toEqual([9, 8, 7]);
});
