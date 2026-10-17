import { createClient } from "npm:@supabase/supabase-js@2";
const baseCors = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
function corsFor(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const configured = (Deno.env.get("ANCHON_APP_URL") ?? "").replace(/\/+$/, "");
  const isVercelPreview = /^https:\/\/breachx-[a-z0-9-]+-raghul06102006-7731s-projects\.vercel\.app$/.test(origin);
  const allowedOrigin = origin === configured || isVercelPreview ? origin : configured;
  return { ...baseCors, ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}) };
}
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsFor(req), "Content-Type": "application/json" } });
function b64url(data: string | Uint8Array) { const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data; return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
async function appJwt(appId: string, pem: string) {
  const now = Math.floor(Date.now() / 1000), head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })), body = b64url(JSON.stringify({ iat: now - 30, exp: now + 8 * 60, iss: appId })), unsigned = head + "." + body;
  const binary = atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""));
  const keyBytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  return unsigned + "." + b64url(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned))));
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsFor(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), appId = Deno.env.get("GITHUB_APP_ID"), privateKey = Deno.env.get("GITHUB_APP_PRIVATE_KEY");
  const authorization = req.headers.get("Authorization");
  if (!url || !anon || !service || !appId || !privateKey) return json(req, { error: "GitHub App integration is not configured." }, 503);
  if (!authorization?.startsWith("Bearer ")) return json(req, { error: "Sign in to ANCHON first." }, 401);
  const authClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json(req, { error: "Your ANCHON session is invalid or expired." }, 401);
  const admin = createClient(url, service);
  const { data: connection, error } = await admin.from("github_connections").select("github_login,installation_id").eq("user_id", user.id).maybeSingle();
  if (error) return json(req, { error: "Could not load your GitHub connection." }, 500);
  if (!connection) return json(req, { connected: false, repositories: [] });
  try {
    const jwt = await appJwt(appId, privateKey.replace(/\\n/g, "\n"));
    const tokenResponse = await fetch("https://api.github.com/app/installations/" + connection.installation_id + "/access_tokens", {
      method: "POST", headers: { Authorization: "Bearer " + jwt, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    });
    const tokenBody = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenBody.token) return json(req, { error: "GitHub installation access failed. Reinstall or reconnect the GitHub App." }, 502);
    const repoResponse = await fetch("https://api.github.com/installation/repositories?per_page=100", {
      headers: { Authorization: "Bearer " + tokenBody.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    });
    const body = await repoResponse.json();
    if (!repoResponse.ok) return json(req, { error: "GitHub could not list repositories. Check the app's repository permissions." }, 502);
    const repositories = (body.repositories ?? []).map((repo: Record<string, unknown>) => ({
      id: repo.id, name: repo.name, full_name: repo.full_name, private: repo.private, description: repo.description,
      default_branch: repo.default_branch, html_url: repo.html_url, updated_at: repo.updated_at,
    }));
    return json(req, { connected: true, login: connection.github_login, repositories });
  } catch {
    return json(req, { error: "Could not securely read the GitHub connection." }, 500);
  }
});
