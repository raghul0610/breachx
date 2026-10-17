import type { CatalogItem } from "./catalog";

export type ComponentKnowledge = {
  summary: string;
  whatItIs: string;
  whenToUse: string;
  howItFits: string;
  tradeoffs: string;
  example: string;
};

const KNOWLEDGE: Record<string, ComponentKnowledge> = {
  client: {
    summary: "The entry point where a person or another system uses your application.",
    whatItIs: "A client is the user-facing application, such as a browser app, mobile app, or desktop application. It sends requests and presents the results.",
    whenToUse: "Use it whenever people or external systems need to interact with your product.",
    howItFits: "It commonly sends traffic through DNS, a CDN, a WAF, a load balancer, or an API gateway before reaching application services.",
    tradeoffs: "More client-side logic can improve responsiveness, but it also increases complexity and must not be trusted for security-sensitive validation.",
    example: "A React web app that sends a sign-in request to your backend.",
  },
  internet: {
    summary: "The external network through which users and systems reach your service.",
    whatItIs: "The public Internet connects clients to publicly reachable endpoints. It represents an external boundary, not an application server.",
    whenToUse: "Include it when showing the boundary between users or external callers and your hosted system.",
    howItFits: "Traffic typically reaches DNS and edge protections such as a CDN, DDoS protection, or WAF before entering your network.",
    tradeoffs: "Public reachability improves access but exposes endpoints to latency, outages, abuse, and attacks.",
    example: "A mobile client calling your service over HTTPS.",
  },
  dns: {
    summary: "Translates a domain name into the address or endpoint a client should contact.",
    whatItIs: "Domain Name System (DNS) resolves names such as api.example.com to IP addresses or other records.",
    whenToUse: "Use it for services accessed through domain names, traffic steering, or endpoint discovery.",
    howItFits: "It sits before the client establishes a connection to your CDN, load balancer, or public service endpoint.",
    tradeoffs: "DNS caching improves efficiency, but cached records can delay failover or endpoint changes.",
    example: "api.example.com resolves to your cloud load balancer.",
  },
  cdn: {
    summary: "Caches and serves content from locations closer to users.",
    whatItIs: "A Content Delivery Network (CDN) distributes cached static assets and, where configured, cacheable responses across edge locations.",
    whenToUse: "Use it for global users, static assets, downloads, media, or cacheable content where lower latency matters.",
    howItFits: "It usually sits near the public edge, in front of an origin such as object storage or an application endpoint.",
    tradeoffs: "It reduces origin load and latency, but cache invalidation, stale content, and cache rules need careful management.",
    example: "Serving website images and JavaScript bundles from edge locations.",
  },
  firewall: {
    summary: "Filters traffic according to security rules before it reaches protected services.",
    whatItIs: "A firewall controls which network traffic is allowed or denied. A web application firewall (WAF) focuses on HTTP traffic and common web attacks.",
    whenToUse: "Use it to enforce network boundaries or protect public web endpoints. Choose a WAF for HTTP-layer filtering.",
    howItFits: "It is commonly placed at the edge or between network zones before traffic reaches application services.",
    tradeoffs: "Rules reduce exposure but can block legitimate traffic if poorly configured; a WAF does not replace secure application code.",
    example: "A WAF blocks suspicious requests before they reach the API gateway.",
  },
  load_balancer: {
    summary: "Distributes incoming requests across multiple healthy targets.",
    whatItIs: "A load balancer routes traffic among servers or service instances using policies such as round-robin, least connections, or health-aware routing.",
    whenToUse: "Use it when running multiple instances, needing health checks, or separating a stable endpoint from changing backends.",
    howItFits: "It commonly sits in front of application servers or services and can work alongside an API gateway.",
    tradeoffs: "It improves availability and capacity distribution, but adds configuration and can become a bottleneck if deployed without redundancy.",
    example: "Distributing API traffic across three application instances.",
  },
  api_gateway: {
    summary: "Provides a managed entry point for APIs and routes requests to backend services.",
    whatItIs: "An API gateway can centralize routing, authentication integration, rate limits, request policies, and API-level observability.",
    whenToUse: "Use it when multiple APIs need a consistent entry point or shared cross-cutting policies.",
    howItFits: "It receives client API requests and forwards them to the relevant service; it may sit behind a CDN or load balancer.",
    tradeoffs: "It simplifies clients and centralizes policy, but overloading it with business logic creates a bottleneck and a tightly coupled dependency.",
    example: "Routing /users requests to the user service and /orders requests to the order service.",
  },
  app_server: {
    summary: "Runs application code and handles requests or business logic.",
    whatItIs: "An application server executes the backend logic for an application, such as validating requests, coordinating services, and preparing responses.",
    whenToUse: "Use it to represent the backend runtime when the architecture does not need to distinguish many individual services.",
    howItFits: "It typically receives traffic from an API gateway or load balancer and communicates with databases, caches, or other services.",
    tradeoffs: "A single application can be simpler to operate, but may become harder to scale or change independently as it grows.",
    example: "A Node.js service that validates an order and stores it in a database.",
  },
  microservice: {
    summary: "A separately deployable service responsible for a focused business capability.",
    whatItIs: "A microservice owns a bounded piece of application behavior and communicates with other services through APIs or messaging.",
    whenToUse: "Consider it when a domain needs independent deployment, ownership, or scaling and the team can manage distributed-system complexity.",
    howItFits: "It may be reached through an API gateway or service-to-service calls and may use queues or its own data store.",
    tradeoffs: "Independent scaling and releases come with network failures, observability needs, data consistency challenges, and operational overhead.",
    example: "A separate payment service that handles payment authorization and status.",
  },
  cache: {
    summary: "Keeps frequently accessed data in a faster storage layer to reduce latency and backend load.",
    whatItIs: "A cache stores reusable data temporarily, often in memory, so repeated reads do not always hit the primary data source.",
    whenToUse: "Use it when repeated reads are expensive and the application can tolerate a defined freshness policy.",
    howItFits: "An application service commonly checks the cache first and falls back to a database on a cache miss.",
    tradeoffs: "It can reduce latency and load, but introduces invalidation, stale-data, memory-capacity, and cache-miss concerns.",
    example: "Caching a user's profile for a short time in Redis.",
  },
  database: {
    summary: "Stores structured application data durably, often with transactional guarantees.",
    whatItIs: "A SQL relational database stores data in tables and supports querying and relationships using SQL. Many systems also provide transactions and constraints.",
    whenToUse: "Use it for structured data, relationships, and workflows that benefit from constraints and transactional consistency.",
    howItFits: "Backend services read and write data through queries or a data-access layer; clients should not bypass the backend unless a deliberately secured architecture allows it.",
    tradeoffs: "Relational databases offer strong data integrity and flexible queries, but scaling writes and managing schema changes require planning.",
    example: "PostgreSQL stores users, orders, and payment records.",
  },
  nosql_database: {
    summary: "Stores data using a non-relational model designed for particular access patterns.",
    whatItIs: "A NoSQL database may use documents, key-value pairs, wide columns, or another model instead of relational tables.",
    whenToUse: "Consider it when the data model and access patterns fit the database's strengths, such as high-volume key lookups or flexible documents.",
    howItFits: "Application services access it through a client or repository layer, usually with data modeling tailored to expected queries.",
    tradeoffs: "It can support specific scale and data-model needs, but query flexibility, transactions, consistency, and operations vary by product.",
    example: "A document database stores flexible product catalog records.",
  },
  object_storage: {
    summary: "Stores files and large unstructured objects independently from application compute.",
    whatItIs: "Object storage stores objects such as images, documents, backups, and media, typically addressed by keys in buckets or containers.",
    whenToUse: "Use it for user uploads, static assets, archives, logs, and large files that do not belong in ordinary relational rows.",
    howItFits: "The backend usually authorizes uploads and downloads while storing object metadata or references in a database.",
    tradeoffs: "It scales well for files, but access policies, lifecycle rules, object consistency, and secure URLs need careful design.",
    example: "Store profile images in object storage and keep their object keys in PostgreSQL.",
  },
  queue: {
    summary: "Buffers work so producers and consumers can operate independently and asynchronously.",
    whatItIs: "A message queue holds tasks or messages until a consumer processes them, separating the request that creates work from the worker that performs it.",
    whenToUse: "Use it for background jobs, burst absorption, retries, or work that does not need to finish during the user's request.",
    howItFits: "An API or service publishes a message; one or more workers consume it and may update a database or call another service.",
    tradeoffs: "It improves decoupling and resilience, but introduces delivery semantics, duplicate handling, retries, ordering, and queue monitoring.",
    example: "An order API queues an email notification for a background worker.",
  },
  kafka: {
    summary: "A distributed event-streaming platform for durable, high-throughput event pipelines.",
    whatItIs: "Kafka stores ordered event records in partitioned topics so multiple consumers can process or replay streams independently.",
    whenToUse: "Consider it for high-throughput event streams, event-driven integration, replayable data pipelines, and multiple independent consumers.",
    howItFits: "Services publish events to topics and consumer groups read them to update systems, analytics, or downstream workflows.",
    tradeoffs: "It supports scale and replay, but adds operational complexity around partitions, schemas, consumer lag, retention, and delivery semantics.",
    example: "An order service publishes OrderCreated events consumed by analytics and fulfillment.",
  },
  identity_provider: {
    summary: "Authenticates users and issues identity tokens or assertions to applications.",
    whatItIs: "An identity provider manages identity workflows such as sign-in, federation, multi-factor authentication, and token issuance.",
    whenToUse: "Use it when applications need centralized identity, single sign-on, or delegated authentication.",
    howItFits: "The client or application redirects to the provider or validates tokens issued by it; services still enforce authorization.",
    tradeoffs: "Centralized identity reduces duplicated auth logic, but makes provider availability, secure configuration, and account recovery important.",
    example: "A web app uses an identity provider with OpenID Connect to sign users in.",
  },
  auth_service: {
    summary: "Implements application-specific authentication flows and session handling.",
    whatItIs: "An authentication service verifies credentials or identity tokens and establishes the authenticated context used by an application.",
    whenToUse: "Use it when authentication logic must be owned by your application or coordinated with other internal services.",
    howItFits: "It works with an identity store or provider and gives downstream services a trusted identity context.",
    tradeoffs: "Custom authentication offers control but increases security responsibility; prefer established identity standards and reviewed libraries.",
    example: "An auth service validates a sign-in attempt and issues a short-lived session token.",
  },
  rate_limiter: {
    summary: "Restricts request frequency to protect services and enforce usage limits.",
    whatItIs: "A rate limiter applies a policy such as requests per user, IP, token, or time window.",
    whenToUse: "Use it to protect expensive endpoints, enforce quotas, or reduce abuse and accidental overload.",
    howItFits: "It often runs at the API gateway or service boundary before expensive application work begins.",
    tradeoffs: "It protects capacity, but distributed counters, legitimate traffic bursts, and identity-based limits require careful policy design.",
    example: "Allow a client no more than 100 API requests per minute.",
  },
  metrics: {
    summary: "Collects numeric measurements that show system health and performance over time.",
    whatItIs: "Metrics are time-stamped measurements such as request rate, error rate, latency, CPU use, or queue depth.",
    whenToUse: "Use them to understand trends, monitor service-level objectives, and trigger alerts.",
    howItFits: "Applications and infrastructure emit metrics to a monitoring backend, where dashboards and alert rules consume them.",
    tradeoffs: "Metrics are efficient for trends and alerting, but high-cardinality labels can become expensive and metrics alone may not explain an individual request.",
    example: "Track API p95 latency and the percentage of failed requests.",
  },
  tracing: {
    summary: "Follows a request across services to reveal where time is spent and where failures occur.",
    whatItIs: "Distributed tracing links spans from a single operation across service boundaries using trace context.",
    whenToUse: "Use it in distributed systems where a slow or failed request may pass through several services.",
    howItFits: "Instrumented services propagate trace context and export spans to a tracing backend.",
    tradeoffs: "Tracing provides request-level visibility, but instrumentation, sampling, and sensitive-data handling need attention.",
    example: "Trace a checkout request from API gateway to order service to database.",
  },
};

