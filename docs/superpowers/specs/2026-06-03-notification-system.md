# Notification System — Design Spec

## Goal

แจ้งเตือน staff + อาจารย์ประจำวิชาสหกิจ (isCoopTeacher) เมื่อนักศึกษาส่ง/อัปเดตเอกสาร และแจ้งเตือนนักศึกษาเมื่อเจ้าหน้าที่/อาจารย์ดำเนินการ แสดงเป็น badge ตัวเลขใน sidebar ของทุก role

## Architecture

สร้าง `Notification` model ใน Prisma — backend สร้าง rows เมื่อ event เกิดขึ้นใน controllers ที่มีอยู่ ผ่าน helper function `createNotifications()`. Frontend fetch unread count ตอน app โหลด + mark all as read เมื่อเข้าหน้า target. ไม่มี real-time/polling — โหลดครั้งเดียวต่อ session

**Tech Stack:** Prisma + MySQL, Express, React 19 + TypeScript

---

## Section 1: Data Model

```prisma
model Notification {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String   // event type เช่น "T000_SUBMITTED", "T002_SUBMITTED"
  title     String
  message   String
  link      String   // ลิงก์ที่ navigate เมื่อกด badge
  isRead    Boolean  @default(false)
  relatedId String?  // studentId สำหรับ dedup
  createdAt DateTime @default(now())

  @@index([userId, isRead])
}
```

**Dedup rule:** ก่อนสร้าง notification ตรวจ `{ userId, type, relatedId, isRead: false }` — ถ้ามีแล้วให้ข้ามไม่สร้างซ้ำ

---

## Section 2: Event Routing

### นักศึกษา → staff + isCoopTeacher ทุกคน

| Event | type |
|---|---|
| ยื่น/แก้ไขคำร้องสหกิจ | `COOP_APPLICATION_SUBMITTED` |
| อัปโหลดเอกสาร T000 | `T000_SUBMITTED` |
| อัปโหลดใบตอบรับ (Acceptance) | `ACCEPTANCE_UPLOADED` |
| ส่ง T002 | `T002_SUBMITTED` |
| ส่ง T003 | `T003_SUBMITTED` |
| เสนอวันนิเทศ | `SUPERVISION_PROPOSED` |

### staff + isCoopTeacher → นักศึกษา

| Event | type |
|---|---|
| อนุมัติ/ปฏิเสธคำร้อง + T000 | `STATUS_UPDATED` |
| ออกหนังสือขอความอนุเคราะห์ | `REQ_LETTER_ISSUED` |
| ออกหนังสือส่งตัว | `PLACEMENT_LETTER_ISSUED` |
| ตรวจสอบใบตอบรับ | `ACCEPTANCE_CHECKED` |
| อนุมัติ/แก้ไข T002 | `T002_REVIEWED` |
| อนุมัติ/แก้ไข T003 | `T003_REVIEWED` |
| ยืนยัน/ปฏิเสธวันนิเทศ | `SUPERVISION_DATE_UPDATED` |
| อัปโหลดหนังสือนิเทศ | `SUPERVISION_LETTER_UPLOADED` |

**ผู้รับ สำหรับ staff + isCoopTeacher:**
```js
// ดึง userId ของ staff ทั้งหมด + teachers ที่ isCoopTeacher=true
const recipients = await prisma.user.findMany({
  where: {
    OR: [
      { role: 'staff' },
      { role: 'teacher', teacher: { isCoopTeacher: true } }
    ]
  },
  select: { id: true }
});
```

---

## Section 3: Backend — Helper + Trigger Points

### `backend/utils/notificationHelper.js`

```js
const prisma = require('../config/prismaClient');

async function createNotifications(userIds, { type, title, message, link, relatedId = null }) {
  if (!userIds.length) return;

  // dedup: skip userIds ที่มี unread notification แบบเดิมอยู่แล้ว
  const existing = await prisma.notification.findMany({
    where: { userId: { in: userIds }, type, relatedId, isRead: false },
    select: { userId: true }
  });
  const existingUserIds = new Set(existing.map(n => n.userId));
  const newUserIds = userIds.filter(id => !existingUserIds.has(id));

  if (!newUserIds.length) return;

  await prisma.notification.createMany({
    data: newUserIds.map(userId => ({ userId, type, title, message, link, relatedId }))
  });
}

async function getStaffAndCoopTeacherIds() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'staff' },
        { role: 'teacher', teacher: { isCoopTeacher: true } }
      ]
    },
    select: { id: true }
  });
  return users.map(u => u.id);
}

module.exports = { createNotifications, getStaffAndCoopTeacherIds };
```

