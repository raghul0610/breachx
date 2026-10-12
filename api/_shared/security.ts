import { createClient } from "@supabase/supabase-js";

declare const process: { env: Record<string, string | undefined> };

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): ApiResponse;
  json(body: unknown): unknown;
};

type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

const MAX_EVALUATION_BODY_BYTES = 64 * 1024;
const MAX_GENERATOR_BODY_BYTES = 16 * 1024;
const RATE_WINDOW_SECONDS = 60;
const USER_REQUESTS_PER_WINDOW = 8;
const IP_REQUESTS_PER_WINDOW = 20;
const DEVELOPMENT_LIMITS = new Map<string, { count: number; resetAt: number }>();

function reply(res: ApiResponse, status: number, message: string, headers?: Record<string, string>) {
  for (const [name, value] of Object.entries(headers ?? {})) res.setHeader(name, value);
  return res.status(status).json({ error: message });
}

function header(req: ApiRequest, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function getIpAddress(req: ApiRequest): string {
  const realIp = header(req, "x-real-ip").trim();
  if (realIp) return realIp.slice(0, 128);
  const forwarded = header(req, "x-forwarded-for").split(",")[0]?.trim();
  return (forwarded || "unknown").slice(0, 128);
}

async function sharedRateLimit(key: string, limit: number): Promise<RateLimitResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
      throw new Error("RATE_LIMIT_STORE_UNAVAILABLE");
    }
    const now = Date.now();
    const existing = DEVELOPMENT_LIMITS.get(key);
    const current = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + RATE_WINDOW_SECONDS * 1000 }
      : existing;
    current.count += 1;
    DEVELOPMENT_LIMITS.set(key, current);
    if (DEVELOPMENT_LIMITS.size > 10_000) {
      for (const [entryKey, entry] of DEVELOPMENT_LIMITS) {
        if (entry.resetAt <= now) DEVELOPMENT_LIMITS.delete(entryKey);
      }
    }
    return {
      allowed: current.count <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  const script = [
    "local current = redis.call('INCR', KEYS[1])",
    "if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
    "local ttl = redis.call('TTL', KEYS[1])",
    "return {current, ttl}",
  ].join("\n");

  const response = await fetch(redisUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["EVAL", script, 1, key, RATE_WINDOW_SECONDS]),
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) throw new Error("RATE_LIMIT_STORE_UNAVAILABLE");

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.result)
    || typeof payload.result[0] !== "number" || typeof payload.result[1] !== "number") {
    throw new Error("RATE_LIMIT_STORE_UNAVAILABLE");
  }
  const count = payload.result[0];
  const ttl = payload.result[1];
  return { allowed: count <= limit, retryAfterSeconds: Math.max(1, ttl) };
}

export async function authorizeAndRateLimit(
  req: ApiRequest,
  res: ApiResponse,
  maxBodyBytes: number,
): Promise<{ userId: string } | null> {
  if (req.method !== "POST") {
    reply(res, 405, "Method not allowed.", { Allow: "POST" });
    return null;
  }

  const declaredLength = Number(header(req, "content-length"));
  if (header(req, "content-length") && (!Number.isFinite(declaredLength) || declaredLength < 0)) {
    reply(res, 400, "Invalid Content-Length header.");
    return null;
  }
  if (declaredLength > maxBodyBytes) {
    reply(res, 413, "Request body is too large.");
    return null;
  }
  if (req.body === undefined || !isRecord(req.body)) {
    reply(res, 400, "A JSON object request body is required.");
    return null;
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(req.body);
  } catch {
    reply(res, 400, "Invalid JSON request body.");
    return null;
  }
  if (byteLength(serialized) > maxBodyBytes) {
    reply(res, 413, "Request body is too large.");
    return null;
  }

  const contentType = header(req, "content-type").toLowerCase();
  if (contentType && !contentType.includes("application/json") && !contentType.includes("+json")) {
    reply(res, 415, "Content-Type must be application/json.");
    return null;
  }

  const authorization = header(req, "authorization");
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  if (!match) {
    reply(res, 401, "Sign in to use AI features.");
    return null;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY
    ?? process.env.SUPABASE_ANON_KEY
    ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    reply(res, 503, "AI service authentication is not configured.");
    return null;
  }

  let userId: string;
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5_000) }) },
    });
    const { data, error } = await supabase.auth.getUser(match[1]);
    if (error || !data.user?.id) {
      reply(res, 401, "Your session is invalid or expired. Sign in again.");
      return null;
    }
    userId = data.user.id;
  } catch {
    reply(res, 503, "Could not verify your session. Try again shortly.");
    return null;
  }

  try {
    const ipKey = `anchon:ai:minute:ip:${encodeURIComponent(getIpAddress(req))}`;
    const userKey = `anchon:ai:minute:user:${encodeURIComponent(userId)}`;
    const ipLimit = await sharedRateLimit(ipKey, IP_REQUESTS_PER_WINDOW);
    if (!ipLimit.allowed) {
      reply(res, 429, "Too many AI requests. Try again shortly.", { "Retry-After": String(ipLimit.retryAfterSeconds) });
      return null;
    }
    const userLimit = await sharedRateLimit(userKey, USER_REQUESTS_PER_WINDOW);
    if (!userLimit.allowed) {
      reply(res, 429, "AI request limit reached. Try again in a minute.", { "Retry-After": String(userLimit.retryAfterSeconds) });
      return null;
    }
  } catch {
    // Fail closed in production: do not call the paid provider without shared abuse controls.
    reply(res, 503, "AI protection is temporarily unavailable. Try again shortly.");
    return null;
  }

  return { userId };
}

