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

        const parsedPeriodId = parseInt(periodId, 10);
        if (isNaN(parsedPeriodId) || parsedPeriodId <= 0) {
            return res.status(400).json({ ok: false, message: 'periodId ไม่ถูกต้อง' });
        }

        const updatedPeriod = await prisma.coopPeriod.update({
            where: { id: parsedPeriodId },
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
            where: { student: { deletedAt: null } },
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

        let appointment;
        try {
            await prisma.$transaction(async (tx) => {
                const current = await tx.supervisionAppointment.findUnique({ where: { id: parseInt(id) } });
                if (!current || current.status !== 'DATE_CONFIRMED') {
                    throw Object.assign(new Error('สามารถออกหนังสือนิเทศได้เฉพาะเมื่อยืนยันวันแล้ว'), { is400: true });
                }
                appointment = await tx.supervisionAppointment.update({
                    where: { id: parseInt(id) },
                    data: { officialLetterPath: req.file.filename, status: 'LETTER_UPLOADED' }
                });
            });
        } catch (txErr) {
            if (req.file) {
                const fp = path.join(__dirname, '../uploads', req.file.filename);
                if (fs.existsSync(fp)) fs.unlinkSync(fp);
            }
            if (txErr.is400) return res.status(400).json({ ok: false, message: txErr.message });
            throw txErr;
        }

        res.json({ ok: true, appointment });

        // Notify student
        prisma.student.findUnique({ where: { id: appointment.studentId }, select: { userId: true } })
          .then(student => {
            if (student?.userId) {
              return createNotifications([student.userId], {
                type: 'SUPERVISION_LETTER_UPLOADED',
                title: 'หนังสือนิเทศอนุมัติแล้ว',
                message: 'หนังสือนิเทศได้รับการอนุมัติ เตรียมพร้อมรับการนิเทศ',
                link: '/student/supervision',
                relatedId: String(appointment.studentId),
              });
            }
          })
          .catch(console.error);
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
        if (!student || student.deletedAt) return res.status(404).json({ ok: false, message: 'Student not found' });

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
        if (supervisionType !== undefined && supervisionType !== 'ONLINE' && supervisionType !== 'ONSITE') {
            return res.status(400).json({ ok: false, message: 'supervisionType ต้องเป็น ONLINE หรือ ONSITE เท่านั้น' });
        }
        const student = await prisma.student.findUnique({ where: { userId: req.user.id } });

        if (!student || student.deletedAt) return res.status(404).json({ ok: false, message: 'Student not found' });

        // หา Teacher จาก generalAdvisorId (FK) โดยตรง ป้องกัน data leak จากการ substring match
        if (!student.generalAdvisorId) {
            return res.status(400).json({ ok: false, message: 'ไม่พบอาจารย์ที่ปรึกษา กรุณาอัปเดตในหน้า Profile' });
        }

        const teacher = await prisma.teacher.findUnique({ where: { id: student.generalAdvisorId } });
        if (!teacher) {
            return res.status(400).json({ ok: false, message: 'ไม่พบข้อมูลอาจารย์ที่ปรึกษาในระบบ กรุณาติดต่อเจ้าหน้าที่' });
        }

        const LOCKED_STATUSES = ['DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED'];

        const appointment = await prisma.$transaction(async (tx) => {
            const existing = await tx.supervisionAppointment.findUnique({
                where: { studentId: student.id },
                select: { status: true }
            });
            if (existing && LOCKED_STATUSES.includes(existing.status)) {
                const err = new Error('LOCKED');
                err.status = 403;
                throw err;
            }
            return tx.supervisionAppointment.upsert({
                where: { studentId: student.id },
                update: {
                    teacherId: teacher.id,
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
        }).catch(err => {
            if (err.status === 403) {
                res.status(403).json({ ok: false, message: 'ไม่สามารถแก้ไขได้ เนื่องจากอาจารย์ยืนยันวันนิเทศแล้ว' });
                return null;
            }
            throw err;
        });
        if (!appointment) return;

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
                student: { deletedAt: null },
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

        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId) || parsedId <= 0) {
            return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
        }

        await prisma.supervisionAppointment.update({
            where: { id: parsedId },
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
                student: { deletedAt: null },
                OR: [
                    // 🟢 เงื่อนไขที่ 1: เป็นที่ปรึกษาหลัก (ดูจาก teacherId ตรงๆ ได้เลย!)
                    { teacherId: teacher.id },

                    // 🟢 เงื่อนไขที่ 2: เป็นอาจารย์นิเทศร่วม (ค้นหาจากชื่อใน coTeacherName)
                    // ตรวจสอบความยาว firstName ก่อน ป้องกัน false-positive กับชื่อสั้น
                    ...(teacher.firstName && teacher.firstName.length >= 2
                        ? [{ coTeacherName: { contains: teacher.firstName } }]
                        : [])
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
        const { action, confirmedDate, rejectReason, supervisionType } = req.body;
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

        if (action === 'APPROVE') {
            if (!confirmedDate) {
                return res.status(400).json({ ok: false, message: 'กรุณาระบุวันที่นิเทศ' });
            }

            const chosenDate = new Date(confirmedDate);
            const startOfDay = new Date(chosenDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(chosenDate);
            endOfDay.setHours(23, 59, 59, 999);

            const approveData = {
                status: 'DATE_CONFIRMED',
                confirmedDate: chosenDate,
                rejectReason: null,
                ...(supervisionType === 'ONLINE' || supervisionType === 'ONSITE'
                    ? { supervisionType }
                    : {}),
            };

            // Atomic conflict check + update to prevent double-booking on concurrent requests
            await prisma.$transaction(async (tx) => {
                const current = await tx.supervisionAppointment.findUnique({
                    where: { id: parseInt(id) },
                    select: { status: true }
                });
                if (!current || current.status !== 'PENDING_TEACHER') {
                    throw Object.assign(
                        new Error('สามารถอนุมัติได้เฉพาะเมื่อสถานะเป็น PENDING_TEACHER เท่านั้น'),
                        { is400: true }
                    );
                }

                const conflict = await tx.supervisionAppointment.findFirst({
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
                    throw Object.assign(
                        new Error(`วันนี้มีการนิเทศของ ${conflictName} อยู่แล้ว กรุณาเลือกวันอื่น`),
                        { is409: true }
                    );
                }

                await tx.supervisionAppointment.update({
                    where: { id: parseInt(id) },
                    data: approveData
                });
            });
        } else if (action === 'REJECT') {
            await prisma.$transaction(async (tx) => {
                const current = await tx.supervisionAppointment.findUnique({
                    where: { id: parseInt(id) },
                    select: { status: true }
                });
                if (!current || (current.status !== 'PENDING_TEACHER' && current.status !== 'TEACHER_REJECTED')) {
                    throw Object.assign(
                        new Error('สามารถปฏิเสธได้เฉพาะเมื่อสถานะเป็น PENDING_TEACHER หรือ TEACHER_REJECTED เท่านั้น'),
                        { is400: true }
                    );
                }
                await tx.supervisionAppointment.update({
                    where: { id: parseInt(id) },
                    data: { status: 'TEACHER_REJECTED', confirmedDate: null, rejectReason: rejectReason }
                });
            });
        }

        res.json({ ok: true, message: "บันทึกผลพิจารณาสำเร็จ" });

        // Notify student
        const approved = action === 'APPROVE';
        prisma.student.findUnique({ where: { id: supervision.studentId }, select: { userId: true } })
          .then(student => {
            if (student?.userId) {
              return createNotifications([student.userId], {
                type: 'SUPERVISION_DATE_UPDATED',
                title: approved ? 'วันนิเทศได้รับการยืนยัน' : 'วันนิเทศถูกปฏิเสธ',
                message: approved ? 'อาจารย์ยืนยันวันนิเทศแล้ว' : 'อาจารย์ปฏิเสธวันที่เสนอ กรุณาเสนอวันใหม่',
                link: '/student/supervision',
                relatedId: null,
              });
            }
          })
          .catch(console.error);
    } catch (err) {
        if (err.is409) {
            return res.status(409).json({ ok: false, message: err.message });
        }
        if (err.is400) {
            return res.status(400).json({ ok: false, message: err.message });
        }
        console.error("Review Supervision Error:", err);
        res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
    }
};

// ==========================================
// จบนิเทศ — อาจารย์ที่ปรึกษาหลักของนัดนี้ หรือ admin/staff
// ใช้ได้เมื่อสถานะเป็น LETTER_UPLOADED เท่านั้น
// PUT /api/teacher/supervisions/:id/complete, /api/admin/supervisions/:id/complete
// ==========================================
exports.completeSupervision = async (req, res) => {
    try {
        const { id } = req.params;
        const role = (req.user?.role || '').toLowerCase();

        const supervision = await prisma.supervisionAppointment.findUnique({
            where: { id: parseInt(id) }
        });

        if (!supervision) {
            return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลการนัดหมาย" });
        }

        // อาจารย์ — ต้องเป็นอาจารย์ที่ปรึกษาหลักของนัดนี้เท่านั้น (เหมือน reviewSupervision)
        // admin/staff — ผ่านได้ทันที ไม่ต้องเช็คความเป็นเจ้าของ
        if (role === 'teacher') {
            const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
            if (!teacher || supervision.teacherId !== teacher.id) {
                return res.status(403).json({ ok: false, message: "คุณไม่มีสิทธิ์ทำรายการนี้ เฉพาะอาจารย์ที่ปรึกษาหลักเท่านั้น" });
            }
        }

        await prisma.$transaction(async (tx) => {
            const fresh = await tx.supervisionAppointment.findUnique({ where: { id: parseInt(id) } });
            if (fresh.status !== 'LETTER_UPLOADED') {
                throw Object.assign(new Error("ยังไม่สามารถจบนิเทศได้ในสถานะปัจจุบัน"), { is400: true });
            }
            await tx.supervisionAppointment.update({ where: { id: parseInt(id) }, data: { status: 'COMPLETED' } });
        });

        res.json({ ok: true, message: "บันทึกผลนิเทศเสร็จสิ้นสำเร็จ" });

        prisma.student.findUnique({ where: { id: supervision.studentId }, select: { userId: true, deletedAt: true } })
          .then(student => {
            if (student?.userId) {
              return createNotifications([student.userId], {
                type: 'SUPERVISION_COMPLETED',
                title: 'การนิเทศเสร็จสิ้น',
                message: 'การนิเทศของคุณเสร็จสิ้นแล้ว ดำเนินการส่งเล่มรายงานสหกิจ (T008) ได้เลย',
                link: '/student/doc-t008',
                relatedId: null,
              });
            }
          })
          .catch(console.error);
    } catch (err) {
        if (err.is400) return res.status(400).json({ ok: false, message: err.message });
        console.error("Complete Supervision Error:", err);
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

        const chosenDate = new Date(confirmedDate);
        const startOfDay = new Date(chosenDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(chosenDate); endOfDay.setHours(23, 59, 59, 999);

        let updated;
        await prisma.$transaction(async (tx) => {
            const fresh = await tx.supervisionAppointment.findUnique({ where: { id: parseInt(id) } });
            if (!fresh) {
                throw Object.assign(new Error('ไม่พบข้อมูลการนัดหมาย'), { is404: true });
            }
            if (fresh.officialLetterPath) {
                throw Object.assign(new Error('ไม่สามารถแก้ไขได้ เนื่องจากออกหนังสือนิเทศแล้ว'), { is400: true });
            }
            if (fresh.status !== 'DATE_CONFIRMED') {
                throw Object.assign(new Error('สามารถแก้ไขวันนิเทศได้เฉพาะเมื่อสถานะเป็น DATE_CONFIRMED เท่านั้น'), { is400: true });
            }

            const conflict = await tx.supervisionAppointment.findFirst({
                where: {
                    teacherId: fresh.teacherId,
                    id: { not: parseInt(id) },
                    status: { in: ['DATE_CONFIRMED', 'LETTER_UPLOADED'] },
                    confirmedDate: { gte: startOfDay, lte: endOfDay }
                },
                include: { student: { select: { firstName: true, lastName: true } } }
            });

            if (conflict) {
                throw Object.assign(
                    new Error(`วันนี้มีการนิเทศของ ${conflict.student.firstName} ${conflict.student.lastName} อยู่แล้ว`),
                    { is409: true }
                );
            }

            updated = await tx.supervisionAppointment.update({
                where: { id: parseInt(id) },
                data: { confirmedDate: chosenDate }
            });
        });

        res.json({ ok: true, appointment: updated });
    } catch (err) {
        if (err.is404) return res.status(404).json({ ok: false, message: err.message });
        if (err.is400) return res.status(400).json({ ok: false, message: err.message });
        if (err.is409) return res.status(409).json({ ok: false, message: err.message });
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
                status: { in: ['DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED'] },
                student: { deletedAt: null }
            },
            include: {
                student: {
                    select: {
                        studentId: true, firstName: true, lastName: true,
                        coop: { select: { company: { select: { name: true } } } }
                    }
                }
            },
            orderBy: { confirmedDate: 'asc' }
        });

        const events = appointments.map(a => ({
            id: a.id,
            confirmedDate: a.confirmedDate,
            studentId: a.student.studentId,
            studentName: `${a.student.firstName} ${a.student.lastName}`,
            type: a.supervisionType,
            status: a.status,
            companyName: a.student.coop?.company?.name ?? null,
        }));

        res.json({ ok: true, events });
    } catch (err) {
        console.error("Get Calendar Error:", err);
        res.status(500).json({ ok: false, message: "ไม่สามารถดึงข้อมูลปฏิทินได้" });
    }
};
