const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prismaClient");
const { OAuth2Client } = require('google-auth-library');
const { VAULT_ROLES, decryptPassword, passwordEncFor } = require("../utils/passwordVault");
const { signSession } = require("../utils/session");
require("dotenv").config();

if (!process.env.GOOGLE_CLIENT_ID) {
  console.warn('[authController] WARNING: GOOGLE_CLIENT_ID is not set — Google OAuth login is disabled');
}

// ==========================================
// Helper Functions (สำหรับแปลงข้อมูล)
// ==========================================

// แปลงชื่อหลักสูตร -> Enum Major (CS, IT, GIS)
const mapMajor = (programName) => {
  const name = (programName || "").toLowerCase();
  if (name.includes("computer science") || name.includes("วิทยาการคอมพิวเตอร์")) return "CS";
  if (name.includes("information technology") || name.includes("เทคโนโลยีสารสนเทศ")) return "IT";
  if (name.includes("geo") || name.includes("gis") || name.includes("ภูมิสารสนเทศ")) return "GIS";
  return null; // หรือ default
};

// แปลงคำนำหน้า -> Enum Prefix (MR, MS)
const mapPrefix = (prefix) => {
  const p = (prefix || "").toLowerCase().replace(".", "");
  if (["mr", "mister", "นาย"].includes(p)) return "MR";
  if (["ms", "miss", "mrs", "นาง", "นางสาว"].includes(p)) return "MS";
  return null;
};

// ==========================================
// 1. Manual Sign In 
// ==========================================
// อายุการเข้าสู่ระบบ — ติ๊ก "จดจำฉันไว้" = 30 วัน · ไม่ติ๊ก = 8 ชั่วโมง (เครื่องส่วนกลาง) · ไม่ส่งมา (client เก่า) = 7 วันเหมือนเดิม
const sessionTtl = (remember) => (remember === true ? '30d' : remember === false ? '8h' : '7d');
exports.sessionTtl = sessionTtl;

