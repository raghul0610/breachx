import {useState} from "react";
import {ParticipantPage} from "./pages/ParticipantPage";
import {EvaluationReportPage} from "./pages/EvaluationReportPage";
export default function App(){
 const [mode,setMode]=useState<"home"|"participant"|"report">("home");
 if(mode==="participant")return <ParticipantPage onBack={()=>setMode("home")} onEvaluated={()=>setMode("report")}/>;
 if(mode==="report")return <EvaluationReportPage onBack={()=>setMode("participant")}/>;
 return <main className="home"><div className="home-card"><div className="eyebrow">SYSTEM DESIGN // EVALUATION PLATFORM</div><h1>Design the system.<br/>Get it evaluated.</h1><p>Build an architecture, submit it, and receive a structured engineering evaluation.</p><div className="home-actions"><button className="primary-btn" onClick={()=>setMode("participant")}>START DESIGN</button><button className="outline-btn" onClick={()=>setMode("report")}>VIEW LAST REPORT</button></div><div className="tiny">No admin or manual judging required.</div></div></main>;
}
