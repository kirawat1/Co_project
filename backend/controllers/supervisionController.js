const prisma = require('../config/prismaClient');
const { isDbId } = require('../utils/dbId');
const fs = require('fs');
const path = require('path');
const { createNotifications, getStaffAndCoopTeacherIds } = require('../utils/notificationHelper');
const { normalizeDocNumber, isPlaceholderDocNo, parseDateOr400, strictDate } = require('../utils/docNumber');
const { setAuditDetail, letterPendingActionText, supervisionLetterActionText } = require('../utils/auditActions');
const { resolveSlotEnd, assertNoTeacherClash, dateKey, timeKey, parseProposedList, invalidProposedDates } = require('../utils/supervisionClash');
const { SUPERVISION_SCHEDULE_SELECT, SUPERVISION_EXPORT_SELECT, toScheduleRow, sortSchedule, buildSupervisionScheduleWorkbook } = require('../utils/supervisionExport');
const { exportBaseUrl } = require('../utils/studentExport');
const { getEvalConfig, sendEvalForAppointments } = require('../utils/supervisionEval');
const { studentMajor } = require('../utils/majorConfig');
const { getMajorScope, studentWhere, assertStudentInScope, inScope } = require('../utils/majorScope');
const { resolveMajorNameTh } = require('../utils/majorName');
const { studentPeriodWhere, countByPeriod } = require('../utils/periodFilter');
const { INTERNSHIP_STATUSES } = require('../utils/internshipForms');
const { listPeriods, getRow, viewPeriod, viewerMajors, targetMajors } = require('../utils/coopPeriodMajor');
const { proposedDays, parseAvailable, unavailableOn, unavailableMessage, teacherName, CO_TEACHER_SELECT } = require('../utils/coTeacherAvailability');

const CLEARED_LETTER_PENDING = { letterPendingAt: null, letterDraftNumber: null, letterDraftDate: null };

// สถานะสหกิจที่ขอนัดนิเทศได้ (ออกฝึกแล้ว) — ต้องตรงกับ isInternshipPhase ใน Frontend/src/components/S_Supervision.tsx
const MAX_PROPOSED_DATES = 30; // วันที่นักศึกษาเสนอได้ต่อครั้ง
const SUPERVISION_PROPOSE_STATUSES = INTERNSHIP_STATUSES;

// เลขที่หนังสือขอนิเทศห้ามซ้ำกับหนังสือทุกประเภท (ใช้เลขชุดเดียวกับขอความอนุเคราะห์/ส่งตัว) — ดู utils/letterNumberFree.js
// appointmentIds = นัดในหนังสือฉบับนี้ (หนังสือรวมของกลุ่มนิเทศใช้เลขเดียวกันได้) — เลิก unique ระดับ DB แล้ว
const { DOC_NUMBER_TX } = require('../utils/docNumberLock');
const { lockTeachers, lockAppointments, LOCK_TX } = require('../utils/rowLock');
// ล็อกรอกันนานเกิน/สองคำขอรอกันเอง (MySQL ยกเลิกคำขอหนึ่ง) → ให้ผู้ใช้ลองใหม่ แทน 500
const isLockConflict = (err) => err?.code === 'P2034' || /deadlock|lock wait timeout/i.test(String(err?.message || ''));
const BUSY_MESSAGE = 'มีการบันทึกนัดนิเทศเดียวกันพร้อมกันอยู่ กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง';
const { assertLetterNumberFree } = require('../utils/letterNumberFree');
const assertSupervisionDocNumberFree = (tx, value, appointmentIds) => assertLetterNumberFree(tx, 'supervisionLetter', value, appointmentIds);

