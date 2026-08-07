const prisma = require('../config/prismaClient');
const { createNotifications } = require('../utils/notificationHelper');
const path = require('path');
const fs = require('fs');

// 1. ดึงค่า Config
exports.getT000Config = async (req, res) => {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "T000_CONFIG" }
    });
    const data = config ? JSON.parse(config.value) : { startDate: "", endDate: "", isOpen: false };
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Error fetching config" });
  }
};

// 2. บันทึกค่า Config
exports.saveT000Config = async (req, res) => {
  try {
    const { startDate, endDate, isOpen } = req.body;
    const value = JSON.stringify({ startDate, endDate, isOpen });

    await prisma.systemConfig.upsert({
      where: { key: "T000_CONFIG" },
      update: { value },
      create: { key: "T000_CONFIG", value }
    });

    res.json({ ok: true, message: "บันทึกการตั้งค่าเรียบร้อย" });
  } catch (err) {
    res.status(500).json({ message: "Error saving config" });
  }
};

// 3. ดึงรายชื่อนักศึกษา (T000 + เอกสารอื่นๆ)
exports.getStudentsForT000 = async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      where: {
        AND: [
          { OR: [
              { coop: { isNot: null } },
              { documents: { some: { type: 'T000_SIGNED' } } }
          ] },
          { deletedAt: null },
        ],
      },
      include: {
        documents: {
            orderBy: { uploadedAt: 'desc' }
        },
        coop: {
            include: { company: true }
        },
        coopApplicationForm: true,
        generalAdvisor: { select: { id: true, prefix: true, firstName: true, lastName: true } },
      },
      orderBy: { studentId: 'asc' }
    });

    // Map ข้อมูลส่งกลับ
    const data = students.map(s => ({
      id: s.id,
      studentId: s.studentId,
      firstName: s.firstName,
      lastName: s.lastName,
      major: s.major,
      gpa: s.gpa,
      company: s.coop?.company,
      
      docStatus: s.coop?.status || 'WAITING',
      teacherComment: s.coop?.t000Comment,
      documents: s.documents,
      submittedAt: s.documents[0]?.uploadedAt || null,

      studyProgram: s.studyProgram || null,
      coopApplicationForm: s.coopApplicationForm,
      coop: s.coop,
      advisorName: s.advisorName || null,
      generalAdvisor: s.generalAdvisor || null,
    }));

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching students" });
  }
};

