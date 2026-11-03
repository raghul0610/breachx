import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, BookOpen, FolderPlus, Github, Layers3, MoreVertical, Pencil, Play, Plus, Settings, Share2, Workflow, Trash2, Workflow } from "lucide-react";
import {
  createProject,
  deleteProject,
  duplicateProject,
  listProjects,
  renameProject,
  setActiveProject,
  type ArchitectureProject,
} from "../lib/storage";
import { createProjectShare, deleteOwnedProject } from "../lib/projectsRepository";
import "./ProjectDashboard.css";
import { InteractiveTutorial } from "./InteractiveTutorial";
import GhostFibers from "./GhostFibers";
import { AnchonLogo } from "./AnchonLogo";
import { EdgeRevealSidebar } from "./EdgeRevealSidebar";

export function ProjectDashboard({ onBack, onOpenProject, onOpenWorkspaceSection }: { onBack: () => void; onOpenProject: (projectId: string) => void; onOpenWorkspaceSection: (section: "learn" | "guide" | "settings") => void }) {
  const [projects, setProjects] = useState<ArchitectureProject[]>([]);
  const [dashboardSidebarOpen, setDashboardSidebarOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{ type: "rename"; project: ArchitectureProject; name: string } | { type: "delete"; project: ArchitectureProject } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ project: ArchitectureProject; x: number; y: number } | null>(null);
  const [shareMessage, setShareMessage] = useState("");
  const [lastOpened, setLastOpened] = useState<Record<string, string>>({});
  const markOpened = (id: string) => { const timestamp = new Date().toISOString(); try { window.localStorage.setItem(`anchon:project-last-opened:${id}`, timestamp); } catch { /* local tracking is optional */ } setLastOpened(current => ({ ...current, [id]: timestamp })); };
  const formatLastOpened = (id: string) => { const value = lastOpened[id]; if (!value) return "Not opened yet"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Not opened yet" : `Last opened ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`; };

  const refresh = useCallback(() => {
    try {
      setProjects(listProjects());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your projects.");
    }
  }, []);

  useEffect(() => { refresh(); try { const values: Record<string, string> = {}; for (const project of listProjects()) { const value = window.localStorage.getItem(`anchon:project-last-opened:${project.id}`); if (value) values[project.id] = value; } setLastOpened(values); } catch { /* Last-opened metadata is best effort. */ } }, [refresh]);

  useEffect(() => {
    if (!dialog) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setDialog(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialog, busy]);

  const create = () => {
    try {
      setBusy(true);
      const project = createProject();
      markOpened(project.id);
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
      markOpened(projectId);
      setContextMenu(null);
      onOpenProject(projectId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open this project.");
      refresh();
    }
  };

  const openWorkspaceSection = (section: "learn" | "guide" | "settings") => onOpenWorkspaceSection(section);
  useEffect(() => { if (!contextMenu) return; const close = () => setContextMenu(null); const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); }; window.addEventListener("pointerdown", close); window.addEventListener("resize", close); window.addEventListener("scroll", close, true); window.addEventListener("keydown", keydown); return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true); window.removeEventListener("keydown", keydown); }; }, [contextMenu]);

  const rename = (project: ArchitectureProject) => {
    setDialog({ type: "rename", project, name: project.applicationName });
  };

  const submitRename = (event: FormEvent<HTMLFormElement>) => {
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

  const share = async (project: ArchitectureProject) => {
    setContextMenu(null);
    try {
      const link = await createProjectShare(project.id);
      await navigator.clipboard.writeText(link);
      setShareMessage("Share link copied. Anyone with the link can sign in to receive a copy of this project.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a share link.");
    }
  };

  const showProjectMenu = (project: ArchitectureProject, anchor: HTMLElement) => {
    const bounds = anchor.getBoundingClientRect();
    const menuWidth = 202;
    const menuHeight = 154;
    const left = Math.max(8, Math.min(bounds.left + 10, window.innerWidth - menuWidth - 8));
    const below = bounds.bottom + 10;
    const top = below + menuHeight <= window.innerHeight - 8
      ? below
      : Math.max(8, bounds.top - menuHeight - 10);
    setContextMenu({ project, x: left, y: top });
  };

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
    <div className="app-shell project-dashboard" onMouseMove={(event) => { if (event.clientX <= 24) setDashboardSidebarOpen(true); }}>
      <div className="project-dashboard-ghost-background" aria-hidden="true"><GhostFibers className="project-dashboard-ghost-fibers" glowColor="#323535" layers={3} twist={1.2} threads={72} fiberStyle="dots" depthOfField={0.85} hoverEffect="focus" intro mouseInteraction lineColor="#bcc5c5" secondaryColor="#323535" speed={0.22} density={0.65} particles={0.16} glow={0.42} brightness={0.72} dpr={1.25} /></div>
      <EdgeRevealSidebar className="dashboard-sidebar" isOpen={dashboardSidebarOpen} label="Main navigation" onMouseLeave={(event) => { if (event.clientX > 24) setDashboardSidebarOpen(false); }}>
        <a className="dashboard-brand" href="#" onClick={(event) => { event.preventDefault(); onBack(); }} aria-label="ANCHON home"><span className="dashboard-brand-mark"><AnchonLogo size={25} /></span><span><strong>ANCHON</strong><small>ARCHITECTURE STUDIO</small></span></a>
        <div className="dashboard-nav-label">WORKSPACE</div>
        <nav className="dashboard-nav">
          <button type="button" className="is-active" aria-current="page"><Layers3 size={17} /><span>Projects</span><span className="dashboard-nav-count">{projects.length}</span></button>
          <button type="button" onClick={() => window.open("https://github.com/raghul0610/breachx/blob/feat/anchon-assistant-floating-workspace/docs/system-design-learning-guide.md", "_blank", "noopener,noreferrer")}><BookOpen size={17} /><span>Learn</span></button>
          <button type="button" onClick={() => window.open("https://github.com/raghul0610/breachx/blob/feat/anchon-assistant-floating-workspace/docs/anchon-user-guide.md", "_blank", "noopener,noreferrer")}><Workflow size={17} /><span>Guide</span></button>
        </nav>
        <div className="dashboard-sidebar-spacer" />
        <div className="dashboard-nav dashboard-nav-bottom"><button type="button" onClick={() => openWorkspaceSection("settings")}><Settings size={17} /><span>Settings</span></button></div>
        <div className="dashboard-sidebar-footer"><span className="dashboard-status-dot" /> Private workspace</div>
      </EdgeRevealSidebar>
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
        {shareMessage && <div className="project-share-feedback" role="status">{shareMessage}<button type="button" onClick={() => setShareMessage("")} aria-label="Dismiss share message">×</button></div>}
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
              <article className="project-card panel" key={project.id} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); showProjectMenu(project, event.currentTarget); }} aria-label={`${project.applicationName}, right-click for project actions`}>
                <div className="project-card-heading">
                  <h2>{project.applicationName}</h2>
                  <div className="project-card-actions">
                    <button type="button" className="project-menu-trigger" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); if (contextMenu?.project.id === project.id) { setContextMenu(null); return; } const card = event.currentTarget.closest<HTMLElement>(".project-card"); if (card) showProjectMenu(project, card); }} aria-label={`Actions for ${project.applicationName}`} title="Project actions"><MoreVertical size={17} /></button>
                    <button type="button" className="project-play-button" onClick={() => open(project.id)} aria-label={`Open ${project.applicationName}`} title="Open project"><Play size={14} fill="currentColor" /></button>
                  </div>
                </div>
                <p className="project-last-opened">{formatLastOpened(project.id)}</p>
              </article>
            ))}
          </section>
        )}
        <p className="project-storage-note">Cloud persistence is enabled. If a save fails, the cloud-sync banner at the top will show the error.</p>
      </main>
      </div>
      {contextMenu && (
        <div className="project-context-menu" role="menu" aria-label={`Actions for ${contextMenu.project.applicationName}`} style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
          <div className="project-context-title">{contextMenu.project.applicationName}</div>
          <button type="button" role="menuitem" onClick={() => { const project = contextMenu.project; setContextMenu(null); rename(project); }}><Pencil size={13} /> Rename project</button>
          <button type="button" role="menuitem" onClick={() => void share(contextMenu.project)}><Share2 size={13} /> Share project</button>
          <button type="button" role="menuitem" className="project-context-delete" onClick={() => { const project = contextMenu.project; setContextMenu(null); remove(project); }}><Trash2 size={13} /> Delete project</button>
        </div>
      )}
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