exports.signIn = async (req, res) => {
  try {
    const { email: rawEmail, password, role } = req.body;

    if (!rawEmail || !password || !role) {
      return res.status(400).json({ ok: false, message: "กรุณากรอกข้อมูลให้ครบ" });
    }

    // lowercase ให้ตรงกับ registerStudent ที่เก็บ email เป็น lowercase เสมอ
    const email = rawEmail.trim().toLowerCase();

    const allowedRoles = ["student", "teacher", "staff"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ ok: false, message: "Role ไม่ถูกต้อง" });
    }

    const user = await prisma.user.findFirst({
      where: { email, role }, // หมายเหตุ: ปกติควรหาจาก username หรือ email อย่างเดียว
      include: { student: true },
    });

    if (!user) {
      return res.status(401).json({ ok: false, message: "ไม่พบผู้ใช้งาน" });
    }

    // ถ้า password เป็น null = บัญชีนี้ต้องเข้าสู่ระบบด้วย Google OAuth
    if (!user.password) {
      return res.status(401).json({ ok: false, message: "บัญชีนี้ต้องเข้าสู่ระบบด้วย Google (@kkumail.com) เท่านั้น" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ ok: false, message: "รหัสผ่านไม่ถูกต้อง" });

    if (user.role === 'student' && user.student?.deletedAt) {
      return res.status(401).json({ ok: false, message: "บัญชีนี้ถูกระงับการใช้งาน" });
    }

    // เก็บสำเนารหัสผ่าน (ถอดได้) ให้เจ้าหน้าที่กดดูได้ — บัญชีที่ตั้งรหัสไว้ก่อนมีระบบนี้จะถูกเก็บตอน login
    // เก็บไม่สำเร็จไม่ขวางการเข้าสู่ระบบ
    // เขียนเฉพาะเมื่อ hash ยังเป็นตัวที่เพิ่งตรวจผ่าน — ถ้าเจ้าหน้าที่รีเซ็ตรหัสระหว่างนี้ จะไม่เอารหัสเก่าไปทับสำเนาของรหัสใหม่
    if (VAULT_ROLES.has(user.role) && decryptPassword(user.passwordEnc) !== password) {
      try {
        await prisma.user.updateMany({ where: { id: user.id, password: user.password }, data: { passwordEnc: passwordEncFor(user.role, password) } });
      } catch (e) {
        console.error("[signIn] passwordEnc:", e.message);
      }
    }

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
        // ... field อื่นๆ
      };
    }

    const token = signSession(user, sessionTtl(req.body?.remember));
    return res.json({ ok: true, message: "เข้าสู่ระบบสำเร็จ", token, user: profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
};


// ==========================================
// 3. Get Profile (โค้ดเดิมของคุณ)
// ==========================================
exports.getProfile = async (req, res) => {
  try {
    // verifyToken middleware set req.user แล้ว — ไม่ต้อง verify JWT ซ้ำ
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { student: true, teacher: true },
    });

    if (!user) return res.status(404).json({ ok: false, message: "ไม่พบผู้ใช้งาน" });
    if (user.role === 'student' && user.student?.deletedAt) {
      return res.status(401).json({ ok: false, message: 'บัญชีถูกระงับการใช้งาน' });
    }

    let profile = {
      id: user.id,
      email: user.email,
      role: user.role,
      username: user.username, // เพิ่ม username
    };

    if (user.role === "student" && user.student) {
      profile = {
        ...profile,
        studentId: user.student.studentId,
        prefix: user.student.prefix,        // MR, MS
        firstName: user.student.firstName,  // ดำ
        lastName: user.student.lastName,    // แดง
        firstNameEn: user.student.firstNameEn, // dum
        lastNameEn: user.student.lastNameEn,   // dang
        phone: user.student.phone,          // 0123456789
        email: user.student.email || user.email, // zabatayew@gmail.com
        year: user.student.year,            // 4
        major: user.student.major,          // CS
        studyProgram: user.student.studyProgram // normal
      };
    } else if (user.role === "teacher" && user.teacher) {
      profile = {
        ...profile,
        firstName: user.teacher.firstName,
        lastName: user.teacher.lastName,
      };
    }

    return res.json({ ok: true, user: profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
};
// ==========================================
// 4. Self-Registration (กรณีไม่มี KKU API)
// POST /api/auth/register
// ==========================================
exports.registerStudent = async (req, res) => {
  try {
    const { studentId, prefix, firstName, lastName, email, password, major, year } = req.body;

    // Validate required
    const missing = ["studentId","firstName","lastName","email","password"].filter(f => !req.body[f]?.trim());
    if (missing.length) {
      return res.status(400).json({ ok: false, message: `กรุณากรอก: ${missing.join(", ")}` });
    }
    const { validatePassword } = require('../utils/validatePassword');
    const pwError = validatePassword(password.trim());
    if (pwError) return res.status(400).json({ ok: false, message: pwError });
    if (!/^[^@\s]+@(kkumail\.com|kku\.ac\.th)$/i.test(email.trim())) {
      return res.status(400).json({ ok: false, message: "กรุณาใช้อีเมล @kkumail.com หรือ @kku.ac.th" });
    }

    const emailLower = email.trim().toLowerCase();

    const hashed = await bcrypt.hash(password.trim(), 10);
    const prefixEnum = mapPrefix(prefix) || undefined;

    let user;
    await prisma.$transaction(async (tx) => {
      const existEmail = await tx.user.findFirst({ where: { OR: [{ email: emailLower }, { username: emailLower }] } });
      if (existEmail) throw Object.assign(new Error("อีเมลนี้มีในระบบแล้ว"), { is409: true });

      const existId = await tx.student.findFirst({ where: { studentId: studentId.trim(), deletedAt: null } });
      if (existId) throw Object.assign(new Error("รหัสนักศึกษานี้มีในระบบแล้ว"), { is409: true });

      user = await tx.user.create({
        data: {
          username: emailLower, email: emailLower, password: hashed, role: "student",
          passwordEnc: passwordEncFor("student", password.trim()),
          student: {
            create: {
              studentId: studentId.trim(),
              firstName: firstName.trim(),
              lastName:  lastName.trim(),
              major:     major?.trim() || null,
              year:      year?.trim()  || null,
              ...(prefixEnum ? { prefix: prefixEnum } : {}),
            },
          },
        },
        include: { student: true },
      });
    });

    const token = signSession({ id: user.id, role: "student", tokenVersion: user.tokenVersion }, "7d");
    res.json({
      ok: true,
      message: "สมัครสมาชิกสำเร็จ",
      token,
      user: {
        id: user.id, email: user.email, role: "student",
        studentId: user.student.studentId,
        firstName: user.student.firstName,
        lastName:  user.student.lastName,
      },
    });
  } catch (err) {
    if (err.is409) {
      return res.status(409).json({ ok: false, message: err.message });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ ok: false, message: "อีเมลหรือรหัสนักศึกษานี้มีในระบบแล้ว" });
    }
    console.error("[registerStudent]", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
};

// ==========================================
// เปลี่ยนรหัสผ่านของตัวเอง (นักศึกษา)
// PUT /api/auth/me/password
// ==========================================
exports.changeMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== "string" || typeof newPassword !== "string" || !currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, message: "กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { student: true } });
    if (!user || (user.role === "student" && (!user.student || user.student.deletedAt))) {
      return res.status(404).json({ ok: false, message: "ไม่พบบัญชีผู้ใช้" });
    }
    if (!user.password) {
      return res.status(400).json({ ok: false, message: "บัญชีนี้ยังไม่มีรหัสผ่าน กรุณาติดต่อเจ้าหน้าที่ให้รีเซ็ตรหัสผ่าน" });
    }

    // รหัสปัจจุบันผิดตอบ 400 ไม่ใช่ 401 — หน้าเว็บจะ logout อัตโนมัติเมื่อเจอ 401
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ ok: false, message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });

    // กติกาเดียวกับตอนตั้งรหัสผ่านที่อื่น — รหัสนักศึกษาไม่ผ่านกติกานี้อยู่แล้ว (ไม่มีตัวอักษร)
    const { validatePassword } = require("../utils/validatePassword");
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ ok: false, message: pwError });

    const hashed = await bcrypt.hash(newPassword, 10);
    // เพิกถอนทุก session เดิม (เครื่องอื่นต้องเข้าสู่ระบบใหม่) · เครื่องนี้ได้ token ใหม่ อายุหมดเท่าเดิม
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, passwordEnc: passwordEncFor(user.role, newPassword), tokenVersion: { increment: 1 } },
      select: { id: true, role: true, tokenVersion: true },
    });
    const token = jwt.sign({ id: updated.id, role: updated.role, tv: updated.tokenVersion, ...(req.user?.exp ? { exp: req.user.exp } : {}) },
      process.env.JWT_SECRET, req.user?.exp ? {} : { expiresIn: "7d" });
    res.json({ ok: true, message: "เปลี่ยนรหัสผ่านเรียบร้อย — เครื่องอื่นที่เข้าสู่ระบบไว้ต้องเข้าสู่ระบบใหม่", token });
  } catch (err) {
    console.error("[changeMyPassword]", err);
    res.status(500).json({ ok: false, message: "เปลี่ยนรหัสผ่านไม่สำเร็จ" });
  }
};

