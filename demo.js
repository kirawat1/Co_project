#!/usr/bin/env node
// หน้าเมนูสาธิตระบบ — node demo.js แล้วเปิด http://localhost:5199 (เปิดให้เอง)
//   กดเลือกการสาธิต → Chrome เปิดขึ้นมา สคริปต์กดระบบให้ดูทีละขั้น หยุดรอปุ่ม "ถัดไป" ทุกขั้น
//   ชุดทั้งเส้นทางเลือก "เริ่มจากขั้นที่…" ได้ (ขั้นก่อนหน้าทำให้อัตโนมัติแบบเร่ง — DEMO_FROM)
//   ใช้ฐานข้อมูลตาม backend/.env (เครื่องพัฒนา) — สร้างบัญชี/ข้อมูลตัวอย่างที่ขึ้นต้น demo. และลบได้จากปุ่มล้างข้อมูล
//   ไม่ยอมรันถ้า backend/.env ตั้ง NODE_ENV=production
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { backendEnv, backendUp, startBackend, stopBackend } = require('./run-tests.js');

const PORT = 5199;
const FRONTEND = path.join(__dirname, 'Frontend');
const DEMO_DIR = path.join(FRONTEND, 'demo');
const FONT_DIR = path.join(FRONTEND, 'node_modules/@fontsource-variable/noto-sans-thai/files');
const LOGO = path.join(FRONTEND, 'src/assets/COOP_Logo.png');

const ROLE = { staff: ['เจ้าหน้าที่', '#2563eb'], teacher: ['อาจารย์', '#16a34a'], student: ['นักศึกษา', '#d97706'] };
const DEMOS = {
  full: { file: 'full.demo.ts', title: 'ทั้งเส้นทาง: นำเข้ารายชื่อ → เปิดรอบ → ยื่นคำร้อง → หนังสือ → ฝึกงาน → นิเทศ → ส่งเล่ม', time: '~30–35 นาที',
    roles: ['staff', 'student', 'teacher'],
    desc: 'เจ้าหน้าที่นำเข้ารายชื่อจาก Excel เปิดรอบและตั้งปฏิทิน · นักศึกษาเลือกบริษัท ยื่นคำร้อง ส่ง T000 · อาจารย์ประจำวิชาพิจารณา · เจ้าหน้าที่ตรวจเอกสาร ออกหนังสือขอความอนุเคราะห์และส่งตัว · T002/T003 · นัดนิเทศ · หนังสือขอนิเทศ · จบนิเทศ · แบบประเมินการนิเทศ · T005–T008 ส่งเล่มรายงาน' },
  report: { file: 'report.demo.ts', title: 'รายงานและส่งออก Excel', time: '~4 นาที', roles: ['staff'],
    desc: 'Dashboard ภาพรวมของรอบ · ส่งออกรายชื่อนักศึกษาและเอกสาร · ส่งออกตารางนิเทศ — เปิดไฟล์ Excel ที่ได้ให้ดูบนจอ' },
  major: { file: 'major.demo.ts', title: 'เพิ่มหลักสูตรใหม่', time: '~5 นาที', roles: ['staff', 'teacher'],
    desc: 'เพิ่มหลักสูตร → เช็กลิสต์ความพร้อมบอกสิ่งที่ยังขาด → แต่งตั้งอาจารย์ประจำวิชา → ตั้งรอบและเปิดรับสมัคร → อาจารย์เข้าหน้าจัดการเฉพาะหลักสูตรตัวเอง' },
  notify: { file: 'notify.demo.ts', title: 'ขยายเวลาส่งและประกาศ', time: '~5 นาที', roles: ['student', 'staff'],
    desc: 'T000 เลยกำหนดแบบปิดรับ นักศึกษาส่งไม่ได้ · เจ้าหน้าที่ขยายเวลาให้รายคนพร้อมเหตุผล · นักศึกษาส่งได้ · ประกาศถึงห้องของหลักสูตร (ปักหมุด) · นักศึกษาเห็นประกาศ' },
  logs: { file: 'logs.demo.ts', title: 'บันทึกการใช้งาน', time: '~3 นาที', roles: ['teacher', 'staff'],
    desc: 'อาจารย์และเจ้าหน้าที่ทำงานคนละอย่าง → ดูบันทึกว่าใครทำอะไร เมื่อไร กับนักศึกษาคนไหน · แยกแท็บตามบทบาท · ส่งออก Excel' },
  return: { file: 'return.demo.ts', title: 'ตีกลับเอกสารให้แก้ แล้วส่งใหม่', time: '~4 นาที', roles: ['staff', 'student'],
    desc: 'เจ้าหน้าที่ส่งเอกสาร T000 กลับให้แก้พร้อมเหตุผล · นักศึกษาเห็นเหตุผลบนหน้าแรกและส่งไฟล์ใหม่ · เจ้าหน้าที่เห็นว่า "ส่งแก้ไขแล้ว" ตรวจซ้ำแล้วอนุมัติ' },
  pending: { file: 'pending.demo.ts', title: 'งานค้างและขั้นถัดไป', time: '~5 นาที', roles: ['staff', 'teacher', 'student'],
    desc: 'แผง "งานที่รอคุณ" และป้ายตัวเลขบนเมนูนับจากงานที่ค้างจริง · ทำงานเสร็จตัวเลขลดเอง · นักศึกษาเห็นแถบขั้นตอนถัดไปพร้อมปุ่มไปทำ' },
  bulk: { file: 'bulk.demo.ts', title: 'ออกหนังสือหลายฉบับพร้อมกัน', time: '~5 นาที', roles: ['staff', 'student'],
    desc: 'นักศึกษา 3 คน (2 คนบริษัทเดียวกัน) · ออกร่างทีละชุดเป็น zip ไล่เลขให้ · บริษัทเดียวกันรวมฉบับเดียว · อัปโหลดฉบับลงนามทีละหลายไฟล์ ระบบจับคู่ให้' },
  group: { file: 'group.demo.ts', title: 'นิเทศหลายคนพร้อมกัน', time: '~5 นาที', roles: ['student', 'teacher', 'staff'],
    desc: 'นักศึกษา 3 คนบริษัทเดียวกันเสนอวันเดียวกันคนละเวลา · อาจารย์ "นัดพร้อมกัน" ระบบจัดคิว · เจ้าหน้าที่ออกหนังสือขอนิเทศฉบับรวม' },
  coteacher: { file: 'coteacher.demo.ts', title: 'นิเทศที่มีอาจารย์ร่วม', time: '~6 นาที', roles: ['student', 'teacher'],
    desc: 'อาจารย์ประจำวิชามอบหมายอาจารย์ร่วม · อาจารย์ร่วมแจ้งว่าไม่ว่าง → ระบบเตือนอาจารย์หลักก่อนเลือกวัน · ปฏิเสธพร้อมเหตุผล · นักศึกษาเห็นเหตุผลแล้วเสนอวันใหม่ · อาจารย์ร่วมว่าง → ยืนยันวัน' },
};

