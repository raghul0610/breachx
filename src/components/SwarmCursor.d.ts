import type { CSSProperties, ReactNode } from "react";

export interface SwarmCursorProps {
  count?: number;
  size?: number;
  shape?: "dot" | "square" | "streak";
  color?: string;
  accentColor?: string;
  spread?: number;
  speed?: number;
  swirl?: number;
  tail?: number;
  trail?: number;
  wander?: number;
  depth?: number;
  targets?: string;
  idle?: "roam" | "follow" | "still" | string;
  clickEffect?: "burst" | "pulse" | "none" | string;
  hideCursor?: boolean;
  intro?: boolean;
  enabled?: boolean;
  lightMode?: boolean;
  dpr?: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  [key: string]: unknown;
}

export default function SwarmCursor(props: SwarmCursorProps): ReactNode;
