import { useCallback, useEffect, useState } from "react";
import { Github, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
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

type RepositoryResponse = {
  connected?: boolean;
  login?: string;
  repositories?: Repository[];
  error?: string;
};

export function GitHubConnection() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [login, setLogin] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
          <p>Authorize repository access so ANCHON can inspect your codebase in a future analysis step.</p>
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
        <span className="github-readonly-note">Read-only setup · No code changes are made</span>
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
              <a href={repo.html_url} target="_blank" rel="noreferrer" aria-label={"Open " + repo.full_name + " on GitHub"}><ExternalLink size={14} /></a>
            </article>
          ))}
        </div>
      ) : (
        <p className="github-muted">Connect your GitHub account to list repositories available to ANCHON. The GitHub App and Supabase functions must be configured first.</p>
      )}
    </section>
  );
}
