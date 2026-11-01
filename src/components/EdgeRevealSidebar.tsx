import type { ReactNode, MouseEventHandler } from "react";

type EdgeRevealSidebarProps = {
  className: string;
  isOpen: boolean;
  label: string;
  onMouseLeave: MouseEventHandler<HTMLElement>;
  children: ReactNode;
};

/** Shared left-edge reveal sidebar used by the dashboard and project workspace. */
export function EdgeRevealSidebar({ className, isOpen, label, onMouseLeave, children }: EdgeRevealSidebarProps) {
  return (
    <aside
      className={`edge-reveal-sidebar ${className} ${isOpen ? "is-revealed" : ""}`}
      aria-label={label}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </aside>
  );
}
