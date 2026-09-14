// พี่เลี้ยง (พนักงานที่ปรึกษา) ในแบบฟอร์ม T002 ข้อ 3
// คนแรกเก็บในช่อง supervisorName/... ของ CoopT002Form ส่วนคนที่ 2 เป็นต้นไปเก็บเป็น JSON ใน extraSupervisors
// ตอนนักศึกษาอัปโหลดไฟล์ T002 จะสร้าง/ผูกพี่เลี้ยงเหล่านี้เป็นพี่เลี้ยงของบริษัทและของนักศึกษา
// (ไม่ทำตอนบันทึกอัตโนมัติ เพราะฟอร์มบันทึกทุกครั้งที่พิมพ์ จะได้ชื่อที่พิมพ์ไม่ครบเป็นพี่เลี้ยงหลายคน)

const SUPERVISOR_FIELDS = ['name', 'position', 'dept', 'phone', 'fax', 'email'];
const MAX_EXTRA_SUPERVISORS = 4; // รวมคนแรกได้ไม่เกิน 5 คน — PDF T002 วางได้ไม่เกินนี้
const MAX_FIELD_LENGTH = 200;

const cleanText = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_FIELD_LENGTH) : '');

/** แถวพี่เลี้ยงเพิ่มเติมจาก client → เก็บเฉพาะฟิลด์ที่รู้จัก (แถวว่างเก็บไว้ได้ เพราะนักศึกษากดเพิ่มแถวแล้วอาจยังไม่ได้กรอก) */
function normalizeExtraSupervisors(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
    .slice(0, MAX_EXTRA_SUPERVISORS)
    .map((row) => Object.fromEntries(SUPERVISOR_FIELDS.map((f) => [f, cleanText(row[f])])));
}

function parseExtraSupervisors(stored) {
  if (!stored) return [];
  try {
    return normalizeExtraSupervisors(JSON.parse(stored));
  } catch {
    return [];
  }
}

// คำนำหน้าไทยมักติดกับชื่อ ("คุณสมชาย") — ตัดเฉพาะเมื่อตัวถัดไปเป็นพยัญชนะ/สระหน้า ไม่ใช่สระตาม
// กันชื่อจริงที่ขึ้นต้นด้วยคำนำหน้าเหมือนกัน เช่น "คุณากร", "นายิกา"
const THAI_PREFIX = /^(คุณ|นางสาว|นาง|นาย|ดร\.)\s*(?=[ก-ฮเ-ไ])/;
// อังกฤษตัดเฉพาะเมื่อมีจุดหรือเว้นวรรคตามหลัง กันชื่อ "Missy"
const ENGLISH_PREFIX = /^(mrs|mr|ms|miss|dr)(\.\s*|\s+)/i;

/** "คุณสมชาย ดูแลดี" → { firstName: "สมชาย", lastName: "ดูแลดี" } (ช่องชื่อ-สกุลในฟอร์มเป็นช่องเดียว แต่ Mentor แยก) */
function splitMentorName(fullName) {
  const cleaned = String(fullName ?? '').trim().replace(/\s+/g, ' ')
    .replace(THAI_PREFIX, '').replace(ENGLISH_PREFIX, '').trim();
  if (!cleaned) return { firstName: '', lastName: '' };
  const [firstName, ...rest] = cleaned.split(' ');
  return { firstName, lastName: rest.join(' ') };
}

const nameKey = (firstName, lastName) =>
  `${firstName || ''} ${lastName || ''}`.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * สร้าง/ผูกพี่เลี้ยงจากแบบฟอร์ม T002 ของนักศึกษา
 * - ชื่อตรงกับพี่เลี้ยงเดิมในบริษัท → ใช้คนเดิม เติมเฉพาะช่องที่ยังว่าง (ไม่ทับข้อมูลที่มีอยู่)
 * - ไม่มี → สร้างใหม่ในบริษัทนั้น
 * - ผูกกับนักศึกษาแบบเพิ่มเข้าไป (ไม่ลบพี่เลี้ยงที่เลือกไว้ในหน้าข้อมูลนักศึกษา)
 * @param tx prisma transaction client
 */
async function syncT002SupervisorsToMentors(tx, { studentId, userId }) {
  const result = { linked: 0, created: 0, updated: 0 };
  const form = await tx.coopT002Form.findUnique({ where: { studentId } });
  if (!form) return result;

  const supervisors = [
    { name: form.supervisorName, position: form.supervisorPosition, dept: form.supervisorDept, phone: form.supervisorPhone, email: form.supervisorEmail },
    ...parseExtraSupervisors(form.extraSupervisors),
  ].filter((s) => cleanText(s.name));
  if (supervisors.length === 0) return result;

  const coop = await tx.studentCoop.findUnique({ where: { studentId }, select: { companyId: true } });
  if (!coop?.companyId) return { ...result, skipped: 'no-company' };

  const existing = await tx.mentor.findMany({ where: { companyId: coop.companyId } });
  const byName = new Map(existing.map((m) => [nameKey(m.firstName, m.lastName), m]));
  const mentorIds = [];

  for (const s of supervisors) {
    const { firstName, lastName } = splitMentorName(s.name);
    if (!firstName) continue;
    const details = {
      position: cleanText(s.position), department: cleanText(s.dept),
      phone: cleanText(s.phone), email: cleanText(s.email),
    };
    const key = nameKey(firstName, lastName);
    let mentor = byName.get(key);

    if (mentor) {
      const fill = Object.fromEntries(Object.entries(details).filter(([field, value]) => value && !mentor[field]));
      if (Object.keys(fill).length > 0) {
        mentor = { ...mentor, ...(await tx.mentor.update({ where: { id: mentor.id }, data: fill })) };
        byName.set(key, mentor);
        result.updated += 1;
      }
    } else {
      mentor = await tx.mentor.create({
        data: {
          firstName, lastName,
          position: details.position || null, department: details.department || null,
          phone: details.phone || null, email: details.email || null,
          companyId: coop.companyId, createdById: userId,
        },
      });
      byName.set(key, mentor);
      result.created += 1;
    }
    if (!mentorIds.includes(mentor.id)) mentorIds.push(mentor.id);
  }

  if (mentorIds.length > 0) {
    await tx.studentCoop.update({
      where: { studentId },
      data: { mentors: { connect: mentorIds.map((id) => ({ id })) } },
    });
  }
  result.linked = mentorIds.length;
  return result;
}

module.exports = {
  MAX_EXTRA_SUPERVISORS,
  normalizeExtraSupervisors,
  parseExtraSupervisors,
  splitMentorName,
  syncT002SupervisorsToMentors,
};
