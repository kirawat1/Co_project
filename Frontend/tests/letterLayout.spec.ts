import { test, expect } from "@playwright/test";
import { splitThaiName, companyPhrase, layoutRuns, justifyLine, trimBox, segmentThai } from "../src/utils/letterLayout";
import { dispatchLetterModel, placementLetterModel, supervisionLetterModel, toThaiDateWithDay, type LetterModel } from "../src/utils/docGeneratorUtils";

// ฟังก์ชันล้วน ไม่เปิดเบราว์เซอร์ — รูปแบบหนังสือตามตัวอย่างจริง 811 (ขอความอนุเคราะห์) / 893 (ส่งตัว) / 1215 (ขอนิเทศ)

test.describe("letterLayout — ชื่อ/บริษัท", () => {
  test("splitThaiName: ตัดที่ช่องว่างแรก (คำนำหน้าติดชื่อ) · ช่องว่างซ้ำยุบ · ไม่มีนามสกุล", () => {
    expect(splitThaiName("นายณรงค์ฤทธิ์ พาอามาศ")).toEqual(["นายณรงค์ฤทธิ์", "พาอามาศ"]);
    expect(splitThaiName("  นางสาวก   ข ค ")).toEqual(["นางสาวก", "ข ค"]);
    expect(splitThaiName("ก")).toEqual(["ก", ""]);
  });

  test("companyPhrase: ไม่เติม \"บริษัท\" ซ้ำ (เดิม \"ผู้จัดการบริษัท บริษัท …\")", () => {
    expect(companyPhrase("บริษัท วันจีโอเซอร์เวย์ จำกัด")).toBe("บริษัท วันจีโอเซอร์เวย์ จำกัด");
    expect(companyPhrase("เอไอเอส")).toBe("บริษัท เอไอเอส");
  });
});

