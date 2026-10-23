import { test, expect } from "@playwright/test";
import { toLetterStudent, isGroup, sameDates, studentLines, studentListHtml, letterAttachmentDocs } from "../src/utils/letterGroup";
import { daysLeft } from "../src/utils/deadline";
import { createWordBlob, createPreviewBlob, emblemSizePt, buildDispatchLetterHtml, buildPlacementLetterHtml, buildSupervisionLetterHtml } from "../src/utils/docGeneratorUtils";

// ฟังก์ชันล้วน ไม่เปิดเบราว์เซอร์ — หนังสือรวม / ไฟล์แนบหนังสือ / กำหนดส่ง T005–T008

test.describe("หนังสือรวม — รายชื่อในหนังสือ", () => {
  const api = (n: number, over: any = {}) => ({
    prefix: "MR", firstName: `ชื่อ${n}`, lastName: `สกุล${n}`, studentId: `65000000${n}`, studyProgram: "normal",
    coop: { actualStartDate: "2026-06-01", actualEndDate: "2026-09-30" }, ...over,
  });

  test("toLetterStudent: คำนำหน้าไทย · วันฝึกจริงมาก่อน · ไม่มีใช้วันในใบสมัคร", () => {
    expect(toLetterStudent(api(1))).toMatchObject({ name: "นายชื่อ1 สกุล1", studentId: "650000001", startDate: "2026-06-01", endDate: "2026-09-30" });
    const fromForm = toLetterStudent(api(2, { prefix: "MS", coop: {}, coopApplicationForm: { startDate: "2026-07-01", endDate: "2026-10-31" } }));
    expect(fromForm).toMatchObject({ name: "นางสาวชื่อ2 สกุล2", startDate: "2026-07-01", endDate: "2026-10-31" });
    expect(toLetterStudent({ firstName: "ก", lastName: "ข" })).toMatchObject({ startDate: null, endDate: null, studentId: "" });
  });

  test("isGroup: 2 คนขึ้นไปเท่านั้นที่เป็นหนังสือรวม", () => {
    expect(isGroup(null)).toBe(false);
    expect(isGroup([toLetterStudent(api(1))])).toBe(false);
    expect(isGroup([toLetterStudent(api(1)), toLetterStudent(api(2))])).toBe(true);
  });

  test("sameDates: วันฝึกตรงกันทุกคน → ประโยคช่วงเวลาเดียว · ต่างกัน → วันท้ายชื่อแต่ละคน", () => {
    const a = toLetterStudent(api(1)), b = toLetterStudent(api(2));
    expect(sameDates([a, b])).toBe(true);
    const c = toLetterStudent(api(3, { coop: { actualStartDate: "2026-06-15", actualEndDate: "2026-09-30" } }));
    expect(sameDates([a, c])).toBe(false);
    // ต่างแค่รูปแบบ (Date vs string) แต่วันเดียวกัน → ถือว่าตรงกัน
    expect(sameDates([a, { ...a, startDate: new Date("2026-06-01T00:00:00Z") }])).toBe(true);
  });

  test("studentLines: ลำดับ · รหัส · ภาคปกติ/พิเศษ · วันฝึก (พ.ศ.)", () => {
    const list = [toLetterStudent(api(1)), toLetterStudent(api(2, { studyProgram: "special" }))];
    expect(studentLines(list)).toEqual(["1. นายชื่อ1 สกุล1   รหัสประจำตัว 650000001", "2. นายชื่อ2 สกุล2   รหัสประจำตัว 650000002"]);
    const full = studentLines(list, { withDates: true, withProgram: true });
    expect(full[0]).toBe("1. นายชื่อ1 สกุล1   รหัสประจำตัว 650000001   ภาคปกติ   (1 มิถุนายน 2569 – 30 กันยายน 2569)");
    expect(full[1]).toContain("ภาคพิเศษ");
    // ไม่มีวันฝึก → จุดไข่ปลาให้เติมมือ (ไม่ใช่ "Invalid Date")
    expect(studentLines([toLetterStudent({ firstName: "ก" })], { withDates: true })[0]).toContain("....................");
  });

  test("studentListHtml: บรรทัดละย่อหน้า เว้นวรรคแบบ &nbsp; (Word ไม่ยุบช่องว่าง)", () => {
    const html = studentListHtml([toLetterStudent(api(1)), toLetterStudent(api(2))]);
    expect(html.split("\n")).toHaveLength(2);
    expect(html).toContain('<p style="margin-left:36pt">1. นายชื่อ1 สกุล1&nbsp;&nbsp;&nbsp;รหัสประจำตัว 650000001</p>');
  });
});

