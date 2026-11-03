import { useMemo, useState, type DragEvent } from "react";
import { ReactFlow, Background, Controls, addEdge, useEdgesState, useNodesState, type Connection, type Edge, type Node, type ReactFlowInstance } from "@xyflow/react";
import { AlertCircle, Bot, Check, ChevronDown, Eye, LoaderCircle, RotateCcw, Send, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";
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
  if(domain.toLowerCase().includes("delivery") || domain.toLowerCase().includes("food")) functional.push("Customers place orders, restaurants confirm preparation, and couriers receive delivery assignments.");
  if(domain.toLowerCase().includes("payment") || domain.toLowerCase().includes("wallet") || domain.toLowerCase().includes("bank")) functional.push("Money movement must be recorded with an auditable transaction history.");
  if(domain.toLowerCase().includes("stream") || domain.toLowerCase().includes("video")) functional.push("Users discover content and retrieve media with low startup latency.");
  constraints.push(variants[(index+level)%variants.length]);
  if(level>=1) constraints.push("Every asynchronous operation needs an observable status and bounded retry policy.");
  if(level>=2) constraints.push("State which data may be stale and which operations require strong consistency.");
  if(level===3) constraints.push("Specify SLOs, RPO/RTO targets and the security boundary for sensitive data.");
  const reference=base.slice();
  const flow: [string,string][] = reference.slice(0,-1).map((item,i)=>[item,reference[i+1]]);
  return { title:domain,domain,brief:`Design the backend and supporting infrastructure for a ${domain.toLowerCase()}. Your architecture must satisfy the requirements below. Choose components only when they solve a stated need; justify important trade-offs.`,functional,constraints,reference,flow };
}
function makeNode(id:string,type:string,x:number,y:number):Node {
  const item=palette.find(p=>p[0]===type);
  return {id,type:"default",position:{x,y},data:{label:item?.[1] ?? type,typeKey:type},style:{background:"#1c242a",color:"#e9eef1",border:"1px solid #65727a",borderRadius:9,padding:10,minWidth:135,fontSize:12}};
}
export function AcademyPage() {
  const [level,setLevel]=useState(0); const [challenge,setChallenge]=useState(0);
  const [nodes,setNodes,onNodesChange]=useNodesState<Node>([]); const [edges,setEdges,onEdgesChange]=useEdgesState<Edge>([]);
  const [instance,setInstance]=useState<ReactFlowInstance|null>(null);
  const [revealed,setRevealed]=useState(false); const [judge,setJudge]=useState<any>(null); const [judging,setJudging]=useState(false);
  const [assistantOpen,setAssistantOpen]=useState(false); const [question,setQuestion]=useState(""); const [assistantReply,setAssistantReply]=useState(""); const [assistantBusy,setAssistantBusy]=useState(false);
  const scenario=useMemo(()=>buildScenario(level,challenge),[level,challenge]);
  const [completed,setCompleted]=useState<string[]>([]);
  const key=`${level}-${challenge}`; const done=completed.includes(key);
  const reset=()=>{setNodes([]);setEdges([]);setJudge(null);setRevealed(false);};
  const onDrop=(event:DragEvent<HTMLDivElement>)=>{event.preventDefault();const type=event.dataTransfer.getData("application/anchon-component");if(!type||!instance)return;const position=instance.screenToFlowPosition({x:event.clientX,y:event.clientY});setNodes(current=>[...current,makeNode(`${type}-${Date.now()}`,type,position.x,position.y)]);setJudge(null);};
  const connect=(connection:Connection)=>{setEdges(current=>addEdge({...connection,animated:true,style:{stroke:"#c4d0d6"},label:"request / data"},current));setJudge(null);};
  const submit=async()=>{
    setJudging(true);setJudge(null);
    const localFindings:string[]=[];
    if(!nodes.length)localFindings.push("The canvas is empty. Add components and connect the primary request path.");
    if(nodes.length>0 && edges.length===0)localFindings.push("No directed connections are present. Explain how requests and data move between the selected responsibilities.");
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw new Error("Sign in to run the AI architecture review.");
      const response=await fetch("/api/evaluate",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({
        application:{name:scenario.title,description:`${scenario.brief}\nFunctional requirements:\n${scenario.functional.join("\n")}\nConstraints:\n${scenario.constraints.join("\n")}`},
        nodes:nodes.map(n=>({id:n.id,typeKey:String((n.data as any).typeKey || (n.data as any).label).toLowerCase().replace(/[^a-z0-9]+/g,"_"),label:String((n.data as any).label),category:"Practice component"})),
        edges:edges.map(e=>({id:e.id,source:e.source,target:e.target})),
        notes:"Evaluate this practice submission strictly against the listed functional requirements and constraints. Explain exactly which requirements are unmet, why the current graph fails, what evidence supports each finding, and the smallest corrective change. Do not require components unless justified by a stated constraint."
      })});
      const payload=await response.json();if(!response.ok)throw new Error(payload.error||"AI review is unavailable.");
      const findings=Array.isArray(payload.findings)?payload.findings:[];
      const score=Math.max(0,100-findings.reduce((sum:number,f:any)=>sum+(f.severity==="critical"?25:f.severity==="high"?15:f.severity==="medium"?8:3),0));
      setJudge({score,summary:payload.summary||"Review completed.",strengths:payload.strengths||[],findings,localFindings});
      if(!findings.some((f:any)=>f.severity==="critical"||f.severity==="high")&&localFindings.length===0)setCompleted(current=>current.includes(key)?current:[...current,key]);
    }catch(error){setJudge({error:error instanceof Error?error.message:"Review failed.",localFindings});}
    finally{setJudging(false);}
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
  const reveal=()=>{setRevealed(true);const positions=scenario.reference.map((_,i)=>({x:70+(i%4)*210,y:90+Math.floor(i/4)*130}));const refNodes=scenario.reference.map((type,i)=>makeNode(`ref-${i}`,type,positions[i].x,positions[i].y));const refEdges=scenario.flow.map(([source,target],i)=>({id:`ref-edge-${i}`,source:`ref-${scenario.reference.indexOf(source)}`,target:`ref-${scenario.reference.indexOf(target)}`,animated:true,label:"request / data"}));setNodes(refNodes);setEdges(refEdges);};
  return <main className="design-academy">
    <header className="da-heading"><div><span className="da-eyebrow">ANCHON / PRACTICE ARENA</span><h1>Design systems. <em>Prove your decisions.</em></h1><p>Real-world architecture briefs, explicit constraints and engineering-grade feedback.</p></div><div className="da-progress"><strong>{completed.length}</strong><span>CHALLENGES CLEARED</span></div></header>
    <section className="da-levels" aria-label="Difficulty levels">{levels.map((item,i)=><button key={item.name} className={level===i?"active":""} onClick={()=>{setLevel(i);setChallenge(0);reset();}}><span>LEVEL 0{i+1}</span><strong>{item.name}</strong><small>{item.detail}</small><i>{completed.filter(k=>k.startsWith(i+"-")).length}/50 completed</i></button>)}</section>
    <div className="da-layout">
      <aside className="da-challenge-list"><div className="da-list-title"><strong>{levels[level].name}</strong><span>50 SYSTEMS</span></div>{systems.map((name,i)=><button key={name} className={challenge===i?"active":""} onClick={()=>{setChallenge(i);reset();}}><span>{String(i+1).padStart(2,"0")}</span><strong>{name}</strong>{completed.includes(`${level}-${i}`)?<Check size={14}/>:null}</button>)}</aside>
      <section className="da-workspace">
        <article className="da-brief"><div className="da-brief-top"><span>LEVEL 0{level+1} / CHALLENGE {String(challenge+1).padStart(2,"0")}</span><span>{done?"COMPLETED":"DESIGN BRIEF"}</span></div><h2>{scenario.title}</h2><p>{scenario.brief}</p><div className="da-requirements"><section><h3>FUNCTIONAL REQUIREMENTS</h3>{scenario.functional.map((item,i)=><p key={i}><Check size={13}/>{item}</p>)}</section><section><h3>NON-NEGOTIABLE CONSTRAINTS</h3>{scenario.constraints.map((item,i)=><p key={i}><ShieldCheck size={13}/>{item}</p>)}</section></div></article>
        <div className="da-canvas-toolbar"><div><strong>YOUR ARCHITECTURE</strong><span>Drag components in · Connect the handles</span></div><div><button onClick={reset}><RotateCcw size={13}/> Reset</button><button onClick={reveal}><Eye size={13}/> Reveal reference</button></div></div>
        <div className="da-builder"><aside className="da-palette"><strong>COMPONENTS</strong>{palette.map(item=><div key={item[0]} draggable onDragStart={e=>e.dataTransfer.setData("application/anchon-component",item[0])}><b>{item[1]}</b><small>{item[2]}</small></div>)}</aside><div className="da-flow" onDragOver={e=>e.preventDefault()} onDrop={onDrop}><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={connect} onInit={setInstance} fitView fitViewOptions={{padding:.18}}><Background color="#3b454c" gap={22}/><Controls showInteractive={false}/></ReactFlow>{nodes.length===0&&<div className="da-empty">Drop your first component here</div>}</div></div>
        <div className="da-submit-row"><span>{nodes.length} components · {edges.length} connections</span><button className="da-submit" onClick={submit} disabled={judging||nodes.length===0}>{judging?<><LoaderCircle className="da-spin" size={15}/> Evaluating…</>:<><Sparkles size={15}/> Submit for evaluation</>}</button></div>
        {judge&&<section className="da-judge"><div className="da-judge-head"><div><span>ARCHITECTURE JUDGE</span><h3>{judge.error?"Review unavailable":`Evaluation · ${judge.score}/100`}</h3></div>{!judge.error&&<strong>{judge.score>=80?"STRONG":judge.score>=55?"NEEDS WORK":"REVISE DESIGN"}</strong>}</div><p>{judge.error||judge.summary}</p>{judge.localFindings?.map((f:string,i:number)=><p className="da-finding" key={i}><AlertCircle size={14}/>{f}</p>)}{judge.strengths?.map((f:string,i:number)=><p className="da-strength" key={i}><Check size={14}/>{f}</p>)}{judge.findings?.map((f:any,i:number)=><article className="da-finding-card" key={f.id||i}><span>{String(f.severity||"finding").toUpperCase()} · {f.category}</span><strong>{f.title}</strong><p>{f.description}</p><small>WHY IT MATTERS: {f.requirement}</small><p className="da-recommendation">NEXT STEP: {f.recommendation}</p></article>)}</section>}
        <div className="da-coach"><button onClick={()=>setAssistantOpen(v=>!v)}><Bot size={16}/> Ask the AI design coach <ChevronDown size={14}/><span>Hints, not spoilers</span></button>{assistantOpen&&<div className="da-coach-body"><p>Ask about a requirement, trade-off or component choice. The coach will guide your reasoning without revealing the reference design.</p><div><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")askAssistant();}} placeholder="e.g. How should I handle payment timeouts?"/><button onClick={askAssistant} disabled={assistantBusy||!question.trim()}>{assistantBusy?<LoaderCircle size={14}/>:<Send size={14}/>}</button></div>{assistantReply&&<p className="da-coach-reply">{assistantReply}</p>}</div>}</div>
      </section>
    </div>
  </main>;
}
