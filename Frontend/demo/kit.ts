/**
 * demo/kit.ts — ตัวช่วยของการสาธิตระบบ (เปิดเบราว์เซอร์จริง กดให้ดูทีละขั้น หยุดรอปุ่ม "ถัดไป")
 *
 *   กล่องสาธิต (มุมขวาล่าง) บอกว่าขั้นที่เท่าไร ใครทำอะไร — ระหว่างทำงานย่อเป็นแถบบนจอ ไม่บังปุ่มของระบบ
 *   เมาส์จำลอง (จุดสีส้ม) เลื่อนไปที่ปุ่ม/ช่องก่อนกด · กรอบสีส้มรอบสิ่งที่กำลังกด
 *   DEMO_AUTO=1 = ไม่รอปุ่มถัดไป (ใช้ตรวจว่าสคริปต์เดินครบ)
 */
import type { BrowserContext, Locator, Page } from "@playwright/test";

export type Role = "student" | "teacher" | "staff";
export const ROLE_TH: Record<Role, string> = { student: "นักศึกษา", teacher: "อาจารย์", staff: "เจ้าหน้าที่" };
const ROLE_COLOR: Record<Role, string> = { student: "#d97706", teacher: "#16a34a", staff: "#2563eb" };
const LANDING: Record<Role, string> = { student: "/student/dashboard", teacher: "/teacher/dashboard", staff: "/admin/dashboard" };

const AUTO = !!process.env.DEMO_AUTO;
// DEMO_FROM=N = เริ่มดูจากขั้นที่ N — ขั้นก่อนหน้าทำจริงแบบเร่ง (ไม่หยุดรอ ไม่เปิด PDF) หลังม่าน "กำลังเตรียม"
const FROM = Number(process.env.DEMO_FROM || 0);

interface PanelState {
  mode: "run" | "wait" | "end";
  scenario: string;
  step: number; total: number;
  role: Role | null; roleLabel: string; color: string;
  title: string; detail: string; result: string; nextLabel: string;
  ff: boolean; from: number;
}