// 4. อัปเดตสถานะไฟล์รายตัว
exports.updateDocStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const ALLOWED_DOC_STATUS = new Set(['PENDING', 'APPROVED', 'REJECTED', 'EDITS_REQUIRED', 'WAITING']);
    if (!status || !ALLOWED_DOC_STATUS.has(status)) {
      return res.status(400).json({ ok: false, message: 'status ไม่ถูกต้อง' });
    }
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
      return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
    }

    await prisma.document.update({
      where: { id: parsedId },
      data: { status: status }
    });

    res.json({ ok: true, message: "Updated document status" });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ ok: false, message: 'ไม่พบเอกสาร' });
    console.error(err);
    res.status(500).json({ ok: false, message: "Error updating document" });
  }
};
// 5. อัปเดตสถานะนักศึกษา + บันทึกข้อมูลหนังสือส่งตัว
exports.reviewStudentStatus = async (req, res) => {
  try {
    const { 
      studentId,
      status,
      comment,
      reqDocNumber,
      reqDocDate,
      actualStartDate,
      actualEndDate,
      placeDocNumber,
      placeDocDate,
      docType // ✅ 1. เพิ่มการรับค่า docType จาก Frontend
    } = req.body;

    const parsedStudentId = parseInt(studentId, 10);
    if (isNaN(parsedStudentId) || parsedStudentId <= 0) {
      if (req.file) try { fs.unlinkSync(path.join(__dirname, '../uploads', req.file.filename)); } catch (_) {}
      return res.status(400).json({ ok: false, message: 'studentId ต้องเป็นตัวเลขที่ถูกต้อง' });
    }

    const REVIEW_STATUS_ALLOWED = new Set([
      'QUALIFIED', 'QUALIFICATION_FAILED', 'APPLICATION_EDITS_REQUIRED',
      'WAITING_FOR_STAFF_CHECK', 'EDITS_REQUIRED', 'DOCS_APPROVED',
      'REQ_LETTER_ISSUED', 'WAITING_FOR_PLACEMENT_LETTER',
      'WAITING_FOR_STAFF_CHECK_LETTER', 'ACCEPTANCE_CHECKED',
      'PLACEMENT_LETTER_ISSUED', 'INTERNSHIP_STARTED',
    ]);
    if (!status || !REVIEW_STATUS_ALLOWED.has(status)) {
      if (req.file) try { fs.unlinkSync(path.join(__dirname, '../uploads', req.file.filename)); } catch (_) {}
      return res.status(400).json({ ok: false, message: 'status ไม่ถูกต้อง' });
    }

    const updateData = {
      status,
      t000Comment: comment
    };

    // หนังสือขอความอนุเคราะห์
    if (reqDocNumber) updateData.reqDocNumber = reqDocNumber;
    if (reqDocDate) updateData.reqDocDate = new Date(reqDocDate);

    // หนังสือส่งตัว
    if (placeDocNumber) updateData.placeDocNumber = placeDocNumber;
    if (placeDocDate) updateData.placeDocDate = new Date(placeDocDate);

    // วันที่ฝึกจริง
    if (actualStartDate) updateData.actualStartDate = new Date(actualStartDate);
    if (actualEndDate) updateData.actualEndDate = new Date(actualEndDate);

    // ไฟล์ (แยกตาม status)
    if (req.file) {
      if (status === 'REQ_LETTER_ISSUED') {
        updateData.reqLetterUrl = req.file.filename;
      }

      if (status === 'PLACEMENT_LETTER_ISSUED') {
        updateData.placeLetterUrl = req.file.filename;
      }

      // ถ้าไฟล์ถูกอัปโหลดมาแต่ไม่ได้ใช้ (status ไม่ใช่ letter และไม่มี docType) → ลบไฟล์ทิ้งแล้วคืน error
      if (!updateData.reqLetterUrl && !updateData.placeLetterUrl && !req.body.docType) {
        const fp = path.join(__dirname, '../uploads', req.file.filename);
        try { fs.unlinkSync(fp); } catch (_) {}
        return res.status(400).json({ ok: false, message: 'docType ต้องระบุเมื่ออัปโหลดไฟล์' });
      }
    }

    let staleLetterFile = null;

    await prisma.$transaction(async (tx) => {
      const studentCheck = await tx.student.findUnique({ where: { id: parsedStudentId }, select: { deletedAt: true } });
      // ดึง letter URL เก่าภายใน transaction เพื่อหลีกเลี่ยง TOCTOU race
      if (updateData.reqLetterUrl || updateData.placeLetterUrl) {
        const prevCoop = await tx.studentCoop.findUnique({
          where: { studentId: parsedStudentId },
          select: { reqLetterUrl: true, placeLetterUrl: true }
        });
        if (prevCoop) {
          const oldUrl = updateData.reqLetterUrl ? prevCoop.reqLetterUrl : prevCoop.placeLetterUrl;
          if (oldUrl && oldUrl !== req.file.filename) staleLetterFile = oldUrl;
        }
      }
      if (!studentCheck || studentCheck.deletedAt) {
        throw Object.assign(new Error('ไม่พบนักศึกษา'), { is404: true });
      }
      if (req.file && docType) {
        const existingDoc = await tx.document.findFirst({
          where: { studentId: parsedStudentId, type: docType }
        });
        if (existingDoc) {
          await tx.document.update({
            where: { id: existingDoc.id },
            data: { path: req.file.filename, name: req.file.originalname, status: 'APPROVED' }
          });
        } else {
          await tx.document.create({
            data: {
              studentId: parsedStudentId, type: docType,
              path: req.file.filename, name: req.file.originalname, status: 'APPROVED'
            }
          });
        }
      }
      await tx.studentCoop.upsert({
        where: { studentId: parsedStudentId },
        update: updateData,
        create: { studentId: parsedStudentId, ...updateData }
      });
    });

    res.json({ ok: true });

    // ลบ letter file เก่าออกจาก disk หลัง commit สำเร็จ
    if (staleLetterFile) {
      const fp = path.join(__dirname, '../uploads', staleLetterFile);
      try { fs.unlinkSync(fp); } catch (_) {}
    }

    // Notify student when their status changes
    const statusMessages = {
      QUALIFIED: 'คำร้องของคุณผ่านการพิจารณา ✅',
      QUALIFICATION_FAILED: 'คำร้องของคุณไม่ผ่านการพิจารณา',
      DOCS_APPROVED: 'เอกสาร T000 ผ่านการตรวจสอบ ✅',
      EDITS_REQUIRED: 'เอกสาร T000 ต้องแก้ไข กรุณาตรวจสอบความคิดเห็น',
      REQ_LETTER_ISSUED: 'ออกหนังสือขอความอนุเคราะห์แล้ว',
      ACCEPTANCE_CHECKED: 'ตรวจสอบใบตอบรับแล้ว',
      PLACEMENT_LETTER_ISSUED: 'ออกหนังสือส่งตัวแล้ว 🎉',
      APPLICATION_EDITS_REQUIRED: 'คำร้องของคุณต้องแก้ไข กรุณาตรวจสอบ',
    };
    const msg = statusMessages[status];
    if (msg) {
      prisma.student.findUnique({ where: { id: parsedStudentId }, select: { userId: true } })
        .then(student => {
          if (student?.userId) {
            return createNotifications([student.userId], {
              type: 'STATUS_UPDATED',
              title: 'สถานะสหกิจศึกษาอัปเดต',
              message: msg,
              link: '/student/dashboard',
              relatedId: String(parsedStudentId),
            });
          }
        })
        .catch(console.error);
    }
  } catch (err) {
    if (req.file) {
      const fp = path.join(__dirname, '../uploads', req.file.filename);
      if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (_) {}
    }
    if (err.is404) return res.status(404).json({ ok: false, message: err.message });
    if (err.is400) return res.status(400).json({ ok: false, message: err.message });
    console.error(err);
    res.status(500).json({ ok: false, message: "Error" });
  }
};

