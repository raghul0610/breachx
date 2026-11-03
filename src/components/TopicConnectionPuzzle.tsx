import { useCallback, useMemo, useState } from "react";
import { Background, Controls, ReactFlow, addEdge, useEdgesState, useNodesState, type Connection, type Edge, type Node } from "@xyflow/react";
import { Check, RotateCcw, Waypoints } from "lucide-react";

type Props = { topicId:string; title:string; prompt:string; explanation:string; onSolved:()=>void; solved:boolean };
const nodeLabels = [
  ["Client","API Gateway","Application Service","Database"],
  ["Producer","Event Bus","Consumer","Database"],
  ["Browser","Identity Provider","Authorization Layer","Protected Resource"],
  ["Client","Load Balancer","Application Pool","Cache"],
  ["Upload API","Object Storage","Processing Queue","Worker"],
  ["Primary Database","Change Stream","Read Model","Search Index"],
  ["Service A","Message Broker","Service B","Outbox Relay"],
  ["Edge Router","Regional Gateway","Regional Service","Replica"],
  ["Request Handler","Rate Limiter","Queue","Worker Pool"],
  ["Application","Telemetry SDK","Collector","Observability Backend"]
] as const;
const edgeTargets = [[0,1],[1,2],[2,3],[0,1],[0,1],[1,2],[3,1],[0,1],[1,2],[1,2]] as const;
export function TopicConnectionPuzzle({topicId,title,prompt,explanation,onSolved,solved}:Props){
 const seed=Array.from(topicId).reduce((sum,char)=>sum+char.charCodeAt(0),0)%nodeLabels.length;
 const labels=nodeLabels[seed];
 const target=edgeTargets[seed];
 const initialNodes:Node[]=labels.map((label,index)=>({id:String(index),position:{x:30+(index%2)*270,y:35+Math.floor(index/2)*150},data:{label},type:"default",style:{width:190,minHeight:76,display:"grid",placeItems:"center",border:"1px solid #71818a",borderRadius:12,background:"#202a30",color:"#eef3f5",fontSize:14,fontWeight:700,padding:12}}));
 const [nodes,setNodes,onNodesChange]=useNodesState(initialNodes);
 const [edges,setEdges,onEdgesChange]=useEdgesState<Edge>([]);
 const [feedback,setFeedback]=useState("");
 const connect=useCallback((connection:Connection)=>{if(!connection.source||!connection.target)return;setEdges(current=>addEdge({...connection,id:`${connection.source}-${connection.target}-${current.length}`,animated:true,style:{stroke:"#d4dde1",strokeWidth:2}},current));setFeedback("");},[setEdges]);
 const valid=useMemo(()=>edges.some(edge=>edge.source===String(target[0])&&edge.target===String(target[1])),[edges,target]);
 const check=()=>{if(valid){setFeedback("Correct connection. You have modelled the required dependency.");onSolved();}else setFeedback(`Not quite. Trace the responsibility described in the task and connect the correct upstream node to its downstream owner.`);};
 const reset=()=>{setEdges([]);setFeedback("");};
 return <section className="academy-topic-puzzle">
  <header><span><Waypoints size={15}/> CONNECTION PUZZLE</span><small>{solved?"SOLVED":"ONE REQUIRED CONNECTION"}</small></header>
  <h4>Build the missing relationship</h4>
  <p>{prompt}</p>
  <div className="academy-topic-flow"><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={connect} fitView fitViewOptions={{padding:.18}} nodesDraggable nodesConnectable elementsSelectable deleteKeyCode={["Backspace","Delete"]}><Background gap={20} color="#43525a" size={1}/><Controls showInteractive={false}/></ReactFlow></div>
  <div className="academy-topic-puzzle-actions"><span>Drag from a node handle to the node that should receive its output.</span><div><button type="button" onClick={reset}><RotateCcw size={13}/> Reset</button><button type="button" onClick={check}><Check size={13}/> Check connection</button></div></div>
  {feedback&&<p className={valid?"academy-topic-feedback success":"academy-topic-feedback"} role="status">{feedback}</p>}
  {solved&&<p className="academy-topic-explanation"><strong>WHY THIS CONNECTION MATTERS</strong>{explanation}</p>}
 </section>;
}
