# Student Edit/Delete (Staff/Teacher) — Design Spec

**Date:** 2026-06-22
**Status:** Approved

## Problem

`A_Students.tsx` (the admin student list, used by staff and teacher) is currently read-only — there is no way to edit a student's basic info or remove a student record. Mistakes from Excel import, duplicate enrollment, or withdrawn students currently require direct DB intervention.

## Goals

1. Staff/teacher can edit a student's basic info (identity/contact fields only — no company/coop data, which already has dedicated flows elsewhere).
2. Staff/teacher can remove a student record, with a recovery path in case of mistakes — removal must not be a silent, instant, unrecoverable hard delete.
3. Permanently purging a student (when recovery is no longer wanted) must actually work — today it would fail with a foreign-key error for any student with a submitted coop application form or scheduled visit.

## Out of scope

- Editing company/coop-related data (handled by existing flows: `T_Requests`, `A_CoopApplications`, etc.)
- Auto-purge / retention policies on trashed students — recovery window is unlimited until staff explicitly purges.
- Any change to `Student.major`/`studyProgram` as *display* values elsewhere, or to `A_Students.tsx`'s `CURRICULUM_TH`/`LEGACY_MAJOR_TH` maps — those stay as-is.

## Data model

Add one field to `Student` (`backend/prisma/schema.prisma`):

```prisma
model Student {
  // ...existing fields unchanged...
  deletedAt DateTime?   // null = active. Set = soft-deleted (in trash).
}
```

Fix two relations that are missing `onDelete: Cascade` (required for permanent delete to not throw a foreign-key error):

```prisma
model CoopApplicationForm {
  student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
}

model Visit {
  student   Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
}
```

One additive Prisma migration. Existing rows get `deletedAt = NULL` (active) by default — no data loss.

## Soft-delete semantics

- `deletedAt = null` → active student. Visible everywhere, can log in.
- `deletedAt = <timestamp>` → in trash. Hidden from every existing student-listing query, blocked from logging in, but all data (documents, visits, coop application, etc.) stays intact and untouched.
- No automatic purge. Stays in trash indefinitely until a staff/teacher explicitly restores or permanently deletes it.

### Existing queries that must filter out trashed students

Every one of these needs `where: { deletedAt: null }` added (or merged into its existing `where`):

- `studentController.getStudents` (backend/controllers/studentController.js) — powers `GET /api/students`, used by `A_Students.tsx`'s main list.
- `adminDocController.getAllStudentsForReview` — powers `GET /api/admin/students`.
- `adminDocController.getStudentsForT000` — powers `GET /api/admin/t000/students`.
- The distinct-majors query in `adminRoutes.js` (`GET /api/admin/students/majors`).
- `authController.loginWithGoogle`'s `prisma.user.findFirst({ where: { email, role: 'student' } })` lookup — must additionally check the related `Student.deletedAt` is null (join via `include: { student: true }` and reject with the existing "ไม่พบรายชื่อในระบบ" message if `user.student?.deletedAt` is set). A trashed student must not be able to log in.

## Backend API

New endpoints in `backend/routes/adminRoutes.js`, all gated `verifyToken, verifyRole('staff', 'teacher')` (matching the existing `ADMIN_ROLES` pattern used for the rest of `/api/admin/students/*`):

| Method | Route | Controller function | Behavior |
|---|---|---|---|
| `PUT` | `/api/admin/students/:id` | `studentController.updateStudentBasicInfo` | Updates the 13 basic-info fields (see below). Validates `studentId` uniqueness if changed. If `email` changed, updates `User.email` in the same transaction. |
| `DELETE` | `/api/admin/students/:id` | `studentController.softDeleteStudent` | Sets `deletedAt = new Date()`. 404 if already trashed or not found. |
| `GET` | `/api/admin/students/trash` | `studentController.getTrashedStudents` | Lists students where `deletedAt` is not null, same shape as the main list. |
| `POST` | `/api/admin/students/:id/restore` | `studentController.restoreStudent` | Sets `deletedAt = null`. 404 if not currently trashed. |
| `DELETE` | `/api/admin/students/:id/permanent` | `studentController.permanentlyDeleteStudent` | Real `prisma.student.delete()`. **Refuses with 400 if `deletedAt` is null** (must be trashed first — this is the safety gate, not a UI-only check). |

### Editable field list ("basic info" — confirmed scope)

`prefix`, `firstName`, `lastName`, `firstNameEn`, `lastNameEn`, `studentId`, `major`, `studyProgram`, `year`, `phone`, `email`, `advisorName`, `jobPosition`.

- `email` lives on `User`, not `Student` — the update must touch both tables (`prisma.$transaction`).
- `studentId` is `@unique` on `Student` — rely on the DB constraint for the uniqueness check (catch the Prisma unique-violation error and return a friendly 409, matching the existing `saveCriteria`-style error handling pattern in this codebase).
- `studentId` is no longer the login key (login is Google OAuth matched by email, confirmed in `authController.js:608`), so editing it carries no login-breakage risk.

## Frontend (`Frontend/src/components/A_Students.tsx`)

### Active list — new row actions

Added next to the existing "ดูข้อมูล" button (line ~404):

- **"แก้ไข"** — opens an edit modal pre-filled with the 13 basic-info fields. `prefix` and `studyProgram` render as `<select>` using the existing `Prefix`/`StudyProgram` enum values (`MR`/`MS`, `normal`/`special`). On submit: `PUT /api/admin/students/:id`, close modal, refetch list.
- **"ลบ"** — `window.confirm`-style dialog ("ย้าย {ชื่อ} ไปถังขยะ?"). On confirm: `DELETE /api/admin/students/:id`, refetch list (row disappears).

### New tab: "ถังขยะ"

A second tab alongside the existing list (same page, mirrors the existing `tab === "company"` pattern at line ~522). Fetches `GET /api/admin/students/trash`. Each row shows:

- **"กู้คืน"** — no confirmation needed (non-destructive, reversible by deleting again). `POST /api/admin/students/:id/restore`, refetch trash list.
- **"ลบถาวร"** — type-to-confirm (user must type the student's `studentId` into a text input before the button enables), since this is irreversible. `DELETE /api/admin/students/:id/permanent`, refetch trash list.

## Testing

- Backend: Jest tests per new controller function (mock Prisma, following the existing `__tests__/studentController.test.js` pattern) — cover the soft-delete/restore/permanent-delete state machine (e.g. permanent delete on a non-trashed student returns 400) and the `email`-touches-`User` transaction.
- Frontend: type-check only (no component test framework in this project, per existing convention).
- Manual: verify a trashed student cannot log in via Google OAuth (can be checked at the controller-test level by asserting the login query's `where` clause / soft-deleted-user case, without needing a live Google token).
