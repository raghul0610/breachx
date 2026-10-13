import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { ArrowLeft, FileText, Layers, Save, Send, Trash2, FileDown, BookOpen, PlusCircle, Undo2, Redo2, Link2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, GripVertical, GripHorizontal } from "lucide-react";
import { exportArchitecturePdf } from "../lib/exportArchitecturePdf";
import { BlueprintNode, type BlueprintNodeData } from "../components/BlueprintNode";
import { CategoryIcon, getCategoryVisual } from "../components/CategoryIcon";
import { CATALOG, type CatalogItem } from "../lib/catalog";
import { getComponentKnowledge } from "../lib/componentKnowledge";
import { readSubmission, writeSubmission, logActivity, type DesignSubmission } from "../lib/storage";
import { deleteGraphSelection } from "../lib/graphEditing";
import { InteractiveTutorial } from "../components/InteractiveTutorial";
import { ArchitectureAIChat } from "../components/ArchitectureAIChat";


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
  projectId,
}: {
  onBack: () => void;
  onSubmitted: () => void;
  projectId: string;
}) {
  const saved = readSubmission(projectId);
  return (
    <ReactFlowProvider>
      <ParticipantEditor
        key={projectId}
        projectId={projectId}
        onBack={onBack}
        onSubmitted={onSubmitted}
        startingSubmission={saved}
      />
    </ReactFlowProvider>
  );
}