// ==========================================
// ⚙️ [ADMIN] จัดการ Config ช่วงเวลานิเทศ (ผูกกับ CoopPeriod)
// ==========================================
// ช่วงนิเทศแยกหลักสูตร (CoopPeriodMajor) — รูปแบบรายการเหมือน /admin/coop-periods (ค่าระดับบน = หลักสูตรที่ดู)
exports.getSupervisionPeriods = async (req, res) => {
    try {
        const majors = await viewerMajors(req);
        const periods = (await listPeriods()).map((p) => viewPeriod(p, majors));
        res.json({ ok: true, periods });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
};

// บันทึกช่วงนิเทศของหลักสูตรหนึ่ง (ระบุ major · อาจารย์ประจำวิชาที่ดูแลหลักสูตรเดียวไม่ต้องระบุ)
// หลักสูตรที่ยังไม่มีแถวรอบนี้ → สร้างให้ (วันรับสมัครตั้งต้นจากรอบ, ยังไม่เปิดรับสมัคร)
exports.saveSupervisionPeriod = async (req, res) => {
    try {
        const { periodId, major, isSupervisionOpen, supervisionStartDate, supervisionEndDate } = req.body;

        const parsedPeriodId = parseInt(periodId, 10);
        if (!isDbId(parsedPeriodId)) {
            return res.status(400).json({ ok: false, message: 'periodId ไม่ถูกต้อง' });
        }
        const [m] = await targetMajors(req, major);
        const period = await prisma.coopPeriod.findUnique({ where: { id: parsedPeriodId } });
        if (!period) return res.status(404).json({ ok: false, message: 'ไม่พบรอบสหกิจ' });

        // วันที่ผิดรูปแบบเดิมพังเป็น 500 · เริ่มหลังสิ้นสุดเดิมบันทึกได้เงียบ ๆ (ตอนนี้ช่วงนี้บังคับวันที่นักศึกษาเสนอ = นัดไม่ได้ทั้งหลักสูตร)
        const data = {
            isSupervisionOpen: !!isSupervisionOpen,
            supervisionStartDate: supervisionStartDate ? parseDateOr400(supervisionStartDate, 'วันเริ่มนัดหมายนิเทศ') : null,
            supervisionEndDate: supervisionEndDate ? parseDateOr400(supervisionEndDate, 'วันสิ้นสุดนัดหมายนิเทศ') : null,
        };
        if (data.supervisionStartDate && data.supervisionEndDate && data.supervisionStartDate > data.supervisionEndDate) {
            return res.status(400).json({ ok: false, message: 'วันเริ่มนัดหมายนิเทศต้องไม่หลังวันสิ้นสุด' });
        }
        await prisma.coopPeriodMajor.upsert({
            where: { periodId_major: { periodId: parsedPeriodId, major: m } },
            update: data,
            create: { periodId: parsedPeriodId, major: m, startDate: period.startDate, endDate: period.endDate, ...(period.deadlines ? { deadlines: period.deadlines } : {}), ...data },
        });
        const full = (await listPeriods()).find((p) => p.id === parsedPeriodId);
        res.json({ ok: true, period: viewPeriod(full, [m]) });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        if (err.is400) return res.status(400).json({ ok: false, message: err.message });
        if (err.code === 'P2003') return res.status(400).json({ ok: false, message: 'ไม่พบหลักสูตรนี้ในระบบ' });
        console.error(err);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
};

// ==========================================
// 👩‍💼 [ADMIN] จัดการรายการนิเทศและอัปโหลดหนังสือ
// ==========================================
// "รอดำเนินการ" ต่อรอบของแต่ละหน้า (?pending=) — letter (ค่าเริ่ม) = ยืนยันวันแล้วยังไม่โหลดร่างหนังสือ (หน้าจัดการนิเทศ)
//   coteacher = ยังไม่มีอาจารย์นิเทศร่วม (แท็บ "ทั้งหมด" ของอาจารย์ประจำวิชา) — ตรงกับตัวนับเดิมของแต่ละหน้า
const SUPERVISION_PENDING = {
    letter: (a) => a.status === 'DATE_CONFIRMED' && !a.letterPendingAt,
    coteacher: (a) => !a.coTeacherName,
};
const SUPERVISION_INCLUDE = {
    student: {
        include: { coop: { include: { company: true, contacts: { orderBy: { createdAt: 'asc' } } } } }
    },
    teacher: true,
    coTeachers: { select: CO_TEACHER_SELECT },
};

/**
 * GET /api/admin/supervisions?coopPeriodId=<id|none|all>&countsOnly=1&pending=letter|coteacher
 *   ไม่ระบุรอบ = ทุกรอบ (เหมือนเดิม) · countsOnly → { ok, periods: [{ coopPeriodId, count, pending }] }
 * กรองรอบแล้ว: นัดในกลุ่มเดียวกัน (groupId — หนังสือนิเทศรวม) ที่อยู่นอกรอบถูกส่งมาด้วย ติด outsidePeriod: true
 *   — ตารางไม่แสดง แต่หนังสือรวมของกลุ่มต้องได้นัดครบ
 */
exports.getAllSupervisions = async (req, res) => {
    try {
        const period = studentPeriodWhere(req.query?.coopPeriodId);
        if (period.error) return res.status(400).json({ ok: false, message: period.error });
        const scope = await getMajorScope(req);
        const studentBase = { deletedAt: null, ...studentWhere(scope) };

        if (req.query?.countsOnly) {
            const isPending = SUPERVISION_PENDING[req.query.pending] || SUPERVISION_PENDING.letter;
            const rows = await prisma.supervisionAppointment.findMany({
                where: { student: studentBase },
                select: { status: true, letterPendingAt: true, coTeacherName: true, student: { select: { coop: { select: { coopPeriodId: true } } } } },
            });
            return res.json({ ok: true, periods: countByPeriod(rows, { periodOf: (r) => r.student?.coop?.coopPeriodId, isPending }) });
        }

        const where = { student: period.where ? { AND: [studentBase, period.where] } : studentBase };
        const [supervisions, criteria] = await Promise.all([
            prisma.supervisionAppointment.findMany({ where, include: SUPERVISION_INCLUDE, orderBy: { updatedAt: 'desc' } }),
            prisma.coopCriteria.findMany({ select: { major: true, nameTh: true } }),
        ]);
        let outside = [];
        const groupIds = period.where ? [...new Set(supervisions.map((x) => x.groupId).filter(Boolean))] : [];
        if (groupIds.length) {
            const have = new Set(supervisions.map((x) => x.id));
            outside = (await prisma.supervisionAppointment.findMany({ where: { groupId: { in: groupIds }, student: studentBase }, include: SUPERVISION_INCLUDE, orderBy: { updatedAt: 'desc' } }))
                .filter((x) => !have.has(x.id))
                .map((x) => ({ ...x, outsidePeriod: true }));
        }
        // major เป็นรหัสสาขา (CS/AI) — หนังสือนิเทศต้องใช้ชื่อหลักสูตรภาษาไทยจริง
        const withMajorName = [...supervisions, ...outside].map(s => ({
            ...s,
            student: s.student ? { ...s.student, majorNameTh: resolveMajorNameTh(s.student.major, criteria) } : s.student,
            // อาจารย์ร่วม + วันว่างที่ตอบแล้ว (null = ยังไม่ตอบ)
            coTeachers: (s.coTeachers || []).map(c => ({ teacherId: c.teacherId, name: teacherName(c.teacher), availableDates: parseAvailable(c.availableDates), respondedAt: c.respondedAt })),
        }));
        res.json({ ok: true, supervisions: withMajorName });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
};

// นัดในหนังสือฉบับนี้ — ไม่ส่ง appointmentIds = นัดเดียว · ส่งมา = หนังสือรวมของกลุ่มนิเทศ (ทุกนัดต้องอยู่ groupId เดียวกัน และรวมนัดนี้ด้วย)
async function letterAppointmentIds(tx, id, raw) {
    if (raw === undefined || raw === null || raw === '') return [id];
    let arr = raw;
    if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch (_) { arr = raw.split(','); } }
    const ids = [...new Set([].concat(arr).map((x) => parseInt(x, 10)).filter(isDbId))];
    if (!ids.includes(id)) ids.unshift(id);
    if (ids.length === 1) return ids;
    const rows = await tx.supervisionAppointment.findMany({ where: { id: { in: ids } }, select: { id: true, groupId: true } });
    if (rows.length !== ids.length || !rows[0].groupId || rows.some((r) => r.groupId !== rows[0].groupId)) {
        throw Object.assign(new Error('หนังสือรวมต้องเป็นนัดในกลุ่มนิเทศเดียวกัน'), { is400: true });
    }
    return ids;
}

exports.uploadOfficialLetter = async (req, res) => {
    try {
        const { id } = req.params;
        const parsedId = parseInt(id, 10);
        if (!isDbId(parsedId)) {
            if (req.file) try { fs.unlinkSync(path.join(__dirname, '../uploads/supervision', req.file.filename)); } catch (_) {}
            return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
        }
        if (!req.file) {
            return res.status(400).json({ ok: false, message: 'กรุณาอัปโหลดไฟล์ PDF' });
        }

        let appointment;
        let letterIds = [parsedId];
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
                letterIds = await letterAppointmentIds(tx, parsedId, req.body?.appointmentIds);
                // ล็อกนัดก่อนอ่านสถานะ — อัปโหลดรัว ๆ ออกหนังสือครั้งเดียว (เดิมผ่านทุกคำขอ ไฟล์ของคำขอที่ถูกทับค้างในโฟลเดอร์)
                await lockAppointments(tx, letterIds);
                for (const aid of letterIds) {
                    const current = await tx.supervisionAppointment.findUnique({ where: { id: aid } });
                    if (!current || current.status !== 'DATE_CONFIRMED') {
                        throw Object.assign(new Error('สามารถออกหนังสือนิเทศได้เฉพาะเมื่อยืนยันวันแล้ว'), { is400: true });
                    }
                }
                await assertSupervisionDocNumberFree(tx, data.letterDocNumber, letterIds);
                // หนังสือรวม: ไฟล์ลงนามไฟล์เดียว เลขที่เดียว ผูกกับทุกนัดในกลุ่ม
                for (const aid of letterIds) {
                    const updated = await tx.supervisionAppointment.update({ where: { id: aid }, data });
                    if (aid === parsedId) appointment = updated;
                }
            }, DOC_NUMBER_TX);
        } catch (txErr) {
            if (req.file) {
                const fp = path.join(__dirname, '../uploads/supervision', req.file.filename);
                if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (_) {}
            }
            if (txErr.is400) return res.status(400).json({ ok: false, message: txErr.message });
            if (txErr.is409) return res.status(409).json({ ok: false, message: txErr.message });
            // unique index — สองคำขอใช้เลขเดียวกันพร้อมกันจนรอดด่านเช็ค
            if (txErr.code === 'P2002') return res.status(409).json({ ok: false, message: 'เลขที่หนังสือขอนิเทศนี้ถูกใช้ไปแล้ว กรุณาใช้เลขอื่น' });
            if (isLockConflict(txErr)) return res.status(409).json({ ok: false, message: BUSY_MESSAGE });
            throw txErr;
        }

        setAuditDetail(res, {
            action: `${supervisionLetterActionText({ docNumber: appointment.letterDocNumber })}${letterIds.length > 1 ? ` (หนังสือรวม ${letterIds.length} คน)` : ''}`,
            targetType: 'นัดนิเทศ',
            targetId: letterIds.join(','),
        });
        res.json({ ok: true, appointment, appointmentIds: letterIds });

        // Notify students (ทุกคนในหนังสือ)
        Promise.all(letterIds.map(async (aid) => {
            const appt = aid === parsedId ? appointment : await prisma.supervisionAppointment.findUnique({ where: { id: aid }, select: { studentId: true } });
            const student = appt && await prisma.student.findUnique({ where: { id: appt.studentId }, select: { userId: true } });
            if (!student?.userId) return;
            return createNotifications([student.userId], {
                type: 'SUPERVISION_LETTER_UPLOADED',
                title: 'หนังสือนิเทศอนุมัติแล้ว',
                message: 'หนังสือนิเทศได้รับการอนุมัติ เตรียมพร้อมรับการนิเทศ',
                link: '/student/supervision',
                relatedId: String(appt.studentId),
            });
        })).catch(console.error);
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
        if (!isDbId(id)) return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
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
            const ids = await letterAppointmentIds(tx, id, req.body?.appointmentIds);
            for (const aid of ids) {
                const current = await tx.supervisionAppointment.findUnique({
                    where: { id: aid },
                    select: { status: true, letterPendingAt: true, letterDraftNumber: true, student: { select: { deletedAt: true } } },
                });
                if (!current || current.student?.deletedAt) throw Object.assign(new Error('ไม่พบข้อมูลการนัดหมาย'), { is404: true });
                if (!cancel && current.status !== 'DATE_CONFIRMED') {
                    throw Object.assign(new Error('ออกหนังสือนิเทศได้เฉพาะนัดหมายที่ยืนยันวันแล้ว'), { is400: true });
                }
                // รอลงนามอยู่ = ร่างที่ส่งไปเซ็นแล้ว — รับเฉพาะเลขร่างเดิม (โหลดไฟล์เดิมซ้ำ) เหมือนหนังสือขอความอนุเคราะห์/ส่งตัว
                if (!cancel && current.letterPendingAt && (current.letterDraftNumber || null) !== data.letterDraftNumber) {
                    throw Object.assign(new Error(`มีร่างหนังสือขอนิเทศที่รอลงนามอยู่ (เลข ${current.letterDraftNumber || 'ยังไม่ได้กรอก'}) — ถ้าจะออกร่างใหม่ ให้กด "ยกเลิกรอลงนาม" ก่อน`), { is409: true });
                }
            }
            if (!cancel) await assertSupervisionDocNumberFree(tx, data.letterDraftNumber, ids);
            for (const aid of ids) await tx.supervisionAppointment.update({ where: { id: aid }, data });
        }, DOC_NUMBER_TX);

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
// ช่วงนิเทศของนักศึกษา = แถวหลักสูตรของนักศึกษาในรอบที่ตัวเองสังกัด (StudentCoop.coopPeriodId) — ไม่มี = ยังไม่เปิด
const NO_MAJOR_MESSAGE = 'ยังไม่ได้ระบุหลักสูตรของคุณ จึงยังนัดนิเทศไม่ได้ — กรุณาติดต่อเจ้าหน้าที่ให้ระบุหลักสูตร';