/** ขั้นของชุดทั้งเส้นทาง อ่านจาก demo.step(n, "บทบาท", "ชื่อขั้น") ในไฟล์ — ตัวเลือก "เริ่มจากขั้นที่…" ตรงกับสคริปต์เสมอ */
function readSteps(file) {
  const src = fs.readFileSync(path.join(DEMO_DIR, file), 'utf8');
  const steps = new Map();
  for (const m of src.matchAll(/demo\.step\((\d+),\s*(?:null|"(\w+)"),\s*"([^"]+)"/g)) {
    const n = Number(m[1]);
    if (n < 1) continue;
    const who = ROLE[m[2]]?.[0] || '';
    const label = `${who ? who + ': ' : ''}${m[3]}`;
    steps.set(n, steps.has(n) ? `${steps.get(n)} → ${label}` : label);
  }
  return [...steps].map(([n, label]) => ({ n, label }));
}

let child = null;          // การสาธิตที่กำลังรัน
let job = { id: null, state: 'idle', log: [], from: 0 };
let startedBackend = null;

function run(id, file, { headed = true, from = 0 } = {}) {
  job = { id, state: 'running', log: [], from };
  const env = { ...process.env };
  if (!headed) env.DEMO_HEADLESS = '1';
  if (from > 1) env.DEMO_FROM = String(from); else delete env.DEMO_FROM;
  child = spawn(`npx playwright test --config=playwright.demo.config.ts ${file}`, { cwd: FRONTEND, shell: true, env });
  const push = (d) => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) job.log.push(l.replace(/\x1b\[[0-9;]*m/g, '')); job.log = job.log.slice(-60); };
  child.stdout.on('data', push); child.stderr.on('data', push);
  child.on('exit', (code) => { if (job.state === 'running') job.state = code === 0 ? 'done' : 'failed'; child = null; });
}