function ParticipantEditor({
  onBack,
  onSubmitted,
  projectId,
  startingSubmission,
}: {
  onBack: () => void;
  onSubmitted: () => void;
  projectId: string;
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
  const [viewport, setViewport] = useState(saved?.viewport);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedCatalogTypeKey, setSelectedCatalogTypeKey] = useState<string | null>(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(260);
  const [rightPanelWidth, setRightPanelWidth] = useState(300);
  const [componentDockHeight, setComponentDockHeight] = useState(285);
  const [resizeDrag, setResizeDrag] = useState<{ type: "left" | "right" | "dock"; start: number; initial: number } | null>(null);
  const [submitted, setSubmitted] = useState(saved?.status === "submitted");
  const [historyVersion, setHistoryVersion] = useState(0);
  const canvasRef = useRef<HTMLElement | null>(null);
  const dragHistoryOpen = useRef(false);
  type GraphSnapshot = { nodes: Node<BlueprintNodeData>[]; edges: Edge[] };
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const pastRef = useRef<GraphSnapshot[]>([]);
  const futureRef = useRef<GraphSnapshot[]>([]);
  useEffect(() => {
    if (!resizeDrag) return;
    const onPointerMove = (event: PointerEvent) => {
      if (resizeDrag.type === "left") setLeftPanelWidth(Math.max(210, Math.min(420, resizeDrag.initial + event.clientX - resizeDrag.start)));
      if (resizeDrag.type === "right") setRightPanelWidth(Math.max(240, Math.min(440, resizeDrag.initial - (event.clientX - resizeDrag.start))));
      if (resizeDrag.type === "dock") setComponentDockHeight(Math.max(175, Math.min(window.innerHeight * 0.58, resizeDrag.initial + event.clientY - resizeDrag.start)));
    };
    const onPointerUp = () => setResizeDrag(null);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    document.body.classList.add("workspace-resizing", resizeDrag.type === "dock" ? "workspace-resizing-horizontal" : "workspace-resizing-vertical");
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      document.body.classList.remove("workspace-resizing", "workspace-resizing-horizontal", "workspace-resizing-vertical");
    };
  }, [resizeDrag]);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  useEffect(() => {
    setSaveStatus("saving");
    const timeout = window.setTimeout(() => {
      try {
        writeSubmission({
          applicationName,
          applicationDescription,
          nodes,
          edges,
          notes,
          viewport,
          status: submitted ? "submitted" : "draft",
          updatedAt: new Date().toISOString(),
        }, projectId);
        setSaveStatus("saved");
        setSaveError("");
      } catch (cause) {
        setSaveStatus("error");
        setSaveError(cause instanceof Error ? cause.message : "Autosave failed. Your latest changes may not be saved.");
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [applicationName, applicationDescription, nodes, edges, notes, viewport, submitted, projectId]);

  const pushHistory = useCallback(() => {
    pastRef.current = [...pastRef.current.slice(-49), {
      nodes: structuredClone(nodesRef.current),
      edges: structuredClone(edgesRef.current),
    }];
    futureRef.current = [];
    setHistoryVersion((version) => version + 1);
  }, []);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
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
    if (futureRef.current.length === 0) return;
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
    applicationName.trim().length > 0 &&
    applicationDescription.trim().length > 0 &&
    nodes.length >= 3 &&
    edges.length >= 2;

  const addCatalogNode = (
    item: CatalogItem,
    position?: { x: number; y: number },
    componentNotes = "",
  ) => {
    

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

    pushHistory();
    setEdges((current) => reconnectEdge(oldEdge, connection, current));
  }, [setEdges, submitted, pushHistory]);

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {

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
      onEdgesChange(changes);
    },
    [onEdgesChange, submitted],
  );

  const save = async (submissionStatus: "draft" | "submitted") => {
    const wasSubmitted = submitted;
    const effectiveStatus = wasSubmitted ? "submitted" : submissionStatus;

    if (effectiveStatus === "submitted" && !canSubmit) {
      alert(
        "Submission requires an application description, at least 3 components and 2 connections.",
      );
      return;
    }

    setPersisting(true);

    try {
      const currentViewport = getViewport();
      setViewport(currentViewport);
      const submission = {
        applicationName: applicationName.trim(),
        applicationDescription: applicationDescription.trim(),
        nodes,
        edges,
        notes,
        viewport: currentViewport,
        status: effectiveStatus,
        updatedAt: new Date().toISOString(),
      };

      writeSubmission(submission, projectId);
      setSaveStatus("saved");
      setSaveError("");
      logActivity(
        effectiveStatus === "submitted"
          ? "DESIGN_SUBMITTED"
          : "DESIGN_SAVED",
        { nodes: nodes.length, edges: edges.length },
      );

      if (effectiveStatus === "submitted") {
        setSubmitted(true);
        alert(wasSubmitted ? "Submitted project changes saved." : "Blueprint saved. You can now generate a suggested architecture or export your design as a PDF.");
        if (!wasSubmitted) onSubmitted();
      } else {
        alert("Draft saved.");
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The project could not be saved.";
      setSaveStatus("error");
      setSaveError(message);
      alert(message);
    } finally {
      setPersisting(false);
    }
  };

  const handleExportPdf = () => exportArchitecturePdf(applicationName, applicationDescription, notes, nodes, edges);

  const updateSelected = (field: "label" | "notes", value: string) => {
    if (!selectedId) return;
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
      if (!canvasHasFocus) return;
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
          {submitted ? "SUBMITTED · EDITABLE" : saveStatus === "saving" ? "SAVING…" : saveStatus === "error" ? "SAVE ERROR" : "SAVING TO CLOUD"}
        </span>
      </header>

      <div className={`workspace ${leftPanelOpen ? "left-panel-open" : "left-panel-closed"} ${rightPanelOpen ? "right-panel-open" : "right-panel-closed"}`} style={{ "--left-panel-width": leftPanelOpen ? `${leftPanelWidth}px` : "36px", "--right-panel-width": rightPanelOpen ? `${rightPanelWidth}px` : "36px", "--left-resizer-width": leftPanelOpen ? "6px" : "0px", "--right-resizer-width": rightPanelOpen ? "6px" : "0px", "--dock-height": `${componentDockHeight}px` } as CSSProperties}>
        {leftPanelOpen ? <aside className="sidebar left-panel requirements-panel" aria-label="Application requirements" data-tutorial="requirements">
          <div className="requirements-panel-header"><button className="panel-toggle-button" type="button" onClick={() => setLeftPanelOpen(false)} aria-label="Collapse requirements sidebar" title="Collapse sidebar"><PanelLeftClose size={15} /></button>
            <div className="requirements-mark"><FileText size={16} /></div>
            <div>
              <div className="section-kicker">PROJECT BRIEF</div>
              <p>Start with the problem. Shape the system around it.</p>
            </div>
          </div>

          <section className="brief-card" aria-labelledby="brief-identity-title">
            <div className="brief-card-heading">
              <span className="brief-step">01</span>
              <div>
                <h2 id="brief-identity-title">Project identity</h2>
                <p>Give this architecture a clear name.</p>
              </div>
            </div>
            <div className="field">
              <label htmlFor="application-name">APPLICATION NAME</label>
              <input id="application-name" value={applicationName} onChange={(event) => setApplicationName(event.target.value)} placeholder="e.g. Real-time chat platform" />
            </div>
          </section>

          <section className="brief-card" aria-labelledby="brief-requirements-title">
            <div className="brief-card-heading">
              <span className="brief-step">02</span>
              <div>
                <h2 id="brief-requirements-title">What are you building?</h2>
                <p>Describe users, traffic and core needs.</p>
              </div>
            </div>
            <div className="field">
              <label htmlFor="application-requirements">REQUIREMENTS</label>
              <textarea id="application-requirements" rows={6} value={applicationDescription} onChange={(event) => setApplicationDescription(event.target.value)} placeholder="Who is this for? What must the system do?" />
            </div>
          </section>

          <ArchitectureAIChat
            name={applicationName}
            requirements={applicationDescription}
            nodes={nodes}
            edges={edges}
            onBeforeApply={pushHistory}
            onApply={(nextName, nextNodes, nextEdges, summary) => {
              nodesRef.current = nextNodes;
              edgesRef.current = nextEdges;
              setNodes(nextNodes);
              setEdges(nextEdges);
              setApplicationName(nextName);
              setNotes((current) => current ? `${current}\\n\\nAI update: ${summary}` : `AI update: ${summary}`);
              setSelectedId(null);
              setSelectedEdgeId(null);
              setSelectedCatalogTypeKey(null);
              logActivity("AI_ARCHITECTURE_UPDATED", { components: nextNodes.length, connections: nextEdges.length });
            }}
          />

          <div className="requirements-status" role="status">
            <div className="requirements-metric"><strong>{nodes.length}</strong><span>components</span></div>
            <div className="requirements-metric"><strong>{edges.length}</strong><span>connections</span></div>
            <small className={saveStatus === "error" ? "requirements-save-error" : ""}>
              <span className={saveStatus === "error" ? "save-indicator save-indicator-error" : "save-indicator"} />
              {saveStatus === "saving" ? "Saving changes…" : saveStatus === "error" ? "Save needs attention" : "Autosaved"}
            </small>
          </div>
        </aside> : <div className="collapsed-panel-strip collapsed-panel-strip-left"><button className="panel-toggle-button" type="button" onClick={() => setLeftPanelOpen(true)} aria-label="Open requirements sidebar" title="Open requirements sidebar"><PanelLeftOpen size={16} /></button><span>BRIEF</span></div>}
        <div className={`panel-resizer panel-resizer-vertical ${leftPanelOpen ? "" : "is-hidden"}`} role="separator" aria-label="Resize requirements sidebar" aria-orientation="vertical" title="Drag to resize sidebar" onPointerDown={(event) => { event.preventDefault(); setResizeDrag({ type: "left", start: event.clientX, initial: leftPanelWidth }); }}><GripVertical size={14} /></div>

        <div className="canvas-column">
          <section className="component-dock" aria-label="Architecture components" data-tutorial="component-library">
            <div className="component-dock-heading">
              <div><div className="section-kicker"><Layers size={13} /> COMPONENT LIBRARY</div><p>Browse by system layer. Select a component, then add it to your canvas.</p></div>
              <button data-tutorial="create-component" className="primary-btn compact" onClick={() => addCatalogNode(selectedCatalogItem ?? CATALOG[0], undefined, catalogNotes)} title={`Add ${selectedCatalogItem?.label ?? CATALOG[0].label} to the canvas`}><PlusCircle size={13} /> {selectedCatalogItem ? "CREATE COMPONENT" : "ADD DEFAULT COMPONENT"}</button>
            </div>
            {[
              { title: "01 · EDGE & TRAFFIC", description: "Entry points, networking and routing", categories: ["Edge", "Network", "Routing"] },
              { title: "02 · APPLICATION & DATA", description: "Compute, APIs, storage and messaging", categories: ["Compute", "API", "Realtime", "Integration", "Data", "Analytics", "Storage", "Messaging", "Orchestration"] },
              { title: "03 · SECURITY & OPERATIONS", description: "Security, reliability, platform and AI", categories: ["Security", "Reliability", "Observability", "Platform", "External", "Banking", "AI / ML"] },
            ].map((group) => {
              const items = CATALOG.filter((item) => group.categories.includes(item.category));
              return (
                <div className="component-lane" key={group.title}>
                  <div className="component-lane-label">
                    <span>{group.title}</span>
                    <small>{group.description}</small>
                    <span className="component-lane-count">{items.length}</span>
                  </div>
                  <div className="component-dock-items" aria-label={group.title}>
                    {items.map((item) => (
                      <button key={item.typeKey} className={`catalog-item catalog-item--${getCategoryVisual(item.category).tone} component-dock-item ${selectedCatalogTypeKey === item.typeKey ? "catalog-item-active" : ""}`} draggable onDragStart={(event) => { event.dataTransfer.setData("application/breachx-component", item.typeKey); event.dataTransfer.effectAllowed = "move"; }} onClick={() => { setSelectedCatalogTypeKey(item.typeKey); setSelectedId(null); setSelectedEdgeId(null); setNodes((current) => current.map((node) => ({ ...node, selected: false }))); setEdges((current) => current.map((edge) => ({ ...edge, selected: false }))); setCatalogNotes(""); setShowFullExplanation(false); }} aria-pressed={selectedCatalogTypeKey === item.typeKey} title={`${item.label} · ${item.category}`}>
                        <span className="catalog-item-title"><span className="catalog-item-icon"><CategoryIcon category={item.category} size={14} /></span><span>{item.label}</span></span>
                        <small>{item.category}</small>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
          <div className="panel-resizer panel-resizer-horizontal" role="separator" aria-label="Resize component library height" aria-orientation="horizontal" title="Drag to resize component library" onPointerDown={(event) => { event.preventDefault(); setResizeDrag({ type: "dock", start: event.clientY, initial: componentDockHeight }); }}><GripHorizontal size={14} /></div>
        <section className="canvas" ref={canvasRef} tabIndex={0} aria-label="Architecture canvas" data-tutorial="canvas" data-tutorial-connections="true">
          <div className="canvas-toolbar">
            <div>
              <div className="section-kicker">
                <Layers size={13} /> ARCHITECTURE WORKSPACE
              </div>
              <span className="counter">
                {nodes.length} components · {edges.length} connections
              </span>
              <span className="editor-shortcuts">Delete remove · Esc clear · Ctrl/Cmd+Z undo</span>
              {saveError && <span className="autosave-error" role="status">{saveError}</span>}
            </div>

            <div className="toolbar-actions">
              <button onClick={undo} disabled={pastRef.current.length === 0} title="Undo (Ctrl/Cmd+Z)" aria-label="Undo"><Undo2 size={13} /> UNDO</button>
              <button onClick={redo} disabled={futureRef.current.length === 0} title="Redo (Ctrl/Cmd+Shift+Z)" aria-label="Redo"><Redo2 size={13} /> REDO</button>
              <button data-tutorial="export-pdf" onClick={handleExportPdf} disabled={nodes.length === 0}><FileDown size={13} /> EXPORT PDF</button>
              <button
                data-tutorial="save-draft"
                onClick={() => save(submitted ? "submitted" : "draft")}
                disabled={persisting}
              >
                <Save size={13} /> {persisting ? "SAVING…" : submitted ? "SAVE CHANGES" : "SAVE DRAFT"}
              </button>
              <button
                className="primary-btn compact"
                data-tutorial="continue"
                disabled={!canSubmit || persisting}
                onClick={() => save("submitted")}
              >
                <Send size={13} />{" "}
                {submitted ? "UPDATE SUBMITTED PROJECT" : "SAVE BLUEPRINT & CONTINUE"}
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
            defaultViewport={viewport as { x: number; y: number; zoom: number } | undefined}
            fitView={!viewport}
            onMoveEnd={(_, nextViewport) => setViewport(nextViewport)}
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

        </div>

        <div className={`panel-resizer panel-resizer-vertical ${rightPanelOpen ? "" : "is-hidden"}`} role="separator" aria-label="Resize inspector sidebar" aria-orientation="vertical" title="Drag to resize inspector" onPointerDown={(event) => { event.preventDefault(); setResizeDrag({ type: "right", start: event.clientX, initial: rightPanelWidth }); }}><GripVertical size={14} /></div>
        {rightPanelOpen ? <aside className="sidebar right-panel" data-tutorial="inspector">
          <div className="panel-heading-row"><div className="section-kicker">INSPECTOR</div><button className="panel-toggle-button" type="button" onClick={() => setRightPanelOpen(false)} aria-label="Collapse inspector sidebar" title="Collapse sidebar"><PanelRightClose size={15} /></button></div>

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
                  
                />
              </div>
              <button
                className="primary-btn catalog-add-btn"
                
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
                  
                  onChange={(event) => updateSelected("label", event.target.value)}
                />
              </div>
              <div className="field">
                <label>COMPONENT DETAILS / RATIONALE</label>
                <textarea
                  rows={5}
                  value={selected.data.notes ?? ""}
                  
                  onChange={(event) => updateSelected("notes", event.target.value)}
                  placeholder="Explain why this component exists."
                />
              </div>
              <button className="danger-btn"  onClick={removeSelected}>
                <Trash2 size={13} /> DELETE COMPONENT
              </button>
            </>
          ) : selectedEdge ? (
            <div className="catalog-inspector">
              <div className="catalog-inspector-title"><div className="catalog-component-icon"><Link2 size={18} /></div><div><div className="section-kicker">CONNECTION</div><h3>Directed connection</h3></div></div>
              <p className="catalog-summary">This connection carries flow from <strong>{nodes.find((node) => node.id === selectedEdge.source)?.data.label ?? selectedEdge.source}</strong> to <strong>{nodes.find((node) => node.id === selectedEdge.target)?.data.label ?? selectedEdge.target}</strong>.</p>
              <button className="danger-btn"  onClick={removeSelected}><Trash2 size={13} /> DELETE CONNECTION</button>
            </div>
          ) : (
            <div className="empty-inspector">
              <BookOpen size={18} />
              <p>Select a component from the palette to learn about it, or select a canvas component to edit it.</p>
              <p className="catalog-hint">Clicking a palette item only opens its details. Use ADD COMPONENT or drag it onto the canvas to place it.</p>
            </div>
          )}

          <div className="editor-history-status" aria-live="polite" data-tutorial="connections">{pastRef.current.length} undo step{pastRef.current.length === 1 ? "" : "s"} available · {futureRef.current.length} redo step{futureRef.current.length === 1 ? "" : "s"} </div>

          <div className="submission-rule">
            {submitted
              ? "Blueprint saved. Continue to the AI architecture generator."
              : canSubmit
                ? "Blueprint is ready to save."
                : "Add an application description, 3 components and 2 connections to save."}
          </div>
        </aside> : <div className="collapsed-panel-strip collapsed-panel-strip-right"><button className="panel-toggle-button" type="button" onClick={() => setRightPanelOpen(true)} aria-label="Open inspector sidebar" title="Open inspector sidebar"><PanelRightOpen size={16} /></button><span>INSPECTOR</span></div>}
      </div>
      <InteractiveTutorial page="workspace" />
    </div>
  );
}
