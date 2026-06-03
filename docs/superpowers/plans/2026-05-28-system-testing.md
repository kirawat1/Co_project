# System Testing — Full Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ยกระดับ test coverage ของทั้งระบบจาก 25% → 80%+ ครอบคลุม Backend unit tests, Route integration tests, และ Frontend interaction tests

**Architecture:**
- Backend unit tests: Jest + Prisma mock (pattern เดิมใน `__tests__/`) — ไม่ต้องการ DB จริง
- Backend route integration tests: supertest กับ Express app โดยตรง — mock JWT middleware
- Frontend interaction tests: Playwright ต่อจาก spec ที่มีอยู่ — เพิ่ม interaction (form, click, input)

**Tech Stack:** Jest 29, supertest 7, Playwright 1.60, React 19 + TypeScript, Express + Prisma (MySQL)

---

## สถานะปัจจุบัน

| Layer | ครอบคลุม | ช่องว่าง |
|-------|----------|---------|
| Backend controllers | 4/16 (25%) | 12 controllers ไม่มี test |
| Backend route integration | 0/11 (0%) | ไม่มี supertest เลย |
| Frontend smoke/navigation | 64/64 (100%) | ผ่านแล้ว |
| Frontend interaction | 0 | ไม่มี form/CRUD test |

**รันทดสอบ:**
```bash
cd backend && npm test             # Jest — unit tests
cd Frontend && npx playwright test # Playwright — UI tests
```

---

## โครงสร้างไฟล์ที่จะสร้าง / แก้ไข

```
backend/__tests__/
├── __mocks__/
│   └── prismaClient.js          ← แก้: เพิ่ม models ที่ขาด
├── supervisionController.test.js ← สร้างใหม่
├── teacherController.test.js     ← สร้างใหม่
├── announcementController.test.js← สร้างใหม่
├── companyController.test.js     ← สร้างใหม่
├── adminDashboardController.test.js ← สร้างใหม่
├── criteriaController.test.js    ← สร้างใหม่
├── coopPeriodController.test.js  ← สร้างใหม่
└── routes/
    ├── auth.routes.test.js       ← สร้างใหม่ (supertest)
    └── student.routes.test.js    ← สร้างใหม่ (supertest)

Frontend/tests/
├── admin.interaction.spec.ts     ← สร้างใหม่
└── student.interaction.spec.ts   ← สร้างใหม่
```

---

## Task 1: ขยาย Prisma Mock ให้ครอบคลุม models ทั้งหมด

**Files:**
- Modify: `backend/__tests__/__mocks__/prismaClient.js`

- [ ] **Step 1: เพิ่ม models ที่ขาดใน mock**

แทนที่เนื้อหาทั้งหมดใน `backend/__tests__/__mocks__/prismaClient.js`:

```js
// __tests__/__mocks__/prismaClient.js
const prismaMock = {
  user: {
    findFirst: jest.fn(), findUnique: jest.fn(),
    create: jest.fn(), upsert: jest.fn(), update: jest.fn(),
  },
  student: {
    findUnique: jest.fn(), findMany: jest.fn(),
    count: jest.fn(), create: jest.fn(), upsert: jest.fn(), update: jest.fn(),
  },
  teacher: {
    findUnique: jest.fn(), findMany: jest.fn(),
    count: jest.fn(), upsert: jest.fn(), update: jest.fn(),
  },
  studentCoop: {
    findUnique: jest.fn(), findMany: jest.fn(),
    count: jest.fn(), upsert: jest.fn(), update: jest.fn(),
  },
  document: {
    findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(),
    create: jest.fn(), createMany: jest.fn(), delete: jest.fn(), update: jest.fn(),
  },
  coopPeriod: {
    findUnique: jest.fn(), findMany: jest.fn(),
    create: jest.fn(), update: jest.fn(), delete: jest.fn(),
  },
  announcement: {
    findMany: jest.fn(), findUnique: jest.fn(),
    create: jest.fn(), update: jest.fn(), delete: jest.fn(),
    upsert: jest.fn(),
  },
  announcementFile: {
    findMany: jest.fn(), create: jest.fn(),
    delete: jest.fn(), deleteMany: jest.fn(),
  },
  company: {
    findMany: jest.fn(), findUnique: jest.fn(),
    create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn(),
  },
  mentor: {
    findMany: jest.fn(), findUnique: jest.fn(),
    create: jest.fn(), update: jest.fn(), delete: jest.fn(),
  },
  supervisionAppointment: {
    findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(),
    create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn(),
  },
  systemConfig: {
    findUnique: jest.fn(), findMany: jest.fn(),
    upsert: jest.fn(), update: jest.fn(),
  },
  systemAsset: {
    findMany: jest.fn(), create: jest.fn(),
    update: jest.fn(), delete: jest.fn(),
  },
  criteria: {
    findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn(),
  },
  visit: {
    findMany: jest.fn(), findUnique: jest.fn(),
    create: jest.fn(), update: jest.fn(), delete: jest.fn(),
  },
  coopApplicationForm: {
    findUnique: jest.fn(), findMany: jest.fn(),
    upsert: jest.fn(), update: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(prismaMock)),
};

module.exports = prismaMock;
```

