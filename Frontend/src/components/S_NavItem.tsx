// src/components/S_NavItem.tsx
import { NavLink } from "react-router-dom";
import type { ComponentType, SVGProps } from "react";

export interface SNavItemProps {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  highlight?: boolean;
}

export default function S_NavItem({ to, label, Icon, highlight = false }: SNavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 px-4 py-2 rounded-xl font-semibold text-[15px] transition-all duration-200",
          isActive
            ? "text-white bg-gradient-to-r from-blue-500 to-blue-400 shadow-md"
            : highlight
            ? "bg-blue-50 border border-blue-300 text-gray-800"
            : "text-gray-800 hover:bg-gray-100",

          "hover:-translate-y-[2px]",
        ].join(" ")
      }
    >
      <Icon width={20} height={20} />
      <span>{label}</span>
    </NavLink>
  );
}
