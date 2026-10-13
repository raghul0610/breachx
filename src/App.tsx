import { useState } from "react";
import { LandingPage } from "./pages/LandingPage";
import { ParticipantPage } from "./pages/ParticipantPage";
import { ArchitectureGeneratorPage } from "./pages/ArchitectureGeneratorPage";
import { ProjectDashboard } from "./components/ProjectDashboard";
import { AuthGate } from "./components/AuthGate";

type AppMode = "home" | "projects" | "participant" | "generator";

function AppContent() {
  const [mode, setMode] = useState<AppMode>("home");
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
        onSubmitted={() => setMode("generator")}
      />
    );
  }

  if (mode === "generator") {
    return (
      <ArchitectureGeneratorPage
        onBack={() => setMode("projects")}
        onEdit={(projectId) => { setSelectedProjectId(projectId); setMode("participant"); }}
      />
    );
  }

  return (
    <LandingPage
      onOpenDesigner={() => setMode("projects")}
      onOpenGenerator={() => setMode("generator")}
    />
  );
}


export default function App() {
  const [authRequested, setAuthRequested] = useState(false);

  if (!authRequested) {
    return (
      <LandingPage
        onOpenDesigner={() => setAuthRequested(true)}
        onOpenGenerator={() => setAuthRequested(true)}
      />
    );
  }

  return <AuthGate><AppContent /></AuthGate>;
}
