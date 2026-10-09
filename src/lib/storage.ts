import type { WorkloadProfile } from "./evaluationEngine";

export type DesignSubmission = {
  applicationName: string;
  applicationDescription: string;
  nodes: unknown[];
  edges: unknown[];
  notes: string;
  workload?: WorkloadProfile;
  viewport?: Record<string, unknown>;
  status: "draft" | "submitted";
  updatedAt: string;
};

export type ArchitectureProject = DesignSubmission & {
  id: string;
  createdAt: string;
};

type ProjectRegistry = {
  version: 1;
  projects: ArchitectureProject[];
  activeProjectId: string | null;
};

const DESIGN_KEY = "breachx-design";
const REGISTRY_KEY = "anchon-projects-v1";
const ACTIVITY_KEY = "breachx-activity";

function now() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

function starterSubmission(): DesignSubmission {
  return {
    applicationName: "My System Design",
    applicationDescription: "Describe the application, expected users, traffic and important requirements.",
    nodes: [
      { id: "node-1", type: "blueprintNode", position: { x: 80, y: 160 }, data: { label: "Client / User App", typeKey: "client", category: "Edge" } },
      { id: "node-2", type: "blueprintNode", position: { x: 330, y: 160 }, data: { label: "WAF / Firewall", typeKey: "firewall", category: "Security" } },
      { id: "node-3", type: "blueprintNode", position: { x: 590, y: 160 }, data: { label: "API Gateway", typeKey: "api_gateway", category: "Routing" } },
    ],
    edges: [
      { id: "e1-2", source: "node-1", target: "node-2", animated: true, markerEnd: { type: "arrowclosed" } },
      { id: "e2-3", source: "node-2", target: "node-3", animated: true, markerEnd: { type: "arrowclosed" } },
    ],
    notes: "",
    status: "draft",
    updatedAt: now(),
  };
}

function isSubmission(value: unknown): value is DesignSubmission {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DesignSubmission>;
  return typeof item.applicationName === "string"
    && typeof item.applicationDescription === "string"
    && Array.isArray(item.nodes)
    && Array.isArray(item.edges)
    && typeof item.notes === "string"
    && (item.status === "draft" || item.status === "submitted")
    && typeof item.updatedAt === "string";
}

function readRegistry(): ProjectRegistry | null {
  const raw = localStorage.getItem(REGISTRY_KEY);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("ANCHON project data could not be read. Your saved data was left untouched.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("ANCHON project data has an unsupported format. Your saved data was left untouched.");
  }
  const value = parsed as Partial<ProjectRegistry>;
  if (value.version !== 1 || !Array.isArray(value.projects)
    || !(value.activeProjectId === null || typeof value.activeProjectId === "string")
    || !value.projects.every((project) => project && typeof project.id === "string" && isSubmission(project))) {
    throw new Error("ANCHON project data has an unsupported version or shape. Your saved data was left untouched.");
  }
  return value as ProjectRegistry;
}

function writeRegistry(registry: ProjectRegistry) {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  window.dispatchEvent(new Event("breachx-sync"));
}

function ensureRegistry(): ProjectRegistry {
  const existing = readRegistry();
  if (existing) return existing;

  const rawLegacy = localStorage.getItem(DESIGN_KEY);
  let projects: ArchitectureProject[] = [];
  if (rawLegacy !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawLegacy);
    } catch {
      throw new Error("Your older saved design could not be read. It has not been deleted or overwritten.");
    }
    if (!isSubmission(parsed)) {
      throw new Error("Your older saved design has an unexpected format. It has not been deleted or overwritten.");
    }
    const timestamp = parsed.updatedAt || now();
    projects = [{ ...parsed, id: newId(), createdAt: timestamp }];
  }

  const registry: ProjectRegistry = {
    version: 1,
    projects,
    activeProjectId: projects[0]?.id ?? null,
  };
  // Keep the legacy key as a recovery copy. Only create the registry after parsing succeeds.
  writeRegistry(registry);
  return registry;
}

