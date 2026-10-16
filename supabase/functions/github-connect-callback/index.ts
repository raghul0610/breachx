import { createClient } from "npm:@supabase/supabase-js@2";

function responseRedirect(url: string) {
  return Response.redirect(url, 302);
}
function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
}
async function verify(payload: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = Uint8Array.from(atob(signature.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - signature.length % 4) % 4)), (c) => c.charCodeAt(0));
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(payload));
}
async function encryptToken(token: string, secret: string) {
  const rawKey = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));
  if (rawKey.length !== 32) throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  return btoa(String.fromCharCode(...iv)) + "." + btoa(String.fromCharCode(...new Uint8Array(cipher)));
}

Deno.serve(async (req) => {
  const appUrl = Deno.env.get("ANCHON_APP_URL");
  if (!appUrl) return new Response("ANCHON_APP_URL is not configured.", { status: 503 });
  const fail = (reason: string) => responseRedirect(new URL("/?github=error&reason=" + encodeURIComponent(reason), appUrl).toString());
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.has("error")) return fail("authorization_denied");
  if (!code || !state) return fail("invalid_callback");

  try {
    const [payload, signature, extra] = state.split(".");
    const stateSecret = Deno.env.get("GITHUB_OAUTH_STATE_SECRET");
    const clientId = Deno.env.get("GITHUB_APP_CLIENT_ID");
    const clientSecret = Deno.env.get("GITHUB_APP_CLIENT_SECRET");
    const encryptionKey = Deno.env.get("GITHUB_TOKEN_ENCRYPTION_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!payload || !signature || extra || !stateSecret || !clientId || !clientSecret || !encryptionKey || !supabaseUrl || !serviceKey) return fail("integration_not_configured");
    if (!(await verify(payload, signature, stateSecret))) return fail("invalid_state_signature");
    const claims = JSON.parse(decodeBase64Url(payload)) as { sub: string; ts: number; nonce: string };
    if (!claims.sub || !claims.nonce || !Number.isFinite(claims.ts) || Date.now() - claims.ts > 10 * 60 * 1000 || claims.ts > Date.now() + 60_000) return fail("expired_state");

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const tokenBody = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenBody.access_token) return fail("token_exchange_failed");

    const profileResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: "Bearer " + tokenBody.access_token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.login) return fail("github_profile_failed");

    const supabase = createClient(supabaseUrl, serviceKey);
    const encrypted = await encryptToken(tokenBody.access_token, encryptionKey);
    const { error } = await supabase.from("github_connections").upsert({
      user_id: claims.sub,
      github_login: profile.login,
      encrypted_access_token: encrypted,
      token_expires_at: tokenBody.expires_in ? new Date(Date.now() + Number(tokenBody.expires_in) * 1000).toISOString() : null,
      scopes: typeof tokenBody.scope === "string" ? tokenBody.scope.split(",").filter(Boolean) : [],
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) return fail("connection_save_failed");
    return responseRedirect(new URL("/?github=connected", appUrl).toString());
  } catch {
    return fail("callback_processing_failed");
  }
});
