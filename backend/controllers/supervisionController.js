const prisma = require('../config/prismaClient');
const fs = require('fs');
const path = require('path');
const { createNotifications, getStaffAndCoopTeacherIds } = require('../utils/notificationHelper');

// ==========================================
// ⚙️ [ADMIN] จัดการ Config ช่วงเวลานิเทศ (ผูกกับ CoopPeriod)
// ==========================================
exports.getSupervisionPeriods = async (_req, res) => {
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
exports.getAllSupervisions = async (_req, res) => {
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
        if (req.file) {
            const filePath = path.join(__dirname, '../uploads', req.file.filename);
            try { fs.unlinkSync(filePath); } catch (_) {}
        }
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

        // ค้นหาอาจารย์จาก advisorName: ลอง exact match ก่อน แล้วค่อย fallback
        // ป้องกัน: whitespace-only → contains("") → จับอาจารย์คนแรก random
        const advisorTrimmed = student.advisorName.trim();
        if (!advisorTrimmed) {
            return res.status(400).json({ ok: false, message: 'ไม่พบข้อมูลอาจารย์ที่ปรึกษา กรุณาอัปเดตในหน้า Profile' });
        }

        // แยก firstName + lastName จาก advisorName โดยกรองคำนำหน้า (ที่มีจุด เช่น ผศ., ดร.) ออกก่อน
        const rawParts = advisorTrimmed.split(/\s+/).filter(Boolean);
        const nameParts = rawParts.filter(p => !p.includes('.'));
        const lastName = nameParts.length >= 1 ? nameParts[nameParts.length - 1] : "";
        const firstName = nameParts.length >= 2 ? nameParts[nameParts.length - 2] : "";

        // ค้นหาด้วย firstName + lastName พร้อมกัน (ป้องกันนามสกุลซ้ำ)
        let teacher = lastName
            ? await prisma.teacher.findFirst({
                where: firstName
                    ? {
                        AND: [
                            { lastName: { contains: lastName } },
                            { firstName: { contains: firstName } },
                        ],
                    }
                    : { lastName: { contains: lastName } },
            })
            : null;

        // fallback: ค้นด้วยนามสกุลอย่างเดียวแบบ contains (กรณี firstName ไม่ตรง format)
        if (!teacher && lastName && lastName.length >= 2) {
            teacher = await prisma.teacher.findFirst({
                where: { lastName: { contains: lastName } },
            });
        }

        if (!teacher) {
            return res.status(400).json({ ok: false, message: `ไม่พบอาจารย์ที่ปรึกษา "${advisorTrimmed}" ในระบบ กรุณาติดต่อเจ้าหน้าที่` });
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

        // Fire notification async without blocking response
        getStaffAndCoopTeacherIds().then(ids =>
          createNotifications(ids, {
            type: 'SUPERVISION_PROPOSED',
            title: 'นักศึกษาเสนอวันนิเทศ',
            message: 'มีนักศึกษาเสนอวันนิเทศสหกิจศึกษา กรุณาตรวจสอบและยืนยัน',
            link: '/admin/students',
            relatedId: String(req.user.id),
          })
        ).catch(console.error);
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

        const teacher = await prisma.teacher.findUnique({ where: { userId } });
        if (!teacher) {
            return res.json({ ok: true, supervisions: [] });
        }

        const supervisions = await prisma.supervisionAppointment.findMany({
            where: {
                OR: [
                    { teacherId: teacher.id },
                    // ตรวจสอบความยาว firstName ก่อน ป้องกัน false-positive กับชื่อสั้น
                    ...(teacher.firstName && teacher.firstName.length >= 2
                        ? [{ coTeacherName: { contains: teacher.firstName } }]
                        : [])
                ]
            },
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

        const mappedData = supervisions.map(sup => ({
            ...sup,
            isPrimaryAdvisor: sup.teacherId === teacher.id
        }));

        res.json({ ok: true, supervisions: mappedData });
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

        if (!teacher) {
            return res.status(404).json({ ok: false, message: 'ไม่พบข้อมูลอาจารย์ในระบบ กรุณาติดต่อ Admin' });
        }

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
            if (!confirmedDate) {
                return res.status(400).json({ ok: false, message: 'กรุณาระบุวันที่นิเทศ' });
            }

            const chosenDate = new Date(confirmedDate);

            // ตรวจสอบวันซ้ำ: อาจารย์คนเดียวกัน ยืนยันวันเดียวกันไปแล้วกับนักศึกษาคนอื่น
            const startOfDay = new Date(chosenDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(chosenDate);
            endOfDay.setHours(23, 59, 59, 999);

            const conflict = await prisma.supervisionAppointment.findFirst({
                where: {
                    teacherId: teacher.id,
                    id: { not: parseInt(id) },
                    status: { in: ['DATE_CONFIRMED', 'LETTER_UPLOADED'] },
                    confirmedDate: { gte: startOfDay, lte: endOfDay }
                },
                include: { student: { select: { firstName: true, lastName: true } } }
            });

            if (conflict) {
                const conflictName = `${conflict.student.firstName} ${conflict.student.lastName}`;
                return res.status(409).json({
                    ok: false,
                    message: `วันนี้มีการนิเทศของ ${conflictName} อยู่แล้ว กรุณาเลือกวันอื่น`
                });
            }

            updateData = {
                status: 'DATE_CONFIRMED',
                confirmedDate: chosenDate,
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

// ==========================================
// แก้ไขวันนิเทศ — admin เท่านั้น ใช้ได้เมื่อยังไม่ออก PDF
// PUT /api/admin/supervisions/:id/confirmed-date
// ==========================================
exports.updateConfirmedDate = async (req, res) => {
    try {
        const { id } = req.params;
        const { confirmedDate } = req.body;

        if (!confirmedDate) {
            return res.status(400).json({ ok: false, message: 'กรุณาระบุวันที่นิเทศ' });
        }

        const supervision = await prisma.supervisionAppointment.findUnique({
            where: { id: parseInt(id) }
        });
        if (!supervision) {
            return res.status(404).json({ ok: false, message: 'ไม่พบข้อมูลการนัดหมาย' });
        }

        // ป้องกัน: ถ้าออก PDF แล้วแก้ไขไม่ได้
        if (supervision.officialLetterPath) {
            return res.status(400).json({ ok: false, message: 'ไม่สามารถแก้ไขได้ เนื่องจากออกหนังสือนิเทศแล้ว' });
        }

        const chosenDate = new Date(confirmedDate);

        // ตรวจสอบวันซ้ำกับอาจารย์คนเดียวกัน
        const startOfDay = new Date(chosenDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(chosenDate); endOfDay.setHours(23, 59, 59, 999);

        const conflict = await prisma.supervisionAppointment.findFirst({
            where: {
                teacherId: supervision.teacherId,
                id: { not: parseInt(id) },
                status: { in: ['DATE_CONFIRMED', 'LETTER_UPLOADED'] },
                confirmedDate: { gte: startOfDay, lte: endOfDay }
            },
            include: { student: { select: { firstName: true, lastName: true } } }
        });

        if (conflict) {
            return res.status(409).json({
                ok: false,
                message: `วันนี้มีการนิเทศของ ${conflict.student.firstName} ${conflict.student.lastName} อยู่แล้ว`
            });
        }

        const updated = await prisma.supervisionAppointment.update({
            where: { id: parseInt(id) },
            data: { confirmedDate: chosenDate }
        });

        res.json({ ok: true, appointment: updated });
    } catch (err) {
        console.error('updateConfirmedDate error:', err);
        res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดในการแก้ไขวันนิเทศ' });
    }
};

// ==========================================
// ปฏิทินนิเทศ — คืนรายการที่ยืนยันวันแล้วทั้งหมด
// เข้าถึงได้ทุก role (student / teacher / admin)
// ==========================================
exports.getSupervisionCalendar = async (_req, res) => {
    try {
        const appointments = await prisma.supervisionAppointment.findMany({
            where: {
                confirmedDate: { not: null },
                status: { in: ['DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED'] }
            },
            include: {
                student: { select: { studentId: true, firstName: true, lastName: true } }
            },
            orderBy: { confirmedDate: 'asc' }
        });

        const events = appointments.map(a => ({
            id: a.id,
            confirmedDate: a.confirmedDate,
            studentId: a.student.studentId,
            studentName: `${a.student.firstName} ${a.student.lastName}`,
            type: a.supervisionType,
            status: a.status
        }));

        res.json({ ok: true, events });
    } catch (err) {
        console.error("Get Calendar Error:", err);
        res.status(500).json({ ok: false, message: "ไม่สามารถดึงข้อมูลปฏิทินได้" });
    }
};
