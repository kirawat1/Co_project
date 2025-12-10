// Backend/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prismaClient');
const dotenv = require('dotenv');
dotenv.config();

// ---------------- Helper: ดึงข้อมูลโปรไฟล์ตาม Role ----------------
const getProfileByRole = async (user) => {
    switch (user.role) {
        case 'STUDENT':
            const student = await prisma.student.findUnique({
                where: { userId: user.id },
            });
            return student || { firstName: 'Student', lastName: 'Profile Missing' };

        case 'ADMIN':
        case 'TEACHER':
        case 'MENTOR':
            return { 
                firstName: user.role.charAt(0) + user.role.slice(1).toLowerCase(),
                lastName: 'User'
            };

        default:
            return null;
    }
};

// ---------------- Login / Sign In ----------------
exports.signIn = async (req, res) => {
    const { email, password, role } = req.body;
    const prismaRole = role.toUpperCase(); // frontend role → Prisma ENUM

    try {
        const user = await prisma.user.findFirst({
            where: {
                email,
                role: prismaRole
            },
        });

        if (!user) {
            return res.status(401).json({ ok: false, message: 'อีเมลหรือบทบาทไม่ถูกต้อง' });
        }

        // ตรวจสอบรหัสผ่าน
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ ok: false, message: 'รหัสผ่านไม่ถูกต้อง' });
        }

        // ออก token
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        const profile = await getProfileByRole(user);

        return res.status(200).json({
            ok: true,
            token,
            user: {
                email: user.email,
                role: user.role.toLowerCase(),
                profile
            }
        });

    } catch (error) {
        console.error('Sign In Error:', error);
        return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    }
};


// ---------------- Register / Sign Up (ใช้ Prisma Transaction) ----------------
exports.signUp = async (req, res) => {
    const { email, studentId, firstName, lastName, phone, gpa, major, curriculum, nationality } = req.body;

    try {
        // ตรวจความซ้ำ
        if (await prisma.user.findUnique({ where: { email } })) {
            return res.status(400).json({ ok: false, message: 'อีเมลนี้ถูกใช้แล้ว' });
        }

        if (await prisma.student.findUnique({ where: { studentId } })) {
            return res.status(400).json({ ok: false, message: 'รหัสนักศึกษานี้ถูกใช้แล้ว' });
        }

        const hashedPassword = await bcrypt.hash(studentId, 10);

        // ใช้ Transaction สร้าง user + student พร้อมกัน
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    role: 'STUDENT'
                },
            });

            const student = await tx.student.create({
                data: {
                    userId: user.id,
                    studentId,
                    firstName,
                    lastName,
                    phone,
                    gpa,
                    major,
                    curriculum,
                    nationality
                },
            });

            return { user, student };
        });

        const token = jwt.sign(
            { id: result.user.id, role: result.user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        return res.status(201).json({
            ok: true,
            message: 'สมัครสมาชิกสำเร็จ',
            token,
            user: {
                email: result.user.email,
                role: result.user.role.toLowerCase(),
            }
        });

    } catch (error) {
        console.error('Signup Error:', error);
        return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
    }
};