// 6. อนุมัติทั้งหมด
exports.approveAllDocs = async (req, res) => {
  try {
    const { studentId } = req.body;
    const parsedId = parseInt(studentId, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
      return res.status(400).json({ ok: false, message: 'studentId ต้องเป็นตัวเลขที่ถูกต้อง' });
    }

    await prisma.$transaction(async (tx) => {
      const studentCheck = await tx.student.findUnique({ where: { id: parsedId }, select: { deletedAt: true } });
      if (!studentCheck || studentCheck.deletedAt) {
        throw Object.assign(new Error('ไม่พบนักศึกษา'), { is404: true });
      }
      const coop = await tx.studentCoop.findUnique({ where: { studentId: parsedId }, select: { status: true } });
      const APPROVABLE = new Set(['APPLYING', 'WAITING_FOR_STAFF_CHECK', 'EDITS_REQUIRED', 'APPLICATION_EDITS_REQUIRED', 'QUALIFIED', 'QUALIFICATION_FAILED', 'DOCS_APPROVED']);
      if (coop && !APPROVABLE.has(coop.status)) {
        throw Object.assign(new Error('ไม่สามารถอนุมัติได้ในสถานะปัจจุบัน'), { is400: true });
      }
      await tx.document.updateMany({
        where: { studentId: parsedId },
        data: { status: 'APPROVED' }
      });
      await tx.studentCoop.upsert({
        where: { studentId: parsedId },
        update: { status: 'DOCS_APPROVED', t000Comment: 'เอกสารครบถ้วน (รอออกหนังสือ)' },
        create: {
          studentId: parseInt(studentId),
          status: 'DOCS_APPROVED',
          t000Comment: 'เอกสารครบถ้วน (รอออกหนังสือ)'
        }
      });
    });

    res.json({ ok: true, message: "Approve all success" });
  } catch (err) {
    if (err.is404) return res.status(404).json({ ok: false, message: err.message });
    if (err.is400) return res.status(400).json({ ok: false, message: err.message });
    console.error(err);
    res.status(500).json({ ok: false, message: "Error approving all" });
  }
};

