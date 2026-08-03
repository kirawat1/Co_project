const prisma = require('../config/prismaClient');

// Scraped from computing.kku.ac.th/people (สายวิชาการ tab)
const FACULTY = [
  "ผศ. ดร.ชิตสุธา สุ่มเล็ก",
  "ผศ. ดร.ณกร วัฒนกิจ",
  "ผศ. ดร.ปวีณา วันชัย",
  "ผศ. ดร.พิพัธน์ เรืองแสง",
  "ผศ. ดร.พุธษดี ศิริแสงตระกูล",
  "ผศ. ดร.มัลลิกา วัฒนะ",
  "ผศ. ดร.วชิราวุธ ธรรมวิเศษ",
  "ผศ. ดร.วรัญญา  วรรณศรี",
  "ผศ. ดร.สาธิต กระเวนกิจ",
  "ผศ. ดร.สายยัญ สายยศ",
  "ผศ. ดร.สิลดา อินทรโสธรฉันท์",
  "ผศ. ดร.สุมณฑา  เกษมวิลาศ",
  "ผศ. ดร.อุราวรรณ  จันทร์เกษ",
  "ผศ. ดร.เพชร อิ่มทองคำ",
  "ผศ. ดร.ไพรสันต์ ผดุงเวียง",
  "ผศ. ดร.ไอศูรย์ กาญจนสุรัตน์",
  "ผศ.บุญทรัพย์ ไวคำ",
  "รศ. ดร.คำรณ สุนัติ",
  "รศ. ดร.งามนิจ อาจอินทร์",
  "รศ. ดร.ชัยพล กีรติกสิกร",
  "รศ. ดร.ชานนท์ เดชสุภา",
  "รศ. ดร.ปัญญาพล หอระตะ",
  "รศ. ดร.วรารัตน์ สงฆ์แป้น",
  "รศ. ดร.สิรภัทร เชี่ยวชาญวัฒนา",
  "รศ. ดร.อุรฉัตร โคแก้ว",
  "อ. ดร.Arfat Ahmad Khan",
  "อ. ดร.จักรกฤษณ์ แก้วโยธา",
  "อ. ดร.ชาติชาย ปุณริบูรณ์",
  "อ. ดร.ญานิกา คงโสรส",
  "อ. ดร.ธีรพงศ์ ปานบุญยืน",
  "อ. ดร.พงษ์ศธร  จันทร์ยอย",
  "อ. ดร.พบพร ด่านวิรุทัย",
  "อ. ดร.ภัคราช มุสิกะวัน",
  "อ. ดร.วันเฉลิม นัดดา",
  "อ. ดร.วาสนา พุฒกลาง",
  "อ. ดร.ศรัณย์ อภิชนตระกูล",
  "อ. ดร.ศักดิ์พจน์ ทองเลี่ยมนาค",
  "อ.ธนพล ตั้งชูพงศ์",
  "อ.เจษฎา ทองก้านเหลือง",
];

function parse(full) {
  const m = full.match(/^((?:ผศ|รศ|ศ|อ)\.\s*(?:ดร\.)?\s*)/);
  if (!m) return null;
  const prefix = m[1].replace(/\s+$/, '');
  const rest = full.slice(m[1].length).trim();
  const parts = rest.split(/\s+/);
  return { prefix, firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

async function main() {
  const parsed = FACULTY.map(parse).filter(Boolean);
  const teachers = await prisma.teacher.findMany({
    select: { id: true, firstName: true, lastName: true, prefix: true },
  });

  let updated = 0, skipped = 0;
  for (const p of parsed) {
    const match = teachers.find(t => t.firstName && t.firstName.trim() === p.firstName.trim());
    if (!match) {
      console.log(`NO MATCH: "${p.firstName} ${p.lastName}" (prefix: ${p.prefix})`);
      skipped++;
      continue;
    }
    await prisma.teacher.update({ where: { id: match.id }, data: { prefix: p.prefix } });
    console.log(`UPDATED: id=${match.id} "${match.firstName} ${match.lastName}" → prefix="${p.prefix}"`);
    updated++;
  }
  console.log(`\nDone: ${updated} updated, ${skipped} no-match`);
}

main()
  .catch(e => console.error(e.message))
  .finally(() => prisma.$disconnect());
