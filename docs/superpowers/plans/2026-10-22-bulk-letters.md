# ออกร่างหนังสือหลายคน + อัปโหลดฉบับลงนามหลายฉบับ (T000) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เจ้าหน้าที่ออกร่างหนังสือขอความอนุเคราะห์/ส่งตัวของนักศึกษาหลายคนเป็น zip ครั้งเดียว (เลขต่อกัน รวมฉบับตามบริษัท ติดป้ายรอลงนามทั้งชุด) แล้วอัปโหลดฉบับลงนามที่สแกนกลับมาหลายไฟล์ครั้งเดียว (จับคู่จากเลขหน้าชื่อไฟล์)

**Architecture:** backend เพิ่ม endpoint เดียว `PUT /api/admin/t000/letter-pending-bulk` ติดป้ายรอลงนามทั้งชุดในทรานแซกชันเดียว (ใช้ด่านเลขซ้ำเดิม) · การสร้างไฟล์ทั้งหมดอยู่ฝั่งหน้าเว็บด้วยตัวสร้าง Word/PDF เดิม ทีละฉบับ ใส่ zip แบบ stream (fflate) · การบันทึกฉบับลงนามเรียก endpoint เดิมทีละฉบับ (`/t000/review` หนังสือเดี่ยว · `/t000/letter-batch` หนังสือรวม) · ตรรกะที่ตัดสินใจ (ไล่เลข จัดกลุ่ม ตั้งชื่อไฟล์ จับคู่ชื่อไฟล์) เป็นฟังก์ชันล้วนใน `utils/bulkLetters.ts` มีเทสต์

**Tech Stack:** Express + Prisma 4 + MySQL, Jest · React 19 + TypeScript + Vite, jsPDF + pdf-lib (มีอยู่), `xlsx` (มีอยู่), `fflate` (เพิ่ม), Playwright (unit config + เบราว์เซอร์จริง)

**Spec:** `docs/superpowers/specs/2026-10-22-bulk-letters-design.md` (commit 39285c2)

## Global Constraints

- ผู้ใช้: **เจ้าหน้าที่เท่านั้น** — ปุ่มแสดงเมื่อ `isStaff` · endpoint ใหม่ `verifyToken, verifyRole(...STAFF_ONLY)`
- ประเภท: `REQUEST` (ขอความอนุเคราะห์ → ช่อง `reqLetter*`, ขั้น `DOCS_APPROVED`) · `PLACEMENT` (ส่งตัว → `placeLetter*`, ขั้น `ACCEPTANCE_CHECKED`) — ไม่ทำหนังสือขอนิเทศ
- เลขหนังสือเก็บแบบ `normalizeDocNumber` (ตัด "ที่ อว") เช่น `660301.26.6.2/1234` · ไล่เลข = เลขท้าย `/` +1 ต่อฉบับ · เลขท้ายต้องเป็นตัวเลข · วันที่เดียวทั้งชุด
- รูปแบบไฟล์: **Word (.doc) ค่าเริ่มต้น** · PDF ตัวเลือก · ขอความอนุเคราะห์ + Word = 2 ไฟล์ต่อฉบับ (`.doc` + `-เอกสารแนบ.pdf`) · ขอความอนุเคราะห์ + PDF = 1 ไฟล์ · ส่งตัว = 1 ไฟล์ทั้งสองแบบ
- ชื่อไฟล์ใน zip: `<เลขท้าย>-<ประเภท>-<ชื่อบริษัท>.<doc|pdf>` และ `<เลขท้าย>-<ประเภท>-<ชื่อบริษัท>-เอกสารแนบ.pdf` · ประเภท = `หนังสือขอความอนุเคราะห์` / `หนังสือส่งตัว` · มี `_รายการเลขหนังสือ.xlsx` คอลัมน์ `เลขที่ · วันที่ · ประเภท · เรียน · บริษัท · นักศึกษา · ชื่อไฟล์`
- ป้ายรอลงนามทั้งชุดหรือไม่เลย · ชนเลขฉบับเดียว = ไม่ติดเลย ไม่โหลด และบอกว่าฉบับไหนชน
- ใช้ตัวสร้าง Word/PDF เดิม (`buildDispatchLetterHtml`, `buildPlacementLetterHtml`, `createWordBlob`, `createDispatchPDF`, `createPlacementPDF`) — ไม่สร้างแม่แบบใหม่ · หน้าต่างออกหนังสือรายคน/หนังสือรวมเดิมต้องทำงานเหมือนเดิม
- ข้อความในหน้าต่างเป็นภาษาไทยธรรมดา เป็นข้อ ส่วนยาวพับเก็บได้ (`<details>`) · ใช้ `letter-modal-backdrop` / `letter-modal-card` + `MODAL_CSS` แบบหน้าต่างหนังสือเดิม (การ์ดสว่างเสมอ — ยกเว้นธีมมืดไว้แล้ว) · จอ 390px ต้องไม่ล้นแนวนอน
- backend: `{ ok, ... }` · try/catch · route ใหม่ต้องลง `__tests__/routes/admin.permissions.test.js` (`STAFF_ONLY_SENSITIVE`) + `RULES` ใน `utils/auditActions.js` (ชื่อการกระทำภาษาไทย)
- CHANGELOG.md ทุก commit · commit ท้ายด้วย `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` · ใช้ `git -C <path>` · ไม่ push (ผู้ใช้สั่งเอง)
- baseline: backend `npm test` 1787 ผ่าน · `npx tsc --noEmit` 0 error · unit หน้าเว็บ 28 ผ่าน (`npx playwright test --config=playwright.unit.config.ts deadlines.spec.ts letterUtils.spec.ts letterRecipient.spec.ts`) — ห้ามลด
- ค้นโค้ดเฉพาะ `backend/` และ `Frontend/src/` · ห้ามแตะ `backend/.env` · ตรวจในเบราว์เซอร์ให้รัน backend ด้วย `API_RATE_LIMIT_MAX=100000` (ในเครื่องเท่านั้น)

## Review Focus

