const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prismaClient");
const axios = require("axios"); // ✅ ต้องลง npm install axios เพิ่ม
const { OAuth2Client } = require('google-auth-library');
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
exports.signIn = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    

    if (!email || !password || !role) {
      return res.status(400).json({ ok: false, message: "กรุณากรอกข้อมูลให้ครบ" });
    }

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

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ ok: true, message: "เข้าสู่ระบบสำเร็จ", token, user: profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
};


// ==========================================
// 2. SSO Login (เพิ่มใหม่)
// ==========================================
exports.loginWithSSO = async (req, res) => {
  try {
    const { hash_id } = req.body;

    if (!hash_id) {
      return res.status(400).json({ ok: false, message: "Hash ID is required" });
    }

    
    // --- 1. ตรวจสอบกับ KKU API ---
    const KKU_API_URL = "https://reg2.kku.ac.th/api/v1.2";
    // ⚠️ อย่าลืมใส่ KKU_API_TOKEN ในไฟล์ .env
    const KKU_TOKEN = process.env.KKU_API_TOKEN; 

    const ssoResponse = await axios.post(
      `${KKU_API_URL}/auth/login/sso-hash-id`,
      {},
      {
        headers: {
          "Authorization": `Bearer ${KKU_TOKEN}`,
          "hash-id": hash_id
        }
      }
    );

    const ssoData = ssoResponse.data;
    if (ssoData.status.code !== 200 || !ssoData.data.payload) {
      return res.status(401).json({ ok: false, message: "การยืนยันตัวตนผ่าน SSO ล้มเหลว" });
    }
    // ลอง log ดูว่า token มีค่าไหม และ userId ถูกตั้งค่าตอนไหน

    const kkuUser = ssoData.data.payload.user;
    const kkuAccessToken = ssoData.data.access_token;

    // --- 2. กำหนด Role และ Username ---
    let role = "STUDENT";
    let username = "";

    // ถ้ารหัสนักศึกษาไม่ว่าง แปลว่าเป็นนักศึกษา
    if (kkuUser.student_id && kkuUser.student_id.trim() !== "") {
      role = "student";  // ใช้ lowercase ตรงกับ Prisma enum
      username = kkuUser.student_id;
    } else {
      role = "teacher";  // ใช้ lowercase ตรงกับ Prisma enum
      // บุคลากรใช้ citizen_id หรือ email เป็น username
      username = kkuUser.username || kkuUser.citizen_id;
    }

    // --- 3. Upsert User (Table User) ---
    const user = await prisma.user.upsert({
      where: { username: username }, // ค้นหาจาก username
      update: {
        kkuAccessToken: kkuAccessToken,
        email: kkuUser.mail,
        // อัปเดตข้อมูลล่าสุดเสมอ
      },
      create: {
        username: username,
        email: kkuUser.mail,
        role: role, // student หรือ teacher
        provider: "kku-sso",
        kkuAccessToken: kkuAccessToken,
        // citizenId: kkuUser.citizen_id // ถ้าใน Model User มี field นี้ให้ uncomment
      }
      
    });

    // --- 4. จัดการข้อมูล Profile (Student / Teacher) ---
    if (role === "student") {
      // 4.1 ดึงข้อมูลรายละเอียดนักศึกษาเพิ่ม (API: /student/info)
      let extraInfo = {};
      try {
        const infoRes = await axios.get(`${KKU_API_URL}/student/info`, {
          headers: { "x-access-token": kkuAccessToken } // ใช้ Token ของ นศ. เอง
        });
        if (infoRes.data.status.code === 200) {
           extraInfo = infoRes.data.student_info;
        }
      } catch (e) {
        console.warn("Fetch extra student info warning:", e.message);
      }

      // 4.2 Mapping ข้อมูล
      const majorEnum = mapMajor(extraInfo.program_name); 
      const prefixEnum = mapPrefix(kkuUser.prefix || extraInfo.prefix);

      // 4.3 Upsert Student
      await prisma.student.upsert({
        where: { userId: user.id },
        update: {
           firstName: kkuUser.firstname_th,
           lastName: kkuUser.lastname_th,
           firstNameEn: kkuUser.firstname,
           lastNameEn: kkuUser.lastname,
           email: kkuUser.mail,
           
           // ข้อมูลจาก API Info
           curriculum: extraInfo.program_name,
           year: extraInfo.student_year ? extraInfo.student_year.toString() : undefined,
           gpa: extraInfo.gpa ? parseFloat(extraInfo.gpa) : undefined,
           major: majorEnum || undefined,
           
           apiSyncedAt: new Date()
        },
        create: {
           userId: user.id,
           studentId: kkuUser.student_id,
           
           prefix: prefixEnum,
           firstName: kkuUser.firstname_th,
           lastName: kkuUser.lastname_th,
           firstNameEn: kkuUser.firstname,
           lastNameEn: kkuUser.lastname,
           email: kkuUser.mail,
           
           // ข้อมูลการศึกษา
           curriculum: extraInfo.program_name,
           year: extraInfo.student_year ? extraInfo.student_year.toString() : null,
           gpa: extraInfo.gpa ? parseFloat(extraInfo.gpa) : 0.00,
           major: majorEnum,
           
           // Default Values
           coreGpa: 0.00,
           activityUnit: 0,
           isPassPrepCourse: false,
           isQualified: false,
           
           apiSyncedAt: new Date()
        }
      });

    } else if (role === "teacher") {
      // Upsert Teacher
      await prisma.teacher.upsert({
        where: { userId: user.id },
        update: {
           firstName: kkuUser.firstname_th,
           lastName: kkuUser.lastname_th,
           email: kkuUser.mail
        },
        create: {
           userId: user.id,
           firstName: kkuUser.firstname_th,
           lastName: kkuUser.lastname_th,
           email: kkuUser.mail, 
           
           // Default Values
           phone: null,
           faculty: null,
           major: null
        }
      });
    }

    // --- 5. สร้าง JWT Token ของระบบเรา ---
    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Prepare Response
    const profile = {
      id: user.id,
      email: user.email,
      role: user.role,
      username: user.username,
      fullName: `${kkuUser.firstname_th} ${kkuUser.lastname_th}`
    };

    return res.json({ 
      ok: true, 
      message: "เข้าสู่ระบบด้วย SSO สำเร็จ", 
      token, 
      user: profile 
    });

  } catch (err) {
    console.error("SSO Login Error:", err.response?.data || err.message);
    return res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการเชื่อมต่อ SSO" });
  }
};

