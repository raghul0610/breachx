import type { Edge, Node } from "@xyflow/react";

export type LayoutNode = Pick<Node, "id" | "position">;
export type LayoutConnection = Pick<Edge, "source" | "target">;

export const AI_LAYOUT = {
  horizontalGap: 300,
  verticalGap: 176,
  originX: 120,
  originY: 120,
} as const;

/**
 * Places architecture nodes in compact, left-to-right layers.
 * Rank is derived from graph connectivity; repeated barycenter ordering reduces
 * edge crossings while preserving a stable layout for nodes with the same rank.
 */
export function layoutArchitectureGraph<T extends LayoutNode>(
  nodes: T[],
  connections: LayoutConnection[],
): T[] {
  if (nodes.length < 2) {
    return nodes.map((node) => ({ ...node, position: { x: AI_LAYOUT.originX, y: AI_LAYOUT.originY } }));
  }

  const ids = nodes.map((node) => node.id);
  const validIds = new Set(ids);
  const outgoing = new Map(ids.map((id) => [id, [] as string[]]));
  const incoming = new Map(ids.map((id) => [id, [] as string[]]));
  for (const edge of connections) {
    if (!validIds.has(edge.source) || !validIds.has(edge.target) || edge.source === edge.target) continue;
    outgoing.get(edge.source)!.push(edge.target);
    incoming.get(edge.target)!.push(edge.source);
  }

  // Use longest-path ranks for acyclic graphs so each connection advances one layer.
  // This avoids edges skipping over intermediate columns of nodes.
  const rank = new Map<string, number>(ids.map((id) => [id, 0]));
  const indegree = new Map(ids.map((id) => [id, incoming.get(id)!.length]));
  const queue = ids.filter((id) => indegree.get(id) === 0);
  const topologicalOrder: string[] = [];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const source = queue[cursor];
    topologicalOrder.push(source);
    for (const target of outgoing.get(source)!) {
      rank.set(target, Math.max(rank.get(target) ?? 0, (rank.get(source) ?? 0) + 1));
      indegree.set(target, indegree.get(target)! - 1);
      if (indegree.get(target) === 0) queue.push(target);
    }
  }
  if (topologicalOrder.length !== ids.length) {
    // Cyclic architectures have no valid topological order; use a bounded BFS fallback.
    rank.clear();
    const cycleQueue = ids.filter((id) => incoming.get(id)!.length === 0);
    for (const id of cycleQueue) rank.set(id, 0);
    if (cycleQueue.length === 0) {
      cycleQueue.push(ids[0]);
      rank.set(ids[0], 0);
    }
    for (let cursor = 0; cursor < cycleQueue.length; cursor += 1) {
      const source = cycleQueue[cursor];
      for (const target of outgoing.get(source)!) {
        if (!rank.has(target)) {
          rank.set(target, (rank.get(source) ?? 0) + 1);
          cycleQueue.push(target);
        }
      }
    }
    let nextRank = Math.max(0, ...rank.values()) + 1;
    for (const id of ids) {
      if (!rank.has(id)) {
        rank.set(id, nextRank);
        nextRank += 1;
      }
    }
  }

  const layers = new Map<number, string[]>();
  for (const id of ids) {
    const depth = rank.get(id) ?? 0;
    if (!layers.has(depth)) layers.set(depth, []);
    layers.get(depth)!.push(id);
  }
  const layerRanks = [...layers.keys()].sort((a, b) => a - b);
  const order = new Map(ids.map((id, index) => [id, index]));

  // Reorder rows by neighboring node positions to reduce edge intersections.
  for (let pass = 0; pass < 6; pass += 1) {
    for (const depth of layerRanks.slice(1)) {
      const layer = layers.get(depth)!;
      layer.sort((a, b) => {
        const score = (id: string) => {
          const neighbors = [...incoming.get(id)!, ...outgoing.get(id)!];
          const positions = neighbors.map((neighbor) => order.get(neighbor)).filter((value): value is number => value !== undefined);
          return positions.length ? positions.reduce((sum, value) => sum + value, 0) / positions.length : order.get(id)!;
        };
        return score(a) - score(b) || order.get(a)! - order.get(b)!;
      });
      layer.forEach((id, index) => order.set(id, index));
    }
    for (const depth of layerRanks.slice(0, -1).reverse()) {
      const layer = layers.get(depth)!;
      layer.sort((a, b) => {
        const score = (id: string) => {
          const neighbors = outgoing.get(id)!;
          const positions = neighbors.map((neighbor) => order.get(neighbor)).filter((value): value is number => value !== undefined);
          return positions.length ? positions.reduce((sum, value) => sum + value, 0) / positions.length : order.get(id)!;
        };
        return score(a) - score(b) || order.get(a)! - order.get(b)!;
      });
      layer.forEach((id, index) => order.set(id, index));
    }
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const depth of layerRanks) {
    const layer = layers.get(depth)!;
    layer.forEach((id, index) => {
      positions.set(id, {
        x: AI_LAYOUT.originX + depth * AI_LAYOUT.horizontalGap,
        y: AI_LAYOUT.originY + (index - (layer.length - 1) / 2) * AI_LAYOUT.verticalGap,
      });
    });
  }

  return nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position }));
}

