import { supabase } from "./supabase";

export async function getBreachXEvent() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("name", "Breach X")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTracks(eventId: string) {
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("event_id", eventId)
    .order("name");
  if (error) throw error;
  return data;
}

export async function getProblemStatements(trackId: string) {
  const { data, error } = await supabase
    .from("problem_statements")
    .select("*")
    .eq("track_id", trackId)
    .eq("is_active", true)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function getMyTeam() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("team_members")
    .select("team_id, teams(*)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyBlueprint(teamId: string) {
  const { data, error } = await supabase
    .from("blueprints")
    .select("*")
    .eq("team_id", teamId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
