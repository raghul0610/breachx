export const CATALOG = [
  { typeKey: "client", label: "Client / User App", category: "Edge" },
  { typeKey: "internet", label: "Internet / CDN", category: "Edge" },
  { typeKey: "firewall", label: "WAF / Firewall", category: "Security" },
  { typeKey: "load_balancer", label: "Load Balancer", category: "Network" },
  { typeKey: "api_gateway", label: "API Gateway", category: "Routing" },
  { typeKey: "app_server", label: "App Server", category: "Compute" },
  { typeKey: "cache", label: "Cache (Redis/Mem)", category: "Storage" },
  { typeKey: "database", label: "Database (Primary/Replica)", category: "Storage" },
  { typeKey: "queue", label: "Message Queue", category: "Messaging" },
  { typeKey: "storage", label: "Object Storage", category: "Storage" },
  { typeKey: "external_api", label: "External Service", category: "Third Party" }
] as const;
export type CatalogItem = typeof CATALOG[number];