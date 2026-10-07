import { useCallback, useMemo, useState } from "react";
import {
  addEdge, Background, BackgroundVariant, Controls, MiniMap, ReactFlow,
  ReactFlowProvider, MarkerType, useEdgesState, useNodesState, useReactFlow,
  type Connection, type Edge, type Node
} from "@xyflow/react";
import { ArrowLeft, FileText, Layers, Save, Send, Trash2 } from "lucide-react";
import { BlueprintNode, type BlueprintNodeData } from "../components/BlueprintNode";
import { CATALOG, type CatalogItem } from "../lib/catalog";
import { readStatus, readSubmission, writeSubmission, logActivity } from "../lib/storage";

const PROBLEMS = [
  "Design a resilient payment platform that handles burst traffic, duplicate requests, partial third-party failures and auditable financial state.",
  "Design a multi-tenant collaboration application with real-time updates, authorization isolation, durable storage and graceful degradation.",
  "Design a high-throughput telemetry platform with buffering, horizontal scaling, rate limiting and long-term analytical storage.",
  "Design an image-processing platform with asynchronous jobs, object storage, retries, deduplication and workload isolation."
];

const initialNodes: Node<BlueprintNodeData>[] = [
  { id:"node-1", type:"blueprintNode", position:{x:80,y:160}, data:{label:"Client / User App",typeKey:"client",category:"Edge"} },
  { id:"node-2", type:"blueprintNode", position:{x:330,y:160}, data:{label:"WAF / Firewall",typeKey:"firewall",category:"Security"} },
  { id:"node-3", type:"blueprintNode", position:{x:590,y:160}, data:{label:"API Gateway",typeKey:"api_gateway",category:"Routing"} }
];
const initialEdges: Edge[] = [
  { id:"e1-2", source:"node-1", target:"node-2", animated:true, markerEnd:{type:MarkerType.ArrowClosed} },
  { id:"e2-3", source:"node-2", target:"node-3", animated:true, markerEnd:{type:MarkerType.ArrowClosed} }
];

