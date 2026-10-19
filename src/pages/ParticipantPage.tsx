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
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { ArrowLeft, FileText, Layers, Save, Trash2, FileDown, BookOpen, PlusCircle, Undo2, Redo2, Link2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, GripVertical, GripHorizontal, MessageSquare, X, Sparkles } from "lucide-react";
import { exportArchitecturePdf } from "../lib/exportArchitecturePdf";
import { BlueprintNode, type BlueprintNodeData } from "../components/BlueprintNode";
import { CategoryIcon, getCategoryAccent, getCategoryVisual } from "../components/CategoryIcon";
import { CATALOG, type CatalogItem } from "../lib/catalog";
import { getComponentKnowledge } from "../lib/componentKnowledge";
import { readSubmission, writeSubmission, logActivity, type DesignSubmission } from "../lib/storage";
import { deleteGraphSelection } from "../lib/graphEditing";
import { InteractiveTutorial } from "../components/InteractiveTutorial";
import { ArchitectureAIChat } from "../components/ArchitectureAIChat";



type InferredRequirements = {
  summary: string;
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  assumptions: string[];
};

const REQUIREMENTS_MARKER = "\n\n[ANCHON_INFERRED_REQUIREMENTS]\n";

function readInferredRequirements(notes: string): InferredRequirements | null {
  const markerIndex = notes.lastIndexOf(REQUIREMENTS_MARKER);
  if (markerIndex < 0) return null;
  try {
    const value = JSON.parse(notes.slice(markerIndex + REQUIREMENTS_MARKER.length));
    if (!value || !Array.isArray(value.functionalRequirements) || !Array.isArray(value.nonFunctionalRequirements)) return null;
    return {
      summary: typeof value.summary === "string" ? value.summary : "",
      functionalRequirements: value.functionalRequirements.filter((item: unknown): item is string => typeof item === "string"),
      nonFunctionalRequirements: value.nonFunctionalRequirements.filter((item: unknown): item is string => typeof item === "string"),
      assumptions: Array.isArray(value.assumptions) ? value.assumptions.filter((item: unknown): item is string => typeof item === "string") : [],
    };
  } catch {
    return null;
  }
}


function CurvedArchitectureEdge(props: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({ ...props, curvature: 0.42 });
  const accent = String(props.style?.stroke ?? "#38bdf8");
  return (
    <g>
      <BaseEdge {...props} path={path} style={{ ...props.style, stroke: accent, strokeWidth: props.selected ? 2.8 : 2.1 }} markerEnd={props.markerEnd} />
      {props.label ? <EdgeLabelRenderer><div className="architecture-edge-label nodrag nopan" style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, color: accent, pointerEvents: "none" }}>{props.label}</div></EdgeLabelRenderer> : null}
    </g>
  );
}

