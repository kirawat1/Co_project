# ย้ายจาก ngrok ไปโดเมนจริง `coop.computing.kku.ac.th`

ทำตามลำดับ แต่ละขั้นย้อนกลับได้ ระหว่างย้าย ngrok ยังใช้งานได้ตลอด จนถึงขั้นที่ 4

| ขั้น | ผลที่ได้ | ใช้เวลา |
|---|---|---|
| 0. ขอ DNS + เปิด port กับ IT คณะ | โดเมนชี้มาที่ VM และคนนอกเข้าถึงได้ | รอ IT |
| 1. nginx ช่วงขอ cert | โดเมนเข้าได้ผ่าน http ส่วน ngrok ใช้ได้เหมือนเดิม | 10 นาที |
| 2. ขอ cert | ได้ `C:\nginx\ssl\cert.pem` + `key.pem` | 10 นาที |
| 3. nginx HTTPS | `https://coop.computing.kku.ac.th` ใช้งานได้ ลิงก์ ngrok/IP เดิมพาไปเว็บใหม่ | 5 นาที |
| 4. .env + Google + ประกาศ | ระบบใช้ลิงก์โดเมนใหม่ทั้งหมด | 15 นาที |

---

## 0. สิ่งที่ต้องขอจาก IT คณะ (ทำก่อน)

> ⚠️ **VM ต้อง login captive portal ของ มข. ก่อนออกเน็ต** (`network-login.js`) แปลว่า VM น่าจะเป็นเครื่องลูกข่ายที่ไม่มี IP สาธารณะ
> คนนอกมหาวิทยาลัยจึงเข้ามาที่ VM ตรงๆ ไม่ได้ ngrok จึงถูกใช้มาตลอด **ข้อนี้ต้องให้ IT แก้ก่อน ไม่งั้นขั้นต่อไปไม่มีประโยชน์**

ขอ IT สามข้อ:
1. **DNS A record** `coop.computing.kku.ac.th` → IP ของ VM (IP ที่เข้าจากอินเทอร์เน็ตได้)
2. **เปิด port 80 และ 443 ขาเข้าจากอินเทอร์เน็ต** มาที่ VM (firewall มหาวิทยาลัย/คณะ หรือ NAT port forward)
3. ถ้าย้าย VM ไปวง server ได้ จะไม่ต้องพึ่ง captive portal อีก (`network-keepalive.ps1` ก็ไม่ต้องใช้)

ตรวจจากเครื่องนอกมหาวิทยาลัย เช่น มือถือที่ปิด wifi:
```powershell
nslookup coop.computing.kku.ac.th        # ต้องได้ IP ที่ IT ให้
```
ผลตรวจข้อ 2 จะเห็นในขั้นที่ 1

> ถ้า IT เปิดให้เข้าได้เฉพาะในมหาวิทยาลัย Let's Encrypt จะตรวจโดเมนไม่ได้ ให้ขอ cert จาก IT แทน (ดูขั้นที่ 2 แบบ ข)

---

## 1. nginx ช่วงขอ cert (ngrok ยังใช้งานตามปกติ)

```powershell
cd C:\Co_project
git pull
copy C:\nginx\conf\nginx.conf C:\nginx\conf\nginx.conf.before-domain   # เก็บของเดิมไว้ย้อนกลับ
New-Item -ItemType Directory -Force -Path C:\letsencrypt\webroot\.well-known\acme-challenge
"ok" | Set-Content C:\letsencrypt\webroot\.well-known\acme-challenge\test -Encoding ascii
copy C:\Co_project\docs\nginx-http-only.conf C:\nginx\conf\nginx.conf
C:\nginx\nginx.exe -t            # ต้องขึ้น "syntax is ok" / "test is successful"
C:\nginx\nginx.exe -s reload
```

ตรวจ:
- ลิงก์ ngrok เดิมยังใช้งานได้ ทั้ง login และอัปโหลด
- จากเครื่องนอกมหาวิทยาลัย เปิด `http://coop.computing.kku.ac.th/.well-known/acme-challenge/test` ต้องเห็น `ok`
  ถ้าเข้าไม่ได้ แปลว่าข้อ 0 ยังไม่เสร็จ (DNS หรือ port 80)

> config ชุดนี้แก้บั๊กเดิมของ `nginx-http-only.conf` ด้วย: ไฟล์ challenge เคยตอบ 404 เพราะ `location ~ /\.` มาก่อน ทำให้ขอ cert ไม่ผ่าน

---

## 2. ขอ cert

**แบบ ก: Let's Encrypt (ฟรี ต่ออายุเอง)** ทำตาม `docs\lets-encrypt-setup.md` ข้อ 2 และข้อ 4

**แบบ ข: cert จาก IT มหาวิทยาลัย** วางไฟล์ไว้ที่:
```
C:\nginx\ssl\cert.pem   ← cert + intermediate chain ต่อกันในไฟล์เดียว
C:\nginx\ssl\key.pem
```
cert แบบนี้ไม่ต่ออายุเอง ให้จดวันหมดอายุไว้

