export type ArchitectureComponent = {
  id: string;
  typeKey: string;
  label: string;
  category?: string;
  notes?: string;
  requirementIds?: string[];
};
export type ArchitectureConnection = {
  source: string;
  target: string;
  label?: string;
  communicationType?: string;
  purpose?: string;
};
export type RequirementCoverage = {
  requirement: string;
  componentIds: string[];
  rationale: string;
};
export type ArchitectureValidation = {
  passed: boolean;
  errors: string[];
  warnings: string[];
};

const MAX_COMPONENTS = 24;
const MAX_CONNECTIONS = 48;
const MAX_WARNINGS = 12;

export function validateArchitectureGraph(input: {
  components: ArchitectureComponent[];
  connections: ArchitectureConnection[];
  validTypeKeys: ReadonlySet<string>;
  requirementCoverage?: RequirementCoverage[];
}): ArchitectureValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { components, connections, validTypeKeys, requirementCoverage = [] } = input;
  const ids = new Set<string>();
  const validIds = new Set<string>();

  if (components.length < 3) errors.push("At least three valid components are required.");
  if (components.length > MAX_COMPONENTS) errors.push(`Architecture exceeds the ${MAX_COMPONENTS}-component limit.`);
  if (connections.length > MAX_CONNECTIONS) errors.push(`Architecture exceeds the ${MAX_CONNECTIONS}-connection limit.`);

  for (const component of components) {
    if (!component.id?.trim()) {
      errors.push("Every component must have a non-empty ID.");
      continue;
    }
    if (ids.has(component.id)) {
      errors.push(`Duplicate component ID: ${component.id}.`);
      continue;
    }
    ids.add(component.id);
    validIds.add(component.id);
    if (!validTypeKeys.has(component.typeKey)) errors.push(`Component "${component.label || component.id}" uses an unknown catalog type.`);
    if (!component.label?.trim()) errors.push(`Component "${component.id}" needs a descriptive label.`);
    if (!component.notes?.trim()) errors.push(`Component "${component.label || component.id}" has no responsibility or rationale.`);
  }

  const edgeKeys = new Set<string>();
  const adjacency = new Map<string, string[]>();
  const undirected = new Map<string, string[]>();
  for (const id of validIds) { adjacency.set(id, []); undirected.set(id, []); }
  for (const edge of connections) {
    if (!validIds.has(edge.source) || !validIds.has(edge.target)) {
      errors.push(`Connection "${edge.source} → ${edge.target}" references a missing component.`);
      continue;
    }
    if (edge.source === edge.target) {
      errors.push(`Self-connection on "${edge.source}" is not allowed.`);
      continue;
    }
    const key = `${edge.source}\u0000${edge.target}`;
    if (edgeKeys.has(key)) warnings.push(`Duplicate directed connection: ${edge.source} → ${edge.target}.`);
    edgeKeys.add(key);
    adjacency.get(edge.source)?.push(edge.target);
    undirected.get(edge.source)?.push(edge.target);
    undirected.get(edge.target)?.push(edge.source);
    if (!edge.label?.trim() || !edge.purpose?.trim() || !edge.communicationType?.trim()) {
      errors.push(`Connection ${edge.source} → ${edge.target} must define a label, communication type, and purpose.`);
    }
  }

  if (components.length > 0 && validIds.size > 0) {
    const visited = new Set<string>();
    const groups: string[][] = [];
    for (const id of validIds) {
      if (visited.has(id)) continue;
      const group: string[] = [];
      const queue = [id];
      while (queue.length) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        group.push(current);
        for (const next of undirected.get(current) ?? []) queue.push(next);
      }
      groups.push(group);
    }
    if (groups.length > 1) {
      errors.push(`Graph contains ${groups.length} disconnected subgraphs; connect required components or remove unjustified components: ${groups.map((group) => group.join(", ")).join(" | ")}.`);
    }
    const indegree = new Map<string, number>();
    for (const id of validIds) indegree.set(id, 0);
    for (const edge of connections) {
      if (validIds.has(edge.source) && validIds.has(edge.target) && edge.source !== edge.target) {
        indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
      }
    }
    if ([...indegree.values()].every((degree) => degree > 0)) {
      warnings.push("No entry component was identified; the graph may contain a cycle.");
    }
  }

  if (requirementCoverage.length === 0) errors.push("Requirement coverage must map key requirements to components.");
  for (const item of requirementCoverage) {
    if (!item.requirement?.trim()) errors.push("Requirement coverage entries must name a requirement.");
    if (!item.rationale?.trim()) warnings.push(`Requirement "${item.requirement}" has no coverage rationale.`);
    const unknown = (item.componentIds ?? []).filter((id) => !validIds.has(id));
    if (unknown.length) errors.push(`Requirement "${item.requirement}" references unknown components: ${unknown.join(", ")}.`);
    if (!item.componentIds?.length) errors.push(`Requirement "${item.requirement}" is not mapped to a component.`);
  }

  const uniqueWarnings = [...new Set(warnings)].slice(0, MAX_WARNINGS);
  return { passed: errors.length === 0, errors: [...new Set(errors)], warnings: uniqueWarnings };
}
