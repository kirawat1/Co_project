import { normalizeDocNumber } from "./docGeneratorUtils";

// ฟังก์ชันล้วนของ "ออกร่างหนังสือหลายคน / อัปโหลดฉบับลงนามหลายฉบับ" (หน้า T000) — ไม่มี UI ไม่เรียก API

export type BulkLetterType = "REQUEST" | "PLACEMENT";
export type BulkFormat = "doc" | "pdf";
export type Delivery = "STUDENT" | "STAFF";

export const LETTER_PREFIX: Record<BulkLetterType, "reqLetter" | "placeLetter"> = { REQUEST: "reqLetter", PLACEMENT: "placeLetter" };
export const LETTER_FILE_LABEL = { REQUEST: "หนังสือขอความอนุเคราะห์", PLACEMENT: "หนังสือส่งตัว" };

// โครงสร้างขั้นต่ำของแถวจาก GET /api/admin/t000/students ที่ฟังก์ชันในไฟล์นี้อ่าน
export interface BulkStudent {
  id: number;
  studentId?: string;
  docStatus?: string | null;
  outsidePeriod?: boolean;
  coop?: {
    status?: string | null;
    companyId?: number | null;
    company?: { name?: string | null } | null;
    actualStartDate?: string | null;
    actualEndDate?: string | null;
    reqLetterUrl?: string | null;
    placeLetterUrl?: string | null;
    [k: string]: any;
  } | null;
  coopApplicationForm?: { startDate?: string | null; endDate?: string | null } | null;
}

export interface BulkLetterGroup<T> { key: string; companyName: string; students: T[] }
export interface PendingLetter<T> { key: string; docNumber: string | null; docDate: string | null; companyName: string; students: T[] }
export interface FileMatch { file: File; letterKey: string | null; reason: string | null }

const STEP_STATUS: Record<BulkLetterType, string> = { REQUEST: "DOCS_APPROVED", PLACEMENT: "ACCEPTANCE_CHECKED" };

/** นักศึกษาที่ออกร่างหนังสือหลายคนได้: ถึงขั้นพอดี · ยังไม่มีไฟล์หนังสือ · ไม่ใช่นอกรอบ */
export function bulkCandidates<T extends BulkStudent>(students: T[], letter: BulkLetterType): T[] {
  const urlKey = letter === "REQUEST" ? "reqLetterUrl" : "placeLetterUrl";
  return students.filter(s =>
    (s.docStatus ?? s.coop?.status) === STEP_STATUS[letter] && !s.coop?.[urlKey] && !s.outsidePeriod);
}

/** เหตุผลที่ยังออกหนังสือให้คนนี้ไม่ได้ (null = ออกได้) */
export function blockReason(s: BulkStudent, letter: BulkLetterType): string | null {
  if (!s.coop?.companyId) return "ยังไม่มีบริษัท";
  const start = s.coop.actualStartDate || s.coopApplicationForm?.startDate;
  if (letter === "REQUEST") return start ? null : "ยังไม่มีวันเริ่มฝึก";
  const end = s.coop.actualEndDate || s.coopApplicationForm?.endDate;
  return start && end ? null : "ยังไม่มีวันเริ่ม/สิ้นสุดฝึก";
}

/** ร่างที่ติดป้ายรอลงนามไว้ของคนนี้ (null = ไม่ได้รอลงนาม) */
export function pendingDraftOf(s: BulkStudent, letter: BulkLetterType): { at: string; number: string | null } | null {
  const p = LETTER_PREFIX[letter];
  const at = s.coop?.[`${p}PendingAt`];
  if (!at) return null;
  return { at: String(at), number: s.coop?.[`${p}DraftNumber`] || null };
}

const idOf = (s: BulkStudent) => String(s.studentId ?? "");
const byStudentId = (a: BulkStudent, b: BulkStudent) => idOf(a).localeCompare(idOf(b));

