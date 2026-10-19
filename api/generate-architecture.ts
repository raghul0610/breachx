import { CATALOG } from "../src/lib/catalog.js";
import { validateArchitectureGraph, type ArchitectureComponent, type ArchitectureConnection, type RequirementCoverage } from "../src/lib/architectureValidation.js";
import { AI_REQUEST_LIMITS, authorizeAndRateLimit, describeProviderFailure, validateGeneratorPayload } from "./_shared/security.js";

declare const process: { env: Record<string, string | undefined> };
const send = (res: any, status: number, body: unknown) =>
  res.status(status).setHeader("Content-Type", "application/json").json(body);

export const config = { maxDuration: 30 };

const MAX_CORRECTION_ATTEMPTS = 1;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    architectureName: { type: "string" },
    overview: { type: "string" },
    requestFlow: { type: "string" },
    designDecisions: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
    requirementCoverage: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          requirement: { type: "string" },
          componentIds: { type: "array", items: { type: "string" } },
          rationale: { type: "string" },
        },
        required: ["requirement", "componentIds", "rationale"],
      },
    },
    components: {
      type: "array", minItems: 3, maxItems: 24,
      items: {
        type: "object", additionalProperties: false,
        properties: {
          id: { type: "string" }, typeKey: { type: "string" },
          label: { type: "string" }, notes: { type: "string" },
        },
        required: ["id", "typeKey", "label", "notes"],
      },
    },
    connections: {
      type: "array", maxItems: 48,
      items: {
        type: "object", additionalProperties: false,
        properties: {
          source: { type: "string" }, target: { type: "string" },
          label: { type: "string" }, communicationType: { type: "string" },
          purpose: { type: "string" },
        },
        required: ["source", "target", "label", "communicationType", "purpose"],
      },
    },
  },
  required: ["architectureName", "overview", "requestFlow", "designDecisions", "assumptions", "requirementCoverage", "components", "connections"],
} as const;

