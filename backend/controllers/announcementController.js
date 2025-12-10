const prisma = require('../config/prismaClient');

// GET /api/admin/announcements
exports.getAllAnnouncements = async (req, res) => {
    try {
        const announcements = await prisma.announcement.findMany({
            orderBy: { publishDate: 'desc' }
        });

        res.json({ ok: true, data: announcements });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, message: 'ดึงข้อมูลประกาศไม่สำเร็จ' });
    }
};

// POST /api/admin/announcements
exports.createAnnouncement = async (req, res) => {
    try {
        const { title, body, publishDate } = req.body;

        const newAnnouncement = await prisma.announcement.create({
            data: {
                title,
                body,
                publishDate: publishDate ? new Date(publishDate) : new Date()
            }
        });

        res.status(201).json({
            ok: true,
            message: 'สร้างประกาศสำเร็จ',
            data: newAnnouncement
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({ ok: false, message: 'สร้างประกาศไม่สำเร็จ: กรุณาตรวจสอบข้อมูล' });
    }
};

// PUT /api/admin/announcements/:id
exports.updateAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, body, publishDate } = req.body;

        const updatedAnnouncement = await prisma.announcement.update({
            where: { id: Number(id) },
            data: {
                title,
                body,
                publishDate: publishDate ? new Date(publishDate) : undefined
            }
        });

        res.json({
            ok: true,
            message: 'แก้ไขประกาศสำเร็จ',
            data: updatedAnnouncement
        });
    } catch (error) {
        console.error(error);

        if (error.code === 'P2025') {
            return res.status(404).json({ ok: false, message: 'ไม่พบประกาศที่ต้องการแก้ไข' });
        }

        res.status(400).json({ ok: false, message: 'แก้ไขประกาศไม่สำเร็จ: กรุณาตรวจสอบข้อมูล' });
    }
};

// DELETE /api/admin/announcements/:id
exports.deleteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.announcement.delete({
            where: { id: Number(id) }
        });

        res.json({ ok: true, message: 'ลบประกาศสำเร็จ' });
    } catch (error) {
        console.error(error);

        if (error.code === 'P2025') {
            return res.status(404).json({ ok: false, message: 'ไม่พบประกาศที่ต้องการลบ' });
        }

        res.status(500).json({ ok: false, message: 'ลบประกาศไม่สำเร็จ' });
    }
};
