import { useState } from "react";
import { ArrowRight, Download, Workflow, BrainCircuit } from "lucide-react";
import { ParticipantPage } from "./pages/ParticipantPage";
import { ArchitectureGeneratorPage } from "./pages/ArchitectureGeneratorPage";
export default function App(){
 const [mode,setMode]=useState<"home"|"participant"|"generator">("home");
 if(mode==="participant")return <ParticipantPage onBack={()=>setMode("home")} onSubmitted={()=>setMode("generator")}/>;
 if(mode==="generator")return <ArchitectureGeneratorPage onBack={()=>setMode("home")} onEdit={()=>setMode("participant")}/>;
 return <main className="home"><div className="home-card"><div className="eyebrow">SYSTEM DESIGN // BREACH X</div><h1>Design your system.<br/>Make it yours.</h1><p>Build an architecture from components or generate a suggested blueprint from your application requirements. Edit the design and export a shareable PDF.</p><div className="feature-cards"><button className="feature-card" onClick={()=>setMode("participant")}><Workflow size={22}/><strong>Architecture Designer</strong><span>Drag, connect, customize and export your architecture as a PDF.</span><em>START DESIGN <ArrowRight size={13}/></em></button><button className="feature-card" onClick={()=>setMode("generator")}><BrainCircuit size={22}/><strong>AI Architecture Generator</strong><span>Describe your application and generate a connected architecture proposal.</span><em>GENERATE BLUEPRINT <ArrowRight size={13}/></em></button></div><div className="tiny"><Download size={12}/> PDF export is available in the designer.</div></div></main>;
}