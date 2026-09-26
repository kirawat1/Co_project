import { test, expect } from "@playwright/test";
import { letterRecipient } from "../src/utils/letterRecipient";

// ผู้รับหนังสือ ("เรียน …") — ฟังก์ชันล้วน ไม่เปิดเบราว์เซอร์
test("ใช้ผู้ติดต่อคนแรกของคำร้อง", () => {
  expect(letterRecipient({ contacts: [{ id: "1", firstName: "สมศรี", lastName: "", position: " HR " }], company: { contactPerson: "เก่า" } }))
    .toEqual({ name: "สมศรี", position: "HR" });
});

test("ข้ามผู้ติดต่อที่ไม่มีชื่อ", () => {
  expect(letterRecipient({ contacts: [{ id: "1", firstName: "  " }, { id: "2", firstName: "คุณบี", lastName: "ซี" }] }))
    .toEqual({ name: "คุณบี ซี", position: "" });
});

test("ไม่มีผู้ติดต่อ (คำร้องเก่า / ผู้ติดต่อถูกลบ) → ใช้ผู้ติดต่อของบริษัท", () => {
  expect(letterRecipient({ contacts: [], company: { contactPerson: "คุณเอ", contactPosition: "ผู้จัดการ" } }))
    .toEqual({ name: "คุณเอ", position: "ผู้จัดการ" });
});

test("ไม่มีข้อมูลเลย → ว่าง ไม่ใช่ undefined", () => {
  expect(letterRecipient(null)).toEqual({ name: "", position: "" });
  expect(letterRecipient({ company: null })).toEqual({ name: "", position: "" });
});

test("recipientText ต่อชื่อกับตำแหน่ง ข้ามส่วนที่ว่าง", async () => {
  const { recipientText } = await import("../src/utils/letterRecipient");
  expect(recipientText({ name: "สมศรี", position: "HR" })).toBe("สมศรี HR");
  expect(recipientText({ name: "สมศรี", position: "" })).toBe("สมศรี");
  expect(recipientText({ name: "", position: "" })).toBe("");
});
