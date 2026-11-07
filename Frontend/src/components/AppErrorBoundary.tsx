import { Component, type ReactNode } from "react";

// ตัวรับข้อผิดพลาดของหน้าเว็บ — เดิมไม่มีเลย: หน้าไหนพัง/โหลดโค้ดของหน้าไม่ได้ = จอขาวทั้งจอ
//   - โหลดโค้ดของหน้าไม่ได้ (หลัง deploy แท็บเดิมยังอ้างไฟล์ชุดเก่าที่ถูกลบไปแล้ว · เน็ตหลุดตอนเปลี่ยนหน้า)
//     → โหลดหน้าใหม่ให้เองครั้งเดียว (กันวนด้วย sessionStorage)
//   - ข้อผิดพลาดอื่น → บอกผู้ใช้ + ปุ่มโหลดใหม่/กลับหน้าแรก (เปลี่ยนหน้าแล้วหายเอง — resetKey = path ไม่ remount ทั้งแอป)
const RELOAD_KEY = "coop.chunkReloadAt";
const isChunkError = (e: unknown) =>
  /dynamically imported module|Failed to fetch dynamically|Importing a module script failed|error loading dynamically|Loading chunk|ChunkLoadError/i.test(String((e as Error)?.message || e));

function reloadedRecently() {
  try { return Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) || 0) < 30_000; } catch { return true; }
}

export default class AppErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) { return { error }; }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentDidCatch(error: unknown) {
    console.error("[AppErrorBoundary]", error);
    if (isChunkError(error) && !reloadedRecently()) {
      try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* ไม่มี storage ก็โหลดใหม่ได้ */ }
      window.location.reload();
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunk = isChunkError(this.state.error);
    return (
      <div role="alert" style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 16 }}>
        <div className="card" style={{ maxWidth: 460, width: "100%", padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>{chunk ? "🔄" : "⚠️"}</div>
          <h2 style={{ margin: "8px 0" }}>{chunk ? "มีการอัปเดตระบบ" : "เกิดข้อผิดพลาดในการแสดงหน้านี้"}</h2>
          <p style={{ color: "#64748b", margin: "0 0 16px" }}>
            {chunk ? "กรุณาโหลดหน้าใหม่เพื่อใช้ระบบเวอร์ชันล่าสุด" : "ข้อมูลที่บันทึกไว้ไม่หาย — ลองโหลดหน้าใหม่ ถ้ายังเป็นอยู่กรุณาแจ้งเจ้าหน้าที่"}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn" onClick={() => window.location.reload()}>โหลดหน้าใหม่</button>
            <button className="btn-secondary" onClick={() => { window.location.href = "/"; }}>กลับหน้าแรก</button>
          </div>
        </div>
      </div>
    );
  }
}