export function validateEvaluationPayload(body: Record<string, unknown>): string | null {
  const application = body.application;
  if (!isRecord(application)
    || typeof application.name !== "string" || application.name.trim().length < 1 || application.name.length > 120
    || typeof application.description !== "string" || application.description.length > 4_000) {
    return "Application name and description are invalid.";
  }
  if (!Array.isArray(body.nodes) || body.nodes.length < 1 || body.nodes.length > 100) {
    return "Provide between 1 and 100 architecture nodes.";
  }
  const ids = new Set<string>();
  for (const value of body.nodes) {
    if (!isRecord(value)
      || typeof value.id !== "string" || value.id.length < 1 || value.id.length > 80
      || typeof value.typeKey !== "string" || value.typeKey.length > 80
      || typeof value.label !== "string" || value.label.length > 120
      || typeof value.category !== "string" || value.category.length > 80
      || (value.notes !== undefined && (typeof value.notes !== "string" || value.notes.length > 1_000))) {
      return "One or more architecture nodes are invalid.";
    }
    if (ids.has(value.id)) return "Architecture node IDs must be unique.";
    ids.add(value.id);
  }
  if (!Array.isArray(body.edges) || body.edges.length > 200) {
    return "Provide no more than 200 architecture connections.";
  }
  for (const value of body.edges) {
    if (!isRecord(value)
      || typeof value.source !== "string" || typeof value.target !== "string"
      || !ids.has(value.source) || !ids.has(value.target)
      || (value.id !== undefined && (typeof value.id !== "string" || value.id.length > 80))) {
      return "One or more architecture connections are invalid.";
    }
  }
  if (body.notes !== undefined && (typeof body.notes !== "string" || body.notes.length > 4_000)) {
    return "Notes must be 4,000 characters or fewer.";
  }
  if (body.workload !== undefined && body.workload !== null && !isRecord(body.workload)) {
    return "Workload must be an object.";
  }
  if (body.graphAnalysis !== undefined && body.graphAnalysis !== null && !isRecord(body.graphAnalysis)) {
    return "Graph analysis must be an object.";
  }
  return null;
}

export function validateGeneratorPayload(body: Record<string, unknown>): string | null {
  if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.length > 120) {
    return "Application name must be between 2 and 120 characters.";
  }
  if (typeof body.requirements !== "string"
    || body.requirements.trim().length < 20 || body.requirements.length > 8_000) {
    return "Requirements must be between 20 and 8,000 characters.";
  }
  return null;
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}

export const AI_REQUEST_LIMITS = {
  evaluationBodyBytes: MAX_EVALUATION_BODY_BYTES,
  generatorBodyBytes: MAX_GENERATOR_BODY_BYTES,
  requestsPerUserPerMinute: USER_REQUESTS_PER_WINDOW,
  requestsPerIpPerMinute: IP_REQUESTS_PER_WINDOW,
} as const;
