import { useMemo, useState } from "react";
import { addEdge, Background, Controls, ReactFlow, useEdgesState, useNodesState, type Connection, type Edge, type Node } from "@xyflow/react";
import { Database, Play, Plus, Radio, Server, Zap } from "lucide-react";

type PracticeNodeData = { label: string; detail: string };
const initialNodes: Node<PracticeNodeData>[] = [
  { id: "client", type: "input", position: { x: 30, y: 100 }, data: { label: "Client", detail: "Sends HTTP request" } },
  { id: "api", position: { x: 280, y: 100 }, data: { label: "API service", detail: "Validates and routes" } },
  { id: "db", type: "output", position: { x: 530, y: 100 }, data: { label: "Database", detail: "Persists the record" } },
];
const initialEdges: Edge[] = [
  { id: "client-api", source: "client", target: "api", label: "POST /items", animated: true },
  { id: "api-db", source: "api", target: "db", label: "INSERT", animated: true },
];

export function LearnPracticeCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [trace, setTrace] = useState<string[]>([]);
  const [runState, setRunState] = useState<"idle" | "success" | "error">("idle");
  const nodeTypes = useMemo(() => ({}), []);

  const addService = (kind: "cache" | "queue" | "worker") => {
    const id = `${kind}-${Date.now()}`;
    const label = kind === "cache" ? "Cache" : kind === "queue" ? "Message queue" : "Worker";
    const detail = kind === "cache" ? "Stores hot reads" : kind === "queue" ? "Buffers asynchronous work" : "Processes background jobs";
    setNodes((current) => [...current, { id, position: { x: 270, y: 230 + current.length * 22 }, data: { label, detail } }]);
    setRunState("idle");
  };
  const connect = (connection: Connection) => {
    setEdges((current) => addEdge({ ...connection, animated: true, label: "request" }, current));
    setRunState("idle");
  };
  const runRequest = () => {
    const start = nodes.find((node) => node.type === "input" || node.id === "client");
    const end = nodes.find((node) => node.type === "output" || node.id === "db");
    if (!start || !end) {
      setRunState("error");
      setTrace(["Request could not run: the canvas needs a Client and a Database node."]);
      return;
    }
    const visited = new Set<string>();
    const queue: string[][] = [[start.id]];
    let path: string[] | null = null;
    while (queue.length) {
      const candidate = queue.shift()!;
      const current = candidate[candidate.length - 1];
      if (current === end.id) { path = candidate; break; }
      if (visited.has(current)) continue;
      visited.add(current);
      edges.filter((edge) => edge.source === current).forEach((edge) => queue.push([...candidate, edge.target]));
    }
    if (!path) {
      setRunState("error");
      setTrace(["No request path reaches the database.", "Connect the Client through your services to the Database, then run again."]);
      return;
    }
    const labels = path.map((id) => nodes.find((node) => node.id === id)?.data.label ?? id);
    setRunState("success");
    setTrace([ "POST /items · 201 Created", ...labels.map((label, index) => `${index + 1}. ${label} received the request`), "Database write acknowledged · response returned to Client" ]);
  };

  return <section className="learn-practice">
    <div className="learn-practice-heading"><div><span className="learn-eyebrow">HANDS-ON LAB</span><h3>Build a request path</h3><p>Add infrastructure, connect the nodes, then run a simulated request through your design.</p></div><button type="button" className="primary-btn compact" onClick={runRequest}><Play size={13}/> Run request</button></div>
    <div className="learn-practice-toolbar">
      <button type="button" onClick={() => addService("cache")}><Zap size={13}/> Add cache</button>
      <button type="button" onClick={() => addService("queue")}><Radio size={13}/> Add queue</button>
      <button type="button" onClick={() => addService("worker")}><Server size={13}/> Add worker</button>
      <button type="button" onClick={() => { setNodes(initialNodes); setEdges(initialEdges); setTrace([]); setRunState("idle"); }}>Reset lab</button>
      <span><Database size={12}/> Connect handles to define the flow</span>
    </div>
    <div className="learn-practice-flow"><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={connect} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.35} maxZoom={1.5} nodesDraggable nodesConnectable elementsSelectable nodeOrigin={[0,0]}><Background gap={18} size={1} /><Controls showInteractive={false}/></ReactFlow></div>
    <div className={`learn-practice-trace ${runState}`} aria-live="polite"><strong>{runState === "success" ? "Request completed" : runState === "error" ? "Request blocked" : "Request trace"}</strong>{trace.length ? trace.map((line, index) => <p key={index}>{line}</p>) : <p>Run the request to inspect the simulated flow and response.</p>}</div>
  </section>;
}
