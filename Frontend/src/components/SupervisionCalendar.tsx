import React, { useState, useMemo } from "react";
import type { CSSProperties } from "react";

export interface CalendarEvent {
    id: number;
    confirmedDate: string; // ISO datetime
    studentName: string;
    studentId?: string;
    type: "ONLINE" | "ONSITE";
    status?: string;
    companyName?: string | null;
    onlineLink?: string | null;
}

interface Props {
    events: CalendarEvent[];
    title?: string;
}

type FilterType = "ALL" | "ONLINE" | "ONSITE";

const DAYS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTHS_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
                   "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

function fmtTime(iso: string) {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")} น.`;
}
function fmtDate(iso: string) {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()+543}`;
}
function fmtDateShort(iso: string) {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth()+1}`;
}
function dayKeyOf(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function AgendaItem({ ev }: { ev: CalendarEvent }) {
    const isOnline = ev.type === "ONLINE";
    return (
        <div style={agendaItemStyle}>
            <div style={{ ...agendaIconStyle, background: isOnline ? "#dbeafe" : "#fef3c7" }}>
                {isOnline ? "🌐" : "🏢"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={agendaNameStyle}>{ev.studentName}</div>
                <div style={agendaCompanyStyle}>{ev.companyName || "-"}</div>
                {isOnline && (
                    ev.onlineLink ? (
                        <a href={ev.onlineLink} target="_blank" rel="noopener noreferrer" style={agendaLinkStyle}>
                            🔗 {ev.onlineLink}
                        </a>
                    ) : (
                        <div style={agendaNoLinkStyle}>ยังไม่ระบุลิงก์</div>
                    )
                )}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={agendaDateStyle}>{fmtDateShort(ev.confirmedDate)}</div>
                <div style={agendaTimeStyle}>{fmtTime(ev.confirmedDate)}</div>
            </div>
        </div>
    );
}

export default function SupervisionCalendar({ events, title = "📅 ปฏิทินนิเทศสหกิจ" }: Props) {
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11
    const [selectedDay, setSelectedDay] = useState<string | null>(null); // "YYYY-MM-DD"
    const [filterType, setFilterType] = useState<FilterType>("ALL");

    const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

    // กรองตามประเภทที่เลือก (ทั้งหมด / ออนไลน์ / ออนไซต์) — ใช้เป็นฐานทั้ง grid, stats, และ agenda
    const filteredEvents = useMemo(
        () => filterType === "ALL" ? events : events.filter(ev => ev.type === filterType),
        [events, filterType]
    );

    // map eventsByDay: "YYYY-MM-DD" → CalendarEvent[] (จาก filteredEvents)
    const eventsByDay = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        filteredEvents.forEach(ev => {
            if (!ev.confirmedDate) return;
            const key = dayKeyOf(ev.confirmedDate);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(ev);
        });
        return map;
    }, [filteredEvents]);

    // เฉพาะนัดหมายในเดือนที่กำลังดู เรียงตามเวลา ascending
    const monthEvents = useMemo(() => {
        return filteredEvents
            .filter(ev => {
                const d = new Date(ev.confirmedDate);
                return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
            })
            .sort((a, b) => new Date(a.confirmedDate).getTime() - new Date(b.confirmedDate).getTime());
    }, [filteredEvents, viewYear, viewMonth]);

    const stats = useMemo(() => {
        const online = monthEvents.filter(ev => ev.type === "ONLINE").length;
        const onsite = monthEvents.filter(ev => ev.type === "ONSITE").length;
        const todayCount = monthEvents.filter(ev => dayKeyOf(ev.confirmedDate) === todayKey).length;
        return { total: monthEvents.length, online, onsite, todayCount };
    }, [monthEvents, todayKey]);

    const agendaEvents = selectedDay
        ? monthEvents.filter(ev => dayKeyOf(ev.confirmedDate) === selectedDay)
        : monthEvents;

    // สร้าง grid วันในเดือน
    const calendarDays = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sunday
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const cells: (number | null)[] = Array(firstDay).fill(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
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
    const goToday = () => {
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
        setSelectedDay(null);
    };

    return (
        <div style={calendarWrap}>
            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8 }}>
                <div style={{ fontWeight:800, fontSize:16, color:"#1e293b" }}>{title}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <button style={navBtn} onClick={prevMonth}>‹</button>
                    <span style={{ fontWeight:700, fontSize:15, minWidth:160, textAlign:"center" }}>
                        {MONTHS_TH[viewMonth]} {viewYear + 543}
                    </span>
                    <button style={navBtn} onClick={nextMonth}>›</button>
                    <button style={{ ...navBtn, fontSize:11, padding:"4px 8px" }} onClick={goToday}>
                        วันนี้
                    </button>
                </div>
            </div>

            {/* Stats strip */}
            <div className="svcal-stats" style={statsRowStyle}>
                <div style={statCardStyle}>
                    <div style={{ ...statValueStyle, color:"#0f172a" }}>{stats.total}</div>
                    <div style={statLabelStyle}>นัดหมายเดือนนี้</div>
                </div>
                <div style={{ ...statCardStyle, background:"#eff6ff", borderColor:"#bfdbfe" }}>
                    <div style={{ ...statValueStyle, color:"#2563eb" }}>{stats.online}</div>
                    <div style={{ ...statLabelStyle, color:"#1d4ed8" }}>🌐 ออนไลน์</div>
                </div>
                <div style={{ ...statCardStyle, background:"#fffbeb", borderColor:"#fde68a" }}>
                    <div style={{ ...statValueStyle, color:"#d97706" }}>{stats.onsite}</div>
                    <div style={{ ...statLabelStyle, color:"#b45309" }}>🏢 ออนไซต์</div>
                </div>
                <div style={{ ...statCardStyle, background:"#f0fdf4", borderColor:"#bbf7d0" }}>
                    <div style={{ ...statValueStyle, color:"#16a34a", fontSize:14 }}>วันนี้</div>
                    <div style={{ ...statLabelStyle, color:"#15803d" }}>
                        {stats.todayCount > 0 ? `มี ${stats.todayCount} นัด` : "ไม่มีนัด"}
                    </div>
                </div>
            </div>

            {/* Filter chips */}
            <div style={{ display:"flex", gap:6, marginBottom:12 }}>
                {([["ALL","ทั้งหมด"],["ONLINE","🌐 ออนไลน์"],["ONSITE","🏢 ออนไซต์"]] as [FilterType,string][]).map(([key,label]) => (
                    <button
                        key={key}
                        onClick={() => setFilterType(key)}
                        style={{
                            ...filterChipStyle,
                            background: filterType === key ? "#0f172a" : "#f1f5f9",
                            color: filterType === key ? "#fff" : "#64748b",
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Split: calendar grid + agenda */}
            <div className="svcal-split" style={splitRowStyle}>
                {/* Grid column */}
                <div className="svcal-grid-col" style={{ flex: "1.1 1 0" }}>
                    <div style={gridStyle}>
                        {DAYS_TH.map(d => (
                            <div key={d} style={dayHeader}>{d}</div>
                        ))}
                        {calendarDays.map((day, idx) => {
                            if (!day) return <div key={`e-${idx}`} />;
                            const key = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                            const dayEvents = eventsByDay.get(key) ?? [];
                            const isToday = key === todayKey;
                            const isSelected = key === selectedDay;
                            const hasEvents = dayEvents.length > 0;

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
                                bg = "#f0fdf4"; border = "2px solid #22c55e";
                                numColor = "#166534"; numWeight = 700;
                            }

                            return (
                                <div
                                    key={key}
                                    onClick={() => (hasEvents || isToday) ? setSelectedDay(isSelected ? null : key) : undefined}
                                    style={{
                                        ...dayCell,
                                        background: bg,
                                        border,
                                        cursor: (hasEvents || isToday) ? "pointer" : "default",
                                    }}
                                >
                                    <div style={{ fontWeight: numWeight, color: numColor, fontSize: 13 }}>
                                        {day}
                                    </div>
                                    {hasEvents && (
                                        <div style={dayCellCountStyle}>{dayEvents.length} คน</div>
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
                    </div>
                </div>

                {/* Agenda column */}
                <div className="svcal-agenda-col" style={{ flex: "1 1 0", display:"flex", flexDirection:"column", gap:8, minWidth:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#334155" }}>
                            📋 {selectedDay ? `รายการวันที่ ${fmtDate(selectedDay + "T00:00:00")}` : `รายการนัดหมายเดือนนี้ (${monthEvents.length})`}
                        </div>
                        {selectedDay && (
                            <button onClick={() => setSelectedDay(null)} style={resetLinkStyle}>
                                ดูทั้งเดือน
                            </button>
                        )}
                    </div>

                    {agendaEvents.length === 0 ? (
                        <div style={{ color:"#94a3b8", fontSize:13, padding:"12px 0" }}>
                            {selectedDay ? "ไม่มีนิเทศในวันที่เลือก" : "ไม่มีนัดหมายในเดือนนี้"}
                        </div>
                    ) : (
                        <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:360, overflowY:"auto" }}>
                            {agendaEvents.map(ev => <AgendaItem key={ev.id} ev={ev} />)}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @media (max-width: 768px) {
                    .svcal-split { flex-direction: column !important; }
                    .svcal-stats { flex-wrap: wrap !important; }
                }
            `}</style>
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
const statsRowStyle: CSSProperties = {
    display:"flex", gap:8, marginBottom:12
};
const statCardStyle: CSSProperties = {
    flex:1, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8,
    padding:10, textAlign:"center", minWidth:90
};
const statValueStyle: CSSProperties = {
    fontSize:18, fontWeight:800
};
const statLabelStyle: CSSProperties = {
    fontSize:10, color:"#64748b", marginTop:2
};
const filterChipStyle: CSSProperties = {
    border:"none", borderRadius:8, padding:"5px 12px", fontSize:11,
    fontWeight:600, cursor:"pointer"
};
const splitRowStyle: CSSProperties = {
    display:"flex", gap:16
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
const dayCellCountStyle: CSSProperties = {
    fontSize:10, color:"#166534", fontWeight:700, marginTop:3
};
const resetLinkStyle: CSSProperties = {
    background:"none", border:"none", color:"#2563eb", fontSize:11,
    fontWeight:600, cursor:"pointer", padding:0
};
const agendaItemStyle: CSSProperties = {
    display:"flex", alignItems:"flex-start", gap:10,
    padding:"10px 12px", background:"#f8fafc",
    border:"1px solid #e2e8f0", borderRadius:8
};
const agendaIconStyle: CSSProperties = {
    width:30, height:30, borderRadius:"50%",
    display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:14, flexShrink:0
};
const agendaNameStyle: CSSProperties = {
    fontWeight:700, color:"#0f172a", fontSize:12,
    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
};
const agendaCompanyStyle: CSSProperties = {
    fontSize:10, color:"#64748b", marginTop:1,
    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
};
const agendaLinkStyle: CSSProperties = {
    fontSize:10, color:"#2563eb", marginTop:3, display:"block",
    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
};
const agendaNoLinkStyle: CSSProperties = {
    fontSize:10, color:"#94a3b8", marginTop:3
};
const agendaDateStyle: CSSProperties = {
    fontWeight:700, color:"#16a34a", fontSize:12
};
const agendaTimeStyle: CSSProperties = {
    fontSize:10, color:"#64748b"
};
