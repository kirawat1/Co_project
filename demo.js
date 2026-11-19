#!/usr/bin/env node
// หน้าเมนูสาธิตระบบ — node demo.js แล้วเปิด http://localhost:5199 (เปิดให้เอง)
//   กดเลือกการสาธิต → Chrome เปิดขึ้นมา สคริปต์กดระบบให้ดูทีละขั้น หยุดรอปุ่ม "ถัดไป" ทุกขั้น
//   ใช้ฐานข้อมูลตาม backend/.env (เครื่องพัฒนา) — สร้างบัญชี/ข้อมูลตัวอย่างที่ขึ้นต้น demo. และลบได้จากปุ่มล้างข้อมูล
//   ไม่ยอมรันถ้า backend/.env ตั้ง NODE_ENV=production
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { backendEnv, backendUp, startBackend, stopBackend } = require('./run-tests.js');

const PORT = 5199;
const FRONTEND = path.join(__dirname, 'Frontend');
const DEMOS = {
  full: { file: 'full.demo.ts', title: 'ทั้งเส้นทาง: เปิดรอบ → ยื่นคำร้อง → หนังสือ → ฝึกงาน → นิเทศ', time: '~20–30 นาที (16 ขั้น)',
    desc: 'เจ้าหน้าที่เปิดรอบและตั้งปฏิทิน · นักศึกษาเลือกบริษัท ยื่นคำร้อง ส่ง T000 · อาจารย์ประจำวิชาพิจารณา · เจ้าหน้าที่ตรวจเอกสาร ออกหนังสือขอความอนุเคราะห์และส่งตัว · T002/T003 · นัดนิเทศ · หนังสือขอนิเทศ' },
  bulk: { file: 'bulk.demo.ts', title: 'ออกหนังสือหลายฉบับพร้อมกัน', time: '~5 นาที',
    desc: 'นักศึกษา 3 คน (2 คนบริษัทเดียวกัน) · ออกร่างทีละชุดเป็น zip ไล่เลขให้ · บริษัทเดียวกันรวมฉบับเดียว · อัปโหลดฉบับลงนามทีละหลายไฟล์ ระบบจับคู่ให้' },
  group: { file: 'group.demo.ts', title: 'นิเทศหลายคนพร้อมกัน', time: '~5 นาที',
    desc: 'นักศึกษา 3 คนบริษัทเดียวกันเสนอวันเดียวกันคนละเวลา · อาจารย์ "นัดพร้อมกัน" ระบบจัดคิว · เจ้าหน้าที่ออกหนังสือขอนิเทศฉบับรวม' },
};

let child = null;          // การสาธิตที่กำลังรัน
let job = { id: null, state: 'idle', log: [] };
let startedBackend = null;

function run(id, file, headed = true) {
  job = { id, state: 'running', log: [] };
  const env = { ...process.env };
  if (!headed) env.DEMO_HEADLESS = '1';
  child = spawn(`npx playwright test --config=playwright.demo.config.ts ${file}`, { cwd: FRONTEND, shell: true, env });
  const push = (d) => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) job.log.push(l.replace(/\x1b\[[0-9;]*m/g, '')); job.log = job.log.slice(-40); };
  child.stdout.on('data', push); child.stderr.on('data', push);
  child.on('exit', (code) => { job.state = code === 0 ? 'done' : 'failed'; child = null; });
}

function stop() {
  if (!child) return;
  if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill();
  job.state = 'stopped';
}

