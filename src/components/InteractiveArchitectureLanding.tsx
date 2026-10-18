import { useEffect, useState } from "react";
import {
  ArrowDownRight, ArrowRight, Check, CircleDot, Database, GitBranch,
  Layers3, LockKeyhole, Play, RotateCcw, Server, ShieldCheck, Sparkles,
  Workflow, Zap,
} from "lucide-react";
import "./InteractiveArchitectureLanding.css";

type FlowNode = {
  id: string;
  title: string;
  kind: string;
  detail: string;
  role: string;
  icon: typeof Workflow;
  x: number;
  y: number;
  color: string;
};

const NODES: FlowNode[] = [
  { id: "client", title: "CLIENT", kind: "ENTRY POINT", detail: "A person opens ANCHON and describes the application they want to design.", role: "The request begins at the user interface.", icon: CircleDot, x: 7, y: 43, color: "#c4b5fd" },
  { id: "gateway", title: "API GATEWAY", kind: "ROUTING", detail: "The gateway receives the request, checks its shape, and routes it to the right capability.", role: "One entry point. Clear routing and boundaries.", icon: GitBranch, x: 28, y: 43, color: "#93c5fd" },
  { id: "service", title: "APP SERVICE", kind: "COMPUTE", detail: "Application logic validates the request and coordinates the work needed to produce a result.", role: "Business logic belongs in a service, not the database.", icon: Server, x: 50, y: 43, color: "#6ee7b7" },
  { id: "database", title: "DATA STORE", kind: "PERSISTENCE", detail: "The service reads or writes durable data through an explicit persistence boundary.", role: "Store state where it can be queried and protected.", icon: Database, x: 72, y: 25, color: "#fcd34d" },
  { id: "response", title: "RESPONSE", kind: "OUTPUT", detail: "The service returns a result to the client. The connection direction makes the request path legible.", role: "Trace the path from input to outcome.", icon: ShieldCheck, x: 91, y: 43, color: "#f0abfc" },
];

const CONNECTIONS = [
  { id: "c1", from: "client", to: "gateway", label: "HTTPS / REQUEST" },
  { id: "c2", from: "gateway", to: "service", label: "ROUTE" },
  { id: "c3", from: "service", to: "database", label: "QUERY" },
  { id: "c4", from: "database", to: "service", label: "DATA" },
  { id: "c5", from: "service", to: "response", label: "RESULT" },
];

