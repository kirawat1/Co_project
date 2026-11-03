import type { CSSProperties, ReactNode } from "react";
import Modal from "./Modal";
import { STEP_LABEL, type StepKey } from "../utils/deadlines";

// ตัวอย่างการกรอกหน้ารอบสหกิจ (ปุ่ม "💡 ดูตัวอย่างการกรอก") — ดูอย่างเดียว ไม่บันทึกอะไร
// ชื่อปุ่ม/ช่องต้องตรงกับ A_CoopPeriod + A_RoundDeadlines · ปีตามปีปัจจุบัน (พ.ศ.) ตัวอย่างจะได้ไม่เก่า
const Y = new Date().getFullYear() + 543;

const DEADLINE_EXAMPLE: { k: StepKey; due: string; mode: string }[] = [
    { k: "T000", due: `15 ส.ค. ${Y}`, mode: "ปิดรับ (ขยายเวลารายคนได้)" },
    { k: "T002", due: `30 พ.ย. ${Y}`, mode: "ส่งได้ ติดป้ายส่งช้า" },
    { k: "T003", due: `15 ธ.ค. ${Y}`, mode: "ส่งได้ ติดป้ายส่งช้า" },
    { k: "T005_T006", due: `15 ม.ค. ${Y + 1}`, mode: "ฟอร์มนอกระบบ แสดงวันอย่างเดียว" },
    { k: "T007", due: `28 ก.พ. ${Y + 1}`, mode: "ฟอร์มนอกระบบ แสดงวันอย่างเดียว" },
    { k: "T008", due: `15 มี.ค. ${Y + 1}`, mode: "ฟอร์มนอกระบบ แสดงวันอย่างเดียว" },
];

const Btn = ({ children }: { children: ReactNode }) => <span style={btnChip}>{children}</span>;

function Step({ n, title, children }: { n: number; title: ReactNode; children: ReactNode }) {
    return (
        <li style={stepBox}>
            <div style={stepNum} aria-hidden>{n}</div>
            <div style={{ minWidth: 0, display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>{title}</div>
                {children}
            </div>
        </li>
    );
}

function Fields({ rows }: { rows: [string, string][] }) {
    return (
        <dl style={fieldGrid}>
            {rows.map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                    <dt style={{ color: "#64748b" }}>{k}</dt>
                    <dd style={{ margin: 0, fontWeight: 600, color: "#0f172a" }}>{v}</dd>
                </div>
            ))}
        </dl>
    );
}