// สคริปต์ที่ฉีดเข้าทุกหน้า: กล่องสาธิต + เมาส์จำลอง (สร้างใหม่ทุกครั้งที่หน้าโหลด แล้วขอสถานะล่าสุดจาก Node)
const INIT = `(() => {
  if (window.__demoInit || window.top !== window) return; window.__demoInit = true; // เฉพาะหน้าหลัก ไม่ใช่กรอบ PDF
  const css = \`
  #demo-bar{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483646;pointer-events:none;
    background:rgba(15,23,42,.92);color:#fff;padding:7px 16px;border-radius:999px;font:600 14px 'Sarabun','Leelawadee UI',Tahoma,sans-serif;
    box-shadow:0 6px 20px rgba(0,0,0,.25);display:none;max-width:80vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #demo-card{position:fixed;right:18px;bottom:18px;z-index:2147483646;width:390px;max-width:calc(100vw - 36px);display:none;
    background:#fff;color:#0f172a;border-radius:16px;box-shadow:0 18px 50px rgba(15,23,42,.35);border:1px solid #e2e8f0;
    font:15px/1.55 'Sarabun','Leelawadee UI',Tahoma,sans-serif;overflow:hidden}
  #demo-card .h{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#0f172a;color:#fff;font-size:13px}
  #demo-card .b{padding:14px 16px 6px}
  #demo-card .chip{display:inline-block;color:#fff;border-radius:999px;padding:2px 10px;font-size:13px;font-weight:700;margin-bottom:6px}
  #demo-card .t{font-size:18px;font-weight:800;margin:2px 0 6px}
  #demo-card .d{color:#334155;white-space:pre-line}
  #demo-card .r{margin-top:8px;padding:8px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;color:#166534;white-space:pre-line}
  #demo-card .f{display:flex;gap:8px;padding:10px 16px 14px}
  #demo-card button{font:700 15px 'Sarabun','Leelawadee UI',Tahoma,sans-serif;border-radius:10px;cursor:pointer;border:none}
  #demo-next{flex:1;background:#2563eb;color:#fff;padding:10px 14px}
  #demo-next:hover{background:#1d4ed8}
  #demo-min{background:#f1f5f9;color:#334155;padding:10px 12px}
  #demo-card.mini .b,#demo-card.mini #demo-min{display:none}
  #demo-card.mini{width:auto}
  #demo-prog{height:4px;background:#e2e8f0}#demo-prog i{display:block;height:4px;background:#f59e0b}
  #demo-cursor{position:fixed;left:-50px;top:-50px;width:22px;height:22px;border-radius:50%;z-index:2147483647;pointer-events:none;
    background:rgba(245,158,11,.55);border:2px solid #b45309;box-shadow:0 0 0 6px rgba(245,158,11,.18);transition:left .45s ease,top .45s ease,transform .15s;
    transform:translate(-50%,-50%)}
  #demo-cursor.down{transform:translate(-50%,-50%) scale(.7)}
  #demo-ff{position:fixed;inset:0;z-index:2147483647;display:none;pointer-events:none;align-items:center;justify-content:center;
    background:rgba(247,250,255,.97);font:16px/1.6 'Noto Sans Thai Variable','Noto Sans Thai','Leelawadee UI',Tahoma,sans-serif;color:#0f172a}
  #demo-ff .box{background:#fff;border:1px solid rgba(0,0,0,.07);border-radius:16px;box-shadow:0 10px 40px rgba(10,132,255,.15);padding:28px 34px;text-align:center;min-width:340px}
  #demo-ff .t{font-size:22px;font-weight:800;margin-bottom:6px}#demo-ff .d{color:#64748b}
  #demo-ff .bar{height:6px;background:#e2e8f0;border-radius:999px;margin-top:16px;overflow:hidden}#demo-ff .bar i{display:block;height:6px;background:#0074B7;transition:width .3s}
  #demo-hl{position:fixed;z-index:2147483645;pointer-events:none;border:3px solid #f59e0b;border-radius:8px;box-shadow:0 0 0 4px rgba(245,158,11,.25);display:none;transition:all .25s}\`;
  const esc = (s) => String(s || '').replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  function mount() {
    if (document.getElementById('demo-card') || !document.body) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const bar = document.createElement('div'); bar.id = 'demo-bar'; document.body.appendChild(bar);
    const card = document.createElement('div'); card.id = 'demo-card'; document.body.appendChild(card);
    const cur = document.createElement('div'); cur.id = 'demo-cursor'; document.body.appendChild(cur);
    const hl = document.createElement('div'); hl.id = 'demo-hl'; document.body.appendChild(hl);
    const ff = document.createElement('div'); ff.id = 'demo-ff'; document.body.appendChild(ff);
    if (window.__demoState) window.__demoState().then((s) => s && window.__demoRender(s)).catch(() => {});
  }
  window.__demoRender = (s) => {
    mount();
    const bar = document.getElementById('demo-bar'), card = document.getElementById('demo-card');
    if (!bar || !card) return;
    const ff = document.getElementById('demo-ff');
    if (ff) {
      ff.style.display = s.ff ? 'flex' : 'none';
      if (s.ff) {
        ff.innerHTML = '<div class="box"><div class="t">⏩ กำลังเตรียมการสาธิต</div><div class="d">ทำขั้นก่อนหน้าให้อัตโนมัติ แล้วเริ่มให้ดูที่ขั้นที่ ' + s.from + '<br>ตอนนี้: ขั้น ' + s.step + ' · ' + esc(s.title) + '</div>'
          + '<div class="bar"><i style="width:' + Math.round((s.step / Math.max(1, s.from)) * 100) + '%"></i></div></div>';
        bar.style.display = 'none'; card.style.display = 'none';
        return;
      }
    }
    const who = s.role ? s.roleLabel + ' · ' : '';
    if (s.mode === 'run') {
      card.style.display = 'none'; bar.style.display = 'block';
      bar.innerHTML = '▶ ขั้น ' + s.step + '/' + s.total + ' · ' + esc(who + s.title) + ' …';
      return;
    }
    bar.style.display = 'none'; card.style.display = 'block';
    const pct = Math.round((s.step / Math.max(1, s.total)) * 100);
    card.innerHTML = '<div class="h"><span>🎬 ' + esc(s.scenario) + '</span><span>ขั้น ' + s.step + '/' + s.total + '</span></div>'
      + '<div id="demo-prog"><i style="width:' + pct + '%"></i></div>'
      + '<div class="b">' + (s.role ? '<span class="chip" style="background:' + s.color + '">' + esc(s.roleLabel) + '</span>' : '')
      + '<div class="t">' + esc(s.title) + '</div>' + (s.detail ? '<div class="d">' + esc(s.detail) + '</div>' : '')
      + (s.result ? '<div class="r">' + esc(s.result) + '</div>' : '') + '</div>'
      + '<div class="f"><button id="demo-min" title="ย่อกล่องนี้">ย่อ</button>'
      + (s.mode === 'end' ? '<button id="demo-next">' + esc(s.nextLabel || 'จบการสาธิต') + '</button>' : '<button id="demo-next">' + esc(s.nextLabel || 'ถัดไป ▶') + '</button>') + '</div>';
    document.getElementById('demo-next').onclick = () => window.__demoNext && window.__demoNext();
    document.getElementById('demo-min').onclick = () => card.classList.add('mini');
    card.classList.remove('mini');
  };
  window.__demoPoint = (x, y, w, h) => {
    mount();
    const cur = document.getElementById('demo-cursor'), hl = document.getElementById('demo-hl');
    if (!cur || !hl) return;
    cur.style.left = (x + w / 2) + 'px'; cur.style.top = (y + h / 2) + 'px';
    Object.assign(hl.style, { display: 'block', left: (x - 4) + 'px', top: (y - 4) + 'px', width: (w + 8) + 'px', height: (h + 8) + 'px' });
  };
  window.__demoPress = () => { const c = document.getElementById('demo-cursor'); if (c) { c.classList.add('down'); setTimeout(() => c.classList.remove('down'), 180); } };
  window.__demoHide = () => { const hl = document.getElementById('demo-hl'); if (hl) hl.style.display = 'none'; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  new MutationObserver(() => { if (!document.getElementById('demo-card')) mount(); }).observe(document.documentElement, { childList: true, subtree: false });
})();`;

