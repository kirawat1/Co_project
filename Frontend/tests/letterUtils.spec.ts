import { test, expect } from "@playwright/test";
import { toLetterStudent, isGroup, sameDates, studentRows, letterAttachmentDocs } from "../src/utils/letterGroup";
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

  test("studentRows: ลำดับ · ชื่อ · รหัส · วันฝึก (พ.ศ.) เฉพาะเมื่อขอ — ไม่มีภาคปกติ/พิเศษ (หนังสือจริงไม่มี)", () => {
    const list = [toLetterStudent(api(1)), toLetterStudent(api(2, { studyProgram: "special" }))];
    expect(studentRows(list)).toEqual([
      { no: 1, name: "นายชื่อ1 สกุล1", studentId: "650000001" },
      { no: 2, name: "นายชื่อ2 สกุล2", studentId: "650000002" },
    ]);
    expect(studentRows(list, { withDates: true })[0].dates).toBe("1 มิถุนายน 2569 – 30 กันยายน 2569");
    // ไม่มีวันฝึก → จุดไข่ปลาให้เติมมือ (ไม่ใช่ "Invalid Date")
    expect(studentRows([toLetterStudent({ firstName: "ก" })], { withDates: true })[0].dates).toContain("....................");
  });

  test("ตารางรายชื่อใน Word: คอลัมน์ ชื่อ | นามสกุล | รหัสประจำตัว | รหัส · วันฝึกแถวถัดไปและไม่แยกหน้ากับชื่อ", () => {
    const html = buildDispatchLetterHtml({ docNumber: "1/1", docDate: "2026-10-23", studentName: "", studentId: "", companyName: "บริษัท ก จำกัด",
      startDate: "", endDate: "", deanName: "ก", deanPosition: "ข",
      students: [toLetterStudent(api(1)), toLetterStudent(api(2, { coop: { actualStartDate: "2026-06-15", actualEndDate: "2026-09-30" } }))] });
    expect(html).toMatch(/<td style="width:40\.5mm"><p style="page-break-after:avoid">1\. นายชื่อ1<\/p><\/td><td style="width:25\.5mm"><p style="page-break-after:avoid">สกุล1<\/p><\/td>/);
    expect(html).toContain('<td colspan="3">(15 มิถุนายน 2569 – 30 กันยายน 2569)</td>');
    expect(html).not.toContain("ภาคปกติ");
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

  test("createWordBlob: ขอบกระดาษตามหนังสือจริงอยู่ใน section ที่ Word อ่าน + ย่อหน้าท้ายเล็ก", async () => {
    const text = await createWordBlob("<p>เนื้อหา</p>").text();
    expect(text).toContain("@page WordSection1 { size: 21cm 29.7cm; margin: 1.7cm 2cm 1cm 2.6cm;");
    expect(text).toContain("div.WordSection1 { page: WordSection1; }");
    expect(text).not.toMatch(/@page\s*\{/);
    expect(text).toMatch(/<div class="WordSection1"><p>เนื้อหา<\/p>\s*<p style="font-size:1pt;line-height:1pt;margin:0">&nbsp;<\/p><\/div>/);
  });

  for (const [name, html] of Object.entries(letters)) {
    test(`${name}: บรรทัดคั่นตอนครึ่งบรรทัด · ช่องลงนาม 2 บรรทัดเต็ม + ครึ่งบรรทัด · ส่วนติดต่อเป็นตารางลอยยึดท้ายกระดาษ`, () => {
      // เนื้อหาหลังวันที่ (หัวหนังสือมีบรรทัดว่างเต็มในช่อง "ที่ อว" โดยตั้งใจ — ให้ตรงบรรทัดแรกของที่อยู่)
      const beforeSig = html.slice(html.indexOf("margin-left:82mm"), html.indexOf('<div class="sig-block">'));
      expect(beforeSig).not.toContain("<p>&nbsp;</p>");
      expect(beforeSig).toContain('<p class="gap">&nbsp;</p>');
      const sig = sigOf(html);
      expect(sig.match(/<p style="page-break-after:avoid">&nbsp;<\/p>/g)).toHaveLength(2);
      expect(sig).toContain('<p class="gap" style="page-break-after:avoid">&nbsp;</p>');
      expect(sig).not.toMatch(/<p>/);
      expect(html).toMatch(/<table class="footer-table" style="[^"]*mso-table-anchor-vertical:page;[^"]*mso-table-top:\d+(\.\d)?mm;[^"]*">\s*<tr style="page-break-inside:avoid">/);
    });

    test(`${name}: หัวหนังสือ — "ที่ อว" กับที่อยู่ในแถวเดียวกับช่องตรา · วันที่เริ่มกลางคอลัมน์`, () => {
      expect(html).toMatch(/<tr>\s*<td style="width:60mm;vertical-align:bottom"><p>ที่ อว 660301\.26\.6\.2\/811<\/p><p>&nbsp;<\/p><\/td>\s*<td style="width:44mm;text-align:center"><!--LETTER-EMBLEM--><\/td>[\s\S]*<p>มหาวิทยาลัยขอนแก่น<\/p><p>123 ถนนมิตรภาพ<\/p><\/td>/);
      expect(html).toContain('<p style="margin-left:114mm">อำเภอเมืองขอนแก่น</p>');
      expect(html).toContain('<p style="margin-left:82mm">23 ตุลาคม 2569</p>');
    });
  }

  test("ตารางสิ่งที่ส่งมาด้วย: หัวข้อ 2.5 ซม. ไม่ตัดบรรทัด · จำนวนตรงคอลัมน์ที่อยู่ · ไม่มี margin ที่ Word แปลงเป็นช่องไฟ", () => {
    expect(letters.request).not.toContain("margin:4pt 0");
    expect(letters.request).toContain('<td style="width:25mm" nowrap><b>สิ่งที่ส่งมาด้วย</b></td>');
    expect(letters.request).toContain('<td style="width:50mm">จำนวน&nbsp;&nbsp;&nbsp;1&nbsp;&nbsp;&nbsp;ชุด</td>');
  });

  test("ส่วนติดต่อของหนังสือขอนิเทศยังมีบรรทัดสาขาวิชา · ยึดบรรทัดสุดท้ายไว้ที่เดิม (4 บรรทัดเริ่มสูงกว่า 3 บรรทัด)", () => {
    expect(letters.supervision).toMatch(/<table class="footer-table"[^>]*>[\s\S]*<p>สาขาวิชา[^<]*<\/p>\s*<p>วิทยาลัยการคอมพิวเตอร์<\/p>/);
    expect(letters.request).not.toMatch(/<table class="footer-table"[^>]*>[\s\S]*สาขาวิชา/);
    const top = (h: string) => +h.match(/mso-table-top:([\d.]+)mm/)![1];
    expect(top(letters.request) - top(letters.supervision)).toBeCloseTo(6.6, 1);
  });

  test("ข้อความจากฐานข้อมูลถูก escape (ชื่อบริษัทมี & หรือ <)", () => {
    const html = buildPlacementLetterHtml({ ...common, companyName: "บริษัท A&B <Tech> จำกัด", major: "วิทยาการคอมพิวเตอร์", startDate: "2026-06-01", endDate: "2026-09-30" });
    expect(html).toContain("บริษัท A&amp;B &lt;Tech&gt; จำกัด");
    expect(html).not.toContain("<Tech>");
  });
});

// ตราสัญลักษณ์มหาวิทยาลัยในหนังสือ Word — ฝังรูปในไฟล์แบบ MHTML (ไม่ต้องต่อเน็ต/login ตอนเปิด)
// วัดด้วย Word จริง (2026-10-29): ตราสูง 4 ซม. ในหัวหนังสือ หนังสือคนเดียวทั้ง 3 แบบยังจบหน้าเดียว (รวมชื่อบริษัทยาว + ผู้รับยาว)
test.describe("Word — ตราสัญลักษณ์มหาวิทยาลัย", () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4, 250, 251, 252]);
  const emblem = { data: png, mime: "image/png", ...emblemSizePt(480, 270) };
  const letter = buildDispatchLetterHtml({ docNumber: "1/1", docDate: "2026-10-23", studentName: "นายก ข", studentId: "1", companyName: "บริษัท ก จำกัด", startDate: "", endDate: "", deanName: "ก", deanPosition: "ข" });
  const parts = (mhtml: string) => {
    const boundary = mhtml.match(/boundary="([^"]+)"/)![1];
    return mhtml.split(`--${boundary}`).slice(1, -1).map((p) => {
      const [head, body] = p.split(/\r\n\r\n/);
      return { head, data: Buffer.from(body.replace(/\s+/g, ""), "base64") };
    });
  };

  test("emblemSizePt: สูง 4 ซม. ตามหนังสือจริง คงสัดส่วนรูป (รูปที่ตัดขอบว่างแล้ว)", () => {
    const e = emblemSizePt(480, 270);
    expect(e.heightPt).toBeCloseTo(113.39, 1);
    expect(e.widthPt).toBeCloseTo(201.58, 1);
    const tall = emblemSizePt(270, 480);
    expect(tall.heightPt).toBeCloseTo(113.39, 1);
    expect(tall.widthPt).toBeCloseTo(63.78, 1);
  });

  test("createWordBlob + ตรา: MHTML ฝังรูป · ตราอยู่ช่องกลางของหัวหนังสือ (ข้าง \"ที่ อว\" และที่อยู่)", async () => {
    const text = await createWordBlob(letter, emblem).text();
    expect(text.startsWith("MIME-Version: 1.0")).toBe(true);
    const [html, img] = parts(text);
    expect(html.head).toContain('Content-Type: text/html; charset="utf-8"');
    const doc = html.data.toString("utf8");
    expect(doc).toContain("margin: 1.7cm 2cm 1cm 2.6cm;");
    expect(doc).toMatch(/<td style="width:44mm;text-align:center"><p class="center emblem"[^>]*><img src="emblem\.png" width="269" height="151" style="width:201\.6pt;height:113\.4pt"[^>]*><\/p><p class="gap">&nbsp;<\/p><\/td>/);
    expect(doc).not.toContain("<!--LETTER-EMBLEM-->");
    expect(img.head).toContain("Content-Type: image/png");
    expect(img.head).toContain("Content-Location: file:///C:/emblem.png");
    expect([...img.data]).toEqual([...png]);
  });

  test("createWordBlob ไม่มีตรา: HTML ธรรมดา ช่องตราว่าง", async () => {
    const text = await createWordBlob(letter, null).text();
    expect(text).not.toContain("MIME-Version");
    expect(text).not.toContain("<img");
    expect(text).toContain('<td style="width:44mm;text-align:center"></td>');
  });

  test("createPreviewBlob + ตรา: ตัวอย่างในหน้าต่างมีตราด้วย (data URI)", async () => {
    const text = await createPreviewBlob(letter, emblem).text();
    expect(text).toContain(`<img src="data:image/png;base64,${Buffer.from(png).toString("base64")}"`);
    expect(await createPreviewBlob(letter).text()).not.toContain("<img");
  });
});
