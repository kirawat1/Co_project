import { apiFetch } from "./apiFetch";
import { letterAttachmentDocs } from "./letterGroup";
import { emblemSizePt, type LetterEmblem } from "./docGeneratorUtils";
import { trimBox } from "./letterLayout";

// ไฟล์/ค่าที่หนังสือต้องใช้ร่วมกัน: ตราสัญลักษณ์มหาวิทยาลัย (คีย์ KRUT), รายละเอียดโครงการ, ใบตอบรับ, ชื่อ-ตำแหน่งคณบดี
// (ใช้ร่วมกันระหว่างหน้าต่างออกหนังสือรายคนกับออกร่างหลายคน)
export interface LetterAssets {
  krutUrl: string | null;
  projectUrl: string | null;
  acceptUrl: string | null;
  deanName: string;
  deanPosition: string;
  /** รูปตราสำหรับหนังสือแบบ Word — null = ยังไม่อัปโหลด/โหลดไม่ได้ (Word ออกได้โดยไม่มีตรา) */
  emblem?: LetterEmblem | null;
}

// ความสูงพิกเซลของตราที่ฝังในหนังสือ — ตราสูง 4 ซม. ≈ 300 dpi
// (ไฟล์ต้นฉบับ 3185 px ทำให้ PDF หนังสือหน้าเดียวหนัก 38 MB เพราะ jsPDF ฝังรูปแบบไม่บีบอัด)
const EMBLEM_MAX_PX = 480;
const emblemCache = new Map<string, Promise<LetterEmblem | null>>();

/** ตัดขอบว่างรอบตรา + ย่อขนาด → PNG ขนาดตราบนหนังสือสูง 4 ซม. */
async function prepareEmblem(blob: Blob): Promise<LetterEmblem> {
  const bmp = await createImageBitmap(blob);
  const src = document.createElement("canvas");
  src.width = bmp.width; src.height = bmp.height;
  const sctx = src.getContext("2d")!;
  sctx.drawImage(bmp, 0, 0);
  const box = trimBox(sctx.getImageData(0, 0, src.width, src.height).data, src.width, src.height);
  const k = Math.min(1, EMBLEM_MAX_PX / box.h);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(box.w * k)); out.height = Math.max(1, Math.round(box.h * k));
  out.getContext("2d")!.drawImage(bmp, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height);
  bmp.close();
  const png = await new Promise<Blob>((ok, fail) => out.toBlob((b) => (b ? ok(b) : fail(new Error("toBlob"))), "image/png"));
  return { data: new Uint8Array(await png.arrayBuffer()), mime: "image/png", ...emblemSizePt(out.width, out.height) };
}

/** โหลดตราสัญลักษณ์มหาวิทยาลัยสำหรับหนังสือ (Word + PDF ใช้ร่วมกัน · จำต่อ URL) · โหลดไม่ได้ = null */
export function loadEmblem(url: string | null): Promise<LetterEmblem | null> {
  if (!url) return Promise.resolve(null);
  let p = emblemCache.get(url);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await prepareEmblem(await res.blob());
      } catch {
        return null;
      }
    })();
    p.then((e) => { if (!e) emblemCache.delete(url); });
    emblemCache.set(url, p);
  }
  return p;
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
  const krutUrl = getAsset("KRUT");
  return { krutUrl, projectUrl: getAsset("PROJECT_DETAILS"), acceptUrl: getAsset("ACCEPTANCE_FORM"), deanName, deanPosition, emblem: await loadEmblem(krutUrl) };
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
