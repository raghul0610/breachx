import { useCallback, useEffect, useState } from "react";
import { Github, ExternalLink, RefreshCw, ShieldCheck, ScanSearch, FolderTree, Workflow, ArrowRight } from "lucide-react";
import { createProject } from "../lib/storage";
import { supabase } from "../lib/supabase";
import "./GitHubConnection.css";

type Repository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  html_url: string;
  updated_at: string;
};

type Analysis = { repository: string; branch: string; commit: string; analyzedAt: string; summary: { files: number; directories: number; sizeBytes: number; manifests: number; truncated: boolean }; languages: { language: string; files: number }[]; topLevel: string[]; directories: string[]; keyFiles: { path: string; summary: string[] }[]; note: string };

type RepositoryResponse = {
  connected?: boolean;
  login?: string;
  repositories?: Repository[];
  error?: string;
};

export function GitHubConnection({ onOpenProject }: { onOpenProject: (projectId: string) => void }) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [login, setLogin] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [creatingArchitecture, setCreatingArchitecture] = useState(false);

  const loadRepositories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error("Sign in to ANCHON to connect GitHub.");
      const { data, error: invokeError } = await supabase.functions.invoke<RepositoryResponse>("github-repositories", {
        body: {},
      });
      if (invokeError) throw new Error(invokeError.message || "Could not load GitHub repositories.");
      if (data?.error) throw new Error(data.error);
      setConnected(Boolean(data?.connected));
      setLogin(data?.login ?? "");
      setRepositories(data?.repositories ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load GitHub repositories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("github");
    if (status === "connected") setNotice("GitHub connected. Your repository list is ready.");
    if (status === "error") setError("GitHub connection was not completed (" + (params.get("reason") ?? "unknown error").replace(/_/g, " ") + ").");
    if (status) {
      params.delete("github");
      params.delete("reason");
      const query = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (query ? "?" + query : "") + window.location.hash);
    }
    void loadRepositories();
  }, [loadRepositories]);

  const analyzeRepository = async (repository: Repository) => {
    setAnalyzing(repository.full_name);
    setError("");
    setAnalysis(null);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error("Sign in to ANCHON first.");
      const { data, error: invokeError } = await supabase.functions.invoke<Analysis & { error?: string }>("github-analyze-repository", {
        body: { repository: repository.full_name, branch: repository.default_branch },
      });
      if (invokeError) throw new Error(invokeError.message || "Could not analyse this repository.");
      if (!data || data.error) throw new Error(data?.error || "The repository analysis returned no result.");
      setAnalysis(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Repository analysis failed.");
    } finally {
      setAnalyzing(null);
    }
  };

  const createArchitectureDraft = () => {
    if (!analysis) return;
    setCreatingArchitecture(true);
    setError("");
    try {
      const allPaths = [...analysis.topLevel, ...analysis.directories, ...analysis.keyFiles.map(file => file.path)].join(" ").toLowerCase();
      const manifestText = analysis.keyFiles.map(file => file.path + " " + file.summary.join(" ")).join(" ").toLowerCase();
      const languages = new Set(analysis.languages.map(item => item.language.toLowerCase()));
      const hasFrontend = ["typescript", "javascript", "html", "vue", "svelte"].some(language => languages.has(language))
        || /vite|next\.js|react|angular|frontend|client|public\//.test(manifestText + " " + allPaths);
      const hasBackend = ["python", "go", "java", "c#", "ruby", "php", "rust"].some(language => languages.has(language))
        || /(^|[ /])(api|backend|server|services)([ /]|$)|fastapi|express|django|flask|spring boot/.test(manifestText + " " + allPaths);
      const hasDatabase = /(^|[ /])(migrations|database|db|schema)([ /]|$)|\.sql\b|postgres|mysql|sqlite|mongodb|prisma|drizzle|supabase/.test(manifestText + " " + allPaths);
      const hasAuth = /supabase|auth|authentication|identity|oauth|jwt/.test(manifestText + " " + allPaths);
      const hasAsync = /kafka|rabbitmq|celery|bullmq|queue|worker|event bus/.test(manifestText + " " + allPaths);
      const components: { id: string; label: string; typeKey: string; category: string; notes: string }[] = [];
      const add = (id: string, label: string, typeKey: string, category: string, notes: string) => {
        if (!components.some(item => item.id === id)) components.push({ id, label, typeKey, category, notes });
      };
      add("client", hasFrontend ? "Frontend / Client Application" : "Application Entry Point", "client", "Edge", hasFrontend ? "Inferred from web-language files and frontend manifests." : "Placeholder entry point; confirm this component manually.");
      if (hasBackend) add("backend", "Application / API Service", "app_server", "Compute", "Inferred from backend languages, directories, or framework manifests.");
      if (hasAsync) add("queue", "Async Worker / Queue", "queue", "Messaging", "Inferred from queue, worker, or messaging references.");
      if (hasAuth) add("auth", "Authentication / Identity", "auth_service", "Security", "Inferred from auth-related paths or dependencies; actual auth flows are unverified.");
      if (hasDatabase) add("database", "Database / Persistence", "database", "Data", "Inferred from migrations, SQL files, database dependencies, or persistence configuration.");
      if (!hasBackend && !hasDatabase) add("runtime", "Application Runtime", "app_server", "Compute", "Generic runtime placeholder; the repository scan did not establish a backend or database.");
      if (components.length === 1) add("external", "External Integration", "external_api", "External", "Placeholder integration; validate whether the application calls external services.");
      const gapX = 270, gapY = 170, cols = Math.min(3, components.length);
      const nodes = components.map((component, index) => ({
        id: "codebase-" + component.id,
        type: "blueprintNode",
        position: { x: (index % cols) * gapX + 80, y: Math.floor(index / cols) * gapY + 100 },
        data: { label: component.label, typeKey: component.typeKey, category: component.category, notes: component.notes },
      }));
      const edges = components.slice(0, -1).map((component, index) => ({
        id: "codebase-edge-" + component.id + "-" + components[index + 1].id,
        source: "codebase-" + component.id,
        target: "codebase-" + components[index + 1].id,
        label: "inferred",
        animated: false,
        markerEnd: { type: "arrowclosed" },
      }));
      const project = createProject({
        applicationName: analysis.repository + " — Architecture Draft",
        applicationDescription: "Generated from a read-only scan of " + analysis.repository + " at " + analysis.commit.slice(0, 7) + ". This is a hypothesis based on languages, paths, and manifests, not a verified runtime architecture.",
        nodes,
        edges,
        notes: "Generated by ANCHON Codebase Analysis. Source repository: " + analysis.repository + "\nBranch: " + analysis.branch + "\nCommit: " + analysis.commit + "\nAnalyzed: " + analysis.analyzedAt + "\n\nIMPORTANT: Components and connections are inferred from static file structure and dependency manifests. Validate every node and edge against source code, deployment configuration, and runtime traces before treating this as accurate. Connections labelled 'inferred' are draft hypotheses, not observed data flows.",
        status: "draft",
      });
      onOpenProject(project.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create an architecture draft.");
    } finally {
      setCreatingArchitecture(false);
    }
  };

  const connect = async () => {
    setConnecting(true);
    setError("");
    setNotice("");
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error("Sign in to ANCHON first.");
      const { data, error: invokeError } = await supabase.functions.invoke<{ url?: string; error?: string }>("github-connect-start", { body: {} });
      if (invokeError) throw new Error(invokeError.message || "Could not start GitHub authorization.");
      if (!data?.url) throw new Error(data?.error || "GitHub authorization URL was not returned.");
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect GitHub.");
      setConnecting(false);
    }
  };

  return (
    <section className="github-connection panel" aria-labelledby="github-connection-title">
      <div className="github-connection-heading">
        <div className="github-connection-icon"><Github size={20} /></div>
        <div className="github-connection-title">
          <div className="section-kicker"><ShieldCheck size={13} /> REPOSITORY INTEGRATION</div>
          <h2 id="github-connection-title">Connect GitHub</h2>
          <p>Connect a repository to inspect its structure, languages, and dependency manifests without executing its code.</p>
        </div>
        {connected && <span className="github-connected-pill">CONNECTED · @{login}</span>}
      </div>

      {notice && <p className="github-notice" role="status">{notice}</p>}
      {error && <p className="github-error" role="alert">{error}</p>}

      <div className="github-connection-actions">
        <button className="primary-btn" onClick={() => void connect()} disabled={connecting}>
          <Github size={14} /> {connecting ? "CONNECTING…" : connected ? "RECONNECT GITHUB" : "CONNECT GITHUB"}
        </button>
        {connected && <button className="github-refresh-btn" onClick={() => void loadRepositories()} disabled={loading}><RefreshCw size={13} /> REFRESH</button>}
        <span className="github-readonly-note">Read-only scan · Does not execute or modify code</span>
      </div>

      {loading ? <p className="github-muted">Checking GitHub connection…</p> : connected ? (
        <div className="github-repository-list">
          <div className="github-repository-list-heading">{repositories.length} REPOSITORIES · FIRST 100</div>
          {repositories.length === 0 ? <p className="github-muted">No repositories are available to this GitHub authorization.</p> : repositories.map((repo) => (
            <article className="github-repository" key={repo.id}>
              <div className="github-repository-main">
                <strong>{repo.full_name}</strong>
                <span>{repo.private ? "PRIVATE" : "PUBLIC"} · {repo.default_branch}</span>
                {repo.description && <p>{repo.description}</p>}
              </div>
              <div className="github-repository-actions"><button className="github-analyze-btn" onClick={() => void analyzeRepository(repo)} disabled={analyzing !== null}>{analyzing === repo.full_name ? <RefreshCw size={13} /> : <ScanSearch size={13} />}{analyzing === repo.full_name ? "SCANNING…" : "ANALYZE"}</button><a href={repo.html_url} target="_blank" rel="noreferrer" aria-label={"Open " + repo.full_name + " on GitHub"}><ExternalLink size={14} /></a></div>
            </article>
          ))}
        </div>
      ) : (
        <p className="github-muted">Connect your GitHub account to list repositories available to ANCHON. The GitHub App and Supabase functions must be configured first.</p>
      )}
      {analysis && (
        <section className="github-analysis" aria-live="polite">
          <div className="github-analysis-heading"><div><div className="github-repository-list-heading"><FolderTree size={12} /> CODEBASE ANALYSIS</div><h3>{analysis.repository}</h3><p>{analysis.branch} · {analysis.commit.slice(0, 7)} · {new Date(analysis.analyzedAt).toLocaleString()}</p></div><button className="github-refresh-btn" onClick={() => setAnalysis(null)}>CLEAR</button></div>
          <div className="github-analysis-stats"><div><strong>{analysis.summary.files.toLocaleString()}</strong><span>FILES</span></div><div><strong>{analysis.summary.directories.toLocaleString()}</strong><span>DIRECTORIES</span></div><div><strong>{analysis.summary.manifests}</strong><span>MANIFESTS</span></div><div><strong>{(analysis.summary.sizeBytes / 1024 / 1024).toFixed(1)} MB</strong><span>TRACKED SIZE</span></div></div>
          <h4>Languages</h4><div className="github-language-list">{analysis.languages.slice(0, 8).map(item => <span key={item.language}>{item.language}<b>{item.files}</b></span>)}</div>
          <h4>Top-level paths</h4><div className="github-path-list">{analysis.topLevel.map(path => <code key={path}>{path}</code>)}</div>
          <h4>Dependency and project manifests</h4>
          {analysis.keyFiles.length === 0 ? <p className="github-muted">No supported manifest files were found.</p> : analysis.keyFiles.map(file => <details className="github-manifest" key={file.path}><summary>{file.path}</summary><ul>{file.summary.map((line,index)=><li key={index}>{line}</li>)}</ul></details>)}
          <p className="github-readonly-note">{analysis.note}</p>
          <div className="github-create-architecture"><div><strong>Generate architecture draft</strong><p>Creates an editable ANCHON project with inferred components and labelled draft connections.</p></div><button className="primary-btn" onClick={createArchitectureDraft} disabled={creatingArchitecture}>{creatingArchitecture ? <RefreshCw size={13} /> : <Workflow size={13} />}{creatingArchitecture ? "CREATING…" : "CREATE DRAFT"}<ArrowRight size={13} /></button></div>
          <p className="github-readonly-note">This draft is a starting hypothesis, not a verified architecture. Review it in the canvas before relying on it.</p>
        </section>
      )}
    </section>
  );
}
