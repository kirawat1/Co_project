// แก้ข้อมูลครั้งเดียว: หลักสูตรของนักศึกษาที่หายเพราะบั๊กหน้าข้อมูลนักศึกษา (2026-09-29 … 2026-11-04)
// — เลือกบริษัท/ผู้ติดต่อในหน้าข้อมูลนักศึกษา บันทึกอัตโนมัติด้วย { companyId, contactIds } อย่างเดียว
//   แต่ PUT /api/students/me เขียน major = data.major || null → หลักสูตรกลายเป็นว่าง
//   (อาจารย์ประจำวิชามองไม่เห็นนักศึกษา · กำหนดส่ง/ค่าตั้งค่าของหลักสูตรใช้ไม่ได้)
//
// หาค่าเดิมจากบันทึกการใช้งาน (AuditLog.detail เก็บ body ที่ส่งมา) — ครั้งล่าสุดที่บันทึกสำเร็จพร้อม "major"
//   ทั้งนักศึกษาบันทึกเอง (PUT /api/students/me) และเจ้าหน้าที่/อาจารย์แก้ให้ (PUT /api/admin/students/:id)
//   ใช้เฉพาะรหัสที่ยังมีในหลักสูตร (CoopCriteria) · หาไม่เจอ = รายงานให้เจ้าหน้าที่ตั้งเอง
//
// ใช้: node scripts/one-off/restore_wiped_majors.js          ← ดูรายการเฉย ๆ (ไม่แก้อะไร)
//      node scripts/one-off/restore_wiped_majors.js --apply  ← คืนค่าที่หาเจอ
const prisma = require('../../config/prismaClient');

const APPLY = process.argv.includes('--apply');

function majorIn(detail) {
  if (!detail) return undefined;
  try {
    const body = JSON.parse(detail.endsWith('…') ? detail.slice(0, -1) : detail);
    return typeof body.major === 'string' ? body.major.trim() : undefined;
  } catch {
    const m = /"major":"([^"]*)"/.exec(detail);
    return m ? m[1].trim() : undefined;
  }
}

async function main() {
  const codes = new Set((await prisma.coopCriteria.findMany({ select: { major: true } })).map((c) => c.major));
  const students = await prisma.student.findMany({
    where: { deletedAt: null, OR: [{ major: null }, { major: '' }] },
    select: { id: true, userId: true, studentId: true, firstName: true, lastName: true },
    orderBy: { studentId: 'asc' },
  });

  const restore = [];
  const unknown = [];
  for (const s of students) {
    const logs = await prisma.auditLog.findMany({
      where: {
        method: 'PUT',
        statusCode: { lt: 400 },
        detail: { contains: '"major"' },
        OR: [
          ...(s.userId ? [{ userId: s.userId, path: '/api/students/me' }] : []),
          { path: `/api/admin/students/${s.id}` },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { detail: true, createdAt: true, path: true },
      take: 20,
    });
    const hit = logs.map((l) => ({ ...l, major: majorIn(l.detail) })).find((l) => l.major && codes.has(l.major));
    const name = `${s.studentId} ${s.firstName || ''} ${s.lastName || ''}`.trim();
    if (hit) restore.push({ id: s.id, name, major: hit.major, from: `${hit.path} @ ${hit.createdAt.toISOString()}` });
    else unknown.push(name);
  }

  console.log(`นักศึกษาที่หลักสูตรว่าง: ${students.length} คน`);
  console.log(`\nคืนค่าได้จากบันทึกการใช้งาน: ${restore.length} คน`);
  for (const r of restore) console.log(`  ${r.name} → ${r.major}   (${r.from})`);
  console.log(`\nหาค่าเดิมไม่เจอ (ให้เจ้าหน้าที่ตั้งเองที่หน้าข้อมูลนักศึกษา): ${unknown.length} คน`);
  for (const n of unknown) console.log(`  ${n}`);

  if (!APPLY) {
    console.log('\n(ดูอย่างเดียว — ใส่ --apply เพื่อคืนค่า)');
    return;
  }
  for (const r of restore) {
    // คืนเฉพาะที่ยังว่างอยู่ (กันทับค่าที่มีคนตั้งใหม่ระหว่างรันสคริปต์)
    await prisma.student.updateMany({ where: { id: r.id, OR: [{ major: null }, { major: '' }] }, data: { major: r.major } });
  }
  console.log(`\nคืนค่าแล้ว ${restore.length} คน`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