---

## 3. เปลี่ยนเป็น HTTPS

```powershell
copy C:\Co_project\docs\nginx.conf C:\nginx\conf\nginx.conf
C:\nginx\nginx.exe -t
C:\nginx\nginx.exe -s reload
```

หลังขั้นนี้:
- `https://coop.computing.kku.ac.th` ใช้งานได้ 🔒
- `http://...` / IP ของ VM / **ลิงก์ ngrok เดิม** → พาไป `https://coop.computing.kku.ac.th` (path เดิม) ลิงก์ที่ส่งในไลน์กลุ่มไว้ยังใช้ได้
- หน้าสถานะในเครื่อง `http://localhost:8888/status.html` ยังใช้ได้

`deploy.ps1` ตรวจเจอ `listen 443 ssl` ใน config แล้วจะรายงาน URL เป็นโดเมนใหม่เอง
ส่วน ngrok ยังเปิดอยู่เพื่อพาลิงก์เก่ามาเว็บใหม่ ถ้าจะปิด ให้ตั้ง `$KEEP_NGROK_REDIRECT = $false` ใน `deploy.ps1` แนะนำให้รอหลังจบภาคการศึกษา

**ไม่ต้องแก้ `TRUST_PROXY_HOPS`** nginx ตั้ง `X-Forwarded-For` เป็น IP ที่ต่อเข้ามาจริงเมื่อเป็นการต่อตรง และส่งต่อของ ngrok เมื่อมาจาก ngrok ทำให้ rate limit นับต่อคนถูกต้อง และปลอม IP ผ่าน header ไม่ได้ทั้งสองทาง

---

## 4. ตั้งค่าระบบ + ประกาศ

1. `C:\Co_project\backend\.env`:
   ```
   FRONTEND_URL=https://coop.computing.kku.ac.th
   ```
   ตัวแรกใช้สร้างลิงก์ในไฟล์ Excel ที่ส่งออก ส่วน origin อื่นที่เคยใส่ (ngrok, IP) ลบได้ เพราะทุกทางพามาโดเมนเดียวแล้ว
   ```powershell
   pm2 restart coop-backend
   ```
2. **Google Cloud Console** → OAuth client ของระบบ → Authorized JavaScript origins → เพิ่ม `https://coop.computing.kku.ac.th`
   (ถ้าไม่เพิ่ม ปุ่ม "เข้าสู่ระบบด้วย Google" จะ error บนโดเมนใหม่)
3. ตรวจบนโดเมนใหม่ครบทุกบทบาท:
   - [ ] เข้าสู่ระบบ: รหัสผ่าน และ Google
   - [ ] นักศึกษาอัปโหลดเอกสาร แล้วเปิดไฟล์ดูได้
   - [ ] เจ้าหน้าที่ดาวน์โหลดหนังสือ (zip) และส่งออก Excel โดยลิงก์ไฟล์ในชีตเป็นโดเมนใหม่
   - [ ] นำเข้านักศึกษาจาก Excel
   - [ ] เปิดจากมือถือนอกมหาวิทยาลัย
4. ประกาศในระบบ (ส่วนกลาง) ให้ใช้ลิงก์ใหม่ และปักหมุดไว้

---

## ย้อนกลับ

```powershell
copy C:\nginx\conf\nginx.conf.before-domain C:\nginx\conf\nginx.conf
C:\nginx\nginx.exe -s reload
```
แล้วแก้ `FRONTEND_URL` กลับเป็นค่าเดิม และรัน `pm2 restart coop-backend` เท่านี้ ngrok ก็กลับมาให้บริการแบบเดิม

## ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / แก้ |
|---|---|
| คนในมหาวิทยาลัยเข้าได้ คนนอกเข้าไม่ได้ | port 443 ยังไม่เปิดจากอินเทอร์เน็ต (ข้อ 0) |
| `nginx -t` บอก `cannot load certificate` | path/ชื่อไฟล์ cert ไม่ตรง `C:\nginx\ssl\cert.pem`, `key.pem` |
| เบราว์เซอร์เตือน cert ไม่ถูกต้อง | cert ไม่มี intermediate chain (แบบ ข) ให้ต่อ chain ท้าย cert.pem |
| หลัง deploy มีคนเจอหน้าขาว | เบราว์เซอร์ค้าง index.html เก่า ถ้ามาจาก config เก่า ให้รีเฟรชครั้งเดียว config ใหม่ตั้ง index.html ไม่ให้ cache แล้ว |
| ดาวน์โหลด zip/ส่งออกใหญ่ๆ แล้ว 504 | เกิน `proxy_read_timeout 300s` ให้แบ่งดาวน์โหลดตามหลักสูตร |
| cert หมดอายุ | Let's Encrypt: ดู task "win-acme renewal" (ต้องออกเน็ตได้ ดู network-keepalive) · IT: ขอใหม่ |
