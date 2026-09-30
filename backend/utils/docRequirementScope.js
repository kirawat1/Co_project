// หัวข้อเอกสาร T000 แยกตามหลักสูตร (แยกหลักสูตร Phase 3)
//   majors (excluded=false)          ว่าง = หัวข้อกลาง (ทุกหลักสูตร) · มีค่า = ใช้เฉพาะหลักสูตรเหล่านี้
//   excludedMajors (excluded=true)   หลักสูตรที่ปิดหัวข้อกลางนี้ (มีความหมายเฉพาะหัวข้อกลาง)
const RULES_INCLUDE = { majorRules: { select: { major: true, excluded: true } } };

function withRules(r) {
  const rules = r.majorRules || [];
  const { majorRules, ...rest } = r;
  return {
    ...rest,
    majors: rules.filter((x) => !x.excluded).map((x) => x.major).sort(),
    excludedMajors: rules.filter((x) => x.excluded).map((x) => x.major).sort(),
  };
}

const isShared = (r) => r.majors.length === 0;

// หัวข้อนี้ใช้กับนักศึกษาหลักสูตรนี้ไหม (นักศึกษาที่ยังไม่มีหลักสูตรได้เฉพาะหัวข้อกลาง)
function appliesTo(r, major) {
  if (!isShared(r)) return !!major && r.majors.includes(major);
  return !major || !r.excludedMajors.includes(major);
}

module.exports = { RULES_INCLUDE, withRules, isShared, appliesTo };
