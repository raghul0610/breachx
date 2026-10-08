# Architecture Evaluation Benchmark

Breach X should be calibrated against intentionally constructed architectures before the
evaluation engine is treated as reliable.

Each benchmark case should record:
- application requirements
- architecture nodes
- architecture edges
- expected high-confidence findings
- expected severity
- expected score band
- findings that must NOT be produced

## Initial cases

### 1. Broken request graph
Requirements: ordinary web application with persistent state.
Architecture: Client -> WAF -> API Gateway -> Load Balancer, with no application service.
Expected: critical request-path finding; missing application service; low score.
Must not: reward the load balancer as evidence of a complete architecture.

### 2. Public database exposure
Requirements: application with user accounts and persistent data.
Architecture: Client -> API Gateway -> Database.
Expected: critical security finding; application boundary missing; low score.
Must not: treat the API gateway as sufficient protection for direct database access.

### 3. Queue without consumer
Requirements: notification-heavy application.
Architecture: App -> Queue, with no consumer.
Expected: high queue/consumer finding.
Must not: treat the presence of a queue as a positive by itself.

### 4. High availability singletons
Requirements: 99.99% availability and critical user workflow.
Architecture: Client -> LB -> one App -> one Database.
Expected: high reliability findings for single app/database dependencies.
Must not: penalize a singleton when high availability is not a stated concern.

### 5. Simple small application
Requirements: small internal CRUD application, low traffic, normal availability.
Architecture: Client -> App -> Database.
Expected: acceptable architecture with few findings.
Must not: demand load balancers, queues, caches, microservices or multi-region infrastructure.

### 6. Cache without source of truth
Requirements: persistent user data.
Architecture: Client -> App -> Cache.
Expected: high data-design finding.
Must not: treat Redis/cache presence as durable persistence.

### 7. Overengineered low-scale system
Requirements: small internal application with low traffic.
Architecture: client -> gateway -> five services -> queue -> multiple caches -> multi-region data.
Expected: complexity/maintainability concerns unless the requirements justify the components.
Must not: automatically score complexity as better scalability.

### 8. Strong production architecture
Requirements: high-scale public application, durable user data, 99.99% availability,
asynchronous notifications.
Architecture: ingress/security -> load balancing -> redundant app tier -> cache + durable
database -> queue -> worker.
Expected: high score with few high-confidence findings.
Must not: invent missing requirements.

## Calibration targets

The engine should be measured for:
- precision of findings
- recall of planted weaknesses
- severity calibration
- evidence grounding
- false-positive rate
- score calibration

A score is not considered trustworthy merely because the report sounds convincing.
