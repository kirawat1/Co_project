const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prismaClient");
const axios = require("axios"); // ✅ ต้องลง npm install axios เพิ่ม
require("dotenv").config();

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
    

    console.log("Login attempt:", { id: req.user?.id, email, password, role });

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

    // หมายเหตุ: แนะนำให้ใช้ bcrypt.compare(password, user.password) ในอนาคต
    const valid = password === user.password; 
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
      role = "STUDENT";
      username = kkuUser.student_id;
    } else {
      role = "TEACHER";
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