test.describe("ไฟล์แนบท้ายหนังสือขอความอนุเคราะห์", () => {
  test("แนบเฉพาะเอกสาร T000 · ไม่แนบหนังสือที่ออกแล้ว/ใบตอบรับ/T002/T003 · ข้ามไฟล์ที่ไม่มี path", () => {
    const docs = [
      { type: "CP-TRANSCRIPT", path: "t.pdf" }, { type: "CP-CV", path: "cv.pdf" }, { type: "CP-STUDENT_CARD", path: null },
      { type: "DISPATCH_LETTER", path: "old-signed.pdf" }, { type: "PLACEMENT_LETTER", path: "p.pdf" },
      { type: "CP-ACCEPTANCE", path: "a.pdf" }, { type: "ACCEPTANCE_FORM", path: "a2.pdf" },
      { type: "T002_FORM", path: "t2.pdf" }, { type: "T003_FORM", path: "t3.pdf" },
    ];
    expect(letterAttachmentDocs([{ documents: docs }]).map((d) => d.path)).toEqual(["t.pdf", "cv.pdf"]);
  });

  test("หนังสือรวม: เอกสารของทุกคนเรียงตามรายชื่อ · คนที่ไม่มีเอกสารไม่ทำให้พัง", () => {
    const got = letterAttachmentDocs([
      { documents: [{ type: "CP-TRANSCRIPT", path: "a.pdf" }] },
      { documents: null },
      { documents: [{ type: "CP-TRANSCRIPT", path: "b.pdf" }, { type: "DISPATCH_LETTER", path: "x.pdf" }] },
    ]);
    expect(got.map((d) => d.path)).toEqual(["a.pdf", "b.pdf"]);
  });
});

test.describe("กำหนดส่ง T005–T008 (daysLeft) — นับตามวันในเวลาไทย", () => {
  // เวลาไทย = UTC+7
  const at = (iso: string) => new Date(iso);

  test("วันกำหนดส่ง = วันนี้ → 0 ทั้งตอนเช้ามืดและก่อนเที่ยงคืนเวลาไทย", () => {
    expect(daysLeft("2026-11-30", at("2026-11-29T17:30:00Z"))).toBe(0); // 00:30 วันที่ 30 เวลาไทย (UTC ยังเป็น 29)
    expect(daysLeft("2026-11-30", at("2026-11-30T16:59:00Z"))).toBe(0); // 23:59 วันที่ 30 เวลาไทย
  });

  test("เหลือ/เลยกำหนด นับเป็นวันปฏิทินไทย", () => {
    expect(daysLeft("2026-11-30", at("2026-11-27T03:00:00Z"))).toBe(3);
    expect(daysLeft("2026-11-30", at("2026-11-30T17:00:00Z"))).toBe(-1); // 00:00 วันที่ 1 ธ.ค. เวลาไทย
    expect(daysLeft("2026-11-30", at("2026-12-10T05:00:00Z"))).toBe(-10);
  });

  test("ข้ามเดือน/ปี", () => {
    expect(daysLeft("2027-01-02", at("2026-12-31T05:00:00Z"))).toBe(2);
  });
});

