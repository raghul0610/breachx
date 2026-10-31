import { beforeEach, describe, expect, it, vi } from "vitest";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REDIS_URL = "https://example-redis.upstash.io";
const TEST_PROVIDER_KEY = "sk-or-test-secret-value";

const mocks = vi.hoisted(() => ({
  redisCounts: new Map<string, number>(),
  providerResponse: null as null | (() => Promise<unknown> | unknown),
  getUser: vi.fn(async (token: string) => {
    if (token === "valid-token") return { data: { user: { id: "user-test-1" } }, error: null };
    if (token === "expired-token") {
      return { data: { user: null }, error: { message: "JWT expired", status: 401 } };
    }
    return { data: { user: null }, error: { message: "Invalid token", status: 401 } };
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mocks.getUser } })),
}));

import evaluateHandler from "../api/evaluate";
import generateHandler, { config as generateConfig, GENERATOR_PROVIDER_TIMEOUT_MS } from "../api/generate-architecture";
import inferHandler from "../api/infer-requirements";
import {
  AI_REQUEST_LIMITS,
  describeProviderFailure,
  validateEvaluationPayload,
  validateGeneratorPayload,
} from "../api/_shared/security";

type MockRequest = {
  method: string;
  headers: Record<string, string>;
  body: unknown;
};

let ipCounter = 0;

/**
 * Builds a mock request. When `overrides.headers` is supplied it *replaces* the
 * default header set, so a case can assert on a genuinely absent header; only
 * `x-real-ip` is still defaulted, and it is unique per request so per-IP limits
 * do not bleed between cases.
 */
function request(body: unknown, overrides: Partial<MockRequest> = {}): MockRequest {
  ipCounter += 1;
  const defaultIp = `198.51.100.${ipCounter % 250}`;
  const headers: Record<string, string> = overrides.headers
    ? { "x-real-ip": defaultIp, ...overrides.headers }
    : { authorization: "Bearer valid-token", "content-type": "application/json", "x-real-ip": defaultIp };
  return { method: overrides.method ?? "POST", headers, body };
}

function response() {
  const state: { statusCode: number; headers: Record<string, string>; body?: unknown } = {
    statusCode: 200,
    headers: {},
  };
  const res = {
    status(code: number) { state.statusCode = code; return this; },
    setHeader(name: string, value: string) { state.headers[name.toLowerCase()] = value; return this; },
    json(body: unknown) { state.body = body; return body; },
  };
  return { res, state };
}

const validEvaluation = {
  application: { name: "URL shortener", description: "A small URL shortening service." },
  nodes: [
    { id: "client", typeKey: "client", label: "Client", category: "Edge", notes: "" },
    { id: "api", typeKey: "api_server", label: "API", category: "Compute", notes: "" },
  ],
  edges: [{ id: "edge-1", source: "client", target: "api" }],
  notes: "",
  workload: {},
  graphAnalysis: {},
};

const validGenerator = {
  name: "URL shortener",
  requirements: "Create short links and redirect users to the original destination.",
};

const goodArchitecture = {
  architectureName: "URL shortener",
  overview: "Edge to compute to storage.",
  requestFlow: "Client calls the API which reads and writes the database.",
  designDecisions: ["Keep the design small."],
  assumptions: [],
  requirementCoverage: [{
    requirement: "Create and redirect short links",
    componentIds: ["client", "api", "db"],
    rationale: "The API handles requests and the database stores the mappings.",
  }],
  components: [
    { id: "client", typeKey: "client", label: "Client", notes: "Browser" },
    { id: "api", typeKey: "app_server", label: "API", notes: "Handles redirects" },
    { id: "db", typeKey: "database", label: "Database", notes: "Stores links" },
  ],
  connections: [
    { source: "client", target: "api", label: "HTTPS", communicationType: "synchronous HTTPS/API", purpose: "Send short-link requests." },
    { source: "api", target: "db", label: "reads/writes", communicationType: "database read/write", purpose: "Look up and persist short links." },
  ],
};