const PAGE = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>สาธิตระบบสหกิจศึกษา</title>
<style>
body{margin:0;background:#f1f5f9;color:#0f172a;font:16px/1.6 'Sarabun','Leelawadee UI',Tahoma,sans-serif}
.wrap{max-width:960px;margin:0 auto;padding:28px 16px 60px}
h1{font-size:28px;margin:0 0 4px}.sub{color:#475569;margin:0 0 24px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px 22px;margin-bottom:14px;box-shadow:0 2px 8px rgba(15,23,42,.04)}
.card h2{font-size:20px;margin:0 0 4px}.time{display:inline-block;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:1px 10px;font-size:13px;margin-bottom:8px}
.card p{margin:0 0 14px;color:#334155}
button{font:700 16px 'Sarabun','Leelawadee UI',Tahoma,sans-serif;border:0;border-radius:10px;padding:10px 18px;cursor:pointer}
.go{background:#2563eb;color:#fff}.go:hover{background:#1d4ed8}.go:disabled{background:#94a3b8;cursor:not-allowed}
.ghost{background:#fff;color:#334155;border:1px solid #cbd5e1}.danger{background:#fff;color:#b91c1c;border:1px solid #fecaca}
#status{position:sticky;top:0;z-index:2;background:#0f172a;color:#e2e8f0;border-radius:12px;padding:12px 16px;margin-bottom:18px;display:none}
#status b{color:#fff}#log{font:12px/1.5 Consolas,monospace;white-space:pre-wrap;max-height:160px;overflow:auto;margin-top:8px;color:#cbd5e1}
.acc{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;margin-top:8px}
.acc div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:14px;overflow-wrap:anywhere}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
</style></head><body><div class="wrap">
<h1>🎬 สาธิตระบบสหกิจศึกษา</h1>
<p class="sub">กดเลือกการสาธิต → หน้าต่าง Chrome จะเปิดขึ้นมาและทำงานให้ดูทีละขั้น · ทุกขั้นหยุดรอให้กด <b>"ถัดไป ▶"</b> ที่มุมขวาล่าง</p>
<div id="status"><div class="row"><span id="st"></span><button class="danger" id="stop" style="margin-left:auto;padding:6px 14px">หยุดการสาธิต</button></div><div id="log"></div></div>
${Object.entries(DEMOS).map(([id, d]) => `<div class="card"><h2>${d.title}</h2><span class="time">${d.time}</span><p>${d.desc}</p>
<button class="go" data-run="${id}">▶ เริ่มสาธิต</button></div>`).join('')}
<div class="card"><h2>บัญชีสาธิต (ลองใช้งานต่อเองได้หลังสาธิต)</h2>
<p>รหัสผ่านทุกบัญชี: <b>demo1234</b> · ล็อกอินที่ <a href="http://localhost:5173" target="_blank">http://localhost:5173</a> (เลือกแท็บบทบาทให้ตรง)</p>
<div class="acc"><div>👨‍🎓 นักศึกษา<br>demo.s1@kkumail.com<br>(demo.s2 · demo.s3 ในการสาธิตหลายคน)</div><div>👩‍🏫 อาจารย์<br>demo.teacher@kkumail.com</div><div>🧑‍💼 เจ้าหน้าที่<br>demo.staff@kkumail.com</div></div>
<p style="margin-top:14px">ข้อมูลสาธิตอยู่จนกว่าจะล้าง · เริ่มสาธิตใหม่จะล้างของเดิมให้ก่อนเสมอ</p>
<button class="ghost" data-run="clean">🧹 ล้างข้อมูลสาธิต</button></div>
</div><script>
const $=(s)=>document.querySelector(s);
const label={running:'⏳ กำลังสาธิต',done:'✅ จบแล้ว',failed:'⚠️ หยุดกลางทาง (ดูข้อความด้านล่าง)',stopped:'⏹ หยุดแล้ว',idle:''};
async function poll(){
  const j=await (await fetch('/status')).json();
  $('#status').style.display=j.state==='idle'?'none':'block';
  $('#st').innerHTML='<b>'+(label[j.state]||j.state)+'</b> · '+(j.title||'');
  $('#log').textContent=j.log.filter(l=>/ขั้น|ลบข้อมูล|Error|error|passed|failed/.test(l)).slice(-12).join('\\n');
  $('#stop').style.display=j.state==='running'?'inline-block':'none';
  document.querySelectorAll('[data-run]').forEach(b=>b.disabled=j.state==='running');
}
document.addEventListener('click',async(e)=>{
  const id=e.target.dataset&&e.target.dataset.run;
  if(id){ if(id==='clean'&&!confirm('ลบบัญชีและข้อมูลสาธิตทั้งหมด?'))return; await fetch('/run/'+id,{method:'POST'}); poll(); }
  if(e.target.id==='stop'){ await fetch('/stop',{method:'POST'}); poll(); }
});
poll(); setInterval(poll,1500);
</script></body></html>`;

(async () => {
  const env = backendEnv();
  if (!env) { console.error('อ่าน backend/.env ไม่ได้'); process.exit(1); }
  if ((env.NODE_ENV || '').toLowerCase() === 'production') { console.error('backend/.env เป็น production — ไม่เปิดการสาธิต (สาธิตใช้กับเครื่องพัฒนาเท่านั้น)'); process.exit(1); }
  if (!(await backendUp())) startedBackend = await startBackend();

  http.createServer((req, res) => {
    const send = (code, body, type = 'application/json; charset=utf-8') => { res.writeHead(code, { 'content-type': type }); res.end(body); };
    if (req.method === 'GET' && req.url === '/') return send(200, PAGE, 'text/html; charset=utf-8');
    if (req.method === 'GET' && req.url === '/status') {
      const title = job.id === 'clean' ? 'ล้างข้อมูลสาธิต' : DEMOS[job.id]?.title;
      return send(200, JSON.stringify({ ...job, title }));
    }
    if (req.method === 'POST' && req.url === '/stop') { stop(); return send(200, '{}'); }
    const m = req.method === 'POST' && req.url.match(/^\/run\/(\w+)$/);
    if (m) {
      if (child) return send(409, JSON.stringify({ message: 'มีการสาธิตกำลังรันอยู่' }));
      if (m[1] === 'clean') run('clean', 'clean.demo.ts', false);
      else if (DEMOS[m[1]]) run(m[1], DEMOS[m[1]].file);
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
