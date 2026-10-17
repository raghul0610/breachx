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
import { ArrowLeft, FileText, Layers, Save, Send, Trash2, FileDown, BookOpen, PlusCircle, Undo2, Redo2, Link2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, GripVertical, GripHorizontal, MessageSquare, X, Sparkles } from "lucide-react";
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

type EdgeExplanation = { purpose?: string; rationale?: string };

function TooltipEdge(props: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath(props);
  return (
    <g>
      <BaseEdge
        {...props}
        path={edgePath}
        markerEnd={props.markerEnd}
        markerStart={props.markerStart}
        style={props.style}
        interactionWidth={props.interactionWidth}
      />
      {props.label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
              color: String(props.style?.stroke ?? "#8bdcf5"),
              background: "#071018",
              border: `1px solid ${String(props.style?.stroke ?? "#8bdcf5")}`,
              borderRadius: 5,
              padding: "3px 5px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
            }}
          >
            {props.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </g>
  );
}

function edgeExplanation(edge: Edge, sourceLabel: string, targetLabel: string): Required<EdgeExplanation> {
  const data = (edge.data ?? {}) as EdgeExplanation;
  return {
    purpose: data.purpose?.trim() || `Carries requests or data from ${sourceLabel} to ${targetLabel}.`,
    rationale: data.rationale?.trim() || `This link lets ${sourceLabel} communicate with ${targetLabel}, enabling the system flow to work end to end.`,
  };
}

function defaultEdgeLabel(sourceCategory: string, sourceLabel: string, targetCategory: string, targetLabel: string): string {
  const target = targetLabel.toLowerCase();
  const source = sourceLabel.toLowerCase();
  if (/auth|identity|permission/.test(target)) return "Auth check";
  if (/database|storage|cache|store/.test(target)) return "Store data";
  if (/queue|worker|broker|messaging/.test(target)) return "Queue events";
  if (/monitor|metric|log|observability/.test(target)) return "Send telemetry";
  if (/Security/i.test(targetCategory)) return "Check traffic";
  if (/Data|Storage/i.test(targetCategory)) return "Read/write data";
  if (/Edge/i.test(sourceCategory) || /client|browser|mobile|user/.test(source)) return "Send request";
  if (/API|Routing/i.test(sourceCategory)) return "Route request";
  return "Data flow";
}

function compactEdgeLabel(label: unknown, sourceCategory: string, sourceLabel: string, targetCategory: string, targetLabel: string): string {
  const raw = typeof label === "string" ? label.replace(/·/g, " ").trim() : "";
  if (!raw) {
    const fallback = defaultEdgeLabel(sourceCategory, sourceLabel, targetCategory, targetLabel);
    return fallback.split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
  }
  if (/https|http/i.test(raw)) return "HTTPS";
  if (/import/i.test(raw)) return "Import";
  if (/auth|identity|permission/i.test(raw)) return "Auth";
  if (/data access|database|persistence|sql|query|store/i.test(raw)) return "Data query";
  if (/api boundary|api request|request|route/i.test(raw)) return "API call";
  if (/async|queue|event|publish|notify/i.test(raw)) return "Event";
  if (/monitor|metric|log|trace|telemetry/i.test(raw)) return "Telemetry";
  if (/cache/i.test(raw)) return "Cache";
  return raw.split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
}

const EDGE_PALETTE = [
  "#38bdf8", // sky
  "#a78bfa", // violet
  "#34d399", // emerald
  "#fbbf24", // amber
  "#fb7185", // rose
  "#22d3ee", // cyan
  "#c084fc", // purple
  "#a3e635", // lime
  "#f97316", // orange
  "#60a5fa", // blue
  "#e879f9", // fuchsia
  "#2dd4bf", // teal
];

