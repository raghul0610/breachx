import { ARCHITECTURE_PRINCIPLES, SYSTEM_DESIGN_FUNDAMENTALS } from "../src/lib/architecturePrinciples.js";
import { CATALOG } from "../src/lib/catalog.js";
import { AI_REQUEST_LIMITS, authorizeAndRateLimit, describeProviderFailure, validateEvaluationPayload } from "./_shared/security.js";

declare const process: { env: Record<string, string | undefined> };

type NodeSummary = {
  id: string;
  typeKey: string;
  label: string;
  category: string;
  notes?: string;
};

type EdgeSummary = { id?: string; source: string; target: string };

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          category: { type: "string" },
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          title: { type: "string" },
          description: { type: "string" },
          recommendation: { type: "string" },
          evidenceNodeIds: { type: "array", items: { type: "string" } },
          evidenceEdgeIds: { type: "array", items: { type: "string" } },
          omission: { type: "boolean" },
          confidence: { type: "number" },
          requirement: { type: "string" },
          principleIds: { type: "array", items: { type: "string" } },
        },
        required: [
          "id",
          "category",
          "severity",
          "title",
          "description",
          "recommendation",
          "evidenceNodeIds",
          "evidenceEdgeIds",
          "omission",
          "confidence",
          "requirement",
          "principleIds",
        ],
      },
    },
    assessments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string" },
          rating: { type: "string", enum: ["strong", "adequate", "weak", "critical", "insufficient_evidence"] },
          rationale: { type: "string" },
        },
        required: ["category", "rating", "rationale"],
      },
    },
  },
  required: ["summary", "strengths", "findings", "assessments"],
} as const;

function json(res: any, status: number, body: unknown) {
  res.status(status).setHeader("Content-Type", "application/json").json(body);
}

export const config = { maxDuration: 30 };

