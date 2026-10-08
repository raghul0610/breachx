export type EvaluationNode = {
  id: string;
  type?: string;
  data?: {
    label?: string;
    typeKey?: string;
    category?: string;
    notes?: string;
  };
};

export type EvaluationEdge = {
  id?: string;
  source: string;
  target: string;
};

export type EvaluationInput = {
  application: { name: string; description: string };
  nodes: EvaluationNode[];
  edges: EvaluationEdge[];
  notes?: string;
};

export type FindingSeverity = "critical" | "high" | "medium" | "low";
export type FindingSource = "rule" | "ai";

export type EvaluationFinding = {
  id: string;
  category: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: string[];
  recommendation: string;
  source?: FindingSource;
};

export type EvaluationScore = {
  category: string;
  score: number;
  maxScore: number;
  summary: string;
};

export type RequirementProfile = {
  persistenceRequired: boolean;
  highScale: boolean;
  highAvailability: boolean;
  asynchronousWorkLikely: boolean;
  externalIntegrations: boolean;
  sensitiveData: boolean;
  rationaleRequired: boolean;
};

export type AIReviewFinding = {
  id: string;
  category: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  recommendation: string;
  evidenceNodeIds?: string[];
  evidenceEdgeIds?: string[];
  omission?: boolean;
  confidence?: number;
};

export type AIReviewAssessment = {
  category: string;
  rating: "strong" | "adequate" | "weak" | "critical";
  rationale: string;
};

export type AIReview = {
  summary: string;
  strengths: string[];
  findings: AIReviewFinding[];
  assessments: AIReviewAssessment[];
};

export type EvaluationResult = {
  score: number;
  maxScore: 100;
  scores: EvaluationScore[];
  findings: EvaluationFinding[];
  strengths: string[];
  summary: string;
  generatedAt: string;
  evaluationMode?: "deterministic" | "hybrid";
  aiModel?: string;
  requirements?: RequirementProfile;
};

const DIMENSIONS: Array<{ category: string; maxScore: number }> = [
  { category: "Architecture", maxScore: 18 },
  { category: "Scalability", maxScore: 14 },
  { category: "Reliability", maxScore: 14 },
  { category: "Security", maxScore: 14 },
  { category: "Data Design", maxScore: 12 },
  { category: "Performance", maxScore: 10 },
  { category: "Fault Tolerance", maxScore: 6 },
  { category: "Operability", maxScore: 5 },
  { category: "Trade-offs", maxScore: 4 },
  { category: "Completeness", maxScore: 3 },
];

const label = (n: EvaluationNode) => n.data?.label ?? n.data?.typeKey ?? n.id;
const key = (n: EvaluationNode) => n.data?.typeKey ?? "";

function textOf(input: EvaluationInput) {
  return [
    input.application.name,
    input.application.description,
    input.notes ?? "",
    ...input.nodes.map((n) => n.data?.label ?? ""),
    ...input.nodes.map((n) => n.data?.notes ?? ""),
  ].join(" ").toLowerCase();
}

export function inferRequirements(input: EvaluationInput): RequirementProfile {
  const text = textOf(input);
  return {
    persistenceRequired:
      /database|persist|storage|store|order|account|user|profile|payment|transaction|inventory|booking|message|chat|post|delivery|history|record/.test(text),
    highScale:
      /million|\b\d{2,}[,.]?\s*(million|k|rps|qps)|high traffic|large scale|global|internet scale|10x|100x|peak traffic/.test(text),
    highAvailability:
      /99\.9|99\.99|availability|highly available|zero downtime|mission critical|critical service/.test(text),
    asynchronousWorkLikely:
      /email|notification|analytics|video|image|upload|processing|event|webhook|background|report|export|queue|async|batch/.test(text),
    externalIntegrations:
      /payment|maps|stripe|twilio|external api|third party|gateway|shipping|oauth|social login/.test(text),
    sensitiveData:
      /password|credential|pii|personal data|payment|card|health|medical|secret|token|private/.test(text),
    rationaleRequired: true,
  };
}

