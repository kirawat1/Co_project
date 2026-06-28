import React, { useState, useEffect } from "react";
import axios from "axios";

interface T007Config {
    instructionText: string;
    t007Link: string;
}

export default function S_DocT007() {
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<T007Config | null>(null);
    const [copiedKey, setCopiedKey] = useState<string>("");

    const token = localStorage.getItem("coop.token");

    // ค่าเริ่มต้น (Default)
    const defaultConfig: T007Config = {
        instructionText: `แบบประเมินสถานประกอบการ (T007) ตามฟอร์มที่แนบมานี้\nหลังจาก ที่นักศึกษาได้ปฏิบัติสหกิจศึกษากับที่สถานประกอบการเรียบร้อยแล้ว\nขอให้นักศึกษาทำแบบประเมิน สถานประกอบการ T007 ตามฟอร์มที่ได้แนบมานี้`,
        t007Link: "https://forms.gle/P5aM1vtwCGBYAJyo8?authuser=2",
    };

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await axios.get("/api/admin/config/t007", {
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
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>🏢 แบบประเมินสถานประกอบการ (T007)</h2>
                <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>สำหรับนักศึกษาประเมินสถานประกอบการหลังเสร็จสิ้นการฝึกงาน</div>
            </div>

            <div className="card" style={{ marginBottom: 24, padding: 30, borderTop: '4px solid #8b5cf6' }}>
                <div style={{ display: 'flex', gap: 15, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 32 }}>📢</div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: 18 }}>คำชี้แจงสำหรับนักศึกษา</h3>

                        <div style={{ color: '#334155', fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                            {config.instructionText}
                        </div>
                    </div>
                </div>
            </div>

            {/* กล่องลิงก์ T007 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
                <div className="card link-box">
                    <div className="icon-wrapper bg-purple">🏢</div>
                    <div className="content">
                        <h4>ฟอร์มแบบประเมิน T007</h4>
                        <p>กรุณากรอกข้อมูลตามความเป็นจริงเพื่อเป็นประโยชน์ต่อรุ่นถัดไป</p>

                        <div className="url-container">
                            <span className="url-text" title={config.t007Link}>
                                {config.t007Link}
                            </span>
                            <button
                                className={`btn-copy ${copiedKey === 't007' ? 'copied' : ''}`}
                                onClick={() => handleCopy(config.t007Link, 't007')}
                            >
                                {copiedKey === 't007' ? '✅ Copied!' : '📋 Copy'}
                            </button>
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => window.open(config.t007Link, "_blank")}>
                            🔗 เปิดฟอร์มประเมิน T007
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .link-box { padding: 24px; display: flex; gap: 16px; align-items: flex-start; transition: 0.2s; min-width: 0; flex-wrap: wrap; }
                .link-box:hover { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); transform: translateY(-2px); }
                .icon-wrapper { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }

                .bg-purple { background: #ede9fe; } /* สีม่วงสำหรับ T007 */

                .content { flex: 1; min-width: 0; width: 100%; overflow: hidden; }
                .content h4 { margin: 0 0 6px 0; color: '#1e293b'; font-size: 16px; }
                .content p { margin: 0 0 12px 0; color: #64748b; font-size: 13px; line-height: 1.5; }
                
                .url-container { 
                    background: #f8fafc; 
                    padding: 8px 8px 8px 12px; 
                    border-radius: 8px; 
                    margin-bottom: 12px; 
                    border: 1px solid #e2e8f0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .url-text {
                    color: #475569;
                    font-size: 13px;
                    flex: 1;
                    min-width: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .btn-copy.copied { background: #dcfce7; color: #166534; }
            `}</style>
        </div>
    );
}