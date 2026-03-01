const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ✅ 1. getProfile: เลียนแบบ logic ของ Student
exports.getProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;

    // หา Teacher พร้อมดึง email จากตาราง User
    const teacher = await prisma.teacher.findUnique({
      where: { userId: userId },
      include: { 
        user: { select: { email: true } } 
      }
    });

    // กรณี: เข้าใช้งานครั้งแรก (ยังไม่มีข้อมูลในตาราง Teacher)
    if (!teacher) {
      // ดึง Email จากตาราง User มาเพื่อแสดงผล
      const user = await prisma.user.findUnique({ 
        where: { id: userId },
        select: { email: true }
      });

      // ส่งค่าว่างกลับไป (Default Value) เหมือนของ Student
      return res.json({
        firstName: "",
        lastName: "",
        phone: "",
        faculty: "",
        major: null,
        email: user ? user.email : "", // ส่ง email ของ user กลับไป
        isFirstTime: true // ตัวช่วยบอก frontend
      });
    }

    // กรณี: มีข้อมูลแล้ว
    res.json({
      ...teacher,
      email: teacher.user ? teacher.user.email : "",
    });

  } catch (err) {
    console.error("GET PROFILE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ 2. updateProfile: แก้ไข Upsert ให้ถูกต้อง (แก้ Error ก่อนหน้า)
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, faculty, major } = req.body;
    
    if (!req.user || !req.user.id) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = req.user.id;

    // 1. ดึง Email ของ User ปัจจุบันก่อน (จำเป็นสำหรับ create ใน Prisma schema ของคุณ)
    const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
    });

    if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
    }

    // 2. ใช้ Upsert (Update หรือ Insert)
    const updated = await prisma.teacher.upsert({
      where: { 
        userId: userId 
      },
      // กรณีมีข้อมูลอยู่แล้ว -> อัปเดตข้อมูลทั่วไป
      update: { 
        firstName, 
        lastName, 
        phone, 
        faculty,
        major
      },
      // กรณีไม่มีข้อมูล (สร้างใหม่) -> ต้องใส่ฟิลด์ Required ให้ครบ
      create: { 
        firstName, 
        lastName, 
        phone, 
        faculty,
        major,
        email: currentUser.email, // ✅ ใส่ email ที่ดึงมา
        user: {                   
            connect: { id: userId } // ✅ เชื่อม Relation แบบที่ถูกต้อง
        }
      },
      include: {
        user: { select: { email: true } }
      }
    });

    // จัดรูปแบบข้อมูลส่งกลับ
    const result = {
      ...updated,
      email: updated.user ? updated.user.email : ""
    };

    res.json({ ok: true, data: result });
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    res.status(500).json({ message: "Update failed", error: err.message });
  }
};

// ... (โค้ดเดิม getProfile, updateProfile เก็บไว้เหมือนเดิม ห้ามลบ) ...

// ✅ 3. [ADMIN] ดึงรายชื่ออาจารย์ทั้งหมด
exports.getAllTeachers = async (req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      include: {
        user: { select: { email: true } } // ดึงอีเมลจากตาราง User
      },
      orderBy: { id: 'asc' }
    });

    // Map ข้อมูลจัดรูปแบบให้ Frontend ใช้ง่าย
    const result = teachers.map(t => ({
      ...t,
      email: t.user ? t.user.email : ""
    }));

    res.json(result);
  } catch (err) {
    console.error("GET ALL TEACHERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ 4. [ADMIN] แก้ไขข้อมูลอาจารย์รายคน (แก้ไขโดย ID ของ Teacher)
exports.updateTeacherById = async (req, res) => {
  try {
    const { id } = req.params; // รับ Teacher ID
    const { firstName, lastName, phone, faculty, major } = req.body;

    const updated = await prisma.teacher.update({
      where: { id: parseInt(id) }, // อัปเดตตาม Teacher ID
      data: {
        firstName,
        lastName,
        phone,
        faculty,
        major
      },
      include: {
        user: { select: { email: true } }
      }
    });

    res.json({ ok: true, data: { ...updated, email: updated.user?.email } });
  } catch (err) {
    console.error("UPDATE TEACHER BY ID ERROR:", err);
    res.status(500).json({ message: "Update failed", error: err.message });
  }
};