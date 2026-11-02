import { useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import "./FolderFloat.css";

type FolderFloatProps = {
  items: Array<string | { label: string; detail?: string }>;
  label?: string;
  sublabel?: string;
  onSelect?: (value: string, index: number) => void;
};

const { Bodies, Body, Composite, Engine } = Matter;

export function FolderFloat({ items, label = "Design notes", sublabel, onSelect }: FolderFloatProps) {
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const worldRef = useRef<{ engine: Matter.Engine | null; bodies: Matter.Body[]; frame: number }>({ engine: null, bodies: [], frame: 0 });
  const countLabel = sublabel ?? `${items.length} notes`;

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => {
      const root = rootRef.current;
      const elements = itemRefs.current.slice(0, items.length);
      if (!root || elements.some((element) => !element)) return;
      const engine = Engine.create({ gravity: { x: 0, y: 0 } });
      const rootBounds = root.getBoundingClientRect();
      const bodies = elements.map((element, index) => {
        const bounds = element!.getBoundingClientRect();
        const x = bounds.left - rootBounds.left + bounds.width / 2;
        const y = bounds.top - rootBounds.top + bounds.height / 2;
        return Bodies.rectangle(x, y, bounds.width, bounds.height, {
          restitution: 0.72,
          frictionAir: 0.08,
          inertia: Infinity,
          chamfer: { radius: 16 },
          plugin: { phase: index * 1.8 },
        });
      });
      const width = rootBounds.width;
      const height = rootBounds.height;
      Composite.add(engine.world, [
        ...bodies,
        Bodies.rectangle(width / 2, -40, width + 160, 80, { isStatic: true }),
        Bodies.rectangle(width / 2, height + 40, width + 160, 80, { isStatic: true }),
        Bodies.rectangle(-40, height / 2, 80, height + 160, { isStatic: true }),
        Bodies.rectangle(width + 40, height / 2, 80, height + 160, { isStatic: true }),
      ]);
      worldRef.current = { engine, bodies, frame: 0 };
      setLive(true);
      let previous = performance.now();
      const tick = (now: number) => {
        const world = worldRef.current;
        if (world.engine !== engine) return;
        const delta = Math.min(32, now - previous);
        previous = now;
        bodies.forEach((body, index) => {
          const phase = (body.plugin as { phase: number }).phase;
          Body.applyForce(body, body.position, { x: Math.sin(now / 1100 + phase) * 0.000018, y: Math.cos(now / 1300 + phase) * 0.000018 });
          const element = itemRefs.current[index];
          if (element) {
            element.style.setProperty("--float-x", `${body.position.x - (element.offsetLeft + element.offsetWidth / 2)}px`);
            element.style.setProperty("--float-y", `${body.position.y - (element.offsetTop + element.offsetHeight / 2)}px`);
            element.style.setProperty("--float-rotate", `${body.angle * 18}deg`);
          }
        });
        Engine.update(engine, delta);
        world.frame = requestAnimationFrame(tick);
      };
      worldRef.current.frame = requestAnimationFrame(tick);
    }, 560);
    return () => window.clearTimeout(timer);
  }, [open, items.length]);

  useEffect(() => () => {
    cancelAnimationFrame(worldRef.current.frame);
    if (worldRef.current.engine) {
      Composite.clear(worldRef.current.engine.world, false, true);
      Engine.clear(worldRef.current.engine);
    }
  }, []);

  const close = () => {
    cancelAnimationFrame(worldRef.current.frame);
    if (worldRef.current.engine) {
      Composite.clear(worldRef.current.engine.world, false, true);
      Engine.clear(worldRef.current.engine);
    }
    worldRef.current = { engine: null, bodies: [], frame: 0 };
    setLive(false);
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`folder-float${open ? " is-open" : ""}${live ? " is-live" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { if (!live) close(); }}
      onFocus={() => setOpen(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}
    >
      <div className="folder-float__items" aria-live="polite">
        {items.map((item, index) => (
          <button
            key={typeof item === "string" ? item : item.label}
            ref={(element) => { itemRefs.current[index] = element; }}
            type="button"
            className="folder-float__item"
            tabIndex={open ? 0 : -1}
            onClick={() => { onSelect?.(typeof item === "string" ? item : item.label, index); close(); }}
          >
            <strong>{typeof item === "string" ? item : item.label}</strong>
            {typeof item !== "string" && item.detail && <small>{item.detail}</small>}
          </button>
        ))}
      </div>
      <div className="folder-float__folder">
        <span className="folder-float__back" />
        <span className="folder-float__paper" />
        <span className="folder-float__front"><strong>{label}</strong><small>{countLabel}</small></span>
        <button className="folder-float__trigger" type="button" aria-label={`${label}, ${countLabel}`} aria-expanded={open} onClick={() => open ? close() : setOpen(true)} />
      </div>
    </div>
  );
}
