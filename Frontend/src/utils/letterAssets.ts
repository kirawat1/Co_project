import { apiFetch } from "./apiFetch";
import { letterAttachmentDocs } from "./letterGroup";

// ไฟล์/ค่าที่หนังสือต้องใช้ร่วมกัน: ตราสัญลักษณ์มหาวิทยาลัย (คีย์ KRUT), รายละเอียดโครงการ, ใบตอบรับ, ชื่อ-ตำแหน่งคณบดี
// (ใช้ร่วมกันระหว่างหน้าต่างออกหนังสือรายคนกับออกร่างหลายคน)
export interface LetterAssets {
  krutUrl: string | null;
  projectUrl: string | null;
  acceptUrl: string | null;
  deanName: string;
  deanPosition: string;
}

export async function loadLetterAssets(): Promise<LetterAssets> {
  const [resAssets, resDean] = await Promise.all([
    apiFetch("/api/admin/assets"),
    apiFetch("/api/admin/config/dean-info"),
  ]);
  if (!resAssets.ok) throw new Error("โหลดรายการไฟล์ระบบ (ตราสัญลักษณ์มหาวิทยาลัย/รายละเอียดโครงการ/แบบฟอร์มตอบรับ) ไม่สำเร็จ กรุณาลองใหม่");
  const assets = (await resAssets.json()).assets || [];
  const getAsset = (key: string) => {
    const f = assets.find((a: any) => a.key === key);
    return f ? `/uploads/system/${f.path}` : null;
  };
  let deanName = "รองศาสตราจารย์สิรภัทร เชี่ยวชาญวัฒนา";
  let deanPosition = "คณบดีวิทยาลัยการคอมพิวเตอร์";
  if (resDean.ok) {
    const d = await resDean.json();
    if (d.deanName) deanName = d.deanName;
    if (d.deanPosition) deanPosition = d.deanPosition;
  }
  return { krutUrl: getAsset("KRUT"), projectUrl: getAsset("PROJECT_DETAILS"), acceptUrl: getAsset("ACCEPTANCE_FORM"), deanName, deanPosition };
}

/** เอกสารแนบของนักศึกษา (ตาม letterAttachmentDocs) ที่ยังอยู่บนเซิร์ฟเวอร์ · missing = ชื่อไฟล์ที่หาย */
export async function existingAttachmentFiles(students: any[]): Promise<{ files: { type: string; url: string; label: string }[]; missing: string[] }> {
  // label = รหัสนักศึกษา + ประเภท + ชื่อไฟล์ (ใช้แจ้งในสรุปเอกสารแนบ ว่าของใครหาย)
  const allDocs: any[] = students.flatMap((s) =>
    letterAttachmentDocs([s]).map((d: any) => ({ ...d, label: `${s.studentId ? s.studentId + " " : ""}${d.type || ""} ${d.name || d.path}`.replace(/\s+/g, " ").trim() })),
  );
  const checks = await Promise.all(
    allDocs.map(async (d: any) => {
      const url = `/uploads/${d.path}`;
      try {
        const r = await fetch(url, { method: "HEAD" });
        return { doc: d, url, exists: r.ok };
      } catch {
        return { doc: d, url, exists: false };
      }
    }),
  );
  return {
    files: checks.filter((c) => c.exists).map((c) => ({ type: c.doc.type, url: c.url, label: c.doc.label })),
    missing: checks.filter((c) => !c.exists).map((c) => c.doc.label),
  };
}
