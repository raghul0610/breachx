import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Check, Copy, Download, ExternalLink, KeyRound, LockKeyhole, LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";

export function WorkspaceGuide({ onOpenLibrary, onOpenLearn }: { onOpenLibrary: () => void; onOpenLearn: () => void }) {
  return <div className="workspace-info-panel workspace-guide-page">
    <div className="section-kicker">ANCHON FIELD GUIDE</div><h2>Design with intent. Validate with evidence.</h2>
    <p className="workspace-page-lead">A practical walkthrough for turning a product idea into a reviewable system architecture.</p>
    <div className="guide-step-grid">
      {[["01","Define the problem","Describe users, core journeys, expected traffic, data sensitivity, latency targets and business constraints."],["02","Plan with ANCHON AI","Use Planning to clarify requirements and compare architecture approaches. Use Agent to draft a connected architecture from an approved brief."],["03","Compose the architecture","Browse the component library by category. Inspect responsibilities and trade-offs, then add components and connect request or event flows."],["04","Inspect every boundary","Select each node to review its role. Check authentication, authorization, validation, timeouts, retries, data ownership and failure handling."],["05","Run and evaluate","Use Run Request to trace a path through the system. Run architecture evaluation and resolve findings before sharing."],["06","Save and communicate","Save the draft, export a PDF, and share the design snapshot with reviewers."]].map(([number,title,body])=><article className="guide-step-card" key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}
    </div>
    <section className="guide-ai-card"><div className="section-kicker">GET BETTER RESULTS FROM AI</div><h3>Give the agent an engineering brief</h3><p>Include the product goal, user roles, peak traffic, data model, latency and availability targets, compliance needs, budget, and known constraints. Ask for alternatives and explicit trade-offs—not just a diagram.</p><pre>Design a system for [product].\nUsers: [who and how many]\nTraffic: [average and peak requests/sec]\nData: [entities, size, retention]\nQuality: [latency, availability, security]\nConstraints: [budget, stack, region]\nExplain trade-offs and failure modes.</pre><p className="github-muted">Review generated output before adopting it. AI suggestions are a starting point, not a production certification.</p></section>
    <div className="guide-actions"><button type="button" className="primary-btn compact" onClick={onOpenLibrary}>Explore component library</button><button type="button" className="secondary-btn compact" onClick={onOpenLearn}>Open system design academy</button></div>
  </div>;
}

export function WorkspaceShare({ applicationName, applicationDescription, notes, nodes, edges, onExport }: { applicationName: string; applicationDescription: string; notes: string; nodes: unknown[]; edges: unknown[]; onExport: () => void }) {
  const [status,setStatus]=useState("");
  const copySnapshot=async()=>{
    try {
      await navigator.clipboard.writeText(JSON.stringify({format:"anchon-architecture-v1",name:applicationName,description:applicationDescription,notes,nodes,edges,exportedAt:new Date().toISOString()},null,2));
      setStatus("Architecture JSON copied. You can share this snapshot with your reviewer.");
    } catch { setStatus("Clipboard access was blocked. Use Export PDF to share a readable snapshot."); }
  };
  return <div className="workspace-info-panel workspace-share-page">
    <div className="section-kicker">SHARE & REVIEW</div><h2>Make your architecture easy to review.</h2>
    <p className="workspace-page-lead">Prepare a portable snapshot of the current design for teammates, mentors, or reviewers.</p>
    <div className="share-preview-card"><div><span className="section-kicker">CURRENT DESIGN</span><h3>{applicationName || "Untitled architecture"}</h3><p>{applicationDescription}</p></div><div className="share-stats"><strong>{nodes.length}</strong><span>components</span><strong>{edges.length}</strong><span>connections</span></div></div>
    <div className="share-action-grid"><button type="button" className="share-action-card" onClick={onExport}><Download size={19}/><strong>Export PDF</strong><span>Readable architecture document</span></button><button type="button" className="share-action-card" onClick={copySnapshot}><Copy size={19}/><strong>Copy JSON snapshot</strong><span>Portable structured architecture data</span></button></div>
    {status && <p className="workspace-inline-status" role="status">{status}</p>}
    <div className="workspace-note-card"><ShieldCheck size={18}/><div><strong>Sharing status</strong><p>Use the three-dot menu on a project card to create a private share link. Recipients must sign in before ANCHON copies the shared project into their workspace.</p></div></div>
  </div>;
}

export function WorkspaceSettings() {
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [displayName,setDisplayName]=useState("");
  const [email,setEmail]=useState("");
  const [newEmail,setNewEmail]=useState("");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [avatarUrl,setAvatarUrl]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [userId,setUserId]=useState("");
  const [provider,setProvider]=useState("Email");

  useEffect(()=>{let alive=true;(async()=>{
    const {data,error}=await supabase.auth.getUser();
    if(!alive)return;
    if(error||!data.user){setError("Could not load the signed-in account. Sign in again.");setLoading(false);return;}
    const user=data.user;setUserId(user.id);setEmail(user.email??"");setNewEmail(user.email??"");
    setDisplayName(String(user.user_metadata?.display_name??user.user_metadata?.full_name??""));
    setAvatarUrl(String(user.user_metadata?.avatar_url??""));
    const providers=user.app_metadata?.providers as string[]|undefined;
    setProvider(providers?.length?providers.join(", "):String(user.app_metadata?.provider??"Email"));
    setLoading(false);
  })();return()=>{alive=false}},[]);

  const saveProfile=async()=>{
    setSaving(true);setError("");setMessage("");
    const {error}=await supabase.auth.updateUser({data:{display_name:displayName.trim(),avatar_url:avatarUrl.trim()}});
    if(error)setError(error.message);else setMessage("Profile details updated.");
    setSaving(false);
  };
  const changePassword=async()=>{
    setSaving(true);setError("");setMessage("");
    if(password.length<8){setError("Use at least 8 characters for the new password.");setSaving(false);return;}
    if(password!==confirmPassword){setError("The password confirmation does not match.");setSaving(false);return;}
    const {error}=await supabase.auth.updateUser({password});
    if(error)setError(error.message);else{setMessage("Password updated successfully.");setPassword("");setConfirmPassword("");}
    setSaving(false);
  };
  const changeEmail=async()=>{
    setSaving(true);setError("");setMessage("");
    if(!newEmail.trim()||newEmail.trim().toLowerCase()===email.toLowerCase()){setError("Enter a different valid email address.");setSaving(false);return;}
    const {error}=await supabase.auth.updateUser({email:newEmail.trim()});
    if(error)setError(error.message);else setMessage("Email change requested. Follow the confirmation link sent by your authentication provider.");
    setSaving(false);
  };
  const signOutAll=async()=>{
    if(!window.confirm("Sign out this account from all active sessions? You will be signed out here too."))return;
    const {error}=await supabase.auth.signOut({scope:"global"});
    if(error)setError(error.message);
  };

  if(loading)return <div className="workspace-info-panel"><p>Loading account settings…</p></div>;
  return <div className="workspace-info-panel workspace-settings-page">
    <div className="section-kicker">ACCOUNT & WORKSPACE</div><h2>Settings</h2><p className="workspace-page-lead">Manage your profile, sign-in details, and account security.</p>
    <section className="settings-card"><div className="settings-card-title"><UserRound size={17}/><div><h3>Profile</h3><p>How your account appears in ANCHON.</p></div></div>
      <label>Display name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your name"/></label>
      <label>Avatar image URL<input value={avatarUrl} onChange={e=>setAvatarUrl(e.target.value)} placeholder="https://…"/></label>
      {avatarUrl&&<img className="settings-avatar-preview" src={avatarUrl} alt="Profile avatar preview" onError={e=>{e.currentTarget.style.display="none"}}/>}
      <button type="button" className="primary-btn compact" onClick={saveProfile} disabled={saving}>Save profile</button>
    </section>
    <section className="settings-card"><div className="settings-card-title"><Mail size={17}/><div><h3>Email & authentication</h3><p>Signed in as {email||"Unknown"} · Provider: {provider}</p></div></div>
      <label>Change email<input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} autoComplete="email"/></label>
      <button type="button" className="secondary-btn compact" onClick={changeEmail} disabled={saving}>Request email change</button>
      <p className="settings-help">Your authentication provider may require confirmation at both email addresses before the change takes effect.</p>
    </section>
    <section className="settings-card"><div className="settings-card-title"><KeyRound size={17}/><div><h3>Change password</h3><p>Set a new password for password-based sign-in.</p></div></div>
      <label>New password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters"/></label>
      <label>Confirm new password<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="Re-enter new password"/></label>
      <button type="button" className="primary-btn compact" onClick={changePassword} disabled={saving}>Update password</button>
      <p className="settings-help">For Google or other OAuth-only accounts, change your password with that identity provider instead.</p>
    </section>
    <section className="settings-card"><div className="settings-card-title"><LockKeyhole size={17}/><div><h3>Sessions & security</h3><p>Account ID: <code>{userId}</code></p></div></div><p className="settings-help">Use a unique password, protect your email account, and sign out of shared devices. Session revocation depends on your Supabase Auth configuration.</p><button type="button" className="danger-btn compact" onClick={signOutAll}><LogOut size={13}/> Sign out all sessions</button></section>
    {error&&<p className="workspace-form-error" role="alert">{error}</p>}{message&&<p className="workspace-inline-status" role="status"><Check size={14}/>{message}</p>}
  </div>;
}
