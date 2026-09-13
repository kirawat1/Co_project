// __tests__/userEmail.test.js — แก้อีเมลบัญชี (นักศึกษา/อาจารย์) แล้ว username ต้องเป็นอีเมลใหม่ด้วย
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
const prisma = require('../config/prismaClient');
const { changeUserEmail } = require('../utils/userEmail');

beforeEach(() => {
  [prisma.user.findUnique, prisma.user.findFirst, prisma.user.update].forEach(m => m.mockReset());
});

describe('changeUserEmail', () => {
  test('เปลี่ยนทั้งอีเมลและ username เป็นอีเมลใหม่ (ตัดช่องว่าง + ตัวพิมพ์เล็ก)', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'old@kkumail.com', username: 'old@kkumail.com' });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.update.mockResolvedValue({});

    const r = await changeUserEmail(prisma, 10, '  New@KKUmail.com ');

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { email: 'new@kkumail.com', username: 'new@kkumail.com' } });
    expect(r).toEqual({ changed: true, email: 'new@kkumail.com', oldEmail: 'old@kkumail.com' });
  });

  test('username เดิมไม่ใช่อีเมล (บัญชีเก่าที่ username เป็นรหัสนักศึกษา) → เปลี่ยนเป็นอีเมลใหม่ด้วย', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'old@kkumail.com', username: '663380001-1' });
    prisma.user.findFirst.mockResolvedValue(null);

    await changeUserEmail(prisma, 10, 'new@kkumail.com');

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { email: 'new@kkumail.com', username: 'new@kkumail.com' } });
  });

  test('อีเมลเดิม (ต่างแค่ตัวพิมพ์/ช่องว่าง) → ไม่แก้อะไร', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'old@kkumail.com', username: 'old@kkumail.com' });
    const r = await changeUserEmail(prisma, 10, ' OLD@kkumail.com');
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(r.changed).toBe(false);
  });

  test('ไม่ส่งอีเมลมา → ไม่แก้อะไร', async () => {
    const r = await changeUserEmail(prisma, 10, '');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(r.changed).toBe(false);
  });

  test('409 — อีเมลใหม่ชนกับอีเมลหรือ username ของบัญชีอื่น', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'old@kkumail.com', username: 'old@kkumail.com' });
    prisma.user.findFirst.mockResolvedValue({ id: 99 });

    await expect(changeUserEmail(prisma, 10, 'taken@kkumail.com')).rejects.toMatchObject({ is409: true });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ email: 'taken@kkumail.com' }, { username: 'taken@kkumail.com' }], NOT: { id: 10 } },
      select: { id: true },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
