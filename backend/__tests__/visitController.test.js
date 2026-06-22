jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const visitController = require('../controllers/visitController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('visitController', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createVisit', () => {
    test('409 — มีนัดของนักศึกษาคนนี้ในวันเดียวกันกับอาจารย์คนนี้อยู่แล้ว', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 1, studentId: '640001' });
      prisma.teacher.findUnique.mockResolvedValue({ id: 5, userId: 99 });
      prisma.visit.findFirst.mockResolvedValue({ id: 10 }); // มีนัดซ้ำ

      const req = { body: { studentId: '640001', date: '2026-01-01', time: '10:00', location: 'A', note: '' }, user: { id: 99 } };
      const res = makeRes();
      await visitController.createVisit(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(prisma.visit.create).not.toHaveBeenCalled();
    });

    test('200 — ไม่มีนัดซ้ำ สร้างนัดใหม่สำเร็จ', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 1, studentId: '640001' });
      prisma.teacher.findUnique.mockResolvedValue({ id: 5, userId: 99 });
      prisma.visit.findFirst.mockResolvedValue(null);
      prisma.visit.create.mockResolvedValue({ id: 11 });

      const req = { body: { studentId: '640001', date: '2026-01-01', time: '10:00', location: 'A', note: '' }, user: { id: 99 } };
      const res = makeRes();
      await visitController.createVisit(req, res);

      expect(prisma.visit.create).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ id: 11 });
    });
  });

  describe('toggleVisitStatus', () => {
    test('403 — อาจารย์อื่นพยายามแก้นัดที่ไม่ใช่ของตัวเอง', async () => {
      prisma.visit.findUnique.mockResolvedValue({ id: 10, status: 'scheduled', teacherId: 5 });
      prisma.teacher.findUnique.mockResolvedValue({ id: 7, userId: 200 }); // คนละ teacher.id

      const req = { params: { id: '10' }, user: { id: 200 } };
      const res = makeRes();
      await visitController.toggleVisitStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.visit.update).not.toHaveBeenCalled();
    });

    test('200 — เจ้าของนัดแก้สถานะของตัวเองได้', async () => {
      prisma.visit.findUnique.mockResolvedValue({ id: 10, status: 'scheduled', teacherId: 5 });
      prisma.teacher.findUnique.mockResolvedValue({ id: 5, userId: 99 });
      prisma.visit.update.mockResolvedValue({ id: 10, status: 'done' });

      const req = { params: { id: '10' }, user: { id: 99 } };
      const res = makeRes();
      await visitController.toggleVisitStatus(req, res);

      expect(prisma.visit.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { status: 'done' } });
    });
  });

  describe('deleteVisit', () => {
    test('403 — อาจารย์อื่นพยายามลบนัดที่ไม่ใช่ของตัวเอง', async () => {
      prisma.visit.findUnique.mockResolvedValue({ id: 10, teacherId: 5 });
      prisma.teacher.findUnique.mockResolvedValue({ id: 7, userId: 200 });

      const req = { params: { id: '10' }, user: { id: 200 } };
      const res = makeRes();
      await visitController.deleteVisit(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.visit.delete).not.toHaveBeenCalled();
    });

    test('200 — เจ้าของนัดลบของตัวเองได้', async () => {
      prisma.visit.findUnique.mockResolvedValue({ id: 10, teacherId: 5 });
      prisma.teacher.findUnique.mockResolvedValue({ id: 5, userId: 99 });
      prisma.visit.delete.mockResolvedValue({});

      const req = { params: { id: '10' }, user: { id: 99 } };
      const res = makeRes();
      await visitController.deleteVisit(req, res);

      expect(prisma.visit.delete).toHaveBeenCalledWith({ where: { id: 10 } });
    });
  });
});
