import { Zip, ZipPassThrough } from "fflate";
import * as XLSX from "xlsx";
import { toThaiDate } from "./docGeneratorUtils";
import { LETTER_FILE_LABEL, type BulkLetterType } from "./bulkLetters";

/** zip แบบไม่บีบอัด (PDF/Word บีบอยู่แล้ว) — ชื่อไทยได้ flag UTF-8 จาก fflate เอง */
export function createZip(): { add(name: string, data: Uint8Array): void; finish(): Promise<Blob> } {
  // เก็บเป็น Blob ต่อก้อน (ไม่ค้าง Uint8Array ซ้ำกับ Blob สุดท้าย) — ลดหน่วยความจำช่วงสูงสุด
  let chunks: Blob[] = [];
  let resolve!: (b: Blob) => void, reject!: (e: unknown) => void;
  const done = new Promise<Blob>((res, rej) => { resolve = res; reject = rej; });
  done.catch(() => {}); // error ก่อนเรียก finish() ไม่เป็น unhandled rejection (finish() ยังได้ error เดิม)
  const zip = new Zip((err, chunk, final) => {
    if (err) return reject(err);
    chunks.push(new Blob([chunk as BlobPart]));
    if (final) {
      const blob = new Blob(chunks, { type: "application/zip" });
      chunks = [];
      resolve(blob);
    }
  });
  let ended = false;
  return {
    add(name, data) {
      const f = new ZipPassThrough(name);
      zip.add(f);
      f.push(data, true);
    },
    finish() { if (!ended) { ended = true; zip.end(); } return done; },
  };
}

export interface RegisterRow {
  docNumber: string; docDate: string; letter: BulkLetterType;
  recipient: string; companyName: string; students: string[]; files: string[];
}

export const REGISTER_HEADERS = ["เลขที่", "วันที่", "ประเภท", "เรียน", "บริษัท", "นักศึกษา", "ชื่อไฟล์"];

/** ทะเบียนหนังสือที่ออกในชุดนี้ (Excel แผ่นเดียว) */
export function registerWorkbook(rows: RegisterRow[]): Uint8Array {
  const aoa = [
    REGISTER_HEADERS,
    ...rows.map(r => [r.docNumber, toThaiDate(r.docDate), LETTER_FILE_LABEL[r.letter], r.recipient, r.companyName, r.students.join("; "), r.files.join("; ")]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 24 }, { wch: 30 }, { wch: 36 }, { wch: 40 }, { wch: 50 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ทะเบียนหนังสือ");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
}