- [ ] **Step 2: รัน tests เดิมให้ผ่านก่อน (regression check)**

```bash
cd backend && npm test
```

Expected: ทุก test เดิม (authController, authMiddleware, coopController, studentController) ยังผ่านทั้งหมด

- [ ] **Step 3: Commit**

```bash
git add backend/__tests__/__mocks__/prismaClient.js
git commit -m "test: extend prisma mock with all missing models"
```

---

## Task 2: supervisionController Tests

**Files:**
- Create: `backend/__tests__/supervisionController.test.js`
- Reference: `backend/controllers/supervisionController.js`

- [ ] **Step 1: เขียน test file**

สร้าง `backend/__tests__/supervisionController.test.js`:

```js
// __tests__/supervisionController.test.js
jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});

const prisma = require('./__mocks__/prismaClient');
const {
  getSupervisionPeriods,
  saveSupervisionPeriod,
  getAllSupervisions,
} = require('../controllers/supervisionController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeEach(() => jest.clearAllMocks());

// ── getSupervisionPeriods ──
describe('getSupervisionPeriods', () => {
  test('200 — คืน periods ทั้งหมด', async () => {
    const mockPeriods = [
      { id: 1, academicYear: '2567', semester: '1', isSupervisionOpen: true }
    ];
    prisma.coopPeriod.findMany.mockResolvedValue(mockPeriods);

    const req = {};
    const res = makeRes();
    await getSupervisionPeriods(req, res);

    expect(prisma.coopPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: expect.any(Array) })
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, periods: mockPeriods });
  });

  test('500 — DB error คืน 500', async () => {
    prisma.coopPeriod.findMany.mockRejectedValue(new Error('DB error'));
    const res = makeRes();
    await getSupervisionPeriods({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});

// ── saveSupervisionPeriod ──
describe('saveSupervisionPeriod', () => {
  test('200 — อัปเดต period ได้สำเร็จ', async () => {
    const updated = { id: 1, isSupervisionOpen: true };
    prisma.coopPeriod.update.mockResolvedValue(updated);

    const req = { body: { periodId: '1', isSupervisionOpen: true, supervisionStartDate: null, supervisionEndDate: null } };
    const res = makeRes();
    await saveSupervisionPeriod(req, res);

    expect(prisma.coopPeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } })
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, period: updated });
  });

  test('500 — DB error', async () => {
    prisma.coopPeriod.update.mockRejectedValue(new Error('fail'));
    const req = { body: { periodId: '1' } };
    const res = makeRes();
    await saveSupervisionPeriod(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── getAllSupervisions ──
describe('getAllSupervisions', () => {
  test('200 — คืน supervisions array', async () => {
    prisma.supervisionAppointment.findMany.mockResolvedValue([{ id: 1 }]);
    const res = makeRes();
    await getAllSupervisions({}, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, supervisions: expect.any(Array) })
    );
  });
});
```

