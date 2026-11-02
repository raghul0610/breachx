import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { LandingPage } from "./pages/LandingPage";
import { ParticipantPage } from "./pages/ParticipantPage";
import { ProjectDashboard } from "./components/ProjectDashboard";
import { AuthGate } from "./components/AuthGate";
import { AppSectionPage } from "./components/AppSectionPage";

type AppMode = "home" | "projects" | "participant" | "learn" | "guide" | "settings";
type WorkspaceSection = "canvas" | "learn" | "guide" | "settings";

function AppContent() {
  const [mode, setMode] = useState<AppMode>("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [initialWorkspaceSection, setInitialWorkspaceSection] = useState<WorkspaceSection>("canvas");

  if (mode === "projects") {
    return (
      <ProjectDashboard
        onBack={() => setMode("home")}
        onOpenProject={(projectId) => {
          setSelectedProjectId(projectId);
          setInitialWorkspaceSection("canvas");
          setMode("participant");
        }}
        onOpenWorkspaceSection={(section) => setMode(section)}
      />
    );
  }

  if (mode === "learn" || mode === "guide" || mode === "settings") {
    return <AppSectionPage section={mode} onNavigate={(section) => setMode(section)} />;
  }

  if (mode === "participant" && selectedProjectId) {
    return (
      <ParticipantPage
        projectId={selectedProjectId}
        initialSection={initialWorkspaceSection}
        onBack={() => setMode("projects")}
        onOpenSettings={() => setMode("settings")}
        onSubmitted={() => setMode("projects")}
      />
    );
  }


  return (
    <LandingPage
      onOpenDesigner={() => setMode("projects")}
    />
  );
}


export default function App() {
  const [authRequested, setAuthRequested] = useState(() => new URLSearchParams(window.location.search).has("share"));
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setAuthRequested(true);
      setSessionChecked(true);
    }).catch(() => {
      if (active) setSessionChecked(true);
    });
    return () => { active = false; };
  }, []);

  if (!sessionChecked) {
    return <div className="auth-loading">Restoring your session…</div>;
  }

  if (!authRequested) {
    return (
      <LandingPage
        onOpenDesigner={() => setAuthRequested(true)}
      />
    );
  }

  return <AuthGate><AppContent /></AuthGate>;
}
