import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Copy, FolderPlus, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import {
  createProject,
  deleteProject,
  duplicateProject,
  listProjects,
  renameProject,
  setActiveProject,
  type ArchitectureProject,
} from "../lib/storage";
import "./ProjectDashboard.css";

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

  const remove = (project: ArchitectureProject) => {
    if (!window.confirm(`Delete "${project.applicationName}"? This cannot be undone.`)) return;
    try {
      deleteProject(project.id);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this project.");
    }
  };

  return (
    <div className="app-shell project-dashboard">
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
            <p>Keep each system design separate. Your projects are saved in this browser.</p>
          </div>
          <button className="primary-btn" onClick={create} disabled={busy}><Plus size={14} /> NEW PROJECT</button>
        </section>
        {error && <div className="project-error" role="alert">{error}</div>}
        {projects.length === 0 && !error ? (
          <section className="project-empty panel">
            <FolderPlus size={28} />
            <h2>No projects yet</h2>
            <p>Create your first architecture project to start designing.</p>
            <button className="primary-btn" onClick={create} disabled={busy}><Plus size={14} /> CREATE PROJECT</button>
          </section>
        ) : (
          <section className="project-grid" aria-label="Saved architecture projects">
            {projects.map((project) => (
              <article className="project-card panel" key={project.id}>
                <div className="project-card-top">
                  <span className={`project-status ${project.status === "submitted" ? "is-submitted" : ""}`}>{project.status === "submitted" ? "SUBMITTED · READ ONLY" : "DRAFT"}</span>
                  <span className="project-count">{project.nodes.length} components · {project.edges.length} connections</span>
                </div>
                <h2>{project.applicationName}</h2>
                <p className="project-description">{project.applicationDescription || "No requirements added yet."}</p>
                <div className="project-updated">UPDATED {new Date(project.updatedAt).toLocaleString()}</div>
                <div className="project-actions">
                  <button className="primary-btn compact" onClick={() => open(project.id)}>{project.status === "submitted" ? "VIEW PROJECT" : "OPEN PROJECT"}</button>
                  <button className="icon-btn" onClick={() => rename(project)} aria-label={`Rename ${project.applicationName}`} title="Rename"><Pencil size={13} /></button>
                  <button className="icon-btn" onClick={() => duplicate(project)} aria-label={`Duplicate ${project.applicationName}`} title="Duplicate"><Copy size={13} /></button>
                  <button className="icon-btn project-delete" onClick={() => remove(project)} aria-label={`Delete ${project.applicationName}`} title="Delete"><Trash2 size={13} /></button>
                </div>
              </article>
            ))}
          </section>
        )}
        <p className="project-storage-note">Local-first storage: projects remain in this browser on this device. Cloud sync is not part of this phase.</p>
      </main>
    </div>
  );
}
