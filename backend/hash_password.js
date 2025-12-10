// Backend/hash_password.js

const bcrypt = require('bcryptjs');

// รหัสผ่าน Admin ที่ต้องการใช้
const PASSWORD = '1111111111111'; 

bcrypt.hash(PASSWORD, 13).then(hash => {
    console.log('----------------------------------------------------');
    console.log('✅ HASHED PASSWORD (คัดลอกค่านี้ไปใช้ใน MySQL):');
    console.log(hash);
    console.log('----------------------------------------------------');
    process.exit();
}).catch(err => {
    console.error('Hashing failed:', err);
    process.exit(1);
});

// รันสคริปต์นี้ด้วยคำสั่ง: node backend/hash_password.js
// แล้วคัดลอกค่าที่ได้ไปใส่ในฟิลด์ password ของตาราง Admin ในฐานข้อมูล MySQL ของคุณ
// ตัวอย่างเช่น:
// UPDATE Admin SET password='[ค่าที่ได้จากสคริปต์นี้]' WHERE username='admin';
// $2a$10$RuVoFC8WY5rMhR/Y4tHyMez0KMDwGbgbZOACAtl1XTfnnI11ky5Hq