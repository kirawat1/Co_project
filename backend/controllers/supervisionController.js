const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// ==========================================
// ⚙️ [ADMIN] จัดการ Config ช่วงเวลานิเทศ (ผูกกับ CoopPeriod)
// ==========================================
exports.getSupervisionPeriods = async (req, res) => {
    try {
        const periods = await prisma.coopPeriod.findMany({
            orderBy: [
                { academicYear: 'desc' },
                { semester: 'desc' } 
            ]
        });
        res.json({ ok: true, periods });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
};

exports.saveSupervisionPeriod = async (req, res) => {
    try {
        const { periodId, isSupervisionOpen, supervisionStartDate, supervisionEndDate } = req.body;

        const updatedPeriod = await prisma.coopPeriod.update({
            where: { id: parseInt(periodId) },
            data: {
                isSupervisionOpen,
                supervisionStartDate: supervisionStartDate ? new Date(supervisionStartDate) : null,
                supervisionEndDate: supervisionEndDate ? new Date(supervisionEndDate) : null
            }
        });

        res.json({ ok: true, period: updatedPeriod });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
};

// ==========================================
// 👩‍💼 [ADMIN] จัดการรายการนิเทศและอัปโหลดหนังสือ
// ==========================================
exports.getAllSupervisions = async (req, res) => {
    try {
        const supervisions = await prisma.supervisionAppointment.findMany({
            include: {
                student: {
                    include: { coop: { include: { company: true } } }
                },
                teacher: true
            },
            orderBy: { updatedAt: 'desc' }
        });
        res.json({ ok: true, supervisions });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
};

exports.uploadOfficialLetter = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ ok: false, message: 'กรุณาอัปโหลดไฟล์ PDF' });
        }

        const appointment = await prisma.supervisionAppointment.update({
            where: { id: parseInt(id) },
            data: { officialLetterPath: req.file.filename, status: 'LETTER_UPLOADED' }
        });

        res.json({ ok: true, appointment });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, message: 'Upload error' });
    }
};

