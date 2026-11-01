import type { CSSProperties } from "react";
import { useId } from "react";

export function AnchonLogo({ className, size = 36, style }: { className?: string; size?: number; style?: CSSProperties }) {
  const gradientId = useId().replace(/:/g, "");
  const shadowId = useId().replace(/:/g, "");
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="ANCHON" style={style}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff"/>
          <stop offset=".22" stopColor="#e9edf0"/>
          <stop offset=".48" stopColor="#89949d"/>
          <stop offset=".68" stopColor="#f8fafb"/>
          <stop offset="1" stopColor="#707b84"/>
        </linearGradient>
        <linearGradient id={shadowId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#59636c"/>
          <stop offset=".5" stopColor="#f5f7f8"/>
          <stop offset="1" stopColor="#68737d"/>
        </linearGradient>
        <filter id={`${shadowId}-glow`} x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="2.2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d="M8 91 40 12Q44 2 50 2t10 10l32 79-15-9-7-3-20-52-20 52-7 3Z" fill="#59636c" opacity=".75" transform="translate(2 3)"/>
      <path d="M8 91 40 12Q44 2 50 2t10 10l32 79-15-9-7-3-20-52-20 52-7 3Z" fill={`url(#${gradientId})`} filter={`url(#${shadowId}-glow)`}/>
      <path d="M29 69 36 65Q50 50 64 65l7 4-5 8-5-3q-11-9-22 0l-5 3Z" fill={`url(#${shadowId})`} stroke="#f8fafb" strokeOpacity=".45" strokeWidth="1"/>
      <path d="M40 13 50 3 60 13 50 7Z" fill="#fff" opacity=".7"/>
      <path d="M13 87 42 15" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".35"/>
    </svg>
  );
}
