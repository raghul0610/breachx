import { useState } from "react";
import { ArrowLeft, BrainCircuit, LoaderCircle, Workflow, PencilLine } from "lucide-react";
import { CATALOG } from "../lib/catalog";
import { writeSubmission } from "../lib/storage";
import type { Node, Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";

type Generated = { architectureName:string; overview:string; requestFlow:string; designDecisions:string[]; components:{id:string;typeKey:string;label:string;category:string;notes:string}[]; connections:{source:string;target:string;label:string}[] };
export function ArchitectureGeneratorPage({onBack,onEdit}:{onBack:()=>void;onEdit:()=>void}){
 const [name,setName]=useState("My System Design");
 const [requirements,setRequirements]=useState("");
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [generated,setGenerated]=useState<Generated|null>(null);
 async function generate(){
  setLoading(true);setError("");setGenerated(null);
  try{
   const response=await fetch("/api/generate-architecture",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,requirements})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Could not generate architecture.");
   setGenerated(data as Generated);
  }catch(e){setError(e instanceof Error?e.message:"Could not generate architecture.");}
  finally{setLoading(false);}
 }
 function openInEditor(){
  if(!generated)return;
  const nodes:Node[] = generated.components.map((c,i)=>({id:c.id,type:"blueprintNode",position:{x:80+(i%4)*270,y:90+Math.floor(i/4)*180},data:{label:c.label,typeKey:c.typeKey,category:c.category,notes:c.notes}}));
  const edges:Edge[]=generated.connections.map((e,i)=>({id:"suggested-edge-"+i,source:e.source,target:e.target,label:e.label||undefined,animated:true,markerEnd:{type:MarkerType.ArrowClosed}}));
  writeSubmission({applicationName:generated.architectureName,applicationDescription:requirements,nodes,edges,notes:"AI-generated architecture proposal. Review assumptions and validate design choices before production use.\n\nOverview: "+generated.overview+"\nRequest flow: "+generated.requestFlow+"\nDesign decisions: "+generated.designDecisions.join("; "),status:"draft",updatedAt:new Date().toISOString()});
  onEdit();
 }
 return <div className="app-shell generator-shell">
  <header className="topbar"><button className="nav-btn" onClick={onBack}><ArrowLeft size={14}/> HOME</button><div><strong>BREACH X</strong><span className="topbar-sub"> // AI ARCHITECTURE GENERATOR</span></div><span className="status-pill">FEATURE 02</span></header>
  <main className="generator-content">
   <section className="panel generator-hero"><div className="section-kicker"><BrainCircuit size={14}/> AI ARCHITECTURE GENERATOR</div><h1>Start with requirements.<br/>Get a system blueprint.</h1><p>Describe what you are building. Breach X proposes components and directed connections you can inspect, edit in the designer, and export as a PDF.</p></section>
   <section className="panel generator-form"><div className="field"><label>APPLICATION NAME</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. URL Shortener"/></div><div className="field"><label>APPLICATION REQUIREMENTS</label><textarea rows={6} value={requirements} onChange={e=>setRequirements(e.target.value)} placeholder="Describe the purpose, core features, expected traffic if known, data to store, security needs, availability, integrations, and budget constraints."/></div><button className="primary-btn" onClick={generate} disabled={loading||name.trim().length<2||requirements.trim().length<20}>{loading?<><LoaderCircle size={14}/> GENERATING…</>:<><BrainCircuit size={14}/> GENERATE ARCHITECTURE</>}</button>{error&&<p className="generator-error">{error}</p>}</section>
   {generated&&<section className="panel generated-result"><div className="section-kicker"><Workflow size={14}/> SUGGESTED BLUEPRINT</div><h2>{generated.architectureName}</h2><p>{generated.overview}</p><div className="generator-columns"><div><h3>Components</h3>{generated.components.map(c=><article className="suggested-component" key={c.id}><strong>{c.label}</strong><span>{c.category} · {c.typeKey}</span><p>{c.notes}</p></article>)}</div><div><h3>Directed connections</h3>{generated.connections.map((e,i)=><div className="suggested-edge" key={e.source+"-"+e.target+"-"+i}><strong>{generated.components.find(c=>c.id===e.source)?.label||e.source}</strong><span>↓ {e.label||"flow to"}</span><strong>{generated.components.find(c=>c.id===e.target)?.label||e.target}</strong></div>)}<h3>Request flow</h3><p>{generated.requestFlow}</p><h3>Key decisions</h3><ul>{generated.designDecisions.map((d,i)=><li key={i}>{d}</li>)}</ul></div></div><p className="generator-disclaimer">This is an AI-generated proposal. Review the components, connections, assumptions, and security requirements before using it in production.</p><button className="primary-btn" onClick={openInEditor}><PencilLine size={14}/> OPEN IN DESIGNER & EDIT</button></section>}
  </main>
 </div>;
}