function getEdgeAccent(edgeIndex: number): string {
  return EDGE_PALETTE[((edgeIndex % EDGE_PALETTE.length) + EDGE_PALETTE.length) % EDGE_PALETTE.length];
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
  const [componentLibraryOpen, setComponentLibraryOpen] = useState(false);
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
  const edgeTypes = useMemo(() => ({ tooltipEdge: TooltipEdge }), []);
  const selected = nodes.find((node) => node.id === selectedId);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);
  const selectedNodeCatalogItem = selected
    ? CATALOG.find((item) => item.typeKey === String(selected.data.typeKey ?? ""))
    : undefined;
  const selectedNodeKnowledge = selectedNodeCatalogItem
    ? getComponentKnowledge(selectedNodeCatalogItem)
    : null;
  const selectedIncomingEdges = selected ? edges.filter((edge) => edge.target === selected.id) : [];
  const selectedOutgoingEdges = selected ? edges.filter((edge) => edge.source === selected.id) : [];
  const updateSelectedEdge = (field: "label" | "purpose" | "rationale", value: string) => {
    if (!selectedEdgeId) return;
    const words = value.trim().split(/\s+/).filter(Boolean);
    const nextValue = field === "label" && words.length > 2
      ? words.slice(0, 2).join(" ")
      : value;
    pushHistory();
    setEdges((current) => current.map((edge) => {
      if (edge.id !== selectedEdgeId) return edge;
      if (field === "label") return { ...edge, label: nextValue || "Data flow" };
      const data = (edge.data ?? {}) as EdgeExplanation;
      return { ...edge, data: { ...data, [field]: nextValue } };
    }));
  };
  const renderEdges = useMemo(() => edges.map((edge, edgeIndex) => {
    const sourceNode = nodes.find((node) => node.id === edge.source);
    const targetNode = nodes.find((node) => node.id === edge.target);
    const sourceLabel = String(sourceNode?.data?.label ?? edge.source);
    const targetLabel = String(targetNode?.data?.label ?? edge.target);
    const sourceCategory = String(sourceNode?.data?.category ?? "");
    const targetCategory = String(targetNode?.data?.category ?? "");
    const accent = getEdgeAccent(edgeIndex);
    return {
      ...edge,
      type: "tooltipEdge",
      animated: false,
      data: { ...(edge.data ?? {}) },
      label: compactEdgeLabel(edge.label, sourceCategory, sourceLabel, targetCategory, targetLabel),
      style: { ...edge.style, stroke: accent, strokeWidth: edge.selected ? 3 : 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: accent, width: 16, height: 16 },
      labelStyle: { ...edge.labelStyle, fill: accent, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, fontWeight: 800 },
      labelBgStyle: { ...edge.labelBgStyle, fill: "#071018", fillOpacity: 0.98, stroke: accent, strokeWidth: 1 },
      labelBgPadding: [5, 3] as [number, number],
      labelBgBorderRadius: 4,
      interactionWidth: 18,
    };
  }), [edges, nodes]);
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
      const sourceNode = nodesRef.current.find((node) => node.id === connection.source);
      const targetNode = nodesRef.current.find((node) => node.id === connection.target);
      const sourceLabel = String(sourceNode?.data?.label ?? connection.source);
      const targetLabel = String(targetNode?.data?.label ?? connection.target);
      const sourceCategory = String(sourceNode?.data?.category ?? "");
      const targetCategory = String(targetNode?.data?.category ?? "");
      const label = defaultEdgeLabel(sourceCategory, sourceLabel, targetCategory, targetLabel);
      setEdges((current) => addEdge({
        ...connection,
        label,
        data: {
          purpose: `Carries requests or data from ${sourceLabel} to ${targetLabel}.`,
          rationale: `This link lets ${sourceLabel} communicate with ${targetLabel}, enabling the system flow to work end to end.`,
        },
        animated: true,
        style: { stroke: getCategoryAccent(sourceCategory), strokeWidth: 4 },
        markerEnd: { type: MarkerType.ArrowClosed, color: getCategoryAccent(sourceCategory), width: 24, height: 24 },
      }, current));
      logActivity("EDGE_CREATED", { source: connection.source, target: connection.target });
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
              <button type="button" className={"topbar-library-button " + (componentLibraryOpen ? "is-active" : "")} onClick={() => setComponentLibraryOpen((open) => !open)} aria-expanded={componentLibraryOpen} aria-controls="component-library-popup" data-tutorial="component-library-trigger"><Layers size={13} /> COMPONENT LIBRARY</button>
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
                data-tutorial="continue"
                disabled={!canSubmit || persisting}
                onClick={() => save("submitted")}
              >
                <Send size={13} />{" "}
                {submitted ? "UPDATE SUBMITTED PROJECT" : "SAVE BLUEPRINT & CONTINUE"}
              </button>
            </div></div><span className="status-pill">
          {submitted ? "SUBMITTED · EDITABLE" : saveStatus === "saving" ? "SAVING…" : saveStatus === "error" ? "SAVE ERROR" : "SAVING TO CLOUD"}
        </span></div>
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


          <section className="brief-card inferred-requirements-card" aria-labelledby="inferred-requirements-title" style={{ marginTop: 14, padding: 12, fontSize: 10, lineHeight: 1.5 }}>
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
              <p className="inferred-requirements-summary">{inferredRequirements.summary}</p>
              <div style={{ marginTop: 14 }}>
                <h3 className="inferred-requirements-subheading">FUNCTIONAL REQUIREMENTS</h3>
                {inferredRequirements.functionalRequirements.length ? <ol className="inferred-requirements-list">{inferredRequirements.functionalRequirements.map((item, index) => <li key={index} style={{ marginBottom: 6 }}>{item}</li>)}</ol> : <p className="github-muted">No functional requirements could be inferred.</p>}
              </div>
              <div style={{ marginTop: 14 }}>
                <h3 className="inferred-requirements-subheading">NON-FUNCTIONAL REQUIREMENTS</h3>
                {inferredRequirements.nonFunctionalRequirements.length ? <ol style={{ paddingLeft: 18, margin: 0, color: "#c5d1da", fontSize: 11, lineHeight: 1.65 }}>{inferredRequirements.nonFunctionalRequirements.map((item, index) => <li key={index} style={{ marginBottom: 6 }}>{item}</li>)}</ol> : <p className="github-muted">No non-functional requirements could be inferred.</p>}
              </div>
              {inferredRequirements.assumptions.length > 0 && <details className="inferred-requirements-assumptions"><summary style={{ cursor: "pointer" }}>Assumptions and unknowns</summary><ul style={{ paddingLeft: 18, lineHeight: 1.6 }}>{inferredRequirements.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
              <p className="inferred-requirements-disclaimer">These are agent-inferred candidates, not guarantees. Confirm them against the product brief and validate measurable targets before treating them as requirements.</p>
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
          <section id="component-library-popup" className="component-dock component-dock-open" role="dialog" aria-modal="true" aria-label="Architecture component library" data-tutorial="component-library">
            <div className="component-dock-heading"><div><div className="section-kicker"><Layers size={13} /> COMPONENT LIBRARY</div><p>Browse by system layer. Select a component, then add it to your canvas.</p></div><button type="button" className="component-library-close" onClick={() => setComponentLibraryOpen(false)} aria-label="Close component library"><X size={16} /></button></div>
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


          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
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
                  <h3>{String(selected.data.label)}</h3>
                </div>
              </div>
              {selectedNodeKnowledge ? (
                <div className="selected-node-details">
                  <p className="catalog-summary">{selectedNodeKnowledge.summary}</p>
                  <div className="catalog-detail-block">
                    <strong>RESPONSIBILITY</strong>
                    <p>{selectedNodeKnowledge.whatItIs}</p>
                  </div>
                  <div className="catalog-detail-block">
                    <strong>HOW IT FITS</strong>
                    <p>{selectedNodeKnowledge.howItFits}</p>
                  </div>
                  <div className="catalog-detail-block">
                    <strong>TRADE-OFFS</strong>
                    <p>{selectedNodeKnowledge.tradeoffs}</p>
                  </div>
                </div>
              ) : null}
              <div className="inspector-connections">
                <div className="inspector-connections-heading">CONNECTIONS <span>{selectedIncomingEdges.length + selectedOutgoingEdges.length}</span></div>
                {selectedIncomingEdges.length === 0 && selectedOutgoingEdges.length === 0 ? (
                  <p className="catalog-hint">No connections yet. Connect this component to another node.</p>
                ) : (
                  <>
                    {selectedIncomingEdges.map((edge) => {
                      const source = nodes.find((node) => node.id === edge.source);
                      return <button type="button" className="inspector-connection-row" key={edge.id} onClick={() => { setSelectedId(null); setSelectedEdgeId(edge.id); setRightPanelOpen(true); }}>
                        <span className="inspector-connection-direction">IN</span>
                        <span>{String(source?.data?.label ?? edge.source)}</span>
                        <small>{compactEdgeLabel(edge.label, String(source?.data?.category ?? ""), String(source?.data?.label ?? edge.source), String(selected.data.category ?? ""), String(selected.data.label ?? selected.id))}</small>
                      </button>;
                    })}
                    {selectedOutgoingEdges.map((edge) => {
                      const target = nodes.find((node) => node.id === edge.target);
                      return <button type="button" className="inspector-connection-row" key={edge.id} onClick={() => { setSelectedId(null); setSelectedEdgeId(edge.id); setRightPanelOpen(true); }}>
                        <span className="inspector-connection-direction">OUT</span>
                        <span>{String(target?.data?.label ?? edge.target)}</span>
                        <small>{compactEdgeLabel(edge.label, String(selected.data.category ?? ""), String(selected.data.label ?? selected.id), String(target?.data?.category ?? ""), String(target?.data?.label ?? edge.target))}</small>
                      </button>;
                    })}
                  </>
                )}
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
            <div className="catalog-inspector edge-inspector">
              {(() => {
                const sourceNode = nodes.find((node) => node.id === selectedEdge.source);
                const targetNode = nodes.find((node) => node.id === selectedEdge.target);
                const sourceLabel = String(sourceNode?.data?.label ?? selectedEdge.source);
                const targetLabel = String(targetNode?.data?.label ?? selectedEdge.target);
                const sourceCategory = String(sourceNode?.data?.category ?? "");
                const targetCategory = String(targetNode?.data?.category ?? "");
                const edgeIndex = edges.findIndex((edge) => edge.id === selectedEdge.id);
                const accent = getEdgeAccent(Math.max(0, edgeIndex));
                const explanation = edgeExplanation(selectedEdge, sourceLabel, targetLabel);
                return <>
                  <div className="catalog-inspector-title"><div className="catalog-component-icon" style={{ color: accent, borderColor: accent }}><Link2 size={18} /></div><div><div className="section-kicker">CONNECTION · EDGE {edgeIndex + 1}</div><h3>{sourceLabel} → {targetLabel}</h3></div></div>
                  <div className="edge-origin-indicator" style={{ borderColor: accent, color: accent }}><span style={{ background: accent }} /> UNIQUE EDGE COLOR</div>
                  <div className="field">
                    <label>CANVAS LABEL · MAX 2 WORDS</label>
                    <input value={compactEdgeLabel(selectedEdge.label, sourceCategory, sourceLabel, targetCategory, targetLabel)} maxLength={40} onChange={(event) => updateSelectedEdge("label", event.target.value)} placeholder="e.g. Sends requests" />
                  </div>
                  <div className="field">
                    <label>WHAT DOES THIS EDGE DO?</label>
                    <textarea rows={3} value={explanation.purpose} onChange={(event) => updateSelectedEdge("purpose", event.target.value)} placeholder="Describe the responsibility of this connection." />
                  </div>
                  <div className="field">
                    <label>WHY IS IT NECESSARY?</label>
                    <textarea rows={3} value={explanation.rationale} onChange={(event) => updateSelectedEdge("rationale", event.target.value)} placeholder="Explain why these components need to communicate." />
                  </div>
                </>;
              })()}
              <button className="danger-btn" onClick={removeSelected}><Trash2 size={13} /> DELETE CONNECTION</button>
            </div>
          ) : (
            <div className="empty-inspector">
              <BookOpen size={18} />
              <p>Select a canvas node or connection to inspect its details and edit its properties.</p>
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
      {chatOpen && <button type="button" className="ai-chat-scrim" aria-label="Close Ask ANCHON panel" onClick={() => setChatOpen(false)} />}
      <div id="floating-ai-chat-panel" className={`floating-ai-chat-panel ${chatOpen ? "is-open" : ""}`} aria-hidden={!chatOpen}>
        <div className="floating-ai-chat-panel-heading"><strong>ANCHON AI</strong><button type="button" onClick={() => setChatOpen(false)} aria-label="Close AI chat"><X size={16} /></button></div>
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