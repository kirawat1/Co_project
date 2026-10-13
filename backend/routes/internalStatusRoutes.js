// No auth — only reachable via the nginx server block bound to 127.0.0.1:8888
// (see docs/setup-vm.ps1), which ngrok never tunnels.
// กันชั้นที่สองในโค้ด: บล็อก public ของ nginx ตั้ง X-Real-IP / X-Forwarded-For เสมอ (ทับค่าที่ client ส่งมา)
// ส่วนบล็อก 127.0.0.1:8888 ไม่ตั้ง → มี header นี้ = มาจากภายนอก ตอบ 404
// (เดิมพึ่ง nginx `location = /api/internal-status` อย่างเดียว — เติม / ท้าย path ก็หลุดผ่านได้)
const express = require('express');
const router = express.Router();
const { getStatus } = require('../controllers/statusController');

function localOnly(req, res, next) {
  if (req.headers['x-real-ip'] || req.headers['x-forwarded-for']) {
    return res.status(404).json({ ok: false, message: 'Not found' });
  }
  next();
}

router.get('/', localOnly, getStatus);

module.exports = router;
