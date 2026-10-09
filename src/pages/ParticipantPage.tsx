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
import { ArrowLeft, FileText, Layers, Save, Send, Trash2, FileDown } from "lucide-react";
import { exportArchitecturePdf } from "../lib/exportArchitecturePdf";
import { BlueprintNode, type BlueprintNodeData } from "../components/BlueprintNode";
import { CATALOG, type CatalogItem } from "../lib/catalog";
import { readSubmission, writeSubmission, logActivity, type DesignSubmission } from "../lib/storage";


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
  onSubmitted,
}: {
  onBack: () => void;
  onSubmitted: () => void;
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
            <span className="topbar-sub"> // ARCHITECTURE DESIGNER</span>
          </div>
          <span className="status-pill">BLUEPRINT SAVED</span>
        </header>

        <main className="admin-content">
          <section className="panel control-hero">
            <div className="section-kicker">DESIGN WORKSPACE</div>
            <h1>WHAT DO YOU WANT TO DO NEXT?</h1>
            <p>
              Your blueprint has been saved. You can reopen it for editing or start a fresh design.
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
              Export your blueprint as a PDF from the designer. Generate a suggested architecture whenever you need a starting point.
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
        onSubmitted={onSubmitted}
        startingSubmission={entryMode === "reconstruct" && saved ? { ...saved, status: "draft" } : null}
      />
    </ReactFlowProvider>
  );
}

function ParticipantEditor({
  onBack,
  onSubmitted,
  startingSubmission,
}: {
  onBack: () => void;
  onSubmitted: () => void;
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
        setSubmitted(true);
        alert("Blueprint saved. You can now generate a suggested architecture or export your design as a PDF.");
        onSubmitted();
      } else {
        alert("Draft saved.");
      }

      void viewport;
    } finally {
      setPersisting(false);
    }
  };

  const handleExportPdf = () => exportArchitecturePdf(applicationName, applicationDescription, notes, nodes, edges);

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
          <FileText size={13} /> APPLICATION REQUIREMENTS
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
            rows={3}
            value={applicationDescription}
            onChange={(event) => setApplicationDescription(event.target.value)}
            disabled={submitted}
          />
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
                <Layers size={13} /> ARCHITECTURE WORKSPACE
              </div>
              <span className="counter">
                {nodes.length} components · {edges.length} connections
              </span>
            </div>

            <div className="toolbar-actions">
              <button onClick={handleExportPdf} disabled={nodes.length === 0}><FileDown size={13} /> EXPORT PDF</button>
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
                {submitted ? "SUBMITTED" : "SAVE BLUEPRINT & CONTINUE"}
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
              ? "Blueprint saved. Continue to the AI architecture generator."
              : canSubmit
                ? "Blueprint is ready to save."
                : "Add an application description, 3 components and 2 connections to save."}
          </div>
        </aside>
      </div>
    </div>
  );
}
