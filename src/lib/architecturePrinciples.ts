export type PrincipleSource = "aws" | "google-cloud" | "azure";

export type ArchitecturePrinciple = {
  id: string;
  pillar: "architecture" | "reliability" | "security" | "performance" | "operations" | "cost";
  title: string;
  rule: string;
  source: PrincipleSource;
  sourceUrl: string;
};

export const ARCHITECTURE_PRINCIPLES: ArchitecturePrinciple[] = [
  {id:"REQ-001",pillar:"architecture",title:"Design for stated requirements",rule:"Evaluate the workload against explicit functional and non-functional requirements; do not invent scale, availability, or compliance requirements.",source:"azure",sourceUrl:"https://learn.microsoft.com/en-us/azure/well-architected/workloads"},
  {id:"ARCH-001",pillar:"architecture",title:"Keep the design simple enough to operate",rule:"Prefer the simplest architecture that satisfies the workload. Do not reward component count or microservices by themselves.",source:"google-cloud",sourceUrl:"https://cloud.google.com/blog/topics/solutions-how-tos/optimize-your-system-design-using-architecture-framework-principles"},
  {id:"ARCH-002",pillar:"architecture",title:"Decouple where independence has value",rule:"Use clear component boundaries when they reduce blast radius, allow independent scaling or deployment, or isolate security concerns.",source:"google-cloud",sourceUrl:"https://cloud.google.com/blog/topics/solutions-how-tos/optimize-your-system-design-using-architecture-framework-principles"},
  {id:"REL-001",pillar:"reliability",title:"Avoid single points of failure when availability requires it",rule:"High-availability workloads need redundancy across meaningful failure domains; a single critical component should not silently determine availability.",source:"google-cloud",sourceUrl:"https://docs.cloud.google.com/architecture/infra-reliability-guide/design"},
  {id:"REL-002",pillar:"reliability",title:"Design for recovery",rule:"Reliable systems identify failure modes, recovery paths, and operational mechanisms instead of assuming components never fail.",source:"aws",sourceUrl:"https://docs.aws.amazon.com/wellarchitected/latest/framework/rel-dp.html"},
  {id:"REL-003",pillar:"reliability",title:"Scale horizontally when appropriate",rule:"For meaningful scale or availability requirements, distribute workload across multiple processing resources and avoid capacity guesses.",source:"aws",sourceUrl:"https://docs.aws.amazon.com/wellarchitected/latest/framework/rel-dp.html"},
  {id:"SEC-001",pillar:"security",title:"Use defense in depth",rule:"Security-sensitive workloads should have layered controls rather than relying on a single boundary.",source:"aws",sourceUrl:"https://docs.aws.amazon.com/wellarchitected/latest/framework/sec-design.html"},
  {id:"SEC-002",pillar:"security",title:"Apply least privilege",rule:"Access to sensitive resources should be limited to the minimum permissions required for the task.",source:"aws",sourceUrl:"https://docs.aws.amazon.com/wellarchitected/latest/framework/sec_permissions_least_privileges.html"},
  {id:"SEC-003",pillar:"security",title:"Protect data and prevent public exposure",rule:"Sensitive data stores should not be directly reachable from untrusted public components without an explicit authorization and service boundary.",source:"aws",sourceUrl:"https://docs.aws.amazon.com/wellarchitected/latest/framework/sec_protect_data_rest_access_control.html"},
  {id:"PERF-001",pillar:"performance",title:"Match capacity to demand",rule:"Performance architecture should account for expected demand, bottlenecks, elasticity, and workload characteristics.",source:"azure",sourceUrl:"https://learn.microsoft.com/en-us/azure/well-architected/pillars"},
  {id:"PERF-002",pillar:"performance",title:"Use caching deliberately",rule:"A cache should accelerate a known access pattern while a durable source of truth remains authoritative where persistence is required.",source:"azure",sourceUrl:"https://learn.microsoft.com/en-us/azure/architecture/best-practices/index-best-practices"},
  {id:"OPS-001",pillar:"operations",title:"Make production behavior observable",rule:"Production-oriented systems need actionable monitoring, logging, alerting, and operational signals proportional to their criticality.",source:"google-cloud",sourceUrl:"https://docs.cloud.google.com/architecture/framework/operational-excellence"},
  {id:"OPS-002",pillar:"operations",title:"Automate safe recovery and change",rule:"Operationally mature systems automate repeatable recovery and make changes small, reversible, and observable.",source:"aws",sourceUrl:"https://docs.aws.amazon.com/wellarchitected/latest/framework/oe-design-principles.html"},
  {id:"COST-001",pillar:"cost",title:"Balance architecture against business value",rule:"Reliability, performance, and operational improvements should be proportional to the workload's stated requirements and value.",source:"google-cloud",sourceUrl:"https://docs.cloud.google.com/docs/get-started/well-architected-framework"},
];

export function getPrinciple(id: string) {
  return ARCHITECTURE_PRINCIPLES.find((principle) => principle.id === id);
}
