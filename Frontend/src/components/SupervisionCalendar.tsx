import React, { useState, useMemo } from "react";
import type { CSSProperties } from "react";

export interface CalendarEvent {
    id: number;
    confirmedDate: string; // ISO datetime
    studentName: string;
    studentId?: string;
    type: "ONLINE" | "ONSITE";
    status?: string;
}

interface Props {
    events: CalendarEvent[];
    title?: string;
}

const DAYS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTHS_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
                   "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

function fmtTime(iso: string) {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")} น.`;
}
function fmtDate(iso: string) {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}

export default function SupervisionCalendar({ events, title = "📅 ปฏิทินนิเทศสหกิจ" }: Props) {
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11
    const [selectedDay, setSelectedDay] = useState<string | null>(null); // "YYYY-MM-DD"

    // map eventsByDay: "YYYY-MM-DD" → CalendarEvent[]
    const eventsByDay = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        events.forEach(ev => {
            if (!ev.confirmedDate) return;
            const d = new Date(ev.confirmedDate);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(ev);
        });
        return map;
    }, [events]);

    // สร้าง grid วันในเดือน
    const calendarDays = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sunday
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const cells: (number | null)[] = Array(firstDay).fill(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        // pad to complete last row
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }, [viewYear, viewMonth]);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
        else setViewMonth(m => m - 1);
        setSelectedDay(null);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
        else setViewMonth(m => m + 1);
        setSelectedDay(null);
    };

    const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

    const selectedEvents = selectedDay ? (eventsByDay.get(selectedDay) ?? []) : [];

    return (
        <div style={calendarWrap}>
            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ fontWeight:800, fontSize:16, color:"#1e293b" }}>{title}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <button style={navBtn} onClick={prevMonth}>‹</button>
                    <span style={{ fontWeight:700, fontSize:15, minWidth:160, textAlign:"center" }}>
                        {MONTHS_TH[viewMonth]} {viewYear + 543}
                    </span>
                    <button style={navBtn} onClick={nextMonth}>›</button>
                    <button style={{ ...navBtn, fontSize:11, padding:"4px 8px" }}
                        onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDay(null); }}>
                        วันนี้
                    </button>
                </div>
            </div>

            {/* Day headers */}
            <div style={gridStyle}>
                {DAYS_TH.map(d => (
                    <div key={d} style={dayHeader}>{d}</div>
                ))}

                {/* Day cells */}
                {calendarDays.map((day, idx) => {
                    if (!day) return <div key={`e-${idx}`} />;
                    const key = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                    const dayEvents = eventsByDay.get(key) ?? [];
                    const isToday = key === todayKey;
                    const isSelected = key === selectedDay;
                    const hasEvents = dayEvents.length > 0;

                    // กำหนดสีขอบตาม priority: selected > today+events > today > events > ปกติ
                    let bg = "#fff";
                    let border = "1px solid #f1f5f9";
                    let numColor = "#334155";
                    let numWeight: number | string = 600;

                    if (isSelected) {
                        bg = "#e0f2fe"; border = "2px solid #0ea5e9";
                    } else if (isToday && hasEvents) {
                        bg = "#fef3c7"; border = "2px solid #f59e0b";
                        numColor = "#92400e"; numWeight = 800;
                    } else if (isToday) {
                        bg = "#fef9c3"; border = "2px solid #eab308";
                        numColor = "#b45309"; numWeight = 800;
                    } else if (hasEvents) {
                        // มีการนิเทศ → ขอบสีเขียว พื้นหลังเขียวอ่อน
                        bg = "#f0fdf4"; border = "2px solid #22c55e";
                        numColor = "#166534"; numWeight = 700;
                    }

                    return (
                        <div
                            key={key}
                            onClick={() => hasEvents || isToday ? setSelectedDay(isSelected ? null : key) : undefined}
                            style={{
                                ...dayCell,
                                background: bg,
                                border,
                                cursor: hasEvents ? "pointer" : "default",
                            }}
                        >
                            <div style={{ fontWeight: numWeight, color: numColor, fontSize: 13 }}>
                                {day}
                            </div>
                            {/* แสดงจำนวนรายการและไอคอน type */}
                            {hasEvents && (
                                <div style={{ display:"flex", alignItems:"center", gap:3, marginTop:3, flexWrap:"wrap" }}>
                                    {dayEvents.slice(0,2).map((ev, i) => (
                                        <span key={i} style={{ fontSize:10, lineHeight:1 }}>
                                            {ev.type === "ONLINE" ? "🌐" : "🏢"}
                                        </span>
                                    ))}
                                    {dayEvents.length > 0 && (
                                        <span style={{ fontSize:10, color:"#166534", fontWeight:700 }}>
                                            {dayEvents.length} คน
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div style={{ display:"flex", gap:14, marginTop:10, fontSize:12, color:"#64748b", flexWrap:"wrap" }}>
                <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ width:14, height:14, borderRadius:4, background:"#f0fdf4", border:"2px solid #22c55e", display:"inline-block" }} />
                    มีนิเทศ
                </span>
                <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ width:14, height:14, borderRadius:4, background:"#fef9c3", border:"2px solid #eab308", display:"inline-block" }} />
                    วันนี้
                </span>
                <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ width:14, height:14, borderRadius:4, background:"#e0f2fe", border:"2px solid #0ea5e9", display:"inline-block" }} />
                    เลือก
                </span>
                <span>🌐 ออนไลน์ &nbsp; 🏢 ออนไซต์</span>
            </div>

            {/* Selected day detail */}
            {selectedDay && (
                <div style={{ marginTop:16, padding:16, background:"#f8fafc", borderRadius:10, border:"1px solid #e2e8f0" }}>
                    <div style={{ fontWeight:700, marginBottom:10, color:"#1e293b" }}>
                        📌 {fmtDate(selectedDay + "T00:00:00")} — {selectedEvents.length} รายการ
                    </div>
                    {selectedEvents.length === 0 ? (
                        <div style={{ color:"#94a3b8", fontSize:13 }}>ไม่มีนิเทศในวันนี้</div>
                    ) : (
                        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                            {selectedEvents.map(ev => (
                                <div key={ev.id} style={{
                                    display:"flex", alignItems:"center", gap:12,
                                    padding:"10px 14px", background:"#fff",
                                    border:"1px solid #e2e8f0", borderRadius:8
                                }}>
                                    <div style={{
                                        width:36, height:36, borderRadius:"50%",
                                        background: ev.type === "ONLINE" ? "#dbeafe" : "#fef3c7",
                                        display:"flex", alignItems:"center", justifyContent:"center",
                                        fontSize:16, flexShrink:0
                                    }}>
                                        {ev.type === "ONLINE" ? "🌐" : "🏢"}
                                    </div>
                                    <div style={{ flex:1 }}>
                                        <div style={{ fontWeight:700, color:"#0f172a", fontSize:14 }}>{ev.studentName}</div>
                                        {ev.studentId && <div style={{ fontSize:12, color:"#64748b" }}>{ev.studentId}</div>}
                                    </div>
                                    <div style={{ textAlign:"right" }}>
                                        <div style={{ fontWeight:700, color:"#16a34a", fontSize:14 }}>{fmtTime(ev.confirmedDate)}</div>
                                        <div style={{ fontSize:12, color: ev.type === "ONLINE" ? "#2563eb" : "#d97706" }}>
                                            {ev.type === "ONLINE" ? "ออนไลน์" : "ออนไซต์"}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const calendarWrap: CSSProperties = {
    background:"#fff", borderRadius:16, padding:20,
    boxShadow:"0 4px 6px -1px rgba(0,0,0,0.05)", border:"1px solid #f1f5f9"
};
const navBtn: CSSProperties = {
    background:"#f1f5f9", border:"1px solid #e2e8f0", borderRadius:6,
    padding:"4px 12px", cursor:"pointer", fontSize:16, fontWeight:700, color:"#475569"
};
const gridStyle: CSSProperties = {
    display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4
};
const dayHeader: CSSProperties = {
    textAlign:"center", padding:"6px 0", fontSize:12,
    fontWeight:700, color:"#64748b", background:"#f8fafc", borderRadius:6
};
const dayCell: CSSProperties = {
    minHeight:52, padding:"6px 8px", borderRadius:8,
    transition:"all 0.15s", userSelect:"none"
};