export function listProjects(): ArchitectureProject[] {
  return [...ensureRegistry().projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getProject(projectId: string): ArchitectureProject | null {
  return ensureRegistry().projects.find((project) => project.id === projectId) ?? null;
}

export function getActiveProjectId(): string | null {
  return ensureRegistry().activeProjectId;
}

export function setActiveProject(projectId: string) {
  const registry = ensureRegistry();
  if (!registry.projects.some((project) => project.id === projectId)) {
    throw new Error("That project no longer exists.");
  }
  writeRegistry({ ...registry, activeProjectId: projectId });
}

export function createProject(initial?: Partial<DesignSubmission>): ArchitectureProject {
  const registry = ensureRegistry();
  const template = starterSubmission();
  const timestamp = now();
  const project: ArchitectureProject = {
    ...template,
    ...initial,
    id: newId(),
    createdAt: timestamp,
    applicationName: initial?.applicationName?.trim() || "Untitled Architecture",
    nodes: structuredClone(initial?.nodes ?? template.nodes),
    edges: structuredClone(initial?.edges ?? template.edges),
    status: "draft",
    updatedAt: timestamp,
  };
  writeRegistry({
    version: 1,
    projects: [project, ...registry.projects],
    activeProjectId: project.id,
  });
  return project;
}

export function renameProject(projectId: string, name: string): ArchitectureProject {
  const registry = ensureRegistry();
  const cleanedName = name.trim();
  if (!cleanedName) throw new Error("Project name cannot be empty.");
  const project = registry.projects.find((item) => item.id === projectId);
  if (!project) throw new Error("That project no longer exists.");
  const updated = { ...project, applicationName: cleanedName, updatedAt: now() };
  writeRegistry({ ...registry, projects: registry.projects.map((item) => item.id === projectId ? updated : item) });
  return updated;
}

export function duplicateProject(projectId: string): ArchitectureProject {
  const source = getProject(projectId);
  if (!source) throw new Error("That project no longer exists.");
  return createProject({
    ...source,
    applicationName: source.applicationName + " (copy)",
    nodes: structuredClone(source.nodes),
    edges: structuredClone(source.edges),
    status: "draft",
    viewport: source.viewport ? structuredClone(source.viewport) : undefined,
  });
}

export function deleteProject(projectId: string) {
  const registry = ensureRegistry();
  if (!registry.projects.some((project) => project.id === projectId)) return;
  const projects = registry.projects.filter((project) => project.id !== projectId);
  const activeProjectId = registry.activeProjectId === projectId
    ? (projects[0]?.id ?? null)
    : registry.activeProjectId;
  writeRegistry({ ...registry, projects, activeProjectId });
}

export function readSubmission(projectId?: string): DesignSubmission | null {
  const registry = ensureRegistry();
  const id = projectId ?? registry.activeProjectId;
  if (id) {
    const project = registry.projects.find((item) => item.id === id);
    if (project) {
      const { id: _id, createdAt: _createdAt, ...submission } = project;
      return submission;
    }
  }
  return null;
}

export function writeSubmission(value: DesignSubmission, projectId?: string) {
  const registry = ensureRegistry();
  const id = projectId ?? registry.activeProjectId;
  if (!id) throw new Error("No active project. Create a project before saving.");
  const existing = registry.projects.find((item) => item.id === id);
  if (!existing) throw new Error("That project no longer exists.");
  if (existing.status === "submitted" && value.status !== "submitted") {
    throw new Error("Submitted projects are locked. Duplicate the project to continue editing.");
  }
  const updated: ArchitectureProject = {
    ...existing,
    ...value,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: now(),
  };
  writeRegistry({
    ...registry,
    projects: registry.projects.map((item) => item.id === id ? updated : item),
    activeProjectId: id,
  });
}

export function logActivity(action: string, metadata: Record<string, unknown> = {}) {
  const existing = JSON.parse(localStorage.getItem(ACTIVITY_KEY) ?? "[]") as {
    action: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }[];

  existing.unshift({ action, metadata, createdAt: now() });
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(existing.slice(0, 100)));
  window.dispatchEvent(new Event("breachx-sync"));
}

export function readLogs() {
  return JSON.parse(localStorage.getItem(ACTIVITY_KEY) ?? "[]") as {
    action: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }[];
}
