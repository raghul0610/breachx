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
        ],
      },
    },
    scores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string" },
          score: { type: "number" },
          summary: { type: "string" },
        },
        required: ["category", "score", "summary"],
      },
    },
  },
  required: ["summary", "strengths", "findings", "scores"],
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
    return json(res, 503, {
      error: "OPENROUTER_API_KEY is not configured on the server.",
    });
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

  const architecture = {
    application,
    nodes,
    edges,
    notes,
  };

  const system = `
You are a principal/staff software architect conducting a rigorous system-design review.

Evaluate ONLY the architecture supplied in the user payload. Do not invent components,
traffic numbers, requirements, SLAs, or implementation details.

Review these dimensions:
Architecture, Scalability, Reliability, Security, Data Design, Performance,
Fault Tolerance, Trade-offs, and Completeness.

Think through:
- request/data flow and bottlenecks
- single points of failure and blast radius
- horizontal scaling and state management
- database consistency, replication, partitioning and durability
- cache correctness and invalidation
- queues, workers, retries, idempotency and backpressure
- security boundaries and least-privilege exposure
- observability, deployment, recovery and operability
- unnecessary complexity and cost
- whether the design actually satisfies the stated application requirements

Ground every finding. For findings about represented components, provide valid node IDs
and/or edge IDs from the supplied architecture. For missing capabilities, set omission=true
and explain exactly what important capability is absent. Never cite an ID that was not supplied.

Severity must be calibrated:
critical = likely catastrophic correctness/security/availability problem
high = major production risk
medium = meaningful weakness or scaling/reliability concern
low = improvement or polish

Scores are 0-100 for each dimension. Be conservative and do not reward components merely
for existing; reward whether they solve a stated requirement. Avoid generic advice.
`;

  const user = JSON.stringify(architecture);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL ?? "https://breachx.vercel.app",
      "X-Title": "Breach X System Design Evaluator",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "openrouter/free",
      temperature: 0.1,
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

  const validFindings = (Array.isArray(review.findings) ? review.findings : [])
    .filter((finding: any) => {
      const validNodes = Array.isArray(finding.evidenceNodeIds)
        ? finding.evidenceNodeIds.every((id: string) => nodeIds.has(id))
        : false;
      const validEdges = Array.isArray(finding.evidenceEdgeIds)
        ? finding.evidenceEdgeIds.every((id: string) => edgeIds.has(id))
        : false;

      return (
        typeof finding.title === "string" &&
        typeof finding.description === "string" &&
        (finding.omission === true || validNodes || validEdges)
      );
    })
    .slice(0, 20);

  return json(res, 200, {
    summary: typeof review.summary === "string" ? review.summary : "",
    strengths: Array.isArray(review.strengths) ? review.strengths.slice(0, 8) : [],
    findings: validFindings,
    scores: Array.isArray(review.scores)
      ? review.scores
          .filter(
            (score: any) =>
              typeof score.category === "string" &&
              typeof score.score === "number",
          )
          .map((score: any) => ({
            category: score.category,
            score: Math.max(0, Math.min(100, score.score)),
            summary: typeof score.summary === "string" ? score.summary : "",
          }))
          .slice(0, 9)
      : [],
    model: process.env.OPENROUTER_MODEL ?? "openrouter/free",
  });
}
