import LiquidChrome from "./LiquidChrome";
import "./ShapeGridBackground.css";

export function ShapeGridBackground() {
  return (
    <div className="shape-grid-background" aria-hidden="true">
      <LiquidChrome
        color="#ffffff"
        speed={0.16}
        amplitude={0.32}
        frequencyX={3}
        frequencyY={3}
        detail={4}
        thickness={1.1}
        depth={1}
        roughness={0.24}
        exposure={1.15}
        interactive
        rippleStrength={0.8}
        rippleSize={1}
        tilt={0.7}
        intro
        lightMode={false}
        maxDevicePixelRatio={1.5}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
