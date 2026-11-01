import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Copy, FolderPlus, Github, Pencil, Plus, Trash2, Workflow, Layers, CheckCircle2, Clock } from "lucide-react";
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
import { ModalDialog } from "./ModalDialog";

export function ProjectDashboard({ onBack, onOpenProject }: { onBack: () => void; onOpenProject: (projectId: string) => void }) {
  const [projects, setProjects] = useState<ArchitectureProject[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Modal dialog states
  const [renameTarget, setRenameTarget] = useState<ArchitectureProject | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ArchitectureProject | null>(null);

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

  const startRename = (project: ArchitectureProject) => {
    setRenameTarget(project);
    setRenameValue(project.applicationName);
  };

  const confirmRename = () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      renameProject(renameTarget.id, renameValue.trim());
      setRenameTarget(null);
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

  const startDelete = (project: ArchitectureProject) => {
    setDeleteTarget(project);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const project = deleteTarget;
    setDeleteTarget(null);
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
        <button className="nav-btn" onClick={onBack} aria-label="Go to Home">
          <ArrowLeft size={15} />
          <span>Home</span>
        </button>
        <div className="topbar-brand">
          <div className="topbar-logo-mark">
            <Layers size={16} />
          </div>
          <span className="topbar-title">ANCHON</span>
          <span className="topbar-badge">Architecture Studio</span>
        </div>
        <div className="topbar-right">
          <span className="status-pill">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </span>
        </div>
      </header>

      <main className="project-dashboard-content">
        <section className="project-dashboard-hero">
          <div>
            <div className="section-kicker">
              <Workflow size={13} />
              <span>System Design Workspaces</span>
            </div>
            <h1>Your Architectures</h1>
            <p>Design, evaluate, and share production-grade distributed architectures. Projects are synced securely to your cloud account.</p>
          </div>
          <button data-tutorial="new-project" className="primary-btn" onClick={create} disabled={busy}>
            <Plus size={15} />
            <span>New Architecture</span>
          </button>
        </section>

        <section className="github-connection panel github-connection-development" aria-labelledby="github-connection-title">
          <div className="github-connection-heading">
            <div className="github-connection-icon"><Github size={18} /></div>
            <div className="github-connection-title">
              <div className="section-kicker">
                <Workflow size={12} />
                <span>Repository Integration</span>
              </div>
              <h2 id="github-connection-title">Connect GitHub Repositories</h2>
              <p>Automated codebase topology inference and pull-request architecture verification are currently in preview.</p>
            </div>
            <span className="github-building-pill">Preview</span>
          </div>
        </section>

        {error && <div className="project-error" role="alert">{error}</div>}

        {projects.length === 0 && !error ? (
          <section className="project-empty panel">
            <div className="project-empty-icon-wrapper">
              <FolderPlus size={32} />
            </div>
            <h2>No architectures yet</h2>
            <p>Start from a clean slate or let ANCHON AI draft your system architecture.</p>
            <button data-tutorial="new-project" className="primary-btn" onClick={create} disabled={busy}>
              <Plus size={15} />
              <span>Create First Architecture</span>
            </button>
          </section>
        ) : (
          <section className="project-grid" aria-label="Saved architecture projects" data-tutorial="project-grid">
            {projects.map((project) => (
              <article className="project-card panel" key={project.id}>
                <div className="project-card-top">
                  <span className={`project-status ${project.status === "submitted" ? "is-submitted" : ""}`}>
                    {project.status === "submitted" ? <><CheckCircle2 size={11} /> Ready</> : "Draft"}
                  </span>
                  <span className="project-count">
                    {project.nodes.length} {project.nodes.length === 1 ? "component" : "components"} · {project.edges.length} {project.edges.length === 1 ? "link" : "links"}
                  </span>
                </div>

                <h2>{project.applicationName || "Untitled Architecture"}</h2>
                <p className="project-description">{project.applicationDescription || "No design brief or requirements added yet."}</p>

                <div className="project-updated">
                  <Clock size={11} />
                  <span>Updated {new Date(project.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>

                <div className="project-actions" data-tutorial="project-actions">
                  <button className="primary-btn compact" onClick={() => open(project.id)}>
                    {project.status === "submitted" ? "Open Architecture" : "Edit Architecture"}
                  </button>
                  <div className="project-action-icons">
                    <button className="icon-btn" onClick={() => startRename(project)} aria-label={`Rename ${project.applicationName}`} title="Rename">
                      <Pencil size={13} />
                    </button>
                    <button className="icon-btn" onClick={() => duplicate(project)} aria-label={`Duplicate ${project.applicationName}`} title="Duplicate">
                      <Copy size={13} />
                    </button>
                    <button className="icon-btn project-delete" onClick={() => startDelete(project)} aria-label={`Delete ${project.applicationName}`} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        <p className="project-storage-note">Cloud synchronization is active. All architectures autosave locally and continuously back up to your account.</p>
      </main>

      {/* Rename Dialog */}
      <ModalDialog
        isOpen={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title="Rename Architecture"
        type="prompt"
        confirmLabel="Save Name"
        onConfirm={confirmRename}
        confirmDisabled={!renameValue.trim()}
      >
        <p>Enter a clear, descriptive name for this system architecture:</p>
        <input
          type="text"
          className="modal-input"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          placeholder="e.g. Distributed Payment Pipeline"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && renameValue.trim()) confirmRename();
          }}
        />
      </ModalDialog>

      {/* Delete Confirmation Dialog */}
      <ModalDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Architecture"
        type="danger"
        isDestructive
        confirmLabel="Delete Project"
        onConfirm={confirmDelete}
      >
        <p>
          Are you sure you want to permanently delete <strong>{deleteTarget?.applicationName}</strong>?
        </p>
        <p style={{ color: "#94a3b8", fontSize: "13px" }}>
          This will remove all nodes, connections, design notes, and evaluation histories associated with this architecture.
        </p>
      </ModalDialog>

      <InteractiveTutorial page="dashboard" />
    </div>
  );
}
