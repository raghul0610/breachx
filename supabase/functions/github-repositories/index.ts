import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ANCHON_APP_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
async function decryptToken(value: string, secret: string) {
  const [ivText, cipherText, extra] = value.split(".");
  if (!ivText || !cipherText || extra) throw new Error("Stored token format is invalid.");
  const rawKey = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));
  if (rawKey.length !== 32) throw new Error("Token encryption key is invalid.");
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
  const iv = Uint8Array.from(atob(ivText), (c) => c.charCodeAt(0));
  const cipher = Uint8Array.from(atob(cipherText), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const encryptionKey = Deno.env.get("GITHUB_TOKEN_ENCRYPTION_KEY");
  const authorization = req.headers.get("Authorization");
  if (!url || !anon || !service || !encryptionKey) return json({ error: "GitHub integration is not configured." }, 503);
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Sign in to ANCHON first." }, 401);

  const authClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: "Your ANCHON session is invalid or expired." }, 401);

  const admin = createClient(url, service);
  const { data: connection, error } = await admin.from("github_connections")
    .select("github_login,encrypted_access_token,token_expires_at,scopes")
    .eq("user_id", user.id).maybeSingle();
  if (error) return json({ error: "Could not load your GitHub connection." }, 500);
  if (!connection) return json({ connected: false, repositories: [] });
  if (connection.token_expires_at && new Date(connection.token_expires_at).getTime() < Date.now()) {
    return json({ error: "Your GitHub authorization has expired. Reconnect GitHub." }, 401);
  }

  try {
    const token = await decryptToken(connection.encrypted_access_token, encryptionKey);
    const reposResponse = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member", {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    });
    if (!reposResponse.ok) return json({ error: reposResponse.status === 401 ? "GitHub authorization expired. Reconnect GitHub." : "GitHub could not list repositories. Check the GitHub App repository permissions." }, reposResponse.status === 401 ? 401 : 502);
    const repositories = (await reposResponse.json()).map((repo: Record<string, unknown>) => ({
      id: repo.id, name: repo.name, full_name: repo.full_name, private: repo.private,
      description: repo.description, default_branch: repo.default_branch, html_url: repo.html_url,
      updated_at: repo.updated_at,
    }));
    return json({ connected: true, login: connection.github_login, repositories });
  } catch {
    return json({ error: "Could not securely read the GitHub connection." }, 500);
  }
});