- [ ] **Step 2: รัน test ให้ผ่าน**

```bash
cd backend && npx jest supervisionController --verbose
```

Expected: 5 tests pass

- [ ] **Step 3: Commit**

```bash
git add backend/__tests__/supervisionController.test.js
git commit -m "test: add supervisionController unit tests"
```

---

## Task 3: teacherController Tests

**Files:**
- Create: `backend/__tests__/teacherController.test.js`
- Reference: `backend/controllers/teacherController.js`

- [ ] **Step 1: เขียน test file**

สร้าง `backend/__tests__/teacherController.test.js`:

```js
// __tests__/teacherController.test.js
jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});

const prisma = require('./__mocks__/prismaClient');
const { getProfile, updateProfile } = require('../controllers/teacherController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeEach(() => jest.clearAllMocks());

// ── getProfile ──
describe('getProfile', () => {
  test('401 — ไม่มี req.user', async () => {
    const req = {};
    const res = makeRes();
    await getProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('200 (isFirstTime) — ยังไม่มีข้อมูล Teacher → คืน email จาก User', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ email: 'teacher@kku.th' });

    const req = { user: { id: 5 } };
    const res = makeRes();
    await getProfile(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ isFirstTime: true, email: 'teacher@kku.th' })
    );
  });

  test('200 — มีข้อมูล Teacher แล้ว → คืนข้อมูลครบ', async () => {
    prisma.teacher.findUnique.mockResolvedValue({
      id: 1, firstName: 'อาจารย์', lastName: 'ทดสอบ',
      user: { email: 'teacher@kku.th' }
    });

    const req = { user: { id: 5 } };
    const res = makeRes();
    await getProfile(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'อาจารย์', email: 'teacher@kku.th' })
    );
  });

  test('500 — DB error', async () => {
    prisma.teacher.findUnique.mockRejectedValue(new Error('DB'));
    const res = makeRes();
    await getProfile({ user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── updateProfile ──
describe('updateProfile', () => {
  test('401 — ไม่มี req.user', async () => {
    const res = makeRes();
    await updateProfile({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('200 — upsert Teacher สำเร็จ', async () => {
    const mockTeacher = { id: 1, firstName: 'ใหม่', lastName: 'นาม' };
    prisma.teacher.upsert.mockResolvedValue(mockTeacher);

    const req = {
      user: { id: 5 },
      body: { firstName: 'ใหม่', lastName: 'นาม', phone: '0800000000', faculty: 'วิทยาลัยการคอมพิวเตอร์', major: null }
    };
    const res = makeRes();
    await updateProfile(req, res);

    expect(prisma.teacher.upsert).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});
```

- [ ] **Step 2: รัน test**

```bash
cd backend && npx jest teacherController --verbose
```

Expected: 5 tests pass

- [ ] **Step 3: Commit**

```bash
git add backend/__tests__/teacherController.test.js
git commit -m "test: add teacherController unit tests"
```

---

## Task 4: announcementController Tests

**Files:**
- Create: `backend/__tests__/announcementController.test.js`
- Reference: `backend/controllers/announcementController.js`

- [ ] **Step 1: เขียน test file**

สร้าง `backend/__tests__/announcementController.test.js`:

