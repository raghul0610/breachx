# System Design Learning Guide

This guide provides a structured path for learning system design from fundamentals to distributed systems. Work through the sections in order and validate each concept by drawing a small architecture in ANCHON.

## 1. Foundations

System design translates product requirements into components, interfaces, data flows, and operational constraints.

Learn to:
- Identify users, use cases, and critical user journeys.
- Separate functional requirements from non-functional requirements.
- Estimate traffic, storage, bandwidth, and growth.
- Define latency, availability, durability, and consistency goals.
- Make assumptions explicit before selecting technologies.

Practice: design a simple URL shortener. Estimate read/write traffic, define the API, and identify the data that must be stored.

## 2. Architecture patterns

Study the trade-offs among:
- **Monolith:** one deployable application with internal modules.
- **Modular monolith:** one deployment with enforced domain boundaries.
- **Microservices:** independently deployable services aligned to business capabilities.
- **Event-driven architecture:** producers publish events and consumers process them asynchronously.
- **CQRS:** separate read and write models when their needs differ materially.

Practice: model the same product as a modular monolith and as microservices. Compare operational complexity, deployment independence, and data consistency.

## 3. API and communication

Understand REST, RPC, messaging, synchronous calls, asynchronous events, API versioning, pagination, rate limiting, idempotency, retries, and timeouts.

Practice: draw a checkout request path and identify where synchronous calls end and asynchronous processing begins.

## 4. Data and storage

Learn relational databases, indexes, transactions, normalization, denormalization, replication, partitioning, sharding, caching, object storage, and search indexes.

Evaluate consistency, durability, query patterns, retention, and recovery requirements before choosing a datastore.

Practice: design storage for a messaging application. Identify the access patterns and the indexes they require.

## 5. Scalability and performance

Study vertical and horizontal scaling, load balancing, caching, CDNs, connection pooling, backpressure, queues, batching, and capacity planning.

Use workload estimates to identify bottlenecks. Do not add infrastructure without a measurable reason.

Practice: scale a read-heavy catalog service and explain how cache invalidation and database load are handled.

## 6. Reliability and availability

Learn redundancy, health checks, failover, replication, graceful degradation, circuit breakers, retries with backoff, dead-letter queues, disaster recovery, RPO, and RTO.

Practice: model a dependency outage. Show what fails, what remains available, and how the system recovers.

## 7. Security

Cover authentication, authorization, least privilege, secrets management, encryption in transit and at rest, input validation, audit logging, network boundaries, and threat modeling.

Practice: draw the trust boundaries for a multi-tenant application and show where authorization is enforced.

## 8. Distributed systems

Study partial failure, network partitions, clock assumptions, ordering, delivery semantics, consensus at a conceptual level, leader election, eventual consistency, and distributed transactions.

Practice: design an order workflow using events. Explain duplicate delivery, idempotent consumers, ordering, and compensation.

## 9. Observability and operations

Understand structured logs, metrics, traces, service-level indicators, service-level objectives, alerting, deployment strategies, rollback, and incident response.

Practice: define the metrics and traces needed to diagnose elevated p95 latency in an API.

## 10. Cost and trade-offs

Estimate compute, storage, network, managed-service, and operational costs. Compare alternatives using explicit requirements rather than popularity.

Practice: write a short decision record explaining the selected design, alternatives considered, risks, and conditions that would justify revisiting the decision.

## A repeatable system design workflow

1. Clarify scope and users.
2. List functional and non-functional requirements.
3. Estimate scale and workload.
4. Define APIs and core data entities.
5. Draw the high-level architecture.
6. Trace critical request and event flows.
7. Identify bottlenecks and failure modes.
8. Add security and operational controls.
9. Compare alternatives and document trade-offs.
10. Validate the design against measurable requirements.

## Further reading

- [Google Cloud Architecture Framework](https://cloud.google.com/architecture/framework)
- [Microsoft Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/)
- [AWS Well-Architected](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html)
- [Designing Data-Intensive Applications — book reference](https://dataintensive.net/)
