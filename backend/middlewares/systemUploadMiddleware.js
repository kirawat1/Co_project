// backend/middleware/systemUploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pdfOrImageFileFilter } = require('../utils/fileFilters');

// สร้างโฟลเดอร์ uploads/system ถ้ายังไม่มี
const uploadDir = path.join(__dirname, '../uploads/system');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // ตั้งชื่อไฟล์ตาม Key เพื่อให้ดูง่าย (เช่น KRUT_17150000.png)
        const ext = path.extname(file.originalname);
        const key = req.body.key || 'ASSET'; 
        cb(null, `${key}_${Date.now()}${ext}`);
    }
});

const systemUpload = multer({
    storage: storage,
    fileFilter: pdfOrImageFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = systemUpload;