// ไฟล์ระบบ (ตราครุฑ / รายละเอียดโครงการ / แบบฟอร์มตอบรับ) — ไม่รับลายเซ็นคณบดีแล้ว (หนังสือโหลดไปลงนามจริง)
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
jest.mock('fs', () => ({ ...jest.requireActual('fs'), existsSync: jest.fn(() => false), unlinkSync: jest.fn() }));
const fs = require('fs');
const prisma = require('./__mocks__/prismaClient');
const { updateAsset, ASSET_KEYS } = require('../controllers/systemAssetController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const file = { filename: 'sig.png', mimetype: 'image/png' };

describe('updateAsset — ชนิดไฟล์ระบบที่รับ', () => {
  beforeEach(() => jest.clearAllMocks());

  test('ชนิดที่ใช้จริงในหนังสือ 3 อย่าง', () => {
    expect(ASSET_KEYS).toEqual(['KRUT', 'PROJECT_DETAILS', 'ACCEPTANCE_FORM']);
  });

  test.each(['SIGNATURE', 'ANYTHING', undefined])('key %s → 400 ไม่บันทึก และลบไฟล์ที่อัปโหลดมาทิ้ง', async (key) => {
    const res = makeRes();
    await updateAsset({ body: { key }, file }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.systemAsset.upsert).not.toHaveBeenCalled();
    expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringMatching(/uploads[\\/]system[\\/]sig\.png$/));
  });

  test('KRUT → บันทึก', async () => {
    prisma.systemAsset.findUnique.mockResolvedValue(null);
    prisma.systemAsset.upsert.mockResolvedValue({ key: 'KRUT' });
    const res = makeRes();
    await updateAsset({ body: { key: 'KRUT' }, file }, res);
    expect(prisma.systemAsset.upsert).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});
