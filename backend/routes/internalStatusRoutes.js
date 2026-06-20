// No auth — only reachable via the nginx server block bound to 127.0.0.1
// (see docs/nginx-internal-status.conf), which ngrok never tunnels.
const express = require('express');
const router = express.Router();
const { getStatus } = require('../controllers/statusController');

router.get('/', getStatus);

module.exports = router;
