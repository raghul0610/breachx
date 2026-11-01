import type { CSSProperties } from "react";

export function AnchonLogo({ className, size = 36, style }: { className?: string; size?: number; style?: CSSProperties }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="ANCHON logo" style={style}>
      <defs>
        <linearGradient id="anchon-logo-stroke" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#6426ff" />
          <stop offset="1" stopColor="#e0a5ff" />
        </linearGradient>
        <filter id="anchon-logo-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g fill="none" stroke="url(#anchon-logo-stroke)" strokeLinecap="round" strokeLinejoin="round" filter="url(#anchon-logo-glow)">
        <path d="M3 24 L21 29 Q23 30 23 33 L23 51 Q23 54 20 55 L12 59" strokeWidth="1.7" opacity=".8" />
        <path d="M3 34 L21 29" strokeWidth="1.2" opacity=".5" />
        <path d="M22 39 C27 44 32 38 37 32 S48 28 53 17" strokeWidth="2.8" strokeDasharray="3.3 3.3" />
        <path d="M49 13 L60 9 L56 22 L53 16 Z" fill="#d7a0ff" strokeWidth="1.2" />
      </g>
    </svg>
  );
}
