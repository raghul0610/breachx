import { ARCHITECTURE_PRINCIPLES } from "./architecturePrinciples";

export type EvaluationNode = { id: string; type?: string; data?: { label?: string; typeKey?: string; category?: string; notes?: string } };
export type EvaluationEdge = { id?: string; source: string; target: string };
export type EvaluationInput = { application: { name: string; description: string }; nodes: EvaluationNode[]; edges: EvaluationEdge[]; notes?: string };
export type FindingSeverity = "critical" | "high" | "medium" | "low";
export type EvaluationFinding = { id: string; category: string; severity: FindingSeverity; title: string; description: string; evidence: string[]; recommendation: string; principleId?: string; penalty: number };
export type EvaluationScore = { category: string; score: number; maxScore: number; summary: string };
export type RequirementProfile = { persistenceRequired: boolean; highScale: boolean; highAvailability: boolean; lowLatency: boolean; asyncWork: boolean; externalDependencies: boolean; sensitiveData: boolean; readHeavy: boolean; complexWorkflow: boolean; rationaleRequired: boolean; staticLike: boolean };
export type EvaluationResult = { score: number; maxScore: 100; scores: EvaluationScore[]; findings: EvaluationFinding[]; strengths: string[]; summary: string; generatedAt: string; reviewBasis: { requirements: RequirementProfile; principles: string[]; methodology: string } };

const key = (n: EvaluationNode) => (n.data?.typeKey ?? "").toLowerCase();
const label = (n: EvaluationNode) => (n.data?.label ?? key(n)) || n.id;
const textOf = (input: EvaluationInput) => [input.application.name, input.application.description, input.notes ?? "", ...input.nodes.map((n) => (label(n) + " " + (n.data?.notes ?? "")))].join(" ").toLowerCase();
const hasAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));
const hasPattern = (text: string, pattern: RegExp) => pattern.test(text);

function inferRequirements(input: EvaluationInput): RequirementProfile {
  const text = textOf(input);
  const highScale = (hasPattern(text, /\b(\d{2,}|\d+\.?\d*\s*(million|billion|k|m)\b)/) && hasAny(text, ["users", "requests", "rps", "qps", "traffic", "transactions"])) || hasAny(text, ["million users", "billion users", "high traffic", "large scale", "internet scale", "global scale", "viral traffic", "massive scale"]);
  const highAvailability = hasAny(text, ["99.9", "99.99", "99.999", "24/7", "zero downtime", "high availability", "highly available", "mission critical", "mission-critical", "business critical", "business-critical", "always available", "disaster recovery"]);
  const persistenceRequired = hasAny(text, ["database", "persist", "persistent", "durable storage", "store orders", "order history", "user account", "user profile", "payment", "transaction", "inventory", "booking", "reservation", "message history", "chat history", "post", "record", "audit trail"]);
  const asyncWork = hasAny(text, ["email", "notification", "push notification", "image processing", "video processing", "upload processing", "background job", "background task", "batch", "export", "report generation", "webhook", "event-driven", "event driven", "asynchronous", "async processing", "long-running"]);
  const externalDependencies = hasAny(text, ["external api", "third-party", "third party", "stripe", "payment gateway", "maps api", "google maps", "twilio", "shipping provider", "oauth", "social login", "external service"]);
  const sensitiveData = hasAny(text, ["password", "credential", "secret", "token", "pii", "personal data", "personal information", "credit card", "card number", "payment data", "medical", "health data", "private data"]);
  const readHeavy = hasAny(text, ["read-heavy", "read heavy", "search", "catalog", "feed", "browse", "frequently read", "high read", "mostly reads", "read intensive"]);
  const lowLatency = hasAny(text, ["low latency", "real-time", "realtime", "sub-second", "milliseconds", "latency sensitive"]) || hasPattern(text, /\b(under|below|less than)\s*\d+\s*ms\b/);
  const complexWorkflow = hasAny(text, ["checkout", "order processing", "workflow", "multi-step", "saga", "reservation", "payment flow", "approval", "pipeline", "orchestration"]);
  const staticLike = hasAny(text, ["static website", "landing page", "portfolio", "documentation site", "docs site", "marketing site", "blog", "static frontend", "content site"]) && !hasAny(text, ["login", "database", "payment", "user account", "transaction"]);
  return { persistenceRequired, highScale, highAvailability, lowLatency, asyncWork, externalDependencies, sensitiveData, readHeavy, complexWorkflow, rationaleRequired: highScale || highAvailability || externalDependencies || complexWorkflow || input.nodes.length >= 6 || (input.notes ?? "").trim().length > 0, staticLike };
}