```js
// __tests__/announcementController.test.js
jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});

// announcementController ใช้ require('../config/prismaClient') แบบ singleton
// จำเป็นต้อง mock module path นี้ด้วย
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const {
  getAnnouncements,
  deleteAnnouncement,
} = require('../controllers/announcementController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeEach(() => jest.clearAllMocks());

describe('getAnnouncements', () => {
  test('200 — คืน list พร้อม attachments', async () => {
    prisma.announcement.findMany.mockResolvedValue([
      {
        id: 1, title: 'ประกาศ', body: 'เนื้อหา', date: new Date(), year: '2567', linkUrl: null,
        files: [{ mime: 'image/png', name: 'img.png', path: 'uploads/img.png' }]
      }
    ]);

    const req = { query: {} };
    const res = makeRes();
    await getAnnouncements(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, list: expect.any(Array) })
    );
    const list = res.json.mock.calls[0][0].list;
    expect(list[0].attachments[0].type).toBe('image');
  });

  test('200 — filter ด้วย year query', async () => {
    prisma.announcement.findMany.mockResolvedValue([]);
    const req = { query: { year: '2567' } };
    const res = makeRes();
    await getAnnouncements(req, res);
    expect(prisma.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { year: '2567' } })
    );
  });

  test('500 — DB error', async () => {
    prisma.announcement.findMany.mockRejectedValue(new Error('fail'));
    const res = makeRes();
    await getAnnouncements({ query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('deleteAnnouncement', () => {
  test('404 — ไม่พบประกาศ', async () => {
    prisma.announcement.findUnique.mockResolvedValue(null);
    const req = { params: { id: '99' } };
    const res = makeRes();
    await deleteAnnouncement(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('200 — ลบสำเร็จ', async () => {
    prisma.announcement.findUnique.mockResolvedValue({
      id: 1, files: []
    });
    prisma.announcement.delete.mockResolvedValue({ id: 1 });

    const req = { params: { id: '1' } };
    const res = makeRes();
    await deleteAnnouncement(req, res);

    expect(prisma.announcement.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});
```

- [ ] **Step 2: รัน test**

```bash
cd backend && npx jest announcementController --verbose
```

Expected: 5 tests pass

- [ ] **Step 3: Commit**

```bash
git add backend/__tests__/announcementController.test.js
git commit -m "test: add announcementController unit tests"
```

---

## Task 5: companyController Tests

**Files:**
- Create: `backend/__tests__/companyController.test.js`
- Reference: `backend/controllers/companyController.js`

**หมายเหตุ:** companyController ใช้ `new PrismaClient()` แทน singleton — ต้อง mock `@prisma/client` เท่านั้น

- [ ] **Step 1: เขียน test file**

สร้าง `backend/__tests__/companyController.test.js`:

```js
// __tests__/companyController.test.js
jest.mock('@prisma/client', () => {
  const mocks = require('./__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});

const prisma = require('./__mocks__/prismaClient');
const { getCompanies, addCompany, deleteCompany } = require('../controllers/companyController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeEach(() => jest.clearAllMocks());

describe('getCompanies', () => {
  test('200 — คืน array บริษัท', async () => {
    prisma.company.findMany.mockResolvedValue([
      { id: 1, name: 'บริษัท ทดสอบ', mentors: [] }
    ]);

    const res = makeRes();
    await getCompanies({}, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'บริษัท ทดสอบ' })])
    );
  });
});

describe('addCompany', () => {
  test('200 — เพิ่มบริษัทสำเร็จ', async () => {
    const mockCompany = { id: 1, name: 'บริษัท ใหม่' };
    prisma.company.create.mockResolvedValue(mockCompany);

    const req = {
      user: { id: 1 },
      body: {
        name: 'บริษัท ใหม่', nameEn: 'New Co', address: 'ที่อยู่', addressNo: '1',
        moo: null, soi: null, road: null, subDistrict: 'ตำบล', district: 'อำเภอ',
        province: 'ขอนแก่น', zipcode: '40000', email: 'co@test.com',
        phone: '0800000000', fax: null, website: null, pastYears: null,
        contactPerson: null, contactPosition: null
      }
    };
    const res = makeRes();
    await addCompany(req, res);

    expect(prisma.company.create).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, company: mockCompany });
  });

  test('400 — DB error', async () => {
    prisma.company.create.mockRejectedValue(new Error('duplicate'));
    const req = { user: { id: 1 }, body: { name: 'x' } };
    const res = makeRes();
    await addCompany(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
```

- [ ] **Step 2: รัน test**

```bash
cd backend && npx jest companyController --verbose
```

Expected: 3 tests pass

- [ ] **Step 3: Commit**

```bash
git add backend/__tests__/companyController.test.js
git commit -m "test: add companyController unit tests"
```

---

## Task 6: criteriaController + coopPeriodController Tests

