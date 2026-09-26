const prisma = require('../config/prismaClient');
const fs = require('fs');
const path = require('path');
const { createNotifications, getStaffAndCoopTeacherIds } = require('../utils/notificationHelper');
const { normalizeDocNumber, isPlaceholderDocNo, parseDateOr400 } = require('../utils/docNumber');
const { setAuditDetail, letterPendingActionText, supervisionLetterActionText } = require('../utils/auditActions');
const { resolveSlotEnd, assertNoTeacherClash, findTeacherClash, dateKey, timeKey, parseProposedList } = require('../utils/supervisionClash');
const { SUPERVISION_SCHEDULE_SELECT, toScheduleRow, sortSchedule, buildSupervisionScheduleWorkbook } = require('../utils/supervisionExport');

const CLEARED_LETTER_PENDING = { letterPendingAt: null, letterDraftNumber: null, letterDraftDate: null };

// สถานะสหกิจที่ขอนัดนิเทศได้ (ออกฝึกแล้ว) — ต้องตรงกับ isInternshipPhase ใน Frontend/src/components/S_Supervision.tsx
const SUPERVISION_PROPOSE_STATUSES = [
    'INTERNSHIP_STARTED', 'T002_SUBMITTED', 'T002_EDITS_REQUIRED',
    'T003_SUBMITTED', 'T003_EDITS_REQUIRED', 'T003_APPROVED',
];

// เลขที่หนังสือขอนิเทศห้ามซ้ำกับฉบับที่ออกให้คนอื่นแล้ว หรือร่างที่รอลงนามของคนอื่น
async function assertSupervisionDocNumberFree(tx, value, appointmentId) {
    if (!value) return;
    const clash = await tx.supervisionAppointment.findFirst({
        where: { OR: [{ letterDocNumber: value }, { letterDraftNumber: value }], id: { not: appointmentId } },
        select: { letterDocNumber: true, letterDraftNumber: true, student: { select: { studentId: true, firstName: true, lastName: true } } },
    });
    if (!clash) return;
    const who = clash.student
        ? `${clash.student.studentId} ${clash.student.firstName} ${clash.student.lastName}`
        : 'นักศึกษารายอื่น';
    const message = clash.letterDocNumber === value
        ? `เลขที่หนังสือขอนิเทศ "${value}" ถูกใช้กับ ${who} แล้ว`
        : `เลขที่หนังสือขอนิเทศ "${value}" อยู่ในร่างหนังสือที่รอลงนามของ ${who} — ถ้าไม่ใช้ร่างนั้นแล้ว ให้กด "ยกเลิกรอลงนาม" ของคนนั้นก่อน`;
    throw Object.assign(new Error(message), { is409: true });
}

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
        if (err.code === 'P2025') return res.status(404).json({ ok: false, message: 'ไม่พบรอบสหกิจ' });
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
                    include: { coop: { include: { company: true, contacts: { orderBy: { createdAt: 'asc' } } } } }
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
        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId) || parsedId <= 0) {
            if (req.file) try { fs.unlinkSync(path.join(__dirname, '../uploads/supervision', req.file.filename)); } catch (_) {}
            return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
        }
        if (!req.file) {
            return res.status(400).json({ ok: false, message: 'กรุณาอัปโหลดไฟล์ PDF' });
        }

        let appointment;
        try {
            // เลขที่/วันที่หนังสือ (ไม่ส่งมา = ไม่บันทึก) · อัปโหลดฉบับลงนามแล้ว ป้าย "รอลงนาม" หมดหน้าที่
            const data = { officialLetterPath: req.file.filename, status: 'LETTER_UPLOADED', ...CLEARED_LETTER_PENDING };
            const docNo = normalizeDocNumber(req.body?.docNumber);
            if (docNo) {
                if (isPlaceholderDocNo(docNo)) {
                    throw Object.assign(new Error('เลขที่หนังสือขอนิเทศยังไม่ได้กรอก กรุณาระบุเลขที่จริง เช่น 660301.26.6.2/1234'), { is400: true });
                }
                data.letterDocNumber = docNo;
            }
            if (req.body?.docDate) data.letterDocDate = parseDateOr400(req.body.docDate, 'วันที่ออกหนังสือขอนิเทศ');

            await prisma.$transaction(async (tx) => {
                const current = await tx.supervisionAppointment.findUnique({ where: { id: parsedId } });
                if (!current || current.status !== 'DATE_CONFIRMED') {
                    throw Object.assign(new Error('สามารถออกหนังสือนิเทศได้เฉพาะเมื่อยืนยันวันแล้ว'), { is400: true });
                }
                await assertSupervisionDocNumberFree(tx, data.letterDocNumber, parsedId);
                appointment = await tx.supervisionAppointment.update({ where: { id: parsedId }, data });
            });
        } catch (txErr) {
            if (req.file) {
                const fp = path.join(__dirname, '../uploads/supervision', req.file.filename);
                if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (_) {}
            }
            if (txErr.is400) return res.status(400).json({ ok: false, message: txErr.message });
            if (txErr.is409) return res.status(409).json({ ok: false, message: txErr.message });
            // unique index — สองคำขอใช้เลขเดียวกันพร้อมกันจนรอดด่านเช็ค
            if (txErr.code === 'P2002') return res.status(409).json({ ok: false, message: 'เลขที่หนังสือขอนิเทศนี้ถูกใช้ไปแล้ว กรุณาใช้เลขอื่น' });
            throw txErr;
        }

        setAuditDetail(res, {
            action: supervisionLetterActionText({ docNumber: appointment.letterDocNumber }),
            targetType: 'นัดนิเทศ',
            targetId: parsedId,
        });
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
            const filePath = path.join(__dirname, '../uploads/supervision', req.file.filename);
            try { fs.unlinkSync(filePath); } catch (_) {}
        }
        res.status(500).json({ ok: false, message: 'Upload error' });
    }
};