export function evaluateSystemDesign(input: EvaluationInput): EvaluationResult {
  const nodes = input.nodes ?? [];
  const edges = (input.edges ?? []).filter((edge) => nodes.some((node) => node.id === edge.source) && nodes.some((node) => node.id === edge.target));
  const requirements = inferRequirements(input);
  const findings: EvaluationFinding[] = [];
  const types = new Set(nodes.map(key));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const node of nodes) { outgoing.set(node.id, []); incoming.set(node.id, []); }
  for (const edge of edges) { outgoing.get(edge.source)?.push(edge.target); incoming.get(edge.target)?.push(edge.source); }
  const add = (id: string, category: string, severity: FindingSeverity, title: string, description: string, evidence: string[], recommendation: string, penalty: number, principleId?: string) => { if (!findings.some((finding) => finding.id === id)) findings.push({ id, category, severity, title, description, evidence, recommendation, penalty, principleId }); };
  const reachFrom = (startIds: string[]) => { const seen = new Set<string>(); const queue = [...startIds]; while (queue.length) { const current = queue.shift()!; if (seen.has(current)) continue; seen.add(current); for (const next of outgoing.get(current) ?? []) queue.push(next); } return seen; };
  const ingress = nodes.filter((node) => ["client", "internet", "api_gateway", "load_balancer", "firewall"].includes(key(node)));
  const compute = nodes.filter((node) => key(node) === "app_server");
  const stores = nodes.filter((node) => ["database", "storage"].includes(key(node)));
  const caches = nodes.filter((node) => key(node) === "cache");
  const queues = nodes.filter((node) => key(node) === "queue");
  const external = nodes.filter((node) => key(node) === "external_api");
  const securityBoundary = nodes.filter((node) => ["firewall", "api_gateway"].includes(key(node)));
  const reachableFromIngress = reachFrom(ingress.map((node) => node.id));
  const reachableFromCompute = reachFrom(compute.map((node) => node.id));
  if (!requirements.staticLike && ingress.length === 0) add("ARCH_NO_INGRESS","Architecture","high","No clear request ingress","The graph has no identifiable client, internet, gateway, firewall, or load-balancer entry point.",["No ingress component detected"],"Add the actual request entry point and show how traffic enters the application.",7,"REQ-001");
  if (!requirements.staticLike && compute.length === 0) add("ARCH_NO_COMPUTE","Architecture","high","No application processing layer","The application description appears dynamic, but the graph has no application-processing component.",["No app_server node detected"],"Add the component responsible for application logic, or explain why the workload is intentionally static/serverless.",7,"REQ-001");
  const unreachableCompute = compute.filter((node) => ingress.length > 0 && !reachableFromIngress.has(node.id));
  if (unreachableCompute.length) add("ARCH_UNREACHABLE_COMPUTE","Architecture","critical","Application layer is unreachable","One or more application-processing components cannot be reached from the declared ingress path.",unreachableCompute.map(label),"Connect the request path to the application-processing layer and remove accidental disconnected branches.",10,"REQ-001");
  const orphan = nodes.filter((node) => (incoming.get(node.id)?.length ?? 0) + (outgoing.get(node.id)?.length ?? 0) === 0);
  if (orphan.length) add("ARCH_ORPHAN_COMPONENT","Architecture","medium","Disconnected components","Some components are not connected to any request or dependency path, so their architectural role cannot be established.",orphan.map(label),"Connect each component to a justified flow or remove it from the design.",Math.min(4, orphan.length * 2),"ARCH-001");
  if (requirements.persistenceRequired && stores.length === 0) add("DATA_MISSING_SOURCE_OF_TRUTH","Data Design","high","No durable source of truth","The stated workload requires durable state, but the submitted architecture has no database or durable storage component.",["Requirements imply persistent state","No database/storage node detected"],"Add a durable source of truth and show which application component owns reads and writes.",8,"REQ-001");
  if (requirements.persistenceRequired && stores.length > 0 && compute.length > 0 && !stores.some((store) => reachableFromCompute.has(store.id))) add("DATA_UNREACHABLE_STORE","Data Design","high","Persistence is outside the application path","A durable store exists, but no application-processing path reaches it.",stores.map(label),"Connect the owning application service to the durable store and make the data ownership explicit.",7,"REQ-001");
  const directlyPublicData = stores.filter((store) => ingress.some((entry) => outgoing.get(entry.id)?.includes(store.id)));
  if (directlyPublicData.length) add("SEC_PUBLIC_DATA_STORE","Security","critical","Public component directly reaches a data store","An ingress-facing component is directly connected to persistent data, bypassing an application authorization boundary.",directlyPublicData.map(label),"Route data access through an application/service boundary with explicit authentication and authorization. Keep the primary data store private.",12,"SEC-003");
  const notesAndLabels = textOf(input);
  if (requirements.sensitiveData && securityBoundary.length === 0) add("SEC_NO_BOUNDARY","Security","high","Sensitive workload lacks a visible security boundary","The requirements describe sensitive data, but the graph has no visible firewall or API gateway boundary.",["Sensitive data inferred from requirements","No firewall/API gateway"],"Add an explicit edge security or API boundary and document authentication, authorization, and data-protection responsibilities.",8,"SEC-001");
  if (requirements.sensitiveData && !hasAny(notesAndLabels, ["authentication","authorization","oauth","iam","rbac","least privilege","access control"])) add("SEC_MISSING_ACCESS_MODEL","Security","medium","Access-control model is not explained","The workload contains sensitive data, but the submission does not explain how callers are authenticated or authorized.",["Sensitive data requirement","No authentication/authorization rationale found"],"Document the identity boundary, authorization model, and least-privilege access to sensitive resources.",4,"SEC-002");
  if (requirements.highScale && compute.length === 1 && !types.has("load_balancer")) add("SCALE_SINGLE_COMPUTE","Scalability","high","Single compute capacity at stated scale","The workload states meaningful scale, but the architecture shows one application-processing instance with no traffic-distribution mechanism.",[label(compute[0]),"No load balancer"],"Introduce horizontal capacity and a mechanism that distributes traffic across healthy instances.",7,"REL-003");
  if (compute.length > 1 && !types.has("load_balancer") && !hasAny(notesAndLabels, ["service discovery","service mesh","client-side load balancing"])) add("SCALE_MULTIPLE_NO_DISTRIBUTION","Scalability","medium","Multiple compute instances lack traffic distribution","Multiple application instances are drawn, but the architecture does not show how requests are distributed between them.",compute.map(label),"Add a load-balancing or service-discovery strategy and explain the distribution mechanism.",4,"REL-003");
  if (requirements.highAvailability && stores.length === 1 && !hasAny(notesAndLabels, ["replica","replication","failover","multi-zone","multi zone","multi-region","multi region","backup"])) add("REL_SINGLE_STORE","Reliability","high","Critical state has one visible failure point","High availability is a stated requirement, but the only persistent store has no visible redundancy, replication, backup, or failover strategy.",[label(stores[0]),"No replication/failover evidence"],"Define the appropriate redundancy and recovery strategy for the data layer, including backup and restore expectations.",7,"REL-001");
  if (requirements.highAvailability && compute.length === 1 && !requirements.staticLike) add("REL_SINGLE_COMPUTE","Reliability","high","Application tier has a single failure point","High availability is stated, but the application tier contains only one processing instance.",[label(compute[0])],"Use redundant processing capacity across an appropriate failure domain and route traffic only to healthy instances.",6,"REL-001");
  if (requirements.highAvailability && !hasAny(notesAndLabels, ["failover","recovery","rto","rpo","health check","healthcheck","graceful degradation","degrade"])) add("REL_NO_RECOVERY_PLAN","Fault Tolerance","medium","Recovery behavior is not defined","The workload requires high availability, but the submission does not explain what happens when a critical component fails.",["No failover/recovery/graceful-degradation rationale"],"Describe failure detection, failover or recovery, and the expected behavior during partial failure.",4,"REL-002");
  if (requirements.asyncWork && queues.length === 0) add("ASYNC_NO_QUEUE","Performance","medium","Long-running work has no asynchronous boundary","The requirements imply background or long-running work, but the graph contains no queue or asynchronous handoff.",["Async workload inferred from requirements","No queue node"],"Move non-interactive or bursty work behind a durable asynchronous boundary when the workload requires it.",4,"ARCH-002");
  const queueWithoutConsumer = queues.filter((queue) => (outgoing.get(queue.id)?.length ?? 0) === 0);
  if (queueWithoutConsumer.length) add("ASYNC_QUEUE_NO_CONSUMER","Architecture","high","Queue has no consumer","A queue is present but no downstream component consumes its messages.",queueWithoutConsumer.map(label),"Connect the queue to a worker or application component and document retry, idempotency, and dead-letter behavior when relevant.",5,"ARCH-002");
  if (requirements.externalDependencies && external.length > 0 && !hasAny(notesAndLabels, ["timeout","retry","backoff","circuit breaker","fallback","rate limit"])) add("EXT_NO_FAILURE_POLICY","Reliability","medium","External dependency failure policy is missing","The design depends on an external service but does not explain timeout, retry, backoff, circuit-breaking, rate limiting, or fallback behavior.",external.map(label),"Define bounded timeouts and an appropriate failure policy. Avoid unbounded retries and explain how user-facing behavior degrades when the dependency is unavailable.",4,"REL-002");
  if (requirements.highScale && requirements.readHeavy && caches.length === 0) add("PERF_READ_HEAVY_NO_CACHE","Performance","medium","Read-heavy workload has no acceleration strategy","The workload is explicitly read-heavy at meaningful scale, but the architecture shows no cache or equivalent read-optimization strategy.",["High-scale read-heavy requirement","No cache node"],"Consider caching frequently read, relatively stable data or explain why the primary store and query path are sufficient.",3,"PERF-002");
  if (caches.length > 0 && stores.length === 0 && requirements.persistenceRequired) add("DATA_CACHE_WITHOUT_SOURCE","Data Design","high","Cache is being used without a source of truth","A cache is present for a workload that requires durable state, but no authoritative persistent store is shown.",caches.map(label),"Keep durable state in an authoritative store and use the cache only as an acceleration layer.",6,"PERF-002");
  if (requirements.rationaleRequired && (input.notes ?? "").trim().length < 80 && !nodes.some((node) => (node.data?.notes ?? "").trim().length >= 40)) add("TRADEOFFS_MISSING","Trade-offs","medium","Major architectural decisions are not justified","The design has requirements or complexity that warrant explanation, but the rationale is too short to evaluate key trade-offs.",["Architecture notes are under 80 characters"],"Explain the request path, state ownership, scaling choice, failure handling, security boundaries, and the most important trade-off.",3,"REQ-001");
  const observabilityMentioned = hasAny(notesAndLabels, ["observability","monitoring","metrics","logging","logs","tracing","traces","alerting","slo","sla"]);
  if ((requirements.highAvailability || requirements.highScale || requirements.complexWorkflow) && !observabilityMentioned) add("OPS_NO_OBSERVABILITY","Operability","medium","Production observability is not addressed","The workload has production-oriented scale, availability, or workflow complexity, but no monitoring, logging, tracing, alerting, or SLO strategy is described.",["No observability evidence in labels or rationale"],"Define actionable metrics, logs, traces, alerts, and service-level objectives appropriate to the workload.",4,"OPS-001");
  const simpleWorkload = !requirements.highScale && !requirements.highAvailability && !requirements.complexWorkflow && !requirements.externalDependencies && nodes.length >= 9;
  if (simpleWorkload) add("ARCH_OVERENGINEERED","Architecture","low","Architecture may be disproportionate to the stated workload","The graph contains many infrastructure components while the stated workload has no corresponding scale, availability, or workflow complexity.",[String(nodes.length) + " components","No demanding requirements inferred"],"Prefer the smallest architecture that satisfies the actual requirements. Keep complexity only when a component has a documented purpose.",2,"ARCH-001");
  const maxScores: Record<string, number> = { Architecture:15, Scalability:12, Reliability:12, Security:14, "Data Design":12, Performance:10, "Fault Tolerance":10, Operability:5, "Trade-offs":5, Completeness:5 };
  const categorySummaries: Record<string, string> = { Architecture:"Evaluates request flow, component boundaries, reachability, and proportional complexity.", Scalability:"Evaluates capacity, horizontal scaling, and traffic distribution against stated demand.", Reliability:"Evaluates redundancy, failure points, dependency behavior, and recovery readiness.", Security:"Evaluates trust boundaries, sensitive-data exposure, authentication, and least-privilege evidence.", "Data Design":"Evaluates durable state, ownership, source of truth, and persistence reachability.", Performance:"Evaluates workload-aware caching, asynchronous processing, and bottlenecks.", "Fault Tolerance":"Evaluates behavior under component and dependency failure.", Operability:"Evaluates observability and operational readiness.", "Trade-offs":"Evaluates whether important architecture decisions are justified.", Completeness:"Evaluates whether the submitted graph contains enough structure to review the stated workload." };
  const scores = Object.entries(maxScores).map(([category, maxScore]) => {
    const penalty = findings.filter((finding) => finding.category === category).reduce((sum, finding) => sum + finding.penalty, 0);
    let score = Math.max(0, maxScore - penalty);
    if (category === "Completeness") { if (!requirements.staticLike && ingress.length === 0) score -= 2; if (!requirements.staticLike && compute.length === 0) score -= 2; if (edges.length < Math.max(1, Math.min(3, nodes.length - 1))) score -= 1; score = Math.max(0, score); }
    return { category, score, maxScore, summary: categorySummaries[category] };
  });
  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const highCount = findings.filter((finding) => finding.severity === "high").length;
  let score = Math.round(scores.reduce((sum, item) => sum + item.score, 0));
  if (criticalCount > 0) score = Math.min(score, 49); else if (highCount >= 3) score = Math.min(score, 64); else if (highCount >= 1) score = Math.min(score, 79);
  const strengths: string[] = [];
  if (requirements.staticLike) strengths.push("The design is treated as a static/content workload, so backend persistence is not assumed.");
  if (ingress.length > 0 && (requirements.staticLike || compute.some((node) => reachableFromIngress.has(node.id)))) strengths.push("A request or delivery path is represented in the graph.");
  if (requirements.persistenceRequired && stores.length > 0 && compute.some((node) => reachableFromIngress.has(node.id)) && stores.some((store) => reachableFromCompute.has(store.id))) strengths.push("Durable state is connected to the application path.");
  if (types.has("load_balancer") && compute.length > 1) strengths.push("Traffic distribution is represented across multiple processing components.");
  if (types.has("cache") && stores.length > 0) strengths.push("Caching is paired with a visible durable source of truth.");
  if (types.has("queue") && queueWithoutConsumer.length === 0) strengths.push("Asynchronous work has a connected consumer path.");
  if (securityBoundary.length > 0) strengths.push("An explicit ingress security/routing boundary is represented.");
  if (observabilityMentioned) strengths.push("Operational observability is addressed in the submission.");
  if (!strengths.length) strengths.push("The submission provides a concrete architecture graph that can be evaluated.");
  const sourceCount = new Set(ARCHITECTURE_PRINCIPLES.map((principle) => principle.source)).size;
  const summary = criticalCount > 0 ? "The architecture scored " + score + "/100. " + criticalCount + " critical architectural risk" + (criticalCount === 1 ? "" : "s") + " require attention before the design should be considered production-ready." : findings.length ? "The architecture scored " + score + "/100 against stated requirements and a multi-source architecture-principles corpus. " + findings.length + " improvement finding" + (findings.length === 1 ? "" : "s") + " were identified." : "The architecture scored " + score + "/100 with no material rule-based findings against the stated requirements.";
  return { score, maxScore:100, scores, findings, strengths, summary, generatedAt:new Date().toISOString(), reviewBasis:{ requirements, principles:ARCHITECTURE_PRINCIPLES.map((principle) => principle.id), methodology:"Requirement-first graph review using " + sourceCount + " public architecture guidance sources (AWS, Google Cloud, Microsoft Azure). Components are evidence, not automatic requirements." } };
}

export type FindingSource = "rule" | "ai";

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
      penalty: finding.severity === "critical" ? 12 : finding.severity === "high" ? 7 : finding.severity === "medium" ? 3 : 1,
    }));

  const mergedFindings = [
    ...base.findings.map((finding) => ({ ...finding, source: "rule" as const })),
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
