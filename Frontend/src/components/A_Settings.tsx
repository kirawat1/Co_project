export default function A_Settings(){
  function clearAdmin(){ if(!confirm("ลบข้อมูลแอดมินทั้งหมดจากเครื่องนี้?")) return; ["coop.admin.students","coop.admin.mentors","coop.shared.announcements"].forEach(k=>localStorage.removeItem(k)); alert("ลบข้อมูลแล้ว"); }
  function clearMentorLocal(){ if(!confirm("ลบข้อมูลพี่เลี้ยง (เฉพาะอุปกรณ์นี้)?")) return; const keys = Object.keys(localStorage).filter(k=>k.startsWith("coop.mentor.")); keys.forEach(k=>localStorage.removeItem(k)); alert("ลบข้อมูลแล้ว"); }
  function clearStudentDaily(){ if(!confirm("ลบประวัติบันทึกประจำวันของนักศึกษา (เฉพาะอุปกรณ์นี้)?")) return; localStorage.removeItem("coop.daily"); alert("ลบข้อมูลแล้ว"); }

  return (
    <div className="page" style={{ padding: 4, margin: 28, marginLeft: 65 }}>
      <section className="card" style={{ padding: 24, marginBottom: 28 }}>
        <h2 style={{ marginTop: 8, marginLeft: 18 }}>ตั้งค่า</h2>
        <div style={{display:"grid", gridTemplateColumns:"repeat(2, minmax(240px,1fr))", gap:12}}>
          <button className="btn" type="button" onClick={clearAdmin}>ลบข้อมูลแอดมินทั้งหมด</button>
          <button className="btn" type="button" onClick={clearMentorLocal}>ลบข้อมูลฝั่งพี่เลี้ยง (local)</button>
          <button className="btn" type="button" onClick={clearStudentDaily}>ลบประวัติบันทึก (นักศึกษา)</button>
        </div>
      </section>
      <style>{`@media (max-width:1024px){ div[style*='grid-template-columns:repeat(2']{ grid-template-columns:1fr !important } }`}</style>
    </div>
  );
}
