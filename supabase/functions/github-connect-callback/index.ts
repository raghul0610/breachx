import { createClient } from "npm:@supabase/supabase-js@2";
const redirect = (url: string) => Response.redirect(url, 302);
function decodeUrl(value: string) { const s = value.replace(/-/g, "+").replace(/_/g, "/"); return atob(s + "=".repeat((4 - s.length % 4) % 4)); }
async function verify(payload: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const s = signature.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(s + "=".repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(payload));
}
function readConfiguredKey(name: string): string | undefined {
  const raw = Deno.env.get(name);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      if (typeof parsed.default === "string" && parsed.default.length > 0) return parsed.default;
      const first = Object.values(parsed).find((value) => typeof value === "string" && value.length > 0);
      if (typeof first === "string") return first;
    }
  } catch {
    if (/^sb_secret_/.test(raw)) return raw;
  }
  return undefined;
}
function derLength(length: number): Uint8Array {
  if (length < 128) return new Uint8Array([length]);
  const bytes: number[] = [];
  let value = length;
  while (value > 0) { bytes.unshift(value & 255); value >>>= 8; }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}
function wrapPkcs1AsPkcs8(pkcs1: Uint8Array): Uint8Array {
  const algorithm = new Uint8Array([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
  const octetLength = new Uint8Array([0x04, ...derLength(pkcs1.length)]);
  const octet = new Uint8Array(octetLength.length + pkcs1.length);
  octet.set(octetLength); octet.set(pkcs1, octetLength.length);
  const body = new Uint8Array(3 + algorithm.length + octet.length);
  body.set([0x02, 0x01, 0x00], 0); body.set(algorithm, 3); body.set(octet, 3 + algorithm.length);
  const sequenceLength = derLength(body.length);
  const result = new Uint8Array(1 + sequenceLength.length + body.length);
  result[0] = 0x30; result.set(sequenceLength, 1); result.set(body, 1 + sequenceLength.length);
  return result;
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
  let returnOrigin = appUrl.replace(/\\/+$/, "");
  const fail = (reason: string) => redirect(new URL("/?github=error&reason=" + encodeURIComponent(reason), returnOrigin).toString());
  const url = new URL(req.url), state = url.searchParams.get("state"), installationId = url.searchParams.get("installation_id"), action = url.searchParams.get("setup_action");
  if (!state || !installationId || (action !== "install" && action !== "update")) return fail("installation_not_completed");
  try {
    const [payload, signature, extra] = state.split(".");
    const stateSecret = Deno.env.get("GITHUB_OAUTH_STATE_SECRET"), appId = Deno.env.get("GITHUB_APP_ID");
    const privateKey = Deno.env.get("GITHUB_APP_PRIVATE_KEY"), supabaseUrl = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? readConfiguredKey("SUPABASE_SECRET_KEYS");
    if (!payload || !signature || extra || !stateSecret || !appId || !privateKey || !supabaseUrl || !serviceKey) return fail("integration_not_configured");
    if (!(await verify(payload, signature, stateSecret))) return fail("invalid_state_signature");
    const claims = JSON.parse(decodeUrl(payload)) as { sub: string; ts: number; nonce: string; origin?: string };
    const configuredOrigin = appUrl.replace(/\\/+$/, "");
    const allowedPreview = typeof claims.origin === "string" && /^https:\/\/breachx-[a-z0-9-]+-raghul06102006-7731s-projects\.vercel\.app$/.test(claims.origin);
    if (claims.origin === configuredOrigin || allowedPreview) returnOrigin = claims.origin!;
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
    return redirect(new URL("/?github=connected", returnOrigin).toString());
  } catch {
    return fail("callback_processing_failed");
  }
});