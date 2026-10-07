import { useEffect, useState } from "react";
import { ArrowLeft, Activity, Eye, Pause, Play, RotateCcw, Shield, Square, Users, Layers } from "lucide-react";
import { readLogs, readStatus, readSubmission, readTeams, writeStatus, logActivity } from "../lib/storage";

export function AdminPage({onBack}:{onBack:()=>void}) {
  const [status,setStatus] = useState(readStatus());
  const [teams,setTeams] = useState(readTeams());
  const [logs,setLogs] = useState(readLogs());
  const [submission,setSubmission] = useState(readSubmission());
  useEffect(()=>{
    const sync=()=>{setStatus(readStatus());setTeams(readTeams());setLogs(readLogs());setSubmission(readSubmission());};
    window.addEventListener("breachx-sync",sync);
    window.addEventListener("storage",sync);
    return ()=>{window.removeEventListener("breachx-sync",sync);window.removeEventListener("storage",sync);};
  },[]);
  const transition=(next:typeof status)=>{
    writeStatus(next);
    logActivity(`EVENT_${next}`,{from:status,to:next});
    setStatus(next);
    setLogs(readLogs());
  };
  const reset=()=>{
    localStorage.removeItem("breachx-submission");
    writeStatus("DRAFT");
    logActivity("EVENT_RESET");
    setSubmission(null);setStatus("DRAFT");setLogs(readLogs());
  };
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="nav-btn" onClick={onBack}><ArrowLeft size={14}/> HOME</button>
        <div><strong>BREACH X</strong><span className="topbar-sub"> ADMIN // CONTROL CENTER</span></div>
        <span className="status-pill warning-pill">{status}</span>
      </header>
      <main className="admin-content">
        <section className="control-hero panel">
          <div><div className="section-kicker"><Shield size={13}/> ADMIN PRIVILEGES ACTIVE</div><h1>EVENT CONTROL CENTER</h1><p>Operate the event lifecycle, inspect team blueprints and monitor meaningful activity.</p></div>
          <div className="event-actions">
            <button onClick={()=>transition("READY")}>MARK READY</button>
            <button className="live-btn" onClick={()=>transition("LIVE")}><Play size={13}/> START EVENT</button>
            {status==="LIVE" && <button className="pause-btn" onClick={()=>transition("PAUSED")}><Pause size={13}/> PAUSE</button>}
            {status==="PAUSED" && <button className="live-btn" onClick={()=>transition("LIVE")}><Play size={13}/> RESUME</button>}
            {status!=="ENDED" && <button className="danger-outline" onClick={()=>transition("ENDED")}><Square size={13}/> END EVENT</button>}
            {status==="ENDED" && <button className="warning-outline" onClick={reset}><RotateCcw size={13}/> RESET</button>}
          </div>
        </section>
        <section className="stats-grid">
          <div className="stat panel"><span>EVENT STATUS</span><strong>{status}</strong></div>
          <div className="stat panel"><span>TEAMS</span><strong>{teams.length}</strong></div>
          <div className="stat panel"><span>BLUEPRINT</span><strong>{submission?.status?.toUpperCase() ?? "NONE"}</strong></div>
          <div className="stat panel"><span>GRAPH</span><strong>{submission ? `${submission.nodes.length}/${submission.edges.length}` : "—"}</strong></div>
        </section>
        <section className="admin-grid">
          <div className="panel section-block">
            <div className="section-kicker"><Users size={13}/> TEAM MONITOR</div>
            {teams.map(team=><div className="team-row" key={team.id}><div><strong>{team.name}</strong><small>Stage: {team.stage} · {team.status}</small></div><button className="icon-btn"><Eye size={13}/> INSPECT</button></div>)}
          </div>
          <div className="panel section-block">
            <div className="section-kicker"><Layers size={13}/> BLUEPRINT INSPECTION</div>
            {submission ? <><div className="inspect-summary"><span>{submission.teamName}</span><span>{submission.nodes.length} nodes · {submission.edges.length} edges</span><span>Status: {submission.status}</span></div><pre className="json-view">{JSON.stringify(submission,null,2)}</pre></> : <div className="empty-state">No participant blueprint has been submitted.</div>}
          </div>
        </section>
        <section className="panel section-block">
          <div className="section-kicker"><Activity size={13}/> LIVE ACTIVITY FEED</div>
          {logs.length ? logs.slice(0,25).map((log,i)=><div className="activity-row" key={`${log.createdAt}-${i}`}><strong>{log.action}</strong><span>{new Date(log.createdAt).toLocaleTimeString()}</span><small>{JSON.stringify(log.metadata)}</small></div>) : <div className="empty-state">No activity recorded yet.</div>}
        </section>
      </main>
    </div>
  );
}