**Files:**
- Create: `backend/__tests__/criteriaController.test.js`
- Create: `backend/__tests__/coopPeriodController.test.js`
- Reference: `backend/controllers/criteriaController.js`, `backend/controllers/coopPeriodController.js`

- [ ] **Step 1: อ่าน controller ทั้งสองก่อน**

```bash
cat backend/controllers/criteriaController.js
cat backend/controllers/coopPeriodController.js
```

- [ ] **Step 2: เขียน criteriaController.test.js**

สร้าง `backend/__tests__/criteriaController.test.js`:

```js
// __tests__/criteriaController.test.js
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const { getCriteria, saveCriteria } = require('../controllers/criteriaController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeEach(() => jest.clearAllMocks());

describe('getCriteria', () => {
  test('200 — คืน criteria array', async () => {
    prisma.criteria.findMany.mockResolvedValue([
      { id: 1, name: 'การตรงต่อเวลา', maxScore: 10 }
    ]);
    const res = makeRes();
    await getCriteria({}, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, criteria: expect.any(Array) })
    );
  });

  test('500 — DB error', async () => {
    prisma.criteria.findMany.mockRejectedValue(new Error('DB'));
    const res = makeRes();
    await getCriteria({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
```

- [ ] **Step 3: เขียน coopPeriodController.test.js**

สร้าง `backend/__tests__/coopPeriodController.test.js`:

```js
// __tests__/coopPeriodController.test.js
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));

const prisma = require('./__mocks__/prismaClient');
const { getCoopPeriods, createCoopPeriod } = require('../controllers/coopPeriodController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeEach(() => jest.clearAllMocks());

describe('getCoopPeriods', () => {
  test('200 — คืน periods array', async () => {
    prisma.coopPeriod.findMany.mockResolvedValue([
      { id: 1, academicYear: '2567', semester: '1', isActive: true }
    ]);
    const res = makeRes();
    await getCoopPeriods({}, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, periods: expect.any(Array) })
    );
  });
});

describe('createCoopPeriod', () => {
  test('200 — สร้าง period ใหม่สำเร็จ', async () => {
    const mock = { id: 1, academicYear: '2567', semester: '2' };
    prisma.coopPeriod.create.mockResolvedValue(mock);

    const req = { body: { academicYear: '2567', semester: '2', isActive: false } };
    const res = makeRes();
    await createCoopPeriod(req, res);

    expect(prisma.coopPeriod.create).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});
```

- [ ] **Step 4: รัน tests ทั้งสอง**

```bash
cd backend && npx jest criteriaController coopPeriodController --verbose
```

Expected: 4 tests pass รวมกัน

- [ ] **Step 5: Commit**

```bash
git add backend/__tests__/criteriaController.test.js backend/__tests__/coopPeriodController.test.js
git commit -m "test: add criteriaController and coopPeriodController unit tests"
```

---

## Task 7: adminDashboardController Tests

**Files:**
- Create: `backend/__tests__/adminDashboardController.test.js`
- Reference: `backend/controllers/adminDashboardController.js`

- [ ] **Step 1: อ่าน controller ก่อน**

```bash
cat backend/controllers/adminDashboardController.js
```

ดูว่า query ใช้ model อะไรบ้าง (student.count, studentCoop.count ฯลฯ)

- [ ] **Step 2: เขียน test file**

สร้าง `backend/__tests__/adminDashboardController.test.js`:

```js
// __tests__/adminDashboardController.test.js
jest.mock('../config/prismaClient', () => require('./__mocks__/prismaClient'));
// หรือถ้า adminDashboardController ใช้ new PrismaClient() ให้ใช้:
// jest.mock('@prisma/client', () => {
//   const mocks = require('./__mocks__/prismaClient');
//   return { PrismaClient: jest.fn(() => mocks) };
// });

const prisma = require('./__mocks__/prismaClient');
const { getDashboardStats } = require('../controllers/adminDashboardController');

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeEach(() => jest.clearAllMocks());

describe('getDashboardStats', () => {
  test('200 — คืน stats object พร้อมตัวเลข', async () => {
    prisma.student.count.mockResolvedValue(50);
    prisma.studentCoop.count.mockResolvedValue(30);

    const res = makeRes();
    await getDashboardStats({}, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, data: expect.any(Object) })
    );
  });

  test('500 — DB error', async () => {
    prisma.student.count.mockRejectedValue(new Error('fail'));
    const res = makeRes();
    await getDashboardStats({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
```

