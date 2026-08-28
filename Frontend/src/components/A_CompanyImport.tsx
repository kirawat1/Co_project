/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiFetch } from "../utils/apiFetch";

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

function parseThaiAddress(raw: string): Partial<ParsedCompany> {
  if (!raw) return {};
  const s = raw.trim();
  const result: Partial<ParsedCompany> = { address: s };

  // zipcode — 5-digit number at end
  const zipM = s.match(/(\d{5})\s*$/);
  if (zipM) result.zipcode = zipM[1];

  // province
  const provM = s.match(/จังหวัด\s*([^\s\d]+)/);
  if (provM) result.province = provM[1];

  // district
  const distM = s.match(/(?:อำเภอ|อ\.)\s*([^\s]+)/);
  if (distM) result.district = distM[1];

  // subDistrict
  const subM = s.match(/(?:ตำบล|ต\.|แขวง)\s*([^\s]+)/);
  if (subM) result.subDistrict = subM[1];

  // road
  const roadM = s.match(/(?:ถนน|ถ\.)\s*([^\s]+)/);
  if (roadM) result.road = roadM[1];

  // moo
  const mooM = s.match(/(?:หมู่ที่|หมู่|ม\.)\s*(\d+)/);
  if (mooM) result.moo = mooM[1];

  // addressNo — leading number(s) before a space/slash
  const noM = s.match(/^(\d+(?:\/\d+)?)/);
  if (noM) result.addressNo = noM[1];

  return result;
}

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export default function A_CompanyImport({ onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedCompany[]>([]);
  const [sheetSummary, setSheetSummary] = useState<{ sheet: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array" });
        const allRows: ParsedCompany[] = [];
        const summary: { sheet: string; count: number }[] = [];

        wb.SheetNames.forEach((sheetName) => {
          const ws = wb.Sheets[sheetName];
          const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

          // skip header rows — find first row where col[1] looks like a company name (not header text)
          let dataStart = 0;
          for (let i = 0; i < Math.min(rawData.length, 5); i++) {
            const col1 = String(rawData[i]?.[1] || "").trim();
            // header rows usually say "ชื่อบริษัท" or "ชื่อสถาน" or are empty
            if (col1 && !col1.includes("ชื่อ") && !col1.includes("บริษัท/หน่วย") && !col1.match(/^[ก-๙a-zA-Z\s]+$/)) {
              dataStart = i;
              break;
            }
            if (i > 0 && col1 && !col1.includes("ชื่อ") && !col1.includes("ที่อยู่") && !col1.match(/รายชื่อ/)) {
              dataStart = i;
              break;
            }
          }

          let sheetCount = 0;
          rawData.slice(dataStart).forEach((row) => {
            const nameRaw = String(row[1] || "").trim();
            const addrRaw = String(row[2] || "").trim();
            if (!nameRaw || nameRaw.includes("ชื่อ") || nameRaw.includes("บริษัท/หน่วย")) return;
            // skip rows that are just numbers (sequence col)
            if (/^\d+$/.test(nameRaw)) return;

            const parsed = parseThaiAddress(addrRaw);
            allRows.push({
              name: nameRaw,
              address: addrRaw,
              ...parsed,
              pastYears: sheetName,
            });
            sheetCount++;
          });

          if (sheetCount > 0) summary.push({ sheet: sheetName, count: sheetCount });
        });

        setRows(allRows);
        setSheetSummary(summary);
      } catch {
        setError("อ่านไฟล์ไม่ได้ — ตรวจสอบว่าไฟล์เป็น .xlsx หรือ .xls");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const httpRes = await apiFetch("/api/companies/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: rows }),
      });
      const res = await httpRes.json();
      if (!res.ok) throw new Error(res.message || "นำเข้าไม่สำเร็จ");
      setResult({ created: res.created, skipped: res.skipped });
      onImported();
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--card-bg, #fff)", borderRadius: 12, padding: 28,
        width: "min(680px, 95vw)", maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,.18)",
      }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>📥 นำเข้าบริษัทจาก Excel</h2>

        <p style={{ margin: "0 0 12px", fontSize: 13, opacity: .7 }}>
          รูปแบบที่รองรับ: คอลัมน์ A=ลำดับ, B=ชื่อบริษัท, C=ที่อยู่ | แต่ละ sheet = ปีการศึกษา
        </p>

        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ marginBottom: 16 }} />

        {sheetSummary.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <b>พบข้อมูล ({rows.length} รายการ) จาก {sheetSummary.length} sheet:</b>
            <ul style={{ margin: "6px 0", paddingLeft: 20, fontSize: 13 }}>
              {sheetSummary.map((s) => (
                <li key={s.sheet}>{s.sheet}: {s.count} รายการ</li>
              ))}
            </ul>
          </div>
        )}

        {rows.length > 0 && !result && (
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--table-head-bg, #f0f4ff)" }}>
                  <th style={th}>ชื่อบริษัท</th>
                  <th style={th}>ที่อยู่</th>
                  <th style={th}>จังหวัด</th>
                  <th style={th}>รหัสไปรษณีย์</th>
                  <th style={th}>ปี</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>
                    <td style={td}>{r.name}</td>
                    <td style={{ ...td, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.address}>{r.address || "-"}</td>
                    <td style={td}>{r.province || "-"}</td>
                    <td style={td}>{r.zipcode || "-"}</td>
                    <td style={td}>{r.pastYears}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 20 && <p style={{ fontSize: 12, opacity: .6, margin: "4px 0 0" }}>แสดง 20 จาก {rows.length} รายการ</p>}
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
            style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "transparent", cursor: "pointer" }}
            onClick={onClose}
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

const th: React.CSSProperties = { padding: "6px 10px", textAlign: "left", fontWeight: 600, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "5px 10px" };
