export type PrincipleSource = "source-study";

export type ArchitecturePrinciple = {
  id: string;
  pillar: "networking" | "api" | "data" | "scaling" | "distributed-systems" | "architecture";
  title: string;
  rule: string;
  source: PrincipleSource;
  sourceUrl: string;
};

export const SYSTEM_DESIGN_FUNDAMENTALS = [
  {id:"SD-01",pillar:"networking",title:"Client-server model",rule:"Separate clients from application processing so request handling can evolve and scale independently."},
  {id:"SD-02",pillar:"networking",title:"IP addressing",rule:"Network endpoints and routing must be reachable through an appropriate network path; do not expose internal components unnecessarily."},
  {id:"SD-03",pillar:"networking",title:"DNS",rule:"Use naming and routing mechanisms appropriate for traffic distribution, failover, and service discovery when those requirements exist."},
  {id:"SD-04",pillar:"networking",title:"Reverse proxy",rule:"Use a reverse proxy when it provides a justified boundary for routing, TLS termination, caching, compression, or load distribution."},
  {id:"SD-05",pillar:"networking",title:"Latency",rule:"Architecture should address stated latency targets and avoid unnecessary network or storage round trips on latency-sensitive paths."},
  {id:"SD-06",pillar:"networking",title:"HTTP and HTTPS",rule:"Web communication should use appropriate protocols and encryption for the sensitivity and exposure of the workload."},
  {id:"SD-07",pillar:"api",title:"API contracts",rule:"Application boundaries should expose clear contracts for the required client-server interactions."},
  {id:"SD-08",pillar:"api",title:"REST APIs",rule:"REST is a useful simple default for resource-oriented workloads; do not require it when another interface better fits the stated requirements."},
  {id:"SD-09",pillar:"api",title:"GraphQL",rule:"Flexible client-driven data fetching can justify GraphQL, but its complexity and caching implications must be warranted by the workload."},
  {id:"SD-10",pillar:"api",title:"WebSockets",rule:"Persistent bidirectional communication is appropriate when the requirements need real-time server-to-client updates."},
  {id:"SD-11",pillar:"api",title:"Webhooks",rule:"External event callbacks need retry, idempotency, and delivery handling when webhook-style integration is required."},
  {id:"SD-12",pillar:"data",title:"Databases",rule:"Choose storage based on data model, consistency needs, query patterns, and scale; there is no universally correct database."},
  {id:"SD-13",pillar:"data",title:"SQL vs NoSQL",rule:"Relational or non-relational storage should be justified by consistency, schema, query, and scaling requirements."},
  {id:"SD-14",pillar:"data",title:"Database indexing",rule:"High-volume or latency-sensitive query paths need appropriate indexing based on actual access patterns."},
  {id:"SD-15",pillar:"data",title:"Vertical partitioning",rule:"Separate wide or differently accessed data when access patterns, performance, or security justify the additional complexity."},
  {id:"SD-16",pillar:"data",title:"Caching",rule:"Caching is justified by repeated or latency-sensitive access patterns; it requires a clear source of truth and invalidation strategy."},
  {id:"SD-17",pillar:"data",title:"Denormalization",rule:"Trade redundancy for read performance only when access patterns justify it and consistency of duplicated data is addressed."},
  {id:"SD-18",pillar:"data",title:"Blob storage",rule:"Large unstructured files should use durable object/blob storage rather than overloading transactional databases."},
  {id:"SD-19",pillar:"scaling",title:"Vertical scaling",rule:"Scaling up is a valid simple strategy when workload demand and availability requirements fit a single larger resource."},
  {id:"SD-20",pillar:"scaling",title:"Horizontal scaling",rule:"Scale out when demand or availability requires distributed processing capacity; statelessness and shared state become important."},
  {id:"SD-21",pillar:"scaling",title:"Load balancing",rule:"Multiple processing instances need an appropriate traffic-distribution mechanism unless another explicit mechanism provides equivalent routing."},
  {id:"SD-22",pillar:"scaling",title:"Replication",rule:"Replicate data when read scale, availability, or recovery requirements justify it; account for replication lag and failover semantics."},
  {id:"SD-23",pillar:"scaling",title:"Sharding",rule:"Partition data only when storage or write scale requires it; shard-key choice and cross-partition operations must be considered."},
  {id:"SD-24",pillar:"distributed-systems",title:"CAP trade-offs",rule:"Distributed data designs should make consistency and availability trade-offs explicit when partitions or replication matter."},
  {id:"SD-25",pillar:"distributed-systems",title:"CDN",rule:"Use edge delivery when global or latency-sensitive static/media delivery justifies it; do not require a CDN for every application."},
  {id:"SD-26",pillar:"distributed-systems",title:"Idempotency",rule:"Retryable side-effecting operations such as payments, orders, and webhook processing need idempotency when duplicates are harmful."},
  {id:"SD-27",pillar:"architecture",title:"Microservices",rule:"Split services when independent ownership, deployment, scaling, or failure isolation justifies distributed-system complexity."},
  {id:"SD-28",pillar:"architecture",title:"Message queues",rule:"Use queues for justified asynchronous work, buffering, decoupling, or burst handling; consumers, retries, and durability must be considered."},
  {id:"SD-29",pillar:"architecture",title:"Rate limiting",rule:"Public or expensive operations need abuse and overload protection when traffic or threat requirements warrant it."},
  {id:"SD-30",pillar:"architecture",title:"API gateway",rule:"An API gateway can centralize routing, authentication, rate limiting, and transformation when multiple clients/services or cross-cutting controls justify it."},
] as const;