// ดาวน์โหลดร่างหนังสือขอนิเทศไปเสนอลงนาม → ป้าย "รอลงนาม" (ไม่เปลี่ยนสถานะนัดหมาย)
// body: { docNumber?, docDate?, cancel? }
exports.markSupervisionLetterPending = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
        const cancel = req.body?.cancel === true || req.body?.cancel === 'true';

        let data = CLEARED_LETTER_PENDING;
        if (!cancel) {
            const docNo = normalizeDocNumber(req.body?.docNumber);
            data = {
                letterPendingAt: new Date(),
                letterDraftNumber: docNo && !isPlaceholderDocNo(docNo) ? docNo : null,
                letterDraftDate: req.body?.docDate ? parseDateOr400(req.body.docDate, 'วันที่ของร่างหนังสือ') : null,
            };
        }

        await prisma.$transaction(async (tx) => {
            const current = await tx.supervisionAppointment.findUnique({
                where: { id },
                select: { status: true, student: { select: { deletedAt: true } } },
            });
            if (!current || current.student?.deletedAt) throw Object.assign(new Error('ไม่พบข้อมูลการนัดหมาย'), { is404: true });
            if (!cancel) {
                if (current.status !== 'DATE_CONFIRMED') {
                    throw Object.assign(new Error('ออกหนังสือนิเทศได้เฉพาะนัดหมายที่ยืนยันวันแล้ว'), { is400: true });
                }
                await assertSupervisionDocNumberFree(tx, data.letterDraftNumber, id);
            }
            await tx.supervisionAppointment.update({ where: { id }, data });
        });

        setAuditDetail(res, {
            action: letterPendingActionText({ letter: 'SUPERVISION', cancel, docNumber: data.letterDraftNumber }),
            targetType: 'นัดนิเทศ',
            targetId: id,
        });
        res.json({ ok: true, pendingAt: data.letterPendingAt, draftNumber: data.letterDraftNumber, draftDate: data.letterDraftDate });
    } catch (err) {
        if (err.is404) return res.status(404).json({ ok: false, message: err.message });
        if (err.is409) return res.status(409).json({ ok: false, message: err.message });
        if (err.is400) return res.status(400).json({ ok: false, message: err.message });
        console.error('Mark Supervision Letter Pending Error:', err);
        res.status(500).json({ ok: false, message: 'บันทึกสถานะรอลงนามไม่สำเร็จ' });
    }
};

