import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import AutoTextarea from "./AutoTextarea";
import { notify, askConfirm } from "../utils/notify";
import { TABLE_TH as th, TABLE_TD as td, TABLE_HEADER_ROW } from "../utils/tableStyles";
import MajorConfigTabs from "./MajorConfigTabs";

interface EvalConfig { instructionText: string; evalLink: string | null; autoSend: boolean }
interface EvalRow {
  id: number;
  status: "LETTER_UPLOADED" | "COMPLETED";
  confirmedDate: string | null;
  evalSentAt: string | null;
  studentCode: string;
  studentName: string;
  companyName: string;
  teacherName: string;
  coTeacherName: string;
  unlinkedCoTeachers: string[];
  hasLink: boolean; // หลักสูตรของนักศึกษามีลิงก์แบบประเมินแล้ว (ค่ากลาง/ค่าเฉพาะหลักสูตร)
}

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-";
const STATUS_LABEL: Record<EvalRow["status"], string> = {
  LETTER_UPLOADED: "อนุมัติหนังสือแล้ว",
  COMPLETED: "นิเทศเสร็จสิ้น",
};

export default function A_SupervisionEval() {
  const token = localStorage.getItem("coop.token");
  const headers = { Authorization: `Bearer ${token}` };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [instructionText, setInstructionText] = useState("");
  const [evalLink, setEvalLink] = useState("");
  const [autoSend, setAutoSend] = useState(false);
  const [savedLink, setSavedLink] = useState<string | null>(null);
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [showSent, setShowSent] = useState(true);

  const load = async () => {
    try {
      const res = await axios.get("/api/admin/supervision-eval", { headers });
      const cfg: EvalConfig = res.data.config;
      setInstructionText(cfg.instructionText || "");
      setEvalLink(cfg.evalLink || "");
      setSavedLink(cfg.evalLink || null);
      setAutoSend(!!cfg.autoSend);
      setRows(res.data.appointments || []);
    } catch {
      notify.error("โหลดข้อมูลแบบประเมินการนิเทศไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const unsent = useMemo(() => rows.filter(r => !r.evalSentAt), [rows]);
  const visible = showSent ? rows : unsent;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.put("/api/admin/supervision-eval/config", { instructionText, evalLink, autoSend }, { headers });
      setSavedLink(res.data.config?.evalLink ?? null);
      notify.success("บันทึกการตั้งค่าแล้ว");
    } catch (err: any) {
      notify.error(err?.response?.data?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const send = async (ids: number[], label: string) => {
    if (!rows.some(r => ids.includes(r.id) && r.hasLink)) { notify.warning("หลักสูตรของนักศึกษายังไม่มีลิงก์แบบประเมิน — ตั้งค่าลิงก์ (ค่ากลางหรือค่าเฉพาะหลักสูตร) ก่อน"); return; }
    if (!(await askConfirm(`${label}? อาจารย์ผู้นิเทศจะได้รับแจ้งเตือนในระบบ`, { confirmLabel: "ส่ง" }))) return;
    setSending(true);
    try {
      const res = await axios.post("/api/admin/supervision-eval/send", { ids }, { headers });
      const results: { unlinked: string[]; skipped?: string }[] = res.data.results || [];
      const unmatched = results.flatMap(r => r.unlinked);
      const skipped = results.filter(r => r.skipped).length;
      notify.success(`ส่งแล้ว ${results.length - skipped} รายการ`);
      if (skipped) notify.warning(`ไม่ได้ส่ง ${skipped} รายการ — หลักสูตรของนักศึกษายังไม่มีลิงก์แบบประเมิน`);
      if (unmatched.length) notify.warning(`ยังไม่ผูกบัญชี: ${[...new Set(unmatched)].join(", ")} — เลือกอาจารย์ร่วมใหม่ หรือใช้ปุ่มคัดลอกข้อความส่งเองแทน`);
      await load();
    } catch (err: any) {
      notify.error(err?.response?.data?.message || "ส่งไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  const copyMessage = async () => {
    if (!savedLink) { notify.warning("กรุณาใส่ลิงก์แบบประเมินแล้วกดบันทึกก่อน"); return; }
    const text = [instructionText.trim(), `แบบประเมินการนิเทศ: ${savedLink}`].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      notify.success("คัดลอกข้อความแล้ว — วางส่งทาง LINE/อีเมลได้เลย");
    } catch {
      notify.error("คัดลอกไม่สำเร็จ");
    }
  };

  if (loading) {
    return <div className="page" style={{ padding: 40, textAlign: "center", color: "#0074B7" }}>กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="page" style={{ padding: 4, margin: "28px 28px 28px 65px" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#1e293b" }}>📋 แบบประเมินการนิเทศ (อาจารย์)</h2>
        <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
          ตั้งค่าลิงก์แบบประเมิน แล้วส่งให้อาจารย์ผู้นิเทศและอาจารย์นิเทศร่วม — อาจารย์จะเห็นลิงก์ที่หน้า "นัดหมายนิเทศ" และได้รับแจ้งเตือน
        </div>
      </div>

      {/* ── ตั้งค่า (ค่ากลาง + ค่าเฉพาะหลักสูตร) ── */}
      <div style={{ marginBottom: 24 }}>
      <MajorConfigTabs configKey="CONFIG_SUPERVISION_EVAL">
      {/* ── ตั้งค่า ── */}
      <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18, }}>
        <div>
          <label className="label" style={{ display: "block", marginBottom: 6 }}>📝 คำชี้แจงถึงอาจารย์</label>
          <AutoTextarea
            className="input"
            rows={4}
            value={instructionText}
            onChange={e => setInstructionText(e.target.value)}
            placeholder="เช่น รบกวนอาจารย์ประเมินการนิเทศนักศึกษาภายใน 7 วันหลังนิเทศ"
          />
        </div>
        <div>
          <label className="label" style={{ display: "block", marginBottom: 6 }}>🔗 ลิงก์แบบประเมิน (Google Form)</label>
          <input className="input" type="url" value={evalLink} onChange={e => setEvalLink(e.target.value)} placeholder="https://forms.gle/..." />
        </div>
        <div>
          <div className="label" style={{ marginBottom: 8 }}>📨 วิธีส่งลิงก์ให้อาจารย์</div>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, marginBottom: 6, cursor: "pointer" }}>
            <input type="radio" name="evalSendMode" checked={!autoSend} onChange={() => setAutoSend(false)} style={{ marginTop: 3 }} />
            <span><b>ส่งเอง</b> — กดปุ่ม "ส่ง" ในตารางด้านล่าง</span>
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, cursor: "pointer" }}>
            <input type="radio" name="evalSendMode" checked={autoSend} onChange={() => setAutoSend(true)} style={{ marginTop: 3 }} />
            <span><b>ส่งอัตโนมัติ</b> — ส่งทันทีเมื่อกด "นิเทศเสร็จ" (รายการที่เสร็จไปก่อนเปิดโหมดนี้ ยังต้องกดส่งเองในตาราง)</span>
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={copyMessage} disabled={!savedLink}>📋 คัดลอกข้อความ</button>
          <button className="btn" onClick={handleSave} disabled={saving}>{saving ? "กำลังบันทึก..." : "💾 บันทึกการตั้งค่า"}</button>
        </div>
      </div>

      </MajorConfigTabs>
      </div>

      {/* ── รายการนัดนิเทศ ── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800, color: "#1e293b" }}>
            นัดนิเทศที่อนุมัติหนังสือแล้ว / นิเทศเสร็จ — ยังไม่ส่ง {unsent.length} จาก {rows.length} รายการ
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 13, color: "#475569", display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={showSent} onChange={e => setShowSent(e.target.checked)} /> แสดงที่ส่งแล้ว
            </label>
            <button
              className="btn"
              disabled={sending || unsent.length === 0}
              onClick={() => send(unsent.map(r => r.id), `ส่งลิงก์ให้ ${unsent.length} รายการที่ยังไม่ส่ง`)}
            >
              📨 ส่งทั้งหมดที่ยังไม่ส่ง ({unsent.length})
            </button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={TABLE_HEADER_ROW}>
                <th style={th}>นักศึกษา</th>
                <th style={th}>บริษัท</th>
                <th style={{ ...th, whiteSpace: "nowrap" }}>วันนิเทศ</th>
                <th style={th}>อาจารย์นิเทศ</th>
                <th style={th}>อาจารย์นิเทศร่วม</th>
                <th style={th}>สถานะการส่ง</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 32 }}>ไม่มีรายการ</td></tr>
              ) : visible.map(r => (
                <tr key={r.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{r.studentName || "-"}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{r.studentCode} · {STATUS_LABEL[r.status]}</div>
                  </td>
                  <td style={td}>{r.companyName || "-"}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.confirmedDate)}</td>
                  <td style={td}>{r.teacherName || "-"}</td>
                  <td style={td}>
                    {r.coTeacherName || "-"}
                    {r.unlinkedCoTeachers.length > 0 && (
                      <div style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>
                        ⚠️ ยังไม่ผูกบัญชี: {r.unlinkedCoTeachers.join(", ")} (ข้อมูลเก่า — เลือกอาจารย์ร่วมใหม่ที่หน้าจัดการนิเทศ จึงจะส่งแจ้งเตือนได้)
                      </div>
                    )}
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {r.evalSentAt
                      ? <span style={{ color: "#047857", fontWeight: 700 }}>✅ ส่งแล้ว {fmtDate(r.evalSentAt)}</span>
                      : <span style={{ color: "#94a3b8" }}>ยังไม่ส่ง</span>}
                    {!r.hasLink && <div style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>⚠️ หลักสูตรนี้ยังไม่มีลิงก์</div>}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button
                      className="btn-secondary small"
                      disabled={sending}
                      onClick={() => send([r.id], `${r.evalSentAt ? "ส่งซ้ำ" : "ส่งลิงก์"}ให้อาจารย์ของ ${r.studentName}`)}
                    >
                      {r.evalSentAt ? "ส่งซ้ำ" : "ส่ง"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