export function InteractiveArchitectureLanding({ onOpenDesigner }: { onOpenDesigner: () => void }) {
  const [selected, setSelected] = useState("gateway");
  const [traceStep, setTraceStep] = useState(-1);
  const [completed, setCompleted] = useState<number[]>([]);
  const [showMission, setShowMission] = useState(false);
  const traceRunning = traceStep >= 0 && traceStep < 5;

  useEffect(() => {
    if (!traceRunning) return;
    const timer = window.setTimeout(() => {
      setCompleted((previous) => previous.includes(traceStep) ? previous : [...previous, traceStep]);
      if (traceStep >= 4) setTraceStep(5);
      else setTraceStep(traceStep + 1);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [traceStep, traceRunning]);

  const startTrace = () => {
    setCompleted([]);
    setTraceStep(0);
    setSelected("client");
    setShowMission(true);
  };
  const resetTrace = () => {
    setTraceStep(-1);
    setCompleted([]);
    setShowMission(false);
  };
  const current = NODES.find((node) => node.id === selected) ?? NODES[1];
  const CurrentIcon = current.icon;
  const finished = traceStep === 5;

  return (
    <main className="iad-root">
      <div className="iad-atmosphere" aria-hidden="true">
        <div className="iad-orbit iad-orbit-one" />
        <div className="iad-orbit iad-orbit-two" />
        <div className="iad-grid" />
        <div className="iad-glow iad-glow-left" />
        <div className="iad-glow iad-glow-right" />
      </div>

      <section className="iad-hero">
        <div className="iad-brandline"><span className="iad-brand-mark"><Workflow size={16} /></span> ANCHON <span className="iad-brand-divider" /> SYSTEM DESIGN, MADE VISIBLE</div>
        <div className="iad-headline-wrap">
          <p className="iad-overline"><span className="iad-live-dot" /> INTERACTIVE SYSTEM BLUEPRINT</p>
          <h1>Every application<br /><span>is a system.</span></h1>
          <p className="iad-intro">Follow a request through the architecture. Explore the components, see how they connect, and learn why each boundary exists.</p>
        </div>
      </section>

      <section className="iad-lab" aria-label="Interactive system design explorer">
        <div className="iad-lab-top">
          <div className="iad-lab-heading"><span className="iad-lab-index">01 / REQUEST FLOW</span><strong>From click to data and back</strong></div>
          <div className="iad-live-status"><span className={traceRunning ? "iad-live-dot is-running" : "iad-live-dot"} />{traceRunning ? "TRACING REQUEST" : finished ? "TRACE COMPLETE" : "SYSTEM READY"}</div>
        </div>

        <div className="iad-canvas">
          <div className="iad-canvas-meta"><span>REFERENCE ARCHITECTURE <b>·</b> WEB APPLICATION</span><span>SELECT A NODE TO INSPECT <ArrowDownRight size={12} /></span></div>
          <svg className="iad-wires" viewBox="0 0 1000 380" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="iad-wire-gradient"><stop offset="0%" stopColor="#c4b5fd" stopOpacity=".25" /><stop offset="50%" stopColor="#93c5fd" stopOpacity=".8" /><stop offset="100%" stopColor="#f0abfc" stopOpacity=".35" /></linearGradient>
              <marker id="iad-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#b5a6ff" /></marker>
            </defs>
            <path className="iad-wire-base" d="M125 190 H275" />
            <path className="iad-wire-base" d="M335 190 H490" />
            <path className="iad-wire-base" d="M550 180 C600 180 620 105 690 105" />
            <path className="iad-wire-base" d="M690 135 C630 135 610 220 550 220" />
            <path className="iad-wire-base" d="M550 190 H885" />
            <path className={completed.includes(0) ? "iad-wire-flow is-active" : "iad-wire-flow"} d="M125 190 H275" />
            <path className={completed.includes(1) ? "iad-wire-flow is-active" : "iad-wire-flow"} d="M335 190 H490" />
            <path className={completed.includes(2) ? "iad-wire-flow is-active" : "iad-wire-flow"} d="M550 180 C600 180 620 105 690 105" />
            <path className={completed.includes(3) ? "iad-wire-flow is-active" : "iad-wire-flow"} d="M690 135 C630 135 610 220 550 220" />
            <path className={completed.includes(4) ? "iad-wire-flow is-active" : "iad-wire-flow"} d="M550 190 H885" />
          </svg>
          {NODES.map((node, index) => {
            const NodeIcon = node.icon;
            const active = selected === node.id;
            const tracing = traceRunning && traceStep === index;
            const done = completed.includes(index);
            return (
              <button
                key={node.id}
                className={`iad-node iad-node-${node.id}${active ? " is-selected" : ""}${tracing ? " is-tracing" : ""}${done ? " is-complete" : ""}`}
                style={{ "--node-accent": node.color } as React.CSSProperties}
                onClick={() => setSelected(node.id)}
                aria-pressed={active}
                aria-label={`Inspect ${node.title}`}
              >
                <span className="iad-node-top"><span>{node.kind}</span>{done ? <Check size={12} /> : <span className="iad-node-pulse" />}</span>
                <span className="iad-node-icon"><NodeIcon size={18} strokeWidth={1.7} /></span>
                <strong>{node.title}</strong>
                <span className="iad-node-sub">{node.id === "client" ? "User interface" : node.id === "gateway" ? "Entry + routing" : node.id === "service" ? "Business logic" : node.id === "database" ? "Persistent state" : "Return payload"}</span>
                <span className="iad-node-ports"><i /><i /></span>
              </button>
            );
          })}
          <div className="iad-wire-label iad-label-request">REQUEST <span>→</span></div>
          <div className="iad-wire-label iad-label-query">QUERY / RESULT</div>
          <div className="iad-canvas-footer"><span><span className="iad-legend-dot" /> ACTIVE CONNECTION</span><span>5 NODES <b>·</b> 5 CONNECTIONS</span></div>
        </div>

        <div className="iad-inspector">
          <div className="iad-inspector-main">
            <div className="iad-inspector-icon" style={{ "--node-accent": current.color } as React.CSSProperties}><CurrentIcon size={19} /></div>
            <div className="iad-inspector-copy"><div className="iad-inspector-kicker">COMPONENT INSPECTOR <span>/{current.kind}</span></div><h2>{current.title}</h2><p>{current.detail}</p><div className="iad-inspector-role"><Sparkles size={13} />{current.role}</div></div>
          </div>
          <div className="iad-inspector-actions">
            <div className="iad-step-count"><span>{finished ? "TRACE FINISHED" : showMission ? `STEP ${Math.min(traceStep + 1, 5).toString().padStart(2, "0")} / 05` : "TRY THE FLOW"}</span><strong>{finished ? "Request delivered" : "Trace a request"}</strong></div>
            {finished ? <button className="iad-secondary-btn" onClick={resetTrace}><RotateCcw size={14} /> Replay</button> : <button className="iad-trace-btn" onClick={startTrace} disabled={traceRunning}><Play size={13} fill="currentColor" /> {traceRunning ? "Tracing…" : "Run request"} <ArrowRight size={14} /></button>}
          </div>
        </div>
        {finished && <div className="iad-success"><Check size={14} /> Request completed. You just traced a client request through routing, compute, persistence, and back.</div>}
      </section>

      <section className="iad-bottom">
        <div className="iad-bottom-copy"><span className="iad-overline">YOUR TURN</span><h2>Now design <span>your own.</span></h2><p>ANCHON turns your application idea into a connected, inspectable architecture. Build it visually or let AI propose a starting point.</p></div>
        <button className="iad-open-btn" onClick={onOpenDesigner}>Open architecture designer <ArrowRight size={16} /></button>
      </section>
      <div className="iad-footnote"><span><LockKeyhole size={11} /> BUILT FOR CLEARER SYSTEM THINKING</span><span><Layers3 size={11} /> VISUALIZE · CONNECT · REFINE</span><span><Zap size={11} /> INTERACTIVE BY DESIGN</span></div>
    </main>
  );
}