export const ARCHITECTURE_PRINCIPLES: ArchitecturePrinciple[] = [
  {id:"REQ-001",pillar:"architecture",title:"Requirements before patterns",rule:"Evaluate the workload against explicit functional and non-functional requirements. Never invent scale, availability, compliance, or latency requirements.",source:"source-study",sourceUrl:""},
  {id:"ARCH-001",pillar:"architecture",title:"Prefer proportional complexity",rule:"Prefer the simplest architecture that satisfies the stated workload; component count is not a quality metric.",source:"source-study",sourceUrl:""},
  {id:"REL-001",pillar:"scaling",title:"Redundancy when availability requires it",rule:"High-availability workloads need redundancy across meaningful failure domains; a single critical component should not silently determine availability.",source:"source-study",sourceUrl:""},
  {id:"REL-002",pillar:"distributed-systems",title:"Design for failure and recovery",rule:"Identify failure modes, recovery paths, retries, timeouts, and graceful degradation where the workload needs them.",source:"source-study",sourceUrl:""},
  {id:"SEC-001",pillar:"architecture",title:"Defense in depth",rule:"Security-sensitive workloads should use layered controls and explicit trust boundaries proportional to the threat and data sensitivity.",source:"source-study",sourceUrl:""},
  {id:"SEC-002",pillar:"architecture",title:"Least privilege",rule:"Access to sensitive resources should be limited to the minimum permissions required by the workload.",source:"source-study",sourceUrl:""},
  {id:"SEC-003",pillar:"architecture",title:"Protect persistent state",rule:"Sensitive stores should not be directly reachable from untrusted public components without an explicit authorization boundary.",source:"source-study",sourceUrl:""},
  {id:"OPS-001",pillar:"architecture",title:"Observable production behavior",rule:"Production-oriented systems need actionable metrics, logs, traces, alerts, and SLOs proportional to criticality.",source:"source-study",sourceUrl:""},
  {id:"DATA-001",pillar:"data",title:"Durable source of truth",rule:"Persistent business state needs an authoritative owner; caches and derived stores should not silently become the only source of truth.",source:"source-study",sourceUrl:""},
  {id:"PERF-001",pillar:"scaling",title:"Capacity follows demand",rule:"Performance decisions should be tied to stated traffic, latency, data volume, and access patterns rather than generic best practices.",source:"source-study",sourceUrl:""},
];

export function getPrinciple(id: string) {
  return ARCHITECTURE_PRINCIPLES.find((principle) => principle.id === id);
}

export function getSystemDesignFundamentals() {
  return SYSTEM_DESIGN_FUNDAMENTALS;
}