import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": (Deno.env.get("ANCHON_APP_URL") ?? "*").replace(/\/+$/, ""), "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), slug = Deno.env.get("GITHUB_APP_SLUG"), secret = Deno.env.get("GITHUB_OAUTH_STATE_SECRET");
  if (!url || !anon || !slug || !secret) return json({ error: "GitHub App integration is not configured." }, 503);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Sign in to ANCHON first." }, 401);
  const client = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return json({ error: "Your ANCHON session is invalid or expired." }, 401);
  const payload = btoa(JSON.stringify({ sub: user.id, ts: Date.now(), nonce: crypto.randomUUID() })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const state = payload + "." + await sign(payload, secret);
  const installUrl = new URL("https://github.com/apps/" + encodeURIComponent(slug) + "/installations/new");
  installUrl.searchParams.set("state", state);
  return json({ url: installUrl.toString() });
});