/**
 * Nav + brand icons, ported path-for-path from design/dashboard.dc.html
 * (the ICONS map and the sidebar logo <svg>). Colour is always passed in by
 * the caller from @rr/ui-tokens — nothing here hardcodes an oklch value.
 */

export function DashboardIcon({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
      <rect x={2} y={2} width={7} height={7} rx={2} fill={color} />
      <rect x={11} y={2} width={7} height={7} rx={2} fill={color} opacity={0.4} />
      <rect x={2} y={11} width={7} height={7} rx={2} fill={color} opacity={0.4} />
      <rect x={11} y={11} width={7} height={7} rx={2} fill={color} />
    </svg>
  );
}

export function ReceiptsIcon({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
      <rect x={4} y={2} width={12} height={16} rx={2} fill="none" stroke={color} strokeWidth={1.6} />
      <line x1={7} y1={7} x2={13} y2={7} stroke={color} strokeWidth={1.6} />
      <line x1={7} y1={10.5} x2={13} y2={10.5} stroke={color} strokeWidth={1.6} />
      <line x1={7} y1={14} x2={11} y2={14} stroke={color} strokeWidth={1.6} />
    </svg>
  );
}

export function TeamIcon({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx={7} cy={7} r={3} fill="none" stroke={color} strokeWidth={1.6} />
      <circle cx={14} cy={8} r={2.4} fill="none" stroke={color} strokeWidth={1.6} />
      <path d="M2.5 17c0-3.3 2-5 4.5-5s4.5 1.7 4.5 5" fill="none" stroke={color} strokeWidth={1.6} />
      <path d="M12.5 17c0-2.4 1.3-4 3.5-4s3.5 1.6 3.5 4" fill="none" stroke={color} strokeWidth={1.6} />
    </svg>
  );
}

export function ProfileIcon({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx={10} cy={6.8} r={3.3} fill="none" stroke={color} strokeWidth={1.6} />
      <path d="M3.5 17c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" fill="none" stroke={color} strokeWidth={1.6} />
    </svg>
  );
}

export function SetupIcon({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx={10} cy={10} r={2.6} fill="none" stroke={color} strokeWidth={1.6} />
      <path
        d="M10 3v1.6M10 15.4V17M17 10h-1.6M4.6 10H3M15.1 4.9l-1.1 1.1M5.9 14.1l-1.1 1.1M15.1 15.1l-1.1-1.1M5.9 5.9L4.8 4.8"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MileageIcon({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4 12l1.2-4.2A2 2 0 0 1 7.1 6.4h5.8a2 2 0 0 1 1.9 1.4L16 12"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x={2.5} y={12} width={15} height={3.4} rx={1.4} fill="none" stroke={color} strokeWidth={1.6} />
      <circle cx={6} cy={15.6} r={1.3} fill={color} />
      <circle cx={14} cy={15.6} r={1.3} fill={color} />
    </svg>
  );
}

export function TrashIcon({ color }: { color: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2 3.5h10M5.5 3.5V2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5" fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.2 3.5l.5 8a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.5-8" fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DownloadIcon({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <path d="M7 1v8M3.5 6L7 9.5 10.5 6" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 11.5h11" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

export function UploadIcon({ color }: { color: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
      <path d="M7 9.5v-8M3.5 4.5L7 1l3.5 3.5" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 11.5h11" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

/** Landing page icon set — same 20x20 line-icon style as the nav icons above. */

export function CameraIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7 5.5l.9-1.7a1.4 1.4 0 0 1 1.24-.75h1.72a1.4 1.4 0 0 1 1.24.75L13 5.5h2a1.6 1.6 0 0 1 1.6 1.6v7.3A1.6 1.6 0 0 1 15 16H5a1.6 1.6 0 0 1-1.6-1.6V7.1A1.6 1.6 0 0 1 5 5.5h2z" fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={10} cy={10.5} r={2.6} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

export function WarningIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 3.3l7.2 12.5a1 1 0 0 1-.87 1.5H3.67a1 1 0 0 1-.87-1.5L10 3.3z" fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <line x1={10} y1={8.3} x2={10} y2={11.6} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={10} cy={14} r={0.9} fill={color} />
    </svg>
  );
}

export function PinIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 17.5S15.5 12.4 15.5 8.3A5.5 5.5 0 0 0 4.5 8.3c0 4.1 5.5 9.2 5.5 9.2z" fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={10} cy={8.2} r={2} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

export function GlobeIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx={10} cy={10} r={7} fill="none" stroke={color} strokeWidth={1.5} />
      <ellipse cx={10} cy={10} rx={3} ry={7} fill="none" stroke={color} strokeWidth={1.5} />
      <line x1={3} y1={10} x2={17} y2={10} stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

export function ShieldIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 2.5l6 2.2v5c0 4.2-2.6 6.9-6 7.8-3.4-.9-6-3.6-6-7.8v-5l6-2.2z" fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M7.3 10l1.9 1.9 3.5-3.9" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BellIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5.5 14V9a4.5 4.5 0 0 1 9 0v5l1.2 1.6H4.3L5.5 14z" fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M8.3 17.2a1.8 1.8 0 0 0 3.4 0" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

export function BarChartIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x={3} y={10.5} width={3.2} height={6} rx={0.8} fill={color} />
      <rect x={8.4} y={6.5} width={3.2} height={10} rx={0.8} fill={color} opacity={0.6} />
      <rect x={13.8} y={3} width={3.2} height={13.5} rx={0.8} fill={color} />
    </svg>
  );
}

export function CheckCircleIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx={10} cy={10} r={7.5} fill="none" stroke={color} strokeWidth={1.5} />
      <path d="M6.8 10.2l2.1 2.1 4.3-4.6" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRightIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.5 8h11M9 3.5L13.5 8 9 12.5" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