1. **ออกร่างใหม่ให้คนที่รอลงนามอยู่ / กดโหลดซ้ำหลังสร้างไฟล์ล้มกลางทาง** — ต้องผ่าน ไม่ 409 ชนกับร่างเก่าของตัวเอง (เลขเดิมของคนในชุดถูกล้างก่อนตรวจ) → เทสต์ใน Task 1
2. **หนังสือรวมที่มีเพื่อนอยู่นอกรอบที่เลือก** (`outsidePeriod`) — ร่างและฉบับลงนามต้องผูกครบทุกคน · แถวนอกรอบเลือกเป็นผู้สมัครเองไม่ได้ → เทสต์ใน Task 2 (`groupPending`, `bulkCandidates`)
3. **ชื่อไฟล์สแกนแบบที่เจอจริง** — `811-บริษัท….pdf`, `811 บริษัท.PDF`, `811.pdf`, `660301.26.6.2_811-….pdf`, `811-…(1).pdf`, ช่องว่างนำหน้า, `scan001.pdf`, `660301.26.6.2.pdf` (ไม่มีเลขท้าย) และสองไฟล์เลขเดียวกัน → เทสต์ใน Task 2 (`fileLeadingNumber`, `matchFiles`)
4. **เจ้าหน้าที่สองคนออกร่างพร้อมกัน เลขทับกัน** — คนหนึ่งได้ 409 อีกคนผ่าน ไม่ deadlock (ล็อกเลขเรียงลำดับก่อน) → เทสต์ใน Task 1
5. **ชุดใหญ่ (40 ฉบับขอความอนุเคราะห์ ~300 MB) และไฟล์แนบบางไฟล์หายจากเซิร์ฟเวอร์** — เตือนก่อนเริ่ม แสดงความคืบหน้า ข้ามไฟล์ที่หายแล้วสรุปให้ดูตอนจบ (ไม่ถามทีละฉบับ) · ล้มกลางทาง = บอกว่าจองเลขไว้แล้ว กดโหลดซ้ำได้เลขเดิม → ตรวจใน Task 6 (เบราว์เซอร์ ≥ 10 ฉบับ + ลบไฟล์แนบชั่วคราว 1 ไฟล์)

---

## File Structure

| ไฟล์ | หน้าที่ |
|------|--------|
| `backend/controllers/adminDocController.js` | + `markLetterPendingBulk` |
| `backend/routes/adminRoutes.js` | + `PUT /t000/letter-pending-bulk` |
| `backend/utils/auditActions.js` | + แถว RULES + `letterPendingBulkActionText` |
| `backend/__tests__/letterPendingBulk.test.js` | ใหม่ — เทสต์ endpoint |
| `backend/__tests__/__mocks__/prismaClient.js` | + `studentCoop.updateMany` |
| `backend/__tests__/routes/admin.permissions.test.js` | + route ใน `STAFF_ONLY_SENSITIVE` |
| `Frontend/src/utils/bulkLetters.ts` | ใหม่ — ฟังก์ชันล้วน: ผู้สมัคร จัดกลุ่ม ไล่เลข ชื่อไฟล์ จับคู่ไฟล์ ฟอร์มบันทึก |
| `Frontend/src/utils/bulkLetterZip.ts` | ใหม่ — zip แบบ stream (fflate) + Excel รายการเลขหนังสือ |
| `Frontend/tests/bulkLetters.spec.ts` | ใหม่ — เทสต์สองไฟล์ข้างบน |
| `Frontend/src/utils/letterAssets.ts` | ใหม่ — โหลดตราครุฑ/ไฟล์ระบบ/ชื่อคณบดี + ตรวจไฟล์แนบที่ยังอยู่ (ย้ายมาจากสองหน้าต่างเดิม) |
| `Frontend/src/utils/pdfDispatchGenerator.ts` | + `createDispatchAttachmentsPDF` (ตัวรวมเดียวกัน ไม่มีหน้าหนังสือ) |
| `Frontend/src/utils/bulkLetterFiles.ts` | ใหม่ — สร้างไฟล์ของหนังสือ 1 ฉบับ |
| `Frontend/src/components/IssueLetterModal.tsx`, `IssuePlacementLetterModal.tsx` | ใช้ `letterAssets.ts` แทนโค้ดซ้ำ (พฤติกรรมเดิม) |
| `Frontend/src/components/BulkLetterDraftModal.tsx` | ใหม่ — หน้าต่างออกร่างหลายคน |
| `Frontend/src/components/BulkSignedUploadModal.tsx` | ใหม่ — หน้าต่างอัปโหลดฉบับลงนามหลายฉบับ |
| `Frontend/src/components/A_DocT000.tsx` | + 2 ปุ่มในแถบเครื่องมือ (เจ้าหน้าที่) |

---

### Task 1: Backend — ติดป้ายรอลงนามหลายฉบับในทรานแซกชันเดียว

**Files:**
- Modify: `backend/controllers/adminDocController.js` (ต่อท้าย `markLetterPending` ~บรรทัด 790)
- Modify: `backend/routes/adminRoutes.js:54` (ใต้ `letter-pending`)
- Modify: `backend/utils/auditActions.js` (RULES ใต้บรรทัด 64 + ฟังก์ชันใหม่ export)
- Modify: `backend/__tests__/__mocks__/prismaClient.js` (`studentCoop.updateMany: jest.fn()`)
- Modify: `backend/__tests__/routes/admin.permissions.test.js:40`
- Create: `backend/__tests__/letterPendingBulk.test.js`

**Interfaces:**
- Produces: `PUT /api/admin/t000/letter-pending-bulk` (JSON)
  - body `{ letter: 'REQUEST'|'PLACEMENT', docDate: 'YYYY-MM-DD', letters: [{ studentIds: number[], docNumber: string }] }`
  - 200 `{ ok: true, count: <จำนวนฉบับ>, pendingAt: ISO }`
  - 409 `{ ok: false, message, conflicts: [{ docNumber: string, message: string }] }` (เลขชนกับคนนอกชุด หรือซ้ำกันเองในชุด)
  - 400 `{ ok: false, message }` · 404 ไม่พบ/ถูกลบ
- Produces: `letterPendingBulkActionText({ letter, docNumbers }) → string` ใน `utils/auditActions.js`

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** — `backend/__tests__/letterPendingBulk.test.js` ตั้งค่าแบบ `letterBatch.test.js` (mock `config/prismaClient`, `$transaction` เรียก callback ด้วย prisma, `studentCoop.findFirst` → null, `updateMany` → `{ count: 1 }`)

