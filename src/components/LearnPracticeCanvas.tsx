import { useMemo, useState } from "react";
import { addEdge, Background, Controls, ReactFlow, useEdgesState, useNodesState, type Connection, type Edge, type Node } from "@xyflow/react";
import { Check, RotateCcw, Waypoints } from "lucide-react";

type Props = { levelId: string; onComplete: () => void; completed: boolean };
type MissionNode = { id:string; label:string; detail:string };
const missions: Record<string,{nodes:MissionNode[];edges:[string,string][]}> = {
  foundations:{nodes:[{id:"client",label:"Client",detail:"Starts the request"},{id:"api",label:"API service",detail:"Validates and routes"},{id:"database",label:"Database",detail:"Persists the record"}],edges:[["client","api"],["api","database"]]},
  scaling:{nodes:[{id:"client",label:"Client",detail:"Requests product data"},{id:"api",label:"API service",detail:"Applies read policy"},{id:"cache",label:"Cache",detail:"Serves hot data"},{id:"database",label:"Database",detail:"Source of truth"}],edges:[["client","api"],["api","cache"],["cache","database"]]},
  resilience:{nodes:[{id:"client",label:"Client",detail:"Submits report request"},{id:"api",label:"API service",detail:"Accepts the request"},{id:"queue",label:"Message queue",detail:"Buffers background work"},{id:"worker",label:"Worker",detail:"Generates the report"},{id:"database",label:"Database",detail:"Stores report state"}],edges:[["client","api"],["api","queue"],["queue","worker"],["worker","database"]]},
};
const positions=[{x:20,y:110},{x:230,y:110},{x:440,y:110},{x:650,y:110},{x:860,y:110}];
function makeNodes(levelId:string):Node[] {
 return missions[levelId].nodes.map((item,index)=>({id:item.id,position:positions[index],data:{label:item.label,detail:item.detail},type:index===0?"input":index===missions[levelId].nodes.length-1?"output":"default"}));
}
export function LearnPracticeCanvas({levelId,onComplete,completed}:Props) {
 const mission=missions[levelId]??missions.foundations;
 const initialNodes=useMemo(()=>makeNodes(levelId),[levelId]);
 const [nodes,setNodes,onNodesChange]=useNodesState(initialNodes);
 const [edges,setEdges,onEdgesChange]=useEdgesState<Edge>([]);
 const [result,setResult]=useState<"idle"|"success"|"error">(completed?"success":"idle");
 const [message,setMessage]=useState("");
 const connect=(connection:Connection)=>{
   setEdges(current=>addEdge({...connection,id:`${connection.source}-${connection.target}`,label:"request",animated:true},current));
   setResult("idle");setMessage("");
 };
 const validate=()=>{
   const missing=mission.edges.filter(([source,target])=>!edges.some(edge=>edge.source===source&&edge.target===target));
   if(missing.length){setResult("error");setMessage(`Not quite. ${missing.length} required connection${missing.length===1?" is":"s are"} missing. Follow the task sequence above.`);return;}
   setResult("success");setMessage("Architecture validated. Every required component is connected in the correct order.");onComplete();
 };
 const reset=()=>{setNodes(makeNodes(levelId));setEdges([]);setResult(completed?"success":"idle");setMessage("");};
 return <div className="academy-challenge">
   <div className="academy-challenge-head"><div><span>ARCHITECTURE CANVAS</span><strong>Connect the components</strong></div><button type="button" onClick={reset} title="Reset connections"><RotateCcw size={14}/> Reset</button></div>
   <div className="academy-flow"><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={connect} fitView fitViewOptions={{padding:.16}} minZoom={.35} maxZoom={1.4} nodesDraggable nodesConnectable elementsSelectable>
     <Background gap={20} size={1}/><Controls showInteractive={false}/>
   </ReactFlow></div>
   <div className="academy-challenge-footer"><span><Waypoints size={13}/> Drag from a node handle to the next component</span><button type="button" className="academy-validate" onClick={validate} disabled={completed}><Check size={14}/> {completed?"Mission complete":"Validate architecture"}</button></div>
   {message&&<p className={`academy-feedback ${result}`} role="status">{message}</p>}
 </div>;
}
