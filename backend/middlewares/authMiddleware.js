// backend/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

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

    // ตรวจสอบ Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'MySecretKey123');

    // แนบข้อมูล user ลง req
    req.user = decoded;      // { id: 1, role: 'STUDENT', ... }
    req.userId = decoded.id; // ใช้สะดวกใน controller อื่น

    next();
  } catch (err) {
    console.error("Auth Error:", err.message);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

exports.verifyRole = (...allowedRoles) => {
  return (req, res, next) => {
    // เช็คว่ามี User จาก verifyToken ไหม และ Role ตรงกับที่อนุญาตไหม
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        ok: false, 
        message: "Access Denied: You do not have permission." 
      });
    }
    next();
  };
};