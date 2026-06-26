import React, { useState, useEffect } from "react";
import axios from "axios";

interface EvalConfig {
    instructionText: string;
    ccEmails: string;
    t005Link: string;
    t006Link: string;
    templateLink: string;
}

interface StudentInfo {
    studentId: string;
    prefix?: string;
    firstName: string;
    lastName: string;
    firstNameEn?: string;
    lastNameEn?: string;
    major?: string;
    coop?: {
        company?: { name: string; contactPerson?: string; phone?: string; address?: string };
        mentor?: { firstName: string; lastName: string; email?: string; position?: string };
        jobPosition?: string;
    };
    advisorName?: string;
}

export default function S_DocT005_006() {
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<EvalConfig | null>(null);
    const [copiedKey, setCopiedKey] = useState<string>("");
    const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);

    const token = localStorage.getItem("coop.token");

    // ค่าเริ่มต้น (Default)
    const defaultConfig: EvalConfig = {
        instructionText: `ขอให้นักศึกษาดำเนินการ ขอความอนุเคราะห์ ประเมินผลการปฏิบัติงาน จากพี่เลี้ยงของนักศึกษา (ก่อนกลับ 1 อาทิตย์)\n\n1) ให้นักศึกษาทำการตรวจสอบ รายชื่อสถานประกอบการ และ ชื่อรายนักศึกษา ในแบบฟอร์ม T005 และ T006 หาก ตกหล่นให้รีบแจ้ง อ.ประจำวิชา\n\n2) ทำการส่งแบบประเมิน ให้กับพี่เลี้ยง โดยให้เขียน Email ทางการ โดยแนบลิงก์แบบประเมิน และเล่มรายงานให้กับทางพี่เลี้ยง\nโดยให้นักศึกษาใช้ Template ในการส่งออกอีเมลถึงพี่เลี้ยง ตามตัวอย่างที่แนบให้ และ CC อีเมลถึง อ. ประจำวิชา\n\nNote: เล่มที่ส่งใน email ควรได้รับการ screen เบื้องต้นจากพี่เลี้ยงแล้ว`,
        ccEmails: "thanaphon@kku.ac.th, chitsutha@kku.ac.th",
        t005Link: "https://kku.world/005",
        t006Link: "https://kku.world/006",
        templateLink: "https://docs.google.com/document/d/1Ln95_1bSDJ8PYAqcg1GTqPTWYBsfxtnh--m0yJMJTRs/edit?usp=sharing"
    };

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [configRes, profileRes] = await Promise.allSettled([
                    axios.get("/api/admin/config/evaluation", { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get("/api/students/me", { headers: { Authorization: `Bearer ${token}` } }),
                ]);
                setConfig(configRes.status === "fulfilled" && configRes.value.data?.config
                    ? configRes.value.data.config : defaultConfig);
                if (profileRes.status === "fulfilled") setStudentInfo(profileRes.value.data);
            } catch {
                setConfig(defaultConfig);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [token]);

    // ฟังก์ชันสำหรับ Copy ข้อความ
    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        // ให้กลับมาเป็นสถานะปกติหลังจาก 2 วินาที
        setTimeout(() => {
            setCopiedKey("");
        }, 2000);
    };

    if (loading || !config) return <div style={{ padding: 40, textAlign: 'center', color: '#0074B7' }}>กำลังโหลดข้อมูล...</div>;

    return (
        <div className="page" style={{ padding: 4, margin: 28 }}>

            <div style={{ marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>📊 แบบประเมินสหกิจศึกษา T005, T006</h2>
                <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>ขั้นตอนการขอความอนุเคราะห์ประเมินผลการปฏิบัติงานจากพี่เลี้ยง</div>
            </div>

            <div className="card" style={{ marginBottom: 24, padding: 30, borderTop: '4px solid #3b82f6' }}>
                <div style={{ display: 'flex', gap: 15, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 32 }}>📢</div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: 18 }}>คำชี้แจงสำหรับนักศึกษา</h3>

                        <div style={{ color: '#334155', fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                            {config.instructionText}
                        </div>

                        <div style={{ marginTop: 20, padding: 15, background: '#fef2f2', borderRadius: 8, border: '1px dashed #fca5a5' }}>
                            <div style={{ fontWeight: 700, color: '#b91c1c', marginBottom: 5 }}>📌 อีเมลอาจารย์ประจำวิชา (สำหรับ CC)</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ color: '#991b1b', fontSize: 14, flex: 1 }}>{config.ccEmails}</div>
                                <button
                                    className={`btn-copy ${copiedKey === 'cc' ? 'copied' : ''}`}
                                    onClick={() => handleCopy(config.ccEmails, 'cc')}
                                >
                                    {copiedKey === 'cc' ? '✅ Copied!' : '📋 Copy'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>

                {/* กล่องลิงก์ T005 */}
                <div className="card link-box">
                    <div className="icon-wrapper bg-green">📝</div>
                    <div className="content">
                        <h4>แบบประเมินผลการปฏิบัติงาน (T005)</h4>
                        <p>แบบประเมินผลการปฏิบัติงานของนักศึกษาสหกิจศึกษา</p>

                        {/* URL + Copy Button */}
                        <div className="url-container">
                            <span className="url-text" title={config.t005Link}>
                                {config.t005Link}
                            </span>
                            <button
                                className={`btn-copy ${copiedKey === 't005' ? 'copied' : ''}`}
                                onClick={() => handleCopy(config.t005Link, 't005')}
                            >
                                {copiedKey === 't005' ? '✅ Copied!' : '📋 Copy'}
                            </button>
                        </div>

                        <button className="btn btn-primary" onClick={() => window.open(config.t005Link, "_blank")}>
                            🔗 เปิดหน้าฟอร์ม T005
                        </button>
                    </div>
                </div>

                {/* กล่องลิงก์ T006 */}
                <div className="card link-box">
                    <div className="icon-wrapper bg-blue">📑</div>
                    <div className="content">
                        <h4>แบบประเมินเอกสารปฏิบัติงาน (T006)</h4>
                        <p>แบบประเมินเอกสารปฏิบัติงานของนักศึกษาสหกิจศึกษา</p>

                        {/* URL + Copy Button */}
                        <div className="url-container">
                            <span className="url-text" title={config.t006Link}>
                                {config.t006Link}
                            </span>
                            <button
                                className={`btn-copy ${copiedKey === 't006' ? 'copied' : ''}`}
                                onClick={() => handleCopy(config.t006Link, 't006')}
                            >
                                {copiedKey === 't006' ? '✅ Copied!' : '📋 Copy'}
                            </button>
                        </div>

                        <button className="btn btn-primary" onClick={() => window.open(config.t006Link, "_blank")}>
                            🔗 เปิดหน้าฟอร์ม T006
                        </button>
                    </div>
                </div>

                {/* กล่องลิงก์ Template */}
                <div className="card link-box">
                    <div className="icon-wrapper bg-yellow">✉️</div>
                    <div className="content">
                        <h4>Template Email ส่งพี่เลี้ยง</h4>
                        <p>ตัวอย่างการเขียนอีเมลทางการเพื่อส่งให้พี่เลี้ยงประเมิน</p>

                        {/* URL + Copy Button */}
                        <div className="url-container">
                            <span className="url-text" title={config.templateLink}>
                                {config.templateLink}
                            </span>
                            <button
                                className={`btn-copy ${copiedKey === 'template' ? 'copied' : ''}`}
                                onClick={() => handleCopy(config.templateLink, 'template')}
                            >
                                {copiedKey === 'template' ? '✅ Copied!' : '📋 Copy'}
                            </button>
                        </div>

                        <button className="btn btn-primary" style={{ background: '#f59e0b' }} onClick={() => window.open(config.templateLink, "_blank")}>
                            🔗 เปิดหน้า Template Email
                        </button>
                    </div>
                </div>

            </div>

            <style>{`
                .card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .link-box { padding: 24px; display: flex; gap: 16px; align-items: flex-start; transition: 0.2s; min-width: 0; flex-wrap: wrap; }
                .link-box:hover { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); transform: translateY(-2px); }
                .icon-wrapper { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
                .bg-green { background: #dcfce7; }
                .bg-blue { background: #dbeafe; }
                .bg-yellow { background: #fef3c7; }

                .content { flex: 1; min-width: 0; width: 100%; overflow: hidden; }
                .content h4 { margin: 0 0 6px 0; color: '#1e293b'; font-size: 16px; }
                .content p { margin: 0 0 12px 0; color: #64748b; font-size: 13px; line-height: 1.5; }
                
                /* ✅ Style สำหรับกล่อง URL แบบใหม่ที่มีปุ่ม Copy */
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
                .btn-copy {
                    background: #e2e8f0;
                    border: none;
                    padding: 6px 10px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 700;
                    color: #334155;
                    transition: 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .btn-copy:hover { background: #cbd5e1; }
                .btn-copy.copied { background: #dcfce7; color: #166534; } /* สีตอนก็อปปี้สำเร็จ */

                .btn { padding: 10px 16px; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-family: inherit; width: 100%; }
                .btn-primary { background: #0074B7; color: white; transition: 0.2s; }
                .btn-primary:hover { opacity: 0.9; }
            `}</style>
        </div>
    );
}