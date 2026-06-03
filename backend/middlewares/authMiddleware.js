// backend/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set');
}

exports.verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Invalid token format" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    req.userId = decoded.id;

    next();
  } catch (err) {
    // 401 = token หมดอายุ / ผิด secret → frontend ควร logout อัตโนมัติ
    return res.status(401).json({ message: "Token expired or invalid — please log in again" });
  }
};

exports.verifyRole = (...allowedRoles) => {
  // normalize ครั้งเดียวตอนสร้าง middleware — รองรับทั้ง 'teacher' และ 'TEACHER'
  const allowed = new Set(allowedRoles.map(r => r.toLowerCase()));
  return (req, res, next) => {
    const role = (req.user?.role ?? '').toLowerCase();
    if (!req.user || !allowed.has(role)) {
      return res.status(403).json({
        ok: false,
        message: "Access Denied: You do not have permission."
      });
    }
    next();
  };
};