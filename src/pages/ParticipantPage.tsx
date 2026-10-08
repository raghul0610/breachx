import { useCallback, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  MarkerType,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { ArrowLeft, FileText, Layers, Save, Send, Trash2 } from "lucide-react";
import { BlueprintNode, type BlueprintNodeData } from "../components/BlueprintNode";
import { CATALOG, type CatalogItem } from "../lib/catalog";
import { readSubmission, writeSubmission, logActivity, type DesignSubmission } from "../lib/storage";
import { type EvaluationNode } from "../lib/evaluationEngine";
import { evaluateSystemDesignWithAI } from "../lib/evaluationClient";
import { writeEvaluation } from "../lib/evaluationStorage";

const initialNodes: Node<BlueprintNodeData>[] = [
  {
    id: "node-1",
    type: "blueprintNode",
    position: { x: 80, y: 160 },
    data: { label: "Client / User App", typeKey: "client", category: "Edge" },
  },
  {
    id: "node-2",
    type: "blueprintNode",
    position: { x: 330, y: 160 },
    data: { label: "WAF / Firewall", typeKey: "firewall", category: "Security" },
  },
  {
    id: "node-3",
    type: "blueprintNode",
    position: { x: 590, y: 160 },
    data: { label: "API Gateway", typeKey: "api_gateway", category: "Routing" },
  },
];

const initialEdges: Edge[] = [
  {
    id: "e1-2",
    source: "node-1",
    target: "node-2",
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "e2-3",
    source: "node-2",
    target: "node-3",
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
  },
];

export function ParticipantPage({
  onBack,
  onEvaluated,
}: {
  onBack: () => void;
  onEvaluated: () => void;
}) {
  const saved = readSubmission();
  const [entryMode, setEntryMode] = useState<"chooser" | "reconstruct" | "new">(
    saved?.status === "submitted" ? "chooser" : saved ? "reconstruct" : "new",
  );

  if (entryMode === "chooser" && saved?.status === "submitted") {
    return (
      <div className="app-shell">
        <header className="topbar">
          <button className="nav-btn" onClick={onBack}>
            <ArrowLeft size={14} /> BACK
          </button>
          <div>
            <strong>BREACH X</strong>
            <span className="topbar-sub"> // SYSTEM DESIGN EVALUATOR</span>
          </div>
          <span className="status-pill">SUBMISSION COMPLETE</span>
        </header>

        <main className="admin-content">
          <section className="panel control-hero">
            <div className="section-kicker">DESIGN WORKSPACE</div>
            <h1>WHAT DO YOU WANT TO DO NEXT?</h1>
            <p>
              Your submitted architecture is locked as a completed evaluation.
              You can reconstruct it as a new editable design or start a new design from the starter canvas.
            </p>
            <div className="home-actions">
              <button
                className="primary-btn"
                onClick={() => {
                  writeSubmission({ ...saved, status: "draft", updatedAt: new Date().toISOString() });
                  setEntryMode("reconstruct");
                }}
              >
                RECONSTRUCT SUBMITTED DESIGN
              </button>
              <button
                className="outline-btn"
                onClick={() => {
                  localStorage.removeItem("breachx-design");
                  setEntryMode("new");
                }}
              >
                START NEW DESIGN
              </button>
            </div>
            <div className="tiny">
              The existing evaluation report remains available while you build the next design.
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <ParticipantEditor
        onBack={onBack}
        onEvaluated={onEvaluated}
        startingSubmission={entryMode === "reconstruct" && saved ? { ...saved, status: "draft" } : null}
      />
    </ReactFlowProvider>
  );
}

function ParticipantEditor({
  onBack,
  onEvaluated,
  startingSubmission,
}: {
  onBack: () => void;
  onEvaluated: () => void;
  startingSubmission: DesignSubmission | null;
}) {
  const { screenToFlowPosition, getViewport } = useReactFlow();
  const saved = startingSubmission;

  const [nodes, setNodes, onNodesChange] = useNodesState(
    (saved?.nodes as Node<BlueprintNodeData>[]) ?? initialNodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    (saved?.edges as Edge[]) ?? initialEdges,
  );
  const [applicationName, setApplicationName] = useState(
    saved?.applicationName ?? "My System Design",
  );
  const [applicationDescription, setApplicationDescription] = useState(
    saved?.applicationDescription ??
      "Describe the application, expected users, traffic and important requirements.",
  );
  const [notes, setNotes] = useState(saved?.notes ?? "");
  const [expectedUsers, setExpectedUsers] = useState(saved?.workload?.expectedUsers?.toString() ?? "");
  const [concurrentUsers, setConcurrentUsers] = useState(saved?.workload?.concurrentUsers?.toString() ?? "");
  const [peakRps, setPeakRps] = useState(saved?.workload?.peakRps?.toString() ?? "");
  const [growthPercent, setGrowthPercent] = useState(saved?.workload?.growthPercent?.toString() ?? "");
  const [availabilityTarget, setAvailabilityTarget] = useState(saved?.workload?.availabilityTarget?.toString() ?? "");
  const [latencyMs, setLatencyMs] = useState(saved?.workload?.latencyMs?.toString() ?? "");
  const [geography, setGeography] = useState<"single_region" | "multi_region" | "global">(saved?.workload?.geography ?? "single_region");
  const [budget, setBudget] = useState<"low" | "moderate" | "high">(saved?.workload?.budget ?? "moderate");
  const [features, setFeatures] = useState(saved?.workload?.features?.join("\n") ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(saved?.status === "submitted");
  const [persisting, setPersisting] = useState(false);

  const nodeTypes = useMemo(() => ({ blueprintNode: BlueprintNode }), []);
  const selected = nodes.find((node) => node.id === selectedId);
  const canSubmit =
    !submitted &&
    applicationName.trim().length > 0 &&
    applicationDescription.trim().length > 0 &&
    nodes.length >= 3 &&
    edges.length >= 2;

  const addCatalogNode = (
    item: CatalogItem,
    position?: { x: number; y: number },
  ) => {
    if (submitted) return;

    const id = crypto.randomUUID();
    setNodes((current) => [
      ...current,
      {
        id,
        type: "blueprintNode",
        position:
          position ?? { x: 120 + Math.random() * 420, y: 90 + Math.random() * 320 },
        data: {
          label: item.label,
          typeKey: item.typeKey,
          category: item.category,
        },
      },
    ]);
    setSelectedId(id);
    logActivity("NODE_ADDED", { typeKey: item.typeKey });
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (submitted) return;

      const typeKey = event.dataTransfer.getData(
        "application/breachx-component",
      );
      const item = CATALOG.find((entry) => entry.typeKey === typeKey);

      if (item) {
        addCatalogNode(
          item,
          screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        );
      }
    },
    [screenToFlowPosition, submitted],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (submitted) return;

      setEdges((current) =>
        addEdge(
          {
            ...connection,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          current,
        ),
      );
      logActivity("EDGE_CREATED", {
        source: connection.source,
        target: connection.target,
      });
    },
    [setEdges, submitted],
  );

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      if (!submitted) onNodesChange(changes);
    },
    [onNodesChange, submitted],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      if (!submitted) onEdgesChange(changes);
    },
    [onEdgesChange, submitted],
  );

  const save = async (submissionStatus: "draft" | "submitted") => {
    if (submitted) return;

    if (submissionStatus === "submitted" && !canSubmit) {
      alert(
        "Submission requires an application description, at least 3 components and 2 connections.",
      );
      return;
    }

    setPersisting(true);

    try {
      const viewport = getViewport();
      const submission = {
        applicationName: applicationName.trim(),
        applicationDescription: applicationDescription.trim(),
        nodes,
        edges,
        notes,
        workload: {
          expectedUsers: Number(expectedUsers) || undefined,
          concurrentUsers: Number(concurrentUsers) || undefined,
          peakRps: Number(peakRps) || undefined,
          growthPercent: Number(growthPercent) || undefined,
          availabilityTarget: Number(availabilityTarget) || undefined,
          latencyMs: Number(latencyMs) || undefined,
          geography,
          budget,
          features: features.split("\n").map((item) => item.trim()).filter(Boolean),
        },
        status: submissionStatus,
        updatedAt: new Date().toISOString(),
      };

      writeSubmission(submission);
      logActivity(
        submissionStatus === "submitted"
          ? "DESIGN_SUBMITTED"
          : "DESIGN_SAVED",
        { nodes: nodes.length, edges: edges.length },
      );

      if (submissionStatus === "submitted") {
        const result = await evaluateSystemDesignWithAI({
          application: {
            name: applicationName.trim(),
            description: applicationDescription.trim(),
          },
          nodes: nodes as unknown as EvaluationNode[],
          edges: edges as unknown as {
            id?: string;
            source: string;
            target: string;
          }[],
          notes,
          workload: {
            expectedUsers: Number(expectedUsers) || undefined,
            concurrentUsers: Number(concurrentUsers) || undefined,
            peakRps: Number(peakRps) || undefined,
            growthPercent: Number(growthPercent) || undefined,
            availabilityTarget: Number(availabilityTarget) || undefined,
            latencyMs: Number(latencyMs) || undefined,
            geography,
            budget,
            features: features.split("\n").map((item) => item.trim()).filter(Boolean),
          },
        });

        writeEvaluation(result);
        setSubmitted(true);
        alert("Design evaluated successfully. Your report is ready.");
        onEvaluated();
      } else {
        alert("Draft saved.");
      }

      void viewport;
    } finally {
      setPersisting(false);
    }
  };

  const updateSelected = (field: "label" | "notes", value: string) => {
    if (!selectedId || submitted) return;

    setNodes((current) =>
      current.map((node) =>
        node.id === selectedId
          ? { ...node, data: { ...node.data, [field]: value } }
          : node,
      ),
    );
  };

  const removeSelected = () => {
    if (!selectedId || submitted) return;

    setNodes((current) =>
      current.filter((node) => node.id !== selectedId),
    );
    setEdges((current) =>
      current.filter(
        (edge) => edge.source !== selectedId && edge.target !== selectedId,
      ),
    );
    logActivity("NODE_DELETED", { nodeId: selectedId });
    setSelectedId(null);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="nav-btn" onClick={onBack}>
          <ArrowLeft size={14} /> HOME
        </button>
        <div>
          <strong>BREACH X</strong>
          <span className="topbar-sub"> // SYSTEM DESIGN EVALUATOR</span>
        </div>
        <span className="status-pill">
          {submitted ? "SUBMITTED" : "DESIGNING"}
        </span>
      </header>

      <section className="problem-banner">
        <div className="section-kicker">
          <FileText size={13} /> APPLICATION TO EVALUATE
        </div>

        <div className="field">
          <label>APPLICATION NAME</label>
          <input
            value={applicationName}
            onChange={(event) => setApplicationName(event.target.value)}
            disabled={submitted}
          />
        </div>

        <div className="field">
          <label>APPLICATION REQUIREMENTS</label>
          <textarea
            rows={4}
            value={applicationDescription}
            onChange={(event) => setApplicationDescription(event.target.value)}
            disabled={submitted}
          />
        </div>
        <div className="workload-section">
          <div className="section-kicker">WORKLOAD & CONSTRAINTS</div>
          <div className="workload-grid">
            <div className="field"><label>EXPECTED USERS</label><input type="number" min="0" value={expectedUsers} onChange={(e) => setExpectedUsers(e.target.value)} placeholder="e.g. 100000" disabled={submitted} /></div>
            <div className="field"><label>PEAK CONCURRENT USERS</label><input type="number" min="0" value={concurrentUsers} onChange={(e) => setConcurrentUsers(e.target.value)} placeholder="e.g. 5000" disabled={submitted} /></div>
            <div className="field"><label>PEAK RPS</label><input type="number" min="0" value={peakRps} onChange={(e) => setPeakRps(e.target.value)} placeholder="e.g. 500" disabled={submitted} /></div>
            <div className="field"><label>ANNUAL GROWTH %</label><input type="number" min="0" value={growthPercent} onChange={(e) => setGrowthPercent(e.target.value)} placeholder="e.g. 30" disabled={submitted} /></div>
            <div className="field"><label>AVAILABILITY %</label><input type="number" min="0" max="100" step="0.01" value={availabilityTarget} onChange={(e) => setAvailabilityTarget(e.target.value)} placeholder="e.g. 99.9" disabled={submitted} /></div>
            <div className="field"><label>LATENCY TARGET (MS)</label><input type="number" min="0" value={latencyMs} onChange={(e) => setLatencyMs(e.target.value)} placeholder="e.g. 200" disabled={submitted} /></div>
            <div className="field"><label>GEOGRAPHIC SCOPE</label><select value={geography} onChange={(e) => setGeography(e.target.value as typeof geography)} disabled={submitted}><option value="single_region">Single region</option><option value="multi_region">Multi-region</option><option value="global">Global</option></select></div>
            <div className="field"><label>COMPLEXITY / BUDGET</label><select value={budget} onChange={(e) => setBudget(e.target.value as typeof budget)} disabled={submitted}><option value="low">Keep infrastructure simple / low cost</option><option value="moderate">Moderate</option><option value="high">High budget / complexity acceptable</option></select></div>
          </div>
          <div className="field">
            <label>MAJOR FEATURES / WORKFLOWS</label>
            <textarea rows={3} value={features} onChange={(e) => setFeatures(e.target.value)} placeholder={"One feature per line, e.g.\nreal-time driver tracking\npayments\npush notifications\norder history"} disabled={submitted} />
          </div>
          <div className="tiny">These constraints are evaluated before component choice. Advanced infrastructure is not rewarded unless the workload or requirements justify it.</div>
        </div>
      </section>

      <div className="workspace">
        <aside className="sidebar left-panel">
          <div className="section-kicker">
            <Layers size={13} /> COMPONENT PALETTE
          </div>

          {CATALOG.map((item) => (
            <button
              key={item.typeKey}
              className="catalog-item"
              draggable={!submitted}
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  "application/breachx-component",
                  item.typeKey,
                );
                event.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => addCatalogNode(item)}
              disabled={submitted}
            >
              <span>{item.label}</span>
              <small>{item.category}</small>
            </button>
          ))}

          <div className="help-box">
            <strong>HOW TO CONNECT</strong>
            <p>
              Drag from a colored handle on one component to a handle on
              another to create a directional connection.
            </p>
          </div>
        </aside>

        <section className="canvas">
          <div className="canvas-toolbar">
            <div>
              <div className="section-kicker">
                <Layers size={13} /> SYSTEM DESIGN WORKSPACE
              </div>
              <span className="counter">
                {nodes.length} components · {edges.length} connections
              </span>
            </div>

            <div className="toolbar-actions">
              <button
                onClick={() => save("draft")}
                disabled={persisting || submitted}
              >
                <Save size={13} /> {persisting ? "SAVING…" : "SAVE DRAFT"}
              </button>
              <button
                className="primary-btn compact"
                disabled={!canSubmit || persisting}
                onClick={() => save("submitted")}
              >
                <Send size={13} />{" "}
                {submitted ? "SUBMITTED" : "SUBMIT & EVALUATE"}
              </button>
            </div>
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={onDrop}
            fitView
            snapToGrid
            snapGrid={[16, 16]}
            colorMode="dark"
            defaultEdgeOptions={{
              animated: true,
              markerEnd: { type: MarkerType.ArrowClosed },
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.4}
            />
            <Controls position="bottom-left" />
            <MiniMap position="bottom-right" />
          </ReactFlow>
        </section>

        <aside className="sidebar right-panel">
          <div className="section-kicker">INSPECTOR</div>

          {selected ? (
            <>
              <div className="field">
                <label>COMPONENT LABEL</label>
                <input
                  value={selected.data.label}
                  disabled={submitted}
                  onChange={(event) =>
                    updateSelected("label", event.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>COMPONENT DETAILS / RATIONALE</label>
                <textarea
                  rows={5}
                  value={selected.data.notes ?? ""}
                  disabled={submitted}
                  onChange={(event) =>
                    updateSelected("notes", event.target.value)
                  }
                  placeholder="Explain why this component exists."
                />
              </div>

              <button
                className="danger-btn"
                disabled={submitted}
                onClick={removeSelected}
              >
                <Trash2 size={13} /> DELETE COMPONENT
              </button>
            </>
          ) : (
            <div className="empty-inspector">
              Select a component to edit its label, rationale or delete it.
            </div>
          )}

          <div className="field notes-field">
            <label>ARCHITECTURE NOTES</label>
            <textarea
              rows={12}
              disabled={submitted}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Describe request flow, scaling, security boundaries, caching, queues, persistence and failure handling."
            />
          </div>

          <div className="submission-rule">
            {submitted
              ? "Design submitted and evaluated."
              : canSubmit
                ? "Minimum evaluation requirements satisfied."
                : "Add an application description, 3 components and 2 connections to submit."}
          </div>
        </aside>
      </div>
    </div>
  );
}
