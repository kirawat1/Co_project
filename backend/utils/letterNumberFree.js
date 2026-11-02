// เลขที่หนังสือราชการใช้ชุดเดียวกันทุกประเภท — ขอความอนุเคราะห์ / ส่งตัว / ขอนิเทศ ไล่เลขต่อกัน (หนังสือจริง 811 → 893 → 1215)
// เดิมตรวจซ้ำเฉพาะประเภทเดียวกัน: เลขของหนังสือขอความอนุเคราะห์ใส่เป็นหนังสือส่งตัวของอีกคนได้
//   ประเภทเดียวกัน → ห้ามซ้ำกับคนนอกฉบับ (หนังสือรวมใช้เลขเดียวกันได้ · พิมพ์ซ้ำคนเดิมใช้เลขเดิมได้)
//   ต่างประเภท     → ห้ามซ้ำเลย แม้เป็นนักศึกษาคนเดียวกัน
// เทียบทั้งเลขที่ออกแล้วและเลขในร่างที่รอลงนาม
const { lockDocNumber } = require('./docNumberLock');

const LETTER_NUMBERS = {
  reqLetter: { model: 'studentCoop', idField: 'studentId', number: 'reqDocNumber', draft: 'reqLetterDraftNumber', name: 'หนังสือขอความอนุเคราะห์' },
  placeLetter: { model: 'studentCoop', idField: 'studentId', number: 'placeDocNumber', draft: 'placeLetterDraftNumber', name: 'หนังสือส่งตัว' },
  supervisionLetter: { model: 'supervisionAppointment', idField: 'id', number: 'letterDocNumber', draft: 'letterDraftNumber', name: 'หนังสือขอนิเทศ' },
};

/**
 * kind = ประเภทของหนังสือที่กำลังออก · ownIds = studentId (หนังสือของนักศึกษา) หรือ id นัดนิเทศ ที่อยู่ในฉบับนี้
 * ซ้ำ → throw { is409 } พร้อมข้อความบอกว่าชนกับหนังสืออะไรของใคร
 * ต้องเรียกใน transaction DOC_NUMBER_TX — ล็อกเลขที่คิวเดียวทุกประเภท กันสองคนออกเลขเดียวกันพร้อมกันคนละประเภท
 */
async function assertLetterNumberFree(tx, kind, value, ownIds) {
  if (!value) return;
  await lockDocNumber(tx, 'letter', value);
  const ids = [].concat(ownIds);
  // ประเภทเดียวกันก่อน (ข้อความแบบเดิม) แล้วค่อยประเภทอื่น
  const kinds = [kind, ...Object.keys(LETTER_NUMBERS).filter((k) => k !== kind)];
  for (const k of kinds) {
    const f = LETTER_NUMBERS[k];
    const same = k === kind;
    const clash = await tx[f.model].findFirst({
      where: { OR: [{ [f.number]: value }, { [f.draft]: value }], ...(same ? { [f.idField]: { notIn: ids } } : {}) },
      select: { [f.number]: true, [f.draft]: true, student: { select: { studentId: true, firstName: true, lastName: true } } },
    });
    if (!clash) continue;
    const who = clash.student
      ? `${clash.student.studentId} ${clash.student.firstName} ${clash.student.lastName}`
      : 'นักศึกษารายอื่น';
    const own = LETTER_NUMBERS[kind].name;
    const message = clash[f.number] === value
      ? (same
        ? `เลขที่${own} "${value}" ถูกใช้กับ ${who} แล้ว`
        : `เลขที่ "${value}" ถูกใช้เป็น${f.name}ของ ${who} แล้ว — หนังสือทุกประเภทใช้เลขชุดเดียวกัน กรุณาใช้เลขถัดไป`)
      : `เลขที่${same ? own : ''} "${value}" อยู่ในร่าง${f.name}ที่รอลงนามของ ${who} — ถ้าไม่ใช้ร่างนั้นแล้ว ให้กด "ยกเลิกรอลงนาม" ของคนนั้นก่อน`;
    throw Object.assign(new Error(message), { is409: true });
  }
}

module.exports = { assertLetterNumberFree, LETTER_NUMBERS };
