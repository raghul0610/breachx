import { supabase } from "./supabase";

export type BlueprintRecord = {
  id: string;
  event_id: string;
  team_id: string;
  problem_assignment_id: string;
  nodes: unknown[];
  edges: unknown[];
  viewport: Record<string, unknown>;
  notes: string;
  status: "DRAFT" | "SUBMITTED";
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BlueprintPayload = {
  eventId: string;
  teamId: string;
  problemAssignmentId: string;
  nodes: unknown[];
  edges: unknown[];
  viewport: Record<string, unknown>;
  notes: string;
};

export async function getBreachXEvent(){
  const {data,error}=await supabase.from("events").select("id,name,status,starts_at,ends_at,created_at,updated_at").eq("name","Breach X").order("created_at",{ascending:true}).limit(1).maybeSingle();
  if(error) throw error; return data;
}

export async function getTracks(eventId:string){
  const {data,error}=await supabase.from("tracks").select("id,event_id,name,slug,description").eq("event_id",eventId).order("name");
  if(error) throw error; return data;
}

export async function getProblemStatements(trackId:string){
  const {data,error}=await supabase.from("problem_statements").select("id,track_id,title,statement,difficulty,is_active,created_at").eq("track_id",trackId).eq("is_active",true).order("created_at");
  if(error) throw error; return data;
}

export async function getActiveProblems(){
  const event=await getBreachXEvent(); if(!event) return {event:null,problems:[]};
  const tracks=await getTracks(event.id);
  const groups=await Promise.all(tracks.map(track=>getProblemStatements(track.id)));
  return {event,problems:groups.flat().map(problem=>({...problem,track:tracks.find(track=>track.id===problem.track_id)?.name??"Unknown Track"}))};
}

export async function getMyTeam(){
  const {data:{user}}=await supabase.auth.getUser(); if(!user) return null;
  const {data,error}=await supabase.from("team_members").select("team_id, teams(*)").eq("user_id",user.id).limit(1).maybeSingle();
  if(error) throw error; return data;
}

export async function getMyProblemAssignment(teamId:string,eventId:string){
  const {data,error}=await supabase
    .from("problem_assignments")
    .select("id,event_id,team_id,track_id,problem_statement_id,assigned_at,problem_statements(id,title,statement,difficulty)")
    .eq("team_id",teamId)
    .eq("event_id",eventId)
    .limit(1)
    .maybeSingle();
  if(error) throw error;
  return data;
}

export async function getMyBlueprint(teamId:string):Promise<BlueprintRecord|null>{
  const {data,error}=await supabase.from("blueprints").select("*").eq("team_id",teamId).limit(1).maybeSingle();
  if(error) throw error; return data as BlueprintRecord|null;
}

async function requireUser(){
  const {data:{user},error}=await supabase.auth.getUser();
  if(error) throw error;
  if(!user) throw new Error("AUTH_REQUIRED");
  return user;
}

export async function saveBlueprintDraft(payload:BlueprintPayload){
  const user=await requireUser();
  const existing=await getMyBlueprint(payload.teamId);
  if(existing?.status==="SUBMITTED") throw new Error("BLUEPRINT_SUBMITTED");

  const {data:blueprint,error:blueprintError}=await supabase
    .from("blueprints")
    .upsert({
      event_id:payload.eventId,
      team_id:payload.teamId,
      problem_assignment_id:payload.problemAssignmentId,
      nodes:payload.nodes,
      edges:payload.edges,
      viewport:payload.viewport,
      notes:payload.notes,
      status:"DRAFT",
      submitted_at:null,
      updated_at:new Date().toISOString(),
    },{onConflict:"event_id,team_id"})
    .select("*")
    .single();
  if(blueprintError) throw blueprintError;

  const {data:lastVersion,error:lastVersionError}=await supabase
    .from("blueprint_versions")
    .select("version_number")
    .eq("blueprint_id",blueprint.id)
    .order("version_number",{ascending:false})
    .limit(1)
    .maybeSingle();
  if(lastVersionError) throw lastVersionError;

  const versionNumber=(lastVersion?.version_number??0)+1;
  const {error:versionError}=await supabase.from("blueprint_versions").insert({
    blueprint_id:blueprint.id,
    version_number:versionNumber,
    nodes:payload.nodes,
    edges:payload.edges,
    viewport:payload.viewport,
    notes:payload.notes,
    status:"DRAFT",
    created_by:user.id,
  });
  if(versionError) throw versionError;

  return {blueprint:blueprint as BlueprintRecord,versionNumber};
}

export async function submitBlueprint(payload:BlueprintPayload){
  const user=await requireUser();
  const existing=await getMyBlueprint(payload.teamId);
  if(!existing) throw new Error("BLUEPRINT_NOT_FOUND");
  if(existing.status==="SUBMITTED") throw new Error("BLUEPRINT_SUBMITTED");

  const {data:updated,error}=await supabase
    .from("blueprints")
    .update({
      nodes:payload.nodes,
      edges:payload.edges,
      viewport:payload.viewport,
      notes:payload.notes,
      status:"SUBMITTED",
      submitted_at:new Date().toISOString(),
      updated_at:new Date().toISOString(),
    })
    .eq("id",existing.id)
    .eq("team_id",payload.teamId)
    .select("*")
    .single();
  if(error) throw error;

  const {data:lastVersion,error:lastVersionError}=await supabase
    .from("blueprint_versions")
    .select("version_number")
    .eq("blueprint_id",existing.id)
    .order("version_number",{ascending:false})
    .limit(1)
    .maybeSingle();
  if(lastVersionError) throw lastVersionError;

  const {error:versionError}=await supabase.from("blueprint_versions").insert({
    blueprint_id:existing.id,
    version_number:(lastVersion?.version_number??0)+1,
    nodes:payload.nodes,
    edges:payload.edges,
    viewport:payload.viewport,
    notes:payload.notes,
    status:"SUBMITTED",
    created_by:user.id,
  });
  if(versionError) throw versionError;

  return updated as BlueprintRecord;
}

export async function logBlueprintActivity(teamId:string,eventId:string,action:string,metadata:Record<string,unknown>={}){
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error("AUTH_REQUIRED");
  const {error}=await supabase.from("activity_logs").insert({
    event_id:eventId,
    team_id:teamId,
    actor_id:user.id,
    action,
    metadata,
  });
  if(error) throw error;
}