exports.getCoopApplications = async (req, res) => {
  try {
    const applications = await prisma.studentCoop.findMany({
      where: {
        status: { notIn: ["NOT_SUBMITTED"] },
        student: { deletedAt: null },
      },
      include: {
        student: {
          include: {
            documents: true,
            coopApplicationForm: { select: { gradeSheetUrl: true } },
          }
        },
        company: true,
        mentor: true,
      },
      orderBy: { updatedAt: "desc" }
    });
    res.json({ ok: true, applications });
  } catch (error) {
    console.error("Get Coop Apps Error:", error);
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

// 2. อัปเดตสถานะคำร้อง (อนุมัติ / ตีกลับให้แก้ไข)
exports.updateCoopApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;

    const parsedId = Number(id);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return res.status(400).json({ ok: false, message: 'id ไม่ถูกต้อง' });
    }

    const APP_STATUS_ALLOWED = new Set([
      'WAITING_FOR_STAFF_CHECK', 'EDITS_REQUIRED', 'QUALIFIED',
      'QUALIFICATION_FAILED', 'APPLICATION_EDITS_REQUIRED',
    ]);
    if (!status || !APP_STATUS_ALLOWED.has(status)) {
      return res.status(400).json({ ok: false, message: 'status ไม่ถูกต้อง' });
    }

    let updated;
    await prisma.$transaction(async (tx) => {
      const record = await tx.studentCoop.findUnique({
        where: { id: parsedId },
        select: { status: true, student: { select: { deletedAt: true, id: true, generalAdvisorId: true, coopAdvisorId: true } } }
      });
      if (!record || record.student.deletedAt) {
        throw Object.assign(new Error('ไม่พบข้อมูลคำร้อง'), { is404: true });
      }

      // Teacher callers must be an advisor of this student
      if (req.user.role === 'teacher') {
        const teacher = await tx.teacher.findUnique({ where: { userId: req.user.id }, select: { id: true } });
        if (!teacher ||
          (record.student.generalAdvisorId !== teacher.id && record.student.coopAdvisorId !== teacher.id)) {
          throw Object.assign(new Error('คุณไม่ใช่อาจารย์ที่ปรึกษาของนักศึกษาคนนี้'), { is403: true });
        }
      }

      const REVIEWABLE = new Set([
        'APPLYING', 'WAITING_FOR_STAFF_CHECK', 'APPLICATION_EDITS_REQUIRED',
        'EDITS_REQUIRED', 'QUALIFIED', 'QUALIFICATION_FAILED',
      ]);
      if (!REVIEWABLE.has(record.status)) {
        throw Object.assign(new Error('ไม่สามารถเปลี่ยนสถานะได้ในขั้นตอนนี้'), { is400: true });
      }
      updated = await tx.studentCoop.update({
        where: { id: parsedId },
        data: { status, staffCheckComment: comment || null }
      });
    });

    res.json({ ok: true, application: updated });

    const notifMsgs = {
      WAITING_FOR_STAFF_CHECK: 'คำร้องของคุณกำลังรอการตรวจสอบจากเจ้าหน้าที่',
      EDITS_REQUIRED: 'คำร้องของคุณต้องแก้ไข กรุณาตรวจสอบ',
      QUALIFIED: 'คำร้องของคุณผ่านการพิจารณา ✅',
      QUALIFICATION_FAILED: 'คำร้องของคุณไม่ผ่านการพิจารณา',
      APPLICATION_EDITS_REQUIRED: 'คำร้องของคุณต้องแก้ไข กรุณาตรวจสอบ',
    };
    const notifMsg = notifMsgs[status];
    if (notifMsg && updated?.studentId) {
      prisma.student.findUnique({ where: { id: updated.studentId }, select: { userId: true } })
        .then(s => {
          if (s?.userId) {
            return createNotifications([s.userId], {
              type: 'STATUS_UPDATED',
              title: 'สถานะสหกิจศึกษาอัปเดต',
              message: notifMsg,
              link: '/student/dashboard',
              relatedId: String(updated.studentId),
            });
          }
        })
        .catch(console.error);
    }
  } catch (error) {
    if (error.is403) return res.status(403).json({ ok: false, message: error.message });
    if (error.is404) return res.status(404).json({ ok: false, message: error.message });
    if (error.is400) return res.status(400).json({ ok: false, message: error.message });
    console.error("Update Status Error:", error);
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.getAllStudentsForReview = async (req, res) => {
    try {
        const coopPeriodId = req.query.coopPeriodId
            ? parseInt(req.query.coopPeriodId, 10)
            : undefined;
        if (coopPeriodId !== undefined && isNaN(coopPeriodId))
            return res.status(400).json({ ok: false, message: 'coopPeriodId ไม่ถูกต้อง' });
        const search = (req.query.search || "").trim();
        const status = (req.query.status || "").trim();

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        // ไม่ระบุ limit มา = ขอข้อมูลทั้งหมด (หลาย caller เดิมพึ่งพา behavior นี้ไปกรองฝั่ง client เอง)
        // จำกัดเพดานไว้กันโควต query มหาศาลเกินจำเป็น ไม่ใช่ default แบบหน้าเดียว 500 ที่ตัดข้อมูลทิ้งเงียบๆ
        const limit = req.query.limit
            ? Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 500))
            : 1000;
        const skip = (page - 1) * limit;

        const conditions = [{ deletedAt: null }];
        if (coopPeriodId) conditions.push({ coop: { coopPeriodId } });
        if (status) conditions.push({ coop: { status } });
        if (search) {
            conditions.push({
                OR: [
                    { studentId: { contains: search } },
                    { firstName: { contains: search } },
                    { lastName: { contains: search } },
                ],
            });
        }
        const where = { AND: conditions };

        const [students, total] = await Promise.all([
            prisma.student.findMany({
                where,
                skip,
                take: limit,
                include: {
                    coop: {
                        include: {
                            company: true
                        }
                    },
                    documents: true,
                    generalAdvisor: { select: { id: true, firstName: true, lastName: true } },
                    coopAdvisor: { select: { id: true, firstName: true, lastName: true } }
                }
            }),
            prisma.student.count({ where }),
        ]);

        res.json({ ok: true, data: students, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
    } catch (err) {
        console.error("Get All Students Error:", err);
        res.status(500).json({ ok: false, message: "ไม่สามารถดึงข้อมูลนักศึกษาได้" });
    }
};

exports.reviewT002 = async (req, res) => {
    try {
        const { studentId, status, comment } = req.body;

        // ดักจับกรณีไม่มี studentId
        if (!studentId) {
            return res.status(400).json({ ok: false, message: "ไม่พบข้อมูล Student ID" });
        }
        const parsedStudentId = parseInt(studentId, 10);
        if (isNaN(parsedStudentId) || parsedStudentId <= 0) {
            return res.status(400).json({ ok: false, message: 'studentId ต้องเป็นตัวเลขที่ถูกต้อง' });
        }

        const T002_ALLOWED = ['T002_SUBMITTED', 'T002_EDITS_REQUIRED'];
        if (!T002_ALLOWED.includes(status)) {
            return res.status(400).json({ ok: false, message: 'status ไม่ถูกต้อง' });
        }

        await prisma.$transaction(async (tx) => {
            const student = await tx.student.findUnique({ where: { id: parsedStudentId }, select: { deletedAt: true } });
            if (!student || student.deletedAt) {
                throw Object.assign(new Error('ไม่พบนักศึกษา'), { is404: true });
            }
            const coop = await tx.studentCoop.findUnique({ where: { studentId: parsedStudentId }, select: { status: true } });
            if (!coop || coop.status !== 'T002_SUBMITTED') {
                throw Object.assign(new Error('สามารถตรวจสอบ T002 ได้เฉพาะเมื่อสถานะเป็น T002_SUBMITTED เท่านั้น'), { is400: true });
            }
            await tx.studentCoop.update({
                where: { studentId: parsedStudentId },
                data: { status: status }
            });
            const doc = await tx.document.findFirst({
                where: { studentId: parsedStudentId, type: 'T002_FORM' },
                orderBy: { id: 'desc' }
            });
            if (doc) {
                await tx.document.update({
                    where: { id: doc.id },
                    data: {
                        status: status === 'T002_EDITS_REQUIRED' ? 'REJECTED' : 'APPROVED',
                        rejectReason: comment || null
                    }
                });
            }
        });

        res.json({ ok: true, message: "บันทึกผลการตรวจสอบสำเร็จ" });

        // Notify student
        prisma.student.findUnique({ where: { id: parsedStudentId }, select: { userId: true } })
          .then(student => {
            if (student?.userId) {
              return createNotifications([student.userId], {
                type: 'T002_REVIEWED',
                title: 'T002 ได้รับการตรวจสอบ',
                message: 'เอกสาร T002 ของคุณได้รับการตรวจสอบแล้ว กรุณาตรวจสอบสถานะ',
                link: '/student/docs-t002',
                relatedId: null,
              });
            }
          })
          .catch(console.error);
    } catch (err) {
        if (err.is404) return res.status(404).json({ ok: false, message: err.message });
        if (err.is400) return res.status(400).json({ ok: false, message: err.message });
        console.error("====== REVIEW T002 ERROR ======");
        console.error(err);
        console.error("===============================");
        res.status(500).json({ ok: false, message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
    }
};

exports.reviewT003 = async (req, res) => {
    try {
        const { studentId, status, comment } = req.body;
        if (!studentId) return res.status(400).json({ ok: false, message: "ไม่พบ studentId" });
        const parsedStudentId = parseInt(studentId, 10);
        if (isNaN(parsedStudentId) || parsedStudentId <= 0) {
            return res.status(400).json({ ok: false, message: 'studentId ต้องเป็นตัวเลขที่ถูกต้อง' });
        }

        const T003_ALLOWED = ['T003_APPROVED', 'T003_EDITS_REQUIRED'];
        if (!T003_ALLOWED.includes(status)) {
            return res.status(400).json({ ok: false, message: 'status ไม่ถูกต้อง' });
        }

        await prisma.$transaction(async (tx) => {
            const student = await tx.student.findUnique({ where: { id: parsedStudentId }, select: { deletedAt: true } });
            if (!student || student.deletedAt) {
                throw Object.assign(new Error('ไม่พบนักศึกษา'), { is404: true });
            }
            const coop = await tx.studentCoop.findUnique({ where: { studentId: parsedStudentId }, select: { status: true } });
            if (!coop || coop.status !== 'T003_SUBMITTED') {
                throw Object.assign(new Error('สามารถตรวจสอบ T003 ได้เฉพาะเมื่อสถานะเป็น T003_SUBMITTED เท่านั้น'), { is400: true });
            }
            await tx.studentCoop.update({
                where: { studentId: parsedStudentId },
                data: { status: status }
            });
            const doc = await tx.document.findFirst({
                where: { studentId: parsedStudentId, type: 'T003_FORM' },
                orderBy: { id: 'desc' }
            });
            if (doc) {
                await tx.document.update({
                    where: { id: doc.id },
                    data: {
                        status: status === 'T003_EDITS_REQUIRED' ? 'REJECTED' : 'APPROVED',
                        rejectReason: comment || null
                    }
                });
            }
        });

        res.json({ ok: true, message: "Review T003 saved successfully" });

        // Notify student
        prisma.student.findUnique({ where: { id: parsedStudentId }, select: { userId: true } })
          .then(student => {
            if (student?.userId) {
              return createNotifications([student.userId], {
                type: 'T003_REVIEWED',
                title: 'T003 ได้รับการตรวจสอบ',
                message: 'เอกสาร T003 ของคุณได้รับการตรวจสอบแล้ว กรุณาตรวจสอบสถานะ',
                link: '/student/docs-t003',
                relatedId: null,
              });
            }
          })
          .catch(console.error);
    } catch (err) {
        if (err.is404) return res.status(404).json({ ok: false, message: err.message });
        if (err.is400) return res.status(400).json({ ok: false, message: err.message });
        console.error("Review T003 Error:", err);
        res.status(500).json({ ok: false, message: "Server error" });
    }
};