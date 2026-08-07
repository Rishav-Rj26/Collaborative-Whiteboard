/**
 * Boardly — SVG Logo Component
 * Overlapping canvas layers in violet + emerald.
 */
export default function BoardlyLogo({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Boardly logo"
    >
      {/* Glow backdrop */}
      <defs>
        <linearGradient id="violet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="emerald-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0.8" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Back layer — violet */}
      <rect
        x="8"
        y="12"
        width="36"
        height="36"
        rx="8"
        fill="url(#violet-grad)"
        filter="url(#glow)"
      />

      {/* Front layer — emerald, offset */}
      <rect
        x="20"
        y="16"
        width="36"
        height="36"
        rx="8"
        fill="url(#emerald-grad)"
        filter="url(#glow)"
      />

      {/* Pen stroke accent */}
      <path
        d="M30 28 L42 40"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M42 40 L44 42 L40 43 Z"
        fill="white"
        opacity="0.9"
      />
    </svg>
  );
}