```js
const { markLetterPendingBulk } = require('../controllers/adminDocController');
const row = (id, status = 'DOCS_APPROVED', companyId = 'c1') => ({ studentId: id, status, companyId, student: { deletedAt: null, studentId: `65000000${id}`, firstName: 'ชื่อ', lastName: `${id}` } });
const req = (over = {}) => ({ user: { id: 1, role: 'staff' }, body: { letter: 'REQUEST', docDate: '2026-10-22',
  letters: [{ studentIds: [1, 2], docNumber: 'ที่ อว 660301.26.6.2/811' }, { studentIds: [3], docNumber: '660301.26.6.2/812' }], ...over } });
const pendingSets = () => prisma.studentCoop.updateMany.mock.calls.map((c) => c[0]).filter((a) => a.data.reqLetterPendingAt instanceof Date);

test('ติดป้ายทุกฉบับ — เลขของแต่ละฉบับ วันที่เดียวกัน', ...)
  // findMany → [row(1), row(2), row(3)]
  expect(res.status).not.toHaveBeenCalled();
  expect(pendingSets()).toEqual([
    { where: { studentId: { in: [1, 2] } }, data: expect.objectContaining({ reqLetterDraftNumber: '660301.26.6.2/811', reqLetterDraftDate: new Date('2026-10-22') }) },
    { where: { studentId: { in: [3] } }, data: expect.objectContaining({ reqLetterDraftNumber: '660301.26.6.2/812' }) },
  ]);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, count: 2 }));
  expect(res.locals.audit.action).toBe('โหลดร่างหนังสือขอความอนุเคราะห์หลายฉบับ (รอลงนาม) 2 ฉบับ: 660301.26.6.2/811, 660301.26.6.2/812');

test('เลขชนกับหนังสือของคนนอกชุด → 409 บอกเลขที่ชน · ไม่ติดป้ายฉบับไหนเลย')
  // findFirst: where.OR[0].reqDocNumber === '660301.26.6.2/812' → { reqDocNumber: '660301.26.6.2/812', student: { studentId: '650000009', firstName: 'ก', lastName: 'ข' } }
  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json.mock.calls[0][0].conflicts).toEqual([expect.objectContaining({ docNumber: '660301.26.6.2/812', message: expect.stringContaining('650000009') })]);
  expect(pendingSets()).toHaveLength(0);

test('เลขซ้ำกันเองในชุด → 409 ไม่เปิดทรานแซกชัน')
  // letters: [{ [1], '…/811' }, { [3], '660301.26.6.2/811' }]
  expect(res.status).toHaveBeenCalledWith(409); expect(prisma.$transaction).not.toHaveBeenCalled();
  expect(res.json.mock.calls[0][0].conflicts[0].docNumber).toBe('660301.26.6.2/811');

test('มีคนยังไม่ถึงขั้น → 400 บอกรหัส ไม่ติดป้าย')          // row(3, 'QUALIFIED') → message มี '650000003'
test('คนเดียวอยู่สองฉบับ → 400')                             // letters [[1,2],[2]]
test('หนังสือรวมต่างบริษัท → 400')                            // row(2, 'DOCS_APPROVED', 'c2')
test('เลขยังไม่กรอก (660301.26.6.2/) · ไม่มีวันที่ · letters ว่าง · เกิน 200 ฉบับ → 400')
test('ไม่พบนักศึกษา / ถูกลบ → 404')                          // findMany คืน 2 แถวจาก 3 · หรือ deletedAt มีค่า
test('ล้างร่างเดิมของคนในชุดก่อนตรวจเลข — ออกร่างใหม่ซ้ำเลขเดิมได้')
  const clear = prisma.studentCoop.updateMany.mock.calls.findIndex((c) => c[0].data.reqLetterDraftNumber === null);
  expect(prisma.studentCoop.updateMany.mock.calls[clear][0].where).toEqual({ studentId: { in: [1, 2, 3] } });
  expect(prisma.studentCoop.updateMany.mock.invocationCallOrder[clear]).toBeLessThan(prisma.studentCoop.findFirst.mock.invocationCallOrder[0]);
test('ล็อกเลขทุกฉบับเรียงลำดับก่อนตรวจ (สองคนออกพร้อมกันไม่ deadlock)')
  // letters ลำดับ '/812' แล้ว '/811'
  expect(prisma.$executeRaw.mock.calls.slice(0, 2).map((c) => c[2])).toEqual(['660301.26.6.2/811', '660301.26.6.2/812']);
test('ส่งตัว: ใช้ช่อง placeLetter* และขั้น ACCEPTANCE_CHECKED')  // letter 'PLACEMENT' + row(…, 'DOCS_APPROVED') → 400 · 'ACCEPTANCE_CHECKED' → placeLetterDraftNumber
```

- [ ] **Step 2: รันให้เห็นว่าล้ม** — `cd backend && npx jest __tests__/letterPendingBulk.test.js` → FAIL `markLetterPendingBulk is not a function`

