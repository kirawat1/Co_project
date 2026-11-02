import { test, expect } from "@playwright/test";
import { deadlineStatus, suggestApplyTo, differsFromCollege, extensionSummary, timelineStatus } from "../src/utils/deadlines";

test.describe("timelineStatus — ไทม์ไลน์ของนักศึกษา", () => {
    const now = new Date("2026-07-01T05:00:00Z");
    test("ส่งแล้ว: ทัน/ช้า ตามที่ server ตัดสิน (submittedLate — ไม่นับเวลาที่เติมย้อนหลัง)", () => {
        expect(timelineStatus({ stepKey: "T002", due: "2026-07-03", submittedAt: "2026-07-03T16:00:00.000Z", submittedLate: false }, now)).toEqual({ text: "ส่งแล้ว", tone: "ok" });
        expect(timelineStatus({ stepKey: "T002", due: "2026-07-03", submittedAt: "2026-07-03T17:30:00.000Z", submittedLate: true }, now)).toEqual({ text: "ส่งแล้ว (ช้า)", tone: "warn" });
        // เวลาหลังกำหนด แต่ server บอกว่าไม่ช้า (เติมย้อนหลัง) → ส่งแล้ว
        expect(timelineStatus({ stepKey: "T002", due: "2026-07-03", submittedAt: "2026-07-20T00:00:00.000Z", submittedLate: false }, now)).toEqual({ text: "ส่งแล้ว", tone: "ok" });
    });
    test("ค่าเดิมที่ปิดระบบ (source LEGACY) → \"ปิดรับ\" ไม่ใช่ \"ปิดรับชั่วคราว\" ของปฏิทินของรอบ", () => {
        expect(timelineStatus({ stepKey: "T000", due: null, closed: true, source: "LEGACY", submittedAt: null }, now)).toEqual({ text: "ปิดรับ", tone: "closed" });
        expect(timelineStatus({ stepKey: "T000", due: null, closed: true, source: "ROUND", submittedAt: null }, now)).toEqual({ text: "ปิดรับชั่วคราว", tone: "closed" });
    });

    test("ยังไม่ส่ง → ป้ายกำหนดส่ง", () => {
        expect(timelineStatus({ stepKey: "T002", due: "2026-07-03", mode: "HARD", submittedAt: null }, now)).toEqual({ text: "เหลือ 2 วัน", tone: "warn" });
    });
    test("ยื่นคำร้อง: เปิด/ปิด · ช่วงนิเทศ: ไม่มีป้าย", () => {
        expect(timelineStatus({ stepKey: "APPLY", due: "2026-07-03", isOpen: true }, now)).toEqual({ text: "เปิดรับอยู่", tone: "ok" });
        expect(timelineStatus({ stepKey: "APPLY", due: "2026-04-17", isOpen: false }, now)).toEqual({ text: "ปิดแล้ว", tone: "info" });
        expect(timelineStatus({ stepKey: "SUPERVISION", due: "2026-08-08" }, now)).toBeNull();
    });
});
import { fmtDate } from "../src/utils/dateFormat";

test.describe("extensionSummary — ข้อความขยายเวลารายคน", () => {
    test("เรียงตามขั้น · ว่าง/ไม่มี → ข้อความว่าง", () => {
        expect(extensionSummary({ T002: "2026-07-10", T000: "2026-05-20" })).toBe(`T000 ถึง ${fmtDate("2026-05-20")} · T002 ถึง ${fmtDate("2026-07-10")}`);
        expect(extensionSummary({})).toBe("");
        expect(extensionSummary(null)).toBe("");
    });
});

// ฟังก์ชันล้วน ไม่เปิดเบราว์เซอร์ — ปฏิทินของรอบ (ป้ายสถานะ · หลักสูตรที่ควรติ๊ก · ช่องที่ต่างจากวิทยาลัย)
const NOW = new Date("2026-07-01T05:00:00Z"); // 12:00 เวลาไทย 1 ก.ค. 2569

test.describe("deadlineStatus", () => {
    test("เหลือ N วัน · ใกล้ปิด (≤ 3 วัน) เป็นสีเตือน · วันนี้วันสุดท้าย", () => {
        expect(deadlineStatus({ due: "2026-07-10" }, NOW)).toEqual({ text: "เหลือ 9 วัน", tone: "ok" });
        expect(deadlineStatus({ due: "2026-07-04" }, NOW)).toEqual({ text: "เหลือ 3 วัน", tone: "warn" });
        expect(deadlineStatus({ due: "2026-07-01" }, NOW)).toEqual({ text: "วันสุดท้าย", tone: "warn" });
    });

    test("ไม่มีกำหนด", () => {
        expect(deadlineStatus({ due: null }, NOW)).toEqual({ text: "ไม่มีกำหนด", tone: "info" });
    });

    test("ปิดรับชั่วคราวมาก่อนทุกอย่าง", () => {
        expect(deadlineStatus({ due: "2026-07-10", closed: true }, NOW)).toEqual({ text: "ปิดรับชั่วคราว", tone: "closed" });
    });

    test("เลยกำหนด: ปิดจริง = ปิดแล้ว · ส่งช้าได้ = ส่งช้าได้ · ปิดจริงแต่ขยายเวลา = ขยายเวลาแล้ว", () => {
        expect(deadlineStatus({ due: "2026-06-30", mode: "HARD" }, NOW)).toEqual({ text: "ปิดแล้ว", tone: "closed" });
        expect(deadlineStatus({ due: "2026-06-30" }, NOW)).toEqual({ text: "ปิดแล้ว", tone: "closed" });
        expect(deadlineStatus({ due: "2026-06-30", mode: "SOFT" }, NOW)).toEqual({ text: "เลยกำหนด · ส่งช้าได้", tone: "warn" });
        expect(deadlineStatus({ due: "2026-06-30", mode: "HARD", canSubmit: true }, NOW)).toEqual({ text: "เลยกำหนด · ขยายเวลาแล้ว", tone: "warn" });
    });
});

