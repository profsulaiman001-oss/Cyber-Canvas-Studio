/**
 * Cyber Studio brand mark — "The Node"
 *
 * A bezier anchor point: the fundamental unit of vector design.
 * A filled diamond (anchor node) flanked by circular control handles on
 * perpendicular arms — immediately recognizable to any vector designer,
 * geometric, and clean at every size.
 *
 * Inspired by the precise visual language of Figma, Autodesk, and Affinity.
 */

/** Scalable SVG mark — use at any size */
export function CsLogoMark({
  size = 28,
  color = '#00F5FF',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Cyber Studio"
    >
      {/* ── Left control arm ── */}
      <line
        x1="1" y1="16" x2="10" y2="16"
        stroke={color} strokeWidth="1.4" strokeLinecap="round"
        opacity="0.65"
      />
      {/* Left handle: open circle */}
      <circle cx="1.5" cy="16" r="2.5" stroke={color} strokeWidth="1.4" fill="none" />

      {/* ── Right control arm ── */}
      <line
        x1="22" y1="16" x2="30.5" y2="16"
        stroke={color} strokeWidth="1.4" strokeLinecap="round"
        opacity="0.65"
      />
      {/* Right handle: open circle */}
      <circle cx="30.5" cy="16" r="2.5" stroke={color} strokeWidth="1.4" fill="none" />

      {/* ── Center anchor node: solid diamond ── */}
      {/* A 10×10 rect rotated 45° around its own center (16,16) */}
      <rect
        x="11" y="11" width="10" height="10"
        fill={color}
        rx="1.5"
        transform="rotate(45 16 16)"
      />
    </svg>
  );
}

/** App icon badge: mark inside a rounded dark tile */
export function CsIconBadge({
  tileSize = 28,
  color = '#00F5FF',
}: {
  tileSize?: number;
  color?: string;
}) {
  const r = Math.round(tileSize * 0.28);
  return (
    <div
      style={{
        width: tileSize,
        height: tileSize,
        borderRadius: r,
        background: '#11141A',
        border: `1px solid ${color}40`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <CsLogoMark size={Math.round(tileSize * 0.7)} color={color} />
    </div>
  );
}

/** Full header lockup: icon badge + wordmark */
export function CyberStudioWordmark({
  color = '#00F5FF',
}: {
  color?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <CsIconBadge tileSize={30} color={color} />
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.18em',
          color: '#E4E8EF',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        CYBER STUDIO
      </span>
    </div>
  );
}
