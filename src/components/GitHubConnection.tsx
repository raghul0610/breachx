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

type Analysis = { repository: string; branch: string; commit: string; analyzedAt: string; summary: { files: number; directories: number; sizeBytes: number; manifests: number; truncated: boolean }; languages: { language: string; files: number }[]; topLevel: string[]; directories: string[]; keyFiles: { path: string; summary: string[] }[]; sourceEvidence?: { path: string; imports: string[]; indicators: string[] }[]; sourceConnections?: { source: string; target: string; label: string; evidence: string[] }[]; sourceScan?: { sampledFiles: number; candidateFiles: number; capped: boolean }; note: string };

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
  const [requirements, setRequirements] = useState("");
  const [reviewFindings, setReviewFindings] = useState<{ severity: "high" | "medium" | "info"; title: string; reason: string; recommendation: string }[]>([]);

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
      const sourceEvidence = analysis.sourceEvidence ?? [];
      const sourceConnections = analysis.sourceConnections ?? [];
      const hasFrontend = /react|vite|next|angular|frontend|client|web app/.test(manifestText + " " + allPaths);
      const hasBackend = /(^|[ /])(api|backend|server|services)([ /]|$)|fastapi|express|django|flask|spring boot/.test(manifestText + " " + allPaths) || sourceEvidence.some(file => file.indicators.includes("http-route"));
      const hasDatabase = /migrations|database|schema|\.sql\b|postgres|mysql|sqlite|mongodb|prisma|drizzle|supabase/.test(manifestText + " " + allPaths) || sourceEvidence.some(file => file.indicators.includes("data-access"));
      const hasAuth = /supabase|auth|authentication|identity|oauth|jwt/.test(manifestText + " " + allPaths) || sourceEvidence.some(file => file.indicators.includes("authentication"));
      const hasAsync = /kafka|rabbitmq|celery|bullmq|queue|worker|event bus/.test(manifestText + " " + allPaths) || sourceEvidence.some(file => file.indicators.includes("async-messaging"));
      const components: { id: string; label: string; typeKey: string; category: string; notes: string; path?: string }[] = [];
      const add = (id: string, label: string, typeKey: string, category: string, notes: string, path?: string) => {
        if (!components.some(item => item.id === id)) components.push({ id, label, typeKey, category, notes, path });
      };
      const sourcePaths = new Set(sourceEvidence.map(file => file.path));
      const moduleForPath = (path: string) => {
        const parts = path.split("/");
        if (parts.length <= 2) return parts[0];
        if (/^(src|app|server|services|packages|apps)$/i.test(parts[0])) return parts.slice(0, 2).join("/");
        return parts.slice(0, 2).join("/");
      };
      const modulePaths = [...new Set([...sourcePaths].map(moduleForPath))].slice(0, 12);
      for (const [index, path] of modulePaths.entries()) {
        const files = sourceEvidence.filter(file => moduleForPath(file.path) === path);
        const indicators = [...new Set(files.flatMap(file => file.indicators))];
        add("module-" + index, path, "app_server", "Application", "Source module inferred from " + files.length + " inspected file(s). Indicators: " + (indicators.join(", ") || "none recognized") + ". Evidence: " + files.slice(0, 4).map(file => file.path).join(", "), path);
      }
      const useModuleGraph = modulePaths.length > 0;
      if (!useModuleGraph) {
        add("client", hasFrontend ? "Frontend / Client Application" : "Application Entry Point", "client", "Edge", "Inferred from repository manifests and paths; source-level module evidence was unavailable.");
        if (hasBackend) add("backend", "Application / API Service", "app_server", "Compute", "Inferred from repository paths, manifests, and route indicators.");
      }
      if (hasAuth) add("auth", "Authentication / Identity", "auth_service", "Security", "Authentication markers found in source or manifests; exact flow requires verification.");
      if (hasDatabase) add("database", "Database / Persistence", "database", "Data", "Data-access markers or persistence dependencies found; exact database boundary requires verification.");
      if (hasAsync) add("queue", "Async Worker / Queue", "queue", "Messaging", "Async messaging markers found in source or manifests.");
      if (!components.length) add("runtime", "Application Runtime", "app_server", "Compute", "Fallback because no source modules were identified.");
      const nodes = components.map((component, index) => ({
        id: "codebase-" + component.id, type: "blueprintNode",
        position: { x: (index % 3) * 310 + 80, y: Math.floor(index / 3) * 210 + 100 },
        data: { label: component.label, typeKey: component.typeKey, category: component.category, notes: component.notes },
      }));
      const componentByModule = new Map(components.filter(component => component.path).map(component => [component.path!, component.id]));
      const relationships: { source: string; target: string; label: string }[] = [];
      for (const connection of sourceConnections) {
        const source = componentByModule.get(moduleForPath(connection.source));
        const target = componentByModule.get(moduleForPath(connection.target));
        if (source && target && source !== target && !relationships.some(edge => edge.source === source && edge.target === target)) relationships.push({ source, target, label: "imports · source evidence" });
      }
      const addBoundaryLink = (source: string, target: string, label: string) => {
        if (components.some(item => item.id === source) && components.some(item => item.id === target) && !relationships.some(edge => edge.source === source && edge.target === target)) relationships.push({ source, target, label });
      };
      if (!useModuleGraph) addBoundaryLink("client", "backend", "API boundary · inferred");
      const primary = components.find(component => component.path && /api|server|backend|routes|controllers/i.test(component.path)) ?? components.find(component => component.path);
      if (primary && hasAuth) addBoundaryLink(primary.id, "auth", "auth dependency · inferred");
      if (primary && hasDatabase) addBoundaryLink(primary.id, "database", "data access · inferred");
      if (primary && hasAsync) addBoundaryLink(primary.id, "queue", "async work · inferred");
      const edges = relationships.map((relationship, index) => ({
        id: "codebase-edge-" + index + "-" + relationship.source + "-" + relationship.target,
        source: "codebase-" + relationship.source, target: "codebase-" + relationship.target,
        label: relationship.label, animated: false, markerEnd: { type: "arrowclosed" },
      }));
      const project = createProject({
        applicationName: analysis.repository + " — Architecture Draft",
        applicationDescription: "Repository: " + analysis.repository + ". Static source reconstruction at commit " + analysis.commit.slice(0, 7) + ". User requirements: " + (requirements.trim() || "Not supplied.") + ". Source relationships are evidence-informed and still require runtime validation.",
        nodes,
        edges,
        notes: "Generated by ANCHON Codebase Analysis. Source repository: " + analysis.repository + "\nSource files inspected: " + (analysis.sourceScan?.sampledFiles ?? 0) + "\nResolved source imports: " + sourceConnections.length + "\nBranch: " + analysis.branch + "\nCommit: " + analysis.commit + "\nAnalyzed: " + analysis.analyzedAt + "\n\nUser requirements:\n" + (requirements.trim() || "Not supplied.") + "\n\nReview findings are heuristic and must be verified. Components and connections are inferred from repository metadata and manifest evidence; they are not verified runtime data flows.",
        status: "draft",
      });
      onOpenProject(project.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create an architecture draft.");
    } finally {
      setCreatingArchitecture(false);
    }
  };

  const reviewArchitecture = () => {
    const corpus = [...(analysis?.topLevel ?? []), ...(analysis?.directories ?? []), ...(analysis?.keyFiles ?? []).flatMap(file => [file.path, ...file.summary]), ...(analysis?.sourceEvidence ?? []).flatMap(file => [file.path, ...file.imports, ...file.indicators])].join(" ").toLowerCase();
    const reqs = requirements.toLowerCase();
    const findings: { severity: "high" | "medium" | "info"; title: string; reason: string; recommendation: string }[] = [];
    if (!/test|spec|jest|vitest|pytest|playwright|cypress/.test(corpus)) findings.push({ severity: "medium", title: "Automated test coverage not evident", reason: "The scan did not expose recognizable test tooling or test directories. This is not proof that tests do not exist.", recommendation: "Add or identify unit, integration, and end-to-end tests for critical flows." });
    if (!/dockerfile|docker-compose|terraform|pulumi|\.github\/workflows/.test(corpus)) findings.push({ severity: "info", title: "Deployment configuration not established", reason: "The scan did not find common container, infrastructure-as-code, or CI configuration markers.", recommendation: "Document deployment topology and add reproducible CI/deployment configuration where applicable." });
    if (/scale|high traffic|millions|availability|high availability|resilien|fault toleran/.test(reqs) && !/cache|redis|memcached|rate.?limit|autoscal|replica|load.?balanc|queue|kafka/.test(corpus)) findings.push({ severity: "medium", title: "Scalability requirement needs evidence", reason: "Your requirements mention scale or availability, but common scaling or resilience mechanisms were not found in the scanned metadata.", recommendation: "Confirm expected load and consider caching, rate limiting, horizontal scaling, queues, or redundancy." });
    if (/secure|security|encryption|privacy|compliance|sensitive|authentication|authorization/.test(reqs) && !/auth|oauth|jwt|rbac|permission|encrypt|kms|security/.test(corpus)) findings.push({ severity: "high", title: "Security requirement not evidenced", reason: "Security-related requirements were supplied, but recognizable auth, authorization, or encryption markers were not found in scanned paths/manifests.", recommendation: "Verify authentication, server-side authorization, secrets handling, encryption, and audit requirements." });
    if (/database|persist|durable|storage|save data/.test(reqs) && !/database|\.sql|prisma|drizzle|supabase|postgres|mysql|mongo|sqlite|dynamo/.test(corpus)) findings.push({ severity: "medium", title: "Persistence requirement may be unmet", reason: "The requirements mention durable data, but the scan did not identify a common persistence technology.", recommendation: "Identify the system of record, data model, backup/restore strategy, and ownership boundaries." });
    if (findings.length === 0) findings.push({ severity: "info", title: "No obvious metadata-level mismatch detected", reason: "The limited checks did not trigger. This does not mean the architecture is correct or secure.", recommendation: "Validate critical paths against implementation, deployment configuration, and runtime evidence." });
    setReviewFindings(findings);
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
          <h4>Source-level scan</h4><p className="github-muted">{analysis.sourceScan ? `Inspected ${analysis.sourceScan.sampledFiles} source files out of ${analysis.sourceScan.candidateFiles} eligible files${analysis.sourceScan.capped ? " (sample capped)" : ""}; resolved ${analysis.sourceConnections?.length ?? 0} internal imports. Connections are based on static import evidence, not observed runtime traffic.` : "This analysis result predates source-level import scanning. Re-run analysis to inspect module imports."}</p><h4>Languages</h4><div className="github-language-list">{analysis.languages.slice(0, 8).map(item => <span key={item.language}>{item.language}<b>{item.files}</b></span>)}</div>
          <h4>Top-level paths</h4><div className="github-path-list">{analysis.topLevel.map(path => <code key={path}>{path}</code>)}</div>
          <h4>Dependency and project manifests</h4>
          {analysis.keyFiles.length === 0 ? <p className="github-muted">No supported manifest files were found.</p> : analysis.keyFiles.map(file => <details className="github-manifest" key={file.path}><summary>{file.path}</summary><ul>{file.summary.map((line,index)=><li key={index}>{line}</li>)}</ul></details>)}
          <p className="github-readonly-note">{analysis.note}</p>
          <section className="github-requirements-review">
            <label htmlFor="github-requirements">FUNCTIONAL & NON-FUNCTIONAL REQUIREMENTS</label>
            <textarea id="github-requirements" value={requirements} onChange={event => setRequirements(event.target.value)} rows={4} placeholder="Example: 10,000 concurrent users; role-based access; 99.9% availability; encrypted personal data; audit logs." />
            <div className="github-review-actions"><button className="github-refresh-btn" onClick={reviewArchitecture}>REVIEW REQUIREMENTS</button><span className="github-readonly-note">Metadata-based checks only; not a security audit.</span></div>
            {reviewFindings.length > 0 && <div className="github-review-findings" aria-live="polite"><h4>Review findings</h4>{reviewFindings.map(finding => <article className={"github-review-finding is-" + finding.severity} key={finding.title}><strong>{finding.severity.toUpperCase()} · {finding.title}</strong><p>{finding.reason}</p><p><b>Recommended action:</b> {finding.recommendation}</p></article>)}</div>}
          </section>
          <div className="github-create-architecture"><div><strong>Generate architecture draft</strong><p>Creates an editable ANCHON project with evidence-informed components and plausible, explicitly inferred connections.</p></div><button className="primary-btn" onClick={createArchitectureDraft} disabled={creatingArchitecture}>{creatingArchitecture ? <RefreshCw size={13} /> : <Workflow size={13} />}{creatingArchitecture ? "CREATING…" : "CREATE DRAFT"}<ArrowRight size={13} /></button></div>
          <p className="github-readonly-note">This draft is a starting hypothesis, not a verified architecture. Review it in the canvas before relying on it.</p>
        </section>
      )}
    </section>
  );
}
