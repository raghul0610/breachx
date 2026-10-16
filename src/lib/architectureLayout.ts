import type { Edge, Node } from "@xyflow/react";

export type LayoutNode = Pick<Node, "id" | "position">;
export type LayoutConnection = Pick<Edge, "source" | "target">;

export const AI_LAYOUT = {
  horizontalGap: 540,
  verticalGap: 320,
  originX: 120,
  originY: 120,
} as const;

/**
 * Places architecture nodes in spacious left-to-right layers.
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

  // Breadth-first depth from all entry nodes. This also gives sensible ranks for cycles.
  const rank = new Map<string, number>();
  const queue = ids.filter((id) => incoming.get(id)!.length === 0);
  for (const id of queue) rank.set(id, 0);
  if (queue.length === 0) {
    queue.push(ids[0]);
    rank.set(ids[0], 0);
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const source = queue[cursor];
    for (const target of outgoing.get(source)!) {
      const nextRank = (rank.get(source) ?? 0) + 1;
      if (!rank.has(target) || nextRank < rank.get(target)!) {
        rank.set(target, nextRank);
        queue.push(target);
      }
    }
  }
  // Disconnected components are placed in subsequent layers rather than stacked on top.
  let maxRank = Math.max(0, ...rank.values());
  for (const id of ids) {
    if (rank.has(id)) continue;
    maxRank += 1;
    rank.set(id, maxRank);
    queue.push(id);
    for (let cursor = queue.length - 1; cursor < queue.length; cursor += 1) {
      const source = queue[cursor];
      for (const target of outgoing.get(source)!) {
        if (!rank.has(target)) {
          rank.set(target, (rank.get(source) ?? maxRank) + 1);
          queue.push(target);
        }
      }
    }
    maxRank = Math.max(maxRank, ...rank.values());
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