test.describe("letterLayout — ตัดบรรทัดภาษาไทย + จัดชิดสองข้าง (PDF)", () => {
  const len = (t: string) => t.length; // 1 ตัวอักษร = 1 หน่วย
  const text = (line: { items: { text: string }[] }) => line.items.map((i) => i.text).join("");

  test("segmentThai: แยกตามคำ (ภาษาไทยไม่เว้นวรรค) ไม่ใช่แค่ช่องว่าง", () => {
    expect(segmentThai("ขอส่งตัวนักศึกษา").length).toBeGreaterThan(1);
    expect(segmentThai("a b")).toEqual(["a", " ", "b"]);
    // คำเฉพาะห้ามแยก (เดิมขึ้นบรรทัดใหม่ระหว่าง "สห" กับ "กิจศึกษา")
    expect(segmentThai("ปฏิบัติงานสหกิจศึกษาดังกล่าว")).toContain("สหกิจศึกษา");
    expect(segmentThai("หลักสูตรภูมิสารสนเทศศาสตร์")).toContain("ภูมิสารสนเทศศาสตร์");
    expect(segmentThai("ปฏิบัติงานสหกิจศึกษาดังกล่าว").join("")).toBe("ปฏิบัติงานสหกิจศึกษาดังกล่าว");
  });

  test("ตัดตามคำ · บรรทัดแรกเยื้อง · ไม่มีช่องว่างหัว/ท้ายบรรทัด · ไม่ล้นความกว้าง", () => {
    const lines = layoutRuns([{ text: "นักศึกษาสหกิจศึกษา วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น" }], 20, len, 5);
    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((l, i) => {
      expect(l.width).toBeLessThanOrEqual(i === 0 ? 15 : 20);
      expect(text(l)).toBe(text(l).trim());
    });
    expect(lines.map(text).join("").replace(/\s/g, "")).toBe("นักศึกษาสหกิจศึกษาวิทยาลัยการคอมพิวเตอร์มหาวิทยาลัยขอนแก่น");
  });

  test("ไม่ตัดบรรทัดตรงวงเล็บ (เดิม \"จำกัด (\" / \"มหาชน)\")", () => {
    const lines = layoutRuns([{ text: "บริษัท ก จำกัด (มหาชน) นั้น" }], 16, len);
    for (const l of lines) expect(text(l)).not.toMatch(/\($|^\)/);
    expect(lines.some((l) => text(l).includes("(มหาชน)"))).toBe(true);
  });

  test("ตัวหนา/ขีดเส้นใต้ติดไปกับคำ · คำยาวเกินบรรทัดถูกตัดระดับตัวอักษร", () => {
    const lines = layoutRuns([{ text: "ก " }, { text: "วันที่ 1", bold: true, underline: true }], 100, len);
    expect(lines[0].items.filter((i) => i.bold).map((i) => i.text).join("")).toBe("วันที่ 1");
    expect(lines[0].items.every((i) => !i.bold || i.underline)).toBe(true);
    const long = layoutRuns([{ text: "https://meet.google.com/abc-defg-hij" }], 10, len);
    expect(long.every((l) => l.width <= 10)).toBe(true);
  });

  test("justifyLine: กระจายช่องว่างจนเต็มบรรทัด · บรรทัดสุดท้ายชิดซ้าย · เหลือเกิน 35% ไม่ยืด", () => {
    const line = { items: [{ text: "ab", bold: false, underline: false, x: 0, w: 2 }, { text: "cd", bold: false, underline: false, x: 2, w: 2 }, { text: "ef", bold: false, underline: false, x: 4, w: 2 }], width: 6, avail: 8 };
    const j = justifyLine(line, false);
    expect(j.map((i) => i.x)).toEqual([0, 3, 6]);
    expect(j[2].x + j[2].w).toBe(8);
    expect(justifyLine(line, true)).toBe(line.items);
    expect(justifyLine({ ...line, avail: 20 }, false)).toBe(line.items);
  });

  test("justifyLine: ช่องไฟส่วนใหญ่ลงที่ช่องว่างระหว่างวลี ไม่ใช่รอยต่อคำไทยที่ติดกัน", () => {
    const it = (text: string, x: number) => ({ text, bold: false, underline: false, x, w: text.length });
    // "ตรวจ" "สอบ" " " "รายงาน" — เหลือ 2.6 · รอยต่อ ตรวจ|สอบ ได้ 1 ส่วน · สองข้างของช่องว่างได้ 6+6 ส่วน (13 ส่วน)
    const line = { items: [it("ตรวจ", 0), it("สอบ", 4), it(" ", 7), it("รายงาน", 8)], width: 14, avail: 16.6 };
    const j = justifyLine(line, false);
    expect(j[1].x - 4).toBeCloseTo(0.2, 5);            // ตรวจ|สอบ ห่างขึ้นนิดเดียว
    expect(j[3].x + j[3].w).toBeCloseTo(16.6, 5);      // เต็มบรรทัด
    expect(j[3].x - j[1].x - 4).toBeCloseTo(2.4, 5);   // ช่องว่างได้ส่วนใหญ่
  });
});

test.describe("letterLayout — ตัดขอบว่างรอบตรา", () => {
  test("trimBox: กรอบของพิกเซลที่มองเห็น (ข้ามโปร่งใสและขาว) · ว่างทั้งรูป → ทั้งรูป", () => {
    const w = 6, h = 5, px = new Uint8ClampedArray(w * h * 4); // โปร่งใสทั้งหมด
    const set = (x: number, y: number, rgba: number[]) => px.set(rgba, (y * w + x) * 4);
    set(1, 1, [255, 255, 255, 255]); // ขาวทึบ → นับเป็นพื้นหลัง
    set(2, 1, [10, 20, 30, 255]);
    set(4, 3, [200, 0, 0, 255]);
    expect(trimBox(px, w, h)).toEqual({ x: 2, y: 1, w: 3, h: 3 });
    expect(trimBox(new Uint8ClampedArray(w * h * 4), w, h)).toEqual({ x: 0, y: 0, w, h });
  });
});

