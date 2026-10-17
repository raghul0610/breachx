import { useEffect, useRef, useState } from "react";
import { ArrowRight, Workflow, Download, Layers } from "lucide-react";
import { ShapeGridBackground } from "../components/ShapeGridBackground";

/* ─── helpers ─────────────────────────────────────────────── */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ─── static wordmark ────────────────────────────────────── */
function KineticHeading() {
  return (
    <h1 className="lp-hero-title" aria-label="ANCHON">
      <span>ANCHON</span>
    </h1>
  );
}

/* ─── marquee ─────────────────────────────────────────────── */
const MARQUEE_ITEMS = [
  "DESIGN", "CONNECT", "GENERATE", "REFINE", "EXPORT",
  "DESIGN", "CONNECT", "GENERATE", "REFINE", "EXPORT",
];

function Marquee({ reduced }: { reduced: boolean }) {
  return (
    <div className="lp-marquee-track" aria-hidden="true">
      <div className={`lp-marquee-inner${reduced ? " lp-marquee-paused" : ""}`}>
        {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
          <span key={i} className="lp-marquee-word">
            {item} <span className="lp-marquee-sep">/</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── step card ───────────────────────────────────────────── */
function StepCard({
  n, title, desc, delay, visible, reduced,
}: {
  n: number; title: string; desc: string; delay: number; visible: boolean; reduced: boolean;
}) {
  return (
    <div
      className="lp-step"
      style={
        reduced
          ? {}
          : {
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(28px)",
              transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
            }
      }
    >
      <div className="lp-step-num">{String(n).padStart(2, "0")}</div>
      <strong className="lp-step-title">{title}</strong>
      <p className="lp-step-desc">{desc}</p>
    </div>
  );
}

/* ─── feature card ────────────────────────────────────────── */
function FeatureCard({
  icon, title, desc, cta, onClick, delay, visible, reduced,
}: {
  icon: React.ReactNode; title: string; desc: string; cta: string;
  onClick: () => void; delay: number; visible: boolean; reduced: boolean;
}) {
  return (
    <button
      className="lp-feature-card"
      onClick={onClick}
      style={
        reduced
          ? {}
          : {
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(24px)",
              transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
            }
      }
    >
      <div className="lp-feature-icon">{icon}</div>
      <strong className="lp-feature-title">{title}</strong>
      <p className="lp-feature-desc">{desc}</p>
      <span className="lp-feature-cta">
        {cta} <ArrowRight size={13} />
      </span>
    </button>
  );
}

/* ─── main ────────────────────────────────────────────────── */
export function LandingPage({
  onOpenDesigner,
}: {
  onOpenDesigner: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [heroVisible, setHeroVisible] = useState(false);
  const featuresInView = useInView();
  const howInView = useInView();
  const closingInView = useInView();

  /* hero entrance */
  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), reduced ? 0 : 60);
    return () => clearTimeout(t);
  }, [reduced]);

  return (
    <div className="lp-root">
      <ShapeGridBackground />
      {/* ── hero ── */}
      <section className="lp-hero" aria-labelledby="lp-hero-heading">
        <div
          className="lp-hero-inner"
          style={
            reduced
              ? {}
              : {
                  opacity: heroVisible ? 1 : 0,
                  transform: heroVisible ? "translateY(0)" : "translateY(20px)",
                  transition: "opacity 0.7s ease, transform 0.7s ease",
                }
          }
        >
          <div className="lp-eyebrow">SYSTEM ARCHITECTURE PLATFORM</div>
          <KineticHeading />
          <p className="lp-hero-sub" id="lp-hero-heading">
            Design systems. Understand connections. Build better architecture.
          </p>
          <p className="lp-hero-copy">
            Design your system architecture visually or use the AI chat in the workspace to propose and apply changes directly to the canvas.
          </p>
          <div className="lp-hero-actions">
            <button className="lp-btn-primary" onClick={onOpenDesigner}>
              <Workflow size={16} />
              Open Architecture Designer
            </button>
          </div>
        </div>
      </section>

      {/* ── marquee ── */}
      <Marquee reduced={reduced} />

      {/* ── section B: two ways ── */}
      <section className="lp-section" aria-labelledby="lp-ways-heading">
        <div className="lp-section-inner" ref={featuresInView.ref}>
          <div className="lp-section-kicker">DESIGN WITH AI</div>
          <h2 className="lp-section-heading" id="lp-ways-heading">
            One workspace.<br />From idea to architecture.
          </h2>
          <div className="lp-features-grid lp-features-grid-single">
            <FeatureCard
              icon={<Workflow size={24} />}
              title="Visual Architecture Designer"
              desc="Build your architecture from the ground up. Drag components onto the canvas, connect them, edit their details, and export a professional PDF."
              cta="Start Designing"
              onClick={onOpenDesigner}
              delay={0}
              visible={featuresInView.visible}
              reduced={reduced}
            />

          </div>
        </div>
      </section>

      {/* ── section C: how it works ── */}
      <section className="lp-section lp-section-alt" aria-labelledby="lp-how-heading">
        <div className="lp-section-inner" ref={howInView.ref}>
          <div className="lp-section-kicker">HOW IT WORKS</div>
          <h2 className="lp-section-heading" id="lp-how-heading">
            Four steps from<br />idea to blueprint.
          </h2>
          <div className="lp-steps-grid">
            <StepCard n={1} title="Describe or start blank"
              desc="Enter your application name and requirements, or open a blank canvas to begin immediately."
              delay={0} visible={howInView.visible} reduced={reduced} />
            <StepCard n={2} title="Generate or build manually"
              desc="Let AI propose a connected architecture from your description, or drag components from the palette and wire them yourself."
              delay={100} visible={howInView.visible} reduced={reduced} />
            <StepCard n={3} title="Inspect and refine"
              desc="Click any component to edit its label and rationale. Add, remove, and reconnect nodes until the design is accurate."
              delay={200} visible={howInView.visible} reduced={reduced} />
            <StepCard n={4} title="Export your blueprint"
              desc="Download a professional PDF of your finished architecture, complete with component details and directed connections."
              delay={300} visible={howInView.visible} reduced={reduced} />
          </div>
          <div className="lp-steps-note">
            <Download size={12} />
            PDF export is available directly from the Architecture Designer.
          </div>
        </div>
      </section>

      {/* ── section D: closing CTA ── */}
      <section className="lp-section lp-closing" aria-labelledby="lp-closing-heading">
        <div className="lp-section-inner" ref={closingInView.ref}>
          <div
            className="lp-closing-inner"
            style={
              reduced
                ? {}
                : {
                    opacity: closingInView.visible ? 1 : 0,
                    transform: closingInView.visible ? "translateY(0)" : "translateY(24px)",
                    transition: "opacity 0.6s ease, transform 0.6s ease",
                  }
            }
          >
            <div className="lp-section-kicker">GET STARTED</div>
            <h2 className="lp-closing-heading" id="lp-closing-heading">
              Build something<br />
              <span className="lp-closing-accent">worth understanding.</span>
            </h2>
            <p className="lp-closing-sub">
              Open the designer and start placing components, or describe your application and let AI
              propose the architecture.
            </p>
            <div className="lp-hero-actions">
              <button className="lp-btn-primary" onClick={onOpenDesigner}>
                <Workflow size={16} />
                Open Architecture Designer
              </button>

            </div>
          </div>
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="lp-footer" role="contentinfo">
        <span className="lp-footer-brand">
          <Layers size={14} /> ANCHON
        </span>
        <span className="lp-footer-note">
          System Architecture Platform · {new Date().getFullYear()}
        </span>
      </footer>
    </div>
  );
}

