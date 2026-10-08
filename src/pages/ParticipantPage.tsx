import { useCallback,useEffect,useMemo,useState } from "react";
import { addEdge,Background,BackgroundVariant,Controls,MiniMap,ReactFlow,ReactFlowProvider,MarkerType,useEdgesState,useNodesState,useReactFlow,type Connection,type Edge,type Node } from "@xyflow/react";
import { ArrowLeft,FileText,Layers,Save,Send,Trash2 } from "lucide-react";
import { BlueprintNode,type BlueprintNodeData } from "../components/BlueprintNode";
import { CATALOG,type CatalogItem } from "../lib/catalog";
import { getActiveProblems } from "../lib/db";
import { readStatus,readSubmission,writeSubmission,logActivity,type EventStatus } from "../lib/storage";

const initialNodes:Node<BlueprintNodeData>[]=[
 {id:"node-1",type:"blueprintNode",position:{x:80,y:160},data:{label:"Client / User App",typeKey:"client",category:"Edge"}},
 {id:"node-2",type:"blueprintNode",position:{x:330,y:160},data:{label:"WAF / Firewall",typeKey:"firewall",category:"Security"}},
 {id:"node-3",type:"blueprintNode",position:{x:590,y:160},data:{label:"API Gateway",typeKey:"api_gateway",category:"Routing"}}
];
const initialEdges:Edge[]=[
 {id:"e1-2",source:"node-1",target:"node-2",animated:true,markerEnd:{type:MarkerType.ArrowClosed}},
 {id:"e2-3",source:"node-2",target:"node-3",animated:true,markerEnd:{type:MarkerType.ArrowClosed}}
];

export function ParticipantPage({onBack}:{onBack:()=>void}){ return <ReactFlowProvider><ParticipantEditor onBack={onBack}/></ReactFlowProvider>; }

