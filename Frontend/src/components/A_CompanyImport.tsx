/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiFetch } from "../utils/apiFetch";
import { provinceFromZipcode } from "../utils/zipcodeProvince";

interface ParsedCompany {
  name: string;
  address: string;
  addressNo?: string;
  moo?: string;
  road?: string;
  subDistrict?: string;
  district?: string;
  province?: string;
  zipcode?: string;
  pastYears?: string;
}

interface PreviewRow extends ParsedCompany {
  sheet: string;
  seq: number;
  /** ชื่อเดียวกันพบในชีตก่อนหน้าแล้ว — ระบบจะข้ามแถวนี้ (pastYears = ปีแรกที่รับ) */
  duplicateOf?: string;
}

function parseThaiAddress(raw: string): Partial<ParsedCompany> {
  if (!raw) return {};
  const s = raw.trim();
  const result: Partial<ParsedCompany> = { address: s };

  // zipcode — 5-digit number at end
  const zipM = s.match(/(\d{5})\s*$/);
  if (zipM) result.zipcode = zipM[1];

  // ตัวย่อ (ถ. ต. อ. จ. ม.) ต้องอยู่ต้นคำเสมอ ไม่งั้นจะไปจับตัวท้ายของคำอื่น
  // เช่น "กทม." โดน /ม\./ จับ, "บจ." โดน /จ\./ จับ
  const B = "(?:^|[\\s,(])";

  // province — "จังหวัดขอนแก่น" / "จ.ขอนแก่น", หรือกรุงเทพที่เขียนลอย ๆ ไม่มีคำนำหน้า
  const provM = s.match(new RegExp(B + "(?:จังหวัด|จ\\.)\\s*([^\\s\\d]+)"));
  if (provM) result.province = provM[1];
  else if (/กรุงเทพมหานคร|กรุงเทพฯ|กทม\.?/.test(s)) result.province = "กรุงเทพมหานคร";
  // ที่อยู่ในไฟล์มักเขียนแค่ "... 40002" ไม่มีคำว่าจังหวัด — เติมจากรหัสไปรษณีย์ให้
  // ถ้าในข้อความระบุจังหวัดไว้แล้ว ใช้ของที่เขียนมา ไม่เอารหัสไปทับ
  else if (result.zipcode) result.province = provinceFromZipcode(result.zipcode);

  // district — ต่างจังหวัดใช้ "อำเภอ/อ." กรุงเทพใช้ "เขต"
  const distM = s.match(new RegExp(B + "(?:อำเภอ|อ\\.|เขต)\\s*([^\\s]+)"));
  if (distM) result.district = distM[1];

  // subDistrict — ต่างจังหวัดใช้ "ตำบล/ต." กรุงเทพใช้ "แขวง"
  const subM = s.match(new RegExp(B + "(?:ตำบล|ต\\.|แขวง)\\s*([^\\s]+)"));
  if (subM) result.subDistrict = subM[1];

  // road
  const roadM = s.match(new RegExp(B + "(?:ถนน|ถ\\.)\\s*([^\\s]+)"));
  if (roadM) result.road = roadM[1];

  // moo — ไม่รับเลขที่ยาวเท่ารหัสไปรษณีย์ (กัน "กทม. 10900")
  const mooM = s.match(new RegExp(B + "(?:หมู่ที่|หมู่|ม\\.)\\s*(\\d{1,3})(?!\\d)"));
  if (mooM) result.moo = mooM[1];

  // addressNo — leading number(s) before a space/slash
  const noM = s.match(/^(\d+(?:\/\d+)?)/);
  if (noM) result.addressNo = noM[1];

  return result;
}

/** "ปี 2558" -> "2558" ให้ตรงกับรูปแบบปีที่ระบบใช้ ถ้าชื่อชีตไม่มีปีก็ใช้ชื่อชีตตามเดิม */
function yearFromSheetName(sheetName: string): string {
  const m = sheetName.match(/(\d{4})/);
  return m ? m[1] : sheetName.trim();
}

