import { describe, expect, it } from "vitest";
import { deleteGraphSelection } from "./graphEditing";

describe("deleteGraphSelection", () => {
  const nodes = [
    { id: "a", selected: true, label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
  ];
  const edges = [
    { id: "ab", source: "a", target: "b" },
    { id: "bc", source: "b", target: "c" },
    { id: "ac", source: "a", target: "c" },
  ];

  it("deletes selected nodes and all incident edges only", () => {
    const result = deleteGraphSelection(nodes, edges, new Set(["a"]), new Set());
    expect(result.nodes.map((node) => node.id)).toEqual(["b", "c"]);
    expect(result.edges.map((edge) => edge.id)).toEqual(["bc"]);
  });

  it("deletes selected edges without deleting connected nodes", () => {
    const result = deleteGraphSelection(nodes, edges, new Set(), new Set(["bc"]));
    expect(result.nodes.map((node) => node.id)).toEqual(["a", "b", "c"]);
    expect(result.edges.map((edge) => edge.id)).toEqual(["ab", "ac"]);
  });

  it("supports multi-node and explicit edge deletion together", () => {
    const result = deleteGraphSelection(nodes, edges, new Set(["a", "b"]), new Set(["ac"]));
    expect(result.nodes.map((node) => node.id)).toEqual(["c"]);
    expect(result.edges).toEqual([]);
  });

  it("does not mutate input arrays", () => {
    const originalNodes = [...nodes];
    const originalEdges = [...edges];
    deleteGraphSelection(nodes, edges, new Set(["a"]), new Set());
    expect(nodes).toEqual(originalNodes);
    expect(edges).toEqual(originalEdges);
  });
});