- [ ] **Step 3: เขียน `exports.markLetterPendingBulk = async (req, res)`** — ลำดับที่ต้องเป็นแบบนี้ (เทสต์ผูกไว้):
  1. ตรวจนอกทรานแซกชัน: `LETTER_KEY_BY_TYPE[letter]` · `letters` เป็น array 1–200 ฉบับ · `docDate` ต้องมี (`parseDateOr400`) · ต่อฉบับ: `parseIdList(studentIds)` ≥ 1 คน, `normalizeDocNumber` แล้วห้าม `isPlaceholderDocNo` (400 บอกเลขที่ผิด) · คนเดียวห้ามอยู่สองฉบับ (400 บอกรหัส id) · เลขซ้ำกันเองในชุด → 409 `conflicts: [{ docNumber, message: 'เลขที่ … ซ้ำกันในชุดนี้' }]`
  2. ใน `prisma.$transaction(..., DOC_NUMBER_TX)`: `lockDocNumber(tx, key, n)` ทุกเลข**เรียงลำดับ** (`localeCompare` แบบ numeric) → `tx.studentCoop.findMany({ where: { studentId: { in: allIds } }, select: { studentId, status, companyId, student: { select: { deletedAt, studentId, firstName, lastName } } } })` → ไม่ครบ/ถูกลบ = 404 · ต่ำกว่า `LETTERS[key].minStatus` = 400 บอกรหัสทุกคน · หนังสือรวม (≥ 2 คน) ต้อง `companyId` เดียวกันและไม่ว่าง (กติกาเดียวกับ `issueLetterBatch` — ไม่งั้นอัปโหลดฉบับลงนามจะล้มทีหลัง) = 400
  3. `tx.studentCoop.updateMany({ where: { studentId: { in: allIds } }, data: clearedLetterPending(key) })` (ล้างร่างเดิมของคนในชุด)
  4. ทุกฉบับ: `assertDocNumberFree(tx, key, docNo, ids)` — จับ `is409` เก็บลง `conflicts` แล้วไปฉบับถัดไป · จบลูปมี conflicts → โยน 409 (rollback ข้อ 3)
  5. ทุกฉบับ: `tx.studentCoop.updateMany({ where: { studentId: { in: ids } }, data: { [`${key}PendingAt`]: now, [`${key}DraftNumber`]: docNo, [`${key}DraftDate`]: date } })`
  6. `setAuditDetail(res, { action: letterPendingBulkActionText({ letter, docNumbers }), targetType: 'นักศึกษา', targetId: allIds.join(',') })` → `res.json({ ok: true, count, pendingAt: now })`
  
  `letterPendingBulkActionText` = `โหลดร่าง${LETTER_NAME[letter]}หลายฉบับ (รอลงนาม) ${n} ฉบับ: ${docNumbers.join(', ')}` · แถว RULES: `['PUT', '/api/admin/t000/letter-pending-bulk', 'โหลดร่างหนังสือหลายฉบับ (รอลงนาม)', 'นักศึกษา', null]` · route: `router.put('/t000/letter-pending-bulk', verifyToken, verifyRole(...STAFF_ONLY), adminDocController.markLetterPendingBulk);` · เพิ่ม `'PUT /t000/letter-pending-bulk'` ใน `STAFF_ONLY_SENSITIVE`

- [ ] **Step 4: รันเทสต์** — `npx jest __tests__/letterPendingBulk.test.js` PASS · แล้ว `npm test` ทั้งชุด ≥ 1787 + ใหม่ ผ่านหมด (รวม `admin.permissions`, `auditLog`)

- [ ] **Step 5: CHANGELOG + commit** — `feat: ติดป้ายรอลงนามหนังสือหลายฉบับในคำขอเดียว (ทั้งชุดหรือไม่เลย)`

---

### Task 2: ฟังก์ชันล้วนฝั่งหน้าเว็บ + zip + Excel

**Files:**
- Create: `Frontend/src/utils/bulkLetters.ts`, `Frontend/src/utils/bulkLetterZip.ts`, `Frontend/tests/bulkLetters.spec.ts`
- Modify: `Frontend/package.json` (`npm install fflate@0.8.2`)

**Interfaces:**
- Consumes: `normalizeDocNumber`, `toThaiDate` (`utils/docGeneratorUtils.ts`)
- Produces (`bulkLetters.ts`):
  - `type BulkLetterType = "REQUEST" | "PLACEMENT"` · `type BulkFormat = "doc" | "pdf"` · `type Delivery = "STUDENT" | "STAFF"`
  - `LETTER_PREFIX: Record<BulkLetterType, "reqLetter" | "placeLetter">` · `LETTER_FILE_LABEL = { REQUEST: "หนังสือขอความอนุเคราะห์", PLACEMENT: "หนังสือส่งตัว" }`
  - `interface BulkLetterGroup<T> { key: string; companyName: string; students: T[] }`
  - `interface PendingLetter<T> { key: string; docNumber: string | null; docDate: string | null; companyName: string; students: T[] }`
  - `interface FileMatch { file: File; letterKey: string | null; reason: string | null }`
  - `bulkCandidates<T>(students: T[], letter): T[]` — สถานะตรงขั้นพอดี (`DOCS_APPROVED` / `ACCEPTANCE_CHECKED`) · ยังไม่มี `coop.reqLetterUrl` / `coop.placeLetterUrl` · ไม่ใช่ `outsidePeriod`
  - `blockReason(s, letter): string | null` — `"ยังไม่มีบริษัท"` (ไม่มี `coop.companyId`) · REQUEST: `"ยังไม่มีวันเริ่มฝึก"` · PLACEMENT: `"ยังไม่มีวันเริ่ม/สิ้นสุดฝึก"` (วัน = `coop.actualStartDate || coopApplicationForm.startDate` แบบเดียวกับหน้าต่างรายคน)
  - `pendingDraftOf(s, letter): { at: string; number: string | null } | null`
  - `groupByCompany<T>(students: T[], splitIds: Set<number>): BulkLetterGroup<T>[]` — key = `coop.companyId` · คนใน `splitIds` = กลุ่มเดี่ยว key `solo:<id>` · เรียงกลุ่มตามชื่อบริษัท (`localeCompare(…, "th")`) แล้วรหัสนักศึกษาคนแรก · ในกลุ่มเรียงตามรหัส
  - `docSuffix(docNumber?: string | null): number | null` · `numberSequence(start: string, count: number): string[] | null` (คงจำนวนหลักเดิม เช่น `/0099` → `/0100`) · `duplicateNumbers(numbers: string[]): Set<string>` (เทียบหลัง normalize)
  - `safeFileName(name: string): string` · `letterFileNames(letter, format, docNumber, companyName): string[]` (ไฟล์หลักก่อน แล้วเอกสารแนบ)
  - `fileLeadingNumber(fileName: string): number | null` · `groupPending<T>(students: T[], letter): PendingLetter<T>[]` · `matchFiles(files: File[], letters: PendingLetter<any>[]): FileMatch[]`
  - `signedLetterRequest(letter, p: PendingLetter<any>, delivery: Delivery, file: File): { url: string; body: FormData }`