/**
 * backend รับ JSON ได้ไม่เกิน 100 KB ต่อคำขอ (express.json ค่าเริ่มต้น) — ไฟล์รวมหลายปี
 * (~700 บริษัท ≈ 230 KB) จึงโดน 413 ถ้าส่งทีเดียว แบ่งส่งเป็นชุดตามขนาดจริงที่เข้ารหัสแล้ว
 * แทนการนับจำนวนแถว เพราะที่อยู่ยาวไม่เท่ากัน และไม่ต้องไปขยายเพดานของ server
 */
const MAX_CHUNK_BYTES = 60 * 1024;
function chunkByBytes<T>(items: T[]): T[][] {
  const enc = new TextEncoder();
  const chunks: T[][] = [];
  let current: T[] = [];
  let size = 0;
  for (const item of items) {
    const bytes = enc.encode(JSON.stringify(item)).length + 1;
    if (current.length > 0 && size + bytes > MAX_CHUNK_BYTES) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += bytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** อ่าน body ให้ได้เสมอ — ถ้า server/proxy ตอบกลับเป็นหน้า HTML (เช่น 413/502) จะไม่ไปพังที่ JSON.parse */
async function readJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (res.status === 413) return { ok: false, message: "ข้อมูลที่ส่งมีขนาดใหญ่เกินกว่าที่เซิร์ฟเวอร์รับได้" };
    return { ok: false, message: `เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ (HTTP ${res.status})` };
  }
}

interface Props {
  onClose: () => void;
  onImported: () => void;
}

const ALL = "__all__";

