export type EvaluationNode={id:string;type?:string;data?:{label?:string;typeKey?:string;category?:string;notes?:string}};
export type EvaluationEdge={id?:string;source:string;target:string};
export type EvaluationInput={application:{name:string;description:string};nodes:EvaluationNode[];edges:EvaluationEdge[];notes?:string};
export type FindingSeverity="critical"|"high"|"medium"|"low";
export type EvaluationFinding={id:string;category:string;severity:FindingSeverity;title:string;description:string;evidence:string[];recommendation:string};
export type EvaluationScore={category:string;score:number;maxScore:number;summary:string};
export type EvaluationResult={score:number;maxScore:100;scores:EvaluationScore[];findings:EvaluationFinding[];strengths:string[];summary:string;generatedAt:string};

const key=(n:EvaluationNode)=>n.data?.typeKey??"";
const label=(n:EvaluationNode)=>(n.data?.label ?? key(n)) || n.id;

export function evaluateSystemDesign(input:EvaluationInput):EvaluationResult{
 const nodes=input.nodes??[],edges=input.edges??[],findings:EvaluationFinding[]=[];
 const add=(id:string,category:string,severity:FindingSeverity,title:string,description:string,evidence:string[],recommendation:string)=>{
   if(!findings.some(f=>f.id===id)) findings.push({id,category,severity,title,description,evidence,recommendation});
 };
 const types=new Set(nodes.map(key)), incoming=new Map(nodes.map(n=>[n.id,0])), outgoing=new Map(nodes.map(n=>[n.id,0]));
 for(const e of edges){if(incoming.has(e.target))incoming.set(e.target,(incoming.get(e.target)??0)+1);if(outgoing.has(e.source))outgoing.set(e.source,(outgoing.get(e.source)??0)+1);}
 const databases=nodes.filter(n=>key(n)==="database"),apps=nodes.filter(n=>key(n)==="app_server"),caches=nodes.filter(n=>key(n)==="cache"),queues=nodes.filter(n=>key(n)==="queue");
 const publicNodes=nodes.filter(n=>["client","internet","firewall","load_balancer","api_gateway"].includes(key(n)));
 const orphan=nodes.filter(n=>(incoming.get(n.id)??0)+(outgoing.get(n.id)??0)===0);
 if(orphan.length)add("ORPHAN_COMPONENT","architecture","medium","Orphaned components","Some components are disconnected from the request flow.",orphan.map(label),"Connect or remove components that are not part of the architecture.");
 if(!databases.length)add("NO_DATABASE","data","high","No persistence layer","The design contains no database or durable persistence component.",["No database node"],"Add an appropriate persistent data store if the application requires durable state.");
 if(apps.length>0&&apps.length<2&&!types.has("load_balancer"))add("SINGLE_APP_CAPACITY","scalability","medium","Single application instance","Only one application server is defined and there is no load balancer.",apps.map(label),"Define horizontal application scaling and a load-balancing strategy for meaningful traffic.");
 if(databases.length===1&&nodes.length>=5)add("DATABASE_SPOF","reliability","high","Database single point of failure","The architecture has one database instance and no visible replication or failover strategy.",databases.map(label),"Define replication, failover, backups, or another availability strategy appropriate to the workload.");
 if(types.has("queue")&&queues.some(q=>(outgoing.get(q.id)??0)===0))add("QUEUE_WITHOUT_CONSUMER","architecture","high","Queue without a consumer","A message queue is present but no downstream component is connected to consume its messages.",queues.filter(q=>(outgoing.get(q.id)??0)===0).map(label),"Connect the queue to a worker or service that consumes and processes messages.");
 if(types.has("cache")&&databases.length===0)add("CACHE_WITHOUT_STORE","data","medium","Cache without durable store","A cache is present without a visible durable persistence layer.",caches.map(label),"Use the cache as an acceleration layer in front of a durable source of truth.");
 if(databases.some(n=>(incoming.get(n.id)??0)>0&&publicNodes.some(p=>edges.some(e=>e.source===p.id&&e.target===n.id))))add("PUBLIC_DATABASE_PATH","security","critical","Direct public database path","A public-facing component is directly connected to a database.",["Public component → database"],"Place an application/service boundary between public traffic and the database.");
 if(!types.has("firewall")&&nodes.length>=5)add("NO_SECURITY_BOUNDARY","security","medium","No visible security boundary","The design has no WAF or firewall component.",["No WAF / Firewall"],"Define a network or application security boundary appropriate to the threat model.");
 if(!types.has("load_balancer")&&apps.length>1)add("MULTI_APP_NO_LB","scalability","medium","Multiple app servers without load balancing","Multiple application instances exist without a visible load balancer.",apps.map(label),"Add a load balancer or service-discovery mechanism to distribute traffic.");
 if(!types.has("queue")&&nodes.length>=7)add("NO_ASYNC_PATH","performance","low","No asynchronous processing path","The design is relatively complex but contains no visible asynchronous processing mechanism.",["No queue"],"Consider asynchronous processing for long-running, bursty, or non-critical work.");
 if((input.notes??"").trim().length<40)add("LIMITED_RATIONALE","tradeoffs","low","Limited architecture rationale","The submission contains little written explanation of its architectural decisions.",["Architecture notes are brief or empty"],"Explain major technology choices, bottlenecks, failure modes, and trade-offs.");

 const scoreFor=(category:string,max:number,penalty:number)=>Math.max(0,max-findings.filter(f=>f.category===category).length*penalty);
 const scores:EvaluationScore[]=[
  {category:"Architecture",score:scoreFor("architecture",20,4),maxScore:20,summary:types.has("client")||types.has("internet")?"Ingress is represented.":"The request ingress is unclear."},
  {category:"Scalability",score:scoreFor("scalability",15,4),maxScore:15,summary:"Evaluated visible scaling and traffic-distribution mechanisms."},
  {category:"Reliability",score:scoreFor("reliability",15,5),maxScore:15,summary:"Evaluated redundancy and failure boundaries."},
  {category:"Security",score:scoreFor("security",15,6),maxScore:15,summary:"Evaluated security boundaries and public data paths."},
  {category:"Data Design",score:scoreFor("data",10,4),maxScore:10,summary:"Evaluated persistence and data-layer structure."},
  {category:"Performance",score:scoreFor("performance",10,3),maxScore:10,summary:"Evaluated caching and asynchronous processing."},
  {category:"Fault Tolerance",score:scoreFor("reliability",5,2),maxScore:5,summary:"Evaluated visible resilience mechanisms."},
  {category:"Trade-offs",score:scoreFor("tradeoffs",5,2),maxScore:5,summary:"Evaluated architectural rationale."},
  {category:"Completeness",score:Math.max(0,5-(nodes.length<3?3:0)-(edges.length<2?2:0)),maxScore:5,summary:"Evaluated submission completeness."}
 ];
 const score=Math.round(scores.reduce((a,s)=>a+s.score,0)),critical=findings.filter(f=>f.severity==="critical").length,strengths:string[]=[];
 if(types.has("firewall"))strengths.push("A visible security boundary is included.");
 if(types.has("load_balancer"))strengths.push("Traffic distribution is explicitly represented.");
 if(types.has("cache"))strengths.push("A caching layer is represented.");
 if(types.has("queue"))strengths.push("Asynchronous processing is represented.");
 if(databases.length&&apps.length)strengths.push("Application and persistence layers are separated.");
 if(!strengths.length)strengths.push("The submission provides a concrete component graph that can be evaluated.");
 return {score,maxScore:100,scores,findings,strengths,summary:critical?"The architecture scored "+score+"/100 and contains "+critical+" critical issue"+(critical===1?"":"s")+".":findings.length?"The architecture scored "+score+"/100 with "+findings.length+" improvement finding"+(findings.length===1?"":"s")+".":"The architecture scored "+score+"/100 with no rule-based findings.",generatedAt:new Date().toISOString()};
}
