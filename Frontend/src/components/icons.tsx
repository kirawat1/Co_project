// src/components/icons.tsx
import React from "react";

export function BaseIcon({
  width = 24,
  height = 24,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export const IcDashboard = (props?: React.SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <rect x="3" y="3" width="8" height="8" rx="2" />
    <rect x="13" y="3" width="8" height="5" rx="2" />
    <rect x="13" y="10" width="8" height="11" rx="2" />
    <rect x="3" y="13" width="8" height="8" rx="2" />
  </BaseIcon>
);

export const IcUser = (props?: React.SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <circle cx="12" cy="7" r="4" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </BaseIcon>
);

export const IcUsers = (props?: React.SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <circle cx="9" cy="7" r="4" />
    <circle cx="17" cy="7" r="3" />
    <path d="M2 21v-2a6 6 0 0 1 12 0v2" />
    <path d="M14 21v-2a4 4 0 0 1 4-4" />
  </BaseIcon>
);

export const IcBuilding = (props?: React.SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <rect x="4" y="7" width="16" height="13" rx="2" />
    <path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01" />
  </BaseIcon>
);

export const IcCalendar = (props?: React.SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M8 2v4M16 2v4M3 10h18" />
  </BaseIcon>
);

export const IcDocs = (props?: React.SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12" />
    <path d="M14 2v6a2 2 0 0 0 2 2h6" />
  </BaseIcon>
);

export const IcTeacher = (props?: React.SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <circle cx="12" cy="7" r="4" />
    <path d="M4 20a8 8 0 0 1 16 0" />
    <path d="M9 12l-6 3 9 4 9-4-6-3" />
  </BaseIcon>
);

export const IcAnnounce = (props?: React.SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <path d="M3 11v2" />
    <path d="M7 9v6" />
    <path d="M11 7v10" />
    <path d="M15 9v6" />
    <path d="M19 11v2" />
    <path d="M12 3v2" />
    <path d="M12 19v2" />
  </BaseIcon>
);

export const IcSettings = (props?: React.SVGProps<SVGSVGElement>) => (
  <BaseIcon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 1-.3 1.8l-.2.2a1.7 1.7 0 0 1-1.8.3l-1.6-.7a6.7 6.7 0 0 1-1.5.9l-.3 1.7a1.7 1.7 0 0 1-1.7 1.4h-.4a1.7 1.7 0 0 1-1.7-1.4l-.3-1.7a6.7 6.7 0 0 1-1.5-.9l-1.6.7a1.7 1.7 0 0 1-1.8-.3l-.2-.2A1.7 1.7 0 0 1 4.6 15l.7-1.6a6.7 6.7 0 0 1 0-1.9L4.6 9.8a1.7 1.7 0 0 1 .3-1.8l.2-.2A1.7 1.7 0 0 1 7 7.5l1.6.7a6.7 6.7 0 0 1 1.5-.9l.3-1.7A1.7 1.7 0 0 1 12.1 4h.4a1.7 1.7 0 0 1 1.7 1.4l.3 1.7a6.7 6.7 0 0 1 1.5.9l1.6-.7a1.7 1.7 0 0 1 1.8.3l.2.2c.5.4.6 1.1.3 1.8l-.7 1.6a6.7 6.7 0 0 1 0 1.9L19.4 15Z" />
  </BaseIcon>
);

export function IcEdit(props: React.SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 13.5-11.5Z" />
    </BaseIcon>
  );
}

export function IcSave(props: React.SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M5 13l4 4L19 7" />
    </BaseIcon>
  );
}

export function IcDelete(props: React.SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M3 6h18M8 6v14h8V6M10 6V4h4v2" />
    </BaseIcon>
  );
}