// ==========================================
// 👨‍🎓 [STUDENT] ฝั่งนักศึกษา
// ==========================================
exports.getStudentSupervision = async (req, res) => {
    try {
        const student = await prisma.student.findUnique({
            where: { userId: req.user.id },
            include: { coop: { select: { coopPeriodId: true } } },
        });
        if (!student || student.deletedAt) return res.status(404).json({ ok: false, message: 'Student not found' });

        const appointment = await prisma.supervisionAppointment.findUnique({
            where: { studentId: student.id }
        });

        // ต้องดูรอบสหกิจของ นศ. คนนี้เอง (StudentCoop.coopPeriodId) ไม่ใช่ "รอบรับสมัครที่เปิดอยู่ตอนนี้"
        // (CoopPeriod.isActive) — isActive ปิดอัตโนมัติเมื่อหมดเขตรับสมัคร แต่ นศ. มักจะเริ่มนัดนิเทศ
        // ตอนฝึกงานไปแล้วครึ่งทาง ซึ่งรอบรับสมัครของรุ่นตัวเองปิดไปนานแล้วเป็นปกติ
        const supervisionPeriod = student.coop?.coopPeriodId
            ? await prisma.coopPeriod.findUnique({ where: { id: student.coop.coopPeriodId } })
            : null;

        res.json({ ok: true, appointment, supervisionPeriod });
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
        if (onlineLink) {
            try {
                const u = new URL(String(onlineLink).trim());
                if (!['https:', 'http:'].includes(u.protocol)) throw new Error('bad protocol');
            } catch {
                return res.status(400).json({ ok: false, message: 'onlineLink ต้องเป็น URL แบบ http/https เท่านั้น' });
            }
        }
        const student = await prisma.student.findUnique({
            where: { userId: req.user.id },
            include: { coop: { select: { coopPeriodId: true, status: true } } },
        });

        if (!student || student.deletedAt) return res.status(404).json({ ok: false, message: 'Student not found' });

        // ขอนัดนิเทศได้เฉพาะช่วงออกฝึกแล้ว — ตรงกับ isInternshipPhase ใน S_Supervision.tsx
        // (เดิมหน้าจอซ่อนฟอร์มแต่ API ไม่เช็ค นักศึกษาที่ยังไม่ออกฝึกเรียก API ตรงแล้วสร้างนัดได้)
        if (!SUPERVISION_PROPOSE_STATUSES.includes(student.coop?.status)) {
            return res.status(403).json({ ok: false, message: 'ขอนัดนิเทศได้เมื่อออกฝึกสหกิจแล้วเท่านั้น' });
        }

        // ห้ามเสนอวันที่ผ่านมาแล้ว (เดิมไม่เช็คเลย ทั้งหน้าจอและ API)
        const todayKey = dateKey(new Date());
        const pastEntry = parseProposedList(proposedDates).find((e) => e.date < todayKey);
        if (pastEntry) {
            return res.status(400).json({ ok: false, message: `วันที่เสนอ ${pastEntry.date} ผ่านมาแล้ว กรุณาเลือกตั้งแต่วันนี้เป็นต้นไป` });
        }

        // เดิม frontend ปิดปุ่มเองตาม isSupervisionOpen (S_Supervision.tsx) แต่ backend ไม่เคยเช็คซ้ำเลย
        // — เรียก endpoint ตรงผ่านปุ่มที่ถูกปิดได้เสมอ ต้องดูรอบสหกิจของ นศ. คนนี้เอง ไม่ใช่ "รอบรับสมัคร
        // ที่เปิดอยู่ตอนนี้" (isActive ปิดอัตโนมัติเมื่อหมดเขตรับสมัคร ซึ่งมักปิดไปนานแล้วตอนเริ่มนิเทศ)
        const supervisionPeriod = student.coop?.coopPeriodId
            ? await prisma.coopPeriod.findUnique({ where: { id: student.coop.coopPeriodId } })
            : null;
        if (!supervisionPeriod || !supervisionPeriod.isSupervisionOpen) {
            return res.status(403).json({ ok: false, message: '⛔ ระบบยังไม่เปิดให้นัดหมายนิเทศในขณะนี้' });
        }

        // หา Teacher จาก coopAdvisorId (อาจารย์ที่ปรึกษาโครงการสหกิจ) เป็นผู้นิเทศหลัก
        if (!student.coopAdvisorId) {
            return res.status(400).json({ ok: false, message: 'ไม่พบอาจารย์ที่ปรึกษาโครงการ กรุณาเลือกในหน้าข้อมูลส่วนตัวก่อน' });
        }

        const teacher = await prisma.teacher.findUnique({ where: { id: student.coopAdvisorId } });
        if (!teacher) {
            return res.status(400).json({ ok: false, message: 'ไม่พบข้อมูลอาจารย์ที่ปรึกษาโครงการในระบบ กรุณาติดต่อเจ้าหน้าที่' });
        }

        const LOCKED_STATUSES = ['DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED'];

        const appointment = await prisma.$transaction(async (tx) => {
            const existing = await tx.supervisionAppointment.findUnique({
                where: { studentId: student.id },
                select: { status: true, supervisionType: true }
            });
            if (existing && LOCKED_STATUSES.includes(existing.status)) {
                const err = new Error('LOCKED');
                err.status = 403;
                throw err;
            }
            // supervisionType เป็นคอลัมน์บังคับ (NOT NULL) — ตอนสร้างใหม่ต้องระบุมา
            // ตอนอัปเดตถ้าไม่ส่งมาให้คงค่าเดิมไว้ (Prisma validate ทั้ง create/update
            // block ของ upsert พร้อมกัน ถ้าปล่อย undefined เข้า create มันจะ throw
            // แม้ query จริงจะจบที่ update ก็ตาม)
            const resolvedType = supervisionType ?? existing?.supervisionType;
            if (!resolvedType) {
                const err = new Error('กรุณาระบุรูปแบบการนิเทศ (ONLINE หรือ ONSITE)');
                err.status = 400;
                throw err;
            }
            return tx.supervisionAppointment.upsert({
                where: { studentId: student.id },
                update: {
                    teacherId: teacher.id,
                    proposedDates,
                    supervisionType: resolvedType,
                    onlineLink,
                    coTeacherName,
                    status: 'PENDING_TEACHER',
                    rejectReason: null
                },
                create: {
                    studentId: student.id,
                    teacherId: teacher.id,
                    proposedDates,
                    supervisionType: resolvedType,
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
            if (err.status === 400) {
                res.status(400).json({ ok: false, message: err.message });
                return null;
            }
            throw err;
        });
        if (!appointment) return;

        res.json({ ok: true, appointment });

        // Fire notification async without blocking response
        // Staff / coop-teachers (excluding the assigned teacher to avoid duplicate)
        // then notify the assigned teacher separately with the teacher-facing link
        getStaffAndCoopTeacherIds().then(async ids => {
          const staffIds = teacher?.userId ? ids.filter(id => id !== teacher.userId) : ids;
          if (staffIds.length) {
            await createNotifications(staffIds, {
              type: 'SUPERVISION_PROPOSED',
              title: 'นักศึกษาเสนอวันนิเทศ',
              message: 'มีนักศึกษาเสนอวันนิเทศสหกิจศึกษา กรุณาตรวจสอบและยืนยัน',
              link: '/admin/students',
              relatedId: String(req.user.id),
            });
          }
          if (teacher?.userId) {
            await createNotifications([teacher.userId], {
              type: 'SUPERVISION_PROPOSED',
              title: 'นักศึกษาเสนอวันนิเทศ',
              message: 'นักศึกษาในที่ปรึกษาของคุณเสนอวันนิเทศ กรุณาตรวจสอบและยืนยัน',
              link: '/teacher/review-supervision',
              relatedId: String(appointment.id),
            });
          }
        }).catch(console.error);
    } catch (err) {
        console.error("Propose Supervision Error:", err);
        res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดในการบันทึก' });
    }
};

// ==========================================
// 👨‍🏫 [TEACHER] ฝั่งอาจารย์
// ==========================================

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

        const appt = await prisma.supervisionAppointment.findUnique({ where: { id: parsedId } });
        if (!appt) {
            return res.status(404).json({ ok: false, message: 'ไม่พบข้อมูลการนัดหมาย' });
        }

        // อาจารย์ร่วมที่เพิ่มเข้ามาต้องว่างในเวลานั้น — เช็คเมื่อรายการนี้ยืนยันวันแล้วเท่านั้น
        if (coTeacherName && appt.confirmedDate && ['DATE_CONFIRMED', 'LETTER_UPLOADED'].includes(appt.status)) {
            const start = new Date(appt.confirmedDate);
            const end = resolveSlotEnd(start, appt);
            const clash = await findTeacherClash(prisma, {
                start,
                end,
                teacher: null,
                coTeacherName,
                excludeIds: [parsedId],
            });
            if (clash) return res.status(409).json({ ok: false, message: clash.message });
        }

        await prisma.supervisionAppointment.update({
            where: { id: parsedId },
            data: { coTeacherName: coTeacherName } // บันทึกลงฐานข้อมูล
        });

        res.json({ ok: true, message: "อัปเดตอาจารย์นิเทศร่วมสำเร็จ" });
    } catch (error) {
        if (error.code === 'P2025') return res.status(404).json({ ok: false, message: 'ไม่พบข้อมูลการนัดหมาย' });
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

                    // 🟢 เงื่อนไขที่ 2: เป็นอาจารย์นิเทศร่วม (ค้นหาจากชื่อ-นามสกุลใน coTeacherName)
                    ...(teacher.firstName && teacher.lastName
                        ? [{ coTeacherName: { contains: `${teacher.firstName} ${teacher.lastName}` } }]
                        : [])
                ]
            },
            include: {
                student: {
                    include: {
                        coop: { include: { company: true, contacts: { orderBy: { createdAt: 'asc' } } } }
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
        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId) || parsedId <= 0)
            return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
        const { action, confirmedDate, rejectReason, supervisionType } = req.body;
        if (!['APPROVE', 'REJECT'].includes(action)) {
            return res.status(400).json({ ok: false, message: "action ต้องเป็น APPROVE หรือ REJECT" });
        }
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
            where: { id: parsedId }
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
            // คิวนิเทศเป็นช่วงเวลา — เวลาสิ้นสุดเอาจากช่วงที่นักศึกษาเสนอ (เช่น 10:00-12:00)
            const slotEnd = resolveSlotEnd(chosenDate, { proposedDates: supervision.proposedDates });

            // Auto-extract type from matching proposedDates entry (3rd pipe segment)
            // when the teacher frontend doesn't send supervisionType explicitly
            let resolvedType = (supervisionType === 'ONLINE' || supervisionType === 'ONSITE')
                ? supervisionType
                : null;
            if (!resolvedType && supervision.proposedDates) {
                try {
                    const proposed = JSON.parse(supervision.proposedDates);
                    // Slice raw string first (avoids UTC-offset date shift); fall back to local-time YYYY-MM-DD
                    const confirmedDateStr = typeof confirmedDate === 'string'
                        ? confirmedDate.slice(0, 10)
                        : `${chosenDate.getFullYear()}-${String(chosenDate.getMonth() + 1).padStart(2, '0')}-${String(chosenDate.getDate()).padStart(2, '0')}`;
                    for (const entry of proposed) {
                        const parts = entry.split('|');
                        if (parts[0] === confirmedDateStr && (parts[2] === 'ONLINE' || parts[2] === 'ONSITE')) {
                            resolvedType = parts[2];
                            break;
                        }
                    }
                } catch (_) { /* malformed JSON — ignore */ }
            }

            const approveData = {
                status: 'DATE_CONFIRMED',
                confirmedDate: chosenDate,
                confirmedEndDate: slotEnd,
                rejectReason: null,
                ...(resolvedType ? { supervisionType: resolvedType } : {}),
            };

            // Atomic conflict check + update to prevent double-booking on concurrent requests
            await prisma.$transaction(async (tx) => {
                const current = await tx.supervisionAppointment.findUnique({
                    where: { id: parsedId },
                    select: { status: true, teacherId: true }
                });
                if (!current) {
                    throw Object.assign(new Error('ไม่พบข้อมูลการนัดหมาย'), { is404: true });
                }
                if (current.teacherId !== teacher.id) {
                    throw Object.assign(new Error('คุณไม่มีสิทธิ์ทำรายการนี้ เฉพาะอาจารย์ที่ปรึกษาหลักเท่านั้น'), { is403: true });
                }
                if (current.status !== 'PENDING_TEACHER') {
                    throw Object.assign(
                        new Error('สามารถอนุมัติได้เฉพาะเมื่อสถานะเป็น PENDING_TEACHER เท่านั้น'),
                        { is400: true }
                    );
                }

                // อาจารย์คนเดียวกัน (นับอาจารย์ร่วมด้วย) ห้ามมีนิเทศเวลาทับกัน — นัดต่อกันพอดีได้
                await assertNoTeacherClash(tx, {
                    start: chosenDate,
                    end: slotEnd,
                    teacher: { id: teacher.id, prefix: teacher.prefix, firstName: teacher.firstName, lastName: teacher.lastName },
                    coTeacherName: supervision.coTeacherName,
                    excludeIds: [parsedId],
                });

                await tx.supervisionAppointment.update({
                    where: { id: parsedId },
                    data: approveData
                });
            });
        } else if (action === 'REJECT') {
            await prisma.$transaction(async (tx) => {
                const current = await tx.supervisionAppointment.findUnique({
                    where: { id: parsedId },
                    select: { status: true, teacherId: true }
                });
                if (!current) {
                    throw Object.assign(new Error('ไม่พบข้อมูลการนัดหมาย'), { is404: true });
                }
                if (current.teacherId !== teacher.id) {
                    throw Object.assign(new Error('คุณไม่มีสิทธิ์ทำรายการนี้ เฉพาะอาจารย์ที่ปรึกษาหลักเท่านั้น'), { is403: true });
                }
                if ((current.status !== 'PENDING_TEACHER' && current.status !== 'TEACHER_REJECTED')) {
                    throw Object.assign(
                        new Error('สามารถปฏิเสธได้เฉพาะเมื่อสถานะเป็น PENDING_TEACHER หรือ TEACHER_REJECTED เท่านั้น'),
                        { is400: true }
                    );
                }
                await tx.supervisionAppointment.update({
                    where: { id: parsedId },
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
        if (err.is409) return res.status(409).json({ ok: false, message: err.message });
        if (err.is404) return res.status(404).json({ ok: false, message: err.message });
        if (err.is403) return res.status(403).json({ ok: false, message: err.message });
        if (err.is400) return res.status(400).json({ ok: false, message: err.message });
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
        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId) || parsedId <= 0)
            return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
        const role = (req.user?.role || '').toLowerCase();

        const supervision = await prisma.supervisionAppointment.findUnique({
            where: { id: parsedId }
        });

        if (!supervision) {
            return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลการนัดหมาย" });
        }

        // อาจารย์ — ต้องเป็นอาจารย์ที่ปรึกษาหลักของนัดนี้เท่านั้น (เหมือน reviewSupervision)
        // admin/staff — ผ่านได้ทันที ไม่ต้องเช็คความเป็นเจ้าของ
        let teacherRecord = null;
        if (role === 'teacher') {
            teacherRecord = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
            if (!teacherRecord || supervision.teacherId !== teacherRecord.id) {
                return res.status(403).json({ ok: false, message: "คุณไม่มีสิทธิ์ทำรายการนี้ เฉพาะอาจารย์ที่ปรึกษาหลักเท่านั้น" });
            }
        }

        await prisma.$transaction(async (tx) => {
            const fresh = await tx.supervisionAppointment.findUnique({
                where: { id: parsedId },
                select: { status: true, teacherId: true }
            });
            if (!fresh) throw Object.assign(new Error('ไม่พบข้อมูลการนัดหมาย'), { is404: true });
            if (role === 'teacher' && fresh.teacherId !== teacherRecord.id) {
                throw Object.assign(new Error('คุณไม่มีสิทธิ์ทำรายการนี้'), { is403: true });
            }
            if (fresh.status !== 'LETTER_UPLOADED') {
                throw Object.assign(new Error("ยังไม่สามารถจบนิเทศได้ในสถานะปัจจุบัน"), { is400: true });
            }
            await tx.supervisionAppointment.update({ where: { id: parsedId }, data: { status: 'COMPLETED' } });
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
        if (err.is404) return res.status(404).json({ ok: false, message: err.message });
        if (err.is403) return res.status(403).json({ ok: false, message: err.message });
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
        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId) || parsedId <= 0)
            return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
        const { confirmedDate } = req.body;

        if (!confirmedDate) {
            return res.status(400).json({ ok: false, message: 'กรุณาระบุวันที่นิเทศ' });
        }

        const chosenDate = new Date(confirmedDate);

        let updated;
        await prisma.$transaction(async (tx) => {
            const fresh = await tx.supervisionAppointment.findUnique({ where: { id: parsedId } });
            if (!fresh) {
                throw Object.assign(new Error('ไม่พบข้อมูลการนัดหมาย'), { is404: true });
            }
            if (fresh.officialLetterPath) {
                throw Object.assign(new Error('ไม่สามารถแก้ไขได้ เนื่องจากออกหนังสือนิเทศแล้ว'), { is400: true });
            }
            if (fresh.status !== 'DATE_CONFIRMED') {
                throw Object.assign(new Error('สามารถแก้ไขวันนิเทศได้เฉพาะเมื่อสถานะเป็น DATE_CONFIRMED เท่านั้น'), { is400: true });
            }

            // ย้ายวัน/เวลา = นัดเดิมที่เลื่อน → คงความยาวคิวเดิมไว้ (เดิมคำนวณใหม่จากช่วงที่นักศึกษาเสนอ
            // ถ้าย้ายไปวันที่ไม่อยู่ในรายการเสนอ ความยาว 2 ชม. หดเหลือค่าตั้งต้น 1 ชม. การตรวจเวลาชนเลยมองไม่เห็นชั่วโมงที่หาย)
            const prevStart = fresh.confirmedDate ? new Date(fresh.confirmedDate) : null;
            const prevEnd = prevStart ? resolveSlotEnd(prevStart, fresh) : null;
            const slotEnd = prevStart && prevEnd > prevStart
                ? new Date(chosenDate.getTime() + (prevEnd.getTime() - prevStart.getTime()))
                : resolveSlotEnd(chosenDate, { proposedDates: fresh.proposedDates });
            const apptTeacher = await tx.teacher.findUnique({
                where: { id: fresh.teacherId },
                select: { id: true, prefix: true, firstName: true, lastName: true },
            });
            await assertNoTeacherClash(tx, {
                start: chosenDate,
                end: slotEnd,
                teacher: apptTeacher,
                coTeacherName: fresh.coTeacherName,
                excludeIds: [parsedId],
            });

            // ย้ายสมาชิกนัดกลุ่มไปวันอื่น = ไม่ได้ไปพร้อมกลุ่มแล้ว → ถอดออกจากกลุ่ม
            // (เดิม groupId ค้าง ปฏิทินรวมกลุ่มตาม groupId เลยโชว์คนนั้นที่วันเดิม และหายจากวันใหม่)
            const movedToAnotherDay = !!fresh.groupId && !!fresh.confirmedDate
                && dateKey(new Date(fresh.confirmedDate)) !== dateKey(chosenDate);

            updated = await tx.supervisionAppointment.update({
                where: { id: parsedId },
                data: {
                    confirmedDate: chosenDate,
                    confirmedEndDate: slotEnd,
                    ...(movedToAnotherDay ? { groupId: null } : {}),
                }
            });
        });

        res.json({ ok: true, appointment: updated });

        // แก้วันแล้วไม่แจ้ง นศ. เลย — วันนัดของ นศ. เปลี่ยนไปเงียบ ๆ ต่างจากตอนอาจารย์
        // ยืนยันครั้งแรก (reviewSupervision) ที่แจ้งอยู่แล้ว
        prisma.student.findUnique({ where: { id: updated.studentId }, select: { userId: true } })
          .then(student => {
            if (student?.userId) {
              return createNotifications([student.userId], {
                type: 'SUPERVISION_DATE_UPDATED',
                title: 'วันนิเทศมีการเปลี่ยนแปลง',
                message: 'เจ้าหน้าที่ปรับวันนิเทศของคุณ กรุณาตรวจสอบวันที่ใหม่',
                link: '/student/supervision',
                relatedId: null,
              });
            }
          })
          .catch(console.error);
    } catch (err) {
        if (err.is404) return res.status(404).json({ ok: false, message: err.message });
        if (err.is400) return res.status(400).json({ ok: false, message: err.message });
        if (err.is409) return res.status(409).json({ ok: false, message: err.message });
        console.error('updateConfirmedDate error:', err);
        res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดในการแก้ไขวันนิเทศ' });
    }
};

// ==========================================
// getSupervisionsByCompany — Teacher group view
// GET /api/teacher/supervisions/by-company
// ==========================================
exports.getSupervisionsByCompany = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: parseInt(req.user.id) } });
    if (!teacher) return res.status(404).json({ ok: false, message: 'ไม่พบข้อมูลอาจารย์' });

    const appts = await prisma.supervisionAppointment.findMany({
      where: {
        teacherId: teacher.id,
        status: { in: ['PENDING_TEACHER', 'TEACHER_REJECTED'] },
        student: { deletedAt: null },
      },
      include: {
        student: { include: { coop: { include: { company: true } } } },
      },
      orderBy: { id: 'asc' },
    });

    // จัดกลุ่มตาม companyId
    const companyMap = new Map();
    for (const appt of appts) {
      const company = appt.student?.coop?.company;
      if (!company) continue;
      if (!companyMap.has(company.id)) {
        companyMap.set(company.id, { companyId: company.id, companyName: company.name, students: [] });
      }
      let proposedDates = [];
      try { proposedDates = JSON.parse(appt.proposedDates || '[]'); } catch {}
      companyMap.get(company.id).students.push({
        appointmentId: appt.id,
        studentId: appt.student.id,
        studentName: `${appt.student.firstName} ${appt.student.lastName}`,
        studentCode: appt.student.studentId,
        proposedDates,
        status: appt.status,
        groupId: appt.groupId,
      });
    }

    // คำนวณ commonDates ต่อบริษัท
    const companies = [];
    for (const group of companyMap.values()) {
      const dateCount = new Map(); // dateKey → { count, entry }
      for (const stu of group.students) {
        const seen = new Set();
        for (const entry of stu.proposedDates) {
          const key = entry.split('|')[0].slice(0, 10);
          if (!seen.has(key)) {
            seen.add(key);
            if (!dateCount.has(key)) dateCount.set(key, { count: 0, entry });
            dateCount.get(key).count += 1;
          }
        }
      }
      const commonDates = [];
      for (const { count, entry } of dateCount.values()) {
        if (count >= 2) commonDates.push(entry);
      }
      companies.push({ ...group, commonDates });
    }

    res.json({ ok: true, companies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'ไม่สามารถดึงข้อมูลได้' });
  }
};