// ── เนื้อหาหนังสือ (ใช้ร่วม Word/PDF) เทียบตัวอย่าง ──
const plain = (m: LetterModel) => m.blocks.map((b) => (b.kind === "para" ? b.runs.map((r) => r.text).join("") : b.kind === "label" ? `${b.label} ${b.text}` : "")).join("\n");
const runsOf = (m: LetterModel) => m.blocks.flatMap((b) => (b.kind === "para" ? b.runs : []));
const base = { docNumber: "660301.26.6.2/811", docDate: "2025-05-30", deanName: "รองศาสตราจารย์สิรภัทร เชี่ยวชาญวัฒนา", deanPosition: "คณบดีวิทยาลัยการคอมพิวเตอร์" };
const group = [
  { name: "นายอภิภัทร ภูด่านวัว", studentId: "653380349-0", startDate: "2025-07-01", endDate: "2025-10-31" },
  { name: "นายอัสนี อินทรประสิทธิ์", studentId: "653380354-7", startDate: "2025-07-01", endDate: "2025-10-31" },
];

test.describe("เนื้อหาหนังสือขอความอนุเคราะห์ (811)", () => {
  const m = dispatchLetterModel({ ...base, studentName: "นายณรงค์ฤทธิ์ พาอามาศ", studentId: "653380265-6", major: "CS", majorNameTh: "วิทยาการคอมพิวเตอร์",
    companyName: "บริษัท แอดวานซ์ อินโฟร์ เซอร์วิส จำกัด (มหาชน)", companyContact: "คุณบูรนันท์ สุวรรณปรีชา Human Resources Specialist", startDate: "2025-07-01", endDate: "2025-10-31" });

  test("เรียน = ผู้ติดต่อ ไม่ต่อชื่อบริษัท · ประวัตินักศึกษา 1 ชุดต่อคน (เดิม Word ขึ้น 2 ชุด)", () => {
    expect(m.blocks).toContainEqual({ kind: "label", label: "เรียน", text: "คุณบูรนันท์ สุวรรณปรีชา Human Resources Specialist" });
    const att = m.blocks.find((b) => b.kind === "attachments");
    expect(att && att.kind === "attachments" && att.items.map((i) => i.count)).toEqual([1, 1, 1]);
  });

  test("ช่วงฝึกตัวหนา · ที่อยู่ตอบกลับตัวหนาขีดเส้นใต้ · รายชื่อ 1 แถว ไม่มีภาคปกติ", () => {
    expect(runsOf(m)).toContainEqual({ text: " ระหว่างวันที่ 1 กรกฎาคม 2568 ถึงวันที่ 31 ตุลาคม 2568", bold: true });
    expect(runsOf(m)).toContainEqual({ text: "วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น 40002 หรือ E-mail: wijika@kku.ac.th", bold: true, underline: true });
    expect(m.blocks).toContainEqual({ kind: "students", rows: [{ no: 1, name: "นายณรงค์ฤทธิ์ พาอามาศ", studentId: "653380265-6" }] });
    expect(plain(m)).toContain("กับทางบริษัท แอดวานซ์ อินโฟร์ เซอร์วิส จำกัด (มหาชน) จำนวน 1 คน ดังมีรายชื่อต่อไปนี้");
    expect(plain(m)).toContain("โครงการสหกิจศึกษากับมหาวิทยาลัยขอนแก่น");
  });

  test("หนังสือรวม: ประวัตินักศึกษาเท่าจำนวนคน", () => {
    const g = dispatchLetterModel({ ...base, studentName: "", studentId: "", companyName: "บริษัท ก จำกัด", startDate: "", endDate: "", students: group });
    const att = g.blocks.find((b) => b.kind === "attachments");
    expect(att && att.kind === "attachments" && att.items[1].count).toBe(2);
  });
});

