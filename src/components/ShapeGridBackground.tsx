import ShapeGrid from "./ShapeGrid";
import "./ShapeGridBackground.css";

export function ShapeGridBackground() {
  return (
    <div className="shape-grid-background" aria-hidden="true">
      <ShapeGrid
        shape="square"
        cellSize={42}
        lineWidth={0.8}
        direction="diagonal"
        speed={0.18}
        lineColor="#242236"
        hoverColor="#45d9ff"
        hoverFillColor="#45d9ff"
        fillOpacity={0.12}
        radius={1.7}
        trail={0.75}
        glow={0.28}
        fade={0.78}
        opacity={0.72}
        clickCascade
        intro
      />
    </div>
  );
}
