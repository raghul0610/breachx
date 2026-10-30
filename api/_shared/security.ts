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
const MAX_GENERATOR_BODY_BYTES = 64 * 1024;
const RATE_WINDOW_SECONDS = 60;
const USER_REQUESTS_PER_WINDOW = 8;
const IP_REQUESTS_PER_WINDOW = 20;
const PROVIDER_TIMEOUT_MS = 18_000;
const AUTH_TIMEOUT_MS = 5_000;
const LIMITER_TIMEOUT_MS = 3_000;
const DEVELOPMENT_LIMITS = new Map<string, { count: number; resetAt: number }>();

function reply(res: ApiResponse, status: number, message: string, headers?: Record<string, string>) {
  for (const [name, value] of Object.entries(headers ?? {})) res.setHeader(name, value);
  return res.status(status).json({ error: message });
}

function header(req: ApiRequest, name: string): string {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function getIpAddress(req: ApiRequest): string {
  // On Vercel, x-real-ip is set by the platform and is preferred over the
  // client-supplied x-forwarded-for chain.
  const realIp = header(req, "x-real-ip").trim();
  if (realIp) return realIp.slice(0, 128);
  const forwarded = header(req, "x-forwarded-for").split(",")[0]?.trim();
  return (forwarded || "unknown").slice(0, 128);
}

function requiresSharedLimiter(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

async function sharedRateLimit(key: string, limit: number): Promise<RateLimitResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    // Fail closed wherever this runs as a deployed function: never call the paid
    // provider without shared, cross-instance abuse controls.
    if (requiresSharedLimiter()) throw new Error("RATE_LIMIT_STORE_UNAVAILABLE");

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
    signal: AbortSignal.timeout(LIMITER_TIMEOUT_MS),
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

function limitKey(scope: "ip" | "user", value: string): string {
  return `anchon:ai:minute:${scope}:${encodeURIComponent(value)}`;
}

/**
 * Enforces method, content type, request size, authentication and abuse controls
 * for the AI endpoints. Returns the verified Supabase user ID, or null when a
 * response has already been sent.
 *
 * Order matters: cheap, local rejections run before any network call, the
 * per-IP limit runs before token verification so unauthenticated floods cannot
 * amplify into unbounded Supabase Auth requests, and the per-user limit runs
 * once an identity is established.
 */
export async function authorizeAndRateLimit(
  req: ApiRequest,
  res: ApiResponse,
  maxBodyBytes: number,
): Promise<{ userId: string } | null> {
  if (req.method !== "POST") {
    reply(res, 405, "Method not allowed.", { Allow: "POST" });
    return null;
  }

  // Content type is checked before body shape so a non-JSON request reports 415
  // rather than a misleading 400 about the parsed body.
  const contentType = header(req, "content-type").toLowerCase();
  if (!contentType.includes("application/json") && !contentType.includes("+json")) {
    reply(res, 415, "Content-Type must be application/json.");
    return null;
  }

  const declaredLengthHeader = header(req, "content-length");
  if (declaredLengthHeader) {
    const declaredLength = Number(declaredLengthHeader);
    if (!Number.isFinite(declaredLength) || declaredLength < 0) {
      reply(res, 400, "Invalid Content-Length header.");
      return null;
    }
    if (declaredLength > maxBodyBytes) {
      reply(res, 413, "Request body is too large.");
      return null;
    }
  }

  if (req.body === undefined || !isRecord(req.body)) {
    reply(res, 400, "A JSON object request body is required.");
    return null;
  }
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(req.body);
  } catch {
    reply(res, 400, "Invalid JSON request body.");
    return null;
  }
  if (typeof serialized !== "string") {
    reply(res, 400, "Invalid JSON request body.");
    return null;
  }
  if (byteLength(serialized) > maxBodyBytes) {
    reply(res, 413, "Request body is too large.");
    return null;
  }

  // Per-IP limit first: this bounds anonymous abuse and auth-failure floods so
  // that invalid tokens cannot amplify into unbounded Supabase Auth requests.
  try {
    const ipLimit = await sharedRateLimit(limitKey("ip", getIpAddress(req)), IP_REQUESTS_PER_WINDOW);
    if (!ipLimit.allowed) {
      reply(res, 429, "Too many AI requests. Try again shortly.", {
        "Retry-After": String(ipLimit.retryAfterSeconds),
      });
      return null;
    }
  } catch {
    reply(res, 503, "AI protection is temporarily unavailable. Try again shortly.");
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
      global: {
        fetch: (input, init) => fetch(input, {
          ...init,
          signal: init?.signal ?? AbortSignal.timeout(AUTH_TIMEOUT_MS),
        }),
      },
    });
    // The token is the only accepted source of identity. A user ID supplied in
    // the request body is never trusted.
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
    const userLimit = await sharedRateLimit(limitKey("user", userId), USER_REQUESTS_PER_WINDOW);
    if (!userLimit.allowed) {
      reply(res, 429, "AI request limit reached. Try again in a minute.", {
        "Retry-After": String(userLimit.retryAfterSeconds),
      });
      return null;
    }
  } catch {
    reply(res, 503, "AI protection is temporarily unavailable. Try again shortly.");
    return null;
  }

  return { userId };
}

/**
 * Maps a provider exception to a safe status and message. Upstream response
 * bodies, stack traces and credentials are never echoed to the client.
 */
export function describeProviderFailure(error: unknown): { status: number; message: string } {
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return { status: 504, message: "The AI provider timed out. Try again shortly." };
  }
  return { status: 502, message: "The AI provider failed. Try again shortly." };
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
  if (body.instruction !== undefined
    && (typeof body.instruction !== "string" || body.instruction.length > 4_000)) {
    return "Architecture instructions must be 4,000 characters or fewer.";
  }
  if (body.currentArchitecture !== undefined && body.currentArchitecture !== null
    && !isRecord(body.currentArchitecture)) {
    return "Current architecture must be an object.";
  }
  if (isRecord(body.currentArchitecture)) {
    const graph = body.currentArchitecture;
    if (Array.isArray(graph.components) && graph.components.length > 24) {
      return "Current architecture must have no more than 24 components.";
    }
    if (Array.isArray(graph.connections) && graph.connections.length > 48) {
      return "Current architecture must have no more than 48 connections.";
    }
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
  providerTimeoutMs: PROVIDER_TIMEOUT_MS,
} as const;
