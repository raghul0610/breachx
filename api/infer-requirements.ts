import { AI_REQUEST_LIMITS, authorizeAndRateLimit, describeProviderFailure, validateEvaluationPayload } from "./_shared/security.js";
declare const process: { env: Record<string, string | undefined> };

export const config = { maxDuration: 30 };

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    functionalRequirements: { type: "array", items: { type: "string" } },
    nonFunctionalRequirements: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "functionalRequirements", "nonFunctionalRequirements", "assumptions"],
} as const;

export default async function handler(req: any, res: any) {
  const authorized = await authorizeAndRateLimit(req, res, AI_REQUEST_LIMITS.evaluationBodyBytes);
  if (!authorized) return;
  const body = req.body as Record<string, unknown>;
  const validationError = validateEvaluationPayload(body);
  if (validationError) return res.status(400).json({ error: validationError });
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "OPENROUTER_API_KEY is not configured on the server." });

  const nodes = body.nodes as Array<Record<string, unknown>>;
  const edges = body.edges as Array<Record<string, unknown>>;
  const application = body.application as { name: string; description: string };
  const notes = typeof body.notes === "string" ? body.notes : "";
  if (!nodes.length || typeof application.name !== "string") {
    return res.status(400).json({ error: "Provide the current architecture and application name." });
  }

  const system = `You are an architecture requirements analyst. Infer the functional and non-functional requirements that the CURRENT architecture appears designed to support or could reasonably manage.

Base every inference on the supplied application context, component nodes, directed connections, and notes. Do not invent a business domain, user scale, SLA, latency target, compliance obligation, or feature that the evidence does not support. Separate likely supported capabilities from assumptions and uncertainties. Phrase requirements as testable outcomes where possible. Functional requirements describe system behavior/capabilities; non-functional requirements describe qualities or constraints such as security, reliability, performance, scalability, maintainability, and observability. Do not claim a requirement is guaranteed merely because a component exists. Mention when the diagram alone cannot verify an outcome. Return concise, non-duplicative lists: up to 8 functional requirements, 8 non-functional requirements, and 5 assumptions.`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL ?? "https://breachx-ashy.vercel.app",
        "X-Title": "ANCHON Architecture Requirements Analyst",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? "openrouter/free",
        temperature: 0.1,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify({ application, nodes, edges, notes }) },
        ],
        provider: { require_parameters: true },
        response_format: { type: "json_schema", json_schema: { name: "architecture_requirements", strict: true, schema } },
      }),
      signal: AbortSignal.timeout(AI_REQUEST_LIMITS.providerTimeoutMs),
    });
    if (!response.ok) {
      return res.status(502).json({ error: "Requirements analysis provider failed. Try again shortly." });
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return res.status(502).json({ error: "Provider returned no requirements." });
    const parsed = JSON.parse(content);
    const cleanList = (value: unknown, max: number) => Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map(item => item.trim()).slice(0, max)
      : [];
    return res.status(200).json({
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      functionalRequirements: cleanList(parsed.functionalRequirements, 8),
      nonFunctionalRequirements: cleanList(parsed.nonFunctionalRequirements, 8),
      assumptions: cleanList(parsed.assumptions, 5),
    });
  } catch (error) {
    const failure = describeProviderFailure(error);
    return res.status(failure.status).json({ error: failure.message });
  }
}
