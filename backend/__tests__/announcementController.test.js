// backend/__tests__/announcementController.test.js

jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

// Mock fs to prevent actual file I/O
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

// Mock multer so 'upload' export doesn't fail
jest.mock('multer', () => {
  const m = () => ({ array: () => jest.fn() });
  m.diskStorage = jest.fn(() => ({}));
  return m;
});

const prisma = require('./__mocks__/prismaClient');
const fs = require('fs');
const { getAnnouncements, addOrUpdateAnnouncement, deleteAnnouncement } = require('../controllers/announcementController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// getAnnouncements
// ---------------------------------------------------------------------------
describe('getAnnouncements', () => {
  test('200 – returns mapped list without year filter', async () => {
    const fakeList = [
      {
        id: 'uuid-1',
        title: 'Test Announcement',
        body: 'Body text',
        date: new Date('2025-01-01'),
        year: '2568',
        linkUrl: null,
        files: [
          { id: 'file-1', name: 'photo.png', mime: 'image/png', path: 'photo.png' },
          { id: 'file-2', name: 'doc.pdf', mime: 'application/pdf', path: 'doc.pdf' },
        ],
      },
    ];
    prisma.announcement.findMany.mockResolvedValue(fakeList);

    const req = { query: {} };
    const res = makeRes();

    await getAnnouncements(req, res);

    expect(prisma.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { date: 'desc' },
        include: { files: true },
      })
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true })
    );

    const { list } = res.json.mock.calls[0][0];
    expect(list).toHaveLength(1);
    expect(list[0].attachments).toHaveLength(2);
    expect(list[0].attachments[0].type).toBe('image');
    expect(list[0].attachments[1].type).toBe('file');
  });

  test('200 – passes year filter when req.query.year is set', async () => {
    prisma.announcement.findMany.mockResolvedValue([]);

    const req = { query: { year: '2568' } };
    const res = makeRes();

    await getAnnouncements(req, res);

    expect(prisma.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { year: '2568' } })
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, list: [] });
  });

  test('200 – linkUrl is included as a "link" attachment', async () => {
    const fakeList = [
      {
        id: 'uuid-2',
        title: 'With Link',
        body: '',
        date: new Date(),
        year: '2568',
        linkUrl: 'https://example.com',
        files: [],
      },
    ];
    prisma.announcement.findMany.mockResolvedValue(fakeList);

    const req = { query: {} };
    const res = makeRes();

    await getAnnouncements(req, res);

    const { list } = res.json.mock.calls[0][0];
    expect(list[0].attachments).toHaveLength(1);
    expect(list[0].attachments[0].type).toBe('link');
    expect(list[0].attachments[0].url).toBe('https://example.com');
  });

  test('500 – DB error', async () => {
    prisma.announcement.findMany.mockRejectedValue(new Error('DB fail'));

    const req = { query: {} };
    const res = makeRes();

    await getAnnouncements(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'เกิดข้อผิดพลาด' });
  });

  test('200 – major filter returns all-major + matching announcements only', async () => {
    const fakeList = [
      { id: '1', title: 'All', body: '', date: new Date(), year: '1/2569', linkUrl: null, targetMajors: [], files: [] },
      { id: '2', title: 'CS only', body: '', date: new Date(), year: '1/2569', linkUrl: null, targetMajors: ['CS'], files: [] },
      { id: '3', title: 'IT only', body: '', date: new Date(), year: '1/2569', linkUrl: null, targetMajors: ['IT'], files: [] },
    ];
    prisma.announcement.findMany.mockResolvedValue(fakeList);

    const req = { query: { major: 'CS' } };
    const res = makeRes();

    await getAnnouncements(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
    expect(body.list).toHaveLength(2);
    expect(body.list.map(a => a.id)).toEqual(expect.arrayContaining(['1', '2']));
    expect(body.list.map(a => a.id)).not.toContain('3');
  });

  test('200 – no major param returns all announcements unfiltered', async () => {
    const fakeList = [
      { id: '1', title: 'All', body: '', date: new Date(), year: '1/2569', linkUrl: null, targetMajors: [], files: [] },
      { id: '2', title: 'CS only', body: '', date: new Date(), year: '1/2569', linkUrl: null, targetMajors: ['CS'], files: [] },
    ];
    prisma.announcement.findMany.mockResolvedValue(fakeList);

    const req = { query: {} };
    const res = makeRes();

    await getAnnouncements(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.list).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// addOrUpdateAnnouncement
// ---------------------------------------------------------------------------
describe('addOrUpdateAnnouncement', () => {
  // ---- validation ----
  test('400 – missing title', async () => {
    const req = { body: { date: '2025-01-01', year: '2568' }, files: [] };
    const res = makeRes();

    await addOrUpdateAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'ข้อมูลไม่ครบ' });
  });

  test('400 – missing date', async () => {
    const req = { body: { title: 'T', year: '2568' }, files: [] };
    const res = makeRes();

    await addOrUpdateAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400 – missing year', async () => {
    const req = { body: { title: 'T', date: '2025-01-01' }, files: [] };
    const res = makeRes();

    await addOrUpdateAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ---- CREATE path ----
  test('200 – creates new announcement when no id', async () => {
    const created = {
      id: 'new-uuid',
      title: 'New Ann',
      body: 'Body',
      date: new Date('2025-06-01'),
      year: '2568',
      linkUrl: null,
      files: [],
    };
    prisma.announcement.create.mockResolvedValue(created);

    const req = {
      body: { title: 'New Ann', body: 'Body', date: '2025-06-01', year: '2568' },
      files: [],
    };
    const res = makeRes();

    await addOrUpdateAnnouncement(req, res);

    expect(prisma.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'New Ann', year: '2568' }),
        include: { files: true },
      })
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, announcement: created });
  });

  test('200 – creates with uploaded files', async () => {
    const created = { id: 'uuid-f', title: 'T', files: [] };
    prisma.announcement.create.mockResolvedValue(created);

    const req = {
      body: { title: 'T', date: '2025-06-01', year: '2568' },
      files: [
        { originalname: 'image.png', mimetype: 'image/png', filename: 'stored-image.png' },
      ],
    };
    const res = makeRes();

    await addOrUpdateAnnouncement(req, res);

    const callArg = prisma.announcement.create.mock.calls[0][0];
    expect(callArg.data.files.create).toHaveLength(1);
    expect(callArg.data.files.create[0].mime).toBe('image/png');
  });

  // ---- UPDATE path ----
  test('404 – announcement not found on update', async () => {
    prisma.announcement.findUnique.mockResolvedValue(null);

    const req = {
      body: { id: 'missing-uuid', title: 'T', date: '2025-01-01', year: '2568' },
      files: [],
    };
    const res = makeRes();

    await addOrUpdateAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'ไม่พบประกาศ' });
  });

  test('200 – updates existing announcement, deletes unreferenced files', async () => {
    const existing = {
      id: 'exist-uuid',
      files: [
        { id: 'old-file-1', path: 'old1.pdf' },
        { id: 'keep-file-2', path: 'keep2.pdf' },
      ],
    };
    const updated = { id: 'exist-uuid', title: 'Updated', files: [] };

    prisma.announcement.findUnique.mockResolvedValue(existing);
    prisma.announcement.update.mockResolvedValue(updated);
    prisma.annFile.delete.mockResolvedValue({});

    // File on disk exists for old-file-1
    fs.existsSync.mockImplementation((p) => p.includes('old1.pdf'));

    const req = {
      body: {
        id: 'exist-uuid',
        title: 'Updated',
        date: '2025-06-01',
        year: '2568',
        keepFileIds: JSON.stringify(['keep-file-2']),  // raw string won't be used as array
      },
      files: [],
    };
    // keepFileIds needs to be an array in body for includes() to work
    req.body.keepFileIds = ['keep-file-2'];

    const res = makeRes();

    await addOrUpdateAnnouncement(req, res);

    // old-file-1 should be deleted from DB
    expect(prisma.annFile.delete).toHaveBeenCalledWith({ where: { id: 'old-file-1' } });
    // keep-file-2 should NOT be deleted
    expect(prisma.annFile.delete).not.toHaveBeenCalledWith({ where: { id: 'keep-file-2' } });

    expect(fs.unlinkSync).toHaveBeenCalled();

    expect(res.json).toHaveBeenCalledWith({ ok: true, announcement: updated });
  });

  test('200 – updates announcement with no files to delete', async () => {
    const existing = { id: 'exist-uuid', files: [] };
    const updated = { id: 'exist-uuid', title: 'No Files', files: [] };

    prisma.announcement.findUnique.mockResolvedValue(existing);
    prisma.announcement.update.mockResolvedValue(updated);

    const req = {
      body: { id: 'exist-uuid', title: 'No Files', date: '2025-06-01', year: '2568' },
      files: [],
    };
    const res = makeRes();

    await addOrUpdateAnnouncement(req, res);

    expect(prisma.announcement.update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, announcement: updated });
  });

  // ---- 500 error ----
  test('200 – saves targetMajors when provided', async () => {
    const created = { id: 'new', title: 'Test', body: '', date: new Date(), year: '1/2569', linkUrl: null, targetMajors: ['CS','IT'], files: [] };
    prisma.announcement.create.mockResolvedValue(created);

    const req = {
      body: { title: 'Test', date: '2026-05-29', year: '1/2569', targetMajors: JSON.stringify(['CS','IT']) },
      files: [],
    };
    const res = makeRes();

    await addOrUpdateAnnouncement(req, res);

    expect(prisma.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ targetMajors: ['CS', 'IT'] }),
      })
    );
  });

  test('500 – DB error on create', async () => {
    prisma.announcement.create.mockRejectedValue(new Error('DB fail'));

    const req = {
      body: { title: 'T', date: '2025-01-01', year: '2568' },
      files: [],
    };
    const res = makeRes();

    await addOrUpdateAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'เกิดข้อผิดพลาด' });
  });

  test('500 – DB error on update', async () => {
    prisma.announcement.findUnique.mockResolvedValue({ id: 'uuid', files: [] });
    prisma.announcement.update.mockRejectedValue(new Error('DB fail'));

    const req = {
      body: { id: 'uuid', title: 'T', date: '2025-01-01', year: '2568' },
      files: [],
    };
    const res = makeRes();

    await addOrUpdateAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ---------------------------------------------------------------------------
// deleteAnnouncement
// ---------------------------------------------------------------------------
describe('deleteAnnouncement', () => {
  test('404 – announcement not found', async () => {
    prisma.announcement.findUnique.mockResolvedValue(null);

    const req = { params: { id: 'nonexistent-uuid' } };
    const res = makeRes();

    await deleteAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'ไม่พบประกาศ' });
    expect(prisma.announcement.delete).not.toHaveBeenCalled();
  });

  test('200 – deletes announcement with files on disk', async () => {
    const ann = {
      id: 'del-uuid',
      files: [
        { id: 'f1', path: 'file1.pdf' },
        { id: 'f2', path: 'file2.png' },
      ],
    };
    prisma.announcement.findUnique.mockResolvedValue(ann);
    prisma.announcement.delete.mockResolvedValue({});

    // Simulate both files existing on disk
    fs.existsSync.mockReturnValue(true);

    const req = { params: { id: 'del-uuid' } };
    const res = makeRes();

    await deleteAnnouncement(req, res);

    expect(prisma.announcement.findUnique).toHaveBeenCalledWith({
      where: { id: 'del-uuid' },
      include: { files: true },
    });
    expect(fs.existsSync).toHaveBeenCalledTimes(2);
    expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
    expect(prisma.announcement.delete).toHaveBeenCalledWith({ where: { id: 'del-uuid' } });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('200 – ใช้ absolute path (ไม่ใช่ relative path ที่ผิดตาม CWD)', async () => {
    const path = require('path');
    const ann = { id: 'del-uuid-abs', files: [{ id: 'f1', path: 'file1.pdf' }] };
    prisma.announcement.findUnique.mockResolvedValue(ann);
    prisma.announcement.delete.mockResolvedValue({});
    fs.existsSync.mockReturnValue(true);

    const req = { params: { id: 'del-uuid-abs' } };
    const res = makeRes();

    await deleteAnnouncement(req, res);

    const expectedPath = path.join(__dirname, '../uploads', 'file1.pdf');
    expect(fs.existsSync).toHaveBeenCalledWith(expectedPath);
    expect(fs.unlinkSync).toHaveBeenCalledWith(expectedPath);
  });

  test('200 – deletes announcement with no attached files', async () => {
    const ann = { id: 'del-uuid-no-files', files: [] };
    prisma.announcement.findUnique.mockResolvedValue(ann);
    prisma.announcement.delete.mockResolvedValue({});

    const req = { params: { id: 'del-uuid-no-files' } };
    const res = makeRes();

    await deleteAnnouncement(req, res);

    expect(fs.unlinkSync).not.toHaveBeenCalled();
    expect(prisma.announcement.delete).toHaveBeenCalledWith({ where: { id: 'del-uuid-no-files' } });
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('200 – skips unlinkSync when file does not exist on disk', async () => {
    const ann = { id: 'del-uuid-2', files: [{ id: 'f3', path: 'missing.pdf' }] };
    prisma.announcement.findUnique.mockResolvedValue(ann);
    prisma.announcement.delete.mockResolvedValue({});

    fs.existsSync.mockReturnValue(false);

    const req = { params: { id: 'del-uuid-2' } };
    const res = makeRes();

    await deleteAnnouncement(req, res);

    expect(fs.existsSync).toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
    expect(prisma.announcement.delete).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('500 – DB error on findUnique', async () => {
    prisma.announcement.findUnique.mockRejectedValue(new Error('DB fail'));

    const req = { params: { id: 'some-uuid' } };
    const res = makeRes();

    await deleteAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'เกิดข้อผิดพลาด' });
  });

  test('500 – DB error on delete', async () => {
    prisma.announcement.findUnique.mockResolvedValue({ id: 'uuid', files: [] });
    prisma.announcement.delete.mockRejectedValue(new Error('DB fail'));

    const req = { params: { id: 'uuid' } };
    const res = makeRes();

    await deleteAnnouncement(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'เกิดข้อผิดพลาด' });
  });
});
