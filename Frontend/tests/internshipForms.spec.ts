import { test, expect } from "@playwright/test";
import {
  isInternshipStatus, formState, canSubmitForm, reviewActions, latestForm, formsDone,
  FORM_STATE_LABEL, MAIN_STATUS_LABEL, FORMS_DONE_LABEL,
} from "../src/utils/internshipForms";

// ต้องตรงกับ backend/utils/internshipForms.js (เทสต์ฝั่ง server: __tests__/internshipForms.test.js)
test.describe("internshipForms", () => {
  test("isInternshipStatus: INTERNSHIP_STARTED + สถานะเก่า T002/T003 นับเป็นช่วงฝึกงาน", () => {
    for (const s of ["INTERNSHIP_STARTED", "T002_SUBMITTED", "T002_EDITS_REQUIRED", "T003_SUBMITTED", "T003_EDITS_REQUIRED", "T003_APPROVED"]) {
      expect(isInternshipStatus(s)).toBe(true);
    }
    for (const s of ["COMPLETED", "REQ_SUBMITTED", "", null, undefined]) {
      expect(isInternshipStatus(s as any)).toBe(false);
    }
  });

  test("formState จากสถานะไฟล์ล่าสุด", () => {
    expect(formState(undefined)).toBe("NONE");
    expect(formState(null)).toBe("NONE");
    expect(formState({ status: "WAITING" })).toBe("WAITING");
    expect(formState({ status: "PENDING" })).toBe("WAITING");
    expect(formState({ status: "REJECTED" })).toBe("REJECTED");
    expect(formState({ status: "EDITS_REQUIRED" })).toBe("REJECTED");
    expect(formState({ status: "APPROVED" })).toBe("APPROVED");
  });

  test("canSubmitForm: ส่งได้เมื่อยังไม่ส่ง/ถูกตีกลับ ในช่วงฝึกงาน", () => {
    expect(canSubmitForm("INTERNSHIP_STARTED", "NONE")).toBe(true);
    expect(canSubmitForm("T003_APPROVED", "REJECTED")).toBe(true);
    expect(canSubmitForm("INTERNSHIP_STARTED", "WAITING")).toBe(false);
    expect(canSubmitForm("INTERNSHIP_STARTED", "APPROVED")).toBe(false);
    expect(canSubmitForm("COMPLETED", "NONE")).toBe(false);
  });

  test("reviewActions", () => {
    expect(reviewActions("INTERNSHIP_STARTED", "WAITING")).toEqual({ approve: true, reject: true });
    expect(reviewActions("T002_SUBMITTED", "APPROVED")).toEqual({ approve: false, reject: true });
    expect(reviewActions("INTERNSHIP_STARTED", "NONE")).toEqual({ approve: false, reject: false });
    expect(reviewActions("INTERNSHIP_STARTED", "REJECTED")).toEqual({ approve: false, reject: false });
    expect(reviewActions("COMPLETED", "WAITING")).toEqual({ approve: false, reject: false });
  });

  test("ป้ายข้อความ", () => {
    expect(FORM_STATE_LABEL).toEqual({ NONE: "ยังไม่ส่ง", WAITING: "รอตรวจ", REJECTED: "ต้องแก้", APPROVED: "ผ่าน" });
    expect(MAIN_STATUS_LABEL).toBe("ส่งเอกสารฝึกสหกิจ");
    expect(FORMS_DONE_LABEL).toBe("เอกสารฝึกสหกิจครบ");
  });

  test("latestForm เลือก id มากสุดของชนิดนั้น", () => {
    const docs = [
      { id: 1, type: "T002_FORM", status: "REJECTED" },
      { id: 5, type: "T002_FORM", status: "WAITING" },
      { id: 9, type: "T003_FORM", status: "APPROVED" },
      { id: 3, type: "T002_FORM", status: "APPROVED" },
      { id: 12, type: "OTHER", status: "APPROVED" },
    ];
    expect(latestForm(docs, "T002")?.id).toBe(5);
    expect(latestForm(docs, "T003")?.id).toBe(9);
    expect(latestForm([], "T002")).toBeUndefined();
    expect(latestForm(undefined, "T003")).toBeUndefined();
  });

  test("formsDone เมื่อผ่านทั้งสองฟอร์ม", () => {
    expect(formsDone("APPROVED", "APPROVED")).toBe(true);
    expect(formsDone("APPROVED", "WAITING")).toBe(false);
    expect(formsDone("NONE", "APPROVED")).toBe(false);
  });
});