const CATEGORY_GUIDANCE: Record<string, string> = {
  Edge: "It helps establish how users or external systems enter and reach the application.",
  Security: "It helps enforce trust boundaries, identity, access control, or protection against misuse.",
  Network: "It helps connect, isolate, discover, or route traffic between parts of the system.",
  Routing: "It helps direct incoming requests to the appropriate backend capability.",
  Compute: "It provides the runtime or execution capacity for application work.",
  API: "It defines or exposes an interface that clients or other services can call.",
  Realtime: "It supports communication where updates need to flow with low delay.",
  Data: "It stores, retrieves, or accelerates access to application data.",
  Storage: "It keeps files or other persisted content available to the system.",
  Messaging: "It transfers events or tasks between producers and consumers.",
  Orchestration: "It coordinates jobs, schedules, or multi-step workflows.",
  Reliability: "It helps the system recover from failures or preserve availability.",
  Observability: "It helps operators understand system behavior and diagnose issues.",
  Analytics: "It supports analysis of historical or large-scale data.",
  Integration: "It connects application behavior to external systems or callbacks.",
  "AI / ML": "It supports a stage of an AI/ML workflow, from model execution to retrieval or data preparation.",
};

const NICHE_KNOWLEDGE: Record<string, ComponentKnowledge> = {
  authoritative_dns: { summary: "Publishes the official DNS records for a domain.", whatItIs: "An authoritative DNS server answers queries using the records it owns, such as A, AAAA, CNAME, MX, and TXT records. It is different from a recursive resolver.", whenToUse: "Use it to represent the DNS provider or nameserver that owns your domain's records.", howItFits: "A recursive resolver queries authoritative nameservers when it needs an answer that is not already cached. DNS resolution happens before the client connects to your application endpoint.", tradeoffs: "Redundancy, DNSSEC, record management, TTLs, and provider availability matter; changing DNS records does not instantly invalidate all caches.", example: "Authoritative DNS returns the public endpoint for api.example.com." },
  dns_resolver: { summary: "Looks up DNS records on behalf of clients and caches answers.", whatItIs: "A recursive resolver queries DNS hierarchy and returns a cached or newly resolved answer to the requesting client.", whenToUse: "Use it when modeling internal DNS, client DNS resolution, or service discovery dependencies.", howItFits: "Clients query the resolver; the resolver may query authoritative DNS. It does not carry application payloads or replace an API endpoint.", tradeoffs: "Caching improves speed and reduces repeated lookups, but stale records and resolver outages can affect reachability.", example: "A workload resolves payments.internal to a private service address." },
  transcoding_server: { summary: "Converts media into playback-ready codecs, resolutions, and bitrates.", whatItIs: "A transcoding server decodes uploaded audio/video and re-encodes it into variants suitable for different devices, networks, or streaming protocols.", whenToUse: "Use it for video platforms, user-generated clips, live-stream pipelines, and media libraries with multiple playback profiles.", howItFits: "A typical pipeline stores the upload in object storage, queues a transcoding job, runs workers, and writes output renditions to storage or a media origin.", tradeoffs: "Encoding is compute-intensive and can add queueing delay and substantial CPU/GPU cost. Track job failures and retry safely.", example: "A 4K upload is converted into 1080p, 720p, and mobile bitrate variants." },
  media_origin: { summary: "Packages and serves media segments to streaming clients or a CDN.", whatItIs: "A media origin stores or exposes encoded renditions and streaming manifests, often using HLS or DASH packaging.", whenToUse: "Use it when your architecture serves video or audio streams at scale.", howItFits: "Transcoding workers publish outputs to the origin; a CDN can cache segments between the origin and viewers.", tradeoffs: "Origin bandwidth, cache misses, manifest consistency, and segment availability affect playback quality.", example: "The origin serves HLS playlists and video segments to a CDN." },
  webrtc_sfu: { summary: "Forwards selected real-time audio/video streams between participants.", whatItIs: "A Selective Forwarding Unit receives WebRTC media streams and forwards relevant streams to other participants without mixing every stream into one output.", whenToUse: "Use it for multi-party video calls, webinars, and real-time collaboration.", howItFits: "Clients establish signaling through an application service and exchange media through the SFU; STUN/TURN helps with NAT traversal when needed.", tradeoffs: "Bandwidth and packet routing scale with participants and subscriptions; regional placement and congestion control matter.", example: "A group call routes each speaker's media to subscribed participants through an SFU." },
  stun_turn: { summary: "Helps WebRTC peers connect across NATs and restrictive networks.", whatItIs: "STUN helps a peer discover its public-facing address; TURN relays media when a direct path cannot be established.", whenToUse: "Use it for voice/video products where users connect from varied home, mobile, or corporate networks.", howItFits: "The client learns connection candidates through ICE; TURN may relay traffic between clients and a WebRTC SFU or peer.", tradeoffs: "TURN relay traffic can be bandwidth-expensive. STUN alone cannot guarantee a connection through restrictive NAT or firewalls.", example: "A mobile user falls back to TURN relay when a direct media path fails." },
  smtp_relay: { summary: "Relays outbound email to recipient mail servers.", whatItIs: "An SMTP relay accepts outgoing messages from trusted services and transfers them toward recipient mail systems.", whenToUse: "Use it for transactional email, verification links, receipts, and notifications.", howItFits: "An application or notification worker submits email to the relay; queues, retries, SPF, DKIM, and DMARC support reliable delivery.", tradeoffs: "Provider limits, reputation, bounce handling, and delivery delays require monitoring.", example: "A background worker sends password-reset email through an SMTP relay." },
  push_gateway: { summary: "Routes push notifications to platform delivery providers.", whatItIs: "A push gateway abstracts delivery to providers such as Apple Push Notification service or Firebase Cloud Messaging.", whenToUse: "Use it when mobile or browser clients need notifications while the app is inactive.", howItFits: "A notification service sends a message to the gateway, which forwards it to the relevant provider and device token.", tradeoffs: "Delivery is best-effort; token expiry, provider throttling, and retries need handling.", example: "An order service triggers a push notification after shipment." },
  ocr_service: { summary: "Extracts machine-readable text from images and scanned documents.", whatItIs: "Optical character recognition detects text in an image or page and returns text plus optional layout or confidence information.", whenToUse: "Use it for invoices, receipts, identity documents, scanned forms, and searchable archives.", howItFits: "A file upload can land in object storage, trigger a queue, and pass through OCR before results are persisted or indexed.", tradeoffs: "Accuracy varies with image quality, language, handwriting, and layout; sensitive documents need access controls.", example: "OCR extracts line items from an uploaded invoice for validation." },
  image_processor: { summary: "Creates optimized image variants and thumbnails.", whatItIs: "An image-processing worker resizes, crops, converts, or compresses uploaded images into formats suited to devices and delivery requirements.", whenToUse: "Use it for profile photos, product catalogs, image-heavy feeds, and upload pipelines.", howItFits: "Uploads are stored, a job is queued, the worker writes optimized variants, and a CDN serves them.", tradeoffs: "Large images consume compute and storage; validate file types and dimensions to reduce abuse and resource exhaustion.", example: "Generate thumbnail, card, and full-size WebP variants after upload." },
  egress_gateway: { summary: "Controls and observes outbound traffic leaving a network or workload boundary.", whatItIs: "An egress gateway provides a known path for outbound requests and can enforce network policy, logging, or source-IP requirements.", whenToUse: "Use it when workloads must restrict destinations or use controlled outbound access.", howItFits: "Private workloads route permitted external traffic through the gateway, which applies policy before forwarding it.", tradeoffs: "Centralization improves control but can add latency and become a bottleneck if not made resilient.", example: "Only approved services can reach a third-party payment API through egress policy." },
  policy_engine: { summary: "Evaluates authorization rules separately from application code.", whatItIs: "A policy decision engine evaluates attributes, identities, resources, and context to return an allow/deny decision.", whenToUse: "Use it when many services need consistent, auditable authorization rules.", howItFits: "A service or policy enforcement point sends context to the engine, then enforces its decision.", tradeoffs: "Central policies improve consistency but require careful failure behavior, policy versioning, and low-latency evaluation.", example: "An authorization service checks whether a user may export a tenant's data." },
  certificate_authority: { summary: "Issues and manages certificates that establish cryptographic identity.", whatItIs: "A certificate authority signs certificates used to bind identities to public keys, commonly for TLS or internal service identity.", whenToUse: "Use it when modeling certificate lifecycle or private PKI for internal services.", howItFits: "Services obtain certificates and present them during TLS handshakes; trust stores validate the issuing chain.", tradeoffs: "Key protection, expiry, renewal, revocation, and trust distribution are critical operational concerns.", example: "An internal CA issues short-lived certificates for mutually authenticated services." },
  log_collector: { summary: "Receives, buffers, and forwards logs to a central observability backend.", whatItIs: "A log collector or forwarder gathers logs from hosts and workloads, enriches them, and sends them to storage or analysis systems.", whenToUse: "Use it when multiple services need centralized log search and retention.", howItFits: "Applications emit logs to agents or collectors, which forward them to a logging backend and alerting workflows.", tradeoffs: "Buffering protects against brief outages but consumes disk or memory; redact secrets and control high-volume costs.", example: "A collector forwards container logs to a centralized log platform." },
  secrets_sidecar: { summary: "Delivers secrets to a workload at runtime without baking them into its image.", whatItIs: "A sidecar or local agent retrieves secrets from a secrets manager and exposes them through a restricted file, socket, or local interface.", whenToUse: "Use it when applications need secret rotation or should avoid static credentials in environment files.", howItFits: "The workload authenticates to a secrets manager through an approved identity and receives only the secrets it is authorized to access.", tradeoffs: "Agent availability, local file permissions, rotation timing, and least-privilege identity must be designed carefully.", example: "A service agent refreshes a database credential from a vault." },
};

export function getComponentKnowledge(item: CatalogItem): ComponentKnowledge {
  const known = KNOWLEDGE[item.typeKey] ?? NICHE_KNOWLEDGE[item.typeKey];
  if (known) return known;
  const categoryPurpose = CATEGORY_GUIDANCE[item.category] ?? "It provides a specific capability within the overall application architecture.";
  return {
    summary: categoryPurpose,
    whatItIs: `${item.label} is a ${item.category} architecture component. Its exact behavior depends on the technology or implementation selected.`,
    whenToUse: `Consider it when your requirements need this capability. Confirm the expected traffic, reliability, security, and operational needs before adding it.`,
    howItFits: `${categoryPurpose} Connect it to the components that produce its input and consume its output, and label those connections to make the request or data flow clear.`,
    tradeoffs: "Every added component introduces some combination of cost, configuration, operational work, latency, and failure modes. Add it only when its capability justifies that complexity.",
    example: `In a real system, ${item.label} should have a clearly defined responsibility and an explicit relationship with the services around it.`,
  };
}
