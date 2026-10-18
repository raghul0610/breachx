import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { Workflow } from "lucide-react";
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
        <div className="auth-brand-mark"><Workflow size={19} /></div>
        <div className="auth-kicker">PRIVATE ARCHITECTURE WORKSPACE</div>
        <h1>ANCHON<span>.</span></h1>
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
        <button className="auth-google" onClick={() => void googleSignIn()} disabled={busy}>
          <svg className="auth-google-mark" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 3.05 13.22l7.98 6.19C12.93 13.72 18.02 9.5 24 9.5Z" transform="translate(0 4)"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 37.96 46.98 31.84 46.98 24.55Z"/><path fill="#FBBC05" d="M10.03 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 4)"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.18 2.3-5.98 0-11.07-4.22-12.97-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -2)"/></svg><span>Continue with Google</span>
        </button>
        {message && <p className="auth-message" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <p className="auth-footnote">Email confirmation and Google sign-in require the corresponding Supabase Auth providers and redirect URLs to be configured.</p>
      </section>
    </main>
  );
}
