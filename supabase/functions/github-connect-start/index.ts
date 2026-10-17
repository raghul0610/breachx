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
    if (/^sb_(publishable|secret)_/.test(raw)) return raw;
  }
  return undefined;
}
async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsFor(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? readConfiguredKey("SUPABASE_PUBLISHABLE_KEYS");
  const slug = Deno.env.get("GITHUB_APP_SLUG");
  const secret = Deno.env.get("GITHUB_OAUTH_STATE_SECRET");
  const missing = [
    !url && "SUPABASE_URL",
    !anon && "SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEYS",
    !slug && "GITHUB_APP_SLUG",
    !secret && "GITHUB_OAUTH_STATE_SECRET",
  ].filter(Boolean);
  if (missing.length) return json(req, { error: "GitHub App integration is not configured.", missing }, 503);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json(req, { error: "Sign in to ANCHON first." }, 401);
  const client = createClient(url!, anon!, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return json(req, { error: "Your ANCHON session is invalid or expired." }, 401);
  const payload = btoa(JSON.stringify({ sub: user.id, ts: Date.now(), nonce: crypto.randomUUID() })).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const state = payload + "." + await sign(payload, secret!);
  const installUrl = new URL("https://github.com/apps/" + encodeURIComponent(slug!) + "/installations/new");
  installUrl.searchParams.set("state", state);
  return json(req, { url: installUrl.toString() });
});
