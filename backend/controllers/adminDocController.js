const prisma = require('../config/prismaClient');
const { createNotifications } = require('../utils/notificationHelper');

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
        // ✅ เพิ่มบรรทัดนี้: ดึงใบสมัครมาด้วย (เพื่อเอาวันที่เริ่ม-จบ)
        coopApplicationForm: true 
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

      // ✅ ส่ง coopApplicationForm ไปให้ Frontend ใช้
      coopApplicationForm: s.coopApplicationForm,
      // ส่ง coop object ทั้งก้อนไปด้วย (มี actualStartDate)
      coop: s.coop 
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

    await prisma.document.update({
      where: { id: parseInt(id) },
      data: { status: status }
    });

    res.json({ ok: true, message: "Updated document status" });
  } catch (err) {
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

    const parsedStudentId = parseInt(studentId);

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

      // ✅ 2. เพิ่มส่วนนี้: บันทึกไฟล์ลงตาราง Document เพื่อให้ Frontend ดึงไปโชว์ได้
      if (docType) {
        const existingDoc = await prisma.document.findFirst({
          where: { 
            studentId: parsedStudentId, 
            type: docType 
          }
        });

        if (existingDoc) {
          // ถ้าเคยมีไฟล์ประเภทนี้แล้ว ให้อัปเดตทับเลย
          await prisma.document.update({
            where: { id: existingDoc.id },
            data: {
              path: req.file.filename,
              name: req.file.originalname,
              status: 'APPROVED'
            }
          });
        } else {
          // ถ้ายังไม่เคยมี ให้สร้าง Document ใหม่
          await prisma.document.create({
            data: {
              studentId: parsedStudentId,
              type: docType,
              path: req.file.filename,
              name: req.file.originalname,
              status: 'APPROVED'
            }
          });
        }
      }
    }

    await prisma.studentCoop.upsert({
      where: { studentId: parsedStudentId },
      update: updateData,
      create: {
        studentId: parsedStudentId,
        ...updateData
      }
    });

    res.json({ ok: true });

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
              link: '/student/status-tracker',
              relatedId: String(parsedStudentId),
            });
          }
        })
        .catch(console.error);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Error" });
  }
};

// 6. อนุมัติทั้งหมด
exports.approveAllDocs = async (req, res) => {
  try {
    const { studentId } = req.body;

    await prisma.document.updateMany({
      where: { studentId: parseInt(studentId) },
      data: { status: 'APPROVED' }
    });

    await prisma.studentCoop.upsert({
      where: { studentId: parseInt(studentId) },
      update: { 
        status: 'DOCS_APPROVED', 
        t000Comment: 'เอกสารครบถ้วน (รอออกหนังสือ)'
      },
      create: {
        studentId: parseInt(studentId),
        status: 'DOCS_APPROVED',
        t000Comment: 'เอกสารครบถ้วน (รอออกหนังสือ)'
      }
    });

    res.json({ ok: true, message: "Approve all success" });
  } catch (err) {
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
    
    const updated = await prisma.studentCoop.update({
      where: { id: Number(id) },
      data: {
        status: status,
        staffCheckComment: comment || null, // บันทึกเหตุผลกรณีตีกลับ
      }
    });
    res.json({ ok: true, application: updated });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.getAllStudentsForReview = async (req, res) => {
    try {
        const coopPeriodId = req.query.coopPeriodId
            ? parseInt(req.query.coopPeriodId, 10)
            : undefined;
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

        // 1. อัปเดตสถานะหลักของนักศึกษา
        await prisma.studentCoop.upsert({
            where: { studentId: parseInt(studentId) },
            update: { status: status },
            create: { studentId: parseInt(studentId), status: status }
        });

        // 2. หาไฟล์ T002 ล่าสุด แล้วอัปเดตผลตรวจ + ใส่เหตุผล
        // ✅ เปลี่ยนจาก createdAt เป็น id เพื่อป้องกัน Error กรณี Database ไม่มีฟิลด์ Date
        const doc = await prisma.document.findFirst({
            where: { studentId: parseInt(studentId), type: 'T002_FORM' },
            orderBy: { id: 'desc' } 
        });

        if (doc) {
            await prisma.document.update({
                where: { id: doc.id },
                data: {
                    // ✅ ระวัง: หากตาราง Document มีการล็อก Enum status ไว้ ต้องให้แน่ใจว่ามีคำว่า 'APPROVED' และ 'REJECTED' ด้วย
                    status: status === 'T002_EDITS_REQUIRED' ? 'REJECTED' : 'APPROVED',
                    rejectReason: comment || null 
                }
            });
        }

        res.json({ ok: true, message: "บันทึกผลการตรวจสอบสำเร็จ" });

        // Notify student
        prisma.student.findUnique({ where: { id: parseInt(studentId) }, select: { userId: true } })
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
        // ✅ พิมพ์ Error ตัวจริงออกมาที่หน้าจอดำ (Terminal) ของ Backend
        console.error("====== REVIEW T002 ERROR ======");
        console.error(err);
        console.error("===============================");
        
        res.status(500).json({ 
            ok: false, 
            message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์", 
            error: err.message // ส่งข้อความ Error กลับไปบอก Frontend ด้วย
        });
    }
};

exports.reviewT003 = async (req, res) => {
    try {
        const { studentId, status, comment } = req.body;
        if (!studentId) return res.status(400).json({ ok: false, message: "ไม่พบ studentId" });

        // 1. อัปเดตสถานะของนักศึกษา
        await prisma.studentCoop.upsert({
            where: { studentId: parseInt(studentId) },
            update: { status: status },
            create: { studentId: parseInt(studentId), status: status }
        });

        // 2. อัปเดตสถานะไฟล์
        const doc = await prisma.document.findFirst({
            where: { studentId: parseInt(studentId), type: 'T003_FORM' },
            orderBy: { id: 'desc' } 
        });

        if (doc) {
            await prisma.document.update({
                where: { id: doc.id },
                data: {
                    status: status === 'T003_EDITS_REQUIRED' ? 'REJECTED' : 'APPROVED',
                    rejectReason: comment || null 
                }
            });
        }

        res.json({ ok: true, message: "Review T003 saved successfully" });

        // Notify student
        prisma.student.findUnique({ where: { id: parseInt(studentId) }, select: { userId: true } })
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
        console.error("Review T003 Error:", err);
        res.status(500).json({ ok: false, message: "Server error" });
    }
};