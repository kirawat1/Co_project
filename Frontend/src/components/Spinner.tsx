/* ============================================================
   Spinner — inline loading indicator สำหรับปุ่ม
   ใช้งาน: <Spinner size={18} color="#fff" />
============================================================ */
export default function Spinner({
  size = 18,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ animation: "spin .7s linear infinite", display: "block" }}
    >
      <path d="M12 2a10 10 0 0 1 10 10" opacity=".25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}