// ==========================================
// 👨‍🎓 [STUDENT] ฝั่งนักศึกษา
// ==========================================
exports.getStudentSupervision = async (req, res) => {
    try {
        const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
        if (!student) return res.status(404).json({ ok: false, message: 'Student not found' });

        const appointment = await prisma.supervisionAppointment.findUnique({
            where: { studentId: student.id }
        });

        res.json({ ok: true, appointment });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
};

exports.proposeSupervisionDate = async (req, res) => {
    try {
        const { proposedDates, supervisionType, onlineLink, coTeacherName } = req.body;
        const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
        
        if (!student) return res.status(404).json({ ok: false, message: 'Student not found' });

        // หา Teacher ID จากชื่อที่ปรึกษา
        if (!student.advisorName) {
            return res.status(400).json({ ok: false, message: 'ไม่พบข้อมูลอาจารย์ที่ปรึกษา กรุณาอัปเดตในหน้า Profile' });
        }

        // หาชื่ออาจารย์จากนามสกุล (หรือจะเปลี่ยนเป็นค้นหาด้วยวิธีอื่นตามที่คุณออกแบบไว้)
        const teacherName = student.advisorName.split(' ').pop(); 
        const teacher = await prisma.teacher.findFirst({
            where: { lastName: { contains: teacherName } }
        });

        if (!teacher) {
            return res.status(400).json({ ok: false, message: 'ไม่พบข้อมูลอาจารย์ที่ปรึกษาในระบบ กรุณาติดต่อเจ้าหน้าที่' });
        }

        const appointment = await prisma.supervisionAppointment.upsert({
            where: { studentId: student.id },
            update: {
                teacherId: teacher.id, // 🟢 เพิ่มบรรทัดนี้! เพื่อบังคับให้อัปเดตอาจารย์หลักเป็นคนปัจจุบันเสมอ
                proposedDates,
                supervisionType,
                onlineLink,
                coTeacherName,
                status: 'PENDING_TEACHER',
                rejectReason: null
            },
            create: {
                studentId: student.id,
                teacherId: teacher.id,
                proposedDates,
                supervisionType,
                onlineLink,
                coTeacherName,
                status: 'PENDING_TEACHER'
            }
        });

        res.json({ ok: true, appointment });
    } catch (err) {
        console.error("Propose Supervision Error:", err);
        res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดในการบันทึก' });
    }
};

// ==========================================
// 👨‍🏫 [TEACHER] ฝั่งอาจารย์
// ==========================================
exports.getTeacherSupervisions = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 1. เช็คก่อนว่ามีโปรไฟล์ Teacher ไหม
        const teacher = await prisma.teacher.findUnique({ where: { userId } });
        
        // 🚨 ลบเงื่อนไข where: { teacherId: teacher.id } ออกชั่วคราว เพื่อทดสอบดึงเด็กทุกคน!
        const supervisions = await prisma.supervisionAppointment.findMany({
            // where: { teacherId: teacher.id },  <--- (คอมเมนต์บรรทัดนี้ไว้ก่อน)
            include: {
                student: {
                    select: {
                        studentId: true, firstName: true, lastName: true, phone: true,
                        coop: { include: { company: true } }
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        res.json({ ok: true, supervisions });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
};

// ==========================================
// อัปเดตอาจารย์นิเทศร่วม (Co-Teachers)
// ==========================================
exports.assignCoTeachers = async (req, res) => {
    try {
        const { id } = req.params;
        const { coTeacherName } = req.body; // รับเป็น String เช่น "ผศ.ดร.ก, อ.ข"

        await prisma.supervisionAppointment.update({
            where: { id: parseInt(id) },
            data: { coTeacherName: coTeacherName } // บันทึกลงฐานข้อมูล
        });

        res.json({ ok: true, message: "อัปเดตอาจารย์นิเทศร่วมสำเร็จ" });
    } catch (error) {
        console.error("Assign Co-Teachers Error:", error);
        res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
    }
};

// ==========================================
// 1. ดึงรายการนัดหมายนิเทศของอาจารย์ (ทั้งหลัก และ ร่วม)
// ==========================================
exports.getSupervisionsForTeacher = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. หาข้อมูลอาจารย์คนนี้จาก userId
        const teacher = await prisma.teacher.findUnique({
            where: { userId: parseInt(userId) }
        });

        if (!teacher) {
            return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลอาจารย์" });
        }

        // 2. ดึงข้อมูลการนิเทศ จากตาราง SupervisionAppointment โดยตรง
        const supervisions = await prisma.supervisionAppointment.findMany({ 
            where: {
                OR: [
                    // 🟢 เงื่อนไขที่ 1: เป็นที่ปรึกษาหลัก (ดูจาก teacherId ตรงๆ ได้เลย!)
                    { teacherId: teacher.id },
                    
                    // 🟢 เงื่อนไขที่ 2: เป็นอาจารย์นิเทศร่วม (ค้นหาจากชื่อใน coTeacherName)
                    { coTeacherName: { contains: teacher.firstName } }
                ]
            },
            include: {
                student: {
                    include: {
                        coop: { include: { company: true } }
                    }
                },
                teacher: true // ข้อมูลของอาจารย์หลัก
            },
            orderBy: { id: 'desc' }
        });

        // 3. Map ข้อมูลเพื่อส่งค่า isPrimaryAdvisor ไปบอกหน้าเว็บว่าคนนี้คืออาจารย์หลักหรือไม่
        const mappedData = supervisions.map(sup => {
            return {
                ...sup,
                // ถ้า teacherId ในคิวนิเทศ ตรงกับ id ของอาจารย์ที่ล็อกอิน แปลว่าเป็น "อาจารย์หลัก" (ได้สิทธิ์กดยืนยันเวลา)
                isPrimaryAdvisor: sup.teacherId === teacher.id 
            };
        });

        res.json({ ok: true, supervisions: mappedData });
    } catch (err) {
        console.error("====== Get Supervisions Error ======");
        console.error(err);
        res.status(500).json({ ok: false, message: "ไม่สามารถดึงข้อมูลนัดหมายได้" });
    }
};

// ==========================================
// 2. พิจารณาวันนิเทศ (อนุมัติ / ตีกลับ)
// ==========================================
exports.reviewSupervision = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, confirmedDate, rejectReason } = req.body;
        const userId = req.user.id;

        // 1. ดึงข้อมูลอาจารย์ที่ล็อกอิน
        const teacher = await prisma.teacher.findUnique({
            where: { userId: parseInt(userId) }
        });

        // 2. ดึงข้อมูลการนิเทศรายการนี้
        const supervision = await prisma.supervisionAppointment.findUnique({
            where: { id: parseInt(id) }
        });

        if (!supervision) {
            return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลการนัดหมาย" });
        }

        // 🛡️ ป้องกันความปลอดภัย: เช็คจาก teacherId ในตาราง Supervision โดยตรง
        // ถ้า teacherId ไม่ตรงกับ id ของอาจารย์ที่ล็อกอิน แปลว่าเป็นแค่อาจารย์ร่วม ไม่มีสิทธิ์กด
        if (supervision.teacherId !== teacher.id) {
            return res.status(403).json({ 
                ok: false, 
                message: "คุณไม่มีสิทธิ์ทำรายการนี้ เฉพาะอาจารย์ที่ปรึกษาหลักเท่านั้น" 
            });
        }

        let updateData = {};
        if (action === 'APPROVE') {
            updateData = {
                status: 'DATE_CONFIRMED',
                confirmedDate: new Date(confirmedDate),
                rejectReason: null
            };
        } else if (action === 'REJECT') {
            updateData = {
                status: 'TEACHER_REJECTED',
                confirmedDate: null,
                rejectReason: rejectReason
            };
        }

        // 3. บันทึกข้อมูล
        await prisma.supervisionAppointment.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        res.json({ ok: true, message: "บันทึกผลพิจารณาสำเร็จ" });
    } catch (err) {
        console.error("Review Supervision Error:", err);
        res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
    }
};