// Word อ่านขอบกระดาษจาก section ที่ตั้งชื่อเท่านั้น (@page เปล่าถูกข้าม → ขอบ 1 นิ้ว) และแปลง margin ของตารางเป็นช่องไฟทุกย่อหน้าในเซลล์
// ผลวัดด้วย Word จริง: หนังสือขอความอนุเคราะห์คนเดียวล้นไปหน้า 2 แม้ชื่อบริษัทสั้น — เทสต์นี้ล็อกโครงสร้างที่ทำให้จบหน้าเดียว
test.describe("Word — หน้ากระดาษและส่วนท้ายหนังสือ", () => {
  const common = { docNumber: "660301.26.6.2/811", docDate: "2026-10-23", studentName: "นายก ข", studentId: "650000001",
    companyName: "บริษัท ทดสอบ จำกัด", deanName: "ชื่อ คณบดี", deanPosition: "คณบดีวิทยาลัยการคอมพิวเตอร์" };
  const letters = {
    request: buildDispatchLetterHtml({ ...common, startDate: "2026-06-01", endDate: "2026-09-30" }),
    placement: buildPlacementLetterHtml({ ...common, major: "วิทยาการคอมพิวเตอร์", startDate: "2026-06-01", endDate: "2026-09-30" }),
    supervision: buildSupervisionLetterHtml({ ...common, supervisorNames: ["อ.ก"], visitDate: "2026-07-01" }),
  };
  const sigOf = (html: string) => html.slice(html.indexOf('<div class="sig-block">'), html.indexOf("</div>", html.indexOf('<div class="sig-block">')));

  test("createWordBlob: ขอบกระดาษอยู่ใน section ที่ Word อ่าน + ย่อหน้าท้ายเล็ก", async () => {
    const text = await createWordBlob("<p>เนื้อหา</p>").text();
    expect(text).toContain("@page WordSection1 { size: 21cm 29.7cm; margin: 2.5cm 2cm 2cm 3cm;");
    expect(text).toContain("div.WordSection1 { page: WordSection1; }");
    expect(text).not.toMatch(/@page\s*\{/);
    expect(text).toMatch(/<div class="WordSection1"><p>เนื้อหา<\/p>\s*<p style="font-size:1pt;line-height:1pt;margin:0">&nbsp;<\/p><\/div>/);
  });

  for (const [name, html] of Object.entries(letters)) {
    test(`${name}: บรรทัดคั่นตอนเป็นครึ่งบรรทัด · ช่องลงนาม 3 บรรทัดเต็ม · ส่วนลงนาม+ส่วนติดต่อไม่แยกหน้า`, () => {
      const beforeSig = html.slice(0, html.indexOf('<div class="sig-block">'));
      expect(beforeSig).not.toContain("<p>&nbsp;</p>");
      expect(beforeSig).toContain('<p class="gap">&nbsp;</p>');
      const sig = sigOf(html);
      expect(sig.match(/<p style="page-break-after:avoid">&nbsp;<\/p>/g)).toHaveLength(3);
      expect(sig).not.toMatch(/<p>/);
      expect(html).toMatch(/<table class="footer-table">\s*<tr style="page-break-inside:avoid">/);
    });
  }

  test("ตารางสิ่งที่ส่งมาด้วย: ไม่มี margin ที่ Word แปลงเป็นช่องไฟ · คอลัมน์กลางกว้างพอให้ข้อ 3 ไม่ตัดบรรทัด", () => {
    expect(letters.request).not.toContain("margin:4pt 0");
    expect(letters.request).toContain('<td style="width:95pt"><b>สิ่งที่ส่งมาด้วย</b></td>');
    expect(letters.request).toContain('<td style="width:80pt;text-align:right">จำนวน');
  });

  test("ส่วนติดต่อของหนังสือขอนิเทศยังมีบรรทัดสาขาวิชา", () => {
    expect(letters.supervision).toMatch(/<table class="footer-table">[\s\S]*<p>สาขาวิชา[^<]*<\/p>\s*<p>วิทยาลัยการคอมพิวเตอร์<\/p>/);
    expect(letters.request).not.toMatch(/<table class="footer-table">[\s\S]*สาขาวิชา/);
  });
});

// ตราสัญลักษณ์มหาวิทยาลัยในหนังสือ Word — เดิมมีเฉพาะ PDF · Word ฝังรูปในไฟล์แบบ MHTML (ไม่ต้องต่อเน็ต/login ตอนเปิด)
// วัดด้วย Word จริง: ตรา 30×28 มม. + ขอบบน 0.8 ล่าง 1.5 ซม. หนังสือคนเดียวทั้ง 3 แบบยังจบหน้าเดียว (รวมชื่อบริษัทยาว + ผู้รับยาว)
test.describe("Word — ตราสัญลักษณ์มหาวิทยาลัย", () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4, 250, 251, 252]);
  const emblem = { data: png, mime: "image/png", ...emblemSizePt(3185, 2963) };
  const parts = (mhtml: string) => {
    const boundary = mhtml.match(/boundary="([^"]+)"/)![1];
    return mhtml.split(`--${boundary}`).slice(1, -1).map((p) => {
      const [head, body] = p.split(/\r\n\r\n/);
      return { head, data: Buffer.from(body.replace(/\s+/g, ""), "base64") };
    });
  };

  test("emblemSizePt: พอดีกรอบ 30×28 มม. (เท่า PDF) คงสัดส่วนรูป", () => {
    const wide = emblemSizePt(3185, 2963);
    expect(wide.widthPt).toBeCloseTo(85.04, 1);
    expect(wide.heightPt).toBeCloseTo(79.12, 1);
    const tall = emblemSizePt(1000, 2000);
    expect(tall.heightPt).toBeCloseTo(79.37, 1);
    expect(tall.widthPt).toBeCloseTo(39.69, 1);
  });

  test("createWordBlob + ตรา: MHTML ฝังรูป · ตราบนสุดกลางหน้า · ขอบบน 0.8 ล่าง 1.5 ซม.", async () => {
    const text = await createWordBlob("<p>เนื้อหา</p>", emblem).text();
    expect(text.startsWith("MIME-Version: 1.0")).toBe(true);
    const [html, img] = parts(text);
    expect(html.head).toContain('Content-Type: text/html; charset="utf-8"');
    const doc = html.data.toString("utf8");
    expect(doc).toContain("@page WordSection1 { size: 21cm 29.7cm; margin: 0.8cm 2cm 1.5cm 3cm;");
    expect(doc).toMatch(/<div class="WordSection1"><p class="center emblem"[^>]*><img src="emblem\.png" width="113" height="105" style="width:85\.0pt;height:79\.1pt"[^>]*><\/p><p>เนื้อหา<\/p>/);
    expect(img.head).toContain("Content-Type: image/png");
    expect(img.head).toContain("Content-Location: file:///C:/emblem.png");
    expect([...img.data]).toEqual([...png]);
  });

  test("createWordBlob ไม่มีตรา: HTML แบบเดิม ขอบบน 2.5 ซม.", async () => {
    const text = await createWordBlob("<p>เนื้อหา</p>", null).text();
    expect(text).not.toContain("MIME-Version");
    expect(text).toContain("margin: 2.5cm 2cm 2cm 3cm;");
    expect(text).not.toContain("<img");
  });

  test("createPreviewBlob + ตรา: ตัวอย่างในหน้าต่างมีตราด้วย (data URI)", async () => {
    const text = await createPreviewBlob("<p>เนื้อหา</p>", emblem).text();
    expect(text).toContain(`<img src="data:image/png;base64,${Buffer.from(png).toString("base64")}"`);
    expect(await createPreviewBlob("<p>เนื้อหา</p>").text()).not.toContain("<img");
  });
});
