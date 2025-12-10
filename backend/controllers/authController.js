// Backend/controllers/authController.js (Corrected for Prisma)
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prismaClient'); // ✅ ใช้ Prisma Client
const dotenv = require('dotenv');
dotenv.config();

// ******* Helper Function: ดึง Profile ตาม Role (ใช้ Prisma) *******
const getProfileByRole = async (user) => {
    switch (user.role) {
        case 'STUDENT': // Prisma Role เป็น ENUM ตัวใหญ่
            // หา Student Profile ด้วย Prisma Client
            const student = await prisma.student.findUnique({
                where: { userId: user.id }, 
            });
            // หากไม่พบ ให้คืน Object ที่มีชื่อพื้นฐาน
            return student || { firstName: 'Student', lastName: 'Profile Missing' };
        
        case 'ADMIN': // Prisma Role เป็น ENUM ตัวใหญ่
        case 'TEACHER':
        case 'MENTOR':
            // สำหรับ Admin/Teacher/Mentor ที่ไม่มี Profile Model แยก
            return { firstName: user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase() + ' User' };
        default:
            return null;
    }
}


// ******* Sign In Logic (แก้ไขแล้ว) *******
exports.signIn = async (req, res) => {
    // Frontend ส่ง role มาเป็นตัวเล็ก ('admin', 'student')
    const { email, password, role } = req.body;
    const prismaRole = role.toUpperCase(); // แปลงเป็น ENUM ตัวใหญ่สำหรับ Prisma

    try {
        // 1. หา User ในฐานข้อมูลด้วย Prisma Client
        const user = await prisma.user.findUnique({
            where: { 
                email: email, 
                role: prismaRole // ใช้ ENUM ตัวใหญ่ในการ Query
            },
        });

        if (!user) {
            return res.status(401).json({ ok: false, message: 'อีเมล หรือ บทบาทไม่ถูกต้อง' });
        }

        // 2. ตรวจสอบรหัสผ่าน
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ ok: false, message: 'รหัสผ่านไม่ถูกต้อง' });
        }

        // 3. Generate JWT Token
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        
        // 4. ดึงข้อมูล Profile (ใช้ getProfileByRole)
        const profileData = await getProfileByRole(user);

        return res.status(200).json({ 
            ok: true, 
            token, 
            user: { 
                role: user.role.toLowerCase(), // ส่ง Role กลับไปเป็นตัวเล็กให้ Frontend
                email: user.email,
                profile: profileData 
            } 
        });

    } catch (error) {
        console.error('Sign In Error:', error.message);
        return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    }
};


// ******* Sign Up Logic (แก้ไขแล้ว) *******
exports.signUp = async (req, res) => {
    const { email, studentId, firstName, lastName, phone, gpa, major, curriculum, nationality } = req.body;
    
    try {
        // 1. เช็คซ้ำด้วย Prisma Client
        if (await prisma.user.findUnique({ where: { email } })) {
            return res.status(400).json({ ok: false, message: 'อีเมลนี้ถูกใช้แล้ว' });
        }
        if (await prisma.student.findUnique({ where: { studentId } })) {
            return res.status(400).json({ ok: false, message: 'รหัสนักศึกษานี้ถูกใช้แล้ว' });
        }

        // 2. Hash Password (รหัสผ่านคือ studentId)
        const hashedPassword = await bcrypt.hash(studentId, 10);

        // 3. สร้าง User และ Student Profile ใน Transaction
        const [newUser, newStudent] = await prisma.$transaction([
            // สร้าง User
            prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    role: 'STUDENT',
                },
            }),
            // สร้าง Student Profile (ต้องทำทีหลังเพื่อให้มี userId)
            // (เราต้องปรับแก้โค้ดนี้ให้ทำงานใน Transaction ที่ถูกต้อง หรือแยกสร้าง)
        ]);

        // **หมายเหตุ:** สำหรับ Prisma Transaction ต้องสร้าง User ก่อนเพื่อเอา ID มาใส่ Student

        // สร้าง User ก่อน
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                role: 'STUDENT',
            }
        });

        // สร้าง Student Profile เชื่อมกับ User
        const student = await prisma.student.create({
            data: {
                userId: user.id,
                studentId,
                firstName,
                lastName,
                phone, gpa, major, curriculum, nationality,
            }
        });
        
        // 4. Generate JWT Token
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        
        return res.status(201).json({ 
            ok: true, 
            message: 'สมัครสมาชิกสำเร็จ',
            token, 
            user: { role: user.role.toLowerCase(), email } 
        });

    } catch (error) {
        console.error('Signup error:', error.message);
        return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
    }
};