// ==========================================
// confirmGroupSupervision — ยืนยันกลุ่ม
// ==========================================
exports.confirmGroupSupervision = async (req, res) => {
  try {
    const { appointmentIds, confirmedDate } = req.body;
    if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
      return res.status(400).json({ ok: false, message: 'appointmentIds ต้องมีอย่างน้อย 1 รายการ' });
    }
    // Fix 6: NaN validation — convert once and reuse
    const ids = appointmentIds.map(Number);
    if (ids.some(isNaN)) {
      return res.status(400).json({ ok: false, message: 'appointmentIds ต้องเป็นตัวเลข' });
    }
    if (!confirmedDate) {
      return res.status(400).json({ ok: false, message: 'กรุณาระบุวันที่ยืนยัน' });
    }

    const teacher = await prisma.teacher.findUnique({ where: { userId: parseInt(req.user.id) } });
    if (!teacher) return res.status(404).json({ ok: false, message: 'ไม่พบข้อมูลอาจารย์' });

    if (new Set(ids).size !== ids.length) {
      return res.status(400).json({ ok: false, message: 'appointmentIds ซ้ำกัน' });
    }

    // เรียงตามลำดับที่อาจารย์ส่งมา = ลำดับคิวนิเทศ (ฐานข้อมูลคืนตาม id — เดิมใช้ลำดับนั้นตรงๆ
    // หน้าต่างบอกว่า "ตามลำดับที่ติ๊ก" แต่คิวจริงเรียงตาม id)
    const fetched = await prisma.supervisionAppointment.findMany({
      where: { id: { in: ids } },
    });
    const byId = new Map(fetched.map(a => [a.id, a]));
    const appts = ids.map(id => byId.get(id)).filter(Boolean);

    // ตรวจว่าพบทุก id ที่ส่งมา
    if (appts.length !== ids.length) {
      return res.status(404).json({ ok: false, message: 'ไม่พบ appointment บางรายการ' });
    }

    // ตรวจสิทธิ์ — ทุก appointment ต้องเป็นของ teacher นี้
    const unauthorized = appts.find(a => a.teacherId !== teacher.id);
    if (unauthorized) {
      return res.status(403).json({ ok: false, message: 'ไม่มีสิทธิ์ยืนยันการนัดหมายนี้' });
    }

    // Fix 2: Status guard — ต้องเป็น PENDING_TEACHER หรือ TEACHER_REJECTED เท่านั้น
    const invalidStatuses = appts.filter(a => !['PENDING_TEACHER', 'TEACHER_REJECTED'].includes(a.status));
    if (invalidStatuses.length > 0) {
      return res.status(400).json({ ok: false, message: 'บางรายการไม่อยู่ในสถานะที่สามารถยืนยันได้' });
    }

    // Fix 3: UTC date fix — slice directly to avoid timezone shift
    const confirmKey = confirmedDate.slice(0, 10);

    // ตรวจว่า confirmedDate อยู่ใน proposedDates ของแต่ละคน
    for (const appt of appts) {
      let dates = [];
      try { dates = JSON.parse(appt.proposedDates || '[]'); } catch {}
      const hasDate = dates.some(e => e.split('|')[0].slice(0, 10) === confirmKey);
      if (!hasDate) {
        return res.status(400).json({
          ok: false,
          message: `วันที่เลือกไม่อยู่ในวันที่นักศึกษา appointment ${appt.id} เสนอมา`,
        });
      }
    }

    const groupId = appts.length > 1 ? require('crypto').randomUUID() : null;

    // นิเทศเป็นคิวเดี่ยว — คนแรกเริ่มตามเวลาที่เลือก คนถัดไปต่อจากคนก่อนหน้าทันที (ห้ามเวลาทับกัน)
    let cursor = new Date(confirmedDate);
    const plan = appts.map(a => {
      let dates = [];
      try { dates = JSON.parse(a.proposedDates || '[]'); } catch {}
      const matchedEntry = dates.find(e => e.split('|')[0].slice(0, 10) === confirmKey);
      const parts = (matchedEntry || '').split('|');
      const sType = parts[2] === 'ONLINE' ? 'ONLINE' : 'ONSITE';
      const start = new Date(cursor);
      const end = resolveSlotEnd(start, { proposedDates: a.proposedDates });
      cursor = end;
      return { id: a.id, coTeacherName: a.coTeacherName, start, end, sType };
    });

    const groupIds = appts.map(a => a.id);
    try {
      await prisma.$transaction(async (tx) => {
        const teacherRec = await tx.teacher.findUnique({
          where: { id: teacher.id },
          select: { id: true, prefix: true, firstName: true, lastName: true },
        });
        for (const slot of plan) {
          await assertNoTeacherClash(tx, {
            start: slot.start,
            end: slot.end,
            teacher: teacherRec,
            coTeacherName: slot.coTeacherName,
            excludeIds: groupIds,
          });
        }
        for (const slot of plan) {
          await tx.supervisionAppointment.update({
            where: { id: slot.id },
            data: {
              confirmedDate: slot.start,
              confirmedEndDate: slot.end,
              status: 'DATE_CONFIRMED',
              groupId,
              supervisionType: slot.sType,
            },
          });
        }
      });
    } catch (txErr) {
      if (txErr.is409) return res.status(409).json({ ok: false, message: txErr.message });
      throw txErr;
    }

    res.json({ ok: true, groupId, updatedCount: appts.length });

    // แจ้งนักศึกษาทุกคนในกลุ่ม — เดิมยืนยันสำเร็จแต่ไม่มีใครถูกแจ้งเตือนเลย
    // ต่างจากเส้นทางยืนยันทีละคน (reviewSupervision) ที่แจ้งอยู่แล้ว
    prisma.student.findMany({
      where: { id: { in: appts.map(a => a.studentId) } },
      select: { userId: true },
    }).then(async students => {
      const userIds = students.map(s => s.userId).filter(Boolean);
      if (userIds.length) {
        await createNotifications(userIds, {
          type: 'SUPERVISION_DATE_UPDATED',
          title: 'วันนิเทศได้รับการยืนยัน',
          message: 'อาจารย์ยืนยันวันนิเทศแล้ว',
          link: '/student/supervision',
          relatedId: null,
        });
      }
    }).catch(console.error);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'ไม่สามารถยืนยันการนัดหมายได้' });
  }
};