export function evaluateSystemDesign(input: EvaluationInput): EvaluationResult {
  const nodes = input.nodes ?? [];
  const edges = input.edges ?? [];
  const requirements = inferRequirements(input);
  const findings: EvaluationFinding[] = [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const incoming = new Map(nodes.map((n) => [n.id, 0]));
  const outgoing = new Map(nodes.map((n) => [n.id, 0]));
  const adjacency = new Map<string, string[]>();

  const add = (
    id: string,
    category: string,
    severity: FindingSeverity,
    title: string,
    description: string,
    evidence: string[],
    recommendation: string,
  ) => {
    if (!findings.some((f) => f.id === id)) {
      findings.push({ id, category, severity, title, description, evidence, recommendation, source: "rule" });
    }
  };

  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
      add("INVALID_EDGE", "Architecture", "critical", "Invalid connection",
        "The graph contains a connection whose source or target component does not exist.",
        [edge.id ?? `${edge.source} → ${edge.target}`],
        "Remove or repair invalid connections before evaluating the architecture.");
      continue;
    }
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
  }

  const types = new Set(nodes.map(key));
  const apps = nodes.filter((n) => key(n) === "app_server");
  const staticLikeApplication =
    /static|landing page|documentation site|portfolio|marketing site|blog|content-only|static frontend/.test(textOf(input));
  const databases = nodes.filter((n) => key(n) === "database");
  const storage = nodes.filter((n) => key(n) === "storage");
  const caches = nodes.filter((n) => key(n) === "cache");
  const queues = nodes.filter((n) => key(n) === "queue");
  const ingress = nodes.filter((n) => ["client", "internet"].includes(key(n)));
  const security = nodes.filter((n) => ["firewall", "api_gateway"].includes(key(n)));
  const publicBoundary = nodes.filter((n) =>
    ["client", "internet", "firewall", "api_gateway", "load_balancer"].includes(key(n)),
  );

  if (!ingress.length) {
    add("NO_INGRESS", "Architecture", "high", "No request ingress",
      "No client or internet entry point is represented.",
      ["No client/internet node"],
      "Show where external requests enter the system.");
  }

  if (!apps.length && !staticLikeApplication) {
    add("NO_APPLICATION_SERVICE", "Architecture", "critical", "No application service",
      "The architecture has no component that represents application or business logic.",
      ["No app server node"],
      "Add an application/service layer that owns request handling and business logic.");
  }

  const reachable = new Set<string>();
  const stack = ingress.map((n) => n.id);
  while (stack.length) {
    const current = stack.pop()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const next of adjacency.get(current) ?? []) stack.push(next);
  }

  if (apps.length && !apps.some((n) => reachable.has(n.id))) {
    add("INGRESS_CANNOT_REACH_APP", "Architecture", "critical",
      "Request flow cannot reach application logic",
      "The visible ingress path does not reach any application service.",
      ingress.map(label),
      "Connect the request path through the security/routing layer to application logic.");
  }

  const orphan = nodes.filter((n) => (incoming.get(n.id) ?? 0) + (outgoing.get(n.id) ?? 0) === 0);
  if (orphan.length) {
    add("ORPHAN_COMPONENTS", "Architecture", "medium", "Disconnected components",
      "Components exist outside the connected architecture graph.",
      orphan.map(label),
      "Connect a component only when it has a justified role; otherwise remove it.");
  }

  if (requirements.persistenceRequired && !databases.length && !storage.length) {
    add("MISSING_DURABLE_STATE", "Data Design", "high", "Required durable state is missing",
      "The stated application appears to require persistent state, but no database or durable storage is represented.",
      ["No database or durable storage node"],
      "Add a durable source of truth and explain its consistency, backup, and ownership model.");
  }

  if (requirements.highScale && apps.length === 1 && !types.has("load_balancer")) {
    add("HIGH_SCALE_SINGLE_COMPUTE", "Scalability", "high", "Single compute bottleneck",
      "The stated scale is inconsistent with a single application instance and no traffic-distribution mechanism.",
      apps.map(label),
      "Define horizontal scaling, load balancing, or another explicit capacity strategy.");
  }

  if (apps.length > 1 && !types.has("load_balancer")) {
    add("MULTI_APP_NO_DISTRIBUTION", "Scalability", "medium", "Multiple application instances lack traffic distribution",
      "Multiple application servers are shown without a visible load balancer or equivalent routing mechanism.",
      apps.map(label),
      "Show how requests are distributed and how instance health is handled.");
  }

  if (requirements.highAvailability && databases.length === 1) {
    add("HA_DATABASE_SINGLE_POINT", "Reliability", "high", "Database availability bottleneck",
      "The requirements call for high availability but the design shows one database instance with no visible failover strategy.",
      databases.map(label),
      "Show replication, managed HA, failover, backup/recovery, or explicitly document the availability trade-off.");
  }

  if (requirements.sensitiveData && !security.length) {
    add("SENSITIVE_DATA_NO_BOUNDARY", "Security", "high", "Sensitive workload lacks a visible trust boundary",
      "The requirements mention sensitive data but no WAF/firewall or gateway boundary is represented.",
      ["No firewall or API gateway"],
      "Define the public trust boundary, authentication/authorization boundary, and private data boundary.");
  }

  const directPublicData = edges.filter((e) => {
    const source = nodeById.get(e.source);
    const target = nodeById.get(e.target);
    return source && target &&
      publicBoundary.some((n) => n.id === source.id) &&
      ["database", "storage"].includes(key(target));
  });

  if (directPublicData.length) {
    add("PUBLIC_TO_DATA", "Security", "critical", "Public path reaches data storage directly",
      "A public-facing component connects directly to durable data storage.",
      directPublicData.map((e) => `${label(nodeById.get(e.source)!)} → ${label(nodeById.get(e.target)!)}`),
      "Terminate public traffic at an application/service boundary; do not expose the data layer directly.");
  }

  if (types.has("queue")) {
    const consumerless = queues.filter((q) => (outgoing.get(q.id) ?? 0) === 0);
    if (consumerless.length) {
      add("QUEUE_NO_CONSUMER", "Performance", "high", "Queue has no consumer",
        "A queue is represented but no downstream component consumes it.",
        consumerless.map(label),
        "Connect the queue to a worker/service and document retries, idempotency and backpressure.");
    }
  }

  if (requirements.asynchronousWorkLikely && !types.has("queue")) {
    add("ASYNC_CAPABILITY_MISSING", "Performance", "medium", "Likely asynchronous work is not decoupled",
      "The requirements suggest background, bursty, or retryable work but no queue or worker boundary is represented.",
      ["No queue/worker path"],
      "Consider asynchronous processing for work that should not block the request path.");
  }

  if (types.has("cache") && !databases.length && !storage.length && requirements.persistenceRequired) {
    add("CACHE_NOT_SOURCE_OF_TRUTH", "Data Design", "high", "Cache appears to be the only state layer",
      "A cache is present but no durable source of truth is visible for a workload that requires persistence.",
      caches.map(label),
      "Keep authoritative state in durable storage and use the cache only as an acceleration layer.");
  }

  if (requirements.highAvailability && apps.length === 1) {
    add("HA_SINGLE_APP", "Reliability", "high", "Single application instance for high-availability requirements",
      "The requirements call for high availability but only one application instance is represented.",
      apps.map(label),
      "Define redundant application capacity across an appropriate failure domain.");
  }

  if (nodes.length >= 6 && !types.has("firewall") && !types.has("api_gateway")) {
    add("NO_TRUST_BOUNDARY", "Security", requirements.sensitiveData ? "high" : "medium",
      "No visible application/security boundary",
      "A non-trivial exposed architecture has no visible WAF, firewall, or API gateway boundary.",
      ["No firewall/WAF/API gateway"],
      "Define the public trust boundary and explain how traffic is authenticated and authorized.");
  }

  if ((input.notes ?? "").trim().length < 80) {
    add("WEAK_RATIONALE", "Trade-offs", "low", "Architectural decisions are under-explained",
      "The design does not explain important technology choices, bottlenecks, failure modes, or trade-offs.",
      ["Architecture rationale is under 80 characters"],
      "Explain the major decisions, expected bottlenecks, failure handling and trade-offs.");
  }

  const severityPenalty: Record<FindingSeverity, number> = {
    critical: 0.42,
    high: 0.24,
    medium: 0.11,
    low: 0.045,
  };

  const summaries: Record<string, string> = {
    Architecture: "Evaluates whether the graph forms a coherent end-to-end system.",
    Scalability: "Evaluates capacity, traffic distribution and growth assumptions.",
    Reliability: "Evaluates redundancy, availability and failure boundaries.",
    Security: "Evaluates trust boundaries and exposure of critical resources.",
    "Data Design": "Evaluates durable state, data ownership and correctness boundaries.",
    Performance: "Evaluates latency-sensitive paths, caching and asynchronous work.",
    "Fault Tolerance": "Evaluates recovery and isolation of component failures.",
    Operability: "Evaluates the ability to observe, diagnose and recover the system.",
    "Trade-offs": "Evaluates whether major architectural decisions are justified.",
    Completeness: "Evaluates whether the submission contains enough architecture information to make a meaningful judgment.",
  };

  const scores = DIMENSIONS.map(({ category, maxScore }) => {
    const related = findings.filter((f) =>
      f.category === category ||
      (category === "Fault Tolerance" && f.category === "Reliability"),
    );
    const penalty = related.reduce((sum, f) => sum + severityPenalty[f.severity], 0);
    let score = maxScore * Math.max(0, 1 - Math.min(0.9, penalty));

    if (category === "Completeness") {
      if (nodes.length < 4) score -= 1.5;
      if (edges.length < 3) score -= 1.5;
      if (!input.application.description.trim()) score -= 1.5;
    }

    return {
      category,
      score: Math.round(Math.max(0, Math.min(maxScore, score)) * 10) / 10,
      maxScore,
      summary: summaries[category],
    };
  });

  const critical = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;
  let score = Math.round(scores.reduce((sum, s) => sum + s.score, 0));

  // A catastrophic architectural defect must affect the overall judgment, not just one
  // dimension. This prevents a broken request path from receiving a misleadingly high score
  // because unrelated dimensions happen to be represented.
  if (critical > 0) score = Math.min(score, 49);
  else if (high >= 3) score = Math.min(score, 64);
  else if (high >= 1) score = Math.min(score, 79);

  const strengths: string[] = [];
  if (apps.length && ingress.some((n) => reachable.has(n.id))) strengths.push("The graph contains a request ingress path.");
  if (types.has("firewall") || types.has("api_gateway")) strengths.push("A visible trust boundary is represented.");
  if (types.has("load_balancer") && apps.length > 1) strengths.push("Traffic distribution is represented for multiple application instances.");
  if (databases.length || storage.length) strengths.push("A durable data layer is represented.");
  if (types.has("queue")) strengths.push("An asynchronous processing boundary is represented.");
  if (!strengths.length) strengths.push("The submission provides a graph that can be analyzed for architectural risks.");

  return {
    score,
    maxScore: 100,
    scores,
    findings,
    strengths,
    summary: critical
      ? `The architecture has ${critical} critical issue${critical === 1 ? "" : "s"} that materially affect its stated purpose.`
      : high
        ? `The architecture is partially viable but has ${high} high-severity risk${high === 1 ? "" : "s"} requiring attention.`
        : `The architecture is broadly coherent against the stated requirements, with ${findings.length} improvement finding${findings.length === 1 ? "" : "s"}.`,
    generatedAt: new Date().toISOString(),
    evaluationMode: "deterministic",
    requirements,
  };
}

