import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Check, ChevronRight, Lock, Target, Trophy } from "lucide-react";
import { LearnPracticeCanvas } from "./LearnPracticeCanvas";

type AcademyLevel = {
  id: string;
  title: string;
  track: string;
  objective: string;
  briefing: string;
  concepts: string[];
  mission: string;
  success: string;
};
const levels: AcademyLevel[] = [
  { id:"foundations", title:"The request path", track:"01 · FOUNDATIONS", objective:"Build a working request path", briefing:"A user needs to create a record. Design the smallest architecture that can accept the request, validate it, and persist it.", concepts:["Client: initiates an HTTP request.","API service: validates input and applies application rules.","Database: stores the record and enforces data integrity."], mission:"Connect Client → API service → Database, in that order.", success:"You built a complete synchronous request path and identified the responsibility of each layer." },
  { id:"scaling", title:"The read bottleneck", track:"02 · PERFORMANCE", objective:"Reduce repeated database reads", briefing:"Traffic has grown and product pages are repeatedly reading the same data. Add a cache without bypassing the API boundary.", concepts:["Cache: stores frequently accessed data for faster reads.","API service: decides when cached data is valid.","Database: remains the durable source of truth."], mission:"Connect Client → API service → Cache → Database.", success:"You placed the cache at the read boundary while keeping the database as the source of truth." },
  { id:"resilience", title:"Background processing", track:"03 · RELIABILITY", objective:"Move slow work off the request", briefing:"A request triggers a slow report-generation task. Keep the API responsive by handing work to an asynchronous processor.", concepts:["Message queue: buffers work between services.","Worker: processes jobs independently of the request.","Database: stores the resulting report state."], mission:"Connect Client → API service → Message queue → Worker → Database.", success:"You separated request acceptance from background execution using an asynchronous boundary." },
];
const STORAGE_KEY = "anchon.academy.progress.v1";
function readProgress(): string[] {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); return Array.isArray(value) ? value.filter((id): id is string => levels.some(level => level.id === id)) : []; }
  catch { return []; }
}
export function AppSectionPage({section,onNavigate}:{section:"learn"|"guide"|"settings";onNavigate:(section:"projects"|"learn"|"guide"|"settings")=>void}) {
  const [completed,setCompleted] = useState<string[]>([]);
  const [active,setActive] = useState(0);
  useEffect(() => { setCompleted(readProgress()); }, []);
  const unlocked = Math.min(levels.length - 1, completed.length);
  const currentIndex = Math.min(active, unlocked);
  const current = levels[currentIndex];
  const progress = Math.round(completed.length / levels.length * 100);
  const completeLevel = () => {
    setCompleted(previous => {
      if (previous.includes(current.id)) return previous;
      const next = [...previous, current.id];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Progress remains available for this session. */ }
      return next;
    });
  };
  return <div className="app-shell project-dashboard app-section-shell">
    <aside className="dashboard-sidebar" aria-label="Main navigation">
      <button type="button" className="dashboard-brand" onClick={()=>onNavigate("projects")} aria-label="ANCHON projects"><span className="dashboard-brand-mark"><span> A </span></span><span><strong>ANCHON</strong><small>ARCHITECTURE STUDIO</small></span></button>
      <div className="dashboard-nav-label">WORKSPACE</div>
      <nav className="dashboard-nav">
        <button type="button" onClick={()=>onNavigate("projects")}><BookOpen size={17}/><span>Projects</span></button>
        <button type="button" className={section==="learn"?"is-active":""} onClick={()=>onNavigate("learn")}><Target size={17}/><span>Academy</span></button>
      </nav>
      <div className="dashboard-sidebar-spacer"/>
      <div className="dashboard-sidebar-footer"><span className="dashboard-status-dot"/> Private workspace</div>
    </aside>
    <div className="dashboard-main app-section-main">
      <header className="topbar"><div><strong>ANCHON</strong><span className="topbar-sub"> // ACADEMY</span></div><span className="status-pill">SYSTEM DESIGN PATH</span></header>
      <main className="project-dashboard-content app-section-content">
        {section==="learn" ? <div className="academy-page">
          <div className="academy-hero"><span className="academy-kicker">THE ANCHON ACADEMY</span><h1>Learn by <span>building systems.</span></h1><p>Three practical missions. Each one teaches an architectural decision you will use in real projects.</p>
            <div className="academy-progress"><div><span>YOUR PROGRESS</span><strong>{completed.length} / {levels.length} missions complete</strong></div><strong>{progress}%</strong><div className="academy-progress-track"><span style={{width:progress+"%"}}/></div></div>
          </div>
          <div className="academy-layout">
            <aside className="academy-level-list" aria-label="Learning missions">
              {levels.map((level,index)=>{const isDone=completed.includes(level.id);const isLocked=index>unlocked;return <button type="button" key={level.id} disabled={isLocked} className={index===currentIndex?"active":""} onClick={()=>setActive(index)}>
                <span className="academy-level-number">{isDone?<Check size={14}/>:isLocked?<Lock size={13}/>:String(index+1).padStart(2,"0")}</span>
                <span className="academy-level-copy"><small>{level.track}</small><strong>{level.title}</strong><em>{isDone?"COMPLETED":isLocked?"LOCKED":"MISSION"}</em></span><ChevronRight size={15}/>
              </button>})}
              <div className="academy-level-note"><Trophy size={15}/><span>Complete a mission to unlock the next architecture challenge.</span></div>
            </aside>
            <section className="academy-mission">
              <div className="academy-mission-top"><span>{current.track}</span><span>{completed.includes(current.id)?"COMPLETED":"ACTIVE MISSION"}</span></div>
              <h2>{current.objective}</h2><p className="academy-briefing">{current.briefing}</p>
              <div className="academy-concepts"><strong>COMPONENT ROLES</strong>{current.concepts.map(item=><div key={item}><span/><p>{item}</p></div>)}</div>
              <div className="academy-task"><Target size={17}/><div><strong>YOUR TASK</strong><p>{current.mission}</p></div></div>
              <LearnPracticeCanvas key={current.id} levelId={current.id} onComplete={completeLevel} completed={completed.includes(current.id)}/>
              {completed.includes(current.id)&&<div className="academy-success"><Check size={16}/><span>{current.success}</span></div>}
              {completed.includes(current.id)&&currentIndex<levels.length-1&&<button className="academy-next" type="button" onClick={()=>setActive(currentIndex+1)}>Continue to next mission <ArrowRight size={15}/></button>}
            </section>
          </div>
        </div> : <div className="academy-placeholder"><h1>{section==="guide"?"Workspace guide":"Settings"}</h1><p>Open this section from the workspace navigation.</p><button type="button" onClick={()=>onNavigate("projects")}>Back to projects</button></div>}
      </main>
    </div>
  </div>;
}
