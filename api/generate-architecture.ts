import { CATALOG } from "../src/lib/catalog.js";
import { AI_REQUEST_LIMITS, authorizeAndRateLimit, validateGeneratorPayload } from "./_shared/security";
declare const process: { env: Record<string, string | undefined> };
export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };
const send=(res:any,status:number,body:unknown)=>res.status(status).setHeader("Content-Type","application/json").json(body);
export default async function handler(req:any,res:any){
 if(req.method!=="POST")return send(res,405,{error:"Method not allowed"});
 const authorized=await authorizeAndRateLimit(req,res,AI_REQUEST_LIMITS.generatorBodyBytes);if(!authorized)return;
 const body=req.body as Record<string,unknown>;const validationError=validateGeneratorPayload(body);if(validationError)return send(res,400,{error:validationError});
 const {name,requirements}=body as {name:string;requirements:string};
 const key=process.env.OPENROUTER_API_KEY;
 if(!key)return send(res,503,{error:"Architecture generation is not configured on the server."});
 const catalog=CATALOG.map(x=>({typeKey:x.typeKey,label:x.label,category:x.category}));
 const schema={type:"object",additionalProperties:false,properties:{
  architectureName:{type:"string"},overview:{type:"string"},requestFlow:{type:"string"},designDecisions:{type:"array",items:{type:"string"}},
  components:{type:"array",minItems:3,maxItems:24,items:{type:"object",additionalProperties:false,properties:{id:{type:"string"},typeKey:{type:"string"},label:{type:"string"},notes:{type:"string"}},required:["id","typeKey","label","notes"]}},
  connections:{type:"array",maxItems:48,items:{type:"object",additionalProperties:false,properties:{source:{type:"string"},target:{type:"string"},label:{type:"string"}},required:["source","target","label"]}}
 },required:["architectureName","overview","requestFlow","designDecisions","components","connections"]};
 try{
  const response=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json","HTTP-Referer":process.env.APP_URL??"https://breachx-ashy.vercel.app","X-Title":"Breach X Architecture Generator"},body:JSON.stringify({model:process.env.OPENROUTER_MODEL??"openrouter/free",temperature:0.2,messages:[{role:"system",content:"Design a practical architecture from requirements. Use only component typeKey values in this catalog: "+JSON.stringify(catalog)+". Return a coherent directed graph with a primary request path. Avoid unnecessary complexity. Connections must refer to component IDs. Explain each component in notes and key tradeoffs in designDecisions. Catalog: "+JSON.stringify(catalog)},{role:"user",content:JSON.stringify({name,requirements})}],provider:{require_parameters:true},response_format:{type:"json_schema",json_schema:{name:"architecture",strict:true,schema}}}),signal:AbortSignal.timeout(20_000)});
  if(!response.ok)return send(res,502,{error:"The architecture provider failed. Check server configuration and try again."});
  const payload=await response.json();const raw=payload?.choices?.[0]?.message?.content;if(typeof raw!=="string")return send(res,502,{error:"No architecture was returned."});
  const parsed=JSON.parse(raw);const catalogByType=new Map(CATALOG.map(x=>[x.typeKey,x]));const used=new Set<string>();
  const components=(Array.isArray(parsed.components)?parsed.components:[]).slice(0,24).flatMap((n:any,i:number)=>{const item=catalogByType.get(n.typeKey);if(!item)return[];let id=String(n.id||"component-"+i).replace(/[^a-zA-Z0-9_-]/g,"-").slice(0,60)||"component-"+i;if(used.has(id))id+="-"+i;used.add(id);return[{id,typeKey:item.typeKey,label:String(n.label||item.label).slice(0,80),category:item.category,notes:String(n.notes||"").slice(0,400)}]});
  if(components.length<3)return send(res,502,{error:"The generated architecture did not contain enough valid components."});
  const ids=new Set(components.map((n:any)=>n.id));const connections=(Array.isArray(parsed.connections)?parsed.connections:[]).filter((e:any)=>ids.has(e.source)&&ids.has(e.target)&&e.source!==e.target).slice(0,48).map((e:any)=>({source:e.source,target:e.target,label:String(e.label||"").slice(0,80)}));
  if(connections.length<2)return send(res,502,{error:"The generated architecture did not contain enough valid connections."});
  return send(res,200,{architectureName:String(parsed.architectureName||name).slice(0,120),overview:String(parsed.overview||""),requestFlow:String(parsed.requestFlow||""),designDecisions:Array.isArray(parsed.designDecisions)?parsed.designDecisions.slice(0,8).map((v:unknown)=>String(v).slice(0,500)):[],components,connections});
 }catch{return send(res,502,{error:"Could not generate a valid architecture. Please try again."})}
}