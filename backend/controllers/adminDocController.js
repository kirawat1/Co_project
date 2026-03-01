const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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
        OR: [
            { coop: { isNot: null } },
            { documents: { some: { type: 'T000_SIGNED' } } }
        ]
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
      placeDocDate
    } = req.body;

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

    //  ไฟล์ (แยกตาม status)
    if (req.file) {
      if (status === 'REQ_LETTER_ISSUED') {
        updateData.reqLetterUrl = req.file.filename;
      }

      if (status === 'PLACEMENT_LETTER_ISSUED') {
        updateData.placeLetterUrl = req.file.filename;
      }
    }

    await prisma.studentCoop.upsert({
      where: { studentId: parseInt(studentId) },
      update: updateData,
      create: {
        studentId: parseInt(studentId),
        ...updateData
      }
    });

    res.json({ ok: true });
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