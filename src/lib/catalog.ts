export const CATALOG = [
  // Edge / delivery
  { typeKey: "client", label: "Client / User App", category: "Edge" },
  { typeKey: "internet", label: "Internet", category: "Edge" },
  { typeKey: "dns", label: "DNS", category: "Edge" },
  { typeKey: "cdn", label: "CDN", category: "Edge" },
  { typeKey: "reverse_proxy", label: "Reverse Proxy", category: "Edge" },
  { typeKey: "bff", label: "Backend for Frontend", category: "Edge" },

  // Network / routing
  { typeKey: "firewall", label: "WAF / Firewall", category: "Security" },
  { typeKey: "ddos_protection", label: "DDoS Protection", category: "Security" },
  { typeKey: "load_balancer", label: "Load Balancer", category: "Network" },
  { typeKey: "api_gateway", label: "API Gateway", category: "Routing" },
  { typeKey: "service_discovery", label: "Service Discovery", category: "Network" },
  { typeKey: "service_mesh", label: "Service Mesh", category: "Network" },
  { typeKey: "nat_gateway", label: "NAT Gateway", category: "Network" },
  { typeKey: "vpc", label: "VPC / Private Network", category: "Network" },
  { typeKey: "rate_limiter", label: "Rate Limiter", category: "Security" },

  // Compute
  { typeKey: "app_server", label: "App Server", category: "Compute" },
  { typeKey: "microservice", label: "Microservice", category: "Compute" },
  { typeKey: "container", label: "Container", category: "Compute" },
  { typeKey: "container_orchestrator", label: "Container Orchestrator", category: "Compute" },
  { typeKey: "serverless", label: "Serverless Function", category: "Compute" },
  { typeKey: "worker", label: "Worker", category: "Compute" },
  { typeKey: "batch_job", label: "Batch Job", category: "Compute" },
  { typeKey: "autoscaler", label: "Autoscaler", category: "Compute" },

  // API / realtime
  { typeKey: "rest_api", label: "REST API", category: "API" },
  { typeKey: "graphql", label: "GraphQL API", category: "API" },
  { typeKey: "websocket", label: "WebSocket", category: "Realtime" },
  { typeKey: "webhook", label: "Webhook", category: "Integration" },

  // Caching / data
  { typeKey: "cache", label: "Cache (Redis / Memcached)", category: "Data" },
  { typeKey: "database", label: "SQL Database", category: "Data" },
  { typeKey: "nosql_database", label: "NoSQL Database", category: "Data" },
  { typeKey: "search_engine", label: "Search Engine", category: "Data" },
  { typeKey: "graph_database", label: "Graph Database", category: "Data" },
  { typeKey: "time_series_db", label: "Time-Series Database", category: "Data" },
  { typeKey: "data_warehouse", label: "Data Warehouse", category: "Analytics" },
  { typeKey: "data_lake", label: "Data Lake", category: "Analytics" },
  { typeKey: "object_storage", label: "Object Storage", category: "Storage" },
  { typeKey: "blob_storage", label: "Blob Storage", category: "Storage" },
  { typeKey: "database_replica", label: "Read Replica", category: "Data" },
  { typeKey: "database_shard", label: "Database Shard", category: "Data" },
  { typeKey: "backup", label: "Backup / Snapshot", category: "Reliability" },

  // Messaging / distributed systems
  { typeKey: "kafka", label: "Kafka / Event Stream", category: "Messaging" },
  { typeKey: "queue", label: "Message Queue", category: "Messaging" },
  { typeKey: "event_bus", label: "Event Bus", category: "Messaging" },
  { typeKey: "stream_processor", label: "Stream Processor", category: "Messaging" },
  { typeKey: "dead_letter_queue", label: "Dead Letter Queue", category: "Messaging" },
  { typeKey: "workflow_engine", label: "Workflow Engine", category: "Orchestration" },
  { typeKey: "scheduler", label: "Scheduler / Cron", category: "Orchestration" },

  // Security / identity
  { typeKey: "identity_provider", label: "Identity Provider", category: "Security" },
  { typeKey: "auth_service", label: "Authentication Service", category: "Security" },
  { typeKey: "iam", label: "IAM / Authorization", category: "Security" },
  { typeKey: "secrets_manager", label: "Secrets Manager", category: "Security" },
  { typeKey: "kms", label: "Key Management / KMS", category: "Security" },
  { typeKey: "token_service", label: "Token / Session Service", category: "Security" },
  { typeKey: "audit_log", label: "Audit Log", category: "Security" },

  // Reliability / resilience
  { typeKey: "circuit_breaker", label: "Circuit Breaker", category: "Reliability" },
  { typeKey: "retry_policy", label: "Retry / Backoff", category: "Reliability" },
  { typeKey: "health_checker", label: "Health Checker", category: "Reliability" },
  { typeKey: "failover", label: "Failover / Recovery", category: "Reliability" },
  { typeKey: "multi_region", label: "Multi-Region", category: "Reliability" },

  // Operations / platform
  { typeKey: "logger", label: "Centralized Logging", category: "Observability" },
  { typeKey: "metrics", label: "Metrics / Monitoring", category: "Observability" },
  { typeKey: "tracing", label: "Distributed Tracing", category: "Observability" },
  { typeKey: "alerting", label: "Alerting / SLOs", category: "Observability" },
  { typeKey: "config_service", label: "Configuration Service", category: "Platform" },
  { typeKey: "feature_flags", label: "Feature Flags", category: "Platform" },

  // External / business dependencies
  { typeKey: "payment_service", label: "Payment Service", category: "External" },
  { typeKey: "notification_service", label: "Notification Service", category: "External" },
  { typeKey: "external_api", label: "External Service / API", category: "External" },

  // Banking / financial systems
  { typeKey: "transaction_processor", label: "Transaction Processing Service", category: "Banking" },
  { typeKey: "transaction_ledger", label: "Account / Transaction Ledger", category: "Banking" },
  { typeKey: "fraud_detection", label: "Fraud Detection / Risk Engine", category: "Banking" },
  { typeKey: "kyc_aml_service", label: "KYC / AML Verification", category: "Banking" },
  { typeKey: "reconciliation_service", label: "Settlement / Reconciliation", category: "Banking" },
  { typeKey: "idempotency_store", label: "Idempotency / Deduplication Store", category: "Banking" },
  { typeKey: "hsm", label: "Hardware Security Module (HSM)", category: "Security" },

  // AI / LLM applications
  { typeKey: "llm_gateway", label: "LLM Gateway / Model Router", category: "AI / ML" },
  { typeKey: "model_inference", label: "LLM / Model Inference", category: "AI / ML" },
  { typeKey: "gpu_inference_pool", label: "GPU Inference Pool", category: "AI / ML" },
  { typeKey: "embedding_service", label: "Embedding Service", category: "AI / ML" },
  { typeKey: "vector_database", label: "Vector Database", category: "AI / ML" },
  { typeKey: "reranker", label: "Reranker / Retrieval Ranking", category: "AI / ML" },
  { typeKey: "prompt_guardrails", label: "Prompt Safety / Guardrails", category: "AI / ML" },
  { typeKey: "tool_executor", label: "Tool / Function Execution Sandbox", category: "AI / ML" },
  { typeKey: "conversation_store", label: "Conversation / Chat History Store", category: "AI / ML" },
  { typeKey: "model_registry", label: "Model Registry", category: "AI / ML" },
  { typeKey: "feature_store", label: "Feature Store", category: "AI / ML" },
  { typeKey: "document_parser", label: "Document Ingestion / Parser", category: "AI / ML" },

  // Common production platform components
  { typeKey: "schema_registry", label: "Schema Registry", category: "Messaging" },
] as const;

