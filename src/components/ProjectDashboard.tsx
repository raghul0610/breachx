import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Copy, FolderPlus, Github, Layers3, Pencil, Plus, Settings, Sparkles, Trash2, Workflow } from "lucide-react";
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
import "./ProjectDashboard.css";
import { InteractiveTutorial } from "./InteractiveTutorial";
import { ShapeGridBackground } from "./ShapeGridBackground";

export function ProjectDashboard({ onBack, onOpenProject, onOpenWorkspaceSection }: { onBack: () => void; onOpenProject: (projectId: string) => void; onOpenWorkspaceSection: (projectId: string, section: "learn" | "guide" | "settings") => void }) {
  const [projects, setProjects] = useState<ArchitectureProject[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{ type: "rename"; project: ArchitectureProject; name: string } | { type: "delete"; project: ArchitectureProject } | null>(null);

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

  const openWorkspaceSection = (section: "learn" | "guide" | "settings") => {
    const project = projects[0];
    if (!project) return;
    try {
      setActiveProject(project.id);
      onOpenWorkspaceSection(project.id, section);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open this workspace section.");
    }
  };

  const rename = (project: ArchitectureProject) => {
    setDialog({ type: "rename", project, name: project.applicationName });
  };

  const submitRename = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (dialog?.type !== "rename") return;
    try {
      renameProject(dialog.project.id, dialog.name);
      setDialog(null);
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

  const remove = (project: ArchitectureProject) => setDialog({ type: "delete", project });

  const confirmDelete = async () => {
    if (dialog?.type !== "delete") return;
    const project = dialog.project;
    setBusy(true);
    try {
      await deleteOwnedProject(project.id);
      deleteProject(project.id);
      setDialog(null);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this project from the cloud.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell project-dashboard">
      <ShapeGridBackground />
      <aside className="dashboard-sidebar" aria-label="Main navigation">
        <a className="dashboard-brand" href="#" onClick={(event) => { event.preventDefault(); onBack(); }} aria-label="ANCHON home"><span className="dashboard-brand-mark"><Layers3 size={19} /></span><span><strong>ANCHON</strong><small>ARCHITECTURE STUDIO</small></span></a>
        <div className="dashboard-nav-label">WORKSPACE</div>
        <nav className="dashboard-nav">
          <button type="button" className="is-active" aria-current="page"><Layers3 size={17} /><span>Projects</span><span className="dashboard-nav-count">{projects.length}</span></button>
          <button type="button" disabled={!projects.length} onClick={() => openWorkspaceSection("learn")}><BookOpen size={17} /><span>Learn</span></button>
          <button type="button" disabled={!projects.length} onClick={() => openWorkspaceSection("guide")}><Sparkles size={17} /><span>Guide</span></button>
        </nav>
        <div className="dashboard-sidebar-spacer" />
        <div className="dashboard-nav dashboard-nav-bottom"><button type="button" disabled={!projects.length} onClick={() => openWorkspaceSection("settings")}><Settings size={17} /><span>Settings</span></button></div>
        <div className="dashboard-sidebar-footer"><span className="dashboard-status-dot" /> Private workspace</div>
      </aside>
      <div className="dashboard-main">
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
      </div>
      {dialog && (
        <div className="dashboard-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDialog(null); }}>
          <section className="dashboard-dialog" role="dialog" aria-modal="true" aria-labelledby="dashboard-dialog-title">
            {dialog.type === "rename" ? (
              <form onSubmit={submitRename}>
                <div className="dashboard-dialog-kicker">PROJECT SETTINGS</div>
                <h2 id="dashboard-dialog-title">Rename project</h2>
                <p>Choose a clear name for this architecture workspace.</p>
                <label htmlFor="dashboard-project-name">Project name</label>
                <input id="dashboard-project-name" autoFocus maxLength={80} value={dialog.name} onChange={(event) => setDialog({ ...dialog, name: event.target.value })} required />
                <div className="dashboard-dialog-actions">
                  <button type="button" className="dashboard-dialog-secondary" onClick={() => setDialog(null)}>Cancel</button>
                  <button type="submit" className="dashboard-dialog-primary" disabled={!dialog.name.trim()}>Save changes</button>
                </div>
              </form>
            ) : (
              <>
                <div className="dashboard-dialog-kicker is-danger">DELETE PROJECT</div>
                <h2 id="dashboard-dialog-title">Delete this project?</h2>
                <p><strong>{dialog.project.applicationName}</strong> and its saved architecture will be removed. This action cannot be undone.</p>
                <div className="dashboard-dialog-actions">
                  <button type="button" className="dashboard-dialog-secondary" onClick={() => setDialog(null)} disabled={busy}>Cancel</button>
                  <button type="button" className="dashboard-dialog-danger" onClick={confirmDelete} disabled={busy}>{busy ? "Deleting…" : "Delete project"}</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      <InteractiveTutorial page="dashboard" />
    </div>
  );
}
