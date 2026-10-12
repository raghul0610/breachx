import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redisCounts: new Map<string, number>(),
  getUser: vi.fn(async (token: string) => token === "valid-token"
    ? { data: { user: { id: "user-test-1" } }, error: null }
    : { data: { user: null }, error: { message: "Invalid token" } }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mocks.getUser } })),
}));

import evaluateHandler from "../api/evaluate";
import generateHandler from "../api/generate-architecture";
import { validateEvaluationPayload, validateGeneratorPayload } from "../api/_shared/security";

type MockRequest = {
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

function request(body: Record<string, unknown>, overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    method: "POST",
    headers: {
      authorization: "Bearer valid-token",
      "content-type": "application/json",
      "x-real-ip": "192.0.2.10",
    },
    body,
    ...overrides,
  };
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

describe("AI endpoint security", () => {
  beforeEach(() => {
    mocks.redisCounts.clear();
    mocks.getUser.mockClear();
    process.env.NODE_ENV = "test";
    process.env.VERCEL = "";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
    process.env.UPSTASH_REDIS_REST_URL = "https://example-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-redis-token";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === process.env.UPSTASH_REDIS_REST_URL) {
        const command = JSON.parse(String(init?.body)) as unknown[];
        const key = String(command[3]);
        const count = (mocks.redisCounts.get(key) ?? 0) + 1;
        mocks.redisCounts.set(key, count);
        return { ok: true, json: async () => ({ result: [count, 60] }) };
      }
      return { ok: false, status: 502, text: async () => "provider failure", json: async () => ({}) };
    }));
  });

  it("rejects invalid evaluation payloads", () => {
    expect(validateEvaluationPayload({})).toContain("Application");
    expect(validateEvaluationPayload({
      ...validEvaluation,
      nodes: [{ id: "same", typeKey: "api", label: "A", category: "Compute" }, { id: "same", typeKey: "db", label: "B", category: "Data" }],
    })).toContain("unique");
    expect(validateEvaluationPayload({
      ...validEvaluation,
      edges: [{ source: "client", target: "missing" }],
    })).toContain("connections");
  });

  it("rejects invalid and overlong generator input", () => {
    expect(validateGeneratorPayload({ name: "x", requirements: "too short" })).toContain("between 2 and 120");
    expect(validateGeneratorPayload({ name: "Valid name", requirements: "x".repeat(8_001) })).toContain("8,000");
  });

  it("requires a valid Supabase bearer token before calling a provider", async () => {
    const req = request(validGenerator, { headers: { "content-type": "application/json", "x-real-ip": "192.0.2.11", authorization: "Bearer invalid-token" } });
    const { res, state } = response();
    await generateHandler(req, res);
    expect(state.statusCode).toBe(401);
    expect(state.body).toMatchObject({ error: expect.stringContaining("invalid or expired") });
  });

  it("rejects oversized request bodies before authentication or provider calls", async () => {
    const req = request(validEvaluation, { headers: { "content-type": "application/json", "content-length": "70000" } });
    const { res, state } = response();
    await evaluateHandler(req, res);
    expect(state.statusCode).toBe(413);
    expect(state.body).toMatchObject({ error: expect.stringContaining("too large") });
  });

  it("returns 429 when a user exceeds the shared per-minute AI limit", async () => {
    for (let index = 0; index < 8; index += 1) {
      const { res } = response();
      await evaluateHandler(request(validEvaluation), res);
    }
    const { res, state } = response();
    await evaluateHandler(request(validEvaluation), res);
    expect(state.statusCode).toBe(429);
    expect(state.headers["retry-after"]).toBeDefined();
  });

  it("handles provider failures without leaking provider response details", async () => {
    const evaluation = response();
    await evaluateHandler(request(validEvaluation), evaluation.res);
    expect(evaluation.state.statusCode).toBe(502);
    expect(JSON.stringify(evaluation.state.body)).not.toContain("provider failure");

    const generation = response();
    await generateHandler(request(validGenerator, { headers: { authorization: "Bearer valid-token", "content-type": "application/json", "x-real-ip": "192.0.2.12" } }), generation.res);
    expect(generation.state.statusCode).toBe(502);
    expect(JSON.stringify(generation.state.body)).not.toContain("provider failure");
  });
});