export class Demo {
  page!: Page;
  private state: PanelState;
  private release: (() => void) | null = null;

  constructor(public context: BrowserContext, public scenario: string, public total: number) {
    this.state = { mode: "run", scenario, step: 0, total, role: null, roleLabel: "", color: "#334155", title: "เตรียมการสาธิต", detail: "", result: "", nextLabel: "", ff: FROM > 0, from: FROM };
  }

  /** อยู่ในช่วงเร่งข้ามขั้น (DEMO_FROM) */
  get fast() { return FROM > 0 && this.state.step < FROM; }
  /** ตัวคูณเวลารอ: เร่งข้ามขั้น = ไม่รอ · DEMO_AUTO = เร็วขึ้น */
  private get speed() { return this.fast ? 0 : AUTO ? 0.15 : 1; }

  async init(page: Page) {
    this.page = page;
    await this.context.exposeBinding("__demoNext", () => { this.release?.(); this.release = null; });
    await this.context.exposeBinding("__demoState", () => this.state);
    await this.context.addInitScript(INIT);
    await Demo.routePdfViewer(this.context);
    // แท็บใหม่ (เช่น ไฟล์ PDF) — ให้กล่องสาธิตตามไปด้วย
    this.context.on("page", (p) => { p.on("load", () => this.render().catch(() => {})); });
  }

  private async render() {
    for (const p of this.context.pages()) {
      await p.evaluate((s) => (window as unknown as { __demoRender?: (s: unknown) => void }).__demoRender?.(s), this.state).catch(() => {});
    }
  }

  /** เริ่มขั้นใหม่ — แถบบนจอบอกว่ากำลังทำอะไร */
  async step(n: number, role: Role | null, title: string, detail = "") {
    Object.assign(this.state, { mode: "run", step: n, ff: FROM > 0 && n < FROM, role, roleLabel: role ? ROLE_TH[role] : "", color: role ? ROLE_COLOR[role] : "#334155", title, detail, result: "", nextLabel: "" });
    console.log(`\n[ขั้น ${n}/${this.total}] ${role ? ROLE_TH[role] + ": " : ""}${title}`);
    await this.render();
  }