function layoutArchitecture(nodes: Node<BlueprintNodeData>[], edges: Edge[]): Node<BlueprintNodeData>[] {
  if (nodes.length < 2) return nodes;
  const depth = new Map(nodes.map((item) => [item.id, 0]));
  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false;
    for (const edge of edges) {
      const sourceDepth = depth.get(edge.source), targetDepth = depth.get(edge.target);
      if (sourceDepth === undefined || targetDepth === undefined) continue;
      if (targetDepth < sourceDepth + 1) { depth.set(edge.target, sourceDepth + 1); changed = true; }
    }
    if (!changed) break;
  }
  const layers = new Map<number, Node<BlueprintNodeData>[]>();
  for (const item of nodes) { const layer = depth.get(item.id) ?? 0; layers.set(layer, [...(layers.get(layer) ?? []), item]); }
  const rowHeight = 250, columnWidth = 360;
  const maxRows = Math.max(...[...layers.values()].map((items) => items.length));
  const top = -((maxRows - 1) * rowHeight) / 2;
  return nodes.map((item) => {
    const layer = depth.get(item.id) ?? 0, items = layers.get(layer) ?? [item];
    return { ...item, position: { x: layer * columnWidth, y: top + items.findIndex((candidate) => candidate.id === item.id) * rowHeight } };
  });
}

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
  const { screenToFlowPosition, getViewport, fitView } = useReactFlow();
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
  const [inferredRequirements, setInferredRequirements] = useState<InferredRequirements | null>(() => readInferredRequirements(saved?.notes ?? ""));
  const [inferringRequirements, setInferringRequirements] = useState(false);
  const [requirementsError, setRequirementsError] = useState("");
  const [viewport, setViewport] = useState(saved?.viewport);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedCatalogTypeKey, setSelectedCatalogTypeKey] = useState<string | null>(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [requestTraceStep, setRequestTraceStep] = useState(-1);
  const [componentLibraryOpen, setComponentLibraryOpen] = useState(false);
  const [componentSearch, setComponentSearch] = useState("");
  const [componentCategoryFilter, setComponentCategoryFilter] = useState("all");
  const [componentGroupBy, setComponentGroupBy] = useState<"layer" | "category">("layer");
  const [componentSort, setComponentSort] = useState<"default" | "name" | "category">("default");
  const [chatOffset, setChatOffset] = useState({ x: 0, y: 0 });
  const chatDragRef = useRef<{ pointerX: number; pointerY: number; originX: number; originY: number; moved: boolean } | null>(null);
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

  const requestTraceEdges = useMemo(() => {
    const ids = new Set(nodes.map((node) => node.id));
    const validEdges = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target) && edge.source !== edge.target);
    const outgoing = new Map<string, Edge[]>();
    validEdges.forEach((edge) => outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]));
    const incomingIds = new Set(validEdges.map((edge) => edge.target));
    const queue = nodes.filter((node) => !incomingIds.has(node.id)).map((node) => node.id);
    const visitedEdges = new Set<string>();
    const ordered: Edge[] = [];
    while (queue.length) {
      const source = queue.shift()!;
      for (const edge of outgoing.get(source) ?? []) {
        if (visitedEdges.has(edge.id)) continue;
        visitedEdges.add(edge.id); ordered.push(edge); queue.push(edge.target);
      }
    }
    validEdges.forEach((edge) => { if (!visitedEdges.has(edge.id)) ordered.push(edge); });
    return ordered;
  }, [nodes, edges]);

  useEffect(() => {
    if (requestTraceStep < 0 || requestTraceStep >= requestTraceEdges.length) return;
    const timeout = window.setTimeout(() => setRequestTraceStep((step) => step + 1), 900);
    return () => window.clearTimeout(timeout);
  }, [requestTraceStep, requestTraceEdges.length]);

  const runRequestTrace = useCallback(() => {
    if (!requestTraceEdges.length) { setRequestTraceStep(-1); return; }
    setChatOpen(false); setComponentLibraryOpen(false); setRequestTraceStep(0);
    setSelectedId(requestTraceEdges[0].source); setSelectedEdgeId(null); setSelectedCatalogTypeKey(null);
    void fitView({ padding: 0.22, duration: 500 });
  }, [requestTraceEdges, fitView]);

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
  const edgeTypes = useMemo(() => ({ curvedArchitectureEdge: CurvedArchitectureEdge }), []);
  const renderedEdges = useMemo(() => edges.map((edge) => {
    const source = nodes.find((item) => item.id === edge.source);
    const accent = getCategoryAccent(String(source?.data?.category ?? ""));
    const traceIndex = requestTraceEdges.findIndex((traceEdge) => traceEdge.id === edge.id);
    const isTraceActive = traceIndex === requestTraceStep;
    const isTraceComplete = requestTraceStep > traceIndex && traceIndex >= 0;
    return {
      ...edge, type: "curvedArchitectureEdge", animated: true,
      className: isTraceActive ? "request-trace-edge is-active" : isTraceComplete ? "request-trace-edge is-complete" : "request-trace-edge",
      style: { ...edge.style, stroke: accent, strokeWidth: isTraceActive ? 4 : isTraceComplete ? 3 : 2.1, opacity: requestTraceStep >= 0 && !isTraceActive && !isTraceComplete ? 0.28 : 1 },
      markerEnd: { type: MarkerType.ArrowClosed, color: accent, width: 22, height: 22 },
      label: typeof edge.label === "string" ? edge.label : "",
      labelStyle: { ...edge.labelStyle, fill: accent }, interactionWidth: 20,
    };
  }), [edges, nodes, requestTraceEdges, requestTraceStep]);
  const tracedNodes = useMemo(() => nodes.map((node) => {
    const activeEdge = requestTraceEdges[requestTraceStep];
    const active = requestTraceStep >= 0 && requestTraceStep < requestTraceEdges.length && (activeEdge?.source === node.id || activeEdge?.target === node.id);
    const complete = requestTraceStep > 0 && requestTraceEdges.slice(0, Math.min(requestTraceStep, requestTraceEdges.length)).some((edge) => edge.source === node.id || edge.target === node.id);
    return { ...node, className: [node.className, active ? "request-trace-node is-active" : "", complete ? "request-trace-node is-complete" : ""].filter(Boolean).join(" ") };
  }), [nodes, requestTraceEdges, requestTraceStep]);
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
      const sourceNode = nodesRef.current.find((node) => node.id === connection.source);
      const targetNode = nodesRef.current.find((node) => node.id === connection.target);
      const sourceType = String(sourceNode?.data?.typeKey ?? "");
      const targetType = String(targetNode?.data?.typeKey ?? "");
      const dnsTypes = new Set(["dns", "authoritative_dns", "dns_resolver"]);
      const databaseTypes = new Set(["database", "nosql_database", "graph_database", "time_series_db", "database_replica", "database_shard"]);
      if ((dnsTypes.has(sourceType) && databaseTypes.has(targetType)) || (databaseTypes.has(sourceType) && dnsTypes.has(targetType))) {
        window.alert("Connection needs a second look\n\nDNS resolves names to network endpoints; it does not carry database queries or application data. Connect the client or application to DNS for name resolution, then connect the application service to the database.\n\nYou can still model an unusual relationship with a labeled edge if your design has a specific reason.");
        return;
      }

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


  const inferRequirementsFromArchitecture = async () => {
    setInferringRequirements(true);
    setRequirementsError("");
    try {
      const response = await fetch("/api/infer-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application: { name: applicationName, description: applicationDescription },
          nodes: nodes.map((node) => ({
            id: node.id,
            typeKey: node.data?.typeKey ?? "",
            label: node.data?.label ?? node.id,
            category: node.data?.category ?? "",
            notes: node.data?.notes ?? "",
          })),
          edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label ?? "" })),
          notes: notes.split(REQUIREMENTS_MARKER)[0].trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Requirements analysis failed.");
      const result: InferredRequirements = {
        summary: typeof payload.summary === "string" ? payload.summary : "",
        functionalRequirements: Array.isArray(payload.functionalRequirements) ? payload.functionalRequirements : [],
        nonFunctionalRequirements: Array.isArray(payload.nonFunctionalRequirements) ? payload.nonFunctionalRequirements : [],
        assumptions: Array.isArray(payload.assumptions) ? payload.assumptions : [],
      };
      setInferredRequirements(result);
      const baseNotes = notes.split(REQUIREMENTS_MARKER)[0].trim();
      setNotes(baseNotes + REQUIREMENTS_MARKER + JSON.stringify(result));
      setApplicationDescription((current) => {
        const base = current.split(REQUIREMENTS_MARKER)[0].trim();
        return base || result.summary;
      });
    } catch (cause) {
      setRequirementsError(cause instanceof Error ? cause.message : "Could not infer requirements for this architecture.");
    } finally {
      setInferringRequirements(false);
    }
  };

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
        alert(wasSubmitted ? "Submitted project changes saved." : "Blueprint saved. You can continue editing or export your design as a PDF.");
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
        <div className="topbar-right"><div className="topbar-actions"><div className="toolbar-actions topbar-toolbar-actions">
              <button type="button" className={"topbar-library-button " + (componentLibraryOpen ? "is-active" : "")} onClick={() => { const nextOpen = !componentLibraryOpen; setComponentLibraryOpen(nextOpen); setRightPanelOpen(nextOpen); }} aria-expanded={componentLibraryOpen} aria-controls="component-library-popup" data-tutorial="component-library-trigger"><Layers size={13} /> COMPONENT LIBRARY</button>
              <label className="component-search-inline"><BookOpen size={13} /><input aria-label="Search architecture components" placeholder="Search components…" value={componentSearch} onChange={(event) => { setComponentSearch(event.target.value); setComponentLibraryOpen(true); setRightPanelOpen(true); }} onFocus={() => { setComponentLibraryOpen(true); setRightPanelOpen(true); }} /></label>
              <button type="button" className="topbar-add-component-button" onClick={() => addCatalogNode(selectedCatalogItem ?? CATALOG[0], undefined, catalogNotes)} title={"Add " + (selectedCatalogItem?.label ?? CATALOG[0].label) + " to the canvas"}><PlusCircle size={13} /> ADD COMPONENT</button>
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
                data-tutorial="run-request"
                onClick={runRequestTrace}
                title="Describe what you want ANCHON to design or change"
              >
                <Sparkles size={13} /> RUN REQUEST
              </button>
            </div></div><span className="status-pill">
          {submitted ? "SUBMITTED · EDITABLE" : saveStatus === "saving" ? "SAVING…" : saveStatus === "error" ? "SAVE ERROR" : "SAVING TO CLOUD"}
        </span></div>
      </header>

      <div className={`workspace ${leftPanelOpen ? "left-panel-open" : "left-panel-closed"} ${rightPanelOpen || componentLibraryOpen ? "right-panel-open" : "right-panel-closed"}`} style={{ "--left-panel-width": leftPanelOpen ? `${leftPanelWidth}px` : "36px", "--right-panel-width": rightPanelOpen || componentLibraryOpen ? `${rightPanelWidth}px` : "36px", "--left-resizer-width": leftPanelOpen ? "6px" : "0px", "--right-resizer-width": rightPanelOpen || componentLibraryOpen ? "6px" : "0px", "--dock-height": `${componentDockHeight}px` } as CSSProperties}>
        {leftPanelOpen && <button type="button" className="workspace-popup-scrim" aria-label="Close requirements sidebar" onClick={() => setLeftPanelOpen(false)} />}
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


          <section className="brief-card" aria-labelledby="inferred-requirements-title">
            <div className="brief-card-heading">
              <span className="brief-step">02</span>
              <div>
                <h2 id="inferred-requirements-title">Architecture requirements</h2>
                <p>Agent-inferred from the current components and connections.</p>
              </div>
            </div>
            <button type="button" className="primary-btn compact" onClick={inferRequirementsFromArchitecture} disabled={inferringRequirements || nodes.length === 0} style={{ width: "100%", justifyContent: "center", marginBottom: 12 }}>
              <Sparkles size={13} /> {inferringRequirements ? "ANALYZING ARCHITECTURE…" : inferredRequirements ? "RE-ANALYZE CURRENT ARCHITECTURE" : "INFER REQUIREMENTS"}
            </button>
            {requirementsError && <p role="alert" className="requirements-save-error">{requirementsError}</p>}
            {!inferredRequirements && !inferringRequirements && <p className="github-muted">Run the agent to infer likely functional capabilities and non-functional quality needs from the current diagram. Results are saved with this project.</p>}
            {inferredRequirements && <>
              <p style={{ color: "#8c9aa8", fontSize: 11, lineHeight: 1.5 }}>{inferredRequirements.summary}</p>
              <div style={{ marginTop: 14 }}>
                <h3 style={{ color: "#b9dff0", fontSize: 11, margin: "0 0 8px" }}>FUNCTIONAL REQUIREMENTS</h3>
                {inferredRequirements.functionalRequirements.length ? <ol style={{ paddingLeft: 18, margin: 0, color: "#c5d1da", fontSize: 11, lineHeight: 1.65 }}>{inferredRequirements.functionalRequirements.map((item, index) => <li key={index} style={{ marginBottom: 6 }}>{item}</li>)}</ol> : <p className="github-muted">No functional requirements could be inferred.</p>}
              </div>
              <div style={{ marginTop: 14 }}>
                <h3 style={{ color: "#b9dff0", fontSize: 11, margin: "0 0 8px" }}>NON-FUNCTIONAL REQUIREMENTS</h3>
                {inferredRequirements.nonFunctionalRequirements.length ? <ol style={{ paddingLeft: 18, margin: 0, color: "#c5d1da", fontSize: 11, lineHeight: 1.65 }}>{inferredRequirements.nonFunctionalRequirements.map((item, index) => <li key={index} style={{ marginBottom: 6 }}>{item}</li>)}</ol> : <p className="github-muted">No non-functional requirements could be inferred.</p>}
              </div>
              {inferredRequirements.assumptions.length > 0 && <details style={{ marginTop: 12, color: "#8c9aa8", fontSize: 11 }}><summary style={{ cursor: "pointer" }}>Assumptions and unknowns</summary><ul style={{ paddingLeft: 18, lineHeight: 1.6 }}>{inferredRequirements.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
              <p style={{ color: "#6f8190", fontSize: 10, lineHeight: 1.5, marginTop: 12 }}>These are agent-inferred candidates, not guarantees. Confirm them against the product brief and validate measurable targets before treating them as requirements.</p>
            </>}
          </section>

          <div className="requirements-status" role="status">
            <div className="requirements-metric"><strong>{nodes.length}</strong><span>components</span></div>
            <div className="requirements-metric"><strong>{edges.length}</strong><span>connections</span></div>
            <small className={saveStatus === "error" ? "requirements-save-error" : ""}>
              <span className={saveStatus === "error" ? "save-indicator save-indicator-error" : "save-indicator"} />
              {saveStatus === "saving" ? "Saving changes…" : saveStatus === "error" ? "Save needs attention" : "Autosaved"}
            </small>
          </div>
        </aside> : <div className="collapsed-panel-strip collapsed-panel-strip-left"><button className="panel-toggle-button" type="button" onClick={() => setLeftPanelOpen(true)} aria-label="Open requirements sidebar" title="Open requirements sidebar"><PanelLeftOpen size={16} /></button><span>BRIEF</span></div>}
        <div className={`panel-resizer panel-resizer-vertical panel-resizer-left ${leftPanelOpen ? "" : "is-hidden"}`} role="separator" aria-label="Resize requirements sidebar" aria-orientation="vertical" title="Drag to resize sidebar" onPointerDown={(event) => { event.preventDefault(); setResizeDrag({ type: "left", start: event.clientX, initial: leftPanelWidth }); }}><GripVertical size={14} /></div>

        <div className="canvas-column">
          {componentLibraryOpen && <><button type="button" className="component-library-scrim" aria-label="Close component library" onClick={() => setComponentLibraryOpen(false)} />
          <section id="component-library-popup" className="component-dock component-dock-open" role="dialog" aria-modal="false" aria-label="Architecture component library" data-tutorial="component-library">
            <div className="component-dock-heading"><div><div className="section-kicker"><Layers size={13} /> COMPONENT LIBRARY <span className="niche-library-tag">NICHE INFRASTRUCTURE INCLUDED</span></div><p>Search by component, category, or product pattern (WhatsApp, Netflix, Amazon, VS Code, ChatGPT). Select a component to inspect it before adding it.</p></div><button type="button" className="component-library-close" onClick={() => setComponentLibraryOpen(false)} aria-label="Close component library"><X size={16} /></button></div>
            <div className="component-library-controls">
              <label className="component-library-search"><BookOpen size={14} /><input aria-label="Search component library" placeholder="Try WhatsApp, Netflix, Amazon, VS Code, ChatGPT…" value={componentSearch} onChange={(event) => setComponentSearch(event.target.value)} autoComplete="off" /></label>
              <select aria-label="Filter by category" value={componentCategoryFilter} onChange={(event) => setComponentCategoryFilter(event.target.value)}><option value="all">All categories</option>{[...new Set(CATALOG.map((item) => item.category))].sort().map((category) => <option key={category} value={category}>{category}</option>)}</select>
              <select aria-label="Group components by" value={componentGroupBy} onChange={(event) => setComponentGroupBy(event.target.value as "layer" | "category")}><option value="layer">Group by system layer</option><option value="category">Group by category</option></select>
              <select aria-label="Sort components" value={componentSort} onChange={(event) => setComponentSort(event.target.value as "default" | "name" | "category")}><option value="default">Default order</option><option value="name">Name A–Z</option><option value="category">Category A–Z</option></select>
            </div>
            {(componentGroupBy === "category"
              ? [...new Set(CATALOG.map((item) => item.category))].sort().map((category) => ({ title: category.toUpperCase(), description: `Components in the ${category} category`, categories: [category] }))
              : [
                { title: "01 · EDGE & TRAFFIC", description: "Entry points, networking and routing", categories: ["Edge", "Network", "Routing"] },
                { title: "02 · APPLICATION & DATA", description: "Compute, APIs, storage, media and messaging", categories: ["Compute", "API", "Realtime", "Integration", "Data", "Analytics", "Storage", "Messaging", "Orchestration", "Media", "Messaging & Social", "Media & Streaming", "Commerce & Marketplace", "Developer Tools", "AI Assistant Apps", "Search & Discovery", "Collaboration & Productivity", "Maps & Delivery"] },
                { title: "03 · SECURITY & OPERATIONS", description: "Security, reliability, platform and AI", categories: ["Security", "Reliability", "Observability", "Platform", "External", "Banking", "AI / ML", "Identity & Accounts", "Commerce & Billing", "Integration & Automation", "Cloud & Infrastructure"] },
              ]
            ).map((group) => {
              const query = componentSearch.trim().toLowerCase();
              const items = CATALOG.filter((item) => group.categories.includes(item.category))
                .filter((item) => componentCategoryFilter === "all" || item.category === componentCategoryFilter)
                .filter((item) => !query || `${item.label} ${item.category} ${item.typeKey} ${"keywords" in item ? item.keywords.join(" ") : ""}`.toLowerCase().includes(query))
                .sort((a, b) => componentSort === "name" ? a.label.localeCompare(b.label) : componentSort === "category" ? a.category.localeCompare(b.category) || a.label.localeCompare(b.label) : 0);
              if (items.length === 0) return null;
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
          </section></>}
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
            <button type="button" className="run-request-canvas" onClick={runRequestTrace} data-tutorial="canvas-run-request" title="Trace data through your connected architecture" disabled={!requestTraceEdges.length}>
              {requestTraceStep >= 0 && requestTraceStep < requestTraceEdges.length ? <span className="request-trace-spinner" aria-hidden="true" /> : <Sparkles size={14} />}
              {requestTraceStep >= requestTraceEdges.length && requestTraceEdges.length > 0 ? "REPLAY FLOW" : requestTraceStep >= 0 && requestTraceStep < requestTraceEdges.length ? "TRACING FLOW…" : "RUN REQUEST"}
              <span aria-hidden="true">↗</span>
            </button>
          </div>

          {requestTraceStep >= 0 && <div className="request-trace-status" role="status" aria-live="polite">
            <span className={requestTraceStep < requestTraceEdges.length ? "request-trace-status-dot is-running" : "request-trace-status-dot"} />
            <div><strong>{requestTraceStep >= requestTraceEdges.length ? "FLOW COMPLETE" : "DATA FLOW · STEP " + (requestTraceStep + 1) + " OF " + requestTraceEdges.length}</strong><span>{requestTraceStep >= requestTraceEdges.length ? "Followed every connection in your architecture." : (() => { const edge = requestTraceEdges[requestTraceStep]; const from = nodes.find((node) => node.id === edge?.source)?.data.label ?? edge?.source; const to = nodes.find((node) => node.id === edge?.target)?.data.label ?? edge?.target; return from + " → " + to; })()}</span></div>
            {requestTraceStep >= requestTraceEdges.length && <button type="button" onClick={() => setRequestTraceStep(-1)} aria-label="Dismiss flow result"><X size={14} /></button>}
          </div>}
          <ReactFlow
            nodes={tracedNodes}
            edges={renderedEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            deleteKeyCode={null}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onNodeClick={(_, node) => { setSelectedId(node.id); setSelectedEdgeId(null); setSelectedCatalogTypeKey(null); setRightPanelOpen(true); setComponentLibraryOpen(false); canvasRef.current?.focus({ preventScroll: true }); }}
            onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedId(null); setSelectedCatalogTypeKey(null); setRightPanelOpen(true); setComponentLibraryOpen(false); canvasRef.current?.focus({ preventScroll: true }); }}
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

        <div className={`panel-resizer panel-resizer-vertical panel-resizer-right ${rightPanelOpen ? "" : "is-hidden"}`} role="separator" aria-label="Resize inspector sidebar" aria-orientation="vertical" title="Drag to resize inspector" onPointerDown={(event) => { event.preventDefault(); setResizeDrag({ type: "right", start: event.clientX, initial: rightPanelWidth }); }}><GripVertical size={14} /></div>
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
              ? "Blueprint saved. Continue editing or export your design as a PDF."
              : canSubmit
                ? "Blueprint is ready to save."
                : "Add an application description, 3 components and 2 connections to save."}
          </div>
        </aside> : <div className="collapsed-panel-strip collapsed-panel-strip-right"><button className="panel-toggle-button" type="button" onClick={() => setRightPanelOpen(true)} aria-label="Open inspector sidebar" title="Open inspector sidebar"><PanelRightOpen size={16} /></button><span>INSPECTOR</span></div>}
      </div>
      <button type="button" className="floating-ai-chat-trigger" style={{ transform: `translate(${-chatOffset.x}px, ${-chatOffset.y}px)` }} onPointerDown={(event) => { if (event.button !== 0) return; chatDragRef.current = { pointerX: event.clientX, pointerY: event.clientY, originX: chatOffset.x, originY: chatOffset.y, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { const drag = chatDragRef.current; if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return; const dx = event.clientX - drag.pointerX; const dy = event.clientY - drag.pointerY; if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true; if (drag.moved) setChatOffset({ x: drag.originX - dx, y: drag.originY - dy }); }} onPointerUp={(event) => { const drag = chatDragRef.current; chatDragRef.current = null; if (drag?.moved) event.preventDefault(); else setChatOpen((open) => !open); }} aria-expanded={chatOpen} aria-controls="floating-ai-chat-panel" aria-label={chatOpen ? "Close architecture AI chat" : "Open architecture AI chat"} title="Drag to move · click to open">
        {chatOpen ? <X size={19} /> : <MessageSquare size={19} />}
        <span>{chatOpen ? "CLOSE AI" : "ASK ANCHON"}</span>
      </button>
      <div id="floating-ai-chat-panel" className={`floating-ai-chat-panel ${chatOpen ? "is-open" : ""}`} aria-hidden={!chatOpen}>
        <div className="floating-ai-chat-panel-heading"><strong>ANCHON AI</strong><button type="button" onClick={() => setChatOpen(false)} aria-label="Close AI chat"><X size={16} /></button></div>
                  <ArchitectureAIChat
            name={applicationName}
            requirements={applicationDescription}
            nodes={nodes}
            edges={edges}
            onBeforeApply={pushHistory}
            onApply={(nextName, nextNodes, nextEdges, summary) => {
              const spacedNodes = layoutArchitecture(nextNodes, nextEdges);
              nodesRef.current = spacedNodes;
              edgesRef.current = nextEdges;
              setNodes(spacedNodes);
              setEdges(nextEdges);
              window.requestAnimationFrame(() => {
                void fitView({ padding: 0.2, duration: 350 });
              });
              setApplicationName(nextName);
              setNotes((current) => current ? `${current}\n\nAI update: ${summary}` : `AI update: ${summary}`);
              setSelectedId(null);
              setSelectedEdgeId(null);
              setSelectedCatalogTypeKey(null);
              logActivity("AI_ARCHITECTURE_UPDATED", { components: nextNodes.length, connections: nextEdges.length });
            }}
          />
      </div>
      <InteractiveTutorial page="workspace" />
    </div>
  );
}