// วันที่เสนอที่อยู่นอกช่วงนิเทศของหลักสูตร → ข้อความแจ้ง (null = อยู่ในช่วง / ไม่ได้ตั้งช่วง) · ตั้งไว้ฝั่งเดียวก็เช็คฝั่งนั้น
const thaiDay = (d) => new Date(d).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' });
function outsideSupervisionWindow(entries, period) {
    const from = period?.supervisionStartDate ? dateKey(new Date(period.supervisionStartDate)) : null;
    const to = period?.supervisionEndDate ? dateKey(new Date(period.supervisionEndDate)) : null;
    if (!from && !to) return null;
    const bad = entries.find((e) => (from && e.date < from) || (to && e.date > to));
    if (!bad) return null;
    const range = from && to ? `${thaiDay(period.supervisionStartDate)} – ${thaiDay(period.supervisionEndDate)}`
        : from ? `ตั้งแต่ ${thaiDay(period.supervisionStartDate)}` : `ถึง ${thaiDay(period.supervisionEndDate)}`;
    return `วันที่เสนอ ${thaiDay(`${bad.date}T12:00:00+07:00`)} อยู่นอกช่วงนิเทศของหลักสูตร (${range}) — กรุณาเลือกวันในช่วงนี้`;
}

async function studentSupervisionPeriod(student) {
    const periodId = student.coop?.coopPeriodId;
    if (!periodId || !student.major) return null;
    const [period, row] = await Promise.all([
        prisma.coopPeriod.findUnique({ where: { id: periodId }, select: { id: true, academicYear: true, semester: true } }),
        getRow(periodId, student.major),
    ]);
    if (!period || !row) return null;
    return { ...period, major: row.major, startDate: row.startDate, endDate: row.endDate, isActive: row.isActive,
        supervisionStartDate: row.supervisionStartDate, supervisionEndDate: row.supervisionEndDate, isSupervisionOpen: row.isSupervisionOpen };
}

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
        const supervisionPeriod = await studentSupervisionPeriod(student);

        // ยังไม่ระบุหลักสูตร → ไม่มีช่วงนิเทศให้ใช้ (ช่วงนิเทศแยกหลักสูตร) — บอกสาเหตุให้หน้าจอแสดงแทน "ยังไม่เปิด"
        res.json({ ok: true, appointment, supervisionPeriod, ...(student.major ? {} : { reason: 'NO_MAJOR', message: NO_MAJOR_MESSAGE }) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
};

exports.proposeSupervisionDate = async (req, res) => {
    try {
        // อาจารย์ร่วมกำหนดโดยเจ้าหน้าที่/อาจารย์ประจำวิชาเท่านั้น (assignCoTeachers) — ไม่รับจากนักศึกษา
        const { proposedDates, supervisionType, onlineLink } = req.body;
        if (supervisionType !== undefined && supervisionType !== 'ONLINE' && supervisionType !== 'ONSITE') {
            return res.status(400).json({ ok: false, message: 'supervisionType ต้องเป็น ONLINE หรือ ONSITE เท่านั้น' });
        }
        // คอลัมน์ Text เก็บได้ ~64 KB — ยาวกว่านี้เดิมตกเป็น 500 · ลิงก์ประชุมจริงไม่เกินไม่กี่ร้อยตัวอักษร
        if (onlineLink !== undefined && onlineLink !== null && String(onlineLink).length > 2000) {
            return res.status(400).json({ ok: false, message: 'ลิงก์ประชุมออนไลน์ยาวเกินไป (ไม่เกิน 2,000 ตัวอักษร)' });
        }
        if (onlineLink) {
            try {
                const u = new URL(String(onlineLink).trim());
                if (!['https:', 'http:'].includes(u.protocol)) throw new Error('bad protocol');
            } catch {
                return res.status(400).json({ ok: false, message: 'onlineLink ต้องเป็น URL แบบ http/https เท่านั้น' });
            }
        }
        // ตรงกับที่หน้าเสนอวันกัน (S_Supervision handleSubmit) — เดิมเรียก API ตรงแล้วสร้างนัดที่ไม่มีวันให้อาจารย์เลือก
        // หรือช่วงเวลากลับหัวได้ · ส่งมาไม่ใช่ข้อความ JSON = 500 จากฐานข้อมูล
        if (typeof proposedDates !== 'string') {
            return res.status(400).json({ ok: false, message: 'proposedDates ต้องเป็นรายการวันที่ (JSON)' });
        }
        const invalidDates = invalidProposedDates(proposedDates);
        if (invalidDates) return res.status(400).json({ ok: false, message: invalidDates });
        const proposedEntries = parseProposedList(proposedDates);
        if (!proposedEntries.length) {
            return res.status(400).json({ ok: false, message: 'กรุณาระบุวันที่ต้องการเสนออย่างน้อย 1 วัน' });
        }
        const invertedIdx = proposedEntries.findIndex((e) => e.start && e.end && e.start >= e.end);
        if (invertedIdx >= 0) {
            return res.status(400).json({ ok: false, message: `ตัวเลือกที่ ${invertedIdx + 1}: เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด` });
        }
        if (proposedEntries.some((e) => e.type === 'ONLINE') && !String(onlineLink || '').trim()) {
            return res.status(400).json({ ok: false, message: 'กรุณาระบุ Link สำหรับการนิเทศออนไลน์ (เช่น Zoom, Google Meet)' });
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
        // เสนอได้หลายวัน (เดิมหน้าเว็บจำกัด 3) — เพดานกันข้อมูลบวม ตรงกับหน้าเว็บ
        if (parseProposedList(proposedDates).length > MAX_PROPOSED_DATES) {
            return res.status(400).json({ ok: false, message: `เสนอวันได้สูงสุด ${MAX_PROPOSED_DATES} ตัวเลือก` });
        }
        const pastEntry = parseProposedList(proposedDates).find((e) => e.date < todayKey);
        if (pastEntry) {
            return res.status(400).json({ ok: false, message: `วันที่เสนอ ${pastEntry.date} ผ่านมาแล้ว กรุณาเลือกตั้งแต่วันนี้เป็นต้นไป` });
        }

        // เดิม frontend ปิดปุ่มเองตาม isSupervisionOpen (S_Supervision.tsx) แต่ backend ไม่เคยเช็คซ้ำเลย
        // — เรียก endpoint ตรงผ่านปุ่มที่ถูกปิดได้เสมอ ต้องดูรอบสหกิจของ นศ. คนนี้เอง ไม่ใช่ "รอบรับสมัคร
        // ที่เปิดอยู่ตอนนี้" (isActive ปิดอัตโนมัติเมื่อหมดเขตรับสมัคร ซึ่งมักปิดไปนานแล้วตอนเริ่มนิเทศ)
        // ช่วงนิเทศของหลักสูตรนักศึกษาในรอบของตัวเอง (แยกหลักสูตร)
        if (!student.major) return res.status(403).json({ ok: false, message: '⛔ ' + NO_MAJOR_MESSAGE });
        const supervisionPeriod = await studentSupervisionPeriod(student);
        if (!supervisionPeriod || !supervisionPeriod.isSupervisionOpen) {
            return res.status(403).json({ ok: false, message: '⛔ ระบบยังไม่เปิดให้นัดหมายนิเทศในขณะนี้' });
        }
        // ช่วงนิเทศของหลักสูตร (ถ้าตั้งไว้) — นักศึกษาเสนอได้เฉพาะวันในช่วง (เดิมใช้แสดงผลอย่างเดียว เสนอนอกช่วงได้)
        // อาจารย์/เจ้าหน้าที่แก้วันที่ยืนยันแล้วไปนอกช่วงได้ (updateConfirmedDate ไม่เช็ค — กรณีพิเศษ)
        const outsideWindow = outsideSupervisionWindow(proposedEntries, supervisionPeriod);
        if (outsideWindow) return res.status(400).json({ ok: false, message: outsideWindow });

        // หา Teacher จาก coopAdvisorId (อาจารย์ที่ปรึกษาโครงการสหกิจ) เป็นผู้นิเทศหลัก
        if (!student.coopAdvisorId) {
            return res.status(400).json({ ok: false, message: 'ไม่พบอาจารย์ที่ปรึกษาโครงการ กรุณาเลือกในหน้าข้อมูลส่วนตัวก่อน' });
        }

        const teacher = await prisma.teacher.findUnique({ where: { id: student.coopAdvisorId } });
        if (!teacher) {
            return res.status(400).json({ ok: false, message: 'ไม่พบข้อมูลอาจารย์ที่ปรึกษาโครงการในระบบ กรุณาติดต่อเจ้าหน้าที่' });
        }

        const LOCKED_STATUSES = ['DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED'];
        let coUserIdsAtPropose = [];

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
            const data = { teacherId: teacher.id, proposedDates, supervisionType: resolvedType, onlineLink, status: 'PENDING_TEACHER' };
            let saved;
            if (existing) {
                // เงื่อนไขสถานะอยู่ใน where — อาจารย์ยืนยันวันระหว่างที่คำขอนี้ทำงาน (อีก transaction) ต้องไม่ถูกเขียนทับกลับเป็น "รออาจารย์"
                // (เดิม upsert ไม่มีเงื่อนไข: นัดที่เพิ่งยืนยันกลับเป็นรอ ทั้งที่ทุกคนได้แจ้งเตือนว่ายืนยันแล้ว)
                const { count } = await tx.supervisionAppointment.updateMany({
                    where: { studentId: student.id, status: { notIn: LOCKED_STATUSES } },
                    data: { ...data, rejectReason: null },
                });
                if (!count) throw Object.assign(new Error('LOCKED'), { status: 403 });
                saved = await tx.supervisionAppointment.findUnique({ where: { studentId: student.id } });
            } else {
                saved = await tx.supervisionAppointment.create({ data: { studentId: student.id, ...data } });
            }
            // วันที่เสนอใหม่ → วันว่างที่อาจารย์ร่วมเคยตอบใช้ไม่ได้แล้ว ต้องตอบใหม่
            if (existing) {
                await tx.supervisionCoTeacher.updateMany({ where: { appointmentId: saved.id }, data: { availableDates: null, respondedAt: null } });
            }
            // อาจารย์ร่วม ณ ตอนเสนอวัน — อ่านใน transaction (ถ้าอ่านทีหลังตอนส่งแจ้งเตือน อาจได้คนที่เพิ่งถูกเพิ่มหลังเสนอ ซึ่งได้แจ้งเตือนของการมอบหมายไปแล้ว)
            coUserIdsAtPropose = (await tx.supervisionCoTeacher.findMany({ where: { appointmentId: saved.id }, select: { teacher: { select: { userId: true } } } }))
                .map(c => c.teacher?.userId).filter(Boolean);
            return saved;
        }).catch(err => {
            if (err.status === 403) {
                res.status(403).json({ ok: false, message: 'ไม่สามารถแก้ไขได้ เนื่องจากอาจารย์ยืนยันวันนิเทศแล้ว' });
                return null;
            }
            if (err.status === 400) {
                res.status(400).json({ ok: false, message: err.message });
                return null;
            }
            // กดส่งซ้ำพร้อมกันตอนยังไม่มีนัด — อีกคำขอสร้างแถวไปแล้ว (studentId unique)
            if (err.code === 'P2002') {
                res.status(409).json({ ok: false, message: 'กำลังบันทึกคำขอก่อนหน้าอยู่ กรุณาโหลดหน้าใหม่แล้วตรวจสอบอีกครั้ง' });
                return null;
            }
            throw err;
        });
        if (!appointment) return;

        res.json({ ok: true, appointment });

        // Fire notification async without blocking response
        // Staff / coop-teachers (excluding the assigned teacher to avoid duplicate)
        // then notify the assigned teacher separately with the teacher-facing link
        getStaffAndCoopTeacherIds(student.major).then(async ids => {
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
          // อาจารย์ร่วม: ระบุวันที่ว่างจากวันที่นักศึกษาเสนอ
          const coUserIds = coUserIdsAtPropose;
          if (coUserIds.length) {
            await createNotifications(coUserIds, {
              type: 'SUPERVISION_CO_AVAILABILITY',
              title: 'ระบุวันที่ว่างสำหรับนิเทศ',
              message: 'นักศึกษาที่คุณเป็นอาจารย์นิเทศร่วมเสนอวันนิเทศ กรุณาติ๊กวันที่คุณว่าง',
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
// แจ้งอาจารย์ร่วมที่ถูกเพิ่มใหม่: ยังไม่ยืนยันวัน → ขอให้ระบุวันว่าง · ยืนยันแล้ว → แจ้งวันที่ตกลงแล้ว
async function notifyNewCoTeachers(appointmentId, prevIds) {
    const appt = await prisma.supervisionAppointment.findUnique({
        where: { id: appointmentId },
        select: { status: true, confirmedDate: true, coTeachers: { select: { teacherId: true, teacher: { select: { userId: true } } } }, student: { select: { firstName: true, lastName: true, studentId: true } } },
    });
    if (!appt) return;
    const added = appt.coTeachers.filter(c => !prevIds.includes(c.teacherId)).map(c => c.teacher?.userId).filter(Boolean);
    if (!added.length) return;
    const who = [appt.student?.firstName, appt.student?.lastName].filter(Boolean).join(' ') || appt.student?.studentId || '';
    const pending = ['PENDING_TEACHER', 'TEACHER_REJECTED'].includes(appt.status);
    await createNotifications(added, {
        type: pending ? 'SUPERVISION_CO_AVAILABILITY' : 'SUPERVISION_CO_ASSIGNED',
        title: 'คุณเป็นอาจารย์นิเทศร่วม',
        message: pending
            ? `คุณได้รับมอบหมายเป็นอาจารย์นิเทศร่วมของ ${who} กรุณาติ๊กวันที่คุณว่าง`
            : `คุณได้รับมอบหมายเป็นอาจารย์นิเทศร่วมของ ${who} — วันนิเทศที่ตกลงแล้ว: ${appt.confirmedDate ? new Date(appt.confirmedDate).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) : '-'}`,
        link: '/teacher/review-supervision',
        relatedId: String(appointmentId),
    });
}

exports.assignCoTeachers = async (req, res) => {
    try {
        const { id } = req.params;
        const { coTeacherIds } = req.body; // id อาจารย์ร่วม เช่น [7, 68]

        const parsedId = parseInt(id, 10);
        if (!isDbId(parsedId)) {
            return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
        }
        if (!Array.isArray(coTeacherIds)) {
            return res.status(400).json({ ok: false, message: 'coTeacherIds ต้องเป็นรายการ id อาจารย์' });
        }
        const ids = [...new Set(coTeacherIds.map(n => parseInt(n, 10)))];
        if (ids.some(n => !isDbId(n))) {
            return res.status(400).json({ ok: false, message: 'coTeacherIds ไม่ถูกต้อง' });
        }

        const appt = await prisma.supervisionAppointment.findUnique({ where: { id: parsedId } });
        if (!appt) {
            return res.status(404).json({ ok: false, message: 'ไม่พบข้อมูลการนัดหมาย' });
        }
        await assertStudentInScope(req, appt.studentId);
        const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

        const coIds = ids.filter(n => n !== appt.teacherId); // อาจารย์หลักไม่นับเป็นอาจารย์ร่วม
        // ร่างหนังสือรอลงนาม — บอกเหตุผลนี้ก่อนตรวจรายชื่อ (ตรวจซ้ำใน transaction ด้านล่างอีกที)
        if (appt.letterPendingAt) {
            const current = (await prisma.supervisionCoTeacher.findMany({ where: { appointmentId: parsedId }, select: { teacherId: true } })).map(c => c.teacherId);
            if (!sameSet(current, coIds)) {
                return res.status(409).json({ ok: false, message: `มีร่างหนังสือขอนิเทศที่รอลงนามอยู่ (เลข ${appt.letterDraftNumber || 'ยังไม่ได้กรอก'}) — รายชื่ออาจารย์ในร่างจะไม่ตรง ถ้าจะเปลี่ยนอาจารย์ร่วม ให้กด "ยกเลิกรอลงนาม" ก่อน` });
            }
        }
        const teachers = await prisma.teacher.findMany({
            where: { id: { in: coIds } },
            select: { id: true, prefix: true, firstName: true, lastName: true },
        });
        if (teachers.length !== coIds.length) {
            return res.status(400).json({ ok: false, message: 'ไม่พบอาจารย์บางท่านในระบบ' });
        }

        // coTeacherName = ชื่อสำหรับแสดงผล/หนังสือ (รูปแบบเดิม) สร้างจากบัญชีจริงตามลำดับที่เลือก
        const byId = new Map(teachers.map(t => [t.id, t]));
        const coTeacherName = coIds.length
            ? coIds.map(n => byId.get(n)).map(t => `${t.prefix || ''}${t.firstName} ${t.lastName}`).join(', ')
            : null;

        // ทำใน transaction เดียวหลังล็อก (อาจารย์หลัก + คนเดิม + คนใหม่ → นัด) — เดิมตรวจนอก transaction และเขียนแบบชุดคำสั่ง:
        // สองคนแก้รายชื่อพร้อมกัน แถวอาจารย์ร่วมปนกันสองชุด แต่ชื่อที่แสดง (coTeacherName) เป็นของอีกชุด
        let prevCoIds = [];
        await prisma.$transaction(async (tx) => {
            const before = (await tx.supervisionCoTeacher.findMany({ where: { appointmentId: parsedId }, select: { teacherId: true } })).map(c => c.teacherId);
            await lockTeachers(tx, [appt.teacherId, ...before, ...coIds]);
            await lockAppointments(tx, [parsedId]);
            const cur = await tx.supervisionAppointment.findUnique({ where: { id: parsedId }, include: { coTeachers: { select: { teacherId: true } } } });
            if (!cur) throw Object.assign(new Error('ไม่พบข้อมูลการนัดหมาย'), { is404: true });
            if (cur.teacherId !== appt.teacherId) throw Object.assign(new Error('ผู้นิเทศหลักของนัดนี้เพิ่งเปลี่ยน — กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง'), { is409: true });
            prevCoIds = cur.coTeachers.map(c => c.teacherId);
            await lockTeachers(tx, prevCoIds);

            // ร่างหนังสือขอนิเทศที่ส่งไปเซ็นมีรายชื่ออาจารย์ร่วมชุดเดิม — เปลี่ยนตอนนี้ฉบับลงนามจะไม่ตรง (เหมือนแก้วัน)
            if (cur.letterPendingAt && !sameSet(prevCoIds, coIds)) {
                throw Object.assign(new Error(`มีร่างหนังสือขอนิเทศที่รอลงนามอยู่ (เลข ${cur.letterDraftNumber || 'ยังไม่ได้กรอก'}) — รายชื่ออาจารย์ในร่างจะไม่ตรง ถ้าจะเปลี่ยนอาจารย์ร่วม ให้กด "ยกเลิกรอลงนาม" ก่อน`), { is409: true });
            }

            // อาจารย์ร่วมที่เพิ่มเข้ามาต้องว่างในเวลานั้น — เช็คเมื่อรายการนี้ยืนยันวันแล้วเท่านั้น
            if (coIds.length && cur.confirmedDate && ['DATE_CONFIRMED', 'LETTER_UPLOADED'].includes(cur.status)) {
                const start = new Date(cur.confirmedDate);
                await assertNoTeacherClash(tx, { start, end: resolveSlotEnd(start, cur), teacherIds: coIds, excludeIds: [parsedId] });
            }

            // ลบเฉพาะคนที่เอาออก · คนเดิมคงไว้ (เดิมลบทั้งหมดแล้วสร้างใหม่ — วันว่างที่อาจารย์ร่วมตอบไว้หายทุกครั้งที่แก้รายชื่อ)
            await tx.supervisionCoTeacher.deleteMany({ where: { appointmentId: parsedId, teacherId: { notIn: coIds } } });
            if (coIds.length) await tx.supervisionCoTeacher.createMany({ data: coIds.map(teacherId => ({ appointmentId: parsedId, teacherId })), skipDuplicates: true });
            await tx.supervisionAppointment.update({ where: { id: parsedId }, data: { coTeacherName } });
        }, LOCK_TX);

        res.json({ ok: true, message: "อัปเดตอาจารย์นิเทศร่วมสำเร็จ" });

        notifyNewCoTeachers(parsedId, prevCoIds).catch(console.error);
    } catch (error) {
        if (error.is403) return res.status(403).json({ ok: false, message: error.message });
        if (error.is404) return res.status(404).json({ ok: false, message: error.message });
        if (error.is409) return res.status(409).json({ ok: false, message: error.message });
        if (isLockConflict(error)) return res.status(409).json({ ok: false, message: BUSY_MESSAGE });
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

                    // 🟢 เงื่อนไขที่ 2: เป็นอาจารย์นิเทศร่วม
                    { coTeachers: { some: { teacherId: teacher.id } } },
                ]
            },
            include: {
                student: {
                    include: {
                        coop: { include: { company: true, contacts: { orderBy: { createdAt: 'asc' } } } }
                    }
                },
                teacher: true, // ข้อมูลของอาจารย์หลัก
                coTeachers: { select: CO_TEACHER_SELECT },
            },
            orderBy: { id: 'desc' }
        });

        // 3. Map ข้อมูลเพื่อส่งค่า isPrimaryAdvisor ไปบอกหน้าเว็บว่าคนนี้คืออาจารย์หลักหรือไม่
        const mappedData = supervisions.map(sup => {
            return {
                ...sup,
                // ถ้า teacherId ในคิวนิเทศ ตรงกับ id ของอาจารย์ที่ล็อกอิน แปลว่าเป็น "อาจารย์หลัก" (ได้สิทธิ์กดยืนยันเวลา)
                isPrimaryAdvisor: sup.teacherId === teacher.id,
                // วันว่างของอาจารย์ร่วม (อาจารย์หลักใช้ดูก่อนเลือกวัน) · myAvailableDates = ของฉันเอง (ถ้าเป็นอาจารย์ร่วม)
                coTeachers: sup.coTeachers.map(c => ({ teacherId: c.teacherId, name: teacherName(c.teacher), availableDates: parseAvailable(c.availableDates), respondedAt: c.respondedAt })),
                myAvailableDates: parseAvailable(sup.coTeachers.find(c => c.teacherId === teacher.id)?.availableDates),
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
// ==========================================
// อาจารย์นิเทศร่วมระบุวันที่ว่าง (จากวันที่นักศึกษาเสนอ) — PUT /api/teacher/supervisions/:id/availability
// ==========================================
exports.setCoTeacherAvailability = async (req, res) => {
    try {
        const parsedId = parseInt(req.params.id, 10);
        if (!isDbId(parsedId)) return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
        const days = req.body?.availableDates;
        if (!Array.isArray(days) || days.some(d => typeof d !== 'string')) {
            return res.status(400).json({ ok: false, message: 'availableDates ต้องเป็นรายการวันที่' });
        }
        const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id }, select: { id: true, prefix: true, firstName: true, lastName: true } });
        if (!teacher) return res.status(404).json({ ok: false, message: 'ไม่พบข้อมูลอาจารย์' });
        const appt = await prisma.supervisionAppointment.findUnique({
            where: { id: parsedId },
            select: { id: true, status: true, proposedDates: true, teacher: { select: { userId: true } }, coTeachers: { where: { teacherId: teacher.id }, select: { teacherId: true } }, student: { select: { firstName: true, lastName: true, studentId: true } } },
        });
        if (!appt) return res.status(404).json({ ok: false, message: 'ไม่พบข้อมูลการนัดหมาย' });
        if (!appt.coTeachers.length) return res.status(403).json({ ok: false, message: 'คุณไม่ได้เป็นอาจารย์นิเทศร่วมของนัดนี้' });
        if (appt.status !== 'PENDING_TEACHER') return res.status(400).json({ ok: false, message: 'ระบุวันว่างได้เฉพาะตอนรออาจารย์หลักเลือกวัน' });
        const allowed = proposedDays(appt.proposedDates);
        const unique = [...new Set(days)];
        const bad = unique.filter(d => !allowed.includes(d));
        if (bad.length) return res.status(400).json({ ok: false, message: `วันที่ไม่อยู่ในวันที่นักศึกษาเสนอ: ${bad.join(', ')}` });

        await prisma.supervisionCoTeacher.update({
            where: { appointmentId_teacherId: { appointmentId: parsedId, teacherId: teacher.id } },
            data: { availableDates: JSON.stringify(unique), respondedAt: new Date() },
        });
        res.json({ ok: true, availableDates: unique });

        // แจ้งอาจารย์หลักว่าอาจารย์ร่วมตอบแล้ว
        if (appt.teacher?.userId) {
            const who = [appt.student?.firstName, appt.student?.lastName].filter(Boolean).join(' ') || appt.student?.studentId;
            createNotifications([appt.teacher.userId], {
                type: 'SUPERVISION_CO_RESPONDED',
                title: 'อาจารย์นิเทศร่วมระบุวันว่างแล้ว',
                message: `${teacherName(teacher)} ระบุวันว่างสำหรับนิเทศ ${who} แล้ว (${unique.length ? `ว่าง ${unique.length} วัน` : 'ไม่ว่างทุกวันที่เสนอ'})`,
                link: '/teacher/review-supervision',
                relatedId: String(parsedId),
            }).catch(console.error);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, message: 'บันทึกวันว่างไม่สำเร็จ' });
    }
};

exports.reviewSupervision = async (req, res) => {
    try {
        const { id } = req.params;
        const parsedId = parseInt(id, 10);
        if (!isDbId(parsedId))
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

            const chosenDate = strictDate(confirmedDate) || new Date(NaN);
            if (isNaN(chosenDate.getTime())) return res.status(400).json({ ok: false, message: 'วันที่นิเทศไม่ถูกต้อง' });
            // เลือกได้เฉพาะวันที่นักศึกษาเสนอ (เหมือนยืนยันแบบกลุ่ม · หน้าเว็บมีแต่ปุ่ม "เลือกวันนี้" ของวันที่เสนอ)
            // เดิมเรียก API ตรงแล้วยืนยันวันที่นักศึกษาไม่ได้เสนอได้ — นักศึกษาอาจไม่ว่าง และอาจารย์ร่วมไม่เคยถูกถามวันนั้น
            if (!parseProposedList(supervision.proposedDates).some((e) => e.date === dateKey(chosenDate))) {
                return res.status(400).json({ ok: false, message: 'เลือกได้เฉพาะวันที่นักศึกษาเสนอ — ถ้าต้องการวันอื่น ให้ปฏิเสธพร้อมแจ้งวันที่สะดวกให้นักศึกษาเสนอใหม่' });
            }

            // อาจารย์ร่วมไม่ว่าง/ยังไม่ระบุวันว่าง → เตือนก่อน (อาจารย์หลักยืนยันซ้ำได้ด้วย acknowledgeUnavailable)
            const coList = await prisma.supervisionCoTeacher.findMany({ where: { appointmentId: parsedId }, select: CO_TEACHER_SELECT });
            const unavailable = unavailableOn(coList, dateKey(chosenDate));
            if (unavailable.length && req.body.acknowledgeUnavailable !== true) {
                return res.status(409).json({ ok: false, code: 'CO_TEACHER_UNAVAILABLE', unavailable, message: unavailableMessage(unavailable) });
            }

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
            // ล็อกอาจารย์ทุกคนในนัดก่อนตรวจเวลาชน — อาจารย์คนเดียวกันยืนยันสองนัดพร้อมกันจะทำทีละนัด (เดิมผ่านทั้งคู่ = นัดซ้อน)
            await prisma.$transaction(async (tx) => {
                await lockTeachers(tx, [teacher.id, ...coList.map(c => c.teacherId)]);
                const current = await tx.supervisionAppointment.findUnique({
                    where: { id: parsedId },
                    select: { status: true, teacherId: true, coTeachers: { select: { teacherId: true } } }
                });
                if (!current) {
                    throw Object.assign(new Error('ไม่พบข้อมูลการนัดหมาย'), { is404: true });
                }
                await lockTeachers(tx, current.coTeachers.map(c => c.teacherId)); // อาจารย์ร่วมที่เพิ่งถูกเพิ่มระหว่างนี้
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
                    teacherIds: [teacher.id, ...current.coTeachers.map(c => c.teacherId)],
                    excludeIds: [parsedId],
                });

                // วันที่เสนอต้องยังเป็นชุดที่ตรวจไว้ด้านบน — นักศึกษาแก้วันพร้อมกันพอดี (อีก transaction) จะไม่ได้นัดวันที่ไม่ได้เสนอแล้ว
                const { count } = await tx.supervisionAppointment.updateMany({
                    where: { id: parsedId, status: 'PENDING_TEACHER', proposedDates: supervision.proposedDates },
                    data: approveData
                });
                if (!count) throw Object.assign(new Error('นักศึกษาเพิ่งแก้วันที่เสนอ — กรุณาโหลดหน้าใหม่แล้วเลือกวันอีกครั้ง'), { is409: true });
            }, LOCK_TX);
        } else if (action === 'REJECT') {
            // นักศึกษาต้องรู้ว่าทำไมและควรเสนอวันแบบไหนใหม่ (เหมือนตีกลับ T002/T003) — หน้าเว็บบังคับอยู่แล้ว API เดิมไม่เช็ค
            const reason = typeof rejectReason === 'string' ? rejectReason.trim() : '';
            if (!reason) return res.status(400).json({ ok: false, message: 'กรุณาระบุเหตุผลที่ปฏิเสธ เพื่อให้นักศึกษาเสนอวันใหม่ได้ตรงกับที่อาจารย์สะดวก' });
            if (reason.length > 2000) return res.status(400).json({ ok: false, message: 'เหตุผลยาวเกินไป (ไม่เกิน 2,000 ตัวอักษร)' });
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
                    data: { status: 'TEACHER_REJECTED', confirmedDate: null, rejectReason: reason }
                });
            });
        }

        res.json({ ok: true, message: "บันทึกผลพิจารณาสำเร็จ" });

        if (action === 'APPROVE') {
            prisma.supervisionCoTeacher.findMany({ where: { appointmentId: parsedId }, select: { teacher: { select: { userId: true } } } })
              .then(co => {
                const ids = co.map(c => c.teacher?.userId).filter(Boolean);
                if (!ids.length) return;
                return createNotifications(ids, {
                  type: 'SUPERVISION_DATE_CONFIRMED_CO',
                  title: 'ยืนยันวันนิเทศแล้ว',
                  message: `อาจารย์ผู้นิเทศหลักยืนยันวันนิเทศแล้ว: ${new Date(confirmedDate).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' })}`,
                  link: '/teacher/review-supervision',
                  relatedId: String(parsedId),
                });
              }).catch(console.error);
        }

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
        if (isLockConflict(err)) return res.status(409).json({ ok: false, message: BUSY_MESSAGE });
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
        if (!isDbId(parsedId))
            return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
        const role = (req.user?.role || '').toLowerCase();

        const supervision = await prisma.supervisionAppointment.findUnique({
            where: { id: parsedId }
        });

        if (!supervision) {
            return res.status(404).json({ ok: false, message: "ไม่พบข้อมูลการนัดหมาย" });
        }

        // อาจารย์ — ผู้นิเทศหลักของนัดนี้ หรืออาจารย์ประจำวิชาของหลักสูตรนักศึกษา (ทำงานแทนเจ้าหน้าที่ในหลักสูตร — ปุ่มในหน้าจัดการนิเทศ)
        // admin/staff — ผ่านได้ทันที ไม่ต้องเช็คความเป็นเจ้าของ
        let teacherRecord = null;
        let coopScoped = false;
        if (role === 'teacher') {
            teacherRecord = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
            const scope = await getMajorScope(req, { ignoreFilter: true });
            coopScoped = scope.majors.length > 0 && inScope(scope, await studentMajor(supervision.studentId));
            if (!coopScoped && (!teacherRecord || supervision.teacherId !== teacherRecord.id)) {
                return res.status(403).json({ ok: false, message: "คุณไม่มีสิทธิ์ทำรายการนี้ เฉพาะอาจารย์ผู้นิเทศหลัก หรืออาจารย์ประจำวิชาของหลักสูตรนี้" });
            }
        }

        await prisma.$transaction(async (tx) => {
            // ล็อกนัดก่อนอ่านสถานะ — กดจบนิเทศพร้อมกันหลายคน (ที่ปรึกษา/ประจำวิชา/เจ้าหน้าที่) สำเร็จครั้งเดียว
            // (เดิมผ่านทุกคำขอ → แจ้งเตือน/ส่งแบบประเมินซ้ำ)
            await lockAppointments(tx, [parsedId]);
            const fresh = await tx.supervisionAppointment.findUnique({
                where: { id: parsedId },
                select: { status: true, teacherId: true }
            });
            if (!fresh) throw Object.assign(new Error('ไม่พบข้อมูลการนัดหมาย'), { is404: true });
            if (role === 'teacher' && !coopScoped && fresh.teacherId !== teacherRecord?.id) {
                throw Object.assign(new Error('คุณไม่มีสิทธิ์ทำรายการนี้'), { is403: true });
            }
            if (fresh.status === 'COMPLETED') {
                throw Object.assign(new Error('บันทึกจบนิเทศไปแล้ว'), { is400: true });
            }
            if (fresh.status !== 'LETTER_UPLOADED') {
                throw Object.assign(new Error("ยังไม่สามารถจบนิเทศได้ในสถานะปัจจุบัน"), { is400: true });
            }
            await tx.supervisionAppointment.update({ where: { id: parsedId }, data: { status: 'COMPLETED' } });
        }, LOCK_TX);

        res.json({ ok: true, message: "บันทึกผลนิเทศเสร็จสิ้นสำเร็จ" });

        // โหมดส่งอัตโนมัติ: นิเทศเสร็จ → ส่งลิงก์แบบประเมินให้อาจารย์ผู้นิเทศทันที (ถ้ายังไม่เคยส่ง)
        // ค่าของหลักสูตรนักศึกษาในนัดนี้ (แต่ละหลักสูตรตั้งส่งอัตโนมัติ/ลิงก์ต่างกันได้)
        studentMajor(supervision.studentId)
          .then(m => getEvalConfig(undefined, m))
          .then(cfg => (cfg.autoSend && cfg.evalLink && !supervision.evalSentAt ? sendEvalForAppointments([parsedId]) : null))
          .catch(console.error);

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
        if (isLockConflict(err)) return res.status(409).json({ ok: false, message: BUSY_MESSAGE });
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
        if (!isDbId(parsedId))
            return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
        const { confirmedDate } = req.body;

        if (!confirmedDate) {
            return res.status(400).json({ ok: false, message: 'กรุณาระบุวันที่นิเทศ' });
        }

        const chosenDate = strictDate(confirmedDate) || new Date(NaN);
        if (isNaN(chosenDate.getTime())) return res.status(400).json({ ok: false, message: 'วันที่นิเทศไม่ถูกต้อง' });

        let updated;
        await prisma.$transaction(async (tx) => {
            // ล็อกอาจารย์ในนัดก่อน แล้วค่อยอ่านนัดใหม่ — แก้สองนัดของอาจารย์คนเดียวกันไปเวลาเดียวกันพร้อมกันจะไม่ผ่านทั้งคู่
            const people = await tx.supervisionAppointment.findUnique({ where: { id: parsedId }, select: { teacherId: true, coTeachers: { select: { teacherId: true } } } });
            if (people) await lockTeachers(tx, [people.teacherId, ...people.coTeachers.map(c => c.teacherId)]);
            const fresh = await tx.supervisionAppointment.findUnique({
                where: { id: parsedId },
                include: { coTeachers: { select: { teacherId: true } } },
            });
            if (fresh) await lockTeachers(tx, [fresh.teacherId, ...fresh.coTeachers.map(c => c.teacherId)]);
            if (fresh) await assertStudentInScope(req, fresh.studentId, tx);
            if (!fresh) {
                throw Object.assign(new Error('ไม่พบข้อมูลการนัดหมาย'), { is404: true });
            }
            if (fresh.officialLetterPath) {
                throw Object.assign(new Error('ไม่สามารถแก้ไขได้ เนื่องจากออกหนังสือนิเทศแล้ว'), { is400: true });
            }
            if (fresh.status !== 'DATE_CONFIRMED') {
                throw Object.assign(new Error('สามารถแก้ไขวันนิเทศได้เฉพาะเมื่อสถานะเป็น DATE_CONFIRMED เท่านั้น'), { is400: true });
            }
            // ร่างหนังสือที่ส่งไปเซ็นมีวันนิเทศเดิมอยู่ — แก้วันตอนนี้ฉบับลงนามที่กลับมาจะไม่ตรงกับวันในระบบ
            if (fresh.letterPendingAt) {
                throw Object.assign(new Error(`มีร่างหนังสือขอนิเทศที่รอลงนามอยู่ (เลข ${fresh.letterDraftNumber || 'ยังไม่ได้กรอก'}) — วันในร่างจะไม่ตรงกับวันใหม่ ถ้าจะแก้วัน ให้กด "ยกเลิกรอลงนาม" ก่อน`), { is409: true });
            }

            // ย้ายวัน/เวลา = นัดเดิมที่เลื่อน → คงความยาวคิวเดิมไว้ (เดิมคำนวณใหม่จากช่วงที่นักศึกษาเสนอ
            // ถ้าย้ายไปวันที่ไม่อยู่ในรายการเสนอ ความยาว 2 ชม. หดเหลือค่าตั้งต้น 1 ชม. การตรวจเวลาชนเลยมองไม่เห็นชั่วโมงที่หาย)
            const prevStart = fresh.confirmedDate ? new Date(fresh.confirmedDate) : null;
            const prevEnd = prevStart ? resolveSlotEnd(prevStart, fresh) : null;
            const slotEnd = prevStart && prevEnd > prevStart
                ? new Date(chosenDate.getTime() + (prevEnd.getTime() - prevStart.getTime()))
                : resolveSlotEnd(chosenDate, { proposedDates: fresh.proposedDates });
            await assertNoTeacherClash(tx, {
                start: chosenDate,
                end: slotEnd,
                teacherIds: [fresh.teacherId, ...fresh.coTeachers.map(c => c.teacherId)],
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
        }, LOCK_TX);

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
        if (err.is403) return res.status(403).json({ ok: false, message: err.message });
        if (err.is404) return res.status(404).json({ ok: false, message: err.message });
        if (err.is400) return res.status(400).json({ ok: false, message: err.message });
        if (err.is409) return res.status(409).json({ ok: false, message: err.message });
        if (isLockConflict(err)) return res.status(409).json({ ok: false, message: BUSY_MESSAGE });
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
    if (ids.some((n) => !isDbId(n))) {
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
      include: {
        coTeachers: { select: { teacherId: true } },
        student: { select: { firstName: true, lastName: true, studentId: true, coop: { select: { companyId: true } } } },
      },
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

    // วันตามเวลาท้องถิ่น (dateKey) เหมือนอนุมัติรายคน — frontend ส่ง toISOString() (UTC) มา
    // เดิม slice(0,10) = วันของ UTC → นัดก่อน 07:00 เวลาไทยกลายเป็นวันก่อนหน้า (ไม่ตรงวันที่เสนอ/วันว่างอาจารย์ร่วม)
    const confirmAt = strictDate(confirmedDate) || new Date(NaN);
    if (isNaN(confirmAt.getTime())) return res.status(400).json({ ok: false, message: 'วันที่นิเทศไม่ถูกต้อง' });
    const confirmKey = dateKey(confirmAt);

    // นิเทศพร้อมกัน = ไปบริษัทเดียวกันในวันเดียว — เดิมเช็กแค่บนหน้าเว็บ เรียก API ตรงรวมหลายบริษัทเป็นคิวเดียว (และหนังสือรวมฉบับเดียว) ได้
    const companyIds = new Set(appts.map(a => a.student?.coop?.companyId ?? null));
    if (appts.length > 1 && (companyIds.size !== 1 || companyIds.has(null))) {
      return res.status(400).json({ ok: false, message: 'นัดพร้อมกันได้เฉพาะนักศึกษาที่ฝึกบริษัทเดียวกัน' });
    }

    // แต่ละคนได้เวลาตามช่วงที่ตัวเองเสนอในวันนั้น (ผู้ใช้ตัดสิน 2026-11-10)
    // เดิมคนแรกเริ่มตามเวลาที่อาจารย์เลือก คนถัดไปต่อจากคนก่อนทันที → นักศึกษาที่เสนอบ่าย ถูกนัดเช้าโดยไม่ได้เลือกเวลานั้นเอง
    // เวลาที่อาจารย์เลือก = เวลาเริ่มต่ำสุด · ช่วงที่ไม่มีเวลา (ข้อมูลเก่า) ต่อคิวยาว 60 นาทีแบบเดิม
    const who = (a) => `${a.student?.firstName || ''} ${a.student?.lastName || ''}`.trim() || `นัด #${a.id}`;
    const at = (hhmm) => new Date(`${confirmKey}T${hhmm}:00`);
    const earliest = timeKey(confirmAt);
    const cands = [];
    for (const a of appts) {
      const sameDay = parseProposedList(a.proposedDates).filter(e => e.date === confirmKey);
      if (!sameDay.length) {
        return res.status(400).json({ ok: false, message: `${who(a)} ไม่ได้เสนอวันที่เลือก` });
      }
      // มีแต่เวลาเริ่ม (ข้อมูลเก่า "10:00") = ช่วง 60 นาทีจากเวลานั้น
      const timed = sameDay.filter(e => e.start && (!e.end || e.start < e.end))
        .map(e => ({ ...e, end: e.end || timeKey(resolveSlotEnd(at(e.start), {})) }))
        .sort((x, y) => x.start.localeCompare(y.start));
      cands.push({ a, timed, untimed: sameDay.find(e => !e.start) || sameDay[0] });
    }
    // เรียงตามเวลาที่เสนอเร็วสุดของแต่ละคน (ไม่ขึ้นกับลำดับที่ติ๊ก) — คนที่ไม่มีเวลาไปต่อท้ายตามลำดับที่ส่งมา
    cands.sort((x, y) => (x.timed.length && y.timed.length ? x.timed[0].start.localeCompare(y.timed[0].start) : x.timed.length ? -1 : y.timed.length ? 1 : 0));

    // อาจารย์ร่วมของนัดในกลุ่มไม่ว่าง/ยังไม่ตอบ → เตือนก่อน (เหมือนยืนยันทีละนัด)
    const coRows = await prisma.supervisionCoTeacher.findMany({ where: { appointmentId: { in: ids } }, select: CO_TEACHER_SELECT });
    const seen = new Set();
    const groupUnavailable = unavailableOn(coRows, confirmKey).filter(u => (seen.has(u.teacherId) ? false : seen.add(u.teacherId)));
    if (groupUnavailable.length && req.body.acknowledgeUnavailable !== true) {
      return res.status(409).json({ ok: false, code: 'CO_TEACHER_UNAVAILABLE', unavailable: groupUnavailable, message: unavailableMessage(groupUnavailable) });
    }

    const groupId = appts.length > 1 ? require('crypto').randomUUID() : null;

    // อาจารย์คนเดียวนิเทศทีละคน — ช่วงที่เสนอทับกันยืนยันพร้อมกันไม่ได้ (ปฏิเสธคนหนึ่งให้เสนอเวลาใหม่ หรือเอาออกจากกลุ่ม)
    // แต่ละคนใช้ช่วงแรกของตัวเองที่เริ่มหลังคิวก่อนหน้าจบ (เสนอหลายช่วงในวันเดียว = เลือกช่วงที่ไม่ทับให้)
    let cursor = at(earliest);
    let prev = null;
    const plan = [];
    const span = (p) => `${timeKey(p.start)}-${timeKey(p.end)}`;
    for (const { a, timed, untimed } of cands) {
      let start, end, type;
      if (timed.length) {
        const e = timed.find(x => at(x.start) >= cursor);
        if (!e) {
          const list = timed.map(x => `${x.start}-${x.end}`).join(', ');
          return res.status(400).json({
            ok: false,
            message: prev
              ? `${who(a)} เสนอ ${list} ทับกับคิวของ ${who(prev.a)} (${span(prev)}) — อาจารย์นิเทศได้ทีละคน กรุณาปฏิเสธให้คนหนึ่งเสนอเวลาใหม่ หรือเอาออกจากกลุ่ม`
              : `${who(a)} เสนอ ${list} — ก่อนเวลาเริ่มที่เลือก (${earliest})`,
          });
        }
        start = at(e.start); end = at(e.end); type = e.type;
      } else {
        start = new Date(cursor); end = resolveSlotEnd(start, {}); type = untimed?.type;
      }
      if (dateKey(end) !== confirmKey) {
        return res.status(400).json({ ok: false, message: 'คิวนิเทศของกลุ่มต้องจบภายในวันที่เลือก กรุณาแบ่งกลุ่มให้เล็กลง' });
      }
      plan.push({ id: a.id, coTeacherIds: (a.coTeachers || []).map(c => c.teacherId), start, end, sType: type === 'ONLINE' ? 'ONLINE' : 'ONSITE' });
      prev = { a, start, end };
      cursor = end;
    }

    const groupIds = appts.map(a => a.id);
    try {
      await prisma.$transaction(async (tx) => {
        // ล็อกอาจารย์ (หลัก + ร่วมทุกนัด) แล้วล็อกนัดทั้งกลุ่ม → อ่านใหม่ว่ายังรอยืนยัน และวันที่เสนอยังเป็นชุดที่ตรวจไว้
        // เดิมไม่ตรวจซ้ำใน transaction: กดยืนยันกลุ่มรัว ๆ ผ่านทุกครั้ง (ได้ groupId ใหม่ทับกันไปเรื่อย ๆ)
        await lockTeachers(tx, [teacher.id, ...plan.flatMap(p => p.coTeacherIds)]);
        await lockAppointments(tx, groupIds);
        const now = await tx.supervisionAppointment.findMany({
          where: { id: { in: groupIds } },
          select: { id: true, status: true, teacherId: true, proposedDates: true, coTeachers: { select: { teacherId: true } } },
        });
        const nowById = new Map(now.map(a => [a.id, a]));
        for (const a of appts) {
          const cur = nowById.get(a.id);
          if (!cur || cur.teacherId !== teacher.id || !['PENDING_TEACHER', 'TEACHER_REJECTED'].includes(cur.status) || cur.proposedDates !== a.proposedDates) {
            throw Object.assign(new Error('บางรายการเพิ่งถูกยืนยันหรือนักศึกษาเพิ่งแก้วันที่เสนอ — กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง'), { is409: true });
          }
        }
        for (const slot of plan) {
          // อาจารย์ร่วมที่เพิ่งถูกเพิ่มระหว่างนี้ต้องนับในการตรวจเวลาชนด้วย
          const coNow = (nowById.get(slot.id).coTeachers || []).map(c => c.teacherId);
          await lockTeachers(tx, coNow);
          await assertNoTeacherClash(tx, {
            start: slot.start,
            end: slot.end,
            teacherIds: [teacher.id, ...new Set([...slot.coTeacherIds, ...coNow])],
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
      }, LOCK_TX);
    } catch (txErr) {
      if (txErr.is409) return res.status(409).json({ ok: false, message: txErr.message });
      if (isLockConflict(txErr)) return res.status(409).json({ ok: false, message: BUSY_MESSAGE });
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
        if (req.query.coopPeriodId && (!isDbId(coopPeriodId))) {
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
                    ...studentWhere(await getMajorScope(req)),
                    ...(coopPeriodId ? { coop: { coopPeriodId } } : {}),
                },
            },
            select: SUPERVISION_EXPORT_SELECT,
            orderBy: { confirmedDate: 'asc' },
        });

        const buffer = buildSupervisionScheduleWorkbook(appointments, { baseUrl: exportBaseUrl(req) });
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
// ปฏิทินนิเทศแยกตามหลักสูตร (อาจารย์แยกหลักสูตรอยู่แล้ว):
//   เจ้าหน้าที่ = ทุกหลักสูตร (ตามตัวกรองบนแถบบน)
//   อาจารย์   = หลักสูตรตัวเอง + หลักสูตรที่ดูแล (อาจารย์ประจำวิชา) + นัดที่ตัวเองนิเทศ/ร่วมนิเทศ
//   นักศึกษา  = หลักสูตรตัวเอง + นัดของตัวเอง (ยังไม่มีหลักสูตร = เฉพาะนัดของตัวเอง)
async function calendarScopeWhere(req) {
    const role = String(req.user?.role || '').toLowerCase();
    if (role === 'staff') return { student: studentWhere(await getMajorScope(req)) };
    if (role === 'teacher') {
        const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id }, select: { id: true, major: true } });
        if (!teacher) return { id: -1 };
        // อาจารย์ประจำวิชาเลือกตัวกรองหลักสูตรบนแถบบน (หน้า /admin) → เฉพาะหลักสูตรนั้น ตรงกับรายการนัดหน้าจัดการ
        const base = await getMajorScope(req, { ignoreFilter: true });
        const viewed = await getMajorScope(req);
        if (viewed !== base) return { student: studentWhere(viewed) };
        const coopMajors = base.majors;
        const majors = [...new Set([teacher.major, ...coopMajors].filter(Boolean))];
        const or = [{ teacherId: teacher.id }, { coTeachers: { some: { teacherId: teacher.id } } }];
        if (majors.length) or.push({ student: { major: { in: majors } } });
        return { OR: or };
    }
    if (role === 'student') {
        const student = await prisma.student.findUnique({ where: { userId: req.user.id }, select: { id: true, major: true } });
        if (!student) return { id: -1 };
        return student.major
            ? { OR: [{ studentId: student.id }, { student: { major: student.major } }] }
            : { studentId: student.id };
    }
    return { id: -1 };
}

/**
 * ใครเห็นลิงก์ประชุมออนไลน์ของนัดในปฏิทิน — คนที่เห็นลิงก์นั้นในรายการนัดของตัวเองอยู่แล้วเท่านั้น
 *   เจ้าหน้าที่ = ทุกนัดในขอบเขต · อาจารย์ = นัดของตัวเอง (หลัก/ร่วม) + หลักสูตรที่เป็นอาจารย์ประจำวิชา · นักศึกษา = ไม่ส่ง (ดูในหน้าของตัวเอง)
 * เดิมหน้าเว็บเติมลิงก์จากรายการนัดที่โหลดมา — พอรายการโหลดทีละรอบ นัดรอบอื่นในปฏิทินจะไม่มีลิงก์
 */
async function onlineLinkVisibility(req) {
    const role = String(req.user?.role || '').toLowerCase();
    if (role === 'staff') return () => true;
    if (role !== 'teacher') return () => false;
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id }, select: { id: true } });
    if (!teacher) return () => false;
    const scope = await getMajorScope(req, { ignoreFilter: true });
    return (a) => a.teacherId === teacher.id
        || (a.coTeachers || []).some((c) => c.teacherId === teacher.id)
        || (scope.majors || []).includes(a.student?.major);
}