/** บริษัทเดียวกันรวมเป็นฉบับเดียว · คนใน splitIds แยกเป็นฉบับเดี่ยว (key solo:<id>) */
export function groupByCompany<T extends BulkStudent>(students: T[], splitIds: Set<number>): BulkLetterGroup<T>[] {
  const map = new Map<string, BulkLetterGroup<T>>();
  for (const s of students) {
    const key = splitIds.has(s.id) ? `solo:${s.id}` : String(s.coop?.companyId ?? `none:${s.id}`);
    let g = map.get(key);
    if (!g) { g = { key, companyName: s.coop?.company?.name || "", students: [] }; map.set(key, g); }
    g.students.push(s);
  }
  const groups = [...map.values()];
  groups.forEach(g => g.students.sort(byStudentId));
  return groups.sort((a, b) =>
    a.companyName.localeCompare(b.companyName, "th") || idOf(a.students[0]).localeCompare(idOf(b.students[0])));
}

/** เลขท้ายหลัง "/" (ต้องเป็นตัวเลขล้วน) */
export function docSuffix(docNumber?: string | null): number | null {
  const m = normalizeDocNumber(docNumber ?? "").match(/\/\s*(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

/** ไล่เลขท้ายต่อกัน คงจำนวนหลักเดิม (/0099 → /0100) · ไม่ใช่ตัวเลข/count<1 = null */
export function numberSequence(start: string, count: number): string[] | null {
  const n = normalizeDocNumber(start);
  const m = n.match(/^(.*\/\s*)(\d+)$/);
  if (!m || !(count >= 1)) return null;
  const width = m[2].length, first = parseInt(m[2], 10);
  return Array.from({ length: count }, (_, i) => m[1] + String(first + i).padStart(width, "0"));
}

/** เลขที่ที่ซ้ำกันเอง (เทียบหลังตัด "ที่ อว") */
export function duplicateNumbers(numbers: string[]): Set<string> {
  const seen = new Set<string>(), dup = new Set<string>();
  for (const raw of numbers) {
    const n = normalizeDocNumber(raw);
    if (seen.has(n)) dup.add(n); else seen.add(n);
  }
  return dup;
}

export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "");
}

/** ชื่อไฟล์ในซิป: ไฟล์หลักก่อน แล้วเอกสารแนบ (เฉพาะหนังสือขอความอนุเคราะห์แบบ .doc) */
export function letterFileNames(letter: BulkLetterType, format: BulkFormat, docNumber: string, companyName: string): string[] {
  const num = normalizeDocNumber(docNumber);
  const short = safeFileName(num.includes("/") ? num.slice(num.lastIndexOf("/") + 1) : num);
  const base = `${short}-${LETTER_FILE_LABEL[letter]}-${safeFileName(companyName)}`;
  if (letter === "REQUEST" && format === "doc") return [`${base}.doc`, `${base}-เอกสารแนบ.pdf`];
  return [`${base}.${format}`];
}

/** เลขหน้าชื่อไฟล์สแกน เช่น "811-บริษัท.pdf" / "660301.26.6.2-811-x.pdf" · จับคู่ไม่ได้ = null */
export function fileLeadingNumber(fileName: string): number | null {
  const base = fileName.trim().replace(/\.[A-Za-z]{2,5}$/, "");
  if (/^\d+\.\d/.test(base)) {
    const m = base.match(/^\d+(?:\.\d+)+[-_ ]+(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }
  const m = base.match(/^(\d+)(?=$|[\s\-_.(])/);
  return m ? parseInt(m[1], 10) : null;
}

/** ฉบับที่รอลงนาม: เลขร่างเดียวกัน = ฉบับเดียว (รวมเพื่อนนอกรอบ) · ไม่มีเลขร่าง = ฉบับเดี่ยว · ฉบับที่ทุกคนนอกรอบไม่แสดง */
export function groupPending<T extends BulkStudent>(students: T[], letter: BulkLetterType): PendingLetter<T>[] {
  const prefix = LETTER_PREFIX[letter];
  const map = new Map<string, PendingLetter<T>>();
  for (const s of students) {
    const draft = pendingDraftOf(s, letter);
    if (!draft) continue;
    const docNumber = draft.number ? normalizeDocNumber(draft.number) : null;
    const key = docNumber || `id:${s.id}`;
    let p = map.get(key);
    if (!p) {
      const d = s.coop?.[`${prefix}DraftDate`];
      p = { key, docNumber, docDate: d ? String(d).slice(0, 10) : null, companyName: s.coop?.company?.name || "", students: [] };
      map.set(key, p);
    }
    p.students.push(s);
  }
  const rank = (p: PendingLetter<T>) => docSuffix(p.docNumber) ?? Infinity;
  return [...map.values()]
    .filter(p => p.students.some(s => !s.outsidePeriod))
    .sort((a, b) => (rank(a) === rank(b) ? 0 : rank(a) < rank(b) ? -1 : 1));
}

/** จับคู่ไฟล์สแกนกับฉบับที่รอลงนามด้วยเลขหน้าชื่อไฟล์ — ผูกเฉพาะที่ชัดเจน ที่เหลือบอกเหตุผล */
export function matchFiles(files: File[], letters: PendingLetter<any>[]): FileMatch[] {
  const res: FileMatch[] = files.map(file => {
    const n = fileLeadingNumber(file.name);
    if (n == null) return { file, letterKey: null, reason: "ชื่อไฟล์ไม่ขึ้นต้นด้วยเลขที่หนังสือ" };
    const hits = letters.filter(l => l.docNumber != null && docSuffix(l.docNumber) === n);
    if (hits.length === 0) return { file, letterKey: null, reason: `ไม่มีหนังสือรอลงนามเลข ${n}` };
    if (hits.length > 1) return { file, letterKey: null, reason: `เลข ${n} ตรงกับหนังสือหลายฉบับ` };
    return { file, letterKey: hits[0].key, reason: null };
  });
  const count = new Map<string, number>();
  res.forEach(m => m.letterKey && count.set(m.letterKey, (count.get(m.letterKey) || 0) + 1));
  for (const m of res) {
    if (m.letterKey && count.get(m.letterKey)! > 1) {
      m.reason = `มีหลายไฟล์ชี้หนังสือฉบับเดียวกัน (เลข ${fileLeadingNumber(m.file.name)})`;
      m.letterKey = null;
    }
  }
  return res;
}

/** คำขอบันทึกฉบับลงนาม — ฉบับเดียว → /review · หลายคน → /letter-batch (ช่องเดียวกับหน้าต่างออกหนังสือเดิม) */
export function signedLetterRequest(letter: BulkLetterType, p: PendingLetter<any>, delivery: Delivery, file: File): { url: string; body: FormData } {
  const docNo = normalizeDocNumber(p.docNumber ?? "");
  const docDate = p.docDate ?? "";
  const body = new FormData();
  const group = p.students.length > 1;
  if (group) {
    body.append("letter", letter);
    body.append("studentIds", JSON.stringify(p.students.map((s: any) => s.id)));
    body.append("docNumber", docNo);
    body.append("docDate", docDate);
  }
  body.append("studentId", String(p.students[0].id));
  if (letter === "REQUEST") {
    body.append("status", "REQ_LETTER_ISSUED");
    body.append("docType", "DISPATCH_LETTER");
    body.append("comment", delivery === "STUDENT"
      ? `เจ้าหน้าที่ออกหนังสือแล้ว ให้นักศึกษามารับเอกสารตัวจริงที่คณะ หรือดาวน์โหลดไฟล์เพื่อนำไปยื่นบริษัทด้วยตนเอง`
      : `เจ้าหน้าที่ออกหนังสือและได้จัดส่งให้บริษัททางไปรษณีย์/อีเมลเรียบร้อยแล้ว`);
    body.append("deliveryMethod", delivery);
    body.append("reqDocNumber", docNo);
    body.append("reqDocDate", docDate);
  } else {
    body.append("status", "PLACEMENT_LETTER_ISSUED");
    body.append("docType", "PLACEMENT_LETTER");
    body.append("comment", delivery === "STUDENT"
      ? `เจ้าหน้าที่ออกหนังสือส่งตัวแล้ว ให้นักศึกษามารับเอกสารตัวจริงที่คณะ หรือดาวน์โหลดไปยื่นบริษัทในวันรายงานตัว`
      : `เจ้าหน้าที่ออกหนังสือส่งตัวและจัดส่งให้บริษัทล่วงหน้าเรียบร้อยแล้ว`);
    body.append("deliveryMethod", delivery);
    body.append("placeDocNumber", docNo);
    body.append("placeDocDate", docDate);
  }
  body.append("file", file);
  return { url: group ? "/api/admin/t000/letter-batch" : "/api/admin/t000/review", body };
}
