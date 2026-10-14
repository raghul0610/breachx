import { useState } from "react";
import { LandingPage } from "./pages/LandingPage";
import { ParticipantPage } from "./pages/ParticipantPage";
import { ProjectDashboard } from "./components/ProjectDashboard";
import { AuthGate } from "./components/AuthGate";

type AppMode = "home" | "projects" | "participant";

function AppContent() {
  const [mode, setMode] = useState<AppMode>("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  if (mode === "projects") {
    return (
      <ProjectDashboard
        onBack={() => setMode("home")}
        onOpenProject={(projectId) => {
          setSelectedProjectId(projectId);
          setMode("participant");
        }}
      />
    );
  }

  if (mode === "participant" && selectedProjectId) {
    return (
      <ParticipantPage
        projectId={selectedProjectId}
        onBack={() => setMode("projects")}
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
  const [authRequested, setAuthRequested] = useState(false);

  if (!authRequested) {
    return (
      <LandingPage
        onOpenDesigner={() => setAuthRequested(true)}
      />
    );
  }

  return <AuthGate><AppContent /></AuthGate>;
}