- Produces (`bulkLetterZip.ts`):
  - `createZip(): { add(name: string, data: Uint8Array): void; finish(): Promise<Blob> }` — fflate `Zip` + `ZipPassThrough` (ไม่บีบอัด — PDF บีบอยู่แล้ว · ชื่อไทยต้องได้ flag UTF-8 ซึ่ง fflate ตั้งเอง) เก็บ chunk ต่อกันเป็น Blob
  - `interface RegisterRow { docNumber: string; docDate: string; letter: BulkLetterType; recipient: string; companyName: string; students: string[]; files: string[] }`
  - `registerWorkbook(rows: RegisterRow[]): Uint8Array` — `xlsx` sheet เดียว หัวตาราง 7 คอลัมน์ตาม Global Constraints · วันที่ `toThaiDate` · นักศึกษา/ชื่อไฟล์ คั่นด้วยขึ้นบรรทัดใหม่

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** — `Frontend/tests/bulkLetters.spec.ts` (แบบ `letterUtils.spec.ts`)

```ts
test("numberSequence ไล่เลขท้าย / · คงหลัก · ไม่ใช่ตัวเลข = null", () => {
  expect(numberSequence("ที่ อว 660301.26.6.2/1234", 3)).toEqual(["660301.26.6.2/1234", "660301.26.6.2/1235", "660301.26.6.2/1236"]);
  expect(numberSequence("660301.26.6.2/0099", 2)).toEqual(["660301.26.6.2/0099", "660301.26.6.2/0100"]);
  expect(numberSequence("660301.26.6.2/", 2)).toBeNull();
  expect(numberSequence("660301.26.6.2/12ก", 2)).toBeNull();
});
test("duplicateNumbers เทียบหลังตัด 'ที่ อว'", () => {
  expect([...duplicateNumbers(["ที่ อว 660301.26.6.2/811", "660301.26.6.2/811", "660301.26.6.2/812"])]).toEqual(["660301.26.6.2/811"]);
});
test("bulkCandidates / blockReason", () => {
  // DOCS_APPROVED + ไม่มี reqLetterUrl → อยู่ · REQ_LETTER_ISSUED → ไม่อยู่ · DOCS_APPROVED + reqLetterUrl → ไม่อยู่ · outsidePeriod → ไม่อยู่
  // ไม่มี companyId → "ยังไม่มีบริษัท" · REQUEST ไม่มีวันเริ่ม → "ยังไม่มีวันเริ่มฝึก" · PLACEMENT มีวันเริ่มไม่มีวันสิ้นสุด → "ยังไม่มีวันเริ่ม/สิ้นสุดฝึก" · วันจาก coopApplicationForm ใช้ได้
});
test("groupByCompany: บริษัทเดียวกันรวม · แยกฉบับได้ · เรียงชื่อบริษัทแล้วรหัส", () => {
  // ข(c2: 650000003) · ก(c1: 650000002, 650000001) · ก(c1) แยก 650000002
  expect(groups.map(g => [g.companyName, g.students.map(s => s.studentId)])).toEqual([
    ["บริษัท ก จำกัด", ["650000001"]], ["บริษัท ก จำกัด", ["650000002"]], ["บริษัท ข จำกัด", ["650000003"]]]);
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
    ["scan001.pdf", null], ["660301.26.6.2.pdf", null], ["บริษัท 811.pdf", null]] as const) expect(fileLeadingNumber(name)).toBe(n);
});
test("groupPending: เลขร่างเดียวกัน = ฉบับเดียว รวมเพื่อนนอกรอบ · ฉบับที่ทุกคนอยู่นอกรอบไม่แสดง · ไม่มีเลขร่าง = ฉบับเดี่ยว", () => {
  // id1 ร่าง /811 ในรอบ · id2 ร่าง /811 outsidePeriod · id3 ร่าง /812 outsidePeriod คนเดียว · id4 รอลงนามแต่ไม่มีเลขร่าง · id5 ไม่ได้รอลงนาม
  expect(groupPending(list, "REQUEST").map(p => [p.key, p.docNumber, p.students.map(s => s.id)])).toEqual([
    ["660301.26.6.2/811", "660301.26.6.2/811", [1, 2]], ["id:4", null, [4]]]);
  expect(groupPending(list, "REQUEST")[0].docDate).toBe("2026-10-22");   // จาก reqLetterDraftDate ตัดเหลือ 10 ตัว
});
test("matchFiles: ตรงฉบับเดียวผูกให้ · ไม่มีเลข / ไม่มีฉบับ / สองไฟล์ชี้ฉบับเดียว → ไม่ผูก มีเหตุผล", () => {
  // ฉบับ /811 (2 คน) และ /812 · ไฟล์ 811-a.pdf, 812-b.pdf, 812-c.pdf, 999.pdf, scan.pdf
  expect(r.map(m => [m.file.name, m.letterKey])).toEqual([["811-a.pdf", "660301.26.6.2/811"], ["812-b.pdf", null], ["812-c.pdf", null], ["999.pdf", null], ["scan.pdf", null]]);
  expect(r[1].reason).toContain("หลายไฟล์"); expect(r[3].reason).toContain("999"); expect(r[4].reason).toContain("ไม่ขึ้นต้นด้วยเลข");
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
  // add 2 ไฟล์ → finish → unzipSync(new Uint8Array(await blob.arrayBuffer())) → keys เท่าชื่อเดิม เนื้อเท่าเดิม
});
test("registerWorkbook: หัวตาราง 7 คอลัมน์", () => {
  const ws = XLSX.read(registerWorkbook([row]), { type: "array" }).Sheets;
  // แถวแรก = ["เลขที่", "วันที่", "ประเภท", "เรียน", "บริษัท", "นักศึกษา", "ชื่อไฟล์"] · แถวสอง เลขที่เต็ม + วันที่ไทย + "หนังสือขอความอนุเคราะห์"
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม** — `cd Frontend && npx playwright test --config=playwright.unit.config.ts bulkLetters.spec.ts` → FAIL (import ไม่พบ)

- [ ] **Step 3: เขียน `bulkLetters.ts` และ `bulkLetterZip.ts` ตาม Interfaces** — `fileLeadingNumber`: ตัดช่องว่างหน้า + นามสกุลไฟล์ · ขึ้นต้นด้วยเลขเต็มแบบมีจุด (`^\d+(?:\.\d+)+`) → ต้องตามด้วยตัวคั่น `[-_ ]+` แล้วเลข (`^\d+(?:\.\d+)+[-_ ]+(\d+)`) ไม่งั้น null · ไม่มีจุด → `^(\d+)(?=$|[\s\-_.(])` · `matchFiles`: ผูกต่อเมื่อเลขตรง `docSuffix` ของฉบับเดียวพอดี แล้วปลดทุกไฟล์ที่ชี้ฉบับซ้ำกัน · ข้อความ comment/สถานะ/docType ใน `signedLetterRequest` คัดลอกจาก `handleConfirm` ของสองหน้าต่างเดิมตรงตัว · `docDate` ส่งรูป `YYYY-MM-DD`

- [ ] **Step 4: รันเทสต์** — spec ใหม่ PASS · unit เดิม 28 ยังผ่าน · `npx tsc --noEmit` 0

- [ ] **Step 5: CHANGELOG + commit** — `feat: ฟังก์ชันออกร่างหลายคน — ไล่เลข จัดกลุ่มบริษัท ชื่อไฟล์ จับคู่ไฟล์สแกน + zip/Excel`

---

### Task 3: สร้างไฟล์ของหนังสือ 1 ฉบับ (ใช้ตัวสร้างเดิม) + เอกสารแนบรวมเล่ม

**Files:**
- Create: `Frontend/src/utils/letterAssets.ts`, `Frontend/src/utils/bulkLetterFiles.ts`
- Modify: `Frontend/src/utils/pdfDispatchGenerator.ts:227-340` (แยกส่วนรวมไฟล์เป็น helper)
- Modify: `Frontend/src/components/IssueLetterModal.tsx:44-95`, `Frontend/src/components/IssuePlacementLetterModal.tsx:35-46` (เรียก `letterAssets.ts` แทนโค้ดเดิม)

**Interfaces:**
- Consumes: `letterFileNames`, `LETTER_FILE_LABEL`, `BulkLetterType`, `BulkFormat` (Task 2)
- Produces:
  - `interface LetterAssets { krutUrl: string | null; projectUrl: string | null; acceptUrl: string | null; deanName: string; deanPosition: string }`
  - `loadLetterAssets(): Promise<LetterAssets>` — เหมือน `loadCommonData` เดิม (`/api/admin/assets` + `/api/admin/config/dean-info`, ค่าคณบดีตั้งต้นเดิม)
  - `existingAttachmentFiles(students: any[]): Promise<{ files: { type: string; url: string }[]; missing: string[] }>` — `letterAttachmentDocs` + HEAD `/uploads/<path>` เหมือนเดิม · `missing` = ชื่อไฟล์ที่หาย
  - `createDispatchAttachmentsPDF(staticProjectUrl: string, staticAcceptanceUrl: string, studentDocs: { type: string; url: string }[]): Promise<Blob>` — ลำดับเดียวกับหน้า 2 เป็นต้นไปของ `createDispatchPDF` (รายละเอียดโครงการ → เอกสารนักศึกษาตาม `orderMap` → แบบฟอร์มตอบรับ) · `createDispatchPDF` เรียก helper เดียวกันหลังหน้าปก (ผลเท่าเดิม)
  - `buildLetterFiles(opts: { letter: BulkLetterType; format: BulkFormat; docNumber: string; docDate: string; students: any[]; assets: LetterAssets }): Promise<{ files: { name: string; blob: Blob }[]; missingAttachments: string[] }>` — `students[0]` = ผู้รับ/บริษัท · ส่ง `students.map(toLetterStudent)` เมื่อ ≥ 2 คน · อาร์กิวเมนต์ของตัวสร้างแต่ละตัวเท่ากับใน `handleCreatePdf`/`handleCreateDoc` ของหน้าต่างเดิม · ไม่มี `krutUrl` เมื่อต้องใช้ (PDF) = throw `"ไม่พบไฟล์ตราครุฑ (KRUT) กรุณาอัปโหลดในหน้าตั้งค่า"`

- [ ] **Step 1: เก็บค่าก่อนแก้** — เปิดหน้าต่างออกหนังสือรายคนในเบราว์เซอร์ (นักศึกษา `DOCS_APPROVED` ที่มีเอกสารแนบ และหนังสือรวม 2 คน) สร้าง PDF + Word แล้วจดจำนวนหน้า PDF (`PDFDocument.load(...).getPageCount()` ในสคริปต์ scratchpad) และขนาดไฟล์ Word

- [ ] **Step 2: แยก helper + เขียน `letterAssets.ts` / `bulkLetterFiles.ts` + ให้สองหน้าต่างเดิมเรียก `loadLetterAssets` / `existingAttachmentFiles`** — หน้าต่างรายคนยังถาม `askConfirm` เรื่องไฟล์หายเหมือนเดิม (ใช้ `missing` จาก helper)

- [ ] **Step 3: ตรวจ** — `npx tsc --noEmit` 0 · สร้างซ้ำแบบ Step 1 ได้จำนวนหน้าเท่าเดิม · `createDispatchAttachmentsPDF` ของคนเดียวกัน = จำนวนหน้า `createDispatchPDF` − หน้าหนังสือ (1 หน้า หนังสือเดี่ยว / ตามจริงของหนังสือรวม)

- [ ] **Step 4: CHANGELOG + commit** — `refactor: แยกตัวรวมเอกสารแนบหนังสือขอความอนุเคราะห์ + ตัวสร้างไฟล์รายฉบับ (ใช้กับออกร่างหลายคน)`

---

### Task 4: หน้าต่างออกร่างหลายคน

**Files:**
- Create: `Frontend/src/components/BulkLetterDraftModal.tsx`
- Modify: `Frontend/src/components/A_DocT000.tsx:683-691` (ปุ่ม "ออกร่างหนังสือหลายคน" เมื่อ `isStaff` + state เปิดหน้าต่าง)

**Interfaces:**
- Consumes: Task 1 endpoint · Task 2 `bulkCandidates`, `blockReason`, `pendingDraftOf`, `groupByCompany`, `numberSequence`, `duplicateNumbers`, `letterFileNames`, `createZip`, `registerWorkbook` · Task 3 `loadLetterAssets`, `buildLetterFiles` · `letterRecipient`/`recipientText` (คอลัมน์ "เรียน")
- Produces: `export default function BulkLetterDraftModal(props: { students: any[]; onClose: () => void })` — `onClose` ของ A_DocT000 = ปิด + `refreshStudents()` (ป้ายรอลงนามเปลี่ยน)

- [ ] **Step 1: เขียนหน้าต่าง** — พฤติกรรมที่ต้องมี:
  - ประเภท (ค่าเริ่มต้น ขอความอนุเคราะห์) · รายชื่อ = `bulkCandidates(students, letter)` · ติ๊กไว้ก่อนทุกคนที่ `blockReason` = null และไม่ได้รอลงนามอยู่ · คนรอลงนามอยู่แสดง "รอลงนามอยู่ (เลข …)" ติ๊กได้ · คนที่มี `blockReason` แสดงเหตุผล ติ๊กไม่ได้ · ไม่มีใครพร้อม = ข้อความว่าง
  - ตารางฉบับ = `groupByCompany(ติ๊กอยู่, splitIds)` · ปุ่ม "แยกฉบับ" รายคน (ในกลุ่ม ≥ 2 คน) / "รวมกลับ"
  - เลขเริ่มต้น (ค่าเริ่ม `660301.26.6.2/`) + วันที่ (`DateInput` ค่าเริ่มวันนี้) · เลขแถว = แก้รายแถว ?? `numberSequence(start, n)[i]` · เปลี่ยนเลขเริ่มต้น = ล้างเลขที่แก้รายแถว · เลขเริ่มต้นไม่ลงท้ายตัวเลข = บอกให้กรอกรายฉบับ · แถวที่ซ้ำ (`duplicateNumbers`) / ว่าง / ชนจาก 409 = ขอบแดง + ปุ่มโหลดกดไม่ได้
  - รูปแบบไฟล์: Word (ค่าเริ่ม) / PDF พร้อมบอกว่าแต่ละแบบได้กี่ไฟล์ต่อฉบับ
  - กดโหลด: ขอความอนุเคราะห์ > 15 ฉบับ → `askConfirm` บอกจำนวนฉบับ + ขนาดประมาณ (~8 MB/ฉบับ) → `loadLetterAssets()` (ต้องใช้ครุฑแต่ไม่มี = หยุด) → `PUT /api/admin/t000/letter-pending-bulk` (409 → ระบายแดงแถวตาม `conflicts[].docNumber` + แสดงข้อความ แล้วหยุด) → สร้างทีละฉบับ `buildLetterFiles` ใส่ `createZip().add` ทันที (ไม่เก็บ Blob ทั้งชุด) แสดง "กำลังสร้าง x / n" → ใส่ `_รายการเลขหนังสือ.xlsx` → ดาวน์โหลด `ร่าง<ประเภท>-<YYYY-MM-DD>.zip` → สรุป: จำนวนฉบับ + รายชื่อไฟล์แนบที่หาย (ถ้ามี)
  - ล้มระหว่างสร้าง = ข้อความ "จองเลขและติดป้ายรอลงนามแล้ว แต่สร้างไฟล์ไม่สำเร็จ — กดโหลดอีกครั้งได้ (ใช้เลขเดิม)" · ไม่รีเฟรชรายชื่อจนปิดหน้าต่าง
  - คำอธิบาย (`<details>` "วิธีใช้" เปิดไว้ครั้งแรก) 4 ข้อตาม spec หัวข้อ "หน้าต่างออกร่างหลายคน" — รวมประโยค **"กดโหลด = จองเลขและติดป้าย "รอลงนาม" ให้ทุกฉบับทันที"** และ **"สแกนทั้งชุดฉบับละไฟล์ ตั้งชื่อขึ้นต้นด้วยเลขหนังสือ (ชื่อไฟล์ใน zip ใช้ได้เลย)"**

- [ ] **Step 2: ต่อปุ่มใน A_DocT000** — ข้างปุ่ม "ออกหนังสือรวมหลายคน" · ส่ง `students` ทั้งหมดที่โหลดอยู่ (รวมแถว `outsidePeriod`)

- [ ] **Step 3: ตรวจ** — `npx tsc --noEmit` 0 · เบราว์เซอร์ (เจ้าหน้าที่): ขอความอนุเคราะห์ 3 ฉบับ (หนึ่งฉบับ 2 คนบริษัทเดียวกัน) Word → zip มี 6 ไฟล์ + xlsx ชื่อตามรูปแบบ · ป้ายรอลงนามขึ้นทุกคนด้วยเลขต่อกัน · ใส่เลขที่ชนกับหนังสือที่ออกแล้ว → 409 แถวแดง ไม่มีใครติดป้ายเพิ่ม · ส่งตัว PDF 1 ฉบับ → 1 ไฟล์

- [ ] **Step 4: CHANGELOG + commit** — `feat: หน้า T000 ออกร่างหนังสือหลายคน (zip Word/PDF + รายการเลขหนังสือ Excel)`

---

### Task 5: หน้าต่างอัปโหลดฉบับลงนามหลายฉบับ

**Files:**
- Create: `Frontend/src/components/BulkSignedUploadModal.tsx`
- Modify: `Frontend/src/components/A_DocT000.tsx` (ปุ่ม "อัปโหลดฉบับลงนามหลายฉบับ" เมื่อ `isStaff`)

**Interfaces:**
- Consumes: Task 2 `groupPending`, `matchFiles`, `fileLeadingNumber`, `signedLetterRequest`, `docSuffix` · `DeliveryPicker` (`LetterModalShared.tsx`) · endpoint เดิม `/api/admin/t000/review`, `/api/admin/t000/letter-batch`
- Produces: `export default function BulkSignedUploadModal(props: { students: any[]; onClose: () => void })` — `onClose` = ปิด + `refreshStudents()`

- [ ] **Step 1: เขียนหน้าต่าง** — พฤติกรรมที่ต้องมี:
  - ประเภท · รายการ = `groupPending(students, letter)` แถวละฉบับ: เลข · วันที่ไทย · บริษัท · รายชื่อ · ไฟล์ · วิธีจัดส่ง · ผล · ฉบับไม่มีเลขร่าง = "ไม่มีเลขร่าง — อัปโหลดทีละคนที่หน้าต่างเดิม" เลือกไฟล์ไม่ได้
  - วางไฟล์ (ลากวาง + `<input type=file multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp">`) สูงสุด 100 ไฟล์ต่อครั้ง · ไฟล์ > 50 MB หรือนามสกุลอื่น = ปฏิเสธพร้อมเหตุผล (กติกาเดียวกับ `uploadMiddleware`) · วางเพิ่มได้หลายรอบ (จับคู่ใหม่ทั้งหมดด้วย `matchFiles`)
  - ไฟล์ที่ไม่ผูก: แสดงชื่อ + เหตุผล + dropdown เลือกฉบับ (เฉพาะฉบับที่ยังไม่มีไฟล์) · ฉบับที่มีไฟล์แล้วเปลี่ยน/ถอดไฟล์ได้
  - วิธีจัดส่ง: `DeliveryPicker` ด้านบนครั้งเดียว (ค่าเริ่ม STUDENT) · select รายแถวเปลี่ยนได้
  - บันทึก: `askConfirm` "บันทึก n ฉบับ? นักศึกษาจะได้รับแจ้งเตือน" → ทีละฉบับตามลำดับเลข `apiFetch(url, { method: "PUT", body })` จาก `signedLetterRequest` · ผลรายแถว ✓ / ✗ + `message` ของเซิร์ฟเวอร์ · ฉบับสำเร็จล็อกไม่ให้ส่งซ้ำ · ฉบับล้มยังแก้ไฟล์แล้วกดบันทึกใหม่ได้ · จบ = สรุป "สำเร็จ x · ไม่สำเร็จ y"
  - คำอธิบาย (`<details>`) 3 ข้อตาม spec หัวข้อ "หน้าต่างอัปโหลดฉบับลงนามหลายฉบับ" พร้อมตัวอย่าง `811-บริษัท….pdf` ✓ · `660301.26.6.2-811….pdf` ✓ · `scan001.pdf` ✗ ต้องเลือกฉบับเอง · และความหมายวิธีจัดส่งสองแบบ

- [ ] **Step 2: ต่อปุ่มใน A_DocT000** — ข้างปุ่มออกร่างหลายคน

- [ ] **Step 3: ตรวจ** — `npx tsc --noEmit` 0 · เบราว์เซอร์: ต่อจาก Task 4 วางไฟล์ชื่อเดียวกับใน zip (เปลี่ยนเป็น .pdf) + `scan001.pdf` → 3 ฉบับผูกเอง `scan001` ต้องเลือกเอง · บันทึก → สถานะเป็น `REQ_LETTER_ISSUED` ป้ายรอลงนามหาย หนังสือรวมได้ไฟล์เดียวกันทั้ง 2 คน นักศึกษามีแจ้งเตือน · บังคับให้ล้ม 1 ฉบับ (เช่น แก้ไฟล์เป็น .txt เปลี่ยนชื่อ .pdf) → ✗ พร้อมเหตุผล ฉบับอื่นสำเร็จ

- [ ] **Step 4: CHANGELOG + commit** — `feat: หน้า T000 อัปโหลดฉบับลงนามหลายฉบับ (จับคู่จากเลขหน้าชื่อไฟล์)`

---

### Task 6: ตรวจทั้งเส้นทางในเบราว์เซอร์จริง + ปิดงาน

**Files:**
- Create (scratchpad เท่านั้น ไม่ commit): สคริปต์ snapshot/restore แถว `StudentCoop` (`status`, `req*`, `place*`, `t000Comment`) + `Document` ของนักศึกษาที่ใช้ทดสอบ
- Modify: `CHANGELOG.md` (สรุปฟีเจอร์ถ้ายังขาด)

- [ ] **Step 1: snapshot ข้อมูลในเครื่อง** ของนักศึกษาที่จะใช้ (≥ 10 คน `DOCS_APPROVED` + 2 คน `ACCEPTANCE_CHECKED`) — ถ้าไม่พอ ปรับสถานะชั่วคราวใน snapshot เดียวกัน
- [ ] **Step 2: ชุดใหญ่** — ขอความอนุเคราะห์ ≥ 10 ฉบับ Word: เห็นคำเตือนเมื่อ > 15 (ลองแยกฉบับให้เกิน) · ความคืบหน้าเดิน · ลบไฟล์แนบ 1 ไฟล์ชั่วคราว (ย้ายออกจาก `backend/uploads` แล้วย้ายกลับ) → zip ยังได้ครบ + สรุปไฟล์ที่หาย · เปิด `.doc` ด้วย Word ได้ · `-เอกสารแนบ.pdf` เปิดได้ เริ่มที่รายละเอียดโครงการ จบที่แบบฟอร์มตอบรับ · `_รายการเลขหนังสือ.xlsx` เปิดได้ ชื่อไทยใน zip ไม่เพี้ยน (Windows Explorer)
- [ ] **Step 3: โหลดซ้ำทันทีด้วยเลขเดิม** (Review Focus 1) → ผ่าน ไม่ 409 · ปิดหน้าต่างแล้วออกร่างใหม่ให้คนที่รอลงนาม → ได้เลขใหม่ เลขเก่าใช้กับคนอื่นได้
- [ ] **Step 4: อัปโหลดกลับครบชุด** + หนังสือรวมที่มีเพื่อนนอกรอบ (เลือกรอบให้คนหนึ่งตกนอกรอบ) → ทุกคนในฉบับได้ไฟล์
- [ ] **Step 5: ธีมมืด + จอ 390px** ทั้งสองหน้าต่าง — ไม่มีตัวอักษรจาง/ล้นแนวนอน · console ไม่มี error สีแดง · network ไม่มี 500
- [ ] **Step 6: restore ข้อมูลจาก snapshot** แล้วตรวจว่าแถวกลับเหมือนเดิม
- [ ] **Step 7: ชุดเทสต์ทั้งหมด** — `cd backend && npm test` ผ่านหมด · `cd Frontend && npx tsc --noEmit` 0 · unit หน้าเว็บ (4 spec รวม `bulkLetters.spec.ts`) ผ่าน · `npm run build` สำเร็จ
- [ ] **Step 8: commit (ถ้ามีแก้จากการตรวจ)** — `fix: …` ตามที่เจอ · แจ้งผู้ใช้: commit ที่ได้ · ยังไม่ push · deploy ไม่ต้อง migrate