function normalizeArchitecture(parsed: any, name: string) {
  const catalogByType = new Map(CATALOG.map((item) => [item.typeKey, item]));
  const used = new Set<string>();
  const rawComponents = Array.isArray(parsed.components) ? parsed.components.slice(0, 24) : [];
  const components: ArchitectureComponent[] = rawComponents.flatMap((component: any, index: number) => {
    const item = catalogByType.get(component.typeKey);
    if (!item) return [];
    let id = String(component.id || `component-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60) || `component-${index + 1}`;
    if (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    return [{
      id,
      typeKey: item.typeKey,
      label: String(component.label || item.label).trim().slice(0, 80),
      category: item.category,
      notes: String(component.notes || "").trim().slice(0, 500),
    }];
  });
  const validIds = new Set(components.map((component) => component.id));
  const connections: ArchitectureConnection[] = (Array.isArray(parsed.connections) ? parsed.connections : [])
    .slice(0, 48)
    .filter((edge: any) => validIds.has(edge.source) && validIds.has(edge.target))
    .map((edge: any) => ({
      source: String(edge.source),
      target: String(edge.target),
      label: String(edge.label || "").trim().slice(0, 100),
      communicationType: String(edge.communicationType || "").trim().slice(0, 100),
      purpose: String(edge.purpose || "").trim().slice(0, 300),
    }));
  const requirementCoverage: RequirementCoverage[] = (Array.isArray(parsed.requirementCoverage) ? parsed.requirementCoverage : [])
    .slice(0, 30)
    .map((entry: any) => ({
      requirement: String(entry.requirement || "").trim().slice(0, 300),
      componentIds: Array.isArray(entry.componentIds) ? entry.componentIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 24) : [],
      rationale: String(entry.rationale || "").trim().slice(0, 500),
    }));
  const validation = validateArchitectureGraph({
    components,
    connections,
    validTypeKeys: new Set(CATALOG.map((item) => item.typeKey)),
    requirementCoverage,
  });
  return {
    architectureName: String(parsed.architectureName || name).trim().slice(0, 120),
    overview: String(parsed.overview || "").trim().slice(0, 1500),
    requestFlow: String(parsed.requestFlow || "").trim().slice(0, 1500),
    designDecisions: Array.isArray(parsed.designDecisions) ? parsed.designDecisions.slice(0, 10).map((value: unknown) => String(value).slice(0, 500)) : [],
    assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.slice(0, 10).map((value: unknown) => String(value).slice(0, 500)) : [],
    requirementCoverage,
    components,
    connections,
    validation,
  };
}

export default async function handler(req: any, res: any) {
  const authorized = await authorizeAndRateLimit(req, res, AI_REQUEST_LIMITS.generatorBodyBytes);
  if (!authorized) return;
  const body = req.body as Record<string, unknown>;
  const validationError = validateGeneratorPayload(body);
  if (validationError) return send(res, 400, { error: validationError });
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return send(res, 503, { error: "Architecture generation is not configured on the server." });

  const { name, requirements, instruction, currentArchitecture } = body as {
    name: string; requirements: string; instruction?: string; currentArchitecture?: unknown;
  };

  const catalog = CATALOG.map((item) => ({ typeKey: item.typeKey, label: item.label, category: item.category }));
  const editing = typeof instruction === "string" && instruction.trim().length > 0;
  const system = editing
    ? `You are ANCHON's architecture editing agent. Return the complete resulting architecture graph, not a patch. Apply the user instruction to the supplied current architecture. Preserve every component and connection not explicitly changed; create, update, or delete only what the instruction requests. Keep IDs stable for unchanged components. Requirements are context, not permission to replace unrelated parts. If ambiguous, make the smallest conservative change and state assumptions.\n\n`
    : `You are ANCHON's senior system architect. Design the smallest practical architecture that satisfies the stated requirements. Do not generate a component inventory: design a coherent directed workflow first, then add only justified supporting infrastructure.\n\n`;
  const rules = `ARCHITECTURE RULES:
- Use only catalog typeKey values from this catalog: ${JSON.stringify(catalog)}
- Every component's notes must state its specific responsibility and why it is needed. Avoid overlapping services unless the distinct responsibilities and trade-off are explicit.
- Every connection must have source, target, a concise label, communicationType (for example synchronous HTTPS/API, tool invocation, async event, database read/write), and purpose. Connect only components that actually interact.
- Build the primary business request path end-to-end before adding secondary infrastructure.
- Model authorization and approval gates for sensitive actions explicitly when requirements need them. Do not rely on the LLM alone to enforce security or transaction safety.
- State assumptions rather than inventing traffic volumes, availability targets, vendors, or operational requirements.
- requirementCoverage must map each key requirement to real component IDs and explain how they satisfy it. Do not reference nonexistent IDs.
- Prefer simple deployment and fewer components unless requirements justify distribution, caching, queues, gateways, or separate model services.
- Keep component count between 3 and 24 and connections at most 48.
- Return valid structured output only. Catalog: ${JSON.stringify(catalog)}`;

  let correctionFeedback = "";
  let last: ReturnType<typeof normalizeArchitecture> | null = null;
  try {
    for (let attempt = 0; attempt <= MAX_CORRECTION_ATTEMPTS; attempt += 1) {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL ?? "https://breachx-ashy.vercel.app",
          "X-Title": "ANCHON Architecture Generator",
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL ?? "openrouter/free",
          temperature: attempt === 0 ? 0.15 : 0.05,
          messages: [
            { role: "system", content: system + rules },
            {
              role: "user",
              content: JSON.stringify({
                name: name.trim(),
                requirements: requirements.trim(),
                instruction: editing ? instruction.trim() : "",
                currentArchitecture: currentArchitecture ?? null,
                correctionFeedback,
              }),
            },
          ],
          provider: { require_parameters: true },
          response_format: { type: "json_schema", json_schema: { name: "architecture", strict: true, schema } },
        }),
        signal: AbortSignal.timeout(AI_REQUEST_LIMITS.providerTimeoutMs),
      });
      if (!response.ok) return send(res, 502, { error: "The architecture provider failed. Try again shortly." });
      const payload = await response.json();
      const raw = payload?.choices?.[0]?.message?.content;
      if (typeof raw !== "string") return send(res, 502, { error: "No architecture was returned." });
      const normalized = normalizeArchitecture(JSON.parse(raw), name);
      last = normalized;
      if (normalized.validation.passed) return send(res, 200, normalized);
      correctionFeedback = [
        "The previous graph failed deterministic validation. Correct these errors without adding unnecessary components.",
        ...normalized.validation.errors.map((message) => `ERROR: ${message}`),
        ...normalized.validation.warnings.map((message) => `WARNING: ${message}`),
        "Return a complete corrected graph. Keep requirement coverage IDs synchronized with component IDs.",
      ].join("\n");
    }
    if (last) {
      return send(res, 502, {
        error: "The generated architecture did not pass validation after a correction attempt. No graph was returned as validated.",
        validation: last.validation,
      });
    }
    return send(res, 502, { error: "Could not generate a valid architecture. Please try again." });
  } catch (error) {
    const failure = describeProviderFailure(error);
    return send(res, failure.status, { error: failure.message });
  }
}
