import { describe, expect, it } from "vitest";
import { reviewConnection } from "./connectionReview";

const nodes = [
  { id: "client", data: { label: "Client / User App", typeKey: "client", category: "Edge" } },
  { id: "api", data: { label: "REST API", typeKey: "rest_api", category: "API" } },
  { id: "db", data: { label: "SQL Database", typeKey: "database", category: "Data" } },
  { id: "queue", data: { label: "Kafka / Event Stream", typeKey: "kafka", category: "Messaging" } },
];

describe("reviewConnection", () => {
  it("flags a public entry that connects directly to a data store", () => {
    const result = reviewConnection({
      edge: { id: "e1", source: "client", target: "db" },
      nodes,
      edges: [{ id: "e1", source: "client", target: "db" }],
      requirements: "Online application",
    });
    expect(result.severity).toBe("high");
    expect(result.title).toContain("bypass");
  });

  it("flags self-referencing edges", () => {
    const result = reviewConnection({
      edge: { id: "e1", source: "api", target: "api" },
      nodes,
      edges: [{ id: "e1", source: "api", target: "api" }],
      requirements: "",
    });
    expect(result.severity).toBe("high");
  });

  it("flags duplicate directed edges", () => {
    const result = reviewConnection({
      edge: { id: "e1", source: "client", target: "api" },
      nodes,
      edges: [
        { id: "e1", source: "client", target: "api" },
        { id: "e2", source: "client", target: "api" },
      ],
      requirements: "",
    });
    expect(result.severity).toBe("medium");
  });

  it("calls out potentially excessive complexity under a constrained budget", () => {
    const result = reviewConnection({
      edge: { id: "e1", source: "api", target: "queue" },
      nodes,
      edges: [{ id: "e1", source: "api", target: "queue" }],
      requirements: "A small app with a low budget",
    });
    expect(result.severity).toBe("medium");
    expect(result.title).toContain("cost");
  });

  it("does not claim that an unflagged connection is definitely correct", () => {
    const result = reviewConnection({
      edge: { id: "e1", source: "client", target: "api" },
      nodes,
      edges: [{ id: "e1", source: "client", target: "api" }],
      requirements: "",
    });
    expect(result.severity).toBe("ok");
    expect(result.description).toContain("not proof");
  });
});
