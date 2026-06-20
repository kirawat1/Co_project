// backend/middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pdfOrImageFileFilter } = require('../utils/fileFilters');

// ตรวจสอบว่ามีโฟลเดอร์ uploads หรือไม่ ถ้าไม่มีให้สร้าง
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ตั้งค่า Storage (ที่เก็บไฟล์และการตั้งชื่อ)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // ✅ เปลี่ยนชื่อไฟล์ที่เก็บใน Server ให้เป็น Timestamp (เพื่อหนีปัญหาภาษาไทยใน OS)
        // เช่น: 17053928123-8849.pdf
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

// Config Multer
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // จำกัด 50MB
    fileFilter: pdfOrImageFileFilter,
});

module.exports = upload;