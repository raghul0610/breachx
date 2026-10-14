import { describe, expect, it } from "vitest";
import { validateArchitectureGraph } from "./architectureValidation";

const validTypeKeys = new Set(["client", "app_server", "database"]);
const components = [
  { id: "client", typeKey: "client", label: "Client", notes: "Collects the user request." },
  { id: "api", typeKey: "app_server", label: "Application API", notes: "Validates and processes requests." },
  { id: "db", typeKey: "database", label: "Database", notes: "Persists application state." },
];
const connections = [
  { source: "client", target: "api", label: "HTTPS request", communicationType: "Synchronous HTTPS API", purpose: "Submit the user request for processing." },
  { source: "api", target: "db", label: "Read/write records", communicationType: "Database query", purpose: "Persist and retrieve application state." },
];
const requirementCoverage = [
  { requirement: "Process user requests", componentIds: ["api"], rationale: "The application API validates and processes incoming requests." },
  { requirement: "Persist application state", componentIds: ["db"], rationale: "The database owns durable application records." },
];

describe("validateArchitectureGraph", () => {
  it("accepts a connected graph with catalog types, explicit edges and requirement coverage", () => {
    expect(validateArchitectureGraph({ components, connections, validTypeKeys, requirementCoverage })).toEqual({
      passed: true,
      errors: [],
      warnings: [],
    });
  });

  it("rejects unknown catalog types and duplicate component IDs", () => {
    const result = validateArchitectureGraph({
      components: [...components, { ...components[0], typeKey: "made_up" }],
      connections,
      validTypeKeys,
      requirementCoverage,
    });
    expect(result.passed).toBe(false);
    expect(result.errors.some((message) => message.includes("Duplicate component ID"))).toBe(true);
  });

  it("rejects connections with missing endpoints or missing semantics", () => {
    const result = validateArchitectureGraph({
      components,
      connections: [
        ...connections,
        { source: "api", target: "missing", label: "call", communicationType: "HTTPS", purpose: "Call a missing component." },
        { source: "api", target: "client", label: "", communicationType: "", purpose: "" },
      ],
      validTypeKeys,
      requirementCoverage,
    });
    expect(result.passed).toBe(false);
    expect(result.errors.some((message) => message.includes("references a missing component"))).toBe(true);
    expect(result.errors.some((message) => message.includes("must define a label"))).toBe(true);
  });

  it("rejects unmotivated components and uncovered requirements", () => {
    const result = validateArchitectureGraph({
      components: components.map((component) => component.id === "db" ? { ...component, notes: "" } : component),
      connections,
      validTypeKeys,
      requirementCoverage: [{ requirement: "Send notifications", componentIds: [], rationale: "Not implemented." }],
    });
    expect(result.passed).toBe(false);
    expect(result.errors.some((message) => message.includes("no responsibility or rationale"))).toBe(true);
    expect(result.errors.some((message) => message.includes("is not mapped to a component"))).toBe(true);
  });

  it("warns when nodes are disconnected from the graph entry point", () => {
    const result = validateArchitectureGraph({
      components: [...components, { id: "orphan", typeKey: "app_server", label: "Orphan", notes: "Independent component." }],
      connections,
      validTypeKeys,
      requirementCoverage,
    });
    expect(result.passed).toBe(true);
    expect(result.warnings.some((message) => message.includes("not reachable"))).toBe(true);
  });
});