export function mergeAIReview(
  base: EvaluationResult,
  review: AIReview,
  model = "openrouter/free",
  input?: EvaluationInput,
): EvaluationResult {
  const validNodeIds = new Set((input?.nodes ?? []).map((node) => node.id));
  const validEdgeIds = new Set((input?.edges ?? []).map((edge) => edge.id).filter(Boolean));

  const aiFindings: EvaluationFinding[] = review.findings
    .filter((finding) => {
      const nodeEvidence = finding.evidenceNodeIds ?? [];
      const edgeEvidence = finding.evidenceEdgeIds ?? [];
      const grounded =
        finding.omission === true ||
        (nodeEvidence.length > 0 && nodeEvidence.every((id) => validNodeIds.has(id))) ||
        (edgeEvidence.length > 0 && edgeEvidence.every((id) => validEdgeIds.has(id)));
      return grounded &&
        finding.title.trim() &&
        finding.description.trim() &&
        (finding.confidence ?? 0.8) >= 0.65;
    })
    .map((finding) => ({
      id: `AI_${finding.id}`,
      category: finding.category,
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
      evidence: [
        ...(finding.evidenceNodeIds ?? []).map((id) => `Node: ${id}`),
        ...(finding.evidenceEdgeIds ?? []).map((id) => `Edge: ${id}`),
        ...(finding.omission ? ["Omission: not represented in the design"] : []),
      ],
      recommendation: finding.recommendation,
      source: "ai" as const,
    }));

  const mergedFindings = [
    ...base.findings,
    ...aiFindings.filter((ai) =>
      !base.findings.some((rule) =>
        rule.category === ai.category &&
        rule.title.toLowerCase() === ai.title.toLowerCase(),
      ),
    ),
  ];

  const aiDimensionPenalty: Record<AIReviewAssessment["rating"], number> = {
    strong: 0,
    adequate: 0.03,
    weak: 0.12,
    critical: 0.28,
  };

  const scores = base.scores.map((baseScore) => {
    const assessment = review.assessments.find((a) => a.category === baseScore.category);
    if (!assessment) return baseScore;

    const penalty = aiDimensionPenalty[assessment.rating] ?? 0;
    return {
      ...baseScore,
      score: Math.round(Math.max(0, baseScore.score * (1 - penalty)) * 10) / 10,
      summary: assessment.rationale || baseScore.summary,
    };
  });

  let score = Math.round(scores.reduce((sum, item) => sum + item.score, 0));
  const critical = mergedFindings.filter((finding) => finding.severity === "critical").length;
  const high = mergedFindings.filter((finding) => finding.severity === "high").length;
  if (critical > 0) score = Math.min(score, 49);
  else if (high >= 3) score = Math.min(score, 64);
  else if (high >= 1) score = Math.min(score, 79);

  return {
    ...base,
    score,
    scores,
    findings: mergedFindings,
    strengths: Array.from(new Set([...base.strengths, ...(review.strengths ?? [])])).slice(0, 8),
    summary: review.summary || base.summary,
    evaluationMode: "hybrid",
    aiModel: model,
    generatedAt: new Date().toISOString(),
  };
}
