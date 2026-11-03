import { useCallback, useMemo, useState, type DragEvent } from "react";
import {
  Background, Controls, ReactFlow, addEdge, useEdgesState, useNodesState,
  type Connection, type Edge, type Node, type ReactFlowInstance,
} from "@xyflow/react";
import { Check, Eye, RotateCcw, Waypoints } from "lucide-react";

type Props = {
  topicId: string;
  title: string;
  prompt: string;
  explanation: string;
  onSolved: () => void;
  solved: boolean;
};
type PuzzleComponent = { id: string; label: string; description: string };
type Blueprint = {
  label: string;
  components: [PuzzleComponent, PuzzleComponent, PuzzleComponent, PuzzleComponent,
    PuzzleComponent, PuzzleComponent, PuzzleComponent, PuzzleComponent];
  correct: [string, string, string, string];
};

const blueprints: Blueprint[] = [
  {
    label: "Requirements and capacity",
    components: [
      { id: "actor", label: "User / Actor", description: "Creates the workload" },
      { id: "workload", label: "Workload Model", description: "Requests, reads and writes" },
      { id: "capacity", label: "Capacity Estimate", description: "Peak RPS and concurrency" },
      { id: "slo", label: "SLO / Constraints", description: "Latency and availability targets" },
      { id: "cdn", label: "CDN", description: "Edge asset delivery" },
      { id: "broker", label: "Message Broker", description: "Asynchronous delivery" },
      { id: "theme", label: "Theme Service", description: "Presentation preferences" },
      { id: "search", label: "Search Index", description: "Derived retrieval model" },
    ],
    correct: ["actor", "workload", "capacity", "slo"],
  },
  {
    label: "API request lifecycle",
    components: [
      { id: "client", label: "API Client", description: "Sends a request" },
      { id: "gateway", label: "API Gateway", description: "Routing and policy boundary" },
      { id: "service", label: "Domain Service", description: "Validates and executes the operation" },
      { id: "store", label: "Data Store", description: "Persists domain state" },
      { id: "cdn", label: "CDN", description: "Caches static content" },
      { id: "warehouse", label: "Analytics Warehouse", description: "Aggregated reporting" },
      { id: "scheduler", label: "Job Scheduler", description: "Starts scheduled work" },
      { id: "feature", label: "Feature Flag", description: "Controls gradual rollout" },
    ],
    correct: ["client", "gateway", "service", "store"],
  },
  {
    label: "Transactional data ownership",
    components: [
      { id: "command", label: "Command Handler", description: "Accepts a domain operation" },
      { id: "transaction", label: "Transaction Manager", description: "Enforces atomic state change" },
      { id: "primary", label: "Primary Database", description: "Authoritative committed state" },
      { id: "readmodel", label: "Read Model", description: "Query-optimized projection" },
      { id: "cdn", label: "CDN", description: "Edge content cache" },
      { id: "queue", label: "Message Queue", description: "Buffers asynchronous work" },
      { id: "identity", label: "Identity Provider", description: "Authenticates principals" },
      { id: "object", label: "Object Storage", description: "Stores binary objects" },
    ],
    correct: ["command", "transaction", "primary", "readmodel"],
  },
  {
    label: "Asynchronous processing",
    components: [
      { id: "api", label: "Upload / API", description: "Accepts and validates work" },
      { id: "object", label: "Object Storage", description: "Stores the durable input" },
      { id: "queue", label: "Durable Queue", description: "Buffers processing jobs" },
      { id: "worker", label: "Worker Pool", description: "Processes jobs independently" },
      { id: "cdn", label: "CDN", description: "Delivers completed assets" },
      { id: "browser", label: "Browser Cache", description: "Local response cache" },
      { id: "gateway", label: "API Gateway", description: "External routing boundary" },
      { id: "replica", label: "Read Replica", description: "Scales eligible reads" },
    ],
    correct: ["api", "object", "queue", "worker"],
  },
  {
    label: "Caching and read scaling",
    components: [
      { id: "caller", label: "Read Client", description: "Requests frequently-read data" },
      { id: "service", label: "Application Service", description: "Applies cache-aside logic" },
      { id: "cache", label: "Distributed Cache", description: "Serves hot values with bounded TTL" },
      { id: "database", label: "Primary Database", description: "Source of truth on cache miss" },
      { id: "queue", label: "Dead-letter Queue", description: "Stores failed messages" },
      { id: "cdn", label: "CDN", description: "Caches static assets" },
      { id: "worker", label: "Batch Worker", description: "Runs offline jobs" },
      { id: "identity", label: "Identity Provider", description: "Issues identity claims" },
    ],
    correct: ["caller", "service", "cache", "database"],
  },
  {
    label: "Distributed event flow",
    components: [
      { id: "producer", label: "Event Producer", description: "Publishes a domain event" },
      { id: "broker", label: "Partitioned Broker", description: "Durably orders keyed events" },
      { id: "consumer", label: "Idempotent Consumer", description: "Deduplicates and applies events" },
      { id: "projection", label: "Read Projection", description: "Stores derived state" },
      { id: "cdn", label: "CDN", description: "Caches public content" },
      { id: "gateway", label: "API Gateway", description: "Routes synchronous calls" },
      { id: "cron", label: "Cron Scheduler", description: "Starts periodic tasks" },
      { id: "vault", label: "Secrets Vault", description: "Stores workload credentials" },
    ],
    correct: ["producer", "broker", "consumer", "projection"],
  },
  {
    label: "Reliability and recovery",
    components: [
      { id: "request", label: "Request Handler", description: "Sets a request deadline" },
      { id: "breaker", label: "Circuit Breaker", description: "Stops calls to an unhealthy dependency" },
      { id: "dependency", label: "Downstream Service", description: "Potentially failing dependency" },
      { id: "telemetry", label: "Health Telemetry", description: "Measures errors and recovery" },
      { id: "cdn", label: "CDN", description: "Caches static assets" },
      { id: "search", label: "Search Index", description: "Indexes domain records" },
      { id: "theme", label: "Theme Service", description: "Stores UI preferences" },
      { id: "replica", label: "Read Replica", description: "Serves replicated reads" },
    ],
    correct: ["request", "breaker", "dependency", "telemetry"],
  },
  {
    label: "Security and authorization",
    components: [
      { id: "client", label: "Untrusted Client", description: "Supplies a request and token" },
      { id: "identity", label: "Identity Provider", description: "Verifies the principal" },
      { id: "policy", label: "Authorization Policy", description: "Checks tenant and resource access" },
      { id: "resource", label: "Protected Resource", description: "Allows only authorized operations" },
      { id: "cdn", label: "CDN", description: "Caches public assets" },
      { id: "queue", label: "Message Queue", description: "Buffers background work" },
      { id: "analytics", label: "Analytics Store", description: "Stores aggregate metrics" },
      { id: "worker", label: "Worker Pool", description: "Executes background jobs" },
    ],
    correct: ["client", "identity", "policy", "resource"],
  },
  {
    label: "Observability pipeline",
    components: [
      { id: "service", label: "Instrumented Service", description: "Emits metrics, logs and spans" },
      { id: "collector", label: "Telemetry Collector", description: "Receives and batches signals" },
      { id: "pipeline", label: "Telemetry Pipeline", description: "Processes and routes signals" },
      { id: "backend", label: "Observability Backend", description: "Queries, correlates and alerts" },
      { id: "database", label: "Primary Database", description: "Stores business state" },
      { id: "cdn", label: "CDN", description: "Delivers static content" },
      { id: "gateway", label: "API Gateway", description: "Routes user traffic" },
      { id: "queue", label: "Business Queue", description: "Buffers domain jobs" },
    ],
    correct: ["service", "collector", "pipeline", "backend"],
  },
  {
    label: "Global architecture",
    components: [
      { id: "user", label: "Global User", description: "Connects from a nearby region" },
      { id: "edge", label: "Global Edge", description: "Terminates and steers traffic" },
      { id: "regional", label: "Regional Gateway", description: "Routes within the selected region" },
      { id: "origin", label: "Regional Origin", description: "Owns regional application traffic" },
      { id: "theme", label: "Theme Service", description: "Stores interface preferences" },
      { id: "cron", label: "Cron Scheduler", description: "Runs periodic jobs" },
      { id: "warehouse", label: "Analytics Warehouse", description: "Stores reporting aggregates" },
      { id: "queue", label: "Dead-letter Queue", description: "Captures failed messages" },
    ],
    correct: ["user", "edge", "regional", "origin"],
  },
];

