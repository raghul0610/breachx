import { Fragment, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Copy, FolderPlus, Github, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import {
  createProject,
  deleteProject,
  duplicateProject,
  listProjects,
  renameProject,
  setActiveProject,
  type ArchitectureProject,
} from "../lib/storage";
import { deleteOwnedProject } from "../lib/projectsRepository";
type ProjectNodePreview = { id: string; data: { label: string } };

function getProjectNodePreviews(nodes: unknown[]): ProjectNodePreview[] {
  return nodes.filter((node): node is ProjectNodePreview => {
    if (!node || typeof node !== "object") return false;
    const candidate = node as { id?: unknown; data?: { label?: unknown } };
    return typeof candidate.id === "string"
      && !!candidate.data && typeof candidate.data === "object"
      && typeof candidate.data.label === "string";
  }).slice(0, 3);
}

import "./ProjectDashboard.css";
import { InteractiveTutorial } from "./InteractiveTutorial";
import { ShapeGridBackground } from "./ShapeGridBackground";

export function ProjectDashboard({ onBack, onOpenProject }: { onBack: () => void; onOpenProject: (projectId: string) => void }) {
  const [projects, setProjects] = useState<ArchitectureProject[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    try {
      setProjects(listProjects());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your projects.");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = () => {
    try {
      setBusy(true);
      const project = createProject();
      refresh();
      onOpenProject(project.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a project.");
    } finally {
      setBusy(false);
    }
  };

  const open = (projectId: string) => {
    try {
      setActiveProject(projectId);
      onOpenProject(projectId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open this project.");
      refresh();
    }
  };

  const rename = (project: ArchitectureProject) => {
    const name = window.prompt("New project name", project.applicationName);
    if (name === null) return;
    try {
      renameProject(project.id, name);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not rename this project.");
    }
  };

  const duplicate = (project: ArchitectureProject) => {
    try {
      const copy = duplicateProject(project.id);
      refresh();
      open(copy.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not duplicate this project.");
    }
  };

  const remove = async (project: ArchitectureProject) => {
    if (!window.confirm(`Delete "${project.applicationName}"? This cannot be undone.`)) return;
    try {
      void deleteOwnedProject(project.id).then(() => {
        deleteProject(project.id);
        refresh();
      }).catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Could not delete this project from the cloud.");
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this project.");
    }
  };

  return (
    <div className="app-shell project-dashboard">
      <ShapeGridBackground />
      <header className="topbar">
        <button className="nav-btn" onClick={onBack}><ArrowLeft size={14} /> HOME</button>
        <div><strong>ANCHON</strong><span className="topbar-sub"> // PROJECT WORKSPACE</span></div>
        <span className="status-pill">{projects.length} PROJECT{projects.length === 1 ? "" : "S"}</span>
      </header>
      <main className="project-dashboard-content">
        <section className="project-dashboard-hero">
          <div>
            <div className="section-kicker"><Workflow size={13} /> YOUR ARCHITECTURES</div>
            <h1>PROJECT WORKSPACE</h1>
            <p>Keep each system design separate. Your private projects sync to your account across devices.</p>
          </div>
          <button data-tutorial="new-project" className="primary-btn" onClick={create} disabled={busy}><Plus size={14} /> NEW PROJECT</button>
        </section>
        <section className="github-connection panel github-connection-development" aria-labelledby="github-connection-title">
          <div className="github-connection-heading">
            <div className="github-connection-icon"><Github size={20} /></div>
            <div className="github-connection-title">
              <div className="section-kicker"><Workflow size={13} /> REPOSITORY INTEGRATION</div>
              <h2 id="github-connection-title">Connect GitHub</h2>
              <p>Repository connection and codebase analysis are currently being built. This feature will be available in a future update.</p>
            </div>
            <span className="github-building-pill">IN BUILDING</span>
          </div>
        </section>
        {error && <div className="project-error" role="alert">{error}</div>}
        {projects.length === 0 && !error ? (
          <section className="project-empty panel">
            <FolderPlus size={28} />
            <h2>No projects yet</h2>
            <p>Create your first architecture project to start designing.</p>
            <button data-tutorial="new-project" className="primary-btn" onClick={create} disabled={busy}><Plus size={14} /> CREATE PROJECT</button>
          </section>
        ) : (
          <section className="project-grid" aria-label="Saved architecture projects" data-tutorial="project-grid">
            {projects.map((project) => (
              <article className="project-card panel" key={project.id}>
                <div className="project-card-top">
                  <span className={`project-status ${project.status === "submitted" ? "is-submitted" : ""}`}>{project.status === "submitted" ? "SUBMITTED · EDITABLE" : "DRAFT"}</span>
                  <span className="project-count">{project.nodes.length} components · {project.edges.length} connections</span>
                </div>
                <h2>{project.applicationName}</h2>
                <p className="project-description">{project.applicationDescription || "No requirements added yet."}</p>
                <div className="project-flow-preview" aria-label={`${project.nodes.length} architecture components and ${project.edges.length} connections`}>{getProjectNodePreviews(project.nodes).length ? getProjectNodePreviews(project.nodes).map((node, index, previewNodes) => <Fragment key={node.id}><span className="project-flow-node" title={node.data.label}>{node.data.label}</span>{index < previewNodes.length - 1 && <i aria-hidden="true" />}</Fragment>) : <span className="project-flow-empty">No components yet</span>}</div>
                <div className="project-updated">UPDATED {new Date(project.updatedAt).toLocaleString()}</div>
                <div className="project-actions" data-tutorial="project-actions">
                  <button className="primary-btn compact" onClick={() => open(project.id)}>{project.status === "submitted" ? "VIEW PROJECT" : "OPEN PROJECT"}</button>
                  <button className="icon-btn" onClick={() => rename(project)} aria-label={`Rename ${project.applicationName}`} title="Rename"><Pencil size={13} /></button>
                  <button className="icon-btn" onClick={() => duplicate(project)} aria-label={`Duplicate ${project.applicationName}`} title="Duplicate"><Copy size={13} /></button>
                  <button className="icon-btn project-delete" onClick={() => remove(project)} aria-label={`Delete ${project.applicationName}`} title="Delete"><Trash2 size={13} /></button>
                </div>
              </article>
            ))}
          </section>
        )}
        <p className="project-storage-note">Cloud persistence is enabled. If a save fails, the cloud-sync banner at the top will show the error.</p>
      </main>
      <InteractiveTutorial page="dashboard" />
    </div>
  );
}