// ==========================================
// 3. Get Profile (โค้ดเดิมของคุณ)
// ==========================================
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
      include: { student: true, teacher: true }, // ✅ Include teacher ด้วยเผื่อเป็นอาจารย์
    });

    if (!user) return res.status(404).json({ ok: false, message: "ไม่พบผู้ใช้งาน" });

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
        gpa: user.student.gpa,              // 4
        major: user.student.major,          // CS
        curriculum: user.student.curriculum,// CS
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
// 3. KKU REG Account Login (username + KKU password)
// POST /api/auth/login-kku
// ==========================================
const kkuReg = require('../services/kkuRegService');

exports.loginWithKKU = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ ok: false, message: "กรุณากรอก KKU Username และ Password" });
    }

    // 1. ยืนยันตัวตนกับ KKU REG
    const tokenResult = await kkuReg.getStudentToken(username.trim(), password);
    if (!tokenResult || tokenResult.error) {
      return res.status(401).json({
        ok: false,
        message: tokenResult?.error || "ไม่สามารถเชื่อมต่อ KKU REG ได้"
      });
    }
    const kkuToken = tokenResult;

    // 2. ดึงข้อมูลจาก REG
    const [info, advisor] = await Promise.allSettled([
      kkuReg.getStudentInfo(kkuToken),
      kkuReg.getAdvisor(kkuToken),
    ]);
    const studentInfo = info.status === "fulfilled" ? info.value : null;
    const advisorInfo = advisor.status === "fulfilled" ? advisor.value : null;

    if (!studentInfo) {
      return res.status(401).json({ ok: false, message: "ดึงข้อมูลจาก KKU REG ไม่สำเร็จ" });
    }

    // 3. ค้นหา email ในระบบ (email ที่ login = KKU email)
    const email = (studentInfo.mail || studentInfo.email || username).toLowerCase();
    let user = await prisma.user.findFirst({
      where: { OR: [{ email }, { username: email }] },
      include: { student: true, teacher: true },
    });

    if (!user) {
      // ── ชั้นที่ 1: ตรวจว่า account ถูก block ไว้หรือไม่ ──
      // (ใช้ blacklist email ถ้าต้องการ เช่น student ที่ลาออกไปแล้ว)

      // ── ชั้นที่ 2: ตรวจคณะ/วิทยาลัย ──
      // อนุญาตเฉพาะนักศึกษาวิทยาลัยการคอมพิวเตอร์ มข. เท่านั้น
      // ใช้ exact match (trimmed lowercase) เพื่อป้องกัน substring bypass เช่น "Cloud Computing"
      const ALLOWED_FACULTIES = [
        "วิทยาลัยการคอมพิวเตอร์",
        "college of computing",
      ];
      const facultyFromReg = (
        studentInfo.faculty_name_th ||
        studentInfo.faculty_name_en ||
        studentInfo.faculty_name || ""
      ).trim().toLowerCase();

      const isAllowedFaculty = ALLOWED_FACULTIES.some(f => facultyFromReg === f.toLowerCase());
      if (!isAllowedFaculty) {
        return res.status(403).json({
          ok: false,
          message: `ระบบสหกิจนี้สำหรับนักศึกษาวิทยาลัยการคอมพิวเตอร์เท่านั้น (คณะที่ตรวจพบ: "${studentInfo.faculty_name_th || "-"}")`,
        });
      }

      // ── ชั้นที่ 3: ตรวจชั้นปี ──
      // อนุญาตเฉพาะปี 3 ขึ้นไป — ถ้าไม่ทราบชั้นปี (classYear=0) ให้ block ไว้ก่อน
      const classYear = parseInt(studentInfo.class_year || "0");
      if (classYear === 0) {
        return res.status(403).json({
          ok: false,
          message: "ไม่สามารถตรวจสอบชั้นปีได้จาก KKU REG กรุณาติดต่อเจ้าหน้าที่วิทยาลัยการคอมพิวเตอร์",
        });
      }
      if (classYear < 3) {
        return res.status(403).json({
          ok: false,
          message: `นักศึกษาชั้นปีที่ ${classYear} ยังไม่สามารถเข้าระบบสหกิจได้ (เปิดสำหรับปี 3 ขึ้นไป)`,
        });
      }

      // ── ผ่านการตรวจสอบ → สร้างบัญชีใหม่ ──
      const studentIdRaw = studentInfo.student_id || studentInfo.stdnt_id || "";
      if (!studentIdRaw) {
        return res.status(400).json({
          ok: false, message: "ไม่พบรหัสนักศึกษาจาก KKU REG กรุณาติดต่อเจ้าหน้าที่",
        });
      }

      // ── ตรวจ studentId ซ้ำ (อาจมีบัญชีที่สมัครด้วยตนเองด้วย studentId เดิม) ──
      const existingByStudentId = await prisma.student.findUnique({
        where: { studentId: studentIdRaw.toString() },
      });
      if (existingByStudentId) {
        return res.status(409).json({
          ok: false,
          message: "รหัสนักศึกษานี้มีในระบบแล้ว (อาจสมัครด้วยตนเองไว้แล้ว) กรุณา login ด้วย email/password ที่ลงทะเบียนไว้",
        });
      }

      const defaultHash = await bcrypt.hash("1111111111111", 10);
      const advName = advisorInfo
        ? [advisorInfo.prefix_th, advisorInfo.first_name_th, advisorInfo.last_name_th].filter(Boolean).join(" ")
        : null;
      const prefixRaw = (studentInfo.prefix_th || "").toLowerCase().replace(".", "");
      const prefix = ["mr","นาย"].includes(prefixRaw) ? "MR"
        : ["ms","miss","mrs","นางสาว","นาง"].includes(prefixRaw) ? "MS" : undefined;

      user = await prisma.user.create({
        data: {
          username: email, email, password: defaultHash, role: "student",
          student: {
            create: {
              studentId:   studentIdRaw.toString(),
              firstName:   studentInfo.first_name_th  || "นักศึกษา",
              lastName:    studentInfo.last_name_th   || "ใหม่",
              firstNameEn: studentInfo.first_name_en  || null,
              lastNameEn:  studentInfo.last_name_en   || null,
              curriculum:  studentInfo.faculty_name_th || null,
              major:       studentInfo.major_name_th   || null,
              year:        studentInfo.class_year ? String(studentInfo.class_year) : null,
              advisorName: advName,
              ...(prefix ? { prefix } : {}),
            },
          },
        },
        include: { student: true, teacher: true },
      });
      console.log(`[KKU] auto-created student: ${email} (${studentIdRaw})`);
    }

    // 4. อัปเดตข้อมูลนักศึกษาจาก REG (ถ้าเป็น student)
    if (user.role === "student" && user.student && studentInfo) {
      const updateData = {};
      if (studentInfo.first_name_th)  updateData.firstName   = studentInfo.first_name_th;
      if (studentInfo.last_name_th)   updateData.lastName    = studentInfo.last_name_th;
      if (studentInfo.first_name_en)  updateData.firstNameEn = studentInfo.first_name_en;
      if (studentInfo.last_name_en)   updateData.lastNameEn  = studentInfo.last_name_en;
      if (studentInfo.faculty_name_th) updateData.curriculum = studentInfo.faculty_name_th;
      if (studentInfo.major_name_th)  updateData.major       = studentInfo.major_name_th;
      if (studentInfo.class_year)     updateData.year        = String(studentInfo.class_year);
      if (advisorInfo) {
        const advName = [advisorInfo.prefix_th, advisorInfo.first_name_th, advisorInfo.last_name_th]
          .filter(Boolean).join(" ");
        if (advName) updateData.advisorName = advName;
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.student.update({ where: { id: user.student.id }, data: updateData });
      }
    }

    // 5. สร้าง JWT ของระบบ
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    let profile = { id: user.id, email: user.email, role: user.role };
    if (user.role === "student" && user.student) {
      profile = { ...profile, studentId: user.student.studentId,
        firstName: user.student.firstName, lastName: user.student.lastName };
    } else if (user.role === "teacher" && user.teacher) {
      profile = { ...profile, firstName: user.teacher.firstName, lastName: user.teacher.lastName };
    }

    return res.json({ ok: true, message: "เข้าสู่ระบบด้วย KKU สำเร็จ", token, user: profile });
  } catch (err) {
    console.error("[loginWithKKU]", err);
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
    if (!/^\d{13}$/.test(password.trim())) {
      return res.status(400).json({ ok: false, message: "รหัสผ่านต้องเป็นเลขบัตรประชาชน 13 หลัก" });
    }
    if (!/^[^@\s]+@(kkumail\.com|kku\.ac\.th)$/i.test(email.trim())) {
      return res.status(400).json({ ok: false, message: "กรุณาใช้อีเมล @kkumail.com หรือ @kku.ac.th" });
    }

    const emailLower = email.trim().toLowerCase();

    // ตรวจ duplicate
    const existEmail = await prisma.user.findFirst({ where: { OR: [{ email: emailLower }, { username: emailLower }] } });
    if (existEmail) return res.status(409).json({ ok: false, message: "อีเมลนี้มีในระบบแล้ว" });

    const existId = await prisma.student.findUnique({ where: { studentId: studentId.trim() } });
    if (existId) return res.status(409).json({ ok: false, message: "รหัสนักศึกษานี้มีในระบบแล้ว" });

    const hashed = await bcrypt.hash(password.trim(), 10);
    const prefixEnum = mapPrefix(prefix) || undefined;

    const user = await prisma.user.create({
      data: {
        username: emailLower, email: emailLower, password: hashed, role: "student",
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

    const token = jwt.sign({ id: user.id, role: "student" }, process.env.JWT_SECRET, { expiresIn: "24h" });
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
    console.error("[registerStudent]", err);
    res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
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
    const ticket = await googleClient.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
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

    const user = await prisma.user.findFirst({ where: { email, role: 'student' } });
    if (!user) {
      return res.status(401).json({ ok: false, message: "ไม่พบรายชื่อในระบบ กรุณาติดต่อเจ้าหน้าที่" });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ ok: true, token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('[loginWithGoogle]', err);
    return res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการยืนยันตัวตน" });
  }
};
