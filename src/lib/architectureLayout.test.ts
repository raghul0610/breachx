import { describe, expect, it } from "vitest";
import { AI_LAYOUT, layoutArchitectureGraph } from "./architectureLayout";

describe("layoutArchitectureGraph", () => {
  it("places connected nodes in spacious left-to-right layers", () => {
    const nodes = [
      { id: "client", position: { x: 0, y: 0 } },
      { id: "api", position: { x: 0, y: 0 } },
      { id: "database", position: { x: 0, y: 0 } },
    ];
    const edges = [
      { source: "client", target: "api" },
      { source: "api", target: "database" },
    ];
    const result = layoutArchitectureGraph(nodes, edges);
    const byId = new Map(result.map((node) => [node.id, node.position]));

    expect(byId.get("api")!.x - byId.get("client")!.x).toBe(AI_LAYOUT.horizontalGap);
    expect(byId.get("database")!.x - byId.get("api")!.x).toBe(AI_LAYOUT.horizontalGap);
    expect(new Set(result.map((node) => `${node.position.x},${node.position.y}`)).size).toBe(nodes.length);
  });

  it("stacks fan-out nodes with large vertical separation", () => {
    const nodes = [
      { id: "gateway", position: { x: 0, y: 0 } },
      { id: "users", position: { x: 0, y: 0 } },
      { id: "orders", position: { x: 0, y: 0 } },
      { id: "billing", position: { x: 0, y: 0 } },
    ];
    const edges = [
      { source: "gateway", target: "users" },
      { source: "gateway", target: "orders" },
      { source: "gateway", target: "billing" },
    ];
    const result = layoutArchitectureGraph(nodes, edges);
    const targetYs = result.filter((node) => node.id !== "gateway").map((node) => node.position.y).sort((a, b) => a - b);

    expect(targetYs[1] - targetYs[0]).toBe(AI_LAYOUT.verticalGap);
    expect(targetYs[2] - targetYs[1]).toBe(AI_LAYOUT.verticalGap);
  });

  it("assigns a unique position to every node, including disconnected nodes", () => {
    const nodes = [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 0, y: 0 } },
      { id: "c", position: { x: 0, y: 0 } },
      { id: "orphan", position: { x: 0, y: 0 } },
    ];
    const result = layoutArchitectureGraph(nodes, [{ source: "a", target: "b" }, { source: "b", target: "c" }]);
    const positions = result.map((node) => `${node.position.x},${node.position.y}`);

    expect(new Set(positions).size).toBe(nodes.length);
  });
});
