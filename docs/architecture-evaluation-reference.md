# Breach X Architecture Evaluation Reference

Breach X evaluates system designs against a principles corpus derived from public architecture guidance published by AWS, Google Cloud, and Microsoft Azure.

The evaluator is requirement-driven. A database, cache, queue, load balancer, multi-region deployment, or microservice boundary is not automatically required. The evaluator first infers requirements from the application's stated purpose, traffic, availability, latency, data, and workload characteristics, then checks whether the submitted graph satisfies those requirements.

## Reference frameworks

### AWS Well-Architected Framework

AWS organizes architecture review around operational excellence, security, reliability, performance efficiency, cost optimization, and sustainability. Its guidance emphasizes explicit trade-offs rather than treating review as a component checklist.

Primary references:
- https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html
- https://docs.aws.amazon.com/wellarchitected/latest/framework/the-pillars-of-the-framework.html
- https://docs.aws.amazon.com/wellarchitected/latest/framework/rel-dp.html
- https://docs.aws.amazon.com/wellarchitected/latest/framework/sec-design.html
- https://docs.aws.amazon.com/wellarchitected/latest/framework/oe-design-principles.html

### Google Cloud Well-Architected Framework

Google Cloud's guidance emphasizes operational excellence, security, reliability, cost optimization, and performance optimization. Its system-design guidance stresses documentation, simplicity, decoupling, statelessness, high availability, scalability, and cost-aware decisions.

Primary references:
- https://docs.cloud.google.com/docs/get-started/well-architected-framework
- https://docs.cloud.google.com/architecture/framework/operational-excellence
- https://docs.cloud.google.com/architecture/infra-reliability-guide/design
- https://cloud.google.com/blog/topics/solutions-how-tos/optimize-your-system-design-using-architecture-framework-principles

### Microsoft Azure Well-Architected Framework

Azure evaluates workloads through reliability, security, cost optimization, operational excellence, and performance efficiency. It explicitly states that workloads should be measured by their purpose and prioritized requirements.

Primary references:
- https://learn.microsoft.com/en-us/azure/well-architected/
- https://learn.microsoft.com/en-us/azure/well-architected/workloads
- https://learn.microsoft.com/en-us/azure/well-architected/pillars
- https://learn.microsoft.com/en-us/azure/architecture/guide/

## Evaluation contract

1. Requirements come before architecture preferences.
2. Graph topology is evidence; component presence alone is not.
3. A finding must identify the architectural evidence that caused it.
4. Severity represents material engineering impact, not how unusual a design looks.
5. Optional best practices must not be scored as mandatory requirements.
6. A small, simple system can legitimately score highly without a cache, queue, load balancer, or distributed database.
7. High-scale and high-availability systems are held to stronger resilience and capacity standards.
8. The evaluator must distinguish a missing capability from a missing diagram detail.
9. Scores are bounded by material architectural risks so unrelated strengths cannot hide a critical defect.
10. Architecture rationale is part of the review because architectural decisions require context and trade-offs.

## Current rule families

- Requirement fit and scope
- Request-path reachability
- Persistence and source-of-truth correctness
- Horizontal scalability and capacity
- Failure domains, redundancy, and recovery
- Security boundaries and public data exposure
- Cache correctness
- Asynchronous work and queue consumers
- External dependency isolation
- Observability and operational readiness
- Simplicity and proportionality
- Architecture rationale and trade-offs

This file is a maintained reference summary, not a copy of the source frameworks. The source organizations remain authoritative for their respective guidance.
