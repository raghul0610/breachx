import { supabase } from "./supabase";
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
export async function getMyBlueprint(teamId:string){
  const {data,error}=await supabase.from("blueprints").select("*").eq("team_id",teamId).limit(1).maybeSingle();
  if(error) throw error; return data;
}