// ==========================================
// Google OAuth Login (students only)
// ==========================================
exports.loginWithGoogle = async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ ok: false, message: "ระบบ Google Login ยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ" });
  }
  try {
    const { id_token } = req.body;
    if (!id_token) {
      return res.status(400).json({ ok: false, message: "id_token required" });
    }

    const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    // โทเคนเสีย/หมดอายุ/ไม่ใช่ของแอปนี้ = ยืนยันตัวตนไม่ผ่าน (401) ไม่ใช่ server พัง (เดิมตกไป catch ล่างได้ 500)
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (verifyErr) {
      console.warn('[loginWithGoogle] verifyIdToken failed:', verifyErr.message);
      return res.status(401).json({ ok: false, message: "การยืนยันตัวตนด้วย Google ไม่ผ่านหรือหมดเวลา กรุณาเข้าสู่ระบบใหม่อีกครั้ง" });
    }
    const payload = ticket.getPayload();
    const email = payload.email;

    if (!email) {
      return res.status(400).json({ ok: false, message: "ไม่พบ email ใน Google token" });
    }

    if (!payload.email_verified) {
      return res.status(403).json({ ok: false, message: "กรุณายืนยัน email ของบัญชี Google ก่อนเข้าสู่ระบบ" });
    }

    if (!email.endsWith('@kkumail.com') && !email.endsWith('@kku.ac.th')) {
      return res.status(403).json({ ok: false, message: "กรุณาใช้ KKU Mail (@kkumail.com หรือ @kku.ac.th)" });
    }

    const user = await prisma.user.findFirst({
      where: { email, role: 'student' },
      include: { student: true },
    });
    if (!user || !user.student || user.student.deletedAt) {
      return res.status(401).json({ ok: false, message: "ไม่พบรายชื่อในระบบ กรุณาติดต่อเจ้าหน้าที่" });
    }

    const token = signSession(user, sessionTtl(req.body?.remember));
    return res.json({ ok: true, token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('[loginWithGoogle]', err);
    return res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการยืนยันตัวตน" });
  }
};
