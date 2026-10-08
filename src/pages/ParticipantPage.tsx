import { useCallback,useEffect,useMemo,useState } from "react";
import { addEdge,Background,BackgroundVariant,Controls,MiniMap,ReactFlow,ReactFlowProvider,MarkerType,useEdgesState,useNodesState,useReactFlow,type Connection,type Edge,type Node } from "@xyflow/react";
import { ArrowLeft,FileText,Layers,Save,Send,Trash2 } from "lucide-react";
import { BlueprintNode,type BlueprintNodeData } from "../components/BlueprintNode";
import { CATALOG,type CatalogItem } from "../lib/catalog";
import { getActiveProblems,getBreachXEvent,getMyBlueprint,getMyProblemAssignment,getMyTeam,logBlueprintActivity,saveBlueprintDraft,submitBlueprint } from "../lib/db";
import { supabase } from "../lib/supabase";
import { readSubmission,writeSubmission,logActivity } from "../lib/storage";
import { evaluateSystemDesign } from "../lib/evaluationEngine";
import { writeEvaluation } from "../lib/evaluationStorage";

const initialNodes:Node<BlueprintNodeData>[]=[
 {id:"node-1",type:"blueprintNode",position:{x:80,y:160},data:{label:"Client / User App",typeKey:"client",category:"Edge"}},
 {id:"node-2",type:"blueprintNode",position:{x:330,y:160},data:{label:"WAF / Firewall",typeKey:"firewall",category:"Security"}},
 {id:"node-3",type:"blueprintNode",position:{x:590,y:160},data:{label:"API Gateway",typeKey:"api_gateway",category:"Routing"}}
];
const initialEdges:Edge[]=[
 {id:"e1-2",source:"node-1",target:"node-2",animated:true,markerEnd:{type:MarkerType.ArrowClosed}},
 {id:"e2-3",source:"node-2",target:"node-3",animated:true,markerEnd:{type:MarkerType.ArrowClosed}}
];

export function ParticipantPage({onBack,onEvaluated}:{onBack:()=>void;onEvaluated:()=>void}){ return <ReactFlowProvider><ParticipantEditor onBack={onBack} onEvaluated={onEvaluated}/></ReactFlowProvider>; }

