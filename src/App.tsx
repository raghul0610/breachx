import { useState } from "react";
import { LandingPage } from "./pages/LandingPage";
import { ParticipantPage } from "./pages/ParticipantPage";
import { ArchitectureGeneratorPage } from "./pages/ArchitectureGeneratorPage";
export default function App(){
 const [mode,setMode]=useState<"home"|"participant"|"generator">("home");
 if(mode==="participant")return <ParticipantPage onBack={()=>setMode("home")} onSubmitted={()=>setMode("generator")}/>;
 if(mode==="generator")return <ArchitectureGeneratorPage onBack={()=>setMode("home")} onEdit={()=>setMode("participant")}/>;
 return <LandingPage onOpenDesigner={()=>setMode("participant")} onOpenGenerator={()=>setMode("generator")}/>;
}