function selectBlueprint(topicId: string, title: string): Blueprint {
  const text = title.toLowerCase();
  const keywordGroups: [string[], number][] = [
    [["requirement", "stakeholder", "capacity", "rps", "concurrency", "bandwidth", "workload", "estimate"], 0],
    [["api", "http", "gateway", "request", "stateless", "pagination", "version", "contract", "validation", "bff"], 1],
    [["data", "database", "relational", "transaction", "normalization", "index", "schema", "persistence", "ledger", "storage"], 2],
    [["queue", "async", "asynchronous", "worker", "message", "outbox", "delivery", "eventual"], 3],
    [["cache", "read", "scale", "traffic", "load balanc", "cdn", "shard", "rate limit", "backpressure"], 4],
    [["distributed", "consistency", "replica", "quorum", "consensus", "partition", "saga", "split brain", "cap theorem"], 5],
    [["reliability", "fault", "timeout", "retry", "circuit", "bulkhead", "recovery", "slo", "rpo", "rto"], 6],
    [["security", "privacy", "authorization", "authentication", "threat", "tenant", "encryption", "secret", "audit"], 7],
    [["observability", "deployment", "operations", "metrics", "logging", "tracing", "canary", "rollback", "incident", "cost"], 8],
    [["global", "region", "regional", "active-active", "residency", "edge", "multi-region"], 9],
  ];
  const match = keywordGroups.find(([keywords]) => keywords.some(keyword => text.includes(keyword)));
  if (match) return blueprints[match[1]];
  const seed = Array.from(topicId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return blueprints[seed % blueprints.length];
}

const nodeStyle = {
  width: 190, minHeight: 82, display: "grid", placeItems: "center",
  border: "1px solid #71818a", borderRadius: 12, background: "#202a30",
  color: "#eef3f5", fontSize: 13, fontWeight: 700, padding: 12,
  boxShadow: "0 8px 22px rgba(0,0,0,.18)",
};

export function TopicConnectionPuzzle({ topicId, title, prompt, explanation, onSolved, solved }: Props) {
  const blueprint = useMemo(() => selectBlueprint(topicId, title), [topicId, title]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [instance, setInstance] = useState<ReactFlowInstance | null>(null);
  const [feedback, setFeedback] = useState("");
  const [revealed, setRevealed] = useState(solved);
  const [passed, setPassed] = useState(solved);
  const placed = useMemo(() => new Set(nodes.map(node => String(node.data.componentId))), [nodes]);

  const addComponent = useCallback((component: PuzzleComponent, position: { x: number; y: number }) => {
    if (placed.has(component.id)) return;
    const node: Node = {
      id: component.id,
      type: "default",
      position,
      data: {
        componentId: component.id,
        label: <div style={{ display: "grid", gap: 5, textAlign: "center" }}>
          <strong>{component.label}</strong>
          <span style={{ color: "#aab8be", fontSize: 10, fontWeight: 500 }}>{component.description}</span>
        </div>,
      },
      style: nodeStyle,
    };
    setNodes(current => [...current, node]);
    setFeedback("");
    setPassed(false);
  }, [placed, setNodes]);

  const onDragStart = (event: DragEvent<HTMLButtonElement>, component: PuzzleComponent) => {
    event.dataTransfer.setData("application/anchon-academy-component", component.id);
    event.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("application/anchon-academy-component");
    const component = blueprint.components.find(item => item.id === id);
    if (!component || !instance) return;
    addComponent(component, instance.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };
  const connect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    setEdges(current => addEdge({
      ...connection,
      id: `${connection.source}-${connection.target}-${current.length}`,
      animated: true,
      style: { stroke: "#d4dde1", strokeWidth: 2 },
    }, current));
    setFeedback("");
    setPassed(false);
  }, [setEdges]);

  const expectedEdges = useMemo(() => [
    [blueprint.correct[0], blueprint.correct[1]],
    [blueprint.correct[1], blueprint.correct[2]],
    [blueprint.correct[2], blueprint.correct[3]],
  ], [blueprint]);
  const check = () => {
    const selectedCorrect = blueprint.correct.every(id => placed.has(id));
    const noDistractors = nodes.every(node => blueprint.correct.includes(String(node.data.componentId)));
    const connectedCorrectly = expectedEdges.every(([source, target]) =>
      edges.some(edge => edge.source === source && edge.target === target)
    );
    if (selectedCorrect && noDistractors && nodes.length === 4 && connectedCorrectly && edges.length === 3) {
      setPassed(true);
      setFeedback("Architecture verified. You selected the four relevant components and connected the complete flow in the correct direction.");
      setRevealed(true);
      onSolved();
      return;
    }
    setPassed(false);
    setRevealed(true);
    const issues: string[] = [];
    if (!selectedCorrect) issues.push("One or more required components are missing.");
    if (!noDistractors || nodes.length !== 4) issues.push("Use exactly four components. Remove distractors and keep only the components that own this responsibility.");
    if (!connectedCorrectly || edges.length !== 3) issues.push("The four components must form the complete three-step directed flow shown in the revealed solution.");
    setFeedback(issues.join(" "));
  };
  const reset = () => {
    setNodes([]);
    setEdges([]);
    setFeedback("");
    setPassed(false);
    setRevealed(false);
  };
  const removeNode = (id: string) => {
    setNodes(current => current.filter(node => node.id !== id));
    setEdges(current => current.filter(edge => edge.source !== id && edge.target !== id));
    setPassed(false);
    setFeedback("");
  };

  return <section className="academy-topic-puzzle">
    <header>
      <span><Waypoints size={15} /> ARCHITECTURE PUZZLE</span>
      <small>{passed || solved ? "SOLVED" : "4 CORRECT COMPONENTS · 8 OPTIONS"}</small>
    </header>
    <h4>{title}: select and connect the architecture</h4>
    <p>{prompt} Choose four relevant components from the eight options, drag them onto the canvas, then connect their handles in the correct direction.</p>

    <div className="academy-topic-builder">
      <aside className="academy-topic-component-bank">
        <div className="academy-topic-bank-heading">
          <strong>COMPONENT OPTIONS</strong>
          <span>{placed.size}/4 placed</span>
        </div>
        <div className="academy-topic-component-grid">
          {blueprint.components.map(component => (
            <button
              type="button"
              key={component.id}
              draggable={!placed.has(component.id)}
              disabled={placed.has(component.id)}
              onDragStart={event => onDragStart(event, component)}
              className={placed.has(component.id) ? "placed" : ""}
              title={component.description}
            >
              <strong>{component.label}</strong>
              <small>{component.description}</small>
              {placed.has(component.id) && <span><Check size={12} /> ON CANVAS</span>}
            </button>
          ))}
        </div>
      </aside>
      <div className="academy-topic-flow" onDragOver={onDragOver} onDrop={onDrop}>
        <div className="academy-topic-flow-label">DESIGN CANVAS <span>{nodes.length} components · {edges.length} connections</span></div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={connect}
          onInit={setInstance}
          fitView
          fitViewOptions={{ padding: .18 }}
          minZoom={.25}
          maxZoom={1.5}
          nodesDraggable
          nodesConnectable
          elementsSelectable
          deleteKeyCode={["Backspace", "Delete"]}
        >
          <Background gap={20} color="#43525a" size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
        {nodes.length === 0 && <div className="academy-topic-empty">Drag components from the options into this canvas.</div>}
      </div>
    </div>

    <div className="academy-topic-puzzle-actions">
      <span>Build the flow yourself. Do not add all eight—four are deliberate distractors.</span>
      <div>
        <button type="button" onClick={reset}><RotateCcw size={13} /> Reset</button>
        <button type="button" onClick={() => setRevealed(true)}><Eye size={13} /> Reveal answer</button>
        <button type="button" onClick={check}><Check size={13} /> Check design</button>
      </div>
    </div>
    {feedback && <p className={passed ? "academy-topic-feedback success" : "academy-topic-feedback"} role="status">{feedback}</p>}
    {revealed && <div className="academy-topic-solution">
      <div><strong>REFERENCE SOLUTION · {blueprint.label.toUpperCase()}</strong><span>Correct components and connection order</span></div>
      <ol>{blueprint.correct.map((id, index) => {
        const component = blueprint.components.find(item => item.id === id)!;
        return <li key={id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{component.label}</strong><small>{component.description}</small></li>;
      })}</ol>
      <p className="academy-topic-solution-flow">{blueprint.correct.map((id, index) => blueprint.components.find(item => item.id === id)!.label).join("  →  ")}</p>
      <p><strong>WHY THIS IS CORRECT</strong>{explanation}</p>
    </div>}
    {(passed || solved) && <p className="academy-topic-explanation"><strong>TAKEAWAY</strong>{explanation}</p>}
  </section>;
}
