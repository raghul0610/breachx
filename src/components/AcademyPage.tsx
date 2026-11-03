import { useMemo, useState, type DragEvent } from "react";
import { ReactFlow, Background, Controls, ConnectionMode, addEdge, useEdgesState, useNodesState, type Connection, type Edge, type Node, type ReactFlowInstance, MarkerType } from "@xyflow/react";
import { AlertCircle, Bot, Check, ChevronDown, Eye, LoaderCircle, Play, RotateCcw, Send, Search } from "lucide-react";
import { supabase } from "../lib/supabase";
import { evaluateSystemDesign } from "../lib/evaluationEngine";
import { BlueprintNode } from "./BlueprintNode";
import "./SystemDesignAcademy.css";

type Component = { id: string; label: string; category: string; description: string };
type Scenario = { title: string; domain: string; brief: string; functional: string[]; constraints: string[]; reference: string[]; flow: [string,string][] };
const systems = [
  "Food delivery platform","Ride-hailing marketplace","Video streaming service","Real-time chat platform","Online ticket booking","E-commerce marketplace","Digital wallet","Bank transfer platform","Social media feed","Cloud file storage",
  "Online learning platform","Hotel booking engine","Flight reservation system","Grocery delivery service","Healthcare appointment platform","Food ordering kiosk network","Job marketplace","Real-time sports scores","Music streaming service","Photo sharing application",
  "URL shortener","Notification delivery platform","Package tracking system","Inventory management platform","Restaurant table reservation","Online auction platform","Collaborative document editor","Code hosting platform","Ride-sharing dispatch","Global shipment tracking",
  "Smart home control platform","IoT telemetry ingestion","Customer support helpdesk","Subscription billing platform","Ad serving platform","Search engine","Product recommendation engine","Live video broadcasting","Online gaming leaderboard","Multi-tenant SaaS dashboard",
  "Identity and access platform","Fraud detection pipeline","Event registration platform","Public transport tracking","Parking reservation platform","Peer-to-peer payment app","Digital library","Podcast hosting platform","Appointment reminders service","Analytics event pipeline"
];
const levels = [
  { name: "Foundation", detail: "Core request paths, data ownership and basic reliability", constraints: ["Keep the first version as a modular monolith unless a requirement justifies service separation.", "Use a relational source of truth for transactional records.", "All write requests must be validated server-side."] },
  { name: "Intermediate", detail: "Scale, caching, asynchronous work and failure handling", constraints: ["Handle burst traffic without losing accepted work.", "Long-running tasks must not block the synchronous request path.", "Retries must not duplicate business side effects."] },
  { name: "Advanced", detail: "Distributed data, consistency and resilience", constraints: ["Define the consistency model for critical reads and writes.", "A single instance or dependency failure must have a documented recovery path.", "Protect the system from overload and cascading failures."] },
  { name: "Expert", detail: "Large-scale architecture, security and operational trade-offs", constraints: ["Meet a 99.99% availability objective for critical user journeys.", "Enforce tenant isolation and least-privilege access.", "Design for regional failure and measurable recovery objectives."] }
];
const palette = [
  ["client","Client","Entry point"],["gateway","API gateway","Routing and edge policy"],["service","Application service","Business logic"],["database","Relational database","Transactional source of truth"],["cache","Distributed cache","Low-latency reads"],["queue","Message queue","Asynchronous delivery"],["worker","Background worker","Long-running jobs"],["object_storage","Object storage","Files and media"],["cdn","CDN","Edge delivery"],["search","Search index","Text discovery"],["auth","Identity service","Authentication and authorization"],["rate_limiter","Rate limiter","Traffic protection"],["monitoring","Observability","Metrics, logs and traces"],["payment","Payment provider","External payment dependency"],["notification","Notification service","Email, SMS or push"]
] as const;
const requiredByDomain: Record<string,string[]> = {
  "Food delivery platform":["client","gateway","service","database","queue","worker","notification","payment"],
  "Ride-hailing marketplace":["client","gateway","service","database","cache","queue","worker","notification"],
  "Video streaming service":["client","cdn","object_storage","service","database","cache"],
  "Real-time chat platform":["client","gateway","service","database","cache","queue","notification"],
  "E-commerce marketplace":["client","gateway","service","database","cache","queue","payment","notification"],
  "Digital wallet":["client","gateway","auth","service","database","queue","monitoring"],
};
function buildScenario(level:number,index:number):Scenario {
  const domain=systems[index];
  const stageFocus=["Core product workflow","Peak traffic and asynchronous processing","Distributed consistency and failure recovery","Multi-region resilience and strict isolation"][level];
  const title=level===0?domain:`${domain} · ${stageFocus}`;
  const base=requiredByDomain[domain] ?? ["client","gateway","service","database","cache","queue","worker"];
  const constraints=[...levels[level].constraints];
  const variants=[
    "The first release must support a clear end-to-end user journey with explicit ownership of persistent data.",
    "Traffic is uneven: peak load can reach 8× the daily average, and the platform must remain responsive.",
    "External providers can time out or return duplicate callbacks; the system must recover safely.",
    "The product operates across multiple regions and must make data residency and failover decisions explicit."
  ];
  const functional=[
    "Users can complete the primary workflow from the client application.",
    "The system persists the authoritative state and exposes its current status.",
    "Users receive a clear outcome when an operation succeeds, fails or remains pending."
  ];
  if(level===1)functional.push("The system absorbs traffic bursts and moves non-interactive work off the synchronous request path.");
  if(level===2)functional.push("The system remains correct when requests are retried, services fail, or replicas observe updates at different times.");
  if(level===3)functional.push("The system isolates tenants and continues critical workflows through a regional outage with defined recovery objectives.");
  if(domain.toLowerCase().includes("delivery") || domain.toLowerCase().includes("food")) functional.push("Customers place orders, restaurants confirm preparation, and couriers receive delivery assignments.");
  if(domain.toLowerCase().includes("payment") || domain.toLowerCase().includes("wallet") || domain.toLowerCase().includes("bank")) functional.push("Money movement must be recorded with an auditable transaction history.");
  if(domain.toLowerCase().includes("stream") || domain.toLowerCase().includes("video")) functional.push("Users discover content and retrieve media with low startup latency.");
  constraints.push(variants[(index+level)%variants.length]);
  if(level>=1) constraints.push("Every asynchronous operation needs an observable status and bounded retry policy.");
  if(level>=2) constraints.push("State which data may be stale and which operations require strong consistency.");
  if(level===3) constraints.push("Specify SLOs, RPO/RTO targets and the security boundary for sensitive data.");
  const reference=base.slice();
  const flowByDomain: Record<string,[string,string][]> = {
    "Food delivery platform":[["client","gateway"],["gateway","service"],["service","database"],["service","cache"],["service","queue"],["queue","worker"],["worker","notification"],["service","payment"],["payment","service"],["service","client"]],
    "Ride-hailing marketplace":[["client","gateway"],["gateway","service"],["service","cache"],["service","database"],["service","queue"],["queue","worker"],["worker","notification"],["service","client"]],
    "Video streaming service":[["client","cdn"],["cdn","object_storage"],["client","gateway"],["gateway","service"],["service","database"],["service","cache"],["service","cdn"]],
    "Real-time chat platform":[["client","gateway"],["gateway","service"],["service","cache"],["service","database"],["service","queue"],["queue","notification"],["service","client"]],
    "E-commerce marketplace":[["client","gateway"],["gateway","service"],["service","database"],["service","cache"],["service","queue"],["queue","notification"],["service","payment"],["payment","service"],["service","client"]],
    "Digital wallet":[["client","gateway"],["gateway","auth"],["auth","service"],["service","database"],["service","queue"],["service","monitoring"],["service","client"]]
  };
  const flow: [string,string][] = flowByDomain[domain] ?? [
    ["client","gateway"],["gateway","service"],["service","database"],
    ...(reference.includes("cache")?[["service","cache"] as [string,string]]:[]),
    ...(reference.includes("queue")?[["service","queue"] as [string,string]]:[]),
    ...(reference.includes("worker")&&reference.includes("queue")?[["queue","worker"] as [string,string]]:[]),
    ...(reference.includes("notification")&&reference.includes("worker")?[["worker","notification"] as [string,string]]:[]),
    ["service","client"]
  ];
  return { title,domain,brief:`Design the backend and supporting infrastructure for a ${domain.toLowerCase()} focused on ${stageFocus.toLowerCase()}. Your architecture must satisfy the requirements below. Choose components only when they solve a stated need; justify important trade-offs.`,functional,constraints,reference,flow };
}
const academyNodeTypes={blueprintNode:BlueprintNode};
function makeNode(id:string,type:string,x:number,y:number):Node {
  const item=palette.find(p=>p[0]===type);
  const catalogKeys:Record<string,string>={gateway:"api_gateway",service:"microservice",search:"search_engine",auth:"auth_service",monitoring:"metrics",payment:"payment_service",notification:"notification_service"};
  return {id,type:"blueprintNode",position:{x,y},data:{label:item?.[1] ?? type,typeKey:catalogKeys[type]??type,category:({client:"Applications",gateway:"Networking",service:"Compute",database:"Databases",cache:"Cache",queue:"Messaging",worker:"Compute",object_storage:"Storage",cdn:"Networking",search:"Data",auth:"Security",rate_limiter:"Security",monitoring:"Observability",payment:"Integrations",notification:"Messaging"} as Record<string,string>)[type]??"Infrastructure",notes:item?.[2]??""}};
}
export function AcademyPage() {
  const [level,setLevel]=useState(0); const [challenge,setChallenge]=useState(0);
  const [nodes,setNodes,onNodesChange]=useNodesState<Node>([]); const [edges,setEdges,onEdgesChange]=useEdgesState<Edge>([]);
  const [instance,setInstance]=useState<ReactFlowInstance|null>(null);
  const [revealed,setRevealed]=useState(false); const [judge,setJudge]=useState<any>(null); const [judging,setJudging]=useState(false);
  const [assistantOpen,setAssistantOpen]=useState(false); const [question,setQuestion]=useState(""); const [challengeMenuOpen,setChallengeMenuOpen]=useState(false); const [challengeSearch,setChallengeSearch]=useState(""); const [assistantReply,setAssistantReply]=useState(""); const [assistantBusy,setAssistantBusy]=useState(false);
  const scenario=useMemo(()=>buildScenario(level,challenge),[level,challenge]);
  const filteredChallenges=useMemo(()=>systems.map((name,index)=>({name,index})).filter(item=>item.name.toLowerCase().includes(challengeSearch.toLowerCase())),[challengeSearch]);
  const [completed,setCompleted]=useState<string[]>([]);
  const key=`${level}-${challenge}`; const done=completed.includes(key);
  const reset=()=>{setNodes([]);setEdges([]);setJudge(null);setRevealed(false);};
  const onDrop=(event:DragEvent<HTMLDivElement>)=>{event.preventDefault();const type=event.dataTransfer.getData("application/anchon-component");if(!type||!instance)return;const position=instance.screenToFlowPosition({x:event.clientX,y:event.clientY});setNodes(current=>[...current,makeNode(`${type}-${Date.now()}`,type,position.x,position.y)]);setJudge(null);};
  const connect=(connection:Connection)=>{setEdges(current=>addEdge({...connection,animated:true,style:{stroke:"#c4d0d6"},label:"request / data",labelBgStyle:{fill:"transparent",fillOpacity:0,stroke:"none"},labelStyle:{fill:"#d7e0e4",fontSize:10,fontWeight:600},type:"smoothstep"},current));setJudge(null);};
  const submit=async()=>{
    setJudging(true);setJudge(null);
    const localFindings:string[]=[];
    if(!nodes.length)localFindings.push("The canvas is empty. Add components and connect the primary request path.");
    if(nodes.length>0 && edges.length===0)localFindings.push("No directed connections are present. Explain how requests and data move between the selected responsibilities.");
    const graphNodes=nodes.map(n=>({id:n.id,type:n.type,data:n.data as {label?:string;typeKey?:string;category?:string;notes?:string}}));
    const graphEdges=edges.map(e=>({id:e.id,source:e.source,target:e.target}));
    const deterministic=evaluateSystemDesign({application:{name:scenario.title,description:`${scenario.brief}\nFunctional requirements:\n${scenario.functional.join("\n")}\nConstraints:\n${scenario.constraints.join("\n")}`},nodes:graphNodes,edges:graphEdges,notes:"Evaluate this challenge against its explicit functional requirements and constraints."});
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw new Error("Sign in to run the AI architecture review.");
      const response=await fetch("/api/evaluate",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({
        application:{name:scenario.title,description:`${scenario.brief}\nFunctional requirements:\n${scenario.functional.join("\n")}\nConstraints:\n${scenario.constraints.join("\n")}`},
        nodes:graphNodes.map(n=>({id:n.id,typeKey:String(n.data.typeKey || n.data.label || "").toLowerCase().replace(/[^a-z0-9]+/g,"_"),label:String(n.data.label||n.id),category:String(n.data.category||"Architecture"),notes:n.data.notes})),
        edges:graphEdges,
        notes:"This is a learning challenge. Evaluate the graph against every listed functional requirement and constraint. Explain the current request/data flow, identify exactly why a requirement is or is not satisfied, cite graph evidence, distinguish risks from unknowns, and recommend the smallest justified correction. Do not grade by component count."
      })});
      const payload=await response.json();if(!response.ok)throw new Error(payload.error||"AI review is unavailable.");
      const findings=Array.isArray(payload.findings)?payload.findings:[];
      setJudge({score:deterministic.score,summary:payload.summary||deterministic.summary,strengths:[...deterministic.strengths,...(payload.strengths||[])],findings:[...deterministic.findings.map(f=>({...f,source:"rule"})),...findings.map((f:any)=>({...f,source:"ai"}))],assessments:payload.assessments||[],localFindings,overview:deterministic.overview,howItWorks:deterministic.howItWorks});
      if(!deterministic.findings.some(f=>f.severity==="critical"||f.severity==="high")&&!findings.some((f:any)=>f.severity==="critical"||f.severity==="high")&&localFindings.length===0)setCompleted(current=>current.includes(key)?current:[...current,key]);
    }catch(error){
      setJudge({error:error instanceof Error?error.message:"AI review failed.",score:deterministic.score,summary:deterministic.summary,strengths:deterministic.strengths,findings:deterministic.findings,localFindings,assessments:deterministic.scores,offline:true});
    }finally{setJudging(false);}
  };
  const askAssistant=async()=>{
    if(!question.trim()||assistantBusy)return;setAssistantBusy(true);setAssistantReply("");
    try{
      const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error("Sign in to use the AI coach.");
      const response=await fetch("/api/evaluate",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({
        application:{name:scenario.title,description:`${scenario.brief}\nRequirements: ${scenario.functional.join("; ")}\nConstraints: ${scenario.constraints.join("; ")}\nUser question: ${question}`},
        nodes:(nodes.length?nodes:[{id:"coach-context",data:{label:"Design not started"}}] as any).map((n:any)=>({id:n.id,typeKey:String(n.data.typeKey || "component"),label:String(n.data.label),category:"Practice component"})),edges:edges.map(e=>({id:e.id,source:e.source,target:e.target})),
        notes:"Act as a Socratic system-design coach. Answer the user's question with one practical hint at a time. Do not reveal the reference architecture or list the complete solution. Focus on reasoning about the stated constraints."
      })});
      const payload=await response.json();if(!response.ok)throw new Error(payload.error||"AI coach is unavailable.");
      setAssistantReply(payload.summary||payload.findings?.[0]?.recommendation||"Start by tracing the primary request from the client to the component that owns the state.");
    }catch(error){setAssistantReply(error instanceof Error?error.message:"Could not get a hint.");}
    finally{setAssistantBusy(false);}
  };
  const reveal=()=>{setRevealed(true);const positions=scenario.reference.map((_,i)=>({x:90+(i%4)*220,y:95+Math.floor(i/4)*155}));const refNodes=scenario.reference.map((type,i)=>makeNode(`ref-${i}`,type,positions[i].x,positions[i].y));const refEdges:Edge[]=scenario.flow.map(([source,target],i)=>({id:`ref-edge-${i}`,source:`ref-${scenario.reference.indexOf(source)}`,target:`ref-${scenario.reference.indexOf(target)}`,animated:true,style:{stroke:"#c4d0d6",strokeWidth:1.7},label:"request / data",labelBgStyle:{fill:"transparent",fillOpacity:0,stroke:"none"},labelStyle:{fill:"#d7e0e4",fontSize:10,fontWeight:600},type:"smoothstep",markerEnd:{type:MarkerType.ArrowClosed,color:"#c4d0d6"}}));setNodes(refNodes);setEdges(refEdges);setJudge(null);};
  return <main className="design-academy">
    <header className="da-heading">
      <div><span className="da-eyebrow">ANCHON / PRACTICE ARENA</span><h1>System design practice</h1><p>Work through real-world architecture problems and get feedback on your decisions.</p></div>
      <div className="da-progress"><strong>{completed.length}<small> / 200</small></strong><span>CHALLENGES COMPLETED</span></div>
    </header>

    <section className="da-navigation" aria-label="Challenge selection">
      <div className="da-level-picker">
        {levels.map((item,i)=><button key={item.name} className={level===i?"active":""} onClick={()=>{setLevel(i);setChallenge(0);reset();}}><span>{item.name}</span><small>{completed.filter(k=>k.startsWith(i+"-")).length}/50</small></button>)}
      </div>
      <div className="da-challenge-picker">
        <label htmlFor="da-challenge">CHOOSE A CHALLENGE</label>
        <div className="da-challenge-select">
          <button type="button" className={"da-challenge-trigger"+(challengeMenuOpen?" open":"")} aria-haspopup="listbox" aria-expanded={challengeMenuOpen} onClick={()=>{setChallengeMenuOpen(v=>!v);setChallengeSearch("");}}>
            <span><small>CHALLENGE {String(challenge+1).padStart(2,"0")}</small><strong>{scenario.title}</strong></span><ChevronDown size={16}/>
          </button>
          {challengeMenuOpen&&<div className="da-challenge-menu"><div className="da-challenge-search"><Search size={14}/><input autoFocus value={challengeSearch} onChange={e=>setChallengeSearch(e.target.value)} placeholder="Search challenges…"/></div><div className="da-challenge-options" role="listbox" aria-label="Challenges">{filteredChallenges.map(item=><button type="button" role="option" aria-selected={challenge===item.index} key={item.index} className={challenge===item.index?"selected":""} onClick={()=>{setChallenge(item.index);reset();setChallengeMenuOpen(false);}}><span>{String(item.index+1).padStart(2,"0")}</span>{item.name}{challenge===item.index&&<Check size={14}/>}</button>)}{filteredChallenges.length===0&&<p>No matching challenges.</p>}</div></div>}
        </div>
        <span>{challenge+1} of 50</span>
      </div>
    </section>

    <section className="da-workspace">
      <article className="da-brief">
        <div className="da-section-heading"><div><span className="da-eyebrow">{levels[level].name.toUpperCase()} · CHALLENGE {String(challenge+1).padStart(2,"0")}</span><h2>{scenario.title}</h2></div><span className={done?"da-status done":"da-status"}>{done?"COMPLETED":"NOT STARTED"}</span></div>
        <p className="da-brief-copy">{scenario.brief}</p>
        <div className="da-requirements">
          <section><h3>What the system must do</h3><ul>{scenario.functional.map((item,i)=><li key={i}>{item}</li>)}</ul></section>
          <section><h3>Constraints to respect</h3><ul>{scenario.constraints.map((item,i)=><li key={i}>{item}</li>)}</ul></section>
        </div>
      </article>

      <section className="da-design-section">
        <div className="da-section-heading da-canvas-heading"><div><span className="da-eyebrow">DESIGN WORKSPACE</span><h2>Your architecture</h2><p>Build the request and data flow by adding components and connecting them.</p></div><div className="da-canvas-actions"><button onClick={reset}><RotateCcw size={14}/> Reset</button><button onClick={reveal} disabled={revealed}><Eye size={14}/> {revealed?"Reference revealed":"Reveal solution"}</button></div></div>
        <div className="da-builder">
          <div className="da-builder-main"><div className="da-flow" onDragOver={(event)=>{event.preventDefault();event.dataTransfer.dropEffect="move";}} onDrop={onDrop}><ReactFlow nodes={nodes} edges={edges} nodeTypes={academyNodeTypes} connectionMode={ConnectionMode.Loose} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={connect} onInit={setInstance} fitView fitViewOptions={{padding:.2}}><Background color="#3b454c" gap={22}/><Controls showInteractive={false}/></ReactFlow>{nodes.length===0&&<div className="da-empty"><strong>Drag a component onto this canvas</strong><span>Start with Client, then connect the request path.</span></div>}</div></div>
          <aside className="da-palette-wrap"><div className="da-palette-heading"><strong>Components</strong><small>Drag a building block into the canvas</small></div><div className="da-palette">{palette.map(item=><div key={item[0]} draggable onDragStart={e=>{e.dataTransfer.setData("application/anchon-component",item[0]);e.dataTransfer.effectAllowed="move";}}><b>{item[1]}</b><small>{item[2]}</small></div>)}</div></aside>
        </div>
        <div className="da-submit-row"><span>{nodes.length} components · {edges.length} connections</span><button className="da-submit" onClick={submit} disabled={judging||nodes.length===0}>{judging?<><LoaderCircle className="da-spin" size={15}/> Evaluating…</>:<><Play size={15}/> Run & evaluate design</>}</button></div>
      </section>

      {judge&&<section className="da-judge"><div className="da-section-heading da-judge-head"><div><span className="da-eyebrow">FEEDBACK</span><h2>{judge.error?"Evaluation unavailable":`Architecture review · ${judge.score}/100`}</h2></div>{!judge.error&&<strong>{judge.score>=80?"STRONG":judge.score>=55?"NEEDS IMPROVEMENT":"REWORK NEEDED"}</strong>}</div><p>{judge.error||judge.summary}</p>{judge.localFindings?.map((f:string,i:number)=><p className="da-finding" key={i}><AlertCircle size={14}/>{f}</p>)}{judge.strengths?.map((f:string,i:number)=><p className="da-strength" key={i}><Check size={14}/>{f}</p>)}{judge.findings?.map((f:any,i:number)=><article className="da-finding-card" key={f.id||i}><span>{String(f.severity||"finding").toUpperCase()} · {f.category}</span><strong>{f.title}</strong><p>{f.description}</p><small>WHY IT MATTERS: {f.requirement}</small><p className="da-recommendation">SUGGESTED CHANGE: {f.recommendation}</p></article>)}</section>}

      <section className="da-coach"><button onClick={()=>setAssistantOpen(v=>!v)}><Bot size={16}/><span><strong>Need help?</strong><small>Ask the AI design coach for a hint</small></span><ChevronDown size={15} className={assistantOpen?"rotated":""}/></button>{assistantOpen&&<div className="da-coach-body"><p>Ask about a requirement, trade-off or component choice. The coach will guide your reasoning without revealing the complete solution.</p><div><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")askAssistant();}} placeholder="e.g. How should I handle payment timeouts?"/><button onClick={askAssistant} disabled={assistantBusy||!question.trim()}>{assistantBusy?<LoaderCircle size={14}/>:<Send size={14}/>}</button></div>{assistantReply&&<p className="da-coach-reply">{assistantReply}</p>}</div>}</section>
    </section>

  </main>;
}