exports.getSupervisionCalendar = async (req, res) => {
    try {
        const canSeeLink = await onlineLinkVisibility(req);
        const appointments = await prisma.supervisionAppointment.findMany({
            where: {
                AND: [
                    {
                        confirmedDate: { not: null },
                        status: { in: ['DATE_CONFIRMED', 'LETTER_UPLOADED', 'COMPLETED'] },
                        student: { deletedAt: null },
                    },
                    await calendarScopeWhere(req),
                ],
            },
            select: { ...SUPERVISION_SCHEDULE_SELECT, teacherId: true, coTeachers: { select: { teacherId: true } } },
            orderBy: { confirmedDate: 'asc' }
        });
        const byId = new Map(appointments.map((a) => [a.id, a]));

        // ตารางเรียงวัน-เวลา ใช้ได้ทั้งปฏิทินและมุมมองตาราง — เห็นได้ตามหลักสูตร (calendarScopeWhere)
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
            ...(canSeeLink(byId.get(r.id)) ? { onlineLink: byId.get(r.id).onlineLink ?? null } : {}),
        }));

        res.json({ ok: true, events });
    } catch (err) {
        console.error("Get Calendar Error:", err);
        res.status(500).json({ ok: false, message: "ไม่สามารถดึงข้อมูลปฏิทินได้" });
    }
};
