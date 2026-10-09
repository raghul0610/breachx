export type DeletableNode = { id: string; selected?: boolean };
export type DeletableEdge = { id: string; source: string; target: string; selected?: boolean };

export function deleteGraphSelection<N extends DeletableNode, E extends DeletableEdge>(
  nodes: N[],
  edges: E[],
  selectedNodeIds: Set<string>,
  selectedEdgeIds: Set<string>,
): { nodes: N[]; edges: E[] } {
  const remainingNodes = nodes.filter((node) => !selectedNodeIds.has(node.id));
  const remainingEdges = edges.filter((edge) =>
    !selectedEdgeIds.has(edge.id) &&
    !selectedNodeIds.has(edge.source) &&
    !selectedNodeIds.has(edge.target),
  );
  return { nodes: remainingNodes, edges: remainingEdges };
}
