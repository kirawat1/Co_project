// ใช้ร่วมกันทุกจุดที่ multer รับไฟล์อัปโหลด — กันไฟล์ executable/อันตรายแฝงตัวมา
function pdfOrImageFileFilter(req, file, cb) {
  if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('รองรับเฉพาะไฟล์ PDF และรูปภาพเท่านั้น'), false);
  }
}

module.exports = { pdfOrImageFileFilter };
