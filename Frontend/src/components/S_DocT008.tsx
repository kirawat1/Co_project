import React, { useState, useEffect } from "react";
import axios from "axios";

interface T008Config {
    instructionText: string;
    driveLink: string;
    imagePath: string | null;
}

export default function S_DocT008() {
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<T008Config | null>(null);
    const [copiedKey, setCopiedKey] = useState<string>("");

    const token = localStorage.getItem("coop.token");

    // ค่าเริ่มต้นที่คุณให้มา
    const defaultText = `การส่งเล่มรายงาน และ การดำเนินการก่อน/ หลังสอบ สหกิจศึกษา
1) หลังจากเสร็จสิ้นการปฏิบัติสหกิจศึกษากับที่สถานประกอบการ   
ขอให้นักศึกษา ดำเนินการรายงานตัวกลับ กับอาจารย์ที่ปรึกษา (ภายใน 1 อาทิตย์หลังปฏิบัติสหกิจ เสร็จสิ้น)
2) ทำการแก้ไขเล่มรายงาน ตามคำแนะนำของอาจารย์ที่ปรึกษา 
3) ส่งไฟล์ เล่มรายงานสหกิจ
   3.1) ให้นักศึกษาส่งเล่มรายงานในโฟล์เดอร์ของห้องสอบของนักศึกษา ตาม Google Drive ที่แนบมานี้
   3.2) โดยการตั้งชื่อไฟล์  <ชื่อ>_<นามสกุล>_<รหัสนักศึกษา>
4) พิมพ์เล่มรายงานสหกิจ มาด้วย 1  ฉบับ   เพื่อให้กรรมการให้ comment เพิ่มเติมในวันขึ้นสอบ 
4.5) [OPTION] ส่งจดหมายทางการ  โดยแนบไฟล์นำเสนอ และเล่มสหกิจ ให้กับคณะกรรมการประจำห้องสอบของนักศึกษาก่อนวันขึ้นสอบ 
5) ระหว่างการสอบ ให้นักศึกษาจดบันทึกคำแนะนำ จากคณะกรรมการสอบ จัดทำบันทึกการสอบ และตารางบันทึกการปรับแก้ไขเล่มรายงาน 
6) ทำการปรับแก้ไขเล่มรายงาน ตามที่คณะกรรมการสอบ แจ้งในห้องสอบ โดย ให้อาจารย์ ที่ปรึกษาตรวจสอบ และลงนามใน แบบฟอร์มการตรวจเล่มรายงานก่อนส่งให้คณะกรรมการประจำห้องสอบท่านอื่น ๆ (แบบฟอร์มตรวจสอบเล่มรายงานให้ ลงชื่อคณะกรรมการสอบมาให้เรียบร้อย)
7) ส่งออกจดหมายทางการ แนบเล่มที่ปรับแก้ไขแล้ว และตารางบันทึกการปรับแก้ มาพร้อมกับจดหมาย เพื่อขอการลงนามจาก คณะกรรมการสอบ ภายใน 1 สัปดาห์หลังการสอบ
8) ดำเนินการส่งเล่มที่แก้ไขแล้ว และ แบบฟอร์มการตรวจเล่มรายงาน ในกล่องส่งที่ อ. เปิดให้ (ไม่ใช่กล่องส่งนี้)
9) รอเกรดออก 
10) ทำเรื่องยื่นสำเร็จการศึกษา`;

    const defaultConfig: T008Config = {
        instructionText: defaultText,
        driveLink: "",
        imagePath: null
    };

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await axios.get("/api/admin/config/t008", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data?.config) {
                    setConfig(res.data.config);
                } else {
                    setConfig(defaultConfig);
                }
            } catch (err) {
                console.warn("ไม่สามารถดึงข้อมูลได้ ใช้ค่าเริ่มต้นแทน");
                setConfig(defaultConfig);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, [token]);

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(""), 2000);
    };

    if (loading || !config) return <div style={{ padding: 40, textAlign: 'center', color: '#0074B7' }}>กำลังโหลดข้อมูล...</div>;

    return (
        <div className="page" style={{ padding: 4, margin: 28 }}>

            <div style={{ marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>📚 การอัพโหลดเล่มรายงานสหกิจ (T008)</h2>
                <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>ขั้นตอนการส่งเล่มรายงาน และการดำเนินการก่อน-หลังสอบ</div>
            </div>

            <div className="card" style={{ marginBottom: 24, padding: 30, borderTop: '4px solid #f59e0b' }}>
                <div style={{ display: 'flex', gap: 15, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 32 }}>📋</div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: 18 }}>คำชี้แจง / ขั้นตอนปฏิบัติ</h3>

                        <div style={{ color: '#334155', fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                            {config.instructionText}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>

                {/* ลิงก์ Drive */}
                <div className="card link-box" style={{ background: '#fefce8' }}>
                    <div className="icon-wrapper" style={{ background: '#fde047', color: '#854d0e' }}>📂</div>
                    <div className="content">
                        <h4>โฟลเดอร์ Google Drive (สำหรับส่งเล่มรายงาน)</h4>
                        <p style={{ color: '#a16207' }}>กรุณาส่งเล่มรายงานในโฟลเดอร์ของห้องสอบของนักศึกษา และตั้งชื่อไฟล์ตามรูปแบบที่กำหนด</p>

                        <div className="url-container" style={{ background: 'white', borderColor: '#fef08a' }}>
                            <span className="url-text" title={config.driveLink || 'ยังไม่กำหนดลิงก์'}>
                                {config.driveLink || "ยังไม่มีลิงก์ (กรุณารออาจารย์อัปเดต)"}
                            </span>
                            {config.driveLink && (
                                <button className={`btn-copy ${copiedKey === 'drive' ? 'copied' : ''}`} onClick={() => handleCopy(config.driveLink, 'drive')}>
                                    {copiedKey === 'drive' ? '✅ Copied!' : '📋 Copy'}
                                </button>
                            )}
                        </div>

                        {config.driveLink && (
                            <button className="btn btn-primary" style={{ background: '#ca8a04', maxWidth: '300px' }} onClick={() => window.open(config.driveLink, "_blank")}>
                                🔗 ไปยัง Google Drive
                            </button>
                        )}
                    </div>
                </div>

                {/* แสดงรูปภาพ (ถ้ามี) */}
                {config.imagePath && (
                    <div className="card" style={{ padding: 30 }}>
                        <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: 18 }}>🖼️ รูปภาพประกอบ</h3>
                        <div style={{ textAlign: 'center', background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px dashed #cbd5e1' }}>
                            <img
                                src={`/uploads/system/${config.imagePath}`}
                                alt="คู่มือหรือภาพประกอบ"
                                style={{ maxWidth: '100%', maxHeight: '600px', borderRadius: 8, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .link-box { padding: 24px; display: flex; gap: 16px; align-items: flex-start; transition: 0.2s; min-width: 0; flex-wrap: wrap; }
                .icon-wrapper { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
                .content { flex: 1; min-width: 0; width: 100%; overflow: hidden; }
                .content h4 { margin: 0 0 6px 0; color: '#1e293b'; font-size: 16px; }
                .content p { margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; }
                .url-container { padding: 8px 8px 8px 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 10px; }
                .url-text { color: #475569; font-size: 13px; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .btn-copy { background: #e2e8f0; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 700; color: #334155; transition: 0.2s; }
                .btn-copy:hover { background: #cbd5e1; }
                .btn-copy.copied { background: #dcfce7; color: #166534; }
                .btn { padding: 10px 16px; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-family: inherit; width: 100%; transition: 0.2s; }
                .btn:hover { opacity: 0.9; }
            `}</style>
        </div>
    );
}