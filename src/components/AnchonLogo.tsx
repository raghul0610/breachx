import type { CSSProperties } from "react";

export function AnchonLogo({ className, size = 36, style }: { className?: string; size?: number; style?: CSSProperties }) {
  return <img className={className} width={size} height={size} src="/anchon-mark.svg" alt="ANCHON" style={style} />;
}