function stop() {
  if (!child) return;
  if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill();
  job.state = 'stopped';
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chips = (roles) => roles.map((r) => `<span class="role" style="--c:${ROLE[r][1]}">${ROLE[r][0]}</span>`).join('');

function page() {
  const steps = readSteps(DEMOS.full.file);
  const full = DEMOS.full;
  const others = Object.entries(DEMOS).filter(([id]) => id !== 'full');
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>สาธิตระบบสหกิจศึกษา</title>
<style>
@font-face{font-family:'Noto Sans Thai Variable';font-style:normal;font-weight:100 900;font-display:swap;src:url(/font/thai.woff2) format('woff2');unicode-range:U+02D7,U+0303,U+0331,U+0E01-0E5B,U+200C-200D,U+25CC}
@font-face{font-family:'Noto Sans Thai Variable';font-style:normal;font-weight:100 900;font-display:swap;src:url(/font/latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
:root{--blue:#0074B7;--text:#0f172a;--muted:#64748b;--border:rgba(0,0,0,.07);--shadow:0 10px 40px rgba(10,132,255,.15)}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;color:var(--text);background:radial-gradient(1200px 700px at 80% -10%,#E6F0FF 0%,#F7FAFF 40%,#FFFFFF 100%) fixed;
  font:15px/1.6 'Noto Sans Thai Variable','Noto Sans Thai','Leelawadee UI',Tahoma,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
button,select{font:inherit}
.topbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:10px 16px;background:#fff;border-bottom:1px solid var(--border)}
.brand-badge{background:#E6F0FF;padding:4px 8px;border-radius:10px;display:inline-flex;border:1px solid rgba(0,0,0,.05)}
.brand-badge img{height:36px;display:block}
.brand{font-weight:800;font-size:16px}.brand small{display:block;font-weight:600;font-size:12px;color:var(--muted);line-height:1.2}
.topbar .sp{flex:1}
.wrap{max-width:1040px;margin:0 auto;padding:24px 16px 60px}
h1{font-size:26px;font-weight:900;margin:0}
.underline{margin:10px 0 6px;height:3px;width:72px;border-radius:999px;background:linear-gradient(90deg,#0074B7,#60A5FA,#22D3EE)}
.sub{color:var(--muted);margin:0 0 22px}
.card{background:#fff;border:1px solid var(--border);border-radius:16px;padding:20px;box-shadow:var(--shadow)}
.section-label{margin:28px 0 10px 4px;font-size:12px;font-weight:800;color:var(--muted);letter-spacing:.8px}
.hero{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:end}
.hero h2{font-size:20px;margin:6px 0 4px;font-weight:800}
.meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px}
.time{background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:1px 10px;font-size:13px;font-weight:600}
.role{color:var(--c);background:color-mix(in srgb,var(--c) 10%,#fff);border:1px solid color-mix(in srgb,var(--c) 30%,#fff);border-radius:999px;padding:0 9px;font-size:12px;font-weight:700}
.desc{color:#334155;margin:0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:14px}
.grid .card{display:flex;flex-direction:column;gap:6px}.grid .card h2{font-size:17px;margin:2px 0;font-weight:800}
.grid .card .desc{flex:1;font-size:14px;color:#475569;margin-bottom:10px}
.btn,.btn-secondary,.btn-danger-outline{height:44px;border-radius:10px;padding:0 16px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;white-space:nowrap;transition:filter .15s,background-color .15s}
.btn{border:0;background:var(--blue);color:#fff;box-shadow:0 10px 22px rgba(10,132,255,.25),inset 0 -1px 0 rgba(255,255,255,.25)}
.btn:hover{filter:brightness(.92)}.btn:disabled,.btn-secondary:disabled,select:disabled{opacity:.55;cursor:not-allowed;filter:none;box-shadow:none}
.btn-secondary{background:#fff;color:#475569;border:1px solid #cbd5e1}.btn-secondary:hover{background:#f1f5f9}
.btn-danger-outline{background:#fff;color:#b91c1c;border:1px solid #fecaca;height:36px;padding:0 12px;font-size:14px}
.from{display:flex;flex-direction:column;gap:8px;min-width:270px}
.from label{font-size:13px;font-weight:700;color:#334155}
.from select{height:44px;border:1px solid #e5e7eb;border-radius:12px;padding:0 12px;background:#fff;color:var(--text);max-width:100%}
.from .row{display:flex;gap:8px}
#status{display:none;margin-bottom:18px;border-left:4px solid var(--blue)}
#status .head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
#status .st{font-weight:800}#status .now{color:var(--muted);font-size:14px;flex:1;min-width:200px}
#status.failed{border-left-color:#dc2626}#status.done{border-left-color:#16a34a}
#log{font:12px/1.5 Consolas,monospace;white-space:pre-wrap;max-height:150px;overflow:auto;margin-top:10px;color:#475569;background:#f8fafc;border-radius:10px;padding:8px 10px;display:none}
.acc{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:12px 0}
.acc div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:14px;overflow-wrap:anywhere}
.acc b{display:block;font-size:12px;color:var(--muted)}
code{background:#eff6ff;color:#1d4ed8;padding:1px 6px;border-radius:6px}
a{color:var(--blue)}
@media (max-width:720px){.hero{grid-template-columns:1fr}.from{min-width:0}.brand small{display:none}}
</style></head><body>
<header class="topbar"><span class="brand-badge"><img src="/logo.png" alt="COOP"></span>
<div class="brand">สาธิตระบบสหกิจศึกษา<small>วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น</small></div><span class="sp"></span>
<a class="btn-secondary" href="http://localhost:5173" target="_blank" style="text-decoration:none">เปิดระบบ ↗</a></header>
<main class="wrap">
<h1>🎬 เลือกการสาธิต</h1><div class="underline"></div>
<p class="sub">กด "เริ่มสาธิต" → หน้าต่าง Chrome เปิดขึ้นมาและทำงานให้ดูทีละขั้น · ทุกขั้นหยุดรอให้กด <b>"ถัดไป ▶"</b> ที่มุมขวาล่าง</p>

<section id="status" class="card" aria-live="polite"><div class="head"><span class="st" id="st"></span><span class="now" id="now"></span>
<button class="btn-secondary" id="toggleLog" style="height:36px;font-size:14px">รายละเอียด</button>
<button class="btn-danger-outline" id="stop">หยุดการสาธิต</button></div><div id="log"></div></section>

<div class="section-label">ทั้งเส้นทาง</div>
<section class="card hero">
  <div><div class="meta"><span class="time">${full.time} · ${steps.length} ขั้น</span>${chips(full.roles)}</div>
  <h2>${esc(full.title)}</h2><p class="desc">${esc(full.desc)}</p></div>
  <div class="from">
    <label for="from">เริ่มจากขั้นที่</label>
    <select id="from"><option value="1">1 · เริ่มตั้งแต่ต้น (${esc(steps[0]?.label || '')})</option>${steps.filter((s) => s.n > 1).map((s) => `<option value="${s.n}">${s.n} · ${esc(s.label)}</option>`).join('')}</select>
    <div class="row"><button class="btn" data-run="full" style="flex:1">▶ เริ่มสาธิต</button></div>
    <span style="font-size:12px;color:var(--muted)">เลือกขั้นกลางทาง = ระบบทำขั้นก่อนหน้าให้อัตโนมัติก่อน (1–2 นาที)</span>
  </div>
</section>

<div class="section-label">สาธิตเฉพาะเรื่อง</div>
<div class="grid">${others.map(([id, d]) => `<section class="card"><div class="meta"><span class="time">${d.time}</span>${chips(d.roles)}</div>
<h2>${esc(d.title)}</h2><p class="desc">${esc(d.desc)}</p><button class="btn" data-run="${id}">▶ เริ่มสาธิต</button></section>`).join('')}</div>

<div class="section-label">บัญชีสาธิต</div>
<section class="card">
<p class="desc">ลองใช้งานต่อเองได้หลังสาธิต · รหัสผ่านทุกบัญชี <code>demo1234</code> · ล็อกอินที่ <a href="http://localhost:5173" target="_blank">http://localhost:5173</a> (เลือกแท็บบทบาทให้ตรง)</p>
<div class="acc"><div><b>นักศึกษา</b>demo.s1@kkumail.com<br><span style="color:var(--muted);font-size:13px">demo.s2 – demo.s4 ในการสาธิตหลายคน</span></div>
<div><b>อาจารย์</b>demo.teacher@kkumail.com<br><span style="color:var(--muted);font-size:13px">demo.teacher2 ในการสาธิตเพิ่มหลักสูตร</span></div><div><b>เจ้าหน้าที่</b>demo.staff@kkumail.com</div></div>
<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="btn-secondary" data-run="clean">🧹 ล้างข้อมูลสาธิต</button>
<span style="font-size:13px;color:var(--muted)">ข้อมูลสาธิตอยู่จนกว่าจะล้าง · เริ่มสาธิตใหม่จะล้างของเดิมให้ก่อนเสมอ</span></div>
</section>
</main><script>
const $=(s)=>document.querySelector(s);
const label={running:'⏳ กำลังสาธิต',done:'✅ จบแล้ว',failed:'⚠️ หยุดกลางทาง — ดูรายละเอียด',stopped:'⏹ หยุดแล้ว',idle:''};
let showLog=false;
async function poll(){
  let j; try{ j=await (await fetch('/status')).json(); }catch{ $('#st').textContent='⚠️ หน้าเมนูปิดไปแล้ว (เปิด node demo.js ใหม่)'; $('#status').style.display='block'; return; }
  const box=$('#status'); box.style.display=j.state==='idle'?'none':'block'; box.className='card '+j.state;
  $('#st').textContent=(label[j.state]||j.state)+(j.title?' · '+j.title:'');
  const steps=j.log.filter(l=>/^\\[ขั้น /.test(l));
  const last=steps[steps.length-1]||'';
  $('#now').textContent=j.state==='running'?(last?last.replace(/^\\[|\\]/g,' ').trim():(j.from>1?'กำลังเตรียม แล้วเริ่มที่ขั้น '+j.from+'…':'กำลังเปิด Chrome…')):'';
  if(j.state==='failed') showLog=true;
  const log=$('#log'); log.style.display=showLog?'block':'none';
  log.textContent=j.log.filter(l=>/ขั้น|ลบข้อมูล|Error|error|passed|failed|ok \\d/.test(l)).slice(-14).join('\\n');
  $('#stop').style.display=j.state==='running'?'inline-flex':'none';
  document.querySelectorAll('[data-run],#from').forEach(b=>b.disabled=j.state==='running');
}
document.addEventListener('click',async(e)=>{
  const b=e.target.closest('button'); if(!b) return;
  const id=b.dataset.run;
  if(id){ if(id==='clean'&&!confirm('ลบบัญชีและข้อมูลสาธิตทั้งหมด?'))return;
    const from=id==='full'?$('#from').value:'';
    showLog=false; await fetch('/run/'+id+(from?'?from='+from:''),{method:'POST'}); poll(); }
  if(b.id==='stop'){ await fetch('/stop',{method:'POST'}); poll(); }
  if(b.id==='toggleLog'){ showLog=!showLog; poll(); }
});
poll(); setInterval(poll,1500);
</script></body></html>`;
}

(async () => {
  const env = backendEnv();
  if (!env) { console.error('อ่าน backend/.env ไม่ได้'); process.exit(1); }
  if ((env.NODE_ENV || '').toLowerCase() === 'production') { console.error('backend/.env เป็น production — ไม่เปิดการสาธิต (สาธิตใช้กับเครื่องพัฒนาเท่านั้น)'); process.exit(1); }
  if (!(await backendUp())) startedBackend = await startBackend();

  const file = (res, f, type) => fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': type, 'cache-control': 'max-age=3600' }); res.end(buf);
  });

  http.createServer((req, res) => {
    const send = (code, body, type = 'application/json; charset=utf-8') => { res.writeHead(code, { 'content-type': type }); res.end(body); };
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/') return send(200, page(), 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/logo.png') return file(res, LOGO, 'image/png');
    if (req.method === 'GET' && url.pathname === '/font/thai.woff2') return file(res, path.join(FONT_DIR, 'noto-sans-thai-thai-wght-normal.woff2'), 'font/woff2');
    if (req.method === 'GET' && url.pathname === '/font/latin.woff2') return file(res, path.join(FONT_DIR, 'noto-sans-thai-latin-wght-normal.woff2'), 'font/woff2');
    if (req.method === 'GET' && url.pathname === '/status') {
      const title = job.id === 'clean' ? 'ล้างข้อมูลสาธิต' : DEMOS[job.id]?.title;
      return send(200, JSON.stringify({ ...job, title }));
    }
    if (req.method === 'POST' && url.pathname === '/stop') { stop(); return send(200, '{}'); }
    const m = req.method === 'POST' && url.pathname.match(/^\/run\/(\w+)$/);
    if (m) {
      if (child) return send(409, JSON.stringify({ message: 'มีการสาธิตกำลังรันอยู่' }));
      const from = Math.max(0, Math.min(99, Number(url.searchParams.get('from')) || 0));
      if (m[1] === 'clean') run('clean', 'clean.demo.ts', { headed: false });
      else if (DEMOS[m[1]]) run(m[1], DEMOS[m[1]].file, { from: m[1] === 'full' ? from : 0 });
      else return send(404, '{}');
      return send(200, '{}');
    }
    send(404, '{}');
  }).listen(PORT, '127.0.0.1', () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\n🎬 หน้าเมนูสาธิต: ${url}  (ปิดด้วย Ctrl+C)`);
    if (process.platform === 'win32' && !process.env.DEMO_NO_OPEN) spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true });
  });

  const quit = () => { stop(); stopBackend(startedBackend); process.exit(0); };
  process.on('SIGINT', quit); process.on('SIGTERM', quit);
})().catch((e) => { console.error(e.message || e); stopBackend(startedBackend); process.exit(1); });
