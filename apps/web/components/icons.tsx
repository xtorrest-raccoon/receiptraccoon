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

export function DownloadIcon({ color }: { color: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
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