function ParticipantEditor({onBack}:{onBack:()=>void}){
 const {screenToFlowPosition}=useReactFlow(); const saved=readSubmission();
 const [nodes,setNodes,onNodesChange]=useNodesState((saved?.nodes as Node<BlueprintNodeData>[])??initialNodes);
 const [edges,setEdges,onEdgesChange]=useEdgesState((saved?.edges as Edge[])??initialEdges);
 const [notes,setNotes]=useState(saved?.notes??""); const [selectedId,setSelectedId]=useState<string|null>(null);
 const [status,setStatus]=useState<EventStatus>(readStatus()); const [problem,setProblem]=useState(saved?.problem??"");
 const [loading,setLoading]=useState(!saved?.problem); const [problemError,setProblemError]=useState("");
 const nodeTypes=useMemo(()=>({blueprintNode:BlueprintNode}),[]); const selected=nodes.find(n=>n.id===selectedId);

 useEffect(()=>{const sync=()=>setStatus(readStatus()); window.addEventListener("breachx-sync",sync); window.addEventListener("storage",sync); return()=>{window.removeEventListener("breachx-sync",sync);window.removeEventListener("storage",sync)}},[]);
 useEffect(()=>{
   if(saved?.problem)return; let cancelled=false;
   (async()=>{try{const result=await getActiveProblems(); if(cancelled)return; if(!result.problems.length){setProblemError("No active problem statements are configured.");return;}
     const chosen=result.problems[Math.floor(Math.random()*result.problems.length)]; setProblem(chosen.statement);
     logActivity("PROBLEM_ASSIGNED",{problemId:chosen.id,track:chosen.track});
   }catch(e){if(!cancelled)setProblemError(e instanceof Error?e.message:"Unable to load problem.");}
   finally{if(!cancelled)setLoading(false)}})();
   return()=>{cancelled=true};
 },[saved?.problem]);

 const addCatalogNode=(item:CatalogItem,position?:{x:number;y:number})=>{
   if(status!=="LIVE")return; const id=crypto.randomUUID();
   setNodes(current=>[...current,{id,type:"blueprintNode",position:position??{x:120+Math.random()*420,y:90+Math.random()*320},data:{label:item.label,typeKey:item.typeKey,category:item.category}}]);
   setSelectedId(id); logActivity("NODE_ADDED",{typeKey:item.typeKey,label:item.label});
 };
 const onDrop=useCallback((e:React.DragEvent)=>{e.preventDefault();if(status!=="LIVE")return;const item=CATALOG.find(x=>x.typeKey===e.dataTransfer.getData("application/breachx-component"));if(item)addCatalogNode(item,screenToFlowPosition({x:e.clientX,y:e.clientY}))},[screenToFlowPosition,status]);
 const onConnect=useCallback((c:Connection)=>{if(status!=="LIVE")return;setEdges(cur=>addEdge({...c,animated:true,markerEnd:{type:MarkerType.ArrowClosed}},cur));logActivity("EDGE_CREATED",{source:c.source,target:c.target})},[status,setEdges]);

 const save=(submissionStatus:"draft"|"submitted")=>{
   if(status!=="LIVE"){alert("Blueprint editing is available only while the event is LIVE.");return}
   if(!problem){alert("Problem statement is still loading.");return}
   if(submissionStatus==="submitted"&&(nodes.length<3||edges.length<2)){alert("Submission requires at least 3 components and 2 connections.");return}
   writeSubmission({teamId:"demo-team",teamName:"Demo Team",problem,nodes,edges,notes,status:submissionStatus,updatedAt:new Date().toISOString()});
   logActivity(submissionStatus==="submitted"?"BLUEPRINT_SUBMITTED":"BLUEPRINT_SAVED",{nodes:nodes.length,edges:edges.length});
   if(submissionStatus==="submitted")alert("Blueprint submitted to the Breach X control center.");
 };
 const updateSelected=(field:"label"|"notes",value:string)=>{if(!selectedId||status!=="LIVE")return;setNodes(cur=>cur.map(n=>n.id===selectedId?{...n,data:{...n.data,[field]:value}}:n))};
 const removeSelected=()=>{if(!selectedId||status!=="LIVE")return;setNodes(cur=>cur.filter(n=>n.id!==selectedId));setEdges(cur=>cur.filter(e=>e.source!==selectedId&&e.target!==selectedId));logActivity("NODE_DELETED",{nodeId:selectedId});setSelectedId(null)};
 const canSubmit=status==="LIVE"&&!!problem&&nodes.length>=3&&edges.length>=2;

 if(status!=="LIVE")return <div className="app-shell"><header className="topbar"><button className="nav-btn" onClick={onBack}><ArrowLeft size={14}/> HOME</button><div><strong>BREACH X</strong><span className="topbar-sub"> PARTICIPANT // BLUEPRINT</span></div><span className="status-pill">{status}</span></header><main className="admin-content"><section className="panel control-hero"><div className="section-kicker"><FileText size={13}/> EVENT NOT LIVE</div><h1>BLUEPRINT LOCKED</h1><p>The participant workspace opens when the administrator starts the event.</p><p className="tiny">Current lifecycle state: {status}. Expected flow: DRAFT → READY → LIVE → PAUSED → ENDED.</p></section></main></div>;

 return <div className="app-shell">
  <header className="topbar"><button className="nav-btn" onClick={onBack}><ArrowLeft size={14}/> HOME</button><div><strong>BREACH X</strong><span className="topbar-sub"> PARTICIPANT // BLUEPRINT</span></div><span className="status-pill">{status}</span></header>
  <section className="problem-banner"><div className="section-kicker"><FileText size={13}/> PROBLEM STATEMENT // RANDOMLY ASSIGNED FROM SUPABASE</div><div className="problem-text">{loading?"Loading assigned problem…":problem||problemError}</div></section>
  <div className="workspace">
   <aside className="sidebar left-panel"><div className="section-kicker"><Layers size={13}/> COMPONENT PALETTE</div>{CATALOG.map(item=><button key={item.typeKey} className="catalog-item" draggable onDragStart={e=>{e.dataTransfer.setData("application/breachx-component",item.typeKey);e.dataTransfer.effectAllowed="move"}} onClick={()=>addCatalogNode(item)}><span>{item.label}</span><small>{item.category}</small></button>)}<div className="help-box"><strong>HOW TO CONNECT</strong><p>Drag from a colored handle on one component to a handle on another to create a directional connection.</p></div></aside>
   <section className="canvas"><div className="canvas-toolbar"><div><div className="section-kicker"><Layers size={13}/> STAGE 1 // SYSTEM BLUEPRINT</div><span className="counter">{nodes.length} components · {edges.length} connections</span></div><div className="toolbar-actions"><button onClick={()=>save("draft")}><Save size={13}/> SAVE DRAFT</button><button className="primary-btn compact" disabled={!canSubmit} onClick={()=>save("submitted")}><Send size={13}/> SUBMIT BLUEPRINT</button></div></div>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_,n)=>setSelectedId(n.id)} onPaneClick={()=>setSelectedId(null)} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move"}} onDrop={onDrop} fitView snapToGrid snapGrid={[16,16]} colorMode="dark" defaultEdgeOptions={{animated:true,markerEnd:{type:MarkerType.ArrowClosed}}}><Background variant={BackgroundVariant.Dots} gap={24} size={1.4}/><Controls position="bottom-left"/><MiniMap position="bottom-right"/></ReactFlow>
   </section>
   <aside className="sidebar right-panel"><div className="section-kicker">INSPECTOR</div>{selected?<><div className="field"><label>COMPONENT LABEL</label><input value={selected.data.label} onChange={e=>updateSelected("label",e.target.value)}/></div><div className="field"><label>COMPONENT DETAILS / RATIONALE</label><textarea rows={5} value={selected.data.notes??""} onChange={e=>updateSelected("notes",e.target.value)} placeholder="Explain why this component exists."/></div><button className="danger-btn" onClick={removeSelected}><Trash2 size={13}/> DELETE COMPONENT</button></>:<div className="empty-inspector">Select a component to edit its label, rationale or delete it.</div>}<div className="field notes-field"><label>ARCHITECTURE NOTES</label><textarea rows={12} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Describe request flow, scaling, security boundaries, caching, queues, persistence and failure handling."/></div><div className="submission-rule">{canSubmit?"Minimum graph requirements satisfied.":"Submission requires at least 3 components and 2 connections."}</div></aside>
  </div>
 </div>;
}