/**
 * Nav + brand icons, ported path-for-path from design/dashboard.dc.html
 * (the ICONS map and the sidebar logo <svg>). Colour is always passed in by
 * the caller from @rr/ui-tokens — nothing here hardcodes an oklch value.
 */

export function LogoMark({ faceColor, noseColor, size = 40 }: { faceColor: string; noseColor: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ flexShrink: 0 }} aria-hidden="true">
      <path
        d="M100,18 C60,18 34,44 34,78 C22,84 14,96 14,112 C14,132 30,148 50,148 C54,148 58,147 62,146 C68,162 82,172 100,172 C118,172 132,162 138,146 C142,147 146,148 150,148 C170,148 186,132 186,112 C186,96 178,84 166,78 C166,44 140,18 100,18 Z M50,72 C56,66 66,62 76,62 C80,62 82,66 80,70 C74,80 64,86 54,86 C48,86 46,78 50,72 Z M150,72 C154,78 152,86 146,86 C136,86 126,80 120,70 C118,66 120,62 124,62 C134,62 144,66 150,72 Z"
        fill={faceColor}
      />
      <ellipse cx={76} cy={102} rx={14} ry={17} fill="#ffffff" />
      <ellipse cx={124} cy={102} rx={14} ry={17} fill="#ffffff" />
      <ellipse cx={100} cy={126} rx={10} ry={7} fill={noseColor} />
    </svg>
  );
}

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

export function DownloadIcon({ color }: { color: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
      <path d="M7 1v8M3.5 6L7 9.5 10.5 6" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 11.5h11" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}
