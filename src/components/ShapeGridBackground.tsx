import SwarmCursor from "./SwarmCursor";
import "./ShapeGridBackground.css";

export function ShapeGridBackground() {
  return (
    <div className="shape-grid-background" aria-hidden="true">
      <SwarmCursor
        count={650}
        size={2.2}
        shape="dot"
        color="#cfd2dc"
        accentColor="#c4b5fd"
        spread={105}
        speed={0.8}
        swirl={0.55}
        tail={0.42}
        trail={0.45}
        wander={0.42}
        depth={0.6}
        targets=".project-dashboard .project-card, .project-dashboard .primary-btn, .project-dashboard .nav-btn"
        idle="roam"
        clickEffect="pulse"
        intro
        enabled
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
