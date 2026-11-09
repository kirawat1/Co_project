# docs/

| ที่อยู่ | เนื้อหา |
|---|---|
| [`design/er-diagram.md`](design/er-diagram.md) | แผนภาพฐานข้อมูล (สร้างจาก schema ด้วย `node backend/scripts/er_diagram.js`) |
| [`history/CHANGELOG-detailed.md`](history/CHANGELOG-detailed.md) | บันทึกการเปลี่ยนแปลงทุกครั้ง (พ.ค.–พ.ย. 2569) — ฉบับสรุปอยู่ที่ `CHANGELOG.md` ใน root |
| `planning.md` | แผนปรับ UX/UI ช่วงแรกของโครงการ |
| `reports/` | ผลทดสอบที่ Playwright สร้าง (ไม่อยู่ใน git) |

## ติดตั้งและดูแลเครื่องจริง (Windows VM)

สคริปต์กลุ่มนี้อยู่ที่ `docs/` โดยตรง เพราะ Scheduled Task บนเครื่องจริงเรียกใช้ด้วย path นี้ — **อย่าย้ายไฟล์**

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `install-vm.ps1` · `setup-vm.ps1` | ติดตั้งระบบบนเครื่องใหม่ (Node, MySQL, nginx, PM2) |
| `deploy.ps1` | อัปเดตเครื่องจริงให้เป็นโค้ดล่าสุด (git pull → npm install → prisma → build → restart) — รันแบบ Run as administrator |
| `startup.ps1` | งานตอนเปิดเครื่อง (login เครือข่าย + start ระบบ) |
| `network.md` · `network-login.js` · `network-keepalive.ps1` · `register-network-keepalive.ps1` | login เครือข่าย KKU อัตโนมัติ + เฝ้าเน็ตหลุดทุก 15 นาที |
| `backup.md` · `register-backup-task.ps1` | สำรองข้อมูลทุกคืน + ทดสอบกู้ + วิธีกู้คืน |
| `domain-migration.md` · `lets-encrypt-setup.md` · `nginx.conf` · `nginx-http-only.conf` | ย้ายจาก ngrok ไปโดเมน coop.computing.kku.ac.th + ใบรับรอง HTTPS |
| `start-ngrok.js` | รัน ngrok tunnel ผ่าน PM2 (โหมด ngrok) |
