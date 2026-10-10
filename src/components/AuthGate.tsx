import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { listProjects, mergeProjectsFromCloud, replaceProjectsFromCloud } from "../lib/storage";
import { listOwnedProjects, saveOwnedProjects } from "../lib/projectsRepository";
import "./AuthGate.css";

const OWNER_KEY = "anchon-cloud-owner-v1";

type AuthMode = "sign-in" | "sign-up" | "reset";

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [projectsReady, setProjectsReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setAuthError(error.message);
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthError("");
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setProjectsReady(false);
    setSyncError("");
    if (!session?.user) {
      setProjectsReady(false);
      return;
    }

    const userId = session.user.id;
    (async () => {
      try {
        const remoteProjects = await listOwnedProjects();
        if (!alive) return;
        const previousOwner = localStorage.getItem(OWNER_KEY);
        if (previousOwner && previousOwner !== userId) {
          replaceProjectsFromCloud(remoteProjects);
        } else {
          mergeProjectsFromCloud(remoteProjects);
        }
        localStorage.setItem(OWNER_KEY, userId);
        // Migrate anonymous local-first projects and reconcile local cache with the cloud.
        await saveOwnedProjects(listProjects());
        if (!alive) return;
        setProjectsReady(true);
      } catch (cause) {
        if (!alive) return;
        setSyncError(cause instanceof Error ? cause.message : "Could not load cloud projects.");
      }
    })();

    return () => { alive = false; };
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user || !projectsReady) return;
    let timeout: number | undefined;
    let inFlight = Promise.resolve();
    const sync = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        setSyncing(true);
        inFlight = inFlight
          .then(() => saveOwnedProjects(listProjects()))
          .then(() => setSyncError(""))
          .catch((cause: unknown) => {
            setSyncError(cause instanceof Error ? cause.message : "Cloud save failed.");
          })
          .finally(() => setSyncing(false));
      }, 500);
    };
    window.addEventListener("anchon-projects-changed", sync);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("anchon-projects-changed", sync);
    };
  }, [session?.user.id, projectsReady]);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(error.message);
  };

  if (!authReady) return <div className="auth-loading">Checking session…</div>;
  if (!session?.user) {
    return <AuthScreen error={authError} onError={setAuthError} />;
  }
  if (!projectsReady) {
    return (
      <div className="auth-loading">
        <p>Loading your private projects…</p>
        {syncError && <p className="auth-error" role="alert">{syncError}</p>}
        {syncError && <button className="auth-secondary" onClick={() => void signOut()}>SIGN OUT</button>}
      </div>
    );
  }

  return (
    <>
      {syncError && <div className="auth-sync-banner" role="status">Cloud sync needs attention: {syncError}</div>}
      <div className="auth-account-bar">
        <span>{session.user.email ?? "Signed in"} · {syncing ? "SYNCING…" : "CLOUD SYNC"}</span>
        <button onClick={() => void signOut()}>SIGN OUT</button>
      </div>
      {children}
    </>
  );
}

function AuthScreen({ error, onError }: { error: string; onError: (message: string) => void }) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    onError("");
    try {
      if (mode === "sign-up") {
        const { data, error: requestError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (requestError) throw requestError;
        if (!data.session) setMessage("Account created. Check your email to confirm the address, then sign in.");
        else setMessage("Account created.");
      } else if (mode === "reset") {
        const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (requestError) throw requestError;
        setMessage("If an account exists for this email, a password-reset link will be sent.");
      } else {
        const { error: requestError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (requestError) throw requestError;
      }
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    setBusy(true);
    onError("");
    try {
      const { error: requestError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (requestError) throw requestError;
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Google sign-in failed.");
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-kicker">PRIVATE ARCHITECTURE WORKSPACE</div>
        <h1>ANCHON</h1>
        <p className="auth-intro">Sign in to access your projects across devices.</p>
        <div className="auth-tabs">
          <button className={mode === "sign-in" ? "active" : ""} onClick={() => { setMode("sign-in"); setMessage(""); }}>SIGN IN</button>
          <button className={mode === "sign-up" ? "active" : ""} onClick={() => { setMode("sign-up"); setMessage(""); }}>CREATE ACCOUNT</button>
        </div>
        <form onSubmit={(event) => void submit(event)}>
          <label htmlFor="auth-email">EMAIL</label>
          <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          {mode !== "reset" && <>
            <label htmlFor="auth-password">PASSWORD</label>
            <input id="auth-password" type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
          </>}
          <button className="auth-primary" type="submit" disabled={busy}>{busy ? "PLEASE WAIT…" : mode === "sign-up" ? "CREATE ACCOUNT" : mode === "reset" ? "SEND RESET LINK" : "SIGN IN"}</button>
        </form>
        {mode === "sign-in" && <button className="auth-link" onClick={() => { setMode("reset"); setMessage(""); }}>Forgot password?</button>}
        {mode === "reset" && <button className="auth-link" onClick={() => { setMode("sign-in"); setMessage(""); }}>Back to sign in</button>}
        <div className="auth-divider"><span>OR</span></div>
        <button className="auth-google" onClick={() => void googleSignIn()} disabled={busy}>CONTINUE WITH GOOGLE</button>
        {message && <p className="auth-message" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <p className="auth-footnote">Email confirmation and Google sign-in require the corresponding Supabase Auth providers and redirect URLs to be configured.</p>
      </section>
    </main>
  );
}
