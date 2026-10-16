export type ConnectionReviewSeverity = "ok" | "low" | "medium" | "high";

export type ConnectionReview = {
  severity: ConnectionReviewSeverity;
  title: string;
  description: string;
  recommendation: string;
};

type ReviewNode = {
  id: string;
  data?: { label?: string; typeKey?: string; category?: string };
};

type ReviewEdge = { id?: string; source: string; target: string };

const keyOf = (node: ReviewNode) => (node.data?.typeKey ?? "").toLowerCase();
const labelOf = (node: ReviewNode) => node.data?.label ?? keyOf(node) ?? node.id;

const PUBLIC_ENTRY_TYPES = new Set([
  "client", "internet", "browser", "mobile_app", "frontend", "user_app", "client_app",
]);

const DATA_TYPES = new Set([
  "database", "nosql_database", "graph_database", "time_series_db", "database_replica",
  "database_shard", "object_storage", "blob_storage", "data_lake", "data_warehouse",
]);

const HIGH_COMPLEXITY_TYPES = new Set([
  "kafka", "event_bus", "service_mesh", "container_orchestrator", "microservice",
  "database_shard", "stream_processor", "workflow_engine", "multi_region",
]);

const isPublicEntry = (node: ReviewNode) =>
  PUBLIC_ENTRY_TYPES.has(keyOf(node)) ||
  node.data?.category === "Edge" ||
  /^(client|internet|browser|mobile|frontend|user app)/i.test(labelOf(node));

const isDataStore = (node: ReviewNode) =>
  DATA_TYPES.has(keyOf(node)) ||
  ["Data", "Storage", "Analytics"].includes(node.data?.category ?? "") ||
  /\b(database|data lake|data warehouse|object storage|blob storage)\b/i.test(labelOf(node));

export function reviewConnection({
  edge,
  nodes,
  edges,
  requirements,
}: {
  edge: ReviewEdge;
  nodes: ReviewNode[];
  edges: ReviewEdge[];
  requirements: string;
}): ConnectionReview {
  const source = nodes.find((node) => node.id === edge.source);
  const target = nodes.find((node) => node.id === edge.target);

  if (edge.source === edge.target) {
    return {
      severity: "high",
      title: "Self-referencing connection",
      description: "This connection starts and ends at the same component. That can be intentional for feedback or retry loops, but it is unusual for a basic request/data path.",
      recommendation: "Confirm that this loop is deliberate, bounded and protected against repeated processing. Otherwise remove it.",
    };
  }

  if (!source || !target) {
    return {
      severity: "high",
      title: "Connection endpoint is missing",
      description: "One endpoint does not resolve to a component in the current canvas. This connection may be stale or malformed.",
      recommendation: "Reconnect the edge to existing components or remove it.",
    };
  }

  const duplicates = edges.filter((candidate) =>
    candidate.id !== edge.id &&
    candidate.source === edge.source &&
    candidate.target === edge.target
  );
  if (duplicates.length > 0) {
    return {
      severity: "medium",
      title: "Duplicate directed connection",
      description: "Another connection already carries flow between these same components. Duplicate edges can make the diagram ambiguous and may represent redundant wiring.",
      recommendation: "Keep both only if they represent distinct protocols or flows; otherwise remove the duplicate and label the intended flow.",
    };
  }

  if (isPublicEntry(source) && isDataStore(target)) {
    return {
      severity: "high",
      title: "Potential application/security-layer bypass",
      description: "A public-facing entry component connects directly to a data store. This can bypass application validation, authorization, business rules, and rate limiting.",
      recommendation: "Route access through an authenticated application/API service and enforce least-privilege data access. Keep a direct connection only when the architecture explicitly requires and secures it.",
    };
  }

  const budgetConstrained = /\b(low budget|tight budget|budget constrained|budget-constrained|cost sensitive|cost-sensitive|minimum cost|very limited budget)\b/i.test(requirements);
  const complexEndpoint = [source, target].find((node) => HIGH_COMPLEXITY_TYPES.has(keyOf(node)));
  if (budgetConstrained && complexEndpoint) {
    return {
      severity: "medium",
      title: "Review operational cost against budget",
      description: `The requirements mention a constrained budget, while this connection involves ${labelOf(complexEndpoint)}, which can add infrastructure, operating and on-call overhead.`,
      recommendation: "Estimate hosting, data transfer, observability, redundancy and maintenance costs. Prefer a simpler managed or single-service design unless a documented requirement justifies the complexity.",
    };
  }

  return {
    severity: "ok",
    title: "No obvious rule-based issue detected",
    description: `No high-confidence connection anti-pattern was detected for ${labelOf(source)} → ${labelOf(target)}. This is not proof that the design is correct or within budget.`,
    recommendation: "Validate protocol compatibility, authentication, data ownership, failure handling, throughput and projected cost against the actual requirements.",
  };
}
