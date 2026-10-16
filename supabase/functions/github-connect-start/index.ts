import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ANCHON_APP_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const appId = Deno.env.get("GITHUB_APP_CLIENT_ID");
  const stateSecret = Deno.env.get("GITHUB_OAUTH_STATE_SECRET");
  const callbackUrl = Deno.env.get("GITHUB_CALLBACK_URL");
  if (!supabaseUrl || !anonKey || !appId || !stateSecret || !callbackUrl) {
    return json({ error: "GitHub integration is not configured. Contact the ANCHON administrator." }, 503);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Sign in to ANCHON first." }, 401);
  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return json({ error: "Your ANCHON session is invalid or expired." }, 401);

  const payload = btoa(JSON.stringify({ sub: user.id, ts: Date.now(), nonce: crypto.randomUUID() })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const state = payload + "." + await sign(payload, stateSecret);
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("state", state);
  // Repository permissions are defined on the GitHub App; avoid requesting broad OAuth scopes.
  return json({ url: url.toString() });
});
