import { useState } from "react";
import { ArrowLeft, BrainCircuit, LoaderCircle, Workflow, PencilLine } from "lucide-react";
import { CATALOG } from "../lib/catalog";
import { createProject, readSubmission } from "../lib/storage";
import type { Node, Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import { InteractiveTutorial } from "../components/InteractiveTutorial";

type Generated = {
 architectureName:string; overview:string; requestFlow:string; designDecisions:string[];
 assumptions:string[];
 requirementCoverage:{requirement:string;componentIds:string[];rationale:string}[];
 validation:{passed:boolean;errors:string[];warnings:string[]};
 components:{id:string;typeKey:string;label:string;category:string;notes:string}[];
 connections:{source:string;target:string;label:string;communicationType:string;purpose:string}[];
};
export function ArchitectureGeneratorPage({onBack,onEdit}:{onBack:()=>void;onEdit:(projectId:string)=>void}){
 const saved = readSubmission();
 const [name,setName]=useState(saved?.applicationName ?? "My System Design");
 const [requirements,setRequirements]=useState(saved?.applicationDescription ?? "");
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [generated,setGenerated]=useState<Generated|null>(null);
 async function generate(){
  setLoading(true);setError("");setGenerated(null);
  try{
   const response=await fetch("/api/generate-architecture",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,requirements})});
   const data=await response.json();
   if(!response.ok)throw new Error([data.error,...(data.validation?.errors??[]),...(data.validation?.warnings??[])].filter(Boolean).join(" | "));
   setGenerated(data as Generated);
  }catch(e){setError(e instanceof Error?e.message:"Could not generate architecture.");}
  finally{setLoading(false);}
 }
 function openInEditor(){
  if(!generated)return;
  const nodes:Node[] = generated.components.map((c,i)=>({id:c.id,type:"blueprintNode",position:{x:80+(i%4)*270,y:90+Math.floor(i/4)*180},data:{label:c.label,typeKey:c.typeKey,category:c.category,notes:c.notes}}));
  const edges:Edge[]=generated.connections.map((e,i)=>({id:"suggested-edge-"+i,source:e.source,target:e.target,label:[e.label,e.communicationType,e.purpose].filter(Boolean).join(" · ")||undefined,animated:true,markerEnd:{type:MarkerType.ArrowClosed}}));
  const project = createProject({applicationName:generated.architectureName,applicationDescription:requirements,nodes,edges,notes:"AI-generated architecture proposal. Review assumptions and validation findings before production use.\\n\\nOverview: "+generated.overview+"\\nRequest flow: "+generated.requestFlow+"\\nDesign decisions: "+generated.designDecisions.join("; ")+"\\nAssumptions: "+generated.assumptions.join("; ")+"\\nRequirement coverage: "+generated.requirementCoverage.map(r=>r.requirement+" — "+r.rationale).join("; ")+"\\nValidation warnings: "+generated.validation.warnings.join("; "),status:"draft",updatedAt:new Date().toISOString()});
  onEdit(project.id);
 }
 return <div className="app-shell generator-shell">
  <header className="topbar"><button className="nav-btn" onClick={onBack}><ArrowLeft size={14}/> HOME</button><div><strong>ANCHON</strong><span className="topbar-sub"> // AI ARCHITECTURE GENERATOR</span></div><span className="status-pill">GENERATOR</span></header>
  <main className="generator-content">
   <section className="panel generator-hero"><div className="section-kicker"><BrainCircuit size={14}/> AI ARCHITECTURE GENERATOR</div><h1>Start with requirements.<br/>Get a system blueprint.</h1><p>Describe what you are building. ANCHON proposes components and directed connections you can inspect, edit in the designer, and export as a PDF.</p></section>
   <section className="panel generator-form"><div className="field"><label>APPLICATION NAME</label><input data-tutorial="generator-name" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. URL Shortener"/></div><div className="field"><label>APPLICATION REQUIREMENTS</label><textarea data-tutorial="generator-requirements" rows={6} value={requirements} onChange={e=>setRequirements(e.target.value)} placeholder="Describe the purpose, core features, expected traffic if known, data to store, security needs, availability, integrations, and budget constraints."/></div><button data-tutorial="generate" className="primary-btn" onClick={generate} disabled={loading||name.trim().length<2||requirements.trim().length<20}>{loading?<><LoaderCircle size={14}/> GENERATING…</>:<><BrainCircuit size={14}/> GENERATE ARCHITECTURE</>}</button>{error&&<p className="generator-error">{error}</p>}</section>
   {generated&&<section className="panel generated-result"><div className="section-kicker"><Workflow size={14}/> SUGGESTED BLUEPRINT</div><h2>{generated.architectureName}</h2><p>{generated.overview}</p>
    <div className={generated.validation.passed?"architecture-validation architecture-validation-passed":"architecture-validation architecture-validation-failed"} role="status">
     <strong>{generated.validation.passed?"STRUCTURAL VALIDATION PASSED":"VALIDATION NEEDS ATTENTION"}</strong>
     <p>Graph checks cover component IDs and catalog types, connection endpoints and semantics, requirement mappings, and graph reachability. This does not replace an engineering review.</p>
     {generated.validation.errors.map((item,i)=><p className="architecture-validation-error" key={"e"+i}>{item}</p>)}
     {generated.validation.warnings.map((item,i)=><p className="architecture-validation-warning" key={"w"+i}>{item}</p>)}
    </div>
    {generated.assumptions.length>0&&<><h3>Assumptions</h3><ul>{generated.assumptions.map((item,i)=><li key={i}>{item}</li>)}</ul></>}
    {generated.requirementCoverage.length>0&&<><h3>Requirement coverage</h3>{generated.requirementCoverage.map((item,i)=><article className="suggested-component" key={item.requirement+i}><strong>{item.requirement}</strong><p>{item.rationale}</p><span>Components: {item.componentIds.join(", ")||"Not mapped"}</span></article>)}</>}
    <div className="generator-columns"><div><h3>Components</h3>{generated.components.map(c=><article className="suggested-component" key={c.id}><strong>{c.label}</strong><span>{c.category} · {c.typeKey}</span><p>{c.notes}</p></article>)}</div><div><h3>Directed connections</h3>{generated.connections.map((e,i)=><div className="suggested-edge" key={e.source+"-"+e.target+"-"+i}><strong>{generated.components.find(c=>c.id===e.source)?.label||e.source}</strong><span>↓ {e.label||"flow to"}</span><small>{e.communicationType} · {e.purpose}</small><strong>{generated.components.find(c=>c.id===e.target)?.label||e.target}</strong></div>)}<h3>Request flow</h3><p>{generated.requestFlow}</p><h3>Key decisions</h3><ul>{generated.designDecisions.map((d,i)=><li key={i}>{d}</li>)}</ul></div></div><p className="generator-disclaimer">Structural checks run before the proposal is shown. Review requirement coverage, validation warnings, assumptions, and security requirements before using it in production.</p><button data-tutorial="open-generated" className="primary-btn" onClick={openInEditor}><PencilLine size={14}/> OPEN IN DESIGNER & EDIT</button></section>}
  </main>
  <InteractiveTutorial page="generator" />
 </div>;
}