export default async function handler(req: any, res: any) {
  const authorized = await authorizeAndRateLimit(req, res, AI_REQUEST_LIMITS.evaluationBodyBytes);
  if (!authorized) return;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return json(res, 503, { error: "OPENROUTER_API_KEY is not configured on the server." });
  }

  const body = req.body as Record<string, unknown>;
  const validationError = validateEvaluationPayload(body);
  if (validationError) return json(res, 400, { error: validationError });
  const application = body.application as { name: string; description: string };
  const nodes = body.nodes as NodeSummary[];
  const edges = body.edges as EdgeSummary[];
  const notes = typeof body.notes === "string" ? body.notes : "";
  const workload = body.workload && typeof body.workload === "object" ? body.workload : {};
  const graphAnalysis = body.graphAnalysis && typeof body.graphAnalysis === "object" ? body.graphAnalysis : {};

  if (
    !application ||
    typeof application.name !== "string" ||
    typeof application.description !== "string" ||
    nodes.length === 0
  ) {
    return json(res, 400, { error: "Invalid architecture payload." });
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set(edges.map((edge) => edge.id).filter(Boolean));

  const system = `
You are the architecture reviewer inside Breach X.

This is a serious architecture evaluation, not a component-counting exercise. Workload and application requirements are evaluated before architecture components.

Evaluate the submitted system against its stated application purpose and requirements. Output an explanation-first structure (Overview, How it Works, Topic-by-Topic Review, Prioritized Recommendations, Assumptions) rather than just marks-based findings.
The architecture evaluation should determine whether the architecture addresses its
intended purpose, identify risks and opportunities, and make the reasoning useful for
an engineering decision.

Rules:
1. Evaluate the actual graph. Inspect every node, its component type, every directed edge, and the source and target of each connection. Never infer additional components or connections that are not present.
2. Explain every relevant node and connection. Describe each component's role in this particular architecture and explain the request or data flow along the directed edges. Identify broken paths, unreachable nodes, missing dependencies, and ambiguous routing only when supported by graph evidence.
3. Distinguish facts, risks, and unknowns. Fact: directly supported by the graph, application requirements, or supplied notes. Risk: a plausible architectural concern supported by available evidence. Unknown: information that the diagram does not establish. A component not being shown does not prove that its capability is absent from the real implementation.
4. Validate findings before recommending components. Do not recommend a load balancer merely because a reverse proxy and app server exist. Do not claim multiple compute instances unless multiple instances or equivalent deployment information are represented. Consider whether an existing component could already provide the required capability.
5. Make recommendations conditional on requirements. Explain which requirement is unmet, cite the relevant nodes or edges, describe the consequence, and recommend the smallest justified change. State when additional information is needed before deciding. Every represented-component finding MUST cite valid node IDs and/or edge IDs. A missing capability MUST use omission=true and explain the requirement that makes it relevant.
6. Use application context. Evaluate the architecture against the application's stated purpose and requirements. Do not assume production scale, high availability, multiple regions, or specific traffic volumes when they have not been provided.
7. Keep findings precise. Replace unsupported claims with appropriately qualified findings. For example, use “Traffic distribution is not established by the diagram” instead of “Multiple compute instances lack traffic distribution” when multiple instances are not shown.
8. Explain the complete design, not just its deficiencies. Start with the current architecture overview and its actual request flow. Then explain what works, what could fail, what remains unknown, and which improvements are justified. Keep scores secondary to explanations.

- confidence must be between 0 and 1. Only return findings at confidence >= 0.65.
- Every finding must provide a non-empty requirement and only cite principle IDs from the supplied corpus.
- Do not return a numeric overall score.

Severity:
critical = the design cannot safely/meaningfully satisfy a stated critical need
high = major production risk or broken core requirement
medium = meaningful weakness under plausible operation
low = improvement, documentation, or non-blocking concern

Architecture principles:
${JSON.stringify(ARCHITECTURE_PRINCIPLES)}

System design fundamentals:
${JSON.stringify(SYSTEM_DESIGN_FUNDAMENTALS)}

Available Breach X component vocabulary:
${JSON.stringify(CATALOG)}

Component-vocabulary rules:
- The catalog is the set of capabilities the designer can explicitly place in the architecture.
- Treat catalog components as available architectural building blocks, not mandatory components.
- Evaluate whether the submitted architecture uses an appropriate capability when the stated requirements justify it.
- If a useful catalog capability is absent, report it only when the requirement makes that capability relevant.
- Compare the chosen design against the capabilities represented by the catalog, but do not penalize the design for merely omitting optional components.
- Prefer capability-level reasoning over vendor-name recommendations. For example, reason about durable event streaming before recommending Kafka specifically.
`;

  const user = JSON.stringify({ application, workload, nodes, edges, notes, graphAnalysis });

  try {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL ?? "https://breachx-ashy.vercel.app",
      "X-Title": "Breach X System Architecture Evaluator",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "openrouter/free",
      temperature: 0.05,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      provider: { require_parameters: true },
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "architecture_review",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return json(res, 502, {
      error: "Architecture review provider failed.",
      details: errorText.slice(0, 1000),
    });
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    return json(res, 502, { error: "Provider returned no review content." });
  }

  let review: any;
  try {
    review = JSON.parse(content);
  } catch {
    return json(res, 502, { error: "Provider returned invalid structured output." });
  }

  const validPrincipleIds = new Set<string>([
    ...SYSTEM_DESIGN_FUNDAMENTALS.map((p) => p.id),
    ...ARCHITECTURE_PRINCIPLES.map((p) => p.id),
  ]);

  const validFindings = (Array.isArray(review.findings) ? review.findings : [])
    .filter((finding: any) => {
      const nodeEvidence = Array.isArray(finding.evidenceNodeIds) ? finding.evidenceNodeIds : [];
      const edgeEvidence = Array.isArray(finding.evidenceEdgeIds) ? finding.evidenceEdgeIds : [];
      const validNodes = nodeEvidence.length > 0 && nodeEvidence.every((id: string) => nodeIds.has(id));
      const validEdges = edgeEvidence.length > 0 && edgeEvidence.every((id: string) => edgeIds.has(id));

      return (
        typeof finding.title === "string" &&
        typeof finding.description === "string" &&
        typeof finding.confidence === "number" &&
        finding.confidence >= 0.65 &&
        typeof finding.requirement === "string" &&
        finding.requirement.trim().length > 0 &&
        Array.isArray(finding.principleIds) &&
        finding.principleIds.every((id: string) => validPrincipleIds.has(id)) &&
        (finding.omission === true || validNodes || validEdges)
      );
    })
    .slice(0, 15);

  return json(res, 200, {
    summary: typeof review.summary === "string" ? review.summary : "",
    strengths: Array.isArray(review.strengths) ? review.strengths.slice(0, 8) : [],
    findings: validFindings.map((finding: any) => ({ ...finding, description: `Requirement: ${finding.requirement}\n${finding.description}` })),
    assessments: Array.isArray(review.assessments) ? review.assessments : [],
    model: process.env.OPENROUTER_MODEL ?? "openrouter/free",
  });
  } catch (error) {
    const failure = describeProviderFailure(error);
    return json(res, failure.status, { error: failure.message });
  }
}
