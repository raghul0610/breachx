import type { CSSProperties } from "react";
import { useId } from "react";
export function AnchonLogo({ className, size = 36, style }: { className?: string; size?: number; style?: CSSProperties }) {
  const gradientId = useId().replace(/:/g, "");
  const glowId = useId().replace(/:/g, "");
  return <svg className={className} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="ANCHON" style={style}>
    <defs>
      <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#737f89"/><stop offset=".28" stopColor="#c4cdd3"/><stop offset=".55" stopColor="#fff"/><stop offset=".78" stopColor="#aeb8c0"/><stop offset="1" stopColor="#f8fafb"/></linearGradient>
      <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.1" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <path d="M9 55 27 10Q29 5 32 5t5 5l18 45h-11L32 23 20 55H9Z" fill={`url(#${gradientId})`} filter={`url(#${glowId})`}/>
    <path d="M24 39h16" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".9"/>
    <path d="m20 52 8-20" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity=".55"/>
  </svg>;
}