export type CatalogItem = typeof CATALOG[number];


export type ComponentCapability = {
  capabilities: string[];
  operationalComplexity: "low" | "medium" | "high";
  costProfile: "low" | "medium" | "high" | "very_high";
};

export const COMPONENT_CAPABILITIES: Record<string, ComponentCapability> = {
  load_balancer:{capabilities:["traffic distribution","health-based routing"],operationalComplexity:"medium",costProfile:"medium"},
  service_discovery:{capabilities:["service discovery","traffic distribution"],operationalComplexity:"medium",costProfile:"medium"},
  service_mesh:{capabilities:["service-to-service routing","traffic distribution","mTLS"],operationalComplexity:"high",costProfile:"high"},
  autoscaler:{capabilities:["elastic capacity","horizontal scaling"],operationalComplexity:"medium",costProfile:"medium"},
  microservice:{capabilities:["independent service ownership","independent scaling"],operationalComplexity:"high",costProfile:"high"},
  container_orchestrator:{capabilities:["container scheduling","service recovery","horizontal scaling"],operationalComplexity:"high",costProfile:"high"},
  cache:{capabilities:["low-latency reads","read offload"],operationalComplexity:"medium",costProfile:"medium"},
  database:{capabilities:["durable transactional state","strong consistency"],operationalComplexity:"medium",costProfile:"medium"},
  nosql_database:{capabilities:["horizontally scalable data","high throughput"],operationalComplexity:"medium",costProfile:"medium"},
  database_replica:{capabilities:["read scaling","replication"],operationalComplexity:"high",costProfile:"high"},
  database_shard:{capabilities:["write/storage scale-out","partitioned data"],operationalComplexity:"high",costProfile:"very_high"},
  queue:{capabilities:["asynchronous work","burst buffering","producer-consumer decoupling"],operationalComplexity:"medium",costProfile:"medium"},
  kafka:{capabilities:["durable event streaming","high-throughput asynchronous processing","replay"],operationalComplexity:"high",costProfile:"high"},
  event_bus:{capabilities:["event routing","producer-consumer decoupling"],operationalComplexity:"medium",costProfile:"medium"},
  workflow_engine:{capabilities:["workflow orchestration","asynchronous work"],operationalComplexity:"high",costProfile:"high"},
  cdn:{capabilities:["edge caching","global content delivery"],operationalComplexity:"low",costProfile:"medium"},
  search_engine:{capabilities:["full-text search","faceted retrieval"],operationalComplexity:"high",costProfile:"high"},
  api_gateway:{capabilities:["API routing","authentication integration","rate limiting"],operationalComplexity:"medium",costProfile:"medium"},
  identity_provider:{capabilities:["identity management","authentication"],operationalComplexity:"medium",costProfile:"medium"},
  iam:{capabilities:["authorization","least privilege"],operationalComplexity:"medium",costProfile:"medium"},
  circuit_breaker:{capabilities:["dependency failure isolation"],operationalComplexity:"medium",costProfile:"low"},
  retry_policy:{capabilities:["transient-failure recovery","bounded retries"],operationalComplexity:"low",costProfile:"low"},
  failover:{capabilities:["recovery routing","failure-domain resilience"],operationalComplexity:"high",costProfile:"high"},
  multi_region:{capabilities:["regional failure resilience"],operationalComplexity:"high",costProfile:"very_high"},
  metrics:{capabilities:["health and performance measurement"],operationalComplexity:"medium",costProfile:"medium"},
  tracing:{capabilities:["distributed request tracing"],operationalComplexity:"medium",costProfile:"medium"},
  alerting:{capabilities:["incident detection","SLO-based alerting"],operationalComplexity:"medium",costProfile:"low"},
  transaction_processor:{capabilities:["transaction validation","business-rule enforcement","idempotent transaction handling"],operationalComplexity:"high",costProfile:"high"},
  transaction_ledger:{capabilities:["durable financial records","account balance history","transaction auditability"],operationalComplexity:"high",costProfile:"high"},
  fraud_detection:{capabilities:["fraud signals","transaction risk scoring"],operationalComplexity:"high",costProfile:"high"},
  kyc_aml_service:{capabilities:["identity verification","compliance screening"],operationalComplexity:"high",costProfile:"high"},
  reconciliation_service:{capabilities:["settlement reconciliation","mismatch detection"],operationalComplexity:"medium",costProfile:"medium"},
  idempotency_store:{capabilities:["duplicate request protection","idempotency keys"],operationalComplexity:"medium",costProfile:"low"},
  hsm:{capabilities:["protected cryptographic key operations","hardware-backed key isolation"],operationalComplexity:"high",costProfile:"high"},
  llm_gateway:{capabilities:["model routing","provider abstraction","token and spend controls"],operationalComplexity:"medium",costProfile:"medium"},
  model_inference:{capabilities:["LLM inference","model-generated responses"],operationalComplexity:"high",costProfile:"very_high"},
  gpu_inference_pool:{capabilities:["GPU-backed inference","inference capacity scaling"],operationalComplexity:"high",costProfile:"very_high"},
  embedding_service:{capabilities:["text embeddings","semantic retrieval preparation"],operationalComplexity:"medium",costProfile:"medium"},
  vector_database:{capabilities:["vector similarity search","semantic retrieval"],operationalComplexity:"high",costProfile:"high"},
  reranker:{capabilities:["retrieval relevance ranking","context selection"],operationalComplexity:"medium",costProfile:"medium"},
  prompt_guardrails:{capabilities:["input and output safety checks","prompt-injection risk reduction"],operationalComplexity:"medium",costProfile:"medium"},
  tool_executor:{capabilities:["controlled tool execution","external action isolation"],operationalComplexity:"high",costProfile:"high"},
  conversation_store:{capabilities:["durable conversation history","session context persistence"],operationalComplexity:"medium",costProfile:"medium"},
  model_registry:{capabilities:["model version tracking","model artifact governance"],operationalComplexity:"medium",costProfile:"medium"},
  feature_store:{capabilities:["consistent model features","online and offline feature access"],operationalComplexity:"high",costProfile:"high"},
  document_parser:{capabilities:["document extraction","unstructured content ingestion"],operationalComplexity:"medium",costProfile:"medium"},
  schema_registry:{capabilities:["event schema governance","message compatibility checks"],operationalComplexity:"medium",costProfile:"medium"},
};
