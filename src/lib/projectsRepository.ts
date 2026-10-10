import { supabase } from "./supabase";
import type { ArchitectureProject } from "./storage";

export type ProjectRow = {
  id: string;
  owner_id: string;
  application_name: string;
  application_description: string;
  nodes: unknown[];
  edges: unknown[];
  notes: string;
  workload: ArchitectureProject["workload"] | null;
  viewport: Record<string, unknown> | null;
  status: "draft" | "submitted";
  created_at: string;
  updated_at: string;
};

function toProject(row: ProjectRow): ArchitectureProject {
  return {
    id: row.id,
    applicationName: row.application_name,
    applicationDescription: row.application_description,
    nodes: row.nodes,
    edges: row.edges,
    notes: row.notes,
    workload: row.workload ?? undefined,
    viewport: row.viewport ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(project: ArchitectureProject, ownerId: string) {
  return {
    id: project.id,
    owner_id: ownerId,
    application_name: project.applicationName,
    application_description: project.applicationDescription,
    nodes: project.nodes,
    edges: project.edges,
    notes: project.notes,
    workload: project.workload ?? null,
    viewport: project.viewport ?? null,
    status: project.status,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  };
}

async function requireOwnerId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("AUTH_REQUIRED");
  return data.user.id;
}

export async function listOwnedProjects(): Promise<ArchitectureProject[]> {
  await requireOwnerId();
  const { data, error } = await supabase
    .from("projects")
    .select("id,owner_id,application_name,application_description,nodes,edges,notes,workload,viewport,status,created_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ProjectRow[]).map(toProject);
}

export async function saveOwnedProject(project: ArchitectureProject): Promise<void> {
  const ownerId = await requireOwnerId();
  const { error } = await supabase.from("projects").upsert(toRow(project, ownerId), { onConflict: "id" });
  if (error) throw error;
}

function sameProjectContent(a: ArchitectureProject, b: ArchitectureProject): boolean {
  return JSON.stringify({
    applicationName: a.applicationName,
    applicationDescription: a.applicationDescription,
    nodes: a.nodes,
    edges: a.edges,
    notes: a.notes,
    workload: a.workload ?? null,
    viewport: a.viewport ?? null,
    status: a.status,
  }) === JSON.stringify({
    applicationName: b.applicationName,
    applicationDescription: b.applicationDescription,
    nodes: b.nodes,
    edges: b.edges,
    notes: b.notes,
    workload: b.workload ?? null,
    viewport: b.viewport ?? null,
    status: b.status,
  });
}

/** Upload only new or changed projects so unrelated rows' updated_at values remain stable. */
export async function saveOwnedProjects(projects: ArchitectureProject[]): Promise<void> {
  if (projects.length === 0) return;
  const ownerId = await requireOwnerId();
  const remoteProjects = await listOwnedProjects();
  const remoteById = new Map(remoteProjects.map((project) => [project.id, project]));
  const changed = projects.filter((project) => {
    const remote = remoteById.get(project.id);
    return !remote || !sameProjectContent(project, remote);
  });
  if (changed.length === 0) return;
  const { error } = await supabase.from("projects").upsert(
    changed.map((project) => toRow(project, ownerId)),
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function deleteOwnedProject(projectId: string): Promise<void> {
  await requireOwnerId();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}