const goodReview = {
  summary: "The design is coherent for its stated scope.",
  strengths: ["Simple request path."],
  recommendations: [],
  assessments: [],
};

/** Builds a fake OpenRouter SSE stream with the same delta framing as production. */
function providerContent(value: unknown) {
  const event = [
    ": OPENROUTER PROCESSING",
    "",
    `data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(value) }, finish_reason: null }] })}`,
    "",
    "data: [DONE]",
    "",
  ].join("\n");
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(event));
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    body,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(value) } }] }),
    text: async () => "",
  };
}

function timeoutError() {
  const error = new Error("The operation was aborted due to timeout");
  error.name = "TimeoutError";
  return error;
}

describe("architecture generator execution budget", () => {
  it("allows two minutes for the free provider within a 150-second Vercel function", () => {
    expect(GENERATOR_PROVIDER_TIMEOUT_MS).toBe(120_000);
    expect(generateConfig.maxDuration).toBe(150);
    // Other AI endpoints retain their existing shared timeout budget.
    expect(AI_REQUEST_LIMITS.providerTimeoutMs).toBe(45_000);
  });
});

describe("AI endpoint security", () => {
  beforeEach(() => {
    mocks.redisCounts.clear();
    mocks.getUser.mockClear();
    mocks.providerResponse = null;
    process.env.NODE_ENV = "test";
    process.env.VERCEL = "";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
    process.env.UPSTASH_REDIS_REST_URL = REDIS_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-redis-token";
    process.env.OPENROUTER_API_KEY = TEST_PROVIDER_KEY;
    process.env.OPENROUTER_MODEL = "openrouter/free";

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === REDIS_URL) {
        const command = JSON.parse(String(init?.body)) as unknown[];
        const key = String(command[3]);
        const count = (mocks.redisCounts.get(key) ?? 0) + 1;
        mocks.redisCounts.set(key, count);
        return { ok: true, json: async () => ({ result: [count, 60] }) };
      }
      if (url === OPENROUTER_URL) {
        if (mocks.providerResponse) return await mocks.providerResponse();
        return { ok: false, status: 502, text: async () => "provider failure", json: async () => ({}) };
      }
      throw new Error(`Unexpected fetch to ${url}`);
    }));
  });

  function providerCalls() {
    return vi.mocked(fetch).mock.calls.filter((call) => String(call[0]) === OPENROUTER_URL);
  }

  // ---------------------------------------------------------------- validation

  describe("payload validation", () => {
    it("rejects invalid evaluation payloads", () => {
      expect(validateEvaluationPayload({})).toContain("Application");
      expect(validateEvaluationPayload({ ...validEvaluation, nodes: [] })).toContain("between 1 and 100");
      expect(validateEvaluationPayload({
        ...validEvaluation,
        nodes: [
          { id: "same", typeKey: "api", label: "A", category: "Compute" },
          { id: "same", typeKey: "db", label: "B", category: "Data" },
        ],
      })).toContain("unique");
      expect(validateEvaluationPayload({
        ...validEvaluation,
        edges: [{ source: "client", target: "missing" }],
      })).toContain("connections");
      expect(validateEvaluationPayload({
        ...validEvaluation,
        notes: "x".repeat(4_001),
      })).toContain("4,000");
      expect(validateEvaluationPayload({ ...validEvaluation, workload: "nope" })).toContain("Workload");
      expect(validateEvaluationPayload(validEvaluation)).toBeNull();
    });

    it("rejects oversized node and edge collections", () => {
      const nodes = Array.from({ length: 101 }, (_, index) => ({
        id: `n${index}`, typeKey: "api_server", label: "A", category: "Compute",
      }));
      expect(validateEvaluationPayload({ ...validEvaluation, nodes })).toContain("between 1 and 100");

      const edges = Array.from({ length: 201 }, () => ({ source: "client", target: "api" }));
      expect(validateEvaluationPayload({ ...validEvaluation, edges })).toContain("no more than 200");
    });

    it("rejects invalid and overlong generator input", () => {
      expect(validateGeneratorPayload({})).toContain("between 2 and 120");
      expect(validateGeneratorPayload({ name: "x", requirements: "too short" })).toContain("between 2 and 120");
      expect(validateGeneratorPayload({ name: "Valid name", requirements: "short" })).toContain("8,000");
      expect(validateGeneratorPayload({ name: "Valid name", requirements: "x".repeat(8_001) })).toContain("8,000");
      expect(validateGeneratorPayload({ name: "a".repeat(121), requirements: "x".repeat(50) })).toContain("between 2 and 120");
      expect(validateGeneratorPayload(validGenerator)).toBeNull();
    });

    it("maps provider timeouts to 504 and other provider errors to 502", () => {
      expect(describeProviderFailure(timeoutError()).status).toBe(504);
      const aborted = new Error("aborted");
      aborted.name = "AbortError";
      expect(describeProviderFailure(aborted).status).toBe(504);
      expect(describeProviderFailure(new Error("socket hang up")).status).toBe(502);
      expect(describeProviderFailure("boom").status).toBe(502);
    });
  });

  // ------------------------------------------------------------ method & media

  describe("HTTP method and content type", () => {
    it.each(["GET", "PUT", "DELETE", "PATCH"])("rejects %s with 405 and an Allow header", async (method) => {
      for (const handler of [evaluateHandler, generateHandler]) {
        const { res, state } = response();
        await handler({ method, headers: {}, body: undefined } as never, res);
        expect(state.statusCode).toBe(405);
        expect(state.headers.allow).toBe("POST");
      }
      expect(providerCalls()).toHaveLength(0);
      expect(mocks.getUser).not.toHaveBeenCalled();
    });

    it("rejects a non-JSON content type with 415 before inspecting the body", async () => {
      const { res, state } = response();
      await generateHandler(request("name=x", {
        headers: { authorization: "Bearer valid-token", "content-type": "text/plain" },
      }) as never, res);
      expect(state.statusCode).toBe(415);
      expect(state.body).toMatchObject({ error: expect.stringContaining("application/json") });
      expect(mocks.getUser).not.toHaveBeenCalled();
    });

    it("rejects a form-encoded content type with 415", async () => {
      const { res, state } = response();
      await evaluateHandler(request(validEvaluation, {
        headers: { authorization: "Bearer valid-token", "content-type": "application/x-www-form-urlencoded" },
      }) as never, res);
      expect(state.statusCode).toBe(415);
    });

    it("rejects a missing content type with 415", async () => {
      const { res, state } = response();
      await generateHandler({
        method: "POST",
        headers: { authorization: "Bearer valid-token" },
        body: validGenerator,
      } as never, res);
      expect(state.statusCode).toBe(415);
    });

    it("accepts a JSON content type with charset parameters", async () => {
      mocks.providerResponse = () => providerContent(goodArchitecture);
      const { res, state } = response();
      await generateHandler(request(validGenerator, {
        headers: { authorization: "Bearer valid-token", "content-type": "application/json; charset=utf-8" },
      }) as never, res);
      expect(state.statusCode).toBe(200);
    });
  });

  // --------------------------------------------------------------- body shapes

  describe("malformed request bodies", () => {
    it.each([
      ["undefined body", undefined],
      ["a JSON array", [1, 2, 3]],
      ["an unparsed string body", "{\"name\":\"x\"}"],
      ["a null body", null],
      ["a numeric body", 42],
    ])("rejects %s with 400", async (_label, body) => {
      const { res, state } = response();
      await generateHandler(request(body) as never, res);
      expect(state.statusCode).toBe(400);
      expect(state.body).toMatchObject({ error: expect.stringContaining("JSON object") });
      expect(providerCalls()).toHaveLength(0);
    });

    it("rejects a body with circular references as invalid JSON", async () => {
      const circular: Record<string, unknown> = { name: "Valid name" };
      circular.self = circular;
      const { res, state } = response();
      await generateHandler(request(circular) as never, res);
      expect(state.statusCode).toBe(400);
      expect(state.body).toMatchObject({ error: expect.stringContaining("Invalid JSON") });
    });

    it("rejects missing required fields with 400 after authentication", async () => {
      const { res, state } = response();
      await generateHandler(request({ name: "Valid name" }) as never, res);
      expect(state.statusCode).toBe(400);
      expect(state.body).toMatchObject({ error: expect.stringContaining("Requirements") });
      expect(providerCalls()).toHaveLength(0);
    });

    it("rejects an evaluation payload with no nodes with 400", async () => {
      const { res, state } = response();
      await evaluateHandler(request({ ...validEvaluation, nodes: [] }) as never, res);
      expect(state.statusCode).toBe(400);
      expect(providerCalls()).toHaveLength(0);
    });

    it("rejects an invalid Content-Length header with 400", async () => {
      const { res, state } = response();
      await generateHandler(request(validGenerator, {
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
          "content-length": "not-a-number",
        },
      }) as never, res);
      expect(state.statusCode).toBe(400);
      expect(state.body).toMatchObject({ error: expect.stringContaining("Content-Length") });
    });
  });

  // ------------------------------------------------------------- size controls

  describe("request size limits", () => {
    it("rejects an oversized declared Content-Length before authentication or provider calls", async () => {
      const { res, state } = response();
      await evaluateHandler(request(validEvaluation, {
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
          "content-length": String(AI_REQUEST_LIMITS.evaluationBodyBytes + 1),
        },
      }) as never, res);
      expect(state.statusCode).toBe(413);
      expect(state.body).toMatchObject({ error: expect.stringContaining("too large") });
      expect(mocks.getUser).not.toHaveBeenCalled();
      expect(providerCalls()).toHaveLength(0);
    });

    it("rejects an oversized body even when Content-Length is absent", async () => {
      const oversized = {
        ...validGenerator,
        requirements: "x".repeat(AI_REQUEST_LIMITS.generatorBodyBytes + 100),
      };
      const { res, state } = response();
      await generateHandler(request(oversized) as never, res);
      expect(state.statusCode).toBe(413);
      expect(mocks.getUser).not.toHaveBeenCalled();
      expect(providerCalls()).toHaveLength(0);
    });

    it("allows a bounded architecture graph in generator/edit requests", () => {
      expect(AI_REQUEST_LIMITS.generatorBodyBytes).toBe(64 * 1024);
      expect(AI_REQUEST_LIMITS.generatorBodyBytes).toBe(AI_REQUEST_LIMITS.evaluationBodyBytes);
    });
  });

  // ------------------------------------------------------------ authentication

  describe("authentication", () => {
    it("rejects a missing Authorization header with 401", async () => {
      for (const handler of [evaluateHandler, generateHandler]) {
        const { res, state } = response();
        await handler(request(validEvaluation, {
          headers: { "content-type": "application/json" },
        }) as never, res);
        expect(state.statusCode).toBe(401);
        expect(state.body).toMatchObject({ error: expect.stringContaining("Sign in") });
      }
      expect(mocks.getUser).not.toHaveBeenCalled();
      expect(providerCalls()).toHaveLength(0);
    });

    it.each([
      ["a non-Bearer scheme", "Basic dXNlcjpwYXNz"],
      ["an empty Bearer value", "Bearer "],
      ["a bare token", "valid-token"],
    ])("rejects %s with 401", async (_label, authorization) => {
      const { res, state } = response();
      await generateHandler(request(validGenerator, {
        headers: { authorization, "content-type": "application/json" },
      }) as never, res);
      expect(state.statusCode).toBe(401);
      expect(mocks.getUser).not.toHaveBeenCalled();
    });

    it("rejects an invalid token with 401 and never calls the provider", async () => {
      const { res, state } = response();
      await generateHandler(request(validGenerator, {
        headers: { authorization: "Bearer invalid-token", "content-type": "application/json" },
      }) as never, res);
      expect(state.statusCode).toBe(401);
      expect(state.body).toMatchObject({ error: expect.stringContaining("invalid or expired") });
      expect(providerCalls()).toHaveLength(0);
    });

    it("rejects an expired token with 401", async () => {
      for (const handler of [evaluateHandler, generateHandler]) {
        const { res, state } = response();
        await handler(request(handler === evaluateHandler ? validEvaluation : validGenerator, {
          headers: { authorization: "Bearer expired-token", "content-type": "application/json" },
        }) as never, res);
        expect(state.statusCode).toBe(401);
        expect(state.body).toMatchObject({ error: expect.stringContaining("invalid or expired") });
      }
      expect(providerCalls()).toHaveLength(0);
    });

    it("never trusts a user ID supplied in the request body", async () => {
      mocks.providerResponse = () => providerContent(goodArchitecture);
      const { res, state } = response();
      await generateHandler(request({ ...validGenerator, userId: "attacker-supplied" }) as never, res);
      expect(state.statusCode).toBe(200);
      // Identity came from the verified token, not the body.
      expect(mocks.getUser).toHaveBeenCalledWith("valid-token");
      expect(mocks.redisCounts.has("anchon:ai:minute:user:user-test-1")).toBe(true);
      expect(mocks.redisCounts.has("anchon:ai:minute:user:attacker-supplied")).toBe(false);
    });

    it("returns 503 when Supabase verification is not configured", async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_PUBLISHABLE_KEY;
      delete process.env.VITE_SUPABASE_URL;
      delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      delete process.env.SUPABASE_ANON_KEY;
      delete process.env.VITE_SUPABASE_ANON_KEY;
      const { res, state } = response();
      await generateHandler(request(validGenerator) as never, res);
      expect(state.statusCode).toBe(503);
      expect(providerCalls()).toHaveLength(0);
    });

    it("returns 503 when Supabase verification throws", async () => {
      mocks.getUser.mockRejectedValueOnce(new Error("network down"));
      const { res, state } = response();
      await generateHandler(request(validGenerator) as never, res);
      expect(state.statusCode).toBe(503);
      expect(state.body).toMatchObject({ error: expect.stringContaining("verify your session") });
      expect(providerCalls()).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------- rate limits

  describe("rate limiting and abuse protection", () => {
    const fixedIp = { authorization: "Bearer valid-token", "content-type": "application/json", "x-real-ip": "203.0.113.7" };

    it("returns 429 with Retry-After once a user exceeds the per-minute limit", async () => {
      mocks.providerResponse = () => providerContent(goodArchitecture);
      for (let index = 0; index < AI_REQUEST_LIMITS.requestsPerUserPerMinute; index += 1) {
        const { res, state } = response();
        await generateHandler(request(validGenerator, { headers: fixedIp }) as never, res);
        expect(state.statusCode).toBe(200);
      }
      const { res, state } = response();
      await generateHandler(request(validGenerator, { headers: fixedIp }) as never, res);
      expect(state.statusCode).toBe(429);
      expect(state.headers["retry-after"]).toBe("60");
      expect(state.body).toMatchObject({ error: expect.stringContaining("limit reached") });
    });

    it("shares the per-user limit across both AI endpoints", async () => {
      mocks.providerResponse = () => providerContent(goodArchitecture);
      for (let index = 0; index < AI_REQUEST_LIMITS.requestsPerUserPerMinute; index += 1) {
        const { res } = response();
        if (index % 2 === 0) await evaluateHandler(request(validEvaluation, { headers: fixedIp }) as never, res);
        else await generateHandler(request(validGenerator, { headers: fixedIp }) as never, res);
      }
      const { res, state } = response();
      await evaluateHandler(request(validEvaluation, { headers: fixedIp }) as never, res);
      expect(state.statusCode).toBe(429);
      expect(state.headers["retry-after"]).toBeDefined();
    });

    it("bounds unauthenticated floods by IP before verifying tokens", async () => {
      const badAuth = { authorization: "Bearer invalid-token", "content-type": "application/json", "x-real-ip": "203.0.113.99" };
      let rateLimited = 0;
      for (let index = 0; index < 50; index += 1) {
        const { res, state } = response();
        await generateHandler(request(validGenerator, { headers: badAuth }) as never, res);
        if (state.statusCode === 429) rateLimited += 1;
      }
      // The per-IP limit caps how many invalid tokens reach Supabase Auth.
      expect(mocks.getUser.mock.calls.length).toBe(AI_REQUEST_LIMITS.requestsPerIpPerMinute);
      expect(rateLimited).toBe(50 - AI_REQUEST_LIMITS.requestsPerIpPerMinute);
      expect(providerCalls()).toHaveLength(0);
    });

    it("returns 429 with Retry-After when the per-IP limit is exceeded", async () => {
      const sharedIp = { authorization: "Bearer invalid-token", "content-type": "application/json", "x-real-ip": "203.0.113.55" };
      for (let index = 0; index < AI_REQUEST_LIMITS.requestsPerIpPerMinute; index += 1) {
        const { res } = response();
        await generateHandler(request(validGenerator, { headers: sharedIp }) as never, res);
      }
      const { res, state } = response();
      await generateHandler(request(validGenerator, { headers: sharedIp }) as never, res);
      expect(state.statusCode).toBe(429);
      expect(state.headers["retry-after"]).toBe("60");
      expect(state.body).toMatchObject({ error: expect.stringContaining("Too many") });
    });

    it("fails closed in production when the shared limiter is not configured", async () => {
      process.env.VERCEL = "1";
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      for (const handler of [evaluateHandler, generateHandler]) {
        const { res, state } = response();
        await handler(request(validEvaluation) as never, res);
        expect(state.statusCode).toBe(503);
        expect(JSON.stringify(state.body)).toContain("AI protection");
      }
      expect(vi.mocked(fetch)).not.toHaveBeenCalled();
      expect(mocks.getUser).not.toHaveBeenCalled();
    });

    it("fails closed in production when NODE_ENV is production", async () => {
      process.env.NODE_ENV = "production";
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      const { res, state } = response();
      await generateHandler(request(validGenerator) as never, res);
      expect(state.statusCode).toBe(503);
      expect(providerCalls()).toHaveLength(0);
    });

    it("fails closed when the limiter store returns an error response", async () => {
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === REDIS_URL) return { ok: false, status: 500, json: async () => ({}) };
        throw new Error("provider must not be called");
      }));
      const { res, state } = response();
      await generateHandler(request(validGenerator) as never, res);
      expect(state.statusCode).toBe(503);
      expect(state.body).toMatchObject({ error: expect.stringContaining("AI protection") });
      expect(mocks.getUser).not.toHaveBeenCalled();
    });

    it("fails closed when the limiter store returns a malformed payload", async () => {
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === REDIS_URL) return { ok: true, json: async () => ({ result: "nope" }) };
        throw new Error("provider must not be called");
      }));
      const { res, state } = response();
      await generateHandler(request(validGenerator) as never, res);
      expect(state.statusCode).toBe(503);
    });

    it("fails closed when the limiter store times out", async () => {
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === REDIS_URL) throw timeoutError();
        throw new Error("provider must not be called");
      }));
      const { res, state } = response();
      await generateHandler(request(validGenerator) as never, res);
      expect(state.statusCode).toBe(503);
    });
  });

  // ------------------------------------------------------------ provider faults

  describe("provider failure handling", () => {
    it("returns 502 without leaking the upstream response body", async () => {
      for (const [handler, body] of [[evaluateHandler, validEvaluation], [generateHandler, validGenerator]] as const) {
        const { res, state } = response();
        await handler(request(body) as never, res);
        expect(state.statusCode).toBe(502);
        expect(JSON.stringify(state.body)).not.toContain("provider failure");
      }
    });

    it("returns 504 when the provider times out", async () => {
      mocks.providerResponse = () => { throw timeoutError(); };
      for (const [handler, body] of [[evaluateHandler, validEvaluation], [generateHandler, validGenerator]] as const) {
        const { res, state } = response();
        await handler(request(body) as never, res);
        expect(state.statusCode).toBe(504);
        expect(JSON.stringify(state.body)).toMatch(/timed out/i);
      }
    });

    it("returns 502 when the provider omits message content", async () => {
      mocks.providerResponse = () => ({
        ok: true, status: 200, json: async () => ({ choices: [{ message: {} }] }), text: async () => "",
      });
      for (const [handler, body] of [[evaluateHandler, validEvaluation], [generateHandler, validGenerator]] as const) {
        const { res, state } = response();
        await handler(request(body) as never, res);
        expect(state.statusCode).toBe(502);
      }
    });

    it("returns 502 when the provider returns unparsable structured output", async () => {
      mocks.providerResponse = () => ({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "{not json" } }] }),
        text: async () => "",
      });
      for (const [handler, body] of [[evaluateHandler, validEvaluation], [generateHandler, validGenerator]] as const) {
        const { res, state } = response();
        await handler(request(body) as never, res);
        expect(state.statusCode).toBe(502);
      }
    });

    it("returns 502 when the provider response envelope is not JSON", async () => {
      mocks.providerResponse = () => ({
        ok: true, status: 200, json: async () => { throw new Error("invalid json"); }, text: async () => "",
      });
      const { res, state } = response();
      await generateHandler(request(validGenerator) as never, res);
      expect(state.statusCode).toBe(502);
    });

    it("retries when provider headers succeed but reading the response body times out", async () => {
      let call = 0;
      mocks.providerResponse = () => {
        call += 1;
        if (call === 1) {
          return {
            ok: true,
            status: 200,
            body: {
              getReader: () => ({
                read: async () => { throw timeoutError(); },
                releaseLock: () => undefined,
              }),
            },
            text: async () => "",
          };
        }
        return providerContent(goodArchitecture);
      };

      const { res, state } = response();
      await generateHandler(request(validGenerator) as never, res);

      expect(state.statusCode).toBe(200);
      expect(state.body).toMatchObject({ architectureName: "URL shortener" });
      expect(providerCalls()).toHaveLength(2);
    });

    it("rejects a generated architecture with too few valid components", async () => {
      mocks.providerResponse = () => providerContent({
        ...goodArchitecture,
        components: [
          { id: "a", typeKey: "not_in_catalog", label: "A", notes: "" },
          { id: "b", typeKey: "client", label: "B", notes: "" },
        ],
      });
      const { res, state } = response();
      await generateHandler(request(validGenerator) as never, res);
      expect(state.statusCode).toBe(502);
      expect(state.body).toMatchObject({ error: expect.any(String) });
    });

    it("rejects a generated architecture with too few valid connections", async () => {
      mocks.providerResponse = () => providerContent({
        ...goodArchitecture,
        connections: [{ source: "client", target: "nonexistent", label: "x" }],
      });
      const { res, state } = response();
      await generateHandler(request(validGenerator) as never, res);
      expect(state.statusCode).toBe(502);
      expect(state.body).toMatchObject({ error: expect.any(String) });
    });

    it("returns 503 when the provider key is not configured, without calling the provider", async () => {
      delete process.env.OPENROUTER_API_KEY;
      for (const [handler, body] of [[evaluateHandler, validEvaluation], [generateHandler, validGenerator]] as const) {
        const { res, state } = response();
        await handler(request(body) as never, res);
        expect(state.statusCode).toBe(503);
      }
      expect(providerCalls()).toHaveLength(0);
    });
  });

  describe("requirements inference security", () => {
    it("rejects anonymous inference requests before calling the provider", async () => {
      const { res, state } = response();
      await inferHandler(request(validEvaluation, {
        headers: { "content-type": "application/json" },
      }) as never, res);
      expect(state.statusCode).toBe(401);
      expect(providerCalls()).toHaveLength(0);
    });

    it("runs inference only for an authenticated, valid graph", async () => {
      mocks.providerResponse = () => providerContent({
        summary: "A small URL shortener.",
        functionalRequirements: ["Create short links."],
        nonFunctionalRequirements: ["Protect stored links."],
        assumptions: [],
      });
      const { res, state } = response();
      await inferHandler(request(validEvaluation) as never, res);
      expect(state.statusCode).toBe(200);
      expect(state.body).toMatchObject({ summary: "A small URL shortener." });
      expect(providerCalls()).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------- success paths

  describe("authenticated success paths", () => {
    it("generates an architecture for an authenticated user", async () => {
      mocks.providerResponse = () => providerContent(goodArchitecture);
      const { res, state } = response();
      await generateHandler(request(validGenerator) as never, res);

      expect(state.statusCode).toBe(200);
      expect(state.body).toMatchObject({ architectureName: "URL shortener" });
      const [, init] = providerCalls()[0] as [unknown, RequestInit];
      expect(JSON.parse(String(init.body)).model).toBe("openrouter/free");
      expect(JSON.parse(String(init.body)).stream).toBe(true);
      const payload = state.body as { components: unknown[]; connections: unknown[] };
      expect(payload.components).toHaveLength(3);
      expect(payload.connections).toHaveLength(2);
      expect(providerCalls()).toHaveLength(1);
    });

    it("uses the configured free-model pool for architecture generation", async () => {
      process.env.OPENROUTER_MODEL = "openrouter/free";
      mocks.providerResponse = () => providerContent(goodArchitecture);
      const { res, state } = response();
      await generateHandler(request(validGenerator) as never, res);
      expect(state.statusCode).toBe(200);
      const [, init] = providerCalls()[0] as [unknown, RequestInit];
      expect(JSON.parse(String(init.body)).model).toBe("openrouter/free");
    });

    it("evaluates an architecture for an authenticated user", async () => {
      mocks.providerResponse = () => providerContent(goodReview);
      const { res, state } = response();
      await evaluateHandler(request(validEvaluation) as never, res);

      expect(state.statusCode).toBe(200);
      expect(state.body).toMatchObject({
        summary: goodReview.summary,
        model: "openrouter/free",
      });
      expect(Array.isArray((state.body as { findings: unknown[] }).findings)).toBe(true);
      expect(providerCalls()).toHaveLength(1);
    });

    it("sends the provider key only to the provider, never to the client", async () => {
      mocks.providerResponse = () => providerContent(goodArchitecture);
      const { res, state } = response();
      await generateHandler(request(validGenerator) as never, res);

      expect(state.statusCode).toBe(200);
      expect(JSON.stringify(state.body)).not.toContain(TEST_PROVIDER_KEY);
      expect(JSON.stringify(state.headers)).not.toContain(TEST_PROVIDER_KEY);

      const [, init] = providerCalls()[0] as [unknown, RequestInit];
      const sentHeaders = init.headers as Record<string, string>;
      expect(sentHeaders.Authorization).toBe(`Bearer ${TEST_PROVIDER_KEY}`);
    });

    it("never echoes the provider key in any error response", async () => {
      const cases: Array<() => unknown> = [
        () => { throw timeoutError(); },
        () => ({ ok: false, status: 500, text: async () => `failed with ${TEST_PROVIDER_KEY}`, json: async () => ({}) }),
        () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{bad" } }] }), text: async () => "" }),
      ];
      for (const scenario of cases) {
        mocks.providerResponse = scenario;
        for (const [handler, body] of [[evaluateHandler, validEvaluation], [generateHandler, validGenerator]] as const) {
          const { res, state } = response();
          await handler(request(body) as never, res);
          expect(state.statusCode).toBeGreaterThanOrEqual(500);
          expect(JSON.stringify(state.body)).not.toContain(TEST_PROVIDER_KEY);
        }
      }
    });
  });
});