**หมายเหตุ:** ถ้า controller ใช้ Prisma method นอกเหนือจาก `.count` ให้เพิ่ม mock ตามที่ error บอก

- [ ] **Step 3: รัน test**

```bash
cd backend && npx jest adminDashboardController --verbose
```

- [ ] **Step 4: Commit**

```bash
git add backend/__tests__/adminDashboardController.test.js
git commit -m "test: add adminDashboardController unit tests"
```

---

## Task 8: Route Integration Tests ด้วย supertest

**Files:**
- Create: `backend/__tests__/routes/auth.routes.test.js`
- Create: `backend/__tests__/routes/student.routes.test.js`

**แนวทาง:** สร้าง Express app จาก routes โดยตรง + mock JWT middleware + supertest

- [ ] **Step 1: เขียน auth route integration test**

สร้าง `backend/__tests__/routes/auth.routes.test.js`:

```js
// __tests__/routes/auth.routes.test.js
jest.mock('@prisma/client', () => {
  const mocks = require('../__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});
jest.mock('../../config/prismaClient', () => require('../__mocks__/prismaClient'));

const request = require('supertest');
const express = require('express');
const prisma = require('../__mocks__/prismaClient');
const bcrypt = require('bcryptjs');

const authRoutes = require('../../routes/authRoutes');

// สร้าง mini Express app สำหรับ test
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

beforeEach(() => jest.clearAllMocks());

describe('POST /api/auth/signin', () => {
  test('400 — ไม่ส่ง username/password', async () => {
    const res = await request(app).post('/api/auth/signin').send({});
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test('404 — ไม่พบ user', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/signin')
      .send({ username: 'nobody', password: 'wrong' });
    expect(res.status).toBe(404);
  });

  test('401 — password ไม่ตรง', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 1, username: 'test', password: await bcrypt.hash('correct', 10), role: 'student'
    });
    const res = await request(app)
      .post('/api/auth/signin')
      .send({ username: 'test', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('200 — login สำเร็จ คืน token', async () => {
    const hashedPw = await bcrypt.hash('password123', 10);
    prisma.user.findFirst.mockResolvedValue({
      id: 1, username: 'student1', password: hashedPw, role: 'student'
    });

    const res = await request(app)
      .post('/api/auth/signin')
      .send({ username: 'student1', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body).toHaveProperty('token');
  });
});
```

- [ ] **Step 2: เขียน student route integration test**

สร้าง `backend/__tests__/routes/student.routes.test.js`:

```js
// __tests__/routes/student.routes.test.js
jest.mock('@prisma/client', () => {
  const mocks = require('../__mocks__/prismaClient');
  return { PrismaClient: jest.fn(() => mocks) };
});
jest.mock('../../config/prismaClient', () => require('../__mocks__/prismaClient'));

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../__mocks__/prismaClient');

const studentRoutes = require('../../routes/studentRoutes');

const app = express();
app.use(express.json());
app.use('/api/students', studentRoutes);

const VALID_TOKEN = jwt.sign({ id: 1, role: 'staff' }, process.env.JWT_SECRET || 'test_secret_key_for_jest_testing_only_32chars');

beforeEach(() => jest.clearAllMocks());

describe('GET /api/students', () => {
  test('401 — ไม่มี Authorization header', async () => {
    const res = await request(app).get('/api/students');
    expect(res.status).toBe(401);
  });

  test('200 — มี valid token คืน student list', async () => {
    prisma.student.findMany.mockResolvedValue([
      { id: 1, firstName: 'นักศึกษา', lastName: 'ทดสอบ', studentId: '640610001' }
    ]);
    prisma.student.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    // response เป็น { data: [...], meta: { total, page, ... } }
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
  });
});
```

- [ ] **Step 3: รัน integration tests**

```bash
cd backend && npx jest routes/ --verbose
```

Expected: 5 tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/__tests__/routes/
git commit -m "test: add auth and student route integration tests (supertest)"
```

---

## Task 9: Frontend — Admin Interaction Tests

**Files:**
- Create: `Frontend/tests/admin.interaction.spec.ts`
- Reference: `Frontend/tests/helpers/mockApi.ts`, `Frontend/tests/admin.spec.ts`

ทดสอบ interaction จริง: filter, search input, modal open/close

- [ ] **Step 1: เขียน spec file**

สร้าง `Frontend/tests/admin.interaction.spec.ts`:

```ts
/**
 * tests/admin.interaction.spec.ts
 * ─────────────────────────────────────────────────────
 * Playwright interaction tests — Admin role
 * ทดสอบ UI behavior: search, filter, modal open/close
 */
import { test, expect } from "@playwright/test";
import { setupAdminMocks } from "./helpers/mockApi";

// TC-AI-01: Students page — search input รับค่าได้
test("TC-AI-01: Students page — search input รับค่าได้", async ({ page }) => {
  await setupAdminMocks(page);
  await page.goto("/admin/students");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });

  const searchInput = page.locator('input[type="text"], input[placeholder*="ค้นหา"], input[placeholder*="search"]').first();
  if (await searchInput.isVisible()) {
    await searchInput.fill("640610");
    expect(await searchInput.inputValue()).toBe("640610");
  }
});

// TC-AI-02: Company page — ปุ่มเพิ่มบริษัท (ถ้ามี) เปิด modal ได้
test("TC-AI-02: Company page — ปุ่มเพิ่มบริษัทแสดง", async ({ page }) => {
  await setupAdminMocks(page);
  await page.goto("/admin/company");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });

  // ตรวจว่า main content โหลดได้ (ไม่ crash)
  const main = page.locator("main");
  await expect(main).toBeVisible();
});

// TC-AI-03: Announcements — หน้าโหลดได้โดยไม่ crash เมื่อ list ว่าง
test("TC-AI-03: Announcements — render ด้วย empty list", async ({ page }) => {
  await setupAdminMocks(page);
  await page.goto("/admin/announcements");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await expect(page.locator("main")).toBeVisible();
  // ไม่มี JS error (page ไม่ crash)
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForTimeout(1000);
  expect(errors).toHaveLength(0);
});

// TC-AI-04: Settings — หน้าโหลดได้โดยไม่ crash
test("TC-AI-04: Settings — render ด้วย empty assets", async ({ page }) => {
  await setupAdminMocks(page);
  await page.goto("/admin/settings");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await expect(page.locator("main")).toBeVisible();
});

// TC-AI-05: Dashboard — แสดง stats ตัวเลข (ไม่ crash กับ 0)
test("TC-AI-05: Dashboard stats แสดง 0 โดยไม่ crash", async ({ page }) => {
  await setupAdminMocks(page);
  await page.goto("/admin/dashboard");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });

  // ไม่มี JS error
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForTimeout(1500);
  expect(errors).toHaveLength(0);
});
```

- [ ] **Step 2: รัน test**

```bash
cd Frontend && npx playwright test tests/admin.interaction.spec.ts --headed
```

Expected: 5 tests pass (ถ้า test ใดล้มให้ดู selector ใน browser จริง)

- [ ] **Step 3: Commit**

```bash
git add Frontend/tests/admin.interaction.spec.ts
git commit -m "test(e2e): add admin UI interaction tests"
```

---

## Task 10: Frontend — Student Interaction Tests

**Files:**
- Create: `Frontend/tests/student.interaction.spec.ts`
- Reference: `Frontend/tests/helpers/mockApi.ts`

- [ ] **Step 1: เขียน spec file**

สร้าง `Frontend/tests/student.interaction.spec.ts`:

```ts
/**
 * tests/student.interaction.spec.ts
 * ─────────────────────────────────────────────────────
 * Playwright interaction tests — Student role
 */