// ==========================================
// ตารางนิเทศ (Excel) — เจ้าหน้าที่ + อาจารย์ประจำวิชาสหกิจ
// GET /api/admin/supervisions/export?coopPeriodId=&from=&to=
// ==========================================
exports.exportSupervisionSchedule = async (req, res) => {
    try {
        const coopPeriodId = req.query.coopPeriodId ? parseInt(req.query.coopPeriodId, 10) : null;
        if (req.query.coopPeriodId && (isNaN(coopPeriodId) || coopPeriodId <= 0)) {
            return res.status(400).json({ ok: false, message: 'coopPeriodId ไม่ถูกต้อง' });
        }
        const range = {};
        if (req.query.from) range.gte = parseDateOr400(req.query.from, 'วันที่เริ่ม');
        if (req.query.to) {
            const to = parseDateOr400(req.query.to, 'วันที่สิ้นสุด');
            to.setHours(23, 59, 59, 999);
            range.lte = to;
        }

        const appointments = await prisma.supervisionAppointment.findMany({
            where: {
                confirmedDate: Object.keys(range).length ? { not: null, ...range } : { not: null },
                status: { in: ['DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED'] },
                student: {
                    deletedAt: null,
                    ...(coopPeriodId ? { coop: { coopPeriodId } } : {}),
                },
            },
            select: SUPERVISION_SCHEDULE_SELECT,
            orderBy: { confirmedDate: 'asc' },
        });

        const buffer = buildSupervisionScheduleWorkbook(appointments);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="supervision_schedule_${coopPeriodId || 'all'}.xlsx"`);
        res.send(buffer);
    } catch (err) {
        if (err.is400) return res.status(400).json({ ok: false, message: err.message });
        console.error('exportSupervisionSchedule error:', err);
        res.status(500).json({ ok: false, message: 'ไม่สามารถสร้างไฟล์ตารางนิเทศได้' });
    }
};

// ==========================================
// คิวนิเทศของเพื่อนที่บริษัทเดียวกัน (สำหรับนักศึกษา)
// GET /api/coop/supervision/company-queue
// ใช้ให้นักศึกษาขอนัดวันเดียวกับเพื่อนได้ แต่ต้องต่อคิวเวลา — นิเทศเป็นคิวเดี่ยว
// ==========================================
exports.getCompanySupervisionQueue = async (req, res) => {
    try {
        const student = await prisma.student.findUnique({
            where: { userId: parseInt(req.user.id) },
            select: {
                id: true, coopAdvisorId: true,
                coop: { select: { company: { select: { id: true, name: true } } } },
            },
        });
        if (!student) return res.status(404).json({ ok: false, message: 'ไม่พบข้อมูลนักศึกษา' });

        const company = student.coop?.company || null;
        const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
        if (!company) return res.json({ ok: true, company: null, queue: [] });

        const appts = await prisma.supervisionAppointment.findMany({
            where: {
                studentId: { not: student.id },
                // เฉพาะคิวที่ยังไม่ถึง — เดิมดึงนัดที่นิเทศเสร็จแล้ว/วันในอดีตมาด้วย ปุ่มต่อคิวเลยชวนให้เสนอวันที่ผ่านไปแล้ว
                confirmedDate: { gte: startOfToday },
                status: { in: ['DATE_CONFIRMED', 'LETTER_UPLOADED'] },
                student: { deletedAt: null, coop: { companyId: company.id } },
            },
            select: {
                id: true, confirmedDate: true, confirmedEndDate: true, proposedDates: true,
                supervisionType: true, status: true, teacherId: true, coTeacherName: true,
                teacher: { select: { prefix: true, firstName: true, lastName: true } },
                student: { select: { studentId: true, firstName: true, lastName: true } },
            },
            orderBy: { confirmedDate: 'asc' },
        });

        const queue = appts.map((a) => {
            const start = new Date(a.confirmedDate);
            const end = resolveSlotEnd(start, a);
            return {
                id: a.id,
                date: dateKey(start),
                start: timeKey(start),
                end: timeKey(end),
                studentName: `${a.student.firstName} ${a.student.lastName}`,
                studentCode: a.student.studentId,
                teacherId: a.teacherId,
                teacherName: `${a.teacher?.prefix || ''}${a.teacher?.firstName || ''} ${a.teacher?.lastName || ''}`.trim(),
                coTeacherName: a.coTeacherName || null,
                supervisionType: a.supervisionType,
                status: a.status,
                // คิวของอาจารย์คนเดียวกับเรา = ห้ามเวลาทับ (อาจารย์คนอื่นแค่ใช้ดูว่าไปพร้อมกันวันไหน)
                sameTeacher: !!student.coopAdvisorId && a.teacherId === student.coopAdvisorId,
            };
        });

        res.json({ ok: true, company, queue });
    } catch (err) {
        console.error('getCompanySupervisionQueue error:', err);
        res.status(500).json({ ok: false, message: 'ไม่สามารถดึงคิวนิเทศของบริษัทได้' });
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
            select: SUPERVISION_SCHEDULE_SELECT,
            orderBy: { confirmedDate: 'asc' }
        });

        // ตารางเรียงวัน-เวลา ใช้ได้ทั้งปฏิทินและมุมมองตาราง — ทุก role ดูได้ว่านิเทศใคร เมื่อไหร่ ใครนิเทศ
        const rows = sortSchedule(appointments.map(toScheduleRow));
        const events = rows.map(r => ({
            id: r.id,
            confirmedDate: appointments.find(a => a.id === r.id)?.confirmedDate ?? null,
            date: r.date,
            start: r.start,
            end: r.end,
            session: r.session,
            studentId: r.studentCode,
            studentName: r.studentName,
            teacherName: r.teacherName,
            coTeacherName: r.coTeacherName || null,
            type: r.supervisionType,
            status: r.status,
            statusLabel: r.statusLabel,
            companyName: r.companyName || null,
            companyProvince: r.companyProvince || null,
            groupId: r.groupId,
        }));

        res.json({ ok: true, events });
    } catch (err) {
        console.error("Get Calendar Error:", err);
        res.status(500).json({ ok: false, message: "ไม่สามารถดึงข้อมูลปฏิทินได้" });
    }
};
