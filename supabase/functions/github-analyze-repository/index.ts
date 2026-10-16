import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": Deno.env.get("ANCHON_APP_URL") ?? "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
function b64url(data: string | Uint8Array) { const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data; return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
async function appJwt(appId: string, pem: string) {
  const now = Math.floor(Date.now() / 1000), head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })), body = b64url(JSON.stringify({ iat: now - 30, exp: now + 8 * 60, iss: appId })), unsigned = head + "." + body;
  const binary = atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""));
  const keyBytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  return unsigned + "." + b64url(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned))));
}
const ignored = /(^|\/)(node_modules|vendor|dist|build|coverage|\.git|\.next|\.nuxt|\.venv|venv|__pycache__|target)(\/|$)/;
const secretPath = /(^|\/)(\.env($|\.)|.*\.(pem|key|p12|pfx|keystore)$|id_rsa|id_ed25519)/i;
const manifests = new Set(["package.json","pyproject.toml","requirements.txt","Pipfile","Cargo.toml","go.mod","pom.xml","build.gradle","build.gradle.kts","Gemfile","composer.json","Dockerfile","docker-compose.yml","docker-compose.yaml","Makefile","README.md","vite.config.ts","next.config.js","next.config.ts","angular.json","manage.py"]);
const languageFor = (path: string) => {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string,string> = { ts:"TypeScript",tsx:"TypeScript",js:"JavaScript",jsx:"JavaScript",py:"Python",go:"Go",rs:"Rust",java:"Java",kt:"Kotlin",cs:"C#",cpp:"C++",cc:"C++",c:"C",h:"C/C++",hpp:"C++",php:"PHP",rb:"Ruby",swift:"Swift",dart:"Dart",vue:"Vue",svelte:"Svelte",html:"HTML",css:"CSS",scss:"SCSS",sql:"SQL",sh:"Shell",yml:"YAML",yaml:"YAML",json:"JSON",md:"Markdown",toml:"TOML",xml:"XML" };
  return map[ext] ?? "";
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), appId = Deno.env.get("GITHUB_APP_ID"), privateKey = Deno.env.get("GITHUB_APP_PRIVATE_KEY");
  if (!url || !anon || !service || !appId || !privateKey) return json({ error: "GitHub App integration is not configured." }, 503);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Sign in to ANCHON first." }, 401);
  const authClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: "Your ANCHON session is invalid or expired." }, 401);
  let requested: { repository?: string; branch?: string } = {};
  try { requested = await req.json(); } catch { return json({ error: "Send a repository name." }, 400); }
  if (typeof requested.repository !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(requested.repository)) return json({ error: "Choose a valid repository from the connected installation." }, 400);
  const admin = createClient(url, service);
  const { data: connection, error: connectionError } = await admin.from("github_connections").select("installation_id").eq("user_id", user.id).maybeSingle();
  if (connectionError) return json({ error: "Could not load your GitHub connection." }, 500);
  if (!connection) return json({ error: "Connect GitHub before analysing a repository." }, 403);
  try {
    const jwt = await appJwt(appId, privateKey.replace(/\\n/g, "\n"));
    const tokenRes = await fetch("https://api.github.com/app/installations/" + connection.installation_id + "/access_tokens", { method: "POST", headers: { Authorization: "Bearer " + jwt, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });
    const tokenBody = await tokenRes.json();
    if (!tokenRes.ok || !tokenBody.token) return json({ error: "Could not obtain a scoped GitHub installation token." }, 502);
    const token = tokenBody.token;
    const gh = async (path: string) => {
      const response = await fetch("https://api.github.com" + path, { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });
      const body = await response.json();
      if (!response.ok) throw new Error(response.status === 404 ? "Repository or branch was not found in this installation." : response.status === 403 ? "GitHub denied access. Check installation repository selection and read permissions." : "GitHub API request failed (" + response.status + ").");
      return body;
    };
    const [owner, name] = requested.repository.split("/");
    const repository = await gh("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(name));
    if (repository.full_name?.toLowerCase() !== requested.repository.toLowerCase()) return json({ error: "Repository was not found in the connected installation." }, 404);
    const branch = typeof requested.branch === "string" && /^[A-Za-z0-9._/-]{1,200}$/.test(requested.branch) ? requested.branch : repository.default_branch;
    const branchInfo = await gh("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(name) + "/branches/" + branch.split("/").map(encodeURIComponent).join("/"));
    const tree = await gh("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(name) + "/git/trees/" + branchInfo.commit.sha + "?recursive=1");
    if (tree.truncated) return json({ error: "This repository is too large for a complete single-pass scan. Narrowed or paginated scanning is required." }, 413);
    const entries = (tree.tree ?? []).filter((entry: Record<string,unknown>) => entry.type === "blob" && typeof entry.path === "string" && !ignored.test(entry.path as string) && !secretPath.test(entry.path as string));
    const languageCounts: Record<string, number> = {};
    const directories = new Set<string>();
    for (const entry of entries as {path:string;size?:number}[]) {
      const language = languageFor(entry.path);
      if (language) languageCounts[language] = (languageCounts[language] ?? 0) + 1;
      const parts = entry.path.split("/");
      for (let i=1;i<parts.length;i++) directories.add(parts.slice(0,i).join("/"));
    }
    const manifestPaths = (entries as {path:string}[]).map(e=>e.path).filter(path => manifests.has(path.split("/").pop() ?? "") || /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|go\.mod|Cargo\.toml)$/.test(path)).slice(0,25);
    const manifestDetails: {path:string;summary:string[]}[] = [];
    for (const path of manifestPaths) {
      try {
        const file = await gh("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(name) + "/contents/" + path.split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(branch));
        if (file.encoding !== "base64" || typeof file.content !== "string") continue;
        const binary = atob(file.content.replace(/\n/g, ""));
        const bytes = Uint8Array.from(binary, c=>c.charCodeAt(0));
        const content = new TextDecoder().decode(bytes).slice(0, 120_000);
        const summary: string[] = [];
        if (path.endsWith("package.json")) {
          const pkg = JSON.parse(content);
          if (pkg.name) summary.push("Package: " + pkg.name);
          if (pkg.scripts && typeof pkg.scripts === "object") summary.push("Scripts: " + Object.keys(pkg.scripts).slice(0,12).join(", "));
          const deps = {...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {})};
          summary.push("Dependencies: " + Object.keys(deps).slice(0,40).join(", "));
        } else if (path.endsWith("requirements.txt")) {
          summary.push("Python packages: " + content.split(/\r?\n/).map(l=>l.trim()).filter(l=>l && !l.startsWith("#")).slice(0,50).join(", "));
        } else if (path.endsWith("pyproject.toml") || path.endsWith("Cargo.toml") || path.endsWith("go.mod") || path.endsWith("pom.xml") || path.endsWith("Gemfile") || path.endsWith("composer.json")) {
          summary.push(...content.split(/\r?\n/).map(l=>l.trim()).filter(l=>l && !l.startsWith("#")).slice(0,35));
        } else if (/README\.md$/i.test(path)) {
          summary.push(...content.split(/\r?\n/).filter(l=>/^#{1,3}\s|^[-*]\s/.test(l)).slice(0,20));
        } else {
          summary.push(...content.split(/\r?\n/).filter(l=>l.trim()).slice(0,20));
        }
        manifestDetails.push({path,summary});
      } catch { /* Skip unreadable or non-text manifests; continue the scan. */ }
    }
    const totalBytes = (entries as {size?:number}[]).reduce((sum,e)=>sum+(e.size ?? 0),0);
    return json({
      repository: repository.full_name, branch, commit: branchInfo.commit.sha, analyzedAt: new Date().toISOString(),
      summary: { files: entries.length, directories: directories.size, sizeBytes: totalBytes, manifests: manifestPaths.length, truncated: false },
      languages: Object.entries(languageCounts).map(([language,files])=>({language,files})).sort((a,b)=>b.files-a.files),
      topLevel: [...new Set((entries as {path:string}[]).map(e=>e.path.split("/")[0]))].sort().slice(0,80),
      directories: [...directories].sort().slice(0,150),
      keyFiles: manifestDetails,
      note: "Static metadata scan only. It does not execute code, inspect secrets, or infer runtime data flows."
    });
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : "Repository analysis failed." }, 502);
  }
});