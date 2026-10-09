import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  reconnectEdge,
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
import { ArrowLeft, FileText, Layers, Save, Send, Trash2, FileDown, BookOpen, PlusCircle, Info, Undo2, Redo2, Link2 } from "lucide-react";
import { exportArchitecturePdf } from "../lib/exportArchitecturePdf";
import { BlueprintNode, type BlueprintNodeData } from "../components/BlueprintNode";
import { CategoryIcon, getCategoryVisual } from "../components/CategoryIcon";
import { CATALOG, type CatalogItem } from "../lib/catalog";
import { getComponentKnowledge } from "../lib/componentKnowledge";
import { readSubmission, writeSubmission, logActivity, type DesignSubmission } from "../lib/storage";
import { deleteGraphSelection } from "../lib/graphEditing";


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
            <strong>ANCHON</strong>
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
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedCatalogTypeKey, setSelectedCatalogTypeKey] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(saved?.status === "submitted");
  const [historyVersion, setHistoryVersion] = useState(0);
  const canvasRef = useRef<HTMLElement | null>(null);
  const dragHistoryOpen = useRef(false);
  type GraphSnapshot = { nodes: Node<BlueprintNodeData>[]; edges: Edge[] };
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const pastRef = useRef<GraphSnapshot[]>([]);
  const futureRef = useRef<GraphSnapshot[]>([]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const pushHistory = useCallback(() => {
    pastRef.current = [...pastRef.current.slice(-49), {
      nodes: structuredClone(nodesRef.current),
      edges: structuredClone(edgesRef.current),
    }];
    futureRef.current = [];
    setHistoryVersion((version) => version + 1);
  }, []);

  const undo = useCallback(() => {
    if (submitted || pastRef.current.length === 0) return;
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, {
      nodes: structuredClone(nodesRef.current),
      edges: structuredClone(edgesRef.current),
    }];
    const restoredNodes = structuredClone(previous.nodes).map((node) => ({ ...node, selected: false }));
    const restoredEdges = structuredClone(previous.edges).map((edge) => ({ ...edge, selected: false }));
    nodesRef.current = restoredNodes;
    edgesRef.current = restoredEdges;
    setNodes(restoredNodes);
    setEdges(restoredEdges);
    setSelectedId(null);
    setSelectedEdgeId(null);
    setSelectedCatalogTypeKey(null);
    setHistoryVersion((version) => version + 1);
  }, [setNodes, setEdges, submitted]);

  const redo = useCallback(() => {
    if (submitted || futureRef.current.length === 0) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current.slice(-49), {
      nodes: structuredClone(nodesRef.current),
      edges: structuredClone(edgesRef.current),
    }];
    const restoredNodes = structuredClone(next.nodes).map((node) => ({ ...node, selected: false }));
    const restoredEdges = structuredClone(next.edges).map((edge) => ({ ...edge, selected: false }));
    nodesRef.current = restoredNodes;
    edgesRef.current = restoredEdges;
    setNodes(restoredNodes);
    setEdges(restoredEdges);
    setSelectedId(null);
    setSelectedEdgeId(null);
    setSelectedCatalogTypeKey(null);
    setHistoryVersion((version) => version + 1);
  }, [setNodes, setEdges, submitted]);
  const [catalogNotes, setCatalogNotes] = useState("");
  const [showFullExplanation, setShowFullExplanation] = useState(false);
  const [persisting, setPersisting] = useState(false);

  const nodeTypes = useMemo(() => ({ blueprintNode: BlueprintNode }), []);
  const selected = nodes.find((node) => node.id === selectedId);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);
  const hasGraphSelection = nodes.some((node) => node.selected) || edges.some((edge) => edge.selected) || Boolean(selectedId) || Boolean(selectedEdgeId);
  const selectedCatalogItem = CATALOG.find((item) => item.typeKey === selectedCatalogTypeKey);
  const selectedKnowledge = selectedCatalogItem ? getComponentKnowledge(selectedCatalogItem) : null;
  const canSubmit =
    !submitted &&
    applicationName.trim().length > 0 &&
    applicationDescription.trim().length > 0 &&
    nodes.length >= 3 &&
    edges.length >= 2;

  const addCatalogNode = (
    item: CatalogItem,
    position?: { x: number; y: number },
    componentNotes = "",
  ) => {
    if (submitted) return;

    pushHistory();
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
          notes: componentNotes.trim() || undefined,
        },
      },
    ]);
    setSelectedId(id);
    setSelectedEdgeId(null);
    setSelectedCatalogTypeKey(null);
    setCatalogNotes("");
    setShowFullExplanation(false);
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
      pushHistory();

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
    [setEdges, submitted, pushHistory],
  );

  const onReconnect = useCallback((oldEdge: Edge, connection: Connection) => {
    if (submitted) return;
    pushHistory();
    setEdges((current) => reconnectEdge(oldEdge, connection, current));
  }, [setEdges, submitted, pushHistory]);

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      if (submitted) return;
      const startsDrag = changes.some((change) => change.type === "position" && change.dragging === true);
      const endsDrag = changes.some((change) => change.type === "position" && change.dragging === false);
      if (startsDrag && !dragHistoryOpen.current) {
        pushHistory();
        dragHistoryOpen.current = true;
      }
      onNodesChange(changes);
      if (endsDrag) dragHistoryOpen.current = false;
    },
    [onNodesChange, submitted, pushHistory],
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
    const currentNode = nodesRef.current.find((node) => node.id === selectedId);
    if (!currentNode || currentNode.data[field] === value) return;
    pushHistory();

    setNodes((current) =>
      current.map((node) =>
        node.id === selectedId
          ? { ...node, data: { ...node.data, [field]: value } }
          : node,
      ),
    );
  };

  const removeSelected = useCallback(() => {
    if (submitted) return;
    const selectedNodeIds = new Set(nodesRef.current.filter((node) => node.selected || node.id === selectedId).map((node) => node.id));
    const selectedEdgeIds = new Set(edgesRef.current.filter((edge) => edge.selected || edge.id === selectedEdgeId).map((edge) => edge.id));
    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;
    pushHistory();
    const result = deleteGraphSelection(nodesRef.current, edgesRef.current, selectedNodeIds, selectedEdgeIds);
    nodesRef.current = result.nodes;
    edgesRef.current = result.edges;
    setNodes(result.nodes);
    setEdges(result.edges);
    selectedNodeIds.forEach((nodeId) => logActivity("NODE_DELETED", { nodeId }));
    selectedEdgeIds.forEach((edgeId) => logActivity("EDGE_DELETED", { edgeId }));
    setSelectedId(null);
    setSelectedEdgeId(null);
    setSelectedCatalogTypeKey(null);
  }, [submitted, selectedId, selectedEdgeId, pushHistory, setNodes, setEdges]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const canvasHasFocus = Boolean(canvasRef.current?.contains(document.activeElement)) || target === document.body;
      if (event.key === "Escape") {
        if (!hasGraphSelection && !selectedCatalogTypeKey) return;
        setSelectedId(null);
        setSelectedEdgeId(null);
        setSelectedCatalogTypeKey(null);
        setNodes((current) => current.map((node) => ({ ...node, selected: false })));
        setEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
        return;
      }
      if (submitted || !canvasHasFocus) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setNodes((current) => current.map((node) => ({ ...node, selected: true })));
        setEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
        setSelectedId(null);
        setSelectedEdgeId(null);
        setSelectedCatalogTypeKey(null);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && hasGraphSelection) {
        event.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasGraphSelection, selectedCatalogTypeKey, submitted, undo, redo, removeSelected, setNodes, setEdges]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="nav-btn" onClick={onBack}>
          <ArrowLeft size={14} /> HOME
        </button>
        <div>
          <strong>ANCHON</strong>
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
              className={`catalog-item catalog-item--${getCategoryVisual(item.category).tone} ${selectedCatalogTypeKey === item.typeKey ? "catalog-item-active" : ""}`}
              draggable={!submitted}
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  "application/breachx-component",
                  item.typeKey,
                );
                event.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => { setSelectedCatalogTypeKey(item.typeKey); setSelectedId(null); setSelectedEdgeId(null); setNodes((current) => current.map((node) => ({ ...node, selected: false }))); setEdges((current) => current.map((edge) => ({ ...edge, selected: false }))); setCatalogNotes(""); setShowFullExplanation(false); }}
              aria-pressed={selectedCatalogTypeKey === item.typeKey}
              disabled={submitted}
            >
              <span className="catalog-item-title"><span className="catalog-item-icon"><CategoryIcon category={item.category} size={14} /></span><span>{item.label}</span></span>
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

        <section className="canvas" ref={canvasRef} tabIndex={0} aria-label="Architecture canvas">
          <div className="canvas-toolbar">
            <div>
              <div className="section-kicker">
                <Layers size={13} /> ARCHITECTURE WORKSPACE
              </div>
              <span className="counter">
                {nodes.length} components · {edges.length} connections
              </span>
              <span className="editor-shortcuts">Delete remove · Esc clear · Ctrl/Cmd+Z undo</span>
            </div>

            <div className="toolbar-actions">
              <button onClick={undo} disabled={submitted || pastRef.current.length === 0} title="Undo (Ctrl/Cmd+Z)" aria-label="Undo"><Undo2 size={13} /> UNDO</button>
              <button onClick={redo} disabled={submitted || futureRef.current.length === 0} title="Redo (Ctrl/Cmd+Shift+Z)" aria-label="Redo"><Redo2 size={13} /> REDO</button>
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
            deleteKeyCode={null}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onNodeClick={(_, node) => { setSelectedId(node.id); setSelectedEdgeId(null); setSelectedCatalogTypeKey(null); canvasRef.current?.focus({ preventScroll: true }); }}
            onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedId(null); setSelectedCatalogTypeKey(null); canvasRef.current?.focus({ preventScroll: true }); }}
            onPaneClick={() => { setSelectedId(null); setSelectedEdgeId(null); setSelectedCatalogTypeKey(null); }}
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

          {selectedCatalogItem && selectedKnowledge ? (
            <div className="catalog-inspector">
              <div className="catalog-inspector-title">
                <div className={`catalog-component-icon catalog-component-icon--${getCategoryVisual(selectedCatalogItem.category).tone}`}><CategoryIcon category={selectedCatalogItem.category} size={18} /></div>
                <div>
                  <div className="section-kicker">{selectedCatalogItem.category}</div>
                  <h3>{selectedCatalogItem.label}</h3>
                </div>
              </div>
              <p className="catalog-summary">{selectedKnowledge.summary}</p>
              <div className="catalog-detail-block">
                <strong>WHAT IT IS</strong>
                <p>{selectedKnowledge.whatItIs}</p>
              </div>
              <div className="catalog-detail-block">
                <strong>WHEN TO USE IT</strong>
                <p>{selectedKnowledge.whenToUse}</p>
              </div>
              {showFullExplanation ? (
                <>
                  <div className="catalog-detail-block">
                    <strong>HOW IT FITS IN</strong>
                    <p>{selectedKnowledge.howItFits}</p>
                  </div>
                  <div className="catalog-detail-block">
                    <strong>TRADE-OFFS</strong>
                    <p>{selectedKnowledge.tradeoffs}</p>
                  </div>
                  <div className="catalog-detail-block">
                    <strong>EXAMPLE</strong>
                    <p>{selectedKnowledge.example}</p>
                  </div>
                </>
              ) : null}
              <button className="catalog-learn-btn" onClick={() => setShowFullExplanation(value => !value)}>
                <BookOpen size={13} /> {showFullExplanation ? "SHOW LESS" : "LEARN MORE"}
              </button>
              <div className="field">
                <label>YOUR NOTES (OPTIONAL)</label>
                <textarea
                  rows={3}
                  value={catalogNotes}
                  onChange={(event) => setCatalogNotes(event.target.value)}
                  placeholder="Why are you adding this component? Add a reminder or design decision."
                  disabled={submitted}
                />
              </div>
              <button
                className="primary-btn catalog-add-btn"
                disabled={submitted}
                onClick={() => addCatalogNode(selectedCatalogItem, undefined, catalogNotes)}
              >
                <PlusCircle size={14} /> ADD COMPONENT TO CANVAS
              </button>
              <div className="catalog-hint">You can also drag this item from the palette directly onto the canvas.</div>
            </div>
          ) : selected ? (
            <>
              <div className="catalog-inspector-title">
                <div className={`catalog-component-icon catalog-component-icon--${getCategoryVisual(String(selected.data.category)).tone}`}><CategoryIcon category={String(selected.data.category)} size={18} /></div>
                <div>
                  <div className="section-kicker">{selected.data.category}</div>
                  <h3>Canvas component</h3>
                </div>
              </div>
              <div className="field">
                <label>COMPONENT LABEL</label>
                <input
                  value={selected.data.label}
                  disabled={submitted}
                  onChange={(event) => updateSelected("label", event.target.value)}
                />
              </div>
              <div className="field">
                <label>COMPONENT DETAILS / RATIONALE</label>
                <textarea
                  rows={5}
                  value={selected.data.notes ?? ""}
                  disabled={submitted}
                  onChange={(event) => updateSelected("notes", event.target.value)}
                  placeholder="Explain why this component exists."
                />
              </div>
              <button className="danger-btn" disabled={submitted} onClick={removeSelected}>
                <Trash2 size={13} /> DELETE COMPONENT
              </button>
            </>
          ) : selectedEdge ? (
            <div className="catalog-inspector">
              <div className="catalog-inspector-title"><div className="catalog-component-icon"><Link2 size={18} /></div><div><div className="section-kicker">CONNECTION</div><h3>Directed connection</h3></div></div>
              <p className="catalog-summary">This connection carries flow from <strong>{nodes.find((node) => node.id === selectedEdge.source)?.data.label ?? selectedEdge.source}</strong> to <strong>{nodes.find((node) => node.id === selectedEdge.target)?.data.label ?? selectedEdge.target}</strong>.</p>
              <button className="danger-btn" disabled={submitted} onClick={removeSelected}><Trash2 size={13} /> DELETE CONNECTION</button>
            </div>
          ) : (
            <div className="empty-inspector">
              <BookOpen size={18} />
              <p>Select a component from the palette to learn about it, or select a canvas component to edit it.</p>
              <p className="catalog-hint">Clicking a palette item only opens its details. Use ADD COMPONENT or drag it onto the canvas to place it.</p>
            </div>
          )}

          <div className="editor-history-status" aria-live="polite">{pastRef.current.length} undo step{pastRef.current.length === 1 ? "" : "s"} available · {futureRef.current.length} redo step{futureRef.current.length === 1 ? "" : "s"} </div>

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
