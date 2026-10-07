import { useState } from "react";
import { AdminPage } from "./pages/AdminPage";
import { ParticipantPage } from "./pages/ParticipantPage";
export default function App() {
  const [mode, setMode] = useState<"home"|"admin"|"participant">("home");
  if (mode === "admin") return <AdminPage onBack={()=>setMode("home")} />;
  if (mode === "participant") return <ParticipantPage onBack={()=>setMode("home")} />;
  return (
    <main className="home">
      <div className="home-card">
        <div className="eyebrow">BREACH X // EVENT ARENA</div>
        <h1>Design the system.<br/>Build for the breach.</h1>
        <p>Prototype control plane with the BlackBox Blueprint interaction model. Authentication is intentionally disabled.</p>
        <div className="home-actions">
          <button className="primary-btn" onClick={()=>setMode("participant")}>PARTICIPANT</button>
          <button className="outline-btn" onClick={()=>setMode("admin")}>ADMIN</button>
        </div>
        <div className="tiny">Two entry points for now. Authentication will be added later.</div>
      </div>
    </main>
  );
}