import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  targetPath: string;
}

export default function NotificationBell({ targetPath }: Props) {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();
  const token = localStorage.getItem("coop.token");

  useEffect(() => {
    if (!token) return;
    fetch("/api/notifications/unread-count", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setCount(d.count ?? 0))
      .catch(() => {});
  }, [token]);

  const handleClick = async () => {
    if (count > 0 && token) {
      try {
        await fetch("/api/notifications/mark-all-read", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        setCount(0);
      } catch { /* silent */ }
    }
    navigate(targetPath);
  };

  return (
    <button
      onClick={handleClick}
      title={count > 0 ? `${count} การแจ้งเตือนใหม่` : "ไม่มีการแจ้งเตือน"}
      style={{
        position: "relative",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "6px 8px",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        color: count > 0 ? "#2563eb" : "#94a3b8",
        transition: "color .15s",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {count > 0 && (
        <span style={{
          position: "absolute",
          top: 0,
          right: 0,
          background: "#ef4444",
          color: "#fff",
          borderRadius: "50%",
          width: 18,
          height: 18,
          fontSize: 10,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
        }}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
