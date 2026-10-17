import { useEffect, useRef } from "react";
import "./AnchonTechText.css";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** ANCHON wordmark: interactive technical-outline lettering inspired by React Bits TechText. */
export function AnchonTechText() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!host || !canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let raf = 0;
    let last = performance.now();
    let pulse = 0;
    let pointer = { x: 0.5, y: 0.5, inside: false };
    let lens = { x: 0.5, y: 0.5 };
    let offsets: { x: number; y: number; vx: number; vy: number }[] = [];
    let boxes: { x: number; y: number; w: number; h: number; cx: number; cy: number }[] = [];
    let textLeft = 0;
    let baseline = 0;
    let fontSize = 100;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      layout();
      wake();
    };

    const layout = () => {
      if (!ctx) return;
      fontSize = Math.min(142, height * 0.68, width / 6.2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `700 ${fontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      const word = "ANCHON";
      const measured = ctx.measureText(word);
      textLeft = (width - measured.width) / 2;
      baseline = (height + (measured.actualBoundingBoxAscent - measured.actualBoundingBoxDescent)) / 2;
      boxes = [];
      let x = textLeft;
      for (const char of word) {
        const m = ctx.measureText(char);
        const w = m.width;
        boxes.push({
          x: x - 3,
          y: baseline - m.actualBoundingBoxAscent - 4,
          w: Math.max(1, w + 2),
          h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + 8,
          cx: x + w / 2,
          cy: baseline - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2,
        });
        x += w;
      }
      offsets = boxes.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
    };

    const wake = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.04, Math.max(0.001, (now - last) / 1000));
      last = now;
      pulse += dt;
      const targetX = pointer.inside ? pointer.x : 0.5 + 0.42 * Math.sin(pulse * 0.42);
      const targetY = pointer.inside ? pointer.y : 0.5 + 0.08 * Math.sin(pulse * 0.7);
      lens.x += (targetX - lens.x) * Math.min(1, dt * (pointer.inside ? 18 : 2.8));
      lens.y += (targetY - lens.y) * Math.min(1, dt * (pointer.inside ? 18 : 2.8));
      const focusX = lens.x * width;
      const focusY = lens.y * height;
      let moving = false;

      offsets.forEach((o, i) => {
        const box = boxes[i];
        const distance = Math.hypot(box.cx - focusX, box.cy - focusY);
        const influence = reduced || !pointer.inside ? 0 : Math.max(0, 1 - distance / 210);
        const tx = (focusX - box.cx) * influence * 0.045;
        const ty = (focusY - box.cy) * influence * 0.035;
        o.vx += (tx - o.x) * 95 * dt - o.vx * 14 * dt;
        o.vy += (ty - o.y) * 95 * dt - o.vy * 14 * dt;
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        if (Math.abs(o.x) + Math.abs(o.y) + Math.abs(o.vx) + Math.abs(o.vy) > 0.08) moving = true;
      });

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height);
      ctx!.font = `700 ${fontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx!.textAlign = "left";
      ctx!.textBaseline = "alphabetic";
      ctx!.lineJoin = "round";
      ctx!.lineWidth = 1.4;
      ctx!.setLineDash([4, 3]);
      const word = "ANCHON";
      let x = textLeft;
      for (let i = 0; i < word.length; i++) {
        const m = ctx!.measureText(word[i]);
        const o = offsets[i];
        const box = boxes[i];
        const active = !reduced && Math.hypot(box.cx - focusX, box.cy - focusY) < (pointer.inside ? 145 : 54);
        ctx!.save();
        ctx!.translate(o.x, o.y);
        ctx!.globalAlpha = active ? 0.28 : 1;
        ctx!.fillStyle = "#e7eaf2";
        ctx!.fillText(word[i], x, baseline);
        ctx!.globalAlpha = active ? 1 : 0.48;
        ctx!.strokeStyle = "#9ca8bd";
        ctx!.strokeText(word[i], x, baseline);
        if (active) {
          ctx!.globalAlpha = 0.92;
          ctx!.strokeStyle = "#8b9cff";
          ctx!.setLineDash([3, 4]);
          ctx!.strokeRect(box.x, box.y, box.w, box.h);
          ctx!.setLineDash([]);
          const t = pulse * 24;
          for (let k = 0; k < 4; k++) {
            const perimeter = 2 * (box.w + box.h);
            const d = (t + k * perimeter / 4) % perimeter;
            let px = box.x;
            let py = box.y;
            if (d < box.w) px += d;
            else if (d < box.w + box.h) { px += box.w; py += d - box.w; }
            else if (d < 2 * box.w + box.h) { px += box.w - (d - box.w - box.h); py += box.h; }
            else { py += box.h - (d - 2 * box.w - box.h); }
            ctx!.fillStyle = "#a7b4ff";
            ctx!.fillRect(Math.round(px) - 1.5, Math.round(py) - 1.5, 3, 3);
          }
          ctx!.font = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
          ctx!.fillStyle = "#a7b4ff";
          ctx!.fillText(`${word[i]} · ${Math.round(box.w)}px`, box.x, box.y - 8);
          ctx!.font = `700 ${fontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        }
        ctx!.restore();
        x += m.width;
      }
      ctx!.setLineDash([]);
      ctx!.globalAlpha = 1;
      if (!reduced && (!pointer.inside || moving)) raf = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointer = {
        x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
        y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
        inside: true,
      };
      wake();
    };
    const onLeave = () => { pointer.inside = false; wake(); };

    const resizeObserver = new ResizeObserver(resize);
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerenter", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave);
    resizeObserver.observe(host);
    resize();
    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerenter", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={hostRef} className="anchon-tech-wordmark" role="img" aria-label="ANCHON">
      <canvas ref={canvasRef} className="anchon-tech-wordmark__canvas" />
    </div>
  );
}