export default function A_CompanyImport({ onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [sheetSummary, setSheetSummary] = useState<{ sheet: string; count: number }[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setResult(null);
    setActiveSheet(ALL);
    setSearch("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array" });
        const allRows: PreviewRow[] = [];
        const summary: { sheet: string; count: number }[] = [];
        const firstSeen = new Map<string, string>(); // ชื่อบริษัท -> ชีตแรกที่พบ

        wb.SheetNames.forEach((sheetName) => {
          const ws = wb.Sheets[sheetName];
          const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          const year = yearFromSheetName(sheetName);

          let sheetCount = 0;
          rawData.forEach((row) => {
            const seqRaw = String(row[0] ?? "").trim();
            const nameRaw = String(row[1] ?? "").trim();
            const addrRaw = String(row[2] ?? "").trim();

            // รูปแบบไฟล์: A=ลำดับ, B=ชื่อบริษัท, C=ที่อยู่
            // แถวที่คอลัมน์ A มีข้อความแต่ไม่ใช่ตัวเลข คือหัวเรื่อง/หัวคอลัมน์ ("ลำดับที่", "ปี", ชื่อรายงาน)
            // เดิมตรวจแค่คำว่า "ชื่อ" ในคอลัมน์ B ทำให้ชีตสรุปที่หัวคอลัมน์เป็น
            // "จำนวนสถานประกอบการ (แห่ง)" หลุดมาเป็นบริษัท 1 แห่ง
            if (seqRaw && !/^\d+(\.\d+)?$/.test(seqRaw)) return;
            if (!nameRaw) return;
            // ชื่อที่เป็นตัวเลขล้วน เช่นจำนวนแห่งในชีตสรุป ไม่ใช่บริษัท
            if (/^\d+(\.\d+)?$/.test(nameRaw)) return;

            const key = nameRaw.replace(/\s+/g, " ");
            const dupSheet = firstSeen.get(key);
            if (!dupSheet) firstSeen.set(key, sheetName);

            sheetCount++;
            allRows.push({
              name: nameRaw,
              address: addrRaw,
              ...parseThaiAddress(addrRaw),
              pastYears: year,
              sheet: sheetName,
              seq: sheetCount,
              duplicateOf: dupSheet,
            });
          });

          if (sheetCount > 0) summary.push({ sheet: sheetName, count: sheetCount });
        });

        setRows(allRows);
        setSheetSummary(summary);
        if (allRows.length === 0) setError("ไม่พบรายชื่อบริษัทในไฟล์ — ตรวจสอบว่าคอลัมน์ A=ลำดับ, B=ชื่อบริษัท, C=ที่อยู่");
      } catch {
        setError("อ่านไฟล์ไม่ได้ — ตรวจสอบว่าไฟล์เป็น .xlsx หรือ .xls");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const duplicateCount = useMemo(() => rows.filter((r) => r.duplicateOf).length, [rows]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      (activeSheet === ALL || r.sheet === activeSheet) &&
      (!q || r.name.toLowerCase().includes(q) || (r.address || "").toLowerCase().includes(q))
    );
  }, [rows, activeSheet, search]);

  async function handleImport() {
    if (rows.length === 0) return;
    setLoading(true);
    setError("");
    // ส่งเฉพาะฟิลด์ของบริษัท ไม่ต้องส่งข้อมูลที่ใช้แสดงผลในหน้าตัวอย่าง
    const payload: ParsedCompany[] = rows.map(({ sheet: _s, seq: _q, duplicateOf: _d, ...company }) => company);
    const chunks = chunkByBytes(payload);
    let created = 0;
    let skipped = 0;
    let done = 0;
    setProgress({ done: 0, total: payload.length });
    try {
      // ส่งทีละชุดตามลำดับ (ไม่ขนาน) — backend เช็คชื่อซ้ำกับ DB ตอนบันทึก
      // ชุดหลังจึงเห็นบริษัทที่ชุดก่อนเพิ่งสร้าง และปีแรกที่พบยังคงเป็นปีที่ถูกเก็บ
      for (const chunk of chunks) {
        const httpRes = await apiFetch("/api/companies/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companies: chunk }),
        });
        const res = await readJsonSafe(httpRes);
        if (!httpRes.ok || !res.ok) {
          const partial = created + skipped > 0 ? ` (นำเข้าไปแล้ว ${done} จาก ${payload.length} รายการก่อนเกิดข้อผิดพลาด)` : "";
          throw new Error((res.message || "นำเข้าไม่สำเร็จ") + partial);
        }
        created += res.created ?? 0;
        skipped += res.skipped ?? 0;
        done += chunk.length;
        setProgress({ done, total: payload.length });
      }
      setResult({ created, skipped });
      onImported();
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด");
      if (created > 0) onImported();
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div style={{
        background: "var(--card-bg, #fff)", borderRadius: 12, padding: 28,
        width: "min(1000px, 95vw)", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,.18)",
      }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>📥 นำเข้าบริษัทจาก Excel</h2>

        <p style={{ margin: "0 0 12px", fontSize: 13, opacity: .7 }}>
          รูปแบบที่รองรับ: คอลัมน์ A=ลำดับ, B=ชื่อบริษัท, C=ที่อยู่ | แต่ละ sheet = ปีการศึกษา (เช่น "ปี 2558")
        </p>

        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ marginBottom: 16 }} disabled={loading} />

        {rows.length > 0 && !result && (
          <>
            <div style={{ marginBottom: 10, fontSize: 14 }}>
              <b>พบข้อมูล {rows.length} รายการ จาก {sheetSummary.length} sheet</b>
              {duplicateCount > 0 && (
                <span style={{ marginLeft: 8, fontSize: 13, color: "#92400e" }}>
                  · ชื่อซ้ำกับปีก่อนหน้าในไฟล์ {duplicateCount} รายการ (ระบบเก็บปีแรกที่พบ แถวซ้ำจะถูกข้าม)
                </span>
              )}
            </div>

            {/* เลือกดูทีละชีต */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              <button type="button" style={chip(activeSheet === ALL)} onClick={() => setActiveSheet(ALL)}>
                ทั้งหมด ({rows.length})
              </button>
              {sheetSummary.map((s) => (
                <button type="button" key={s.sheet} style={chip(activeSheet === s.sheet)} onClick={() => setActiveSheet(s.sheet)}>
                  {s.sheet} ({s.count})
                </button>
              ))}
            </div>

            <input
              className="input"
              placeholder="ค้นหาชื่อบริษัท / ที่อยู่ ในรายการที่จะนำเข้า"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", maxWidth: 380, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 8 }}
            />
            <div style={{ fontSize: 12, opacity: .7, marginBottom: 6 }}>
              แสดง {visibleRows.length} รายการ
            </div>

            <div style={{ maxHeight: "48vh", overflow: "auto", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: 8, marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 44 }}>ลำดับ</th>
                    <th style={th}>ชื่อบริษัท</th>
                    <th style={th}>ที่อยู่</th>
                    <th style={th}>จังหวัด</th>
                    <th style={th}>รหัสไปรษณีย์</th>
                    <th style={th}>ปี</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr><td colSpan={6} style={{ ...td, textAlign: "center", padding: 16, opacity: .6 }}>ไม่พบรายการตามที่ค้นหา</td></tr>
                  ) : visibleRows.map((r) => (
                    <tr
                      key={`${r.sheet}-${r.seq}`}
                      style={{ borderBottom: "1px solid var(--border-color, #e5e7eb)", background: r.duplicateOf ? "#fffbeb" : undefined }}
                    >
                      <td style={{ ...td, opacity: .6 }}>{r.seq}</td>
                      <td style={td}>
                        {r.name}
                        {r.duplicateOf && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: "#92400e", background: "#fef3c7", padding: "1px 6px", borderRadius: 6, whiteSpace: "nowrap" }}>
                            ซ้ำกับ {r.duplicateOf} — จะข้าม
                          </span>
                        )}
                      </td>
                      <td style={{ ...td, maxWidth: 260 }}>{r.address || "-"}</td>
                      <td style={td}>{r.province || "-"}</td>
                      <td style={td}>{r.zipcode || "-"}</td>
                      <td style={td}>{r.pastYears}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {progress && (
          <div style={{ marginBottom: 16, fontSize: 13 }}>
            กำลังนำเข้า {progress.done} / {progress.total} รายการ...
            <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
              <div style={{ width: `${Math.round((progress.done / progress.total) * 100)}%`, height: "100%", background: "#2563eb", transition: "width .2s" }} />
            </div>
          </div>
        )}

        {result && (
          <div style={{ padding: "12px 16px", background: "var(--success-bg, #ecfdf5)", borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
            ✅ นำเข้าสำเร็จ: เพิ่มใหม่ <b>{result.created}</b> บริษัท, ข้ามซ้ำ <b>{result.skipped}</b> รายการ
          </div>
        )}

        {error && (
          <div style={{ padding: "10px 14px", background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "transparent", cursor: loading ? "not-allowed" : "pointer" }}
            onClick={onClose}
            disabled={loading}
          >
            ปิด
          </button>
          {rows.length > 0 && !result && (
            <button
              style={{ padding: "8px 18px", borderRadius: 8, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", opacity: loading ? .6 : 1 }}
              onClick={handleImport}
              disabled={loading}
            >
              {loading ? "กำลังนำเข้า..." : `นำเข้า ${rows.length} รายการ`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "6px 10px", textAlign: "left", fontWeight: 600, whiteSpace: "nowrap",
  position: "sticky", top: 0, background: "var(--table-head-bg, #f0f4ff)", zIndex: 1,
};
const td: React.CSSProperties = { padding: "5px 10px", verticalAlign: "top" };
const chip = (active: boolean): React.CSSProperties => ({
  padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
  border: active ? "1px solid #2563eb" : "1px solid #d1d5db",
  background: active ? "#2563eb" : "transparent",
  color: active ? "#fff" : "inherit",
});