test.describe("suggestApplyTo — ติ๊กหลักสูตรที่ยังใช้ค่าวิทยาลัยเดิมไว้ให้ก่อน", () => {
    const oldC = { T000: { due: "2026-05-08" }, T002: { due: "2026-07-03", mode: "HARD" as const } };
    const newC = { T000: { due: "2026-05-08" }, T002: { due: "2026-07-10", mode: "HARD" as const } };
    const rows = [
        { major: "CS", deadlines: { T000: { due: "2026-05-08" }, T002: { due: "2026-07-03", mode: "HARD" as const } } },
        { major: "AI", deadlines: { T000: { due: "2026-05-01" }, T002: { due: "2026-07-05" } } },
        { major: "DS", deadlines: { T002: { due: "2026-07-03", mode: "HARD" as const }, T000: { due: "2026-04-01" } } },
    ];

    test("เทียบเฉพาะขั้นที่เปลี่ยน: CS เท่าค่าเดิม · DS ต่างแค่ขั้นที่ไม่เปลี่ยน → ติ๊ก · AI ปรับเอง → ไม่ติ๊ก", () => {
        expect(suggestApplyTo(oldC, newC, rows)).toEqual(["CS", "DS"]);
    });

    test("ไม่มีขั้นไหนเปลี่ยน → ไม่ติ๊กใคร", () => {
        expect(suggestApplyTo(oldC, oldC, rows)).toEqual([]);
    });

    test("แถวที่ยังไม่มีค่า + ค่าวิทยาลัยเดิมว่าง → ติ๊ก (ยังไม่ได้ปรับเอง)", () => {
        expect(suggestApplyTo({}, { T003: { due: "2026-07-17" } }, [{ major: "CS", deadlines: {} }])).toEqual(["CS"]);
    });
});

test.describe("differsFromCollege", () => {
    test("ไม่สนลำดับช่อง/ค่าว่าง · mode ไม่ระบุ = ไม่ระบุ", () => {
        expect(differsFromCollege({ due: "2026-07-03", mode: "HARD" }, { mode: "HARD", due: "2026-07-03" })).toBe(false);
        expect(differsFromCollege({ due: "2026-07-03", closed: false }, { due: "2026-07-03" })).toBe(false);
        expect(differsFromCollege({ due: "2026-07-04" }, { due: "2026-07-03" })).toBe(true);
        expect(differsFromCollege(undefined, undefined)).toBe(false);
        expect(differsFromCollege({ due: "2026-07-03" }, undefined)).toBe(true);
    });
});

test.describe("แถบกำหนดส่งของรอบ (หน้า T000/T002/T003) — หลักสูตรวันเดียวกันรวมกลุ่ม", () => {
    const legacy = { isOpen: true, startDate: "2026-03-24", endDate: "2027-01-24" };
    const base = { period: { id: 2, academicYear: "2569", semester: 2 }, canEditCollege: true, college: {} };
    const major = (m: string, deadlines: any = {}) => ({ major: m, deadlines, startDate: null });

    test("ทุกหลักสูตรใช้ค่าเดิมเดียวกัน → กลุ่มเดียว (เดิมข้อความเดียวกันซ้ำทีละหลักสูตร)", async () => {
        const { groupByDeadline } = await import("../src/components/RoundDeadlineNote");
        const data: any = { ...base, majors: ["AI", "CS", "CYB", "GIS", "IT"].map((m) => major(m)), legacy: Object.fromEntries(["AI", "CS", "CYB", "GIS", "IT"].map((m) => [m, { T000: legacy }])) };
        const g = groupByDeadline(data, "T000");
        expect(g).toHaveLength(1);
        expect(g[0]).toMatchObject({ majors: ["AI", "CS", "CYB", "GIS", "IT"], legacy: true });
    });

    test("ตั้งวันต่างกัน → แยกกลุ่มตามวัน · ค่าเดิมกับที่ตั้งแล้วไม่ปนกัน · ลำดับตามหลักสูตรแรก", async () => {
        const { groupByDeadline } = await import("../src/components/RoundDeadlineNote");
        const due = (d: string) => ({ T002: { due: d, mode: "HARD", closed: false } });
        const data: any = { ...base, majors: [major("AI", due("2026-12-28")), major("CS"), major("CYB", due("2026-12-28")), major("IT", due("2027-01-05"))],
            legacy: { CS: { T002: legacy } } };
        const g = groupByDeadline(data, "T002");
        expect(g.map((x) => x.majors)).toEqual([["AI", "CYB"], ["CS"], ["IT"]]);
        expect(g.map((x) => x.legacy)).toEqual([false, true, false]);
    });
});