test.describe("เนื้อหาหนังสือส่งตัว (893)", () => {
  const m = placementLetterModel({ ...base, studentName: "นายจักรภัทร คำแก้ว", studentId: "653380049-2", major: "ภูมิสารสนเทศศาสตร์",
    companyName: "บริษัท วันจีโอเซอร์เวย์ จำกัด", startDate: "2025-06-23", endDate: "2025-10-17" });

  test("ผู้รับ/เนื้อหาไม่มี \"บริษัท บริษัท\" · ปฏิบัติงานทางด้านหลักสูตร · ช่วงฝึกขีดเส้นใต้", () => {
    expect(m.blocks).toContainEqual({ kind: "label", label: "เรียน", text: "ผู้จัดการบริษัท วันจีโอเซอร์เวย์ จำกัด" });
    expect(plain(m)).not.toContain("บริษัท บริษัท");
    expect(plain(m)).toContain("ที่ทางบริษัท วันจีโอเซอร์เวย์ จำกัด ยินดีรับนักศึกษาหลักสูตรภูมิสารสนเทศศาสตร์ วิทยาลัยการคอมพิวเตอร์ เข้ารับการปฏิบัติงานทางด้านภูมิสารสนเทศศาสตร์ จำนวน 1 คน คือ นายจักรภัทร คำแก้ว");
    expect(runsOf(m)).toContainEqual({ text: "วันที่ 23 มิถุนายน 2568 ถึงวันที่ 17 ตุลาคม 2568", underline: true });
    expect(plain(m).trim().endsWith("จึงเรียนมาเพื่อโปรดทราบ")).toBe(true);
  });
});

test.describe("เนื้อหาหนังสือขอนิเทศ (1215)", () => {
  const opts = { ...base, studentName: "นายอภิภัทร ภูด่านวัว", studentId: "653380349-0", major: "CS", majorNameTh: "วิทยาการคอมพิวเตอร์",
    companyName: "บริษัท เด็กซ์ซอน เทคโนโลยี จำกัด (มหาชน)", companyRecipient: "คุณคณิน ก้องเสนาะ Talent Acquisition Supervisor",
    supervisorNames: ["ผศ.ดร.พุธษดี ศิริแสงตระกูล", "ผศ.ดร.ชิตสุธา สุ่มเล็ก"], visitDate: "2025-09-02T13:30:00+07:00", visitTime: "13.30 น." };

  test("หนังสือรวม: ดังมีรายชื่อ → รายชื่อ → ต่อประโยคไม่ย่อหน้า · วันนิเทศมีวันในสัปดาห์ ตัวหนา", () => {
    const m = supervisionLetterModel({ ...opts, online: true, students: group });
    const i = m.blocks.findIndex((b) => b.kind === "students");
    const before = m.blocks[i - 1], after = m.blocks[i + 1];
    expect(before.kind === "para" && before.runs[0].text).toBe("ตามที่ท่านให้ความอนุเคราะห์รับนักศึกษาสาขาวิชาวิทยาการคอมพิวเตอร์ จำนวน 2 คน ดังมีรายชื่อต่อไปนี้");
    expect(after.kind === "para" && after.indent).toBe(0);
    expect(runsOf(m)).toContainEqual({ text: "ในวันอังคารที่ 2 กันยายน 2568 เวลา 13.30 น.", bold: true });
    expect(plain(m)).toContain("โดยมีอาจารย์ผู้นิเทศงานคือ ผศ.ดร.พุธษดี ศิริแสงตระกูล และ ผศ.ดร.ชิตสุธา สุ่มเล็ก");
    expect(m.contact[0]).toBe("สาขาวิชาวิทยาการคอมพิวเตอร์");
  });

  test("รูปแบบนิเทศ: ออนไลน์ \"ในรูปแบบออนไลน์\" (เดิม \"ในรูปแบบรูปแบบออนไลน์\") · ไปที่บริษัท \" ณ สถานประกอบการ\"", () => {
    const online = plain(supervisionLetterModel({ ...opts, online: true, onlineLink: "https://meet.example/x" }));
    expect(online).toContain("ของนักศึกษาในรูปแบบออนไลน์ โดยนิเทศงาน");
    expect(online).toContain("(ลิงก์เข้าร่วม: https://meet.example/x)");
    expect(online).not.toContain("รูปแบบรูปแบบ");
    const onsite = plain(supervisionLetterModel(opts));
    expect(onsite).toContain("ของนักศึกษา ณ สถานประกอบการ โดยนิเทศงาน");
    expect(onsite).not.toContain("ลิงก์เข้าร่วม");
  });

  test("toThaiDateWithDay: วันในสัปดาห์ + พ.ศ. · ไม่มีวันที่ → จุดไข่ปลา", () => {
    expect(toThaiDateWithDay("2025-09-02T13:30:00+07:00")).toBe("วันอังคารที่ 2 กันยายน 2568");
    expect(toThaiDateWithDay(undefined)).toContain("....");
  });
});