export function ParticipantPage({onBack}:{onBack:()=>void}) {
  return <ReactFlowProvider><ParticipantEditor onBack={onBack}/></ReactFlowProvider>;
}
function ParticipantEditor({onBack}:{onBack:()=>void}) {
  const { screenToFlowPosition } = useReactFlow();
  const saved = readSubmission();
  const [nodes,setNodes,onNodesChange] = useNodesState((saved?.nodes as Node<BlueprintNodeData>[]) ?? initialNodes);
  const [edges,setEdges,onEdgesChange] = useEdgesState((saved?.edges as Edge[]) ?? initialEdges);
  const [notes,setNotes] = useState(saved?.notes ?? "");
  const [selectedId,setSelectedId] = useState<string | null>(null);
  const [status,setStatus] = useState(readStatus());
  const [problem] = useState(saved?.problem ?? PROBLEMS[Math.floor(Math.random()*PROBLEMS.length)]);
  const nodeTypes = useMemo(()=>({blueprintNode:BlueprintNode}),[]);
  const selected = nodes.find(n=>n.id===selectedId);
  const addCatalogNode = (item:CatalogItem, position?:{x:number;y:number}) => {
    const id = crypto.randomUUID();
    const node:Node<BlueprintNodeData> = {
      id,type:"blueprintNode",
      position:position ?? {x:120+Math.random()*420,y:90+Math.random()*320},
      data:{label:item.label,typeKey:item.typeKey,category:item.category}
    };
    setNodes(current=>[...current,node]);
    setSelectedId(id);
    logActivity("NODE_ADDED",{typeKey:item.typeKey,label:item.label});
  };
  const onDrop = useCallback((event:React.DragEvent) => {
    event.preventDefault();
    const typeKey = event.dataTransfer.getData("application/breachx-component");
    const item = CATALOG.find(entry=>entry.typeKey===typeKey);
    if (!item) return;
    addCatalogNode(item, screenToFlowPosition({x:event.clientX,y:event.clientY}));
  }, [screenToFlowPosition]);
  const onConnect = useCallback((connection:Connection) => {
    setEdges(current=>addEdge({...connection,animated:true,markerEnd:{type:MarkerType.ArrowClosed}},current));
    logActivity("EDGE_CREATED",{source:connection.source,target:connection.target});
  },[]);
  const save = (submissionStatus:"draft"|"submitted") => {
    const next = {teamId:"demo-team",teamName:"Demo Team",problem,nodes,edges,notes,status:submissionStatus,updatedAt:new Date().toISOString()};
    writeSubmission(next);
    logActivity(submissionStatus==="submitted"?"BLUEPRINT_SUBMITTED":"BLUEPRINT_SAVED",{nodes:nodes.length,edges:edges.length});
    setStatus(submissionStatus==="submitted"?"LIVE":"LIVE");
    setStatus(readStatus());
    if (submissionStatus==="submitted") alert("Blueprint submitted to the Breach X control center.");
  };
  const updateSelected = (field:"label"|"notes",value:string) => {
    if (!selectedId) return;
    setNodes(current=>current.map(node=>node.id===selectedId?{...node,data:{...node.data,[field]:value}}:node));
    logActivity("NODE_UPDATED",{nodeId:selectedId,field});
  };
  const removeSelected = () => {
    if (!selectedId) return;
    setNodes(current=>current.filter(node=>node.id!==selectedId));
    setEdges(current=>current.filter(edge=>edge.source!==selectedId && edge.target!==selectedId));
    logActivity("NODE_DELETED",{nodeId:selectedId});
    setSelectedId(null);
  };
  const canSubmit = nodes.length >= 3 && edges.length >= 2;
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="nav-btn" onClick={onBack}><ArrowLeft size={14}/> HOME</button>
        <div><strong>BREACH X</strong><span className="topbar-sub"> PARTICIPANT // BLUEPRINT</span></div>
        <span className="status-pill">{status}</span>
      </header>
      <section className="problem-banner">
        <div className="section-kicker"><FileText size={13}/> PROBLEM STATEMENT // RANDOMLY ASSIGNED</div>
        <div className="problem-text">{problem}</div>
      </section>
      <div className="workspace">
        <aside className="sidebar left-panel">
          <div className="section-kicker"><Layers size={13}/> COMPONENT PALETTE</div>
          {CATALOG.map(item=>(
            <button key={item.typeKey} className="catalog-item" draggable onDragStart={e=>{e.dataTransfer.setData("application/breachx-component",item.typeKey);e.dataTransfer.effectAllowed="move"}} onClick={()=>addCatalogNode(item)}>
              <span>{item.label}</span><small>{item.category}</small>
            </button>
          ))}
          <div className="help-box"><strong>HOW TO CONNECT</strong><p>Drag from a colored handle on one component to a handle on another to create a directional connection.</p></div>
        </aside>
        <section className="canvas">
          <div className="canvas-toolbar">
            <div><div className="section-kicker"><Layers size={13}/> STAGE 1 // SYSTEM BLUEPRINT</div><span className="counter">{nodes.length} components · {edges.length} connections</span></div>
            <div className="toolbar-actions">
              <button onClick={()=>save("draft")}><Save size={13}/> SAVE DRAFT</button>
              <button className="primary-btn compact" disabled={!canSubmit} onClick={()=>save("submitted")}><Send size={13}/> SUBMIT BLUEPRINT</button>
            </div>
          </div>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_,node)=>setSelectedId(node.id)} onPaneClick={()=>setSelectedId(null)} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move"}} onDrop={onDrop} fitView snapToGrid snapGrid={[16,16]} colorMode="dark" defaultEdgeOptions={{animated:true,markerEnd:{type:MarkerType.ArrowClosed}}}>
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.4}/>
            <Controls position="bottom-left"/><MiniMap position="bottom-right"/>
          </ReactFlow>
        </section>
        <aside className="sidebar right-panel">
          <div className="section-kicker">INSPECTOR</div>
          {selected ? <>
            <div className="field"><label>COMPONENT LABEL</label><input value={selected.data.label} onChange={e=>updateSelected("label",e.target.value)}/></div>
            <div className="field"><label>COMPONENT DETAILS / RATIONALE</label><textarea rows={5} value={selected.data.notes ?? ""} onChange={e=>updateSelected("notes",e.target.value)} placeholder="Explain why this component exists."/></div>
            <button className="danger-btn" onClick={removeSelected}><Trash2 size={13}/> DELETE COMPONENT</button>
          </> : <div className="empty-inspector">Select a component to edit its label, rationale or delete it.</div>}
          <div className="field notes-field"><label>ARCHITECTURE NOTES</label><textarea rows={12} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Describe request flow, scaling, security boundaries, caching, queues, persistence and failure handling."/></div>
          <div className="submission-rule">{canSubmit ? "Minimum graph requirements satisfied." : "Submission requires at least 3 components and 2 connections."}</div>
        </aside>
      </div>
    </div>
  );
}