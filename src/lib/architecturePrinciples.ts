export type ArchitecturePrinciple = {
  id: string;
  category: string;
  title: string;
  rule: string;
  positiveSignals: string[];
  failureSignals: string[];
};

export const ARCHITECTURE_PRINCIPLES: ArchitecturePrinciple[] = [
  {
    id: "purpose",
    category: "Architecture",
    title: "Purpose and requirement fit",
    rule: "Evaluate the architecture against the stated application purpose and requirements. Do not reward components merely because they exist.",
    positiveSignals: ["clear request path", "components justified by requirements", "appropriate complexity"],
    failureSignals: ["missing required capability", "unconnected components", "architecture unrelated to stated workload"],
  },
  {
    id: "flow",
    category: "Architecture",
    title: "End-to-end request flow",
    rule: "A client request should have a coherent path through ingress, application logic, and required data or external dependencies.",
    positiveSignals: ["reachable application service", "valid downstream dependencies", "clear directional flow"],
    failureSignals: ["dead ends", "orphaned critical components", "client path cannot reach application logic"],
  },
  {
    id: "scaling",
    category: "Scalability",
    title: "Horizontal scaling",
    rule: "Stateless or horizontally scalable compute should be used when stated traffic or availability requirements justify it.",
    positiveSignals: ["load balancing", "multiple application instances", "stateless service boundary"],
    failureSignals: ["single compute bottleneck for high traffic", "state tied to one instance", "missing traffic distribution where required"],
  },
  {
    id: "reliability",
    category: "Reliability",
    title: "Failure isolation and redundancy",
    rule: "Critical dependencies should not create avoidable single points of failure when the requirements demand availability.",
    positiveSignals: ["replication", "failover", "isolated failure domains", "backups"],
    failureSignals: ["critical single point of failure", "no recovery path", "shared failure boundary"],
  },
  {
    id: "data",
    category: "Data Design",
    title: "Durable source of truth",
    rule: "State that must survive requests, restarts, or failures needs an appropriate durable store. Caches and queues are not substitutes for a source of truth.",
    positiveSignals: ["database", "durable object storage", "clear ownership of data"],
    failureSignals: ["cache as only persistence", "volatile state for durable requirements", "unhandled data loss"],
  },
  {
    id: "consistency",
    category: "Data Design",
    title: "Consistency and ownership",
    rule: "Critical workflows should define where authoritative state lives and how writes remain correct under concurrency and failure.",
    positiveSignals: ["single owner", "transaction boundary", "idempotent writes"],
    failureSignals: ["ambiguous ownership", "duplicate writes", "inconsistent synchronous fan-out"],
  },
  {
    id: "security",
    category: "Security",
    title: "Trust boundaries",
    rule: "Public traffic should terminate at an appropriate security and application boundary rather than reaching private data stores directly.",
    positiveSignals: ["WAF/firewall", "gateway", "private data layer", "least-privilege boundaries"],
    failureSignals: ["public database path", "missing security boundary for exposed systems", "trusted input crossing directly into storage"],
  },
  {
    id: "async",
    category: "Performance",
    title: "Asynchronous work",
    rule: "Long-running, bursty, retryable, or non-critical work should be decoupled when requirements justify it.",
    positiveSignals: ["queue", "worker", "backpressure", "retry policy"],
    failureSignals: ["synchronous fan-out", "unbounded retries", "queue without consumer"],
  },
  {
    id: "cache",
    category: "Performance",
    title: "Cache correctness",
    rule: "Caching should accelerate a durable source of truth and have an invalidation or freshness strategy.",
    positiveSignals: ["cache in front of database", "TTL", "invalidation"],
    failureSignals: ["cache as source of truth", "cache with no durable backing", "unbounded stale data"],
  },
  {
    id: "operations",
    category: "Operability",
    title: "Observability and recovery",
    rule: "Production-critical systems need enough logging, metrics, tracing, alerting, backup and recovery capability to diagnose and recover from failures.",
    positiveSignals: ["metrics", "logs", "tracing", "alerts", "backup/recovery"],
    failureSignals: ["no operational visibility", "no recovery strategy for critical data"],
  },
  {
    id: "complexity",
    category: "Maintainability",
    title: "Complexity proportional to need",
    rule: "Do not penalize a simple architecture merely for being simple. Penalize unnecessary distributed-system complexity when requirements do not justify it.",
    positiveSignals: ["few justified components", "clear ownership", "simple request path"],
    failureSignals: ["unnecessary microservices", "multiple layers with no purpose", "technology added without a requirement"],
  },
  {
    id: "tradeoffs",
    category: "Trade-offs",
    title: "Explicit architectural decisions",
    rule: "Important choices should explain why the design uses a component, what trade-off it introduces, and what failure mode it accepts.",
    positiveSignals: ["decision rationale", "known bottlenecks", "failure-mode discussion"],
    failureSignals: ["empty rationale", "component shopping", "no explanation for major trade-offs"],
  },
];
