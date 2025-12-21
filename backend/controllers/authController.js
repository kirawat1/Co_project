// backend/controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prismaClient");
require("dotenv").config();

// sign in
exports.signIn = async (req, res) => {
  try {
    
    const { email, password, role } = req.body;

    console.log("Login attempt:", { email, password, role });

    if (!email || !password || !role) {
      return res.status(400).json({ ok: false, message: "กรุณากรอกข้อมูลให้ครบ" });
    }

    // ตรวจสอบ role
    const allowedRoles = ["student", "teacher", "staff"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ ok: false, message: "Role ไม่ถูกต้อง" });
    }

    // หา user ตาม email และ role
    const user = await prisma.user.findFirst({
      where: { email, role },
      include: { student: true }, // รวมข้อมูล student ถ้า role เป็น student
    });

    if (!user) {
      return res.status(401).json({ ok: false, message: "ไม่พบผู้ใช้งาน" });
    }

    // console.log("User from DB:", user);
    console.log("Password input:", password, "Password in DB:", user?.password);
    // ตรวจสอบรหัสผ่าน (plaintext ตอนนี้)
    const valid = password === user.password; 
    if (!valid) return res.status(401).json({ ok: false, message: "รหัสผ่านไม่ถูกต้อง" });


    // เตรียม profile response
    let profile = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    if (role === "student" && user.student) {
      profile = {
        ...profile,
        studentId: user.student.studentId,
        firstName: user.student.firstName,
        lastName: user.student.lastName,
        phone: user.student.phone,
        gpa: user.student.gpa,
        major: user.student.major,
        curriculum: user.student.curriculum,
        nationality: user.student.nationality,
      };
    }

    // Token dummy
    // const token = "dummy-token";
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ ok: true, message: "เข้าสู่ระบบสำเร็จ", token, user: profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
};


exports.getProfile = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ ok: false, message: "ไม่มี token" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ ok: false, message: "token ไม่ถูกต้อง" });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ ok: false, message: "token หมดอายุหรือไม่ถูกต้อง" });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: { student: true },
    });

    if (!user) return res.status(404).json({ ok: false, message: "ไม่พบผู้ใช้งาน" });

    let profile = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    if (user.role === "student" && user.student) {
      profile = {
        ...profile,
        studentId: user.student.studentId,
        firstName: user.student.firstName,
        lastName: user.student.lastName,
      };
    }

    return res.json({ ok: true, user: profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
};