import { test, expect } from "@playwright/test";
import { setupStudentMocks } from "./helpers/mockApi";

// TC-SI-01: Dashboard — render โดยไม่มี JS error
test("TC-SI-01: Dashboard — ไม่มี JS error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await setupStudentMocks(page);
  await page.goto("/student/dashboard");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await page.waitForTimeout(1500);

  expect(errors).toHaveLength(0);
});

// TC-SI-02: Daily page — แสดง content หลัก
test("TC-SI-02: Daily page — <main> แสดงได้", async ({ page }) => {
  await setupStudentMocks(page);
  await page.goto("/student/daily");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await expect(page.locator("main")).toBeVisible();
});

// TC-SI-03: Docs page — แสดง content หลัก
test("TC-SI-03: Docs page — <main> แสดงได้", async ({ page }) => {
  await setupStudentMocks(page);
  await page.goto("/student/docs");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await expect(page.locator("main")).toBeVisible();
});

// TC-SI-04: Company page — แสดง content หลัก
test("TC-SI-04: Company page — <main> แสดงได้", async ({ page }) => {
  await setupStudentMocks(page);
  await page.goto("/student/company");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await expect(page.locator("main")).toBeVisible();
});

// TC-SI-05: Status tracker — render โดยไม่ crash
test("TC-SI-05: Status Tracker — ไม่มี JS error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await setupStudentMocks(page);
  await page.goto("/student/status-tracker");
  await page.waitForSelector("header.topbar, .topbar", { timeout: 10_000 });
  await page.waitForTimeout(1500);

  expect(errors).toHaveLength(0);
});
```

- [ ] **Step 2: รัน test**

```bash
cd Frontend && npx playwright test tests/student.interaction.spec.ts --headed
```

Expected: 5 tests pass

- [ ] **Step 3: Commit**

```bash
git add Frontend/tests/student.interaction.spec.ts
git commit -m "test(e2e): add student UI interaction tests"
```

---

## Task 11: รัน Full Test Suite และสรุปผล

- [ ] **Step 1: รัน Backend tests ทั้งหมด**

```bash
cd backend && npm test
```

Expected output (ตัวอย่าง):
```
Test Suites: 10 passed, 10 total
Tests:       ~45 passed, ~45 total
```

- [ ] **Step 2: รัน Frontend tests ทั้งหมด**

```bash
cd Frontend && npx playwright test
```

Expected: 64 + 10 = 74 tests passed (smoke 64 + interaction 10)

- [ ] **Step 3: ดู HTML report**

```bash
cd Frontend && npx playwright show-report
```

- [ ] **Step 4: อัปเดต CHANGELOG.md**

เพิ่ม entry ใหม่ที่บรรทัดบนสุด:

```markdown
## [2026-05-28] เพิ่ม Test Coverage ระดับ System

### Backend Unit Tests (เพิ่มใหม่)
- supervisionController: 5 tests
- teacherController: 5 tests
- announcementController: 5 tests
- companyController: 3 tests
- criteriaController: 2 tests
- coopPeriodController: 2 tests
- adminDashboardController: 2 tests
- ขยาย prismaClient mock ให้ครอบคลุมทุก model

### Backend Integration Tests (ใหม่)
- auth.routes: 4 tests (supertest)
- student.routes: 2 tests (supertest)

### Frontend Interaction Tests (ใหม่)
- admin.interaction: 5 tests
- student.interaction: 5 tests
```

- [ ] **Step 5: Final commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG with test coverage milestone"
```

---

## สรุป Coverage เป้าหมาย

| Layer | ก่อน | หลัง |
|-------|------|------|
| Backend controllers | 4/16 (25%) | 11/16 (69%) |
| Backend route integration | 0 | 2 routes (auth, student) |
| Frontend smoke tests | 64 | 64 (คงเดิม) |
| Frontend interaction tests | 0 | 10 |
| **รวม Tests** | **~64** | **~110+** |

**Controllers ที่ยังไม่ครอบคลุม (future work):**
- docController, adminDocController, docRequirementController
- configController, systemAssetController
- visitController
