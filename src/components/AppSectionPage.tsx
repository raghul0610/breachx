import { BookOpen, Target } from "lucide-react";
import { AcademyPage } from "./AcademyPage";
import { WorkspaceGuide, WorkspaceSettings } from "./WorkspacePanels";

type Section = "learn" | "guide" | "settings";
export function AppSectionPage({section,onNavigate}:{section:Section;onNavigate:(section:"projects"|"learn"|"guide"|"settings")=>void}) {
 return <div className="app-shell project-dashboard app-section-shell">
  <aside className="dashboard-sidebar" aria-label="Main navigation">
   <button type="button" className="dashboard-brand" onClick={()=>onNavigate("projects")} aria-label="ANCHON projects"><span className="dashboard-brand-mark"><span>A</span></span><span><strong>ANCHON</strong><small>ARCHITECTURE STUDIO</small></span></button>
   <div className="dashboard-nav-label">WORKSPACE</div>
   <nav className="dashboard-nav">
    <button type="button" onClick={()=>onNavigate("projects")}><BookOpen size={17}/><span>Projects</span></button>
    <button type="button" className={section==="learn"?"is-active":""} onClick={()=>onNavigate("learn")}><Target size={17}/><span>Academy</span></button>
   </nav>
   <div className="dashboard-sidebar-spacer"/><div className="dashboard-sidebar-footer"><span className="dashboard-status-dot"/> Private workspace</div>
  </aside>
  <div className="dashboard-main app-section-main">
   <header className="topbar"><div><strong>ANCHON</strong><span className="topbar-sub"> // {section==="learn"?"ACADEMY":section==="guide"?"FIELD GUIDE":"SETTINGS"}</span></div><span className="status-pill">SYSTEM DESIGN PATH</span></header>
   <main className="project-dashboard-content app-section-content">
    {section==="learn"?<AcademyPage/>:section==="guide"?<WorkspaceGuide onOpenLibrary={()=>onNavigate("projects")} onOpenLearn={()=>onNavigate("learn")}/>:<WorkspaceSettings/>}
   </main>
  </div>
 </div>;
}