  /** จบขั้น — แสดงผลลัพธ์ แล้วหยุดรอกด "ถัดไป" */
  async done(result: string, nextLabel = "ถัดไป ▶") {
    await this.hideMarks();
    Object.assign(this.state, { mode: "wait", result, nextLabel });
    await this.render();
    await this.waitNext();
    this.state.mode = "run";
    await this.render();
  }

  /** หยุดกลางขั้น (เช่น ให้ดู PDF) โดยยังอยู่ขั้นเดิม */
  async pause(result: string, nextLabel = "ดูแล้ว ไปต่อ ▶") {
    await this.done(result, nextLabel);
  }

  async end(result: string) {
    await this.hideMarks();
    Object.assign(this.state, { mode: "end", result, title: "จบการสาธิต", detail: "", role: null, roleLabel: "", nextLabel: "ปิดหน้าต่างสาธิต" });
    await this.render();
    await this.waitNext();
  }

  private shot = 0;
  private async waitNext() {
    if (this.fast) return;
    // DEMO_SHOTS=โฟลเดอร์ → เก็บภาพทุกจุดที่หยุดรอ (ตรวจหน้าตาโดยไม่ต้องนั่งดู)
    if (process.env.DEMO_SHOTS) {
      const front = this.context.pages().at(-1)!;
      await front.waitForTimeout(400);
      await front.screenshot({ path: `${process.env.DEMO_SHOTS}/${String(++this.shot).padStart(2, "0")}-ขั้น${this.state.step}.png` }).catch(() => {});
    }
    if (AUTO) return new Promise<void>((r) => setTimeout(r, 300));
    return new Promise<void>((r) => { this.release = r; });
  }

  async wait(ms: number) { if (ms * this.speed > 0) await this.page.waitForTimeout(ms * this.speed); }

  private async hideMarks() {
    for (const p of this.context.pages()) await p.evaluate(() => (window as unknown as { __demoHide?: () => void }).__demoHide?.()).catch(() => {});
  }