export default function CoopPeriodExample({ onClose }: { onClose: () => void }) {
    return (
        <Modal title="💡 ตัวอย่างการกรอกรอบสหกิจ" onClose={onClose} maxWidth={760}>
            <div style={{ display: "grid", gap: 14 }}>
                <div style={hint}>
                    ตัวอย่าง: รอบ <strong>ปีการศึกษา {Y} เทอม 2</strong> — นักศึกษาสมัคร มิ.ย.–ก.ค. แล้วออกฝึกสหกิจ พ.ย.–มี.ค. ·
                    วันที่ทั้งหมดเป็นตัวอย่าง ให้ใช้วันจริงของรอบแทน
                </div>
                <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                    <Step n={1} title={<>สร้างรอบ — กด <Btn>+ สร้างรอบใหม่</Btn> มุมขวาบน</>}>
                        <Fields rows={[["ปีการศึกษา", String(Y)], ["ภาคเรียน", "เทอม 2"], ["วันที่เปิดรับสมัคร", `1 มิ.ย. ${Y}`], ["วันที่ปิดรับสมัคร", `31 ก.ค. ${Y}`]]} />
                        <div style={hint}>กด <Btn>บันทึกข้อมูล</Btn> → ระบบสร้างรอบให้ทุกหลักสูตรด้วยวันเดียวกัน (อาจารย์ประจำหลักสูตร = เฉพาะหลักสูตรที่ดูแล)</div>
                    </Step>

                    <Step n={2} title={<>หลักสูตรที่รับสมัครคนละวัน (ถ้ามี) — กด <Btn>แก้วัน</Btn> ที่แถวหลักสูตรนั้น</>}>
                        <Fields rows={[["เช่น หลักสูตร CS", `1 มิ.ย. – 15 ก.ค. ${Y}`]]} />
                        <div style={hint}>หลักสูตรที่ไม่ใช้รอบนี้ กด <Btn>เอาออก</Btn></div>
                    </Step>

                    <Step n={3} title={<>เปิดรับสมัคร — กด <Btn>เปิดรับสมัคร</Btn> ที่แถวหลักสูตร หรือ <Btn>เปิดทุกหลักสูตร</Btn></>}>
                        <div style={hint}>หลักสูตรหนึ่งเปิดได้ทีละรอบ — เปิดรอบใหม่แล้วรอบที่เปิดอยู่ของหลักสูตรนั้นจะถูกปิด (ระบบถามยืนยันก่อน)</div>
                    </Step>

                    <Step n={4} title={<>ตั้งกำหนดส่งเอกสาร — กด <Btn>📆 ปฏิทินของรอบ</Btn> → แท็บ <Btn>ทั้งวิทยาลัย</Btn></>}>
                        <div style={{ overflowX: "auto" }}>
                            <table style={table}>
                                <thead>
                                    <tr><th style={th}>ขั้น</th><th style={th}>กำหนดส่ง · เลยกำหนดแล้ว</th></tr>
                                </thead>
                                <tbody>
                                    {DEADLINE_EXAMPLE.map(r => (
                                        <tr key={r.k}>
                                            <td style={td}>{STEP_LABEL[r.k]}</td>
                                            <td style={td}>
                                                <div style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{r.due}</div>
                                                <div style={{ fontSize: 12, color: "#64748b" }}>{r.mode}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={hint}>
                            กด <Btn>บันทึกค่าวิทยาลัย</Btn> → ติ๊กหลักสูตรที่จะใช้ค่านี้ → <Btn>บันทึก</Btn><br />
                            <strong>ปิดรับ</strong> = เลยกำหนดแล้วส่งไม่ได้ (ขยายเวลาให้รายคนได้) · <strong>ส่งได้ ติดป้ายส่งช้า</strong> = ยังรับ แต่ขึ้นป้ายส่งช้า ·
                            ติ๊ก <strong>ปิดรับชั่วคราว</strong> เมื่ออยากหยุดรับไว้ก่อน
                        </div>
                    </Step>

                    <Step n={5} title={<>หลักสูตรที่กำหนดส่งต่างจากวิทยาลัย (ถ้ามี) — แท็บ <Btn>หลักสูตร …</Btn></>}>
                        <Fields rows={[["เช่น หลักสูตร IT · T003", `31 ธ.ค. ${Y}`]]} />
                        <div style={hint}>
                            กด <Btn>บันทึกของหลักสูตร IT</Btn> → ช่องนั้นเป็น<span style={diffMark}>สีเหลือง</span> = ต่างจากวิทยาลัย · กลับไปใช้ค่าวิทยาลัยกด <Btn>ใช้ค่าวิทยาลัย</Btn>
                        </div>
                    </Step>

                    <Step n={6} title={<>ช่วงนิเทศ — ตั้งที่เมนู <Btn>จัดการการนิเทศ</Btn></>}>
                        <Fields rows={[["เช่น", `1 ธ.ค. ${Y} – 28 ก.พ. ${Y + 1}`]]} />
                    </Step>
                </ol>

                <div style={tipBox}>
                    <div><strong>ปีถัดไป:</strong> สร้างรอบเทอมเดียวกัน → <Btn>📆 ปฏิทินของรอบ</Btn> → <Btn>คัดลอกจากรอบก่อน</Btn> (ระบบเลื่อนปีให้ · ขั้นที่ตั้งไว้แล้วไม่ถูกทับ)</div>
                    <div><strong>ขึ้นว่า "ค่าเดิม: …"</strong> = รอบนี้ยังไม่ได้ตั้งขั้นนั้น ระบบใช้ช่วงเวลาเดิมไปก่อน</div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" className="btn" onClick={onClose}>เข้าใจแล้ว</button>
                </div>
            </div>
        </Modal>
    );
}

const hint: CSSProperties = { fontSize: 13, color: "#64748b", lineHeight: 1.7 };
const stepBox: CSSProperties = { display: "grid", gridTemplateColumns: "28px minmax(0, 1fr)", gap: 12, padding: 12, border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc" };
const stepNum: CSSProperties = { width: 28, height: 28, borderRadius: 999, background: "#1d4ed8", color: "#fff", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 };
const btnChip: CSSProperties = { display: "inline-block", padding: "1px 8px", margin: "0 2px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" };
const fieldGrid: CSSProperties = { display: "grid", gridTemplateColumns: "max-content minmax(0, 1fr)", gap: "4px 14px", margin: 0, fontSize: 14 };
const table: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13, background: "#fff" };
const th: CSSProperties = { textAlign: "left", padding: "6px 8px", fontSize: 12, fontWeight: 700, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "normal" };
// whiteSpace normal: จอแคบ S_Theme ตั้ง table เป็น nowrap — ตารางนี้สั้น ให้ตัดบรรทัดแทนเลื่อนข้าง
const td: CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #eef2f7", color: "#334155", verticalAlign: "top", whiteSpace: "normal" };
const diffMark: CSSProperties = { background: "#fefce8", border: "1px solid #fde68a", borderRadius: 4, padding: "0 4px", margin: "0 2px" };
const tipBox: CSSProperties = { display: "grid", gap: 6, padding: 12, borderRadius: 12, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e3a8a", fontSize: 13, lineHeight: 1.7 };