### Trigger Points (เพิ่มใน controllers ที่มีอยู่แล้ว)

**นักศึกษา → notify staff+isCoopTeacher:**
- `coopController.js` — `apply()` → COOP_APPLICATION_SUBMITTED
- `coopController.js` — `uploadDoc()` / `submitT000()` → T000_SUBMITTED
- `coopController.js` — `uploadAcceptance()` → ACCEPTANCE_UPLOADED
- `coopController.js` → T002_SUBMITTED, T003_SUBMITTED, SUPERVISION_PROPOSED

**staff/isCoopTeacher → notify student:**
- `adminDocController.js` — `reviewStudentStatus()` → STATUS_UPDATED (ส่งให้ student userId)
- `IssueLetterModal` จาก frontend → `adminRoutes.js` PUT handler → REQ_LETTER_ISSUED, PLACEMENT_LETTER_ISSUED
- T002/T003 review controllers → T002_REVIEWED, T003_REVIEWED
- `supervisionController.js` → SUPERVISION_DATE_UPDATED, SUPERVISION_LETTER_UPLOADED

---

## Section 4: API Endpoints

เพิ่มใน `backend/routes/notificationRoutes.js` (mount ที่ `/api/notifications`):

```js
GET  /api/notifications/unread-count   // คืน { count: N }
POST /api/notifications/mark-all-read  // mark ทั้งหมดของ req.userId เป็น isRead=true
```

ทั้งสองต้องการ `verifyToken` ไม่ต้องการ role check (user เห็นเฉพาะ notification ของตัวเอง)

---

## Section 5: Frontend — Sidebar Badge

### Component: `NotificationBell.tsx`

```tsx
// แสดง icon + badge count, กดแล้ว navigate + mark all read
interface Props { targetPath: string }

export default function NotificationBell({ targetPath }: Props) {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();
  const token = localStorage.getItem("coop.token");

  useEffect(() => {
    fetch("/api/notifications/unread-count", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setCount(d.count ?? 0))
      .catch(() => {});
  }, [token]);

  const handleClick = async () => {
    if (count > 0) {
      await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      setCount(0);
    }
    navigate(targetPath);
  };

  return (
    <button onClick={handleClick} style={{ position:"relative", background:"none", border:"none", cursor:"pointer", padding:8 }}>
      <svg>/* bell icon */</svg>
      {count > 0 && (
        <span style={{ position:"absolute", top:2, right:2, background:"#ef4444", color:"#fff", borderRadius:"50%", width:18, height:18, fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
```

### Integration

- **A_Sidebar.tsx**: `<NotificationBell targetPath="/admin/students" />`
- **T_Sidebar.tsx**: `<NotificationBell targetPath="/teacher/students" />`
- **S_Sidebar.tsx**: `<NotificationBell targetPath="/student/status-tracker" />`

---

## Files to Create / Modify

| Action | Path |
|---|---|
| Modify | `backend/prisma/schema.prisma` |
| Create | `backend/utils/notificationHelper.js` |
| Create | `backend/routes/notificationRoutes.js` |
| Create | `backend/controllers/notificationController.js` |
| Modify | `backend/server.js` (mount route) |
| Modify | `backend/controllers/coopController.js` |
| Modify | `backend/controllers/adminDocController.js` |
| Modify | `backend/controllers/supervisionController.js` |
| Create | `Frontend/src/components/NotificationBell.tsx` |
| Modify | `Frontend/src/components/A_Sidebar.tsx` |
| Modify | `Frontend/src/components/T_Sidebar.tsx` |
| Modify | `Frontend/src/components/S_Sidebar.tsx` |

---

## Out of Scope

- Real-time / WebSocket / polling
- Notification history page
- Email/SMS notifications
- Per-notification read status (mark all read เท่านั้น)
- ลบ notification เก่า (cleanup job)