  /** เลื่อนเมาส์จำลองไปที่สิ่งที่จะกด + กรอบเน้น */
  async point(loc: Locator) {
    if (this.fast) return;
    await loc.scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => {});
    const box = await loc.boundingBox({ timeout: 5_000 }).catch(() => null); // ชี้ไม่เจอ = ข้ามการชี้ ไม่ทำให้สาธิตหยุด
    if (!box) return;
    await loc.page().evaluate(({ x, y, width, height }) => (window as unknown as { __demoPoint?: (...a: number[]) => void }).__demoPoint?.(x, y, width, height), box).catch(() => {});
    await loc.page().waitForTimeout(650 * this.speed);
  }

  async click(loc: Locator) {
    await loc.waitFor({ state: "visible", timeout: 20_000 });
    await this.point(loc);
    await loc.page().evaluate(() => (window as unknown as { __demoPress?: () => void }).__demoPress?.()).catch(() => {});
    await loc.click();
    await loc.page().waitForTimeout(450 * this.speed);
  }

  /** พิมพ์ทีละตัวให้เห็น */
  async type(loc: Locator, text: string) {
    await loc.waitFor({ state: "visible", timeout: 20_000 });
    await this.point(loc);
    await loc.click();
    await loc.fill("");
    await loc.pressSequentially(text, { delay: AUTO || this.fast ? 0 : 45 });
    await loc.page().waitForTimeout(250 * this.speed);
  }

  /** ช่องที่พิมพ์ทีละตัวไม่ได้ (วันที่ / ตัวเลือก) */
  async fill(loc: Locator, value: string) {
    await this.point(loc);
    await loc.fill(value);
    await loc.page().waitForTimeout(350 * this.speed);
  }

  async select(loc: Locator, value: string | { label: string }) {
    await this.point(loc);
    await loc.selectOption(value);
    await loc.page().waitForTimeout(350 * this.speed);
  }

  async files(loc: Locator, files: string | string[], target?: Locator) {
    if (target) await this.point(target);
    await loc.setInputFiles(files);
    await loc.page().waitForTimeout(500 * this.speed);
  }

  /** กดยืนยันในกล่องถามของระบบ (askConfirm) — ปุ่มขวาสุด */
  async confirm(max = 1) {
    const dlg = this.page.locator('[role="dialog"][aria-modal="true"]');
    for (let i = 0; i < max; i++) {
      try { await dlg.last().waitFor({ state: "visible", timeout: i === 0 ? 10_000 : 1_500 }); } catch { return; }
      await this.click(dlg.last().locator("button").last());
      await this.page.waitForTimeout(300);
    }
  }

  async go(path: string) {
    await this.page.goto(path, { waitUntil: "networkidle" });
    await this.wait(500);
  }

  /** ชุด localStorage หลังล็อกอินสำเร็จ แยกตามบัญชี — ใช้สลับกลับมาโดยไม่ต้องพิมพ์ล็อกอินซ้ำ */
  private sessions = new Map<string, Record<string, string>>();

  /**
   * สลับเป็นผู้ใช้คนนี้ — ครั้งแรกของแต่ละบัญชีพิมพ์ล็อกอินผ่านหน้าจอจริงให้ดู
   * ครั้งต่อไปใช้ token เดิม เข้าหน้าแรกของบทบาทนั้นทันที (ถ้า token ใช้ไม่ได้ ค่อยล็อกอินใหม่)
   */
  async login(role: Role, email: string, password: string, extra: Record<string, string> = {}) {
    const p = this.page;
    const saved = this.sessions.get(email);
    if (saved) {
      await p.goto("/");
      await p.evaluate((s) => {
        localStorage.clear();
        for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
      }, { ...saved, ...extra });
      await p.context().clearCookies(); // cookie เปิดไฟล์ของบัญชีก่อน — backend ตั้งใหม่ตาม token ตอนเรียก API
      await p.goto(LANDING[role], { waitUntil: "networkidle" });
      if (new URL(p.url()).pathname === LANDING[role]) { await this.wait(600); return; }
      this.sessions.delete(email);
    }
    await p.goto("/");
    await p.evaluate((extra) => {
      localStorage.clear();
      localStorage.setItem("coop.theme", "light");
      for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
    }, extra);
    await p.context().clearCookies();
    await p.goto("/", { waitUntil: "networkidle" });
    await this.click(p.getByRole("button", { name: ROLE_TH[role], exact: true }));
    await this.type(p.getByRole("textbox", { name: "ชื่อผู้ใช้ (Username)" }), email);
    await this.type(p.getByRole("textbox", { name: "รหัสผ่าน" }), password);
    await this.click(p.getByRole("button", { name: "เข้าสู่ระบบ" }));
    await p.waitForURL(`**${LANDING[role]}`, { timeout: 20_000 });
    await p.waitForLoadState("networkidle");
    this.sessions.set(email, await p.evaluate(() => ({ ...localStorage })));
    await this.wait(600);
  }

  /**
   * เปิด PDF ให้ดูเต็มจอในแท็บใหม่ — ผ่านหน้าครอบ /__demo-pdf ที่อยู่โดเมนเดียวกับระบบ
   * (ตัวเปิด PDF ของ Chrome ฉีดกล่องสาธิตไม่ได้ · หน้าครอบมีกล่องสาธิต + ปุ่มไปต่อ และส่ง cookie เปิดไฟล์ได้)
   */
  async showPdf(url: string, caption: string, tab?: Page) {
    if (this.fast) { await tab?.close().catch(() => {}); await this.page.bringToFront(); return; }
    const t = tab ?? (await this.context.newPage());
    await t.goto(`/__demo-pdf?title=${encodeURIComponent(caption)}&src=${encodeURIComponent(url)}`);
    await t.bringToFront();
    await t.waitForTimeout(AUTO ? 2500 : 1200); // ไฟล์ใหญ่ (หนังสือ + เอกสารแนบ) ใช้เวลาเปิด
    Object.assign(this.state, { mode: "wait", result: `📄 ${caption}`, nextLabel: "ดูแล้ว ปิดไฟล์ ▶" });
    await this.render();
    await this.waitNext();
    await t.close().catch(() => {});
    await this.page.bringToFront();
    this.state.mode = "run";
    await this.render();
  }

  /** กดปุ่มที่เปิดไฟล์ในแท็บใหม่ (window.open) แล้วเปิดค้างไว้ให้ดู */
  async openPopupPdf(button: Locator, caption: string) {
    const popup = this.context.waitForEvent("page", { timeout: 15_000 });
    await this.click(button);
    const tab = await popup;
    await tab.waitForURL((u) => u.href !== "about:blank", { timeout: 10_000 }).catch(() => {});
    const url = tab.url();
    await this.showPdf(url, caption, tab);
  }

  /** เปิดไฟล์ PDF ในเครื่อง (เช่น ไฟล์ใน zip ที่ระบบให้โหลด) */
  private localFiles = new Map<string, string>();
  async showLocalPdf(file: string, caption: string) {
    const id = String(this.localFiles.size + 1);
    this.localFiles.set(id, file);
    if (this.localFiles.size === 1) {
      await this.context.route("**/__demo-file/*", (route) => {
        const f = this.localFiles.get(route.request().url().split("/").pop()!.split("?")[0]);
        return f ? route.fulfill({ path: f, contentType: "application/pdf" }) : route.fulfill({ status: 404 });
      });
    }
    await this.showPdf(`/__demo-file/${id}`, caption);
  }

  /** กดปุ่มที่ให้ดาวน์โหลดไฟล์ แล้วเก็บไฟล์ไว้ที่ path */
  async download(button: Locator, file: string) {
    const dl = this.page.waitForEvent("download", { timeout: 30_000 });
    await this.click(button);
    await (await dl).saveAs(file);
    return file;
  }

  /** เปิดตาราง (เช่น ไฟล์ Excel ที่เพิ่งดาวน์โหลด แปลงเป็น HTML แล้ว) ในแท็บใหม่ให้ดู */
  private sheets = new Map<string, string>();
  async showSheet(html: string, caption: string) {
    if (this.fast) return;
    const id = String(this.sheets.size + 1);
    this.sheets.set(id, html);
    if (this.sheets.size === 1) {
      await this.context.route("**/__demo-sheet/*", (route) => {
        const body = this.sheets.get(route.request().url().split("/").pop()!.split("?")[0]);
        return body == null ? route.fulfill({ status: 404 }) : route.fulfill({ contentType: "text/html; charset=utf-8", body: Demo.sheetPage(body) });
      });
    }
    const t = await this.context.newPage();
    await t.goto(`/__demo-sheet/${id}?title=${encodeURIComponent(caption)}`);
    await t.bringToFront();
    Object.assign(this.state, { mode: "wait", result: `📊 ${caption}`, nextLabel: "ดูแล้ว ปิดไฟล์ ▶" });
    await this.render();
    await this.waitNext();
    await t.close().catch(() => {});
    await this.page.bringToFront();
    this.state.mode = "run";
    await this.render();
  }

  private static sheetPage(body: string) {
    return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ไฟล์ Excel</title><style>
body{margin:0;padding:24px 28px 140px;background:#f7faff;color:#0f172a;font:14px/1.5 'Noto Sans Thai','Leelawadee UI',Tahoma,sans-serif}
.bar{display:flex;align-items:center;gap:10px;margin-bottom:16px}.bar b{font-size:18px}.tag{background:#dcfce7;color:#166534;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700}
h2{font-size:16px;margin:18px 0 8px}h2 small{color:#64748b;font-weight:400}
.wrap{overflow:auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;max-height:70vh}
table{border-collapse:collapse;min-width:100%}th{position:sticky;top:0;background:#f1f5f9;text-align:left;font-weight:700;white-space:nowrap}
th,td{padding:7px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top}td{white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis}
</style></head><body><div class="bar"><span style="font-size:22px">📊</span><b id="t"></b><span class="tag">ไฟล์ .xlsx ที่ระบบสร้าง</span></div>${body}
<script>document.getElementById('t').textContent=new URLSearchParams(location.search).get('title')||'ไฟล์ Excel'</script></body></html>`;
  }

  /** หน้าครอบ PDF (ตอบจาก Playwright เอง ไม่ผ่าน Vite) */
  static async routePdfViewer(context: BrowserContext) {
    await context.route("**/__demo-pdf**", (route) => route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>เอกสาร</title>
<style>html,body{margin:0;height:100%;background:#525659}iframe{border:0;width:100%;height:100%}</style></head>
<body><iframe id="f"></iframe><script>
const q=new URLSearchParams(location.search);document.title=q.get('title')||'เอกสาร';document.getElementById('f').src=q.get('src');
</script></body></html>`,
    }));
  }
}
