# docs/

เอกสารประกอบโปรเจกต์ระบบสหกิจศึกษา KKU

## โครงสร้าง

| Folder | เนื้อหา |
|--------|---------|
| `planning.md` | UX/UI improvement plans และ KKU API integration plans |
| `superpowers/plans/` | Implementation plans สำหรับแต่ละ feature |
| `superpowers/specs/` | Design specs ก่อน implement |
| `reports/` | Test reports ที่ generate โดย Playwright (gitignored) |
| `domain-migration.md` · `nginx-http-only.conf` · `nginx.conf` | ย้ายจาก ngrok ไป https://coop.computing.kku.ac.th (ทีละขั้น ย้อนกลับได้) |
| `backup.md` · `register-backup-task.ps1` | สำรองข้อมูลทุกคืน + ทดสอบกู้ทุกสัปดาห์ + วิธีกู้คืน |
| `network.md` · `network-keepalive.ps1` · `register-network-keepalive.ps1` | login เน็ต KKU อัตโนมัติ + เฝ้าเน็ตหลุดทุก 15 นาที |
