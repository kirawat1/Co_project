/**
 * seed_teachers.js — อาจารย์วิทยาลัยการคอมพิวเตอร์ มข.
 * ข้อมูลจากรูปภาพ computing.kku.ac.th/people (42 คน)
 *
 * รันด้วย: node backend/scripts/seed_teachers.js
 * รหัสผ่านเริ่มต้น = 1111111111111
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

const TEACHERS = [
  // ──────── ศาสตราจารย์ (ศ.ดร.) ────────
  { prefix: "ศ.ดร.",  firstName: "ศาสตรา",    lastName: "วงศ์ธนวสุ",            email: "wongsar@kku.ac.th",     major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "ศ.ดร.",  firstName: "จักรชัย",    lastName: "โสอินทร์",             email: "chakso@kku.ac.th",      major: "วิทยาการคอมพิวเตอร์" },

  // ──────── รองศาสตราจารย์ (รศ.ดร.) ────────
  { prefix: "รศ.ดร.", firstName: "สิรภัทร",   lastName: "เชี่ยวชาญวัฒนา",       email: "sunkra@kku.ac.th",      major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "รศ.ดร.", firstName: "ชานนท์",     lastName: "เดชสุภา",              email: "chanode@kku.ac.th",     major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "รศ.ดร.", firstName: "ปัญญาพล",   lastName: "หอระตะ",               email: "punhor1@kku.ac.th",     major: "วิทยาการข้อมูลและปัญญาประดิษฐ์" },
  { prefix: "รศ.ดร.", firstName: "คำรณ",       lastName: "สุนัติ",               email: "skhamron@kku.ac.th",    major: "วิทยาการข้อมูลและปัญญาประดิษฐ์" },
  { prefix: "รศ.ดร.", firstName: "งามนิจ",     lastName: "อาจอินทร์",            email: "ngamnij@kku.ac.th",     major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "รศ.ดร.", firstName: "อุรฉัตร",    lastName: "โคแก้ว",               email: "urachart@kku.ac.th",    major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "รศ.ดร.", firstName: "ชัยพล",      lastName: "กีรติกสิกร",           email: "chaiyapon@kku.ac.th",   major: "ภูมิสารสนเทศศาสตร์" },
  { prefix: "รศ.ดร.", firstName: "วรารัตน์",   lastName: "สงฆ์แป้น",             email: "wararat@kku.ac.th",     major: "เทคโนโลยีสารสนเทศ" },

  // ──────── ผู้ช่วยศาสตราจารย์ (ผศ.ดร.) ────────
  { prefix: "ผศ.ดร.", firstName: "ณกร",        lastName: "วัฒนกิจ",              email: "nagon@kku.ac.th",       major: "ภูมิสารสนเทศศาสตร์" },
  { prefix: "ผศ.ดร.", firstName: "สาธิต",       lastName: "กระเวนกิจ",            email: "satikr@kku.ac.th",      major: "ความมั่นคงปลอดภัยไซเบอร์" },
  { prefix: "ผศ.ดร.", firstName: "ไอศูรย์",    lastName: "กาญจนสุรัตน์",         email: "isoonkan@kku.ac.th",    major: "ความมั่นคงปลอดภัยไซเบอร์" },
  { prefix: "ผศ.ดร.", firstName: "พุธษดี",      lastName: "ศิริแสงตระกูล",        email: "pusadee@kku.ac.th",     major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "ผศ.ดร.", firstName: "พิพัธน์",     lastName: "เรืองแสง",             email: "reungsang@kku.ac.th",   major: "ภูมิสารสนเทศศาสตร์" },
  { prefix: "ผศ.ดร.", firstName: "วชิราวุธ",   lastName: "ธรรมวิเศษ",            email: "twachi@kku.ac.th",      major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "ผศ.ดร.", firstName: "อุราวรรณ",   lastName: "จันทร์เกษ",            email: "curawa@kku.ac.th",      major: "ภูมิสารสนเทศศาสตร์" },
  { prefix: "ผศ.ดร.", firstName: "สุมณฑา",     lastName: "เกษมวิลาศ",            email: "sumkas@kku.ac.th",      major: "เทคโนโลยีสารสนเทศ" },
  { prefix: "ผศ.ดร.", firstName: "สายยัญ",     lastName: "สายยศ",                email: "saiyan@kku.ac.th",      major: "เทคโนโลยีสารสนเทศ" },
  { prefix: "ผศ.ดร.", firstName: "ปวีณา",       lastName: "วันชัย",               email: "wpaweena@kku.ac.th",    major: "เทคโนโลยีสารสนเทศ" },
  { prefix: "ผศ.ดร.", firstName: "ไพรสันต์",   lastName: "ผดุงเวียง",            email: "praipa@kku.ac.th",      major: "ปัญญาประดิษฐ์" },
  { prefix: "ผศ.ดร.", firstName: "สิลดา",       lastName: "อินทรโสธรฉันท์",       email: "silain@kku.ac.th",      major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "ผศ.ดร.", firstName: "ชิตสุธา",    lastName: "สุ่มเล็ก",             email: "chitsutha@kku.ac.th",   major: "วิทยาการข้อมูลและปัญญาประดิษฐ์" },
  { prefix: "ผศ.ดร.", firstName: "มัลลิกา",    lastName: "วัฒนะ",                email: "monlwa@kku.ac.th",      major: "เทคโนโลยีสารสนเทศ" },
  { prefix: "ผศ.ดร.", firstName: "วรัญญา",     lastName: "วรรณศรี",              email: "waruwu@kku.ac.th",      major: "เทคโนโลยีสารสนเทศ" },
  { prefix: "ผศ.ดร.", firstName: "เพชร",        lastName: "อิ่มทองคำ",            email: "phetim@kku.ac.th",      major: "ความมั่นคงปลอดภัยไซเบอร์" },

  // ──────── ผู้ช่วยศาสตราจารย์ (ไม่มีปริญญาเอก) ────────
  { prefix: "ผศ.",    firstName: "บุญทรัพย์",   lastName: "ไวคำ",                 email: "boonsup@kku.ac.th",     major: "วิทยาการคอมพิวเตอร์" },

  // ──────── อาจารย์ / ดร. (อ.ดร.) ────────
  { prefix: "อ.ดร.",  firstName: "ศรัณย์",       lastName: "อภิชนตระกูล",          email: "sarunap@kku.ac.th",     major: "ภูมิสารสนเทศศาสตร์" },
  { prefix: "อ.ดร.",  firstName: "ศักดิ์พจน์",   lastName: "ทองเลี่ยมนาค",         email: "sakpod@kku.ac.th",      major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "อ.ดร.",  firstName: "พบพร",          lastName: "ด่านวิรุทัย",          email: "pobda@kku.ac.th",       major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "อ.ดร.",  firstName: "ภัคราช",        lastName: "มุสิกะวัน",            email: "pakamu@kku.ac.th",      major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "อ.ดร.",  firstName: "พงษ์ศธร",      lastName: "จันทร์ยอย",            email: "pongsathon@kku.ac.th",  major: "ความมั่นคงปลอดภัยไซเบอร์" },
  { prefix: "อ.ดร.",  firstName: "ณัฐพล",         lastName: "เจริญชัย",             email: "nattjar@kku.ac.th",     major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "อ.ดร.",  firstName: "ญานิกา",        lastName: "คงโสรส",               email: "yaniko@kku.ac.th",      major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "อ.ดร.",  firstName: "จักรกฤษณ์",    lastName: "แก้วโยธา",             email: "jakkritk@kku.ac.th",    major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "อ.ดร.",  firstName: "ชาติชาย",       lastName: "ปุณริบูรณ์",           email: "chatpu@kku.ac.th",      major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "อ.ดร.",  firstName: "Arfat Ahmad",   lastName: "Khan",                 email: "arfatkhan@kku.ac.th",   major: "ปัญญาประดิษฐ์" },
  { prefix: "อ.ดร.",  firstName: "วันเฉลิม",      lastName: "นัดดา",                email: "wannad@kku.ac.th",      major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "อ.ดร.",  firstName: "ธีรพงศ์",       lastName: "ปานบุญยืน",            email: "teerpa@kku.ac.th",      major: "ปัญญาประดิษฐ์" },
  { prefix: "อ.ดร.",  firstName: "วาสนา",          lastName: "พุฒกลาง",              email: "putklang_w@kku.ac.th",  major: "วิทยาการคอมพิวเตอร์" },

  // ──────── อาจารย์ (ไม่มีปริญญาเอก) ────────
  { prefix: "อ.",     firstName: "ธนพล",          lastName: "ตั้งชูพงศ์",            email: "thanaphon@kku.ac.th",   major: "วิทยาการคอมพิวเตอร์" },
  { prefix: "อ.",     firstName: "เจษฎา",          lastName: "ทองก้านเหลือง",         email: "jedtho@kku.ac.th",      major: "ความมั่นคงปลอดภัยไซเบอร์" },
];

const DEFAULT_PASSWORD = "1111111111111";
const FACULTY = "วิทยาลัยการคอมพิวเตอร์";

async function main() {
  console.log("🗑️  ลบอาจารย์เดิมทั้งหมดออกก่อน...\n");

  // ลบ Teacher ทั้งหมดก่อน แล้วลบ User ที่มี role=teacher
  const allTeachers = await prisma.teacher.findMany({ select: { userId: true } });
  for (const t of allTeachers) {
    try {
      await prisma.user.delete({ where: { id: t.userId } });
    } catch (e) { /* ignore */ }
  }
  console.log(`  ✅ ลบอาจารย์เดิม ${allTeachers.length} คนเรียบร้อย\n`);

  console.log("🚀 เพิ่มอาจารย์ใหม่ตามข้อมูลจริง...\n");
  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  let created = 0, skipped = 0, errors = 0;

  for (const t of TEACHERS) {
    const email = t.email.toLowerCase().trim();
    try {
      const exists = await prisma.user.findFirst({
        where: { OR: [{ username: email }, { email }] },
      });
      if (exists) {
        // อัปเดตชื่อที่ถูกต้องให้ Teacher ที่มีอยู่แล้ว
        const teacher = await prisma.teacher.findUnique({ where: { userId: exists.id } });
        if (teacher) {
          await prisma.teacher.update({
            where: { id: teacher.id },
            data: { firstName: t.firstName, lastName: t.lastName, major: t.major || null },
          });
          console.log(`  🔄 อัปเดต: ${t.prefix} ${t.firstName} ${t.lastName} (${email})`);
        } else {
          console.log(`  ⏭  ข้าม: ${t.prefix} ${t.firstName} ${t.lastName} — User มีแต่ไม่มี Teacher`);
        }
        skipped++; continue;
      }

      const user = await prisma.user.create({
        data: { username: email, email, password: hashed, role: "teacher" },
      });
      await prisma.teacher.create({
        data: {
          userId: user.id,
          firstName: t.firstName,
          lastName: t.lastName,
          email,
          phone: null,
          faculty: FACULTY,
          major: t.major || null,
        },
      });
      console.log(`  ✅ สร้าง: ${t.prefix} ${t.firstName} ${t.lastName} (${email})`);
      created++;
    } catch (err) {
      console.error(`  ❌ ผิดพลาด: ${t.firstName} ${t.lastName} — ${err.message}`);
      errors++;
    }
  }

  console.log("\n─────────────────────────────────────────");
  console.log(`✔ สร้างใหม่ ${created} คน | ข้าม ${skipped} คน | ผิดพลาด ${errors} คน`);
  console.log(`📌 รหัสผ่านเริ่มต้นทุกคน: ${DEFAULT_PASSWORD}`);
  console.log("─────────────────────────────────────────");
}

main()
  .catch((e) => { console.error("❌ Fatal:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
