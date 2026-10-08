import { ARCHITECTURE_PRINCIPLES, SYSTEM_DESIGN_FUNDAMENTALS } from "../src/lib/architecturePrinciples.js";
import { CATALOG } from "../src/lib/catalog.js";

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

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return json(res, 503, { error: "OPENROUTER_API_KEY is not configured on the server." });
  }

  const body = req.body ?? {};
  const application = body.application;
  const nodes: NodeSummary[] = Array.isArray(body.nodes) ? body.nodes : [];
  const edges: EdgeSummary[] = Array.isArray(body.edges) ? body.edges : [];
  const notes = typeof body.notes === "string" ? body.notes : "";

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

This is a serious architecture evaluation, not a component-counting exercise.

Evaluate the submitted system against its stated application purpose and requirements.
The architecture evaluation should determine whether the architecture addresses its
intended purpose, identify risks and opportunities, and make the reasoning useful for
an engineering decision.

Rules:
- Treat the application description and notes as the source of truth for workload requirements. First identify the explicit functional and non-functional requirements stated by the user.\n- Do not invent traffic, users, SLAs, compliance obligations, business rules, data volumes, latency targets, or technology.
- Do not reward a component merely because it exists.
- Do not require a database, queue, cache, load balancer, microservices, multi-region
  deployment, or other pattern unless the requirements or architecture context justify it.
- Analyze the directed graph: request reachability, broken paths, dead ends, dependencies,
  bottlenecks, failure boundaries and data flow.
- Distinguish a missing capability from an optional best practice.\n- Do not infer instance counts, replication counts, geographic distribution, authentication mechanisms, or deployment behavior from a diagram unless explicitly represented or stated in notes.\n- Do not prescribe a specific technology unless the requirement and architecture justify the class of solution; describe the capability first.
- Evaluate scalability, reliability, security, data correctness, performance, fault
  tolerance, operability, maintainability and trade-offs.
- Prefer a few high-confidence findings over generic advice.
- Every represented-component finding MUST cite valid node IDs and/or edge IDs.
- A missing capability MUST use omission=true and explain the requirement that makes it
  relevant.
- Do not duplicate an obvious rule-based finding unless you add materially different
  reasoning.
- confidence must be between 0 and 1. Only return findings at confidence >= 0.65.\n- Every finding must provide a non-empty requirement and only cite principle IDs from the supplied corpus.\n- Compare the architecture only against relevant fundamentals; do not force all 30 concepts onto every workload.
- Do not return a numeric overall score. The application computes the score deterministically.
- Dimension assessments are qualitative: strong, adequate, weak, critical, or insufficient_evidence. For each assessment, explain what evidence supports the rating and what the architecture proves or fails to prove.

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

  const user = JSON.stringify({ application, nodes, edges, notes });

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

  const validPrincipleIds = new Set<string>([\n    ...SYSTEM_DESIGN_FUNDAMENTALS.map((p) => p.id),\n    ...ARCHITECTURE_PRINCIPLES.map((p) => p.id),\n  ]);\n\n  const validFindings = (Array.isArray(review.findings) ? review.findings : [])
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
    assessments: Array.isArray(review.assessments)
      ? review.assessments
          .filter(
            (assessment: any) =>
              typeof assessment.category === "string" &&
              ["strong", "adequate", "weak", "critical", "insufficient_evidence"].includes(assessment.rating) &&
              typeof assessment.rationale === "string",
          )
          .slice(0, 10)
      : [],
    model: process.env.OPENROUTER_MODEL ?? "openrouter/free",
  });
}