function ParticipantEditor({onBack,onEvaluated}:{onBack:()=>void;onEvaluated:()=>void}){
 const {screenToFlowPosition,getViewport,setViewport}=useReactFlow();
 const saved=readSubmission();
 const [nodes,setNodes,onNodesChange]=useNodesState((saved?.nodes as Node<BlueprintNodeData>[])??initialNodes);
 const [edges,setEdges,onEdgesChange]=useEdgesState((saved?.edges as Edge[])??initialEdges);
 const [notes,setNotes]=useState(saved?.notes??"");
 const [applicationName,setApplicationName]=useState("My System Design");
 const [applicationDescription,setApplicationDescription]=useState(saved?.problem??"Describe the application, expected users, traffic and important requirements.");
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const status="LIVE";
 const [problem,setProblem]=useState(saved?.problem??"");
 const [loading,setLoading]=useState(true);
 const [problemError,setProblemError]=useState("");
 const [authenticated,setAuthenticated]=useState(false);
 const [teamId,setTeamId]=useState("demo-team");
 const [teamName,setTeamName]=useState("Demo Team");
 const [eventId,setEventId]=useState<string|null>(null);
 const [problemAssignmentId,setProblemAssignmentId]=useState<string|null>(null);
 const [submitted,setSubmitted]=useState(saved?.status==="submitted");
 const [persisting,setPersisting]=useState(false);
 const [backendReady,setBackendReady]=useState(false);
 const [restoredViewport,setRestoredViewport]=useState(false);
 const nodeTypes=useMemo(()=>({blueprintNode:BlueprintNode}),[]);
 const selected=nodes.find(n=>n.id===selectedId);

 useEffect(()=>{const sync=()=>setStatus(readStatus()); window.addEventListener("breachx-sync",sync); window.addEventListener("storage",sync); return()=>{window.removeEventListener("breachx-sync",sync);window.removeEventListener("storage",sync)}},[]);

 useEffect(()=>{
   let cancelled=false;
   (async()=>{
     try{
       const {data:{user}}=await supabase.auth.getUser();
       if(cancelled)return;
       setAuthenticated(!!user);

       if(user){
         const event=await getBreachXEvent();
         if(cancelled)return;
         if(!event){setProblemError("Breach X event was not found.");return;}
         setEventId(event.id);
         const membership=await getMyTeam();
         if(cancelled)return;
         if(!membership){setProblemError("Your account is not assigned to a team.");return;}
         const resolvedTeam=Array.isArray(membership.teams)?membership.teams[0]:membership.teams;
         setTeamId(membership.team_id);
         setTeamName(resolvedTeam?.name??"Team");
         const assignment=await getMyProblemAssignment(membership.team_id,event.id);
         if(cancelled)return;
         if(!assignment){setProblemError("No problem has been assigned to your team yet.");return;}
         setProblemAssignmentId(assignment.id);
         const assigned=Array.isArray(assignment.problem_statements)?assignment.problem_statements[0]:assignment.problem_statements;
         setProblem(assigned?.statement??"");
         const blueprint=await getMyBlueprint(membership.team_id);
         if(cancelled)return;
         if(blueprint){
           setNodes((blueprint.nodes as Node<BlueprintNodeData>[])??initialNodes);
           setEdges((blueprint.edges as Edge[])??initialEdges);
           setNotes(blueprint.notes??"");
           setSubmitted(blueprint.status==="SUBMITTED");
           if(blueprint.viewport&&typeof blueprint.viewport==="object") {
             const viewport=blueprint.viewport as {x?:number;y?:number;zoom?:number};
             if(typeof viewport.x==="number"&&typeof viewport.y==="number"&&typeof viewport.zoom==="number"){
               setViewport({x:viewport.x,y:viewport.y,zoom:viewport.zoom});
               setRestoredViewport(true);
             }
           }
         }
         setBackendReady(true);
       }else{
         const result=await getActiveProblems();
         if(cancelled)return;
         if(!result.problems.length){setProblemError("No active problem statements are configured.");return;}
         const chosen=result.problems[Math.floor(Math.random()*result.problems.length)];
         setProblem(chosen.statement);
         logActivity("PROBLEM_ASSIGNED",{problemId:chosen.id,track:chosen.track});
       }
     }catch(e){
       if(!cancelled)setProblemError(e instanceof Error?e.message:"Unable to load participant workspace.");
     }finally{
       if(!cancelled)setLoading(false);
     }
   })();
   return()=>{cancelled=true};
 },[setEdges,setNodes,setViewport]);

 const addCatalogNode=(item:CatalogItem,position?:{x:number;y:number})=>{
   if(status!=="LIVE"||submitted)return;
   const id=crypto.randomUUID();
   setNodes(current=>[...current,{id,type:"blueprintNode",position:position??{x:120+Math.random()*420,y:90+Math.random()*320},data:{label:item.label,typeKey:item.typeKey,category:item.category}}]);
   setSelectedId(id);
   logActivity("NODE_ADDED",{typeKey:item.typeKey,label:item.label});
 };
 const onDrop=useCallback((e:React.DragEvent)=>{e.preventDefault();if(status!=="LIVE"||submitted)return;const item=CATALOG.find(x=>x.typeKey===e.dataTransfer.getData("application/breachx-component"));if(item)addCatalogNode(item,screenToFlowPosition({x:e.clientX,y:e.clientY}))},[screenToFlowPosition,status,submitted]);
 const onConnect=useCallback((c:Connection)=>{if(status!=="LIVE"||submitted)return;setEdges(cur=>addEdge({...c,animated:true,markerEnd:{type:MarkerType.ArrowClosed}},cur));logActivity("EDGE_CREATED",{source:c.source,target:c.target})},[status,submitted,setEdges]);
 const handleNodesChange=useCallback((changes:Parameters<typeof onNodesChange>[0])=>{if(status==="LIVE"&&!submitted)onNodesChange(changes)},[status,submitted,onNodesChange]);
 const handleEdgesChange=useCallback((changes:Parameters<typeof onEdgesChange>[0])=>{if(status==="LIVE"&&!submitted)onEdgesChange(changes)},[status,submitted,onEdgesChange]);

 const save=async(submissionStatus:"draft"|"submitted")=>{
   if(status!=="LIVE"){alert("Blueprint editing is available only while the event is LIVE.");return;}
   if(submitted){alert("This blueprint has already been submitted and is locked.");return;}
   if(!problem){alert("Problem statement is still loading.");return;}
   if(submissionStatus==="submitted"&&(nodes.length<3||edges.length<2)){alert("Submission requires at least 3 components and 2 connections.");return;}
   const viewport=getViewport();
   const local={teamId,teamName,problem,nodes,edges,notes,status:submissionStatus,updatedAt:new Date().toISOString()};
   setPersisting(true);
   try{
     if(authenticated){
       if(!eventId||!problemAssignmentId)throw new Error("Your team problem assignment is not ready yet.");
       if(submissionStatus==="draft"){
         await saveBlueprintDraft({eventId,teamId,problemAssignmentId,nodes,edges,viewport,notes});
         await logBlueprintActivity(teamId,eventId,"BLUEPRINT_SAVED",{nodes:nodes.length,edges:edges.length});
       }else{
         await submitBlueprint({eventId,teamId,problemAssignmentId,nodes,edges,viewport,notes});
         await logBlueprintActivity(teamId,eventId,"BLUEPRINT_SUBMITTED",{nodes:nodes.length,edges:edges.length});
         setSubmitted(true);
       }
       setBackendReady(true);
     }
     writeSubmission(local);
     logActivity(submissionStatus==="submitted"?"BLUEPRINT_SUBMITTED":"BLUEPRINT_SAVED",{nodes:nodes.length,edges:edges.length,persisted:authenticated});
     if(submissionStatus==="submitted"){
       const result=evaluateSystemDesign({application:{name:applicationName,description:applicationDescription},nodes:nodes as never[],edges:edges as never[],notes});
       writeEvaluation(result);
       alert("Design evaluated successfully. Your report is ready.");
       onEvaluated();
     }
   }catch(e){
     alert(e instanceof Error?e.message:"Unable to persist blueprint.");
   }finally{
     setPersisting(false);
   }
 };

 const updateSelected=(field:"label"|"notes",value:string)=>{if(!selectedId||status!=="LIVE"||submitted)return;setNodes(cur=>cur.map(n=>n.id===selectedId?{...n,data:{...n.data,[field]:value}}:n))};
 const removeSelected=()=>{if(!selectedId||status!=="LIVE"||submitted)return;setNodes(cur=>cur.filter(n=>n.id!==selectedId));setEdges(cur=>cur.filter(e=>e.source!==selectedId&&e.target!==selectedId));logActivity("NODE_DELETED",{nodeId:selectedId});setSelectedId(null)};
 const canSubmit=status==="LIVE"&&!!problem&&!submitted&&nodes.length>=3&&edges.length>=2;

 if(status!=="LIVE")return <div className="app-shell"><header className="topbar"><button className="nav-btn" onClick={onBack}><ArrowLeft size={14}/> HOME</button><div><strong>BREACH X</strong><span className="topbar-sub"> // SYSTEM DESIGN WORKSPACE</span></div><span className="status-pill">{status}</span></header><main className="admin-content"><section className="panel control-hero"><div className="section-kicker"><FileText size={13}/> EVENT NOT LIVE</div><h1>BLUEPRINT LOCKED</h1><p>The participant workspace opens when the administrator starts the event.</p><p className="tiny">Current lifecycle state: {status}. Expected flow: DRAFT → READY → LIVE → PAUSED → ENDED.</p></section></main></div>;

 return <div className="app-shell">
  <header className="topbar"><button className="nav-btn" onClick={onBack}><ArrowLeft size={14}/> HOME</button><div><strong>BREACH X</strong><span className="topbar-sub"> PARTICIPANT // BLUEPRINT</span></div><span className="status-pill">{status}</span></header>
  <section className="problem-banner"><div className="section-kicker"><FileText size={13}/> APPLICATION TO EVALUATE</div><div className="field"><label>APPLICATION NAME</label><input value={applicationName} onChange={e=>setApplicationName(e.target.value)} disabled={submitted}/></div><div className="field"><label>APPLICATION REQUIREMENTS</label><textarea rows={4} value={applicationDescription} onChange={e=>setApplicationDescription(e.target.value)} disabled={submitted}/></div></section>
  <div className="workspace">
   <aside className="sidebar left-panel"><div className="section-kicker"><Layers size={13}/> COMPONENT PALETTE</div>{CATALOG.map(item=><button key={item.typeKey} className="catalog-item" draggable={!submitted} onDragStart={e=>{e.dataTransfer.setData("application/breachx-component",item.typeKey);e.dataTransfer.effectAllowed="move"}} onClick={()=>addCatalogNode(item)} disabled={submitted}><span>{item.label}</span><small>{item.category}</small></button>)}<div className="help-box"><strong>HOW TO CONNECT</strong><p>Drag from a colored handle on one component to a handle on another to create a directional connection.</p></div></aside>
   <section className="canvas"><div className="canvas-toolbar"><div><div className="section-kicker"><Layers size={13}/> SYSTEM DESIGN WORKSPACE</div><span className="counter">{nodes.length} components · {edges.length} connections{backendReady?" · SUPABASE SYNCED":""}</span></div><div className="toolbar-actions"><button onClick={()=>save("draft")} disabled={persisting||submitted}><Save size={13}/> {persisting?"SAVING…":"SAVE DRAFT"}</button><button className="primary-btn compact" disabled={!canSubmit||persisting} onClick={()=>save("submitted")}><Send size={13}/> {submitted?"SUBMITTED":"SUBMIT BLUEPRINT"}</button></div></div>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={handleNodesChange} onEdgesChange={handleEdgesChange} onConnect={onConnect} onNodeClick={(_,n)=>setSelectedId(n.id)} onPaneClick={()=>setSelectedId(null)} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move"}} onDrop={onDrop} fitView snapToGrid snapGrid={[16,16]} colorMode="dark" defaultEdgeOptions={{animated:true,markerEnd:{type:MarkerType.ArrowClosed}}}><Background variant={BackgroundVariant.Dots} gap={24} size={1.4}/><Controls position="bottom-left"/><MiniMap position="bottom-right"/></ReactFlow>
   </section>
   <aside className="sidebar right-panel"><div className="section-kicker">INSPECTOR</div>{selected?<><div className="field"><label>COMPONENT LABEL</label><input value={selected.data.label} disabled={submitted} onChange={e=>updateSelected("label",e.target.value)}/></div><div className="field"><label>COMPONENT DETAILS / RATIONALE</label><textarea rows={5} value={selected.data.notes??""} disabled={submitted} onChange={e=>updateSelected("notes",e.target.value)} placeholder="Explain why this component exists."/></div><button className="danger-btn" disabled={submitted} onClick={removeSelected}><Trash2 size={13}/> DELETE COMPONENT</button></>:<div className="empty-inspector">Select a component to edit its label, rationale or delete it.</div>}<div className="field notes-field"><label>ARCHITECTURE NOTES</label><textarea rows={12} disabled={submitted} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Describe request flow, scaling, security boundaries, caching, queues, persistence and failure handling."/></div><div className="submission-rule">{submitted?"Blueprint submitted and locked.":canSubmit?"Minimum graph requirements satisfied.":"Submission requires at least 3 components and 2 connections."}</div></aside>
  </div>
 </div>;
}
