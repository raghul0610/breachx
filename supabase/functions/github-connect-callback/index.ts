import { createClient } from "npm:@supabase/supabase-js@2";
const redirect = (url: string) => Response.redirect(url, 302);
function decodeUrl(value: string) { const s = value.replace(/-/g, "+").replace(/_/g, "/"); return atob(s + "=".repeat((4 - s.length % 4) % 4)); }
async function verify(payload: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const s = signature.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(s + "=".repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(payload));
}
function b64url(data: string | Uint8Array) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function appJwt(appId: string, pem: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iat: now - 30, exp: now + 8 * 60, iss: appId }));
  const unsigned = header + "." + payload;
  const keyData = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(keyData);
  const keyBytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return unsigned + "." + b64url(new Uint8Array(signature));
}
Deno.serve(async (req) => {
  const appUrl = Deno.env.get("ANCHON_APP_URL");
  if (!appUrl) return new Response("ANCHON_APP_URL is not configured.", { status: 503 });
  const fail = (reason: string) => redirect(new URL("/?github=error&reason=" + encodeURIComponent(reason), appUrl).toString());
  const url = new URL(req.url), state = url.searchParams.get("state"), installationId = url.searchParams.get("installation_id"), action = url.searchParams.get("setup_action");
  if (!state || !installationId || action !== "install") return fail("installation_not_completed");
  try {
    const [payload, signature, extra] = state.split(".");
    const stateSecret = Deno.env.get("GITHUB_OAUTH_STATE_SECRET"), appId = Deno.env.get("GITHUB_APP_ID");
    const privateKey = Deno.env.get("GITHUB_APP_PRIVATE_KEY"), supabaseUrl = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!payload || !signature || extra || !stateSecret || !appId || !privateKey || !supabaseUrl || !serviceKey) return fail("integration_not_configured");
    if (!(await verify(payload, signature, stateSecret))) return fail("invalid_state_signature");
    const claims = JSON.parse(decodeUrl(payload)) as { sub: string; ts: number; nonce: string };
    if (!claims.sub || !claims.nonce || !Number.isFinite(claims.ts) || Date.now() - claims.ts > 10 * 60 * 1000 || claims.ts > Date.now() + 60_000) return fail("expired_state");
    const jwt = await appJwt(appId, privateKey.replace(/\\n/g, "\n"));
    const installationResponse = await fetch("https://api.github.com/app/installations/" + encodeURIComponent(installationId), {
      headers: { Authorization: "Bearer " + jwt, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    });
    const installation = await installationResponse.json();
    if (!installationResponse.ok || !installation.account?.login) return fail("installation_verification_failed");
    const supabase = createClient(supabaseUrl, serviceKey);
    const { error } = await supabase.from("github_connections").upsert({
      user_id: claims.sub, github_login: installation.account.login, installation_id: Number(installationId), updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) return fail("connection_save_failed");
    return redirect(new URL("/?github=connected", appUrl).toString());
  } catch {
    return fail("callback_processing_